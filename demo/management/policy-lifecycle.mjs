import {
  createHmac,
  createPublicKey,
  randomUUID,
  sign,
  timingSafeEqual,
  verify,
} from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { validateAdminAiPocPolicy } from "../runtime/admin-ai-policy.mjs";
import { canonicalJson, sha256 } from "../runtime/enforcement-gate.mjs";
import {
  createLocalOwnerPolicyAuthorization,
  createPolicyActivationCandidate,
} from "../runtime/policy-generation-fence.mjs";

export const SIGNED_POLICY_ARTIFACT_SCHEMA =
  "chimpmaera.demo/signed-policy-artifact/v1";
export const POLICY_LIFECYCLE_APPROVAL_SCHEMA =
  "chimpmaera.demo/policy-lifecycle-approval/v1";
export const POLICY_LIFECYCLE_RECORD_SCHEMA =
  "chimpmaera.demo/policy-lifecycle-record/v1";
export const POLICY_LIFECYCLE_RECEIPT_SCHEMA =
  "chimpmaera.demo/policy-lifecycle-receipt/v1";
export const POLICY_SEMANTIC_DIFF_SCHEMA =
  "chimpmaera.demo/policy-semantic-diff/v1";

const TENANT = "panskys-zoo-demo";
const POLICY_ID = "admin-ai-poc-policy-v1";
const POLICY_SCHEMA = "chimpmaera.demo/admin-ai-poc-policy/v1";
const RUNTIME_API = "chimpmaera.demo/policy-runtime/v1";
const MAX_POLICY_BYTES = 64 * 1024;
const OUTCOME_RANK = new Map([
  ["DENY", 0],
  ["OWNER_ESCALATION", 1],
  ["AUTO_GRANT", 2],
]);
const ENTRY_STATES = new Set([
  "DRAFT",
  "VALIDATED",
  "SIMULATED",
  "APPROVED",
  "STAGED",
  "ACTIVE",
  "SUPERSEDED",
  "RETIRED",
  "REVOKED",
]);
const TRANSITIONS = new Set([
  "DRAFTED",
  "VALIDATED",
  "SIMULATED",
  "APPROVED",
  "STAGED",
  "ACTIVATED",
  "RETIRED",
  "REVOKED",
  "ROLLOUT_CONFIRMED",
  "ROLLOUT_FROZEN",
]);

function deny(code) {
  throw new Error(code);
}

function assertExactKeys(value, expected, code) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())
  ) deny(code);
}

function assertDigest(value, code) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) deny(code);
}

function assertGeneration(value, code) {
  if (!Number.isSafeInteger(value) || value < 1) deny(code);
}

function assertTime(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) deny(code);
}

function assertId(value, code) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:._-]{7,127}$/.test(value)) {
    deny(code);
  }
}

function equalSecret(leftValue, rightValue) {
  const left = Buffer.from(leftValue ?? "");
  const right = Buffer.from(rightValue ?? "");
  return left.length === right.length && timingSafeEqual(left, right);
}

function assertOwnerToken(value) {
  if (typeof value !== "string" || value.length < 32) {
    deny("POLICY_LIFECYCLE_OWNER_KEY_INVALID_DENIED");
  }
}

function decodePolicy(sourceBase64, code) {
  if (
    typeof sourceBase64 !== "string"
    || sourceBase64.length === 0
    || sourceBase64.length > Math.ceil(MAX_POLICY_BYTES / 3) * 4
  ) deny(code);
  const bytes = Buffer.from(sourceBase64, "base64");
  if (
    bytes.length === 0
    || bytes.length > MAX_POLICY_BYTES
    || bytes.toString("base64") !== sourceBase64
  ) deny(code);
  let policy;
  try {
    policy = JSON.parse(bytes.toString("utf8"));
  } catch {
    deny(code);
  }
  return { bytes, policy };
}

function validateLifecyclePolicyShape(policy, code) {
  assertExactKeys(policy, ["policyId", "rules", "schemaVersion"], code);
  if (
    policy.schemaVersion !== POLICY_SCHEMA
    || policy.policyId !== POLICY_ID
    || !Array.isArray(policy.rules)
    || policy.rules.length !== 3
  ) deny(code);
  const requestKinds = [
    "SYNTHETIC_ESPOCRM_CONTACT_CREATE",
    "SYNTHETIC_DOLIBARR_ORDER_CREATE",
    "*",
  ];
  for (const [index, rule] of policy.rules.entries()) {
    assertExactKeys(rule, ["outcome", "reasonCode", "requestKind"], code);
    if (
      rule.requestKind !== requestKinds[index]
      || !OUTCOME_RANK.has(rule.outcome)
      || typeof rule.reasonCode !== "string"
      || !/^[A-Z][A-Z0-9_]{7,100}$/.test(rule.reasonCode)
      || (rule.requestKind === "*" && rule.outcome !== "DENY")
    ) deny(code);
  }
  return policy;
}

function artifactCore(artifact) {
  const { signature, ...core } = artifact;
  return core;
}

function artifactDigest(artifact) {
  return sha256(canonicalJson(artifact));
}

function publicKeyDigest(publicKey) {
  try {
    return sha256(createPublicKey(publicKey).export({ type: "spki", format: "der" }));
  } catch {
    deny("POLICY_LIFECYCLE_TRUST_KEY_INVALID_DENIED");
  }
}

function trustSnapshot(trustStore, issuer, keyId) {
  const issuerKeys = trustStore?.[issuer];
  const publicKey = issuerKeys?.[keyId];
  if (typeof publicKey !== "string" && typeof publicKey !== "object") {
    deny("POLICY_LIFECYCLE_TRUST_UNKNOWN_DENIED");
  }
  return {
    publicKey,
    digest: sha256(canonicalJson({
      issuer,
      keyId,
      publicKeyDigest: publicKeyDigest(publicKey),
    })),
  };
}

function validateArtifactStructure(artifact) {
  const code = "POLICY_LIFECYCLE_ARTIFACT_INVALID_DENIED";
  assertExactKeys(artifact, [
    "compatibility",
    "expiresAtMs",
    "generation",
    "issuedAtMs",
    "issuer",
    "keyId",
    "notBeforeMs",
    "policyId",
    "policySemanticDigest",
    "policySourceBase64",
    "policySourceDigest",
    "schemaVersion",
    "signature",
    "tenant",
  ], code);
  assertExactKeys(artifact.compatibility, [
    "policySchemaVersion",
    "runtimeApiVersion",
  ], code);
  assertExactKeys(artifact.signature, ["algorithm", "valueBase64"], code);
  if (
    artifact.schemaVersion !== SIGNED_POLICY_ARTIFACT_SCHEMA
    || artifact.tenant !== TENANT
    || artifact.policyId !== POLICY_ID
    || typeof artifact.issuer !== "string"
    || !/^[a-z][a-z0-9.-]{2,80}$/.test(artifact.issuer)
    || typeof artifact.keyId !== "string"
    || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,80}$/.test(artifact.keyId)
    || artifact.signature.algorithm !== "Ed25519"
    || typeof artifact.signature.valueBase64 !== "string"
    || artifact.signature.valueBase64.length < 16
  ) deny(code);
  assertGeneration(artifact.generation, code);
  for (const value of [artifact.issuedAtMs, artifact.notBeforeMs, artifact.expiresAtMs]) {
    assertTime(value, code);
  }
  if (
    artifact.issuedAtMs > artifact.notBeforeMs
    || artifact.notBeforeMs >= artifact.expiresAtMs
  ) deny(code);
  assertDigest(artifact.policySourceDigest, code);
  assertDigest(artifact.policySemanticDigest, code);
  const { bytes, policy } = decodePolicy(artifact.policySourceBase64, code);
  validateLifecyclePolicyShape(policy, code);
  if (
    sha256(bytes) !== artifact.policySourceDigest
    || sha256(canonicalJson(policy)) !== artifact.policySemanticDigest
  ) deny(code);
  return { artifact, bytes, policy };
}

function verifyArtifact(artifact, trustStore) {
  const validated = validateArtifactStructure(artifact);
  const trust = trustSnapshot(trustStore, artifact.issuer, artifact.keyId);
  let signature;
  try {
    signature = Buffer.from(artifact.signature.valueBase64, "base64");
  } catch {
    deny("POLICY_LIFECYCLE_SIGNATURE_INVALID_DENIED");
  }
  if (
    signature.length === 0
    || signature.toString("base64") !== artifact.signature.valueBase64
    || !verify(
      null,
      Buffer.from(canonicalJson(artifactCore(artifact))),
      trust.publicKey,
      signature,
    )
  ) deny("POLICY_LIFECYCLE_SIGNATURE_INVALID_DENIED");
  return { ...validated, trustSnapshotDigest: trust.digest };
}

function assertArtifactWindow(artifact, now) {
  if (now < artifact.notBeforeMs || now >= artifact.expiresAtMs) {
    deny("POLICY_LIFECYCLE_ARTIFACT_TIME_INVALID_DENIED");
  }
}

function assertCompatibility(artifact) {
  if (
    artifact.compatibility.policySchemaVersion !== POLICY_SCHEMA
    || artifact.compatibility.runtimeApiVersion !== RUNTIME_API
  ) deny("POLICY_LIFECYCLE_COMPATIBILITY_INVALID_DENIED");
}

function semanticDiff(basePolicy, targetPolicy, baseGeneration, targetGeneration) {
  const changes = [];
  if (basePolicy !== null) {
    for (let index = 0; index < targetPolicy.rules.length; index += 1) {
      const before = basePolicy.rules[index];
      const after = targetPolicy.rules[index];
      if (
        before.outcome !== after.outcome
        || before.reasonCode !== after.reasonCode
      ) {
        const beforeRank = OUTCOME_RANK.get(before.outcome);
        const afterRank = OUTCOME_RANK.get(after.outcome);
        changes.push({
          requestKind: after.requestKind,
          fromOutcome: before.outcome,
          toOutcome: after.outcome,
          kind: afterRank > beforeRank
            ? "AUTHORITY_WIDENING"
            : afterRank < beforeRank
              ? "AUTHORITY_TIGHTENING"
              : "REASON_CHANGE",
        });
      }
    }
  }
  const diff = {
    schemaVersion: POLICY_SEMANTIC_DIFF_SCHEMA,
    baseGeneration,
    targetGeneration,
    changes,
    authorityWidening: changes.some(({ kind }) => kind === "AUTHORITY_WIDENING"),
  };
  return { diff, diffDigest: sha256(canonicalJson(diff)) };
}

function approvalCore(fields) {
  return {
    schemaVersion: POLICY_LIFECYCLE_APPROVAL_SCHEMA,
    tenant: fields.tenant,
    policyId: fields.policyId,
    generation: fields.generation,
    artifactDigest: fields.artifactDigest,
    diffDigest: fields.diffDigest,
    simulationDigest: fields.simulationDigest,
    allowWidening: fields.allowWidening,
    issuedAtMs: fields.issuedAtMs,
    expiresAtMs: fields.expiresAtMs,
  };
}

export function createLocalOwnerLifecycleApproval({
  tenant = TENANT,
  policyId = POLICY_ID,
  generation,
  artifactDigest: signedArtifactDigest,
  diffDigest,
  simulationDigest,
  allowWidening,
  issuedAtMs,
  expiresAtMs,
  ownerApprovalToken,
}) {
  assertOwnerToken(ownerApprovalToken);
  const core = approvalCore({
    tenant,
    policyId,
    generation,
    artifactDigest: signedArtifactDigest,
    diffDigest,
    simulationDigest,
    allowWidening,
    issuedAtMs,
    expiresAtMs,
  });
  const code = "POLICY_LIFECYCLE_APPROVAL_INVALID_DENIED";
  assertGeneration(core.generation, code);
  for (const value of [core.artifactDigest, core.diffDigest, core.simulationDigest]) {
    assertDigest(value, code);
  }
  if (typeof core.allowWidening !== "boolean") deny(code);
  assertTime(core.issuedAtMs, code);
  assertTime(core.expiresAtMs, code);
  if (core.issuedAtMs >= core.expiresAtMs) deny(code);
  return {
    ...core,
    binding: createHmac("sha256", ownerApprovalToken)
      .update(`policy-lifecycle-approval-v1\n${canonicalJson(core)}`)
      .digest("hex"),
  };
}

function validateApproval(approval, entry, ownerApprovalToken, now) {
  const code = "POLICY_LIFECYCLE_APPROVAL_INVALID_DENIED";
  assertExactKeys(approval, [
    "allowWidening",
    "artifactDigest",
    "binding",
    "diffDigest",
    "expiresAtMs",
    "generation",
    "issuedAtMs",
    "policyId",
    "schemaVersion",
    "simulationDigest",
    "tenant",
  ], code);
  const core = approvalCore(approval);
  if (
    approval.schemaVersion !== POLICY_LIFECYCLE_APPROVAL_SCHEMA
    || approval.tenant !== TENANT
    || approval.policyId !== POLICY_ID
    || approval.generation !== entry.generation
    || !equalSecret(approval.artifactDigest, entry.artifactDigest)
    || !equalSecret(approval.diffDigest, entry.diffDigest)
    || !equalSecret(approval.simulationDigest, entry.simulationDigest)
    || typeof approval.allowWidening !== "boolean"
  ) deny(code);
  for (const value of [
    approval.artifactDigest,
    approval.diffDigest,
    approval.simulationDigest,
    approval.binding,
  ]) assertDigest(value, code);
  assertTime(approval.issuedAtMs, code);
  assertTime(approval.expiresAtMs, code);
  if (
    approval.issuedAtMs >= approval.expiresAtMs
    || now < approval.issuedAtMs
    || now >= approval.expiresAtMs
  ) deny("POLICY_LIFECYCLE_APPROVAL_EXPIRED_DENIED");
  const expected = createHmac("sha256", ownerApprovalToken)
    .update(`policy-lifecycle-approval-v1\n${canonicalJson(core)}`)
    .digest("hex");
  if (!equalSecret(approval.binding, expected)) deny(code);
  if (entry.diff.authorityWidening && approval.allowWidening !== true) {
    deny("POLICY_LIFECYCLE_WIDENING_APPROVAL_REQUIRED_DENIED");
  }
  return approval;
}

export function createSignedPolicyArtifact({
  policyBytes,
  generation,
  issuer,
  keyId,
  issuedAtMs,
  notBeforeMs,
  expiresAtMs,
  privateKey,
  tenant = TENANT,
  policyId = POLICY_ID,
  policySchemaVersion = POLICY_SCHEMA,
  runtimeApiVersion = RUNTIME_API,
}) {
  const bytes = Buffer.from(policyBytes ?? "");
  if (bytes.length === 0 || bytes.length > MAX_POLICY_BYTES) {
    deny("POLICY_LIFECYCLE_ARTIFACT_INVALID_DENIED");
  }
  let policy;
  try {
    policy = JSON.parse(bytes.toString("utf8"));
  } catch {
    deny("POLICY_LIFECYCLE_ARTIFACT_INVALID_DENIED");
  }
  validateLifecyclePolicyShape(policy, "POLICY_LIFECYCLE_ARTIFACT_INVALID_DENIED");
  const core = {
    schemaVersion: SIGNED_POLICY_ARTIFACT_SCHEMA,
    tenant,
    policyId,
    generation,
    issuer,
    keyId,
    issuedAtMs,
    notBeforeMs,
    expiresAtMs,
    compatibility: { policySchemaVersion, runtimeApiVersion },
    policySourceBase64: bytes.toString("base64"),
    policySourceDigest: sha256(bytes),
    policySemanticDigest: sha256(canonicalJson(policy)),
  };
  const valueBase64 = sign(
    null,
    Buffer.from(canonicalJson(core)),
    privateKey,
  ).toString("base64");
  const artifact = {
    ...core,
    signature: { algorithm: "Ed25519", valueBase64 },
  };
  validateArtifactStructure(artifact);
  return artifact;
}

function recordCore(record) {
  const { recordBinding, ...core } = record;
  return core;
}

function signRecord(core, ownerApprovalToken) {
  return createHmac("sha256", ownerApprovalToken)
    .update(`policy-lifecycle-record-v1\n${canonicalJson(core)}`)
    .digest("hex");
}

function receiptCore(receipt) {
  const { receiptDigest, ...core } = receipt;
  return core;
}

function validateRecord(record, ownerApprovalToken) {
  const code = "POLICY_LIFECYCLE_RECORD_INVALID_DENIED";
  assertExactKeys(record, [
    "activeGeneration",
    "dispatch",
    "entries",
    "lastSafeGeneration",
    "policyId",
    "receipts",
    "recordBinding",
    "revision",
    "schemaVersion",
    "tenant",
  ], code);
  if (
    record.schemaVersion !== POLICY_LIFECYCLE_RECORD_SCHEMA
    || record.tenant !== TENANT
    || record.policyId !== POLICY_ID
    || !Number.isSafeInteger(record.revision)
    || record.revision < 1
    || !Array.isArray(record.entries)
    || !Array.isArray(record.receipts)
    || record.revision !== record.receipts.length
    || !["ACTIVE", "FROZEN"].includes(record.dispatch)
  ) deny(code);
  assertDigest(record.recordBinding, code);
  const generations = new Set();
  for (const entry of record.entries) {
    if (
      entry === null
      || typeof entry !== "object"
      || Array.isArray(entry)
      || !ENTRY_STATES.has(entry.state)
    ) deny(code);
    try {
      validateArtifactStructure(entry.artifact);
    } catch {
      deny(code);
    }
    assertGeneration(entry.generation, code);
    assertDigest(entry.artifactDigest, code);
    if (entry.artifact.generation !== entry.generation) deny(code);
    if (artifactDigest(entry.artifact) !== entry.artifactDigest) deny(code);
    if (generations.has(entry.generation)) deny(code);
    generations.add(entry.generation);
  }
  if (
    record.activeGeneration !== null
    && (!generations.has(record.activeGeneration)
      || record.entries.find(({ generation }) => generation === record.activeGeneration)?.state
        !== "ACTIVE")
  ) deny(code);
  if (record.lastSafeGeneration !== null && !generations.has(record.lastSafeGeneration)) {
    deny(code);
  }
  let previousReceiptDigest = null;
  const operations = new Set();
  for (const [index, receipt] of record.receipts.entries()) {
    assertExactKeys(receipt, [
      "artifactDigest",
      "detailsDigest",
      "fromState",
      "generation",
      "occurredAtMs",
      "operationId",
      "previousReceiptDigest",
      "receiptDigest",
      "schemaVersion",
      "sequence",
      "toState",
      "transition",
    ], code);
    if (
      receipt.schemaVersion !== POLICY_LIFECYCLE_RECEIPT_SCHEMA
      || receipt.sequence !== index + 1
      || !TRANSITIONS.has(receipt.transition)
      || receipt.previousReceiptDigest !== previousReceiptDigest
      || operations.has(receipt.operationId)
    ) deny(code);
    assertId(receipt.operationId, code);
    assertGeneration(receipt.generation, code);
    assertTime(receipt.occurredAtMs, code);
    for (const digest of [
      receipt.artifactDigest,
      receipt.detailsDigest,
      receipt.receiptDigest,
    ]) assertDigest(digest, code);
    if (sha256(canonicalJson(receiptCore(receipt))) !== receipt.receiptDigest) deny(code);
    operations.add(receipt.operationId);
    previousReceiptDigest = receipt.receiptDigest;
  }
  const expected = signRecord(recordCore(record), ownerApprovalToken);
  if (!equalSecret(record.recordBinding, expected)) deny(code);
  return record;
}

function entryFor(record, generation) {
  assertGeneration(generation, "POLICY_LIFECYCLE_GENERATION_INVALID_DENIED");
  const entry = record?.entries.find((value) => value.generation === generation);
  if (!entry) deny("POLICY_LIFECYCLE_GENERATION_UNKNOWN_DENIED");
  return entry;
}

export class PolicyLifecycleManager {
  constructor({
    recordPath,
    policyFence,
    ownerApprovalToken,
    ownerActivationToken,
    trustStore,
    now = () => Date.now(),
  }) {
    if (
      typeof recordPath !== "string"
      || recordPath.length === 0
      || typeof policyFence?.activate !== "function"
      || typeof policyFence?.assertUseBinding !== "function"
      || typeof trustStore !== "function"
      || typeof now !== "function"
    ) deny("POLICY_LIFECYCLE_CONFIG_INVALID_DENIED");
    assertOwnerToken(ownerApprovalToken);
    assertOwnerToken(ownerActivationToken);
    this.recordPath = recordPath;
    this.policyFence = policyFence;
    this.ownerApprovalToken = ownerApprovalToken;
    this.ownerActivationToken = ownerActivationToken;
    this.trustStore = trustStore;
    this.now = now;
    this._record = null;
    try {
      this._record = validateRecord(
        JSON.parse(readFileSync(recordPath, "utf8")),
        ownerApprovalToken,
      );
    } catch (error) {
      if (error?.code !== "ENOENT") {
        if (error instanceof SyntaxError) deny("POLICY_LIFECYCLE_RECORD_INVALID_DENIED");
        throw error;
      }
    }
  }

  get record() {
    return this._record === null ? null : structuredClone(this._record);
  }

  _load() {
    if (this._record === null) return null;
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(this.recordPath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT" || error instanceof SyntaxError) {
        deny("POLICY_LIFECYCLE_RECORD_INVALID_DENIED");
      }
      throw error;
    }
    this._record = validateRecord(parsed, this.ownerApprovalToken);
    return this._record;
  }

  _persist(record) {
    const core = recordCore(record);
    const signedRecord = {
      ...core,
      recordBinding: signRecord(core, this.ownerApprovalToken),
    };
    validateRecord(signedRecord, this.ownerApprovalToken);
    mkdirSync(dirname(this.recordPath), { recursive: true });
    const temp = `${this.recordPath}.tmp-${process.pid}-${randomUUID()}`;
    try {
      writeFileSync(temp, `${JSON.stringify(signedRecord, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      renameSync(temp, this.recordPath);
    } catch (error) {
      try {
        unlinkSync(temp);
      } catch (cleanupError) {
        if (cleanupError?.code !== "ENOENT") throw cleanupError;
      }
      throw error;
    }
    this._record = signedRecord;
  }

  _nextRecord(record, entry, { operationId, transition, fromState, toState, details }) {
    assertId(operationId, "POLICY_LIFECYCLE_OPERATION_ID_INVALID_DENIED");
    if (record.receipts.some((receipt) => receipt.operationId === operationId)) {
      deny("POLICY_LIFECYCLE_OPERATION_REPLAY_DENIED");
    }
    const occurredAtMs = this.now();
    assertTime(occurredAtMs, "POLICY_LIFECYCLE_CLOCK_INVALID_DENIED");
    const core = {
      schemaVersion: POLICY_LIFECYCLE_RECEIPT_SCHEMA,
      sequence: record.receipts.length + 1,
      operationId,
      transition,
      generation: entry.generation,
      artifactDigest: entry.artifactDigest,
      fromState,
      toState,
      occurredAtMs,
      detailsDigest: sha256(canonicalJson(details)),
      previousReceiptDigest: record.receipts.at(-1)?.receiptDigest ?? null,
    };
    const receipt = { ...core, receiptDigest: sha256(canonicalJson(core)) };
    return {
      record: {
        ...record,
        revision: record.revision + 1,
        entries: record.entries.map((value) =>
          value.generation === entry.generation ? { ...entry, state: toState } : value),
        receipts: [...record.receipts, receipt],
      },
      receipt,
    };
  }

  _trustAndTime(entry) {
    const now = this.now();
    assertTime(now, "POLICY_LIFECYCLE_CLOCK_INVALID_DENIED");
    const currentTrustStore = this.trustStore();
    const currentTrust = trustSnapshot(
      currentTrustStore,
      entry.artifact.issuer,
      entry.artifact.keyId,
    );
    if (
      entry.trustSnapshotDigest !== null
      && !equalSecret(entry.trustSnapshotDigest, currentTrust.digest)
    ) deny("POLICY_LIFECYCLE_TRUST_DRIFT_DENIED");
    const verified = verifyArtifact(entry.artifact, currentTrustStore);
    assertArtifactWindow(entry.artifact, now);
    assertCompatibility(entry.artifact);
    return verified;
  }

  draft(artifact, { operationId }) {
    const verified = verifyArtifact(artifact, this.trustStore());
    const now = this.now();
    assertTime(now, "POLICY_LIFECYCLE_CLOCK_INVALID_DENIED");
    assertArtifactWindow(artifact, now);
    const current = this._record === null ? null : this._load();
    if (current?.entries.some(({ generation }) => generation === artifact.generation)) {
      deny("POLICY_LIFECYCLE_GENERATION_REPLAY_DENIED");
    }
    if (
      current !== null
      && artifact.generation <= Math.max(...current.entries.map(({ generation }) => generation))
    ) deny("POLICY_LIFECYCLE_GENERATION_STALE_DENIED");
    const entry = {
      generation: artifact.generation,
      artifact,
      artifactDigest: artifactDigest(artifact),
      state: "DRAFT",
      trustSnapshotDigest: verified.trustSnapshotDigest,
      diff: null,
      diffDigest: null,
      simulationDigest: null,
      approval: null,
    };
    const base = current ?? {
      schemaVersion: POLICY_LIFECYCLE_RECORD_SCHEMA,
      tenant: TENANT,
      policyId: POLICY_ID,
      revision: 0,
      activeGeneration: null,
      lastSafeGeneration: null,
      dispatch: "FROZEN",
      entries: [],
      receipts: [],
      recordBinding: "0".repeat(64),
    };
    const withEntry = { ...base, entries: [...base.entries, entry] };
    const { record, receipt } = this._nextRecord(withEntry, entry, {
      operationId,
      transition: "DRAFTED",
      fromState: null,
      toState: "DRAFT",
      details: { signed: true, trustSnapshotDigest: verified.trustSnapshotDigest },
    });
    this._persist(record);
    return receipt;
  }

  validate(generation, { operationId }) {
    const current = this._load();
    const entry = entryFor(current, generation);
    if (entry.state !== "DRAFT") deny("POLICY_LIFECYCLE_TRANSITION_INVALID_DENIED");
    const verified = this._trustAndTime(entry);
    const activeEntry = current.activeGeneration === null
      ? null
      : entryFor(current, current.activeGeneration);
    const basePolicy = activeEntry === null
      ? null
      : decodePolicy(activeEntry.artifact.policySourceBase64,
        "POLICY_LIFECYCLE_ARTIFACT_INVALID_DENIED").policy;
    const { diff, diffDigest } = semanticDiff(
      basePolicy,
      verified.policy,
      current.activeGeneration,
      generation,
    );
    const nextEntry = { ...entry, diff, diffDigest };
    const withEntry = {
      ...current,
      entries: current.entries.map((value) =>
        value.generation === generation ? nextEntry : value),
    };
    const { record, receipt } = this._nextRecord(withEntry, nextEntry, {
      operationId,
      transition: "VALIDATED",
      fromState: "DRAFT",
      toState: "VALIDATED",
      details: { diffDigest, authorityWidening: diff.authorityWidening },
    });
    this._persist(record);
    return { receipt, diff: structuredClone(diff), diffDigest };
  }

  simulate(generation, { operationId }) {
    const current = this._load();
    const entry = entryFor(current, generation);
    if (entry.state !== "VALIDATED") deny("POLICY_LIFECYCLE_TRANSITION_INVALID_DENIED");
    this._trustAndTime(entry);
    const simulation = {
      schemaVersion: "chimpmaera.demo/policy-lifecycle-simulation/v1",
      artifactDigest: entry.artifactDigest,
      diffDigest: entry.diffDigest,
      simulator: "closed-static-policy-simulator-v1",
      outcome: "PASS",
    };
    const simulationDigest = sha256(canonicalJson(simulation));
    const nextEntry = { ...entry, simulationDigest };
    const withEntry = {
      ...current,
      entries: current.entries.map((value) =>
        value.generation === generation ? nextEntry : value),
    };
    const { record, receipt } = this._nextRecord(withEntry, nextEntry, {
      operationId,
      transition: "SIMULATED",
      fromState: "VALIDATED",
      toState: "SIMULATED",
      details: simulation,
    });
    this._persist(record);
    return { receipt, simulation, simulationDigest };
  }

  approve(generation, approval, { operationId }) {
    const current = this._load();
    const entry = entryFor(current, generation);
    if (entry.state !== "SIMULATED") deny("POLICY_LIFECYCLE_TRANSITION_INVALID_DENIED");
    this._trustAndTime(entry);
    const validatedApproval = validateApproval(
      approval,
      entry,
      this.ownerApprovalToken,
      this.now(),
    );
    const nextEntry = { ...entry, approval: validatedApproval };
    const withEntry = {
      ...current,
      entries: current.entries.map((value) =>
        value.generation === generation ? nextEntry : value),
    };
    const { record, receipt } = this._nextRecord(withEntry, nextEntry, {
      operationId,
      transition: "APPROVED",
      fromState: "SIMULATED",
      toState: "APPROVED",
      details: {
        approvalDigest: sha256(canonicalJson(validatedApproval)),
        allowWidening: validatedApproval.allowWidening,
      },
    });
    this._persist(record);
    return receipt;
  }

  stage(generation, { operationId }) {
    const current = this._load();
    const entry = entryFor(current, generation);
    if (entry.state !== "APPROVED") deny("POLICY_LIFECYCLE_TRANSITION_INVALID_DENIED");
    const verified = this._trustAndTime(entry);
    validateApproval(entry.approval, entry, this.ownerApprovalToken, this.now());
    try {
      validateAdminAiPocPolicy(verified.policy);
    } catch {
      deny("POLICY_LIFECYCLE_RUNTIME_POLICY_INCOMPATIBLE_DENIED");
    }
    const { record, receipt } = this._nextRecord(current, entry, {
      operationId,
      transition: "STAGED",
      fromState: "APPROVED",
      toState: "STAGED",
      details: { runtimePolicyValidated: true },
    });
    this._persist(record);
    return receipt;
  }

  activate(generation, { operationId }) {
    const current = this._load();
    const entry = entryFor(current, generation);
    if (entry.state !== "STAGED") deny("POLICY_LIFECYCLE_TRANSITION_INVALID_DENIED");
    const verified = this._trustAndTime(entry);
    validateApproval(entry.approval, entry, this.ownerApprovalToken, this.now());
    const candidate = createPolicyActivationCandidate({
      policyBytes: verified.bytes,
      generation,
      tenant: TENANT,
      policyId: POLICY_ID,
    });
    const authorization = createLocalOwnerPolicyAuthorization({
      candidate,
      ownerActivationToken: this.ownerActivationToken,
      issuedAtMs: this.now(),
    });
    const active = this.policyFence.activate(candidate, authorization);
    const previousActive = current.activeGeneration;
    const activatedEntries = current.entries.map((value) => {
      if (value.generation === generation) return { ...value, state: "ACTIVE" };
      if (value.generation === previousActive && value.state === "ACTIVE") {
        return { ...value, state: "SUPERSEDED" };
      }
      return value;
    });
    const nextCurrent = {
      ...current,
      entries: activatedEntries,
      activeGeneration: generation,
      lastSafeGeneration: previousActive ?? generation,
      dispatch: "ACTIVE",
    };
    const activeEntry = entryFor(nextCurrent, generation);
    const { record, receipt } = this._nextRecord(nextCurrent, activeEntry, {
      operationId,
      transition: "ACTIVATED",
      fromState: "STAGED",
      toState: "ACTIVE",
      details: {
        policySourceDigest: active.policySourceDigest,
        previousActiveGeneration: previousActive,
        lastSafeGeneration: previousActive ?? generation,
      },
    });
    try {
      this._persist({
        ...record,
        entries: record.entries.map((value) => {
          if (value.generation === previousActive && value.state === "ACTIVE") {
            return { ...value, state: "SUPERSEDED" };
          }
          return value;
        }),
        activeGeneration: generation,
        lastSafeGeneration: previousActive ?? generation,
        dispatch: "ACTIVE",
      });
    } catch {
      this.policyFence.freezeDispatch("ACTIVATION_CONVERGENCE_FAILED");
      deny("POLICY_LIFECYCLE_ACTIVATION_CONVERGENCE_FAILED_DENIED");
    }
    return { receipt, active };
  }

  retire(generation, { operationId }) {
    const current = this._load();
    const entry = entryFor(current, generation);
    if (entry.state !== "SUPERSEDED") deny("POLICY_LIFECYCLE_TRANSITION_INVALID_DENIED");
    if (current.lastSafeGeneration === generation) {
      deny("POLICY_LIFECYCLE_LAST_SAFE_RETIRE_DENIED");
    }
    const { record, receipt } = this._nextRecord(current, entry, {
      operationId,
      transition: "RETIRED",
      fromState: "SUPERSEDED",
      toState: "RETIRED",
      details: { retainedAsFallback: current.lastSafeGeneration === generation },
    });
    this._persist(record);
    return receipt;
  }

  revoke(generation, { operationId, reasonCode }) {
    const current = this._load();
    const entry = entryFor(current, generation);
    if (!["ACTIVE", "STAGED", "SUPERSEDED"].includes(entry.state)) {
      deny("POLICY_LIFECYCLE_TRANSITION_INVALID_DENIED");
    }
    if (typeof reasonCode !== "string" || !/^[A-Z][A-Z0-9_]{7,100}$/.test(reasonCode)) {
      deny("POLICY_LIFECYCLE_REVOKE_REASON_INVALID_DENIED");
    }
    const activeRevocation = current.activeGeneration === generation;
    if (activeRevocation) this.policyFence.freezeDispatch("OPERATOR_ROLLBACK");
    const fallbackGeneration = current.lastSafeGeneration === generation
      ? null
      : current.lastSafeGeneration;
    const nextCurrent = activeRevocation
      ? {
        ...current,
        dispatch: "FROZEN",
        activeGeneration: null,
        lastSafeGeneration: fallbackGeneration,
      }
      : current;
    const { record, receipt } = this._nextRecord(nextCurrent, entry, {
      operationId,
      transition: "REVOKED",
      fromState: entry.state,
      toState: "REVOKED",
      details: { reasonCode, activeRevocation },
    });
    this._persist({
      ...record,
      dispatch: activeRevocation ? "FROZEN" : record.dispatch,
      activeGeneration: activeRevocation ? null : record.activeGeneration,
      lastSafeGeneration: activeRevocation
        ? fallbackGeneration
        : record.lastSafeGeneration,
    });
    return receipt;
  }

  reportRollout(generation, workerGenerations, { operationId }) {
    const current = this._load();
    const entry = entryFor(current, generation);
    if (
      entry.state !== "ACTIVE"
      || !Array.isArray(workerGenerations)
      || workerGenerations.length === 0
      || !workerGenerations.every((value) => Number.isSafeInteger(value) && value >= 1)
    ) deny("POLICY_LIFECYCLE_ROLLOUT_REPORT_INVALID_DENIED");
    if (workerGenerations.every((value) => value === generation)) {
      const { record, receipt } = this._nextRecord(current, entry, {
        operationId,
        transition: "ROLLOUT_CONFIRMED",
        fromState: "ACTIVE",
        toState: "ACTIVE",
        details: { expectedGeneration: generation, workerGenerations },
      });
      this._persist({ ...record, lastSafeGeneration: generation });
      return { confirmed: true, receipt };
    }
    this.policyFence.freezeDispatch("WORKER_GENERATION_DIVERGENCE");
    const { record, receipt } = this._nextRecord(
      { ...current, dispatch: "FROZEN" },
      entry,
      {
        operationId,
        transition: "ROLLOUT_FROZEN",
        fromState: "ACTIVE",
        toState: "ACTIVE",
        details: { expectedGeneration: generation, workerGenerations },
      },
    );
    this._persist({ ...record, dispatch: "FROZEN" });
    return { frozen: true, receipt };
  }

  assertUseBinding(binding) {
    const current = this._load();
    if (
      current.dispatch !== "ACTIVE"
      || current.activeGeneration === null
      || binding.policyGeneration !== current.activeGeneration
      || binding.tenant !== TENANT
      || binding.policyId !== POLICY_ID
    ) deny("POLICY_LIFECYCLE_USE_GENERATION_MISMATCH_DENIED");
    return this.policyFence.assertUseBinding(binding);
  }
}
