import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { validateAdminAiPocPolicy } from "./admin-ai-policy.mjs";
import { canonicalJson, sha256 } from "./enforcement-gate.mjs";

export const POLICY_ACTIVATION_CANDIDATE_SCHEMA =
  "chimpmaera.demo/policy-activation-candidate/v1";
export const POLICY_ACTIVATION_AUTHORIZATION_SCHEMA =
  "chimpmaera.demo/policy-activation-authorization/v1";
export const POLICY_ACTIVATION_RECORD_SCHEMA =
  "chimpmaera.demo/policy-activation-record/v1";

const POLICY_TENANT = "panskys-zoo-demo";
const POLICY_ID = "admin-ai-poc-policy-v1";
const OWNER_AUTHORIZATION_KIND = "OWNER_LOCAL_POLICY_HMAC_V1";
const MAX_POLICY_BYTES = 64 * 1024;
const FREEZE_REASONS = new Set([
  "ACTIVATION_CONVERGENCE_FAILED",
  "OPERATOR_ROLLBACK",
  "WORKER_GENERATION_DIVERGENCE",
]);

function assertExactKeys(value, expected, code) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())
  ) throw new Error(code);
}

function assertDigest(value, code) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(code);
  }
}

function assertGeneration(value, code) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(code);
}

function assertOwnerToken(value) {
  if (typeof value !== "string" || value.length < 32) {
    throw new Error("POLICY_ACTIVATION_OWNER_KEY_INVALID_DENIED");
  }
}

function equalSecret(presented, expected) {
  const left = Buffer.from(presented ?? "");
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function policyFromSourceBase64(value, code) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > Math.ceil(MAX_POLICY_BYTES / 3) * 4
  ) throw new Error(code);
  const bytes = Buffer.from(value, "base64");
  if (
    bytes.length === 0
    || bytes.length > MAX_POLICY_BYTES
    || bytes.toString("base64") !== value
  ) throw new Error(code);
  let policy;
  try {
    policy = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(code);
  }
  try {
    validateAdminAiPocPolicy(policy);
  } catch {
    throw new Error(code);
  }
  return { bytes, policy };
}

export function validatePolicyActivationCandidate(candidate, {
  tenant = POLICY_TENANT,
  policyId = POLICY_ID,
} = {}) {
  const code = "POLICY_ACTIVATION_CANDIDATE_INVALID_DENIED";
  assertExactKeys(candidate, [
    "generation",
    "policyId",
    "policySemanticDigest",
    "policySourceBase64",
    "policySourceDigest",
    "schemaVersion",
    "tenant",
  ], code);
  if (
    candidate.schemaVersion !== POLICY_ACTIVATION_CANDIDATE_SCHEMA
    || candidate.tenant !== tenant
    || candidate.policyId !== policyId
  ) throw new Error(code);
  assertGeneration(candidate.generation, code);
  assertDigest(candidate.policySourceDigest, code);
  assertDigest(candidate.policySemanticDigest, code);
  const { bytes, policy } = policyFromSourceBase64(
    candidate.policySourceBase64,
    code,
  );
  if (
    policy.policyId !== candidate.policyId
    || sha256(bytes) !== candidate.policySourceDigest
    || sha256(canonicalJson(policy)) !== candidate.policySemanticDigest
  ) throw new Error(code);
  return { candidate, bytes, policy };
}

export function createPolicyActivationCandidate({
  policyBytes,
  generation,
  tenant = POLICY_TENANT,
  policyId = POLICY_ID,
}) {
  assertGeneration(generation, "POLICY_ACTIVATION_CANDIDATE_INVALID_DENIED");
  const bytes = Buffer.from(policyBytes ?? "");
  if (bytes.length === 0 || bytes.length > MAX_POLICY_BYTES) {
    throw new Error("POLICY_ACTIVATION_CANDIDATE_INVALID_DENIED");
  }
  let policy;
  try {
    policy = validateAdminAiPocPolicy(JSON.parse(bytes.toString("utf8")));
  } catch {
    throw new Error("POLICY_ACTIVATION_CANDIDATE_INVALID_DENIED");
  }
  const candidate = {
    schemaVersion: POLICY_ACTIVATION_CANDIDATE_SCHEMA,
    tenant,
    policyId,
    generation,
    policySourceBase64: bytes.toString("base64"),
    policySourceDigest: sha256(bytes),
    policySemanticDigest: sha256(canonicalJson(policy)),
  };
  validatePolicyActivationCandidate(candidate, { tenant, policyId });
  return candidate;
}

function authorizationCore(candidateDigest, issuedAtMs) {
  return {
    schemaVersion: POLICY_ACTIVATION_AUTHORIZATION_SCHEMA,
    kind: OWNER_AUTHORIZATION_KIND,
    candidateDigest,
    issuedAtMs,
  };
}

export function createLocalOwnerPolicyAuthorization({
  candidate,
  ownerActivationToken,
  issuedAtMs,
}) {
  assertOwnerToken(ownerActivationToken);
  assertGeneration(candidate?.generation, "POLICY_ACTIVATION_CANDIDATE_INVALID_DENIED");
  if (!Number.isSafeInteger(issuedAtMs) || issuedAtMs < 0) {
    throw new Error("POLICY_ACTIVATION_AUTHORIZATION_INVALID_DENIED");
  }
  const candidateDigest = sha256(canonicalJson(candidate));
  const core = authorizationCore(candidateDigest, issuedAtMs);
  return {
    ...core,
    binding: createHmac("sha256", ownerActivationToken)
      .update(`policy-activation-authorization-v1\n${canonicalJson(core)}`)
      .digest("hex"),
  };
}

function validateAuthorization(authorization, candidate, ownerActivationToken) {
  const code = "POLICY_ACTIVATION_AUTHORIZATION_INVALID_DENIED";
  assertExactKeys(authorization, [
    "binding",
    "candidateDigest",
    "issuedAtMs",
    "kind",
    "schemaVersion",
  ], code);
  if (
    authorization.schemaVersion !== POLICY_ACTIVATION_AUTHORIZATION_SCHEMA
    || authorization.kind !== OWNER_AUTHORIZATION_KIND
    || !Number.isSafeInteger(authorization.issuedAtMs)
    || authorization.issuedAtMs < 0
  ) throw new Error(code);
  assertDigest(authorization.candidateDigest, code);
  assertDigest(authorization.binding, code);
  const candidateDigest = sha256(canonicalJson(candidate));
  const core = authorizationCore(candidateDigest, authorization.issuedAtMs);
  const expected = createHmac("sha256", ownerActivationToken)
    .update(`policy-activation-authorization-v1\n${canonicalJson(core)}`)
    .digest("hex");
  if (
    !equalSecret(authorization.candidateDigest, candidateDigest)
    || !equalSecret(authorization.binding, expected)
  ) throw new Error(code);
}

function validateSnapshot(snapshot, { tenant, policyId }) {
  const code = "POLICY_ACTIVATION_RECORD_INVALID_DENIED";
  assertExactKeys(snapshot, [
    "activatedAtMs",
    "authorizationDigest",
    "candidateDigest",
    "generation",
    "policyId",
    "policySemanticDigest",
    "policySourceBase64",
    "policySourceDigest",
    "tenant",
  ], code);
  if (
    snapshot.tenant !== tenant
    || snapshot.policyId !== policyId
    || !Number.isSafeInteger(snapshot.activatedAtMs)
    || snapshot.activatedAtMs < 0
  ) throw new Error(code);
  assertGeneration(snapshot.generation, code);
  for (const digest of [
    snapshot.authorizationDigest,
    snapshot.candidateDigest,
    snapshot.policySourceDigest,
    snapshot.policySemanticDigest,
  ]) assertDigest(digest, code);
  const candidate = {
    schemaVersion: POLICY_ACTIVATION_CANDIDATE_SCHEMA,
    tenant: snapshot.tenant,
    policyId: snapshot.policyId,
    generation: snapshot.generation,
    policySourceBase64: snapshot.policySourceBase64,
    policySourceDigest: snapshot.policySourceDigest,
    policySemanticDigest: snapshot.policySemanticDigest,
  };
  const validated = validatePolicyActivationCandidate(candidate, { tenant, policyId });
  if (sha256(canonicalJson(candidate)) !== snapshot.candidateDigest) {
    throw new Error(code);
  }
  return { ...validated, snapshot };
}

function recordCore(record) {
  const { recordBinding, ...core } = record;
  return core;
}

function signRecord(core, ownerActivationToken) {
  return createHmac("sha256", ownerActivationToken)
    .update(`policy-activation-record-v1\n${canonicalJson(core)}`)
    .digest("hex");
}

function validateRecord(record, { ownerActivationToken, tenant, policyId }) {
  const code = "POLICY_ACTIVATION_RECORD_INVALID_DENIED";
  assertExactKeys(record, [
    "active",
    "dispatch",
    "lastKnownSafe",
    "policyId",
    "recordBinding",
    "retiredPolicySourceDigests",
    "schemaVersion",
    "tenant",
  ], code);
  if (
    record.schemaVersion !== POLICY_ACTIVATION_RECORD_SCHEMA
    || record.tenant !== tenant
    || record.policyId !== policyId
    || !Array.isArray(record.retiredPolicySourceDigests)
    || new Set(record.retiredPolicySourceDigests).size
      !== record.retiredPolicySourceDigests.length
  ) throw new Error(code);
  assertDigest(record.recordBinding, code);
  for (const digest of record.retiredPolicySourceDigests) assertDigest(digest, code);
  const active = validateSnapshot(record.active, { tenant, policyId });
  const lastKnownSafe = validateSnapshot(record.lastKnownSafe, { tenant, policyId });
  assertExactKeys(record.dispatch, [
    "fallbackGeneration",
    "frozenAtMs",
    "reasonCode",
    "status",
  ], code);
  if (
    !["ACTIVE", "FROZEN"].includes(record.dispatch.status)
    || record.dispatch.fallbackGeneration !== lastKnownSafe.snapshot.generation
    || (record.dispatch.status === "ACTIVE"
      && (record.dispatch.frozenAtMs !== null || record.dispatch.reasonCode !== null))
    || (record.dispatch.status === "FROZEN"
      && (!Number.isSafeInteger(record.dispatch.frozenAtMs)
        || record.dispatch.frozenAtMs < 0
        || !FREEZE_REASONS.has(record.dispatch.reasonCode)))
    || lastKnownSafe.snapshot.generation > active.snapshot.generation
    || record.retiredPolicySourceDigests.includes(active.snapshot.policySourceDigest)
    || record.retiredPolicySourceDigests.includes(
      lastKnownSafe.snapshot.policySourceDigest,
    ) !== (lastKnownSafe.snapshot.generation < active.snapshot.generation)
  ) throw new Error(code);
  const expected = signRecord(recordCore(record), ownerActivationToken);
  if (!equalSecret(record.recordBinding, expected)) throw new Error(code);
  return { record, active, lastKnownSafe };
}

export class PolicyGenerationFence {
  constructor({
    activationPath,
    ownerActivationToken,
    tenant = POLICY_TENANT,
    policyId = POLICY_ID,
    now = () => Date.now(),
  }) {
    if (
      typeof activationPath !== "string"
      || activationPath.length < 1
      || typeof now !== "function"
      || tenant !== POLICY_TENANT
      || policyId !== POLICY_ID
    ) throw new Error("POLICY_GENERATION_FENCE_CONFIG_INVALID_DENIED");
    assertOwnerToken(ownerActivationToken);
    this.activationPath = activationPath;
    this.ownerActivationToken = ownerActivationToken;
    this.tenant = tenant;
    this.policyId = policyId;
    this.now = now;
    this._record = null;
    try {
      this._record = validateRecord(
        JSON.parse(readFileSync(activationPath, "utf8")),
        this,
      ).record;
    } catch (error) {
      if (error?.code !== "ENOENT") {
        if (error instanceof SyntaxError) {
          throw new Error("POLICY_ACTIVATION_RECORD_INVALID_DENIED");
        }
        throw error;
      }
    }
  }

  get record() {
    return this._record === null ? null : structuredClone(this._record);
  }

  persist(record) {
    mkdirSync(dirname(this.activationPath), { recursive: true });
    const temp = `${this.activationPath}.tmp-${process.pid}-${randomUUID()}`;
    try {
      writeFileSync(temp, `${JSON.stringify(record, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      renameSync(temp, this.activationPath);
    } catch (error) {
      try {
        unlinkSync(temp);
      } catch (cleanupError) {
        if (cleanupError?.code !== "ENOENT") throw cleanupError;
      }
      throw error;
    }
  }

  activate(candidate, authorization) {
    const validated = validatePolicyActivationCandidate(candidate, this);
    validateAuthorization(authorization, candidate, this.ownerActivationToken);
    const current = this._record;
    if (
      current !== null
      && candidate.generation <= current.active.generation
    ) throw new Error("POLICY_GENERATION_STALE_OR_DUPLICATE_DENIED");
    if (
      current !== null
      && (
        candidate.policySourceDigest === current.active.policySourceDigest
        || current.retiredPolicySourceDigests.includes(candidate.policySourceDigest)
      )
    ) throw new Error("POLICY_GENERATION_REUSE_OR_DOWNGRADE_DENIED");
    const activatedAtMs = this.now();
    if (!Number.isSafeInteger(activatedAtMs) || activatedAtMs < 0) {
      throw new Error("POLICY_ACTIVATION_CLOCK_INVALID_DENIED");
    }
    const snapshot = {
      tenant: candidate.tenant,
      policyId: candidate.policyId,
      generation: candidate.generation,
      policySourceBase64: candidate.policySourceBase64,
      policySourceDigest: candidate.policySourceDigest,
      policySemanticDigest: candidate.policySemanticDigest,
      candidateDigest: sha256(canonicalJson(candidate)),
      authorizationDigest: sha256(canonicalJson(authorization)),
      activatedAtMs,
    };
    const lastKnownSafe = current?.active ?? snapshot;
    const retiredPolicySourceDigests = current === null
      ? []
      : [...new Set([
        ...current.retiredPolicySourceDigests,
        current.active.policySourceDigest,
      ])];
    const core = {
      schemaVersion: POLICY_ACTIVATION_RECORD_SCHEMA,
      tenant: this.tenant,
      policyId: this.policyId,
      active: snapshot,
      lastKnownSafe,
      retiredPolicySourceDigests,
      dispatch: {
        status: "ACTIVE",
        reasonCode: null,
        frozenAtMs: null,
        fallbackGeneration: lastKnownSafe.generation,
      },
    };
    const record = { ...core, recordBinding: signRecord(core, this.ownerActivationToken) };
    validateRecord(record, this);
    this.persist(record);
    this._record = record;
    return this.activePolicy();
  }

  activePolicy() {
    if (this._record === null) throw new Error("POLICY_NOT_ACTIVATED_DENIED");
    const { policy } = validateSnapshot(this._record.active, this);
    return {
      policy,
      tenant: this._record.active.tenant,
      policyId: this._record.active.policyId,
      generation: this._record.active.generation,
      policySourceDigest: this._record.active.policySourceDigest,
      policySemanticDigest: this._record.active.policySemanticDigest,
      dispatchStatus: this._record.dispatch.status,
      fallbackGeneration: this._record.dispatch.fallbackGeneration,
    };
  }

  freezeDispatch(reasonCode) {
    if (this._record === null || !FREEZE_REASONS.has(reasonCode)) {
      throw new Error("POLICY_DISPATCH_FREEZE_INVALID_DENIED");
    }
    const frozenAtMs = this.now();
    if (!Number.isSafeInteger(frozenAtMs) || frozenAtMs < 0) {
      throw new Error("POLICY_ACTIVATION_CLOCK_INVALID_DENIED");
    }
    const core = {
      ...recordCore(this._record),
      dispatch: {
        status: "FROZEN",
        reasonCode,
        frozenAtMs,
        fallbackGeneration: this._record.lastKnownSafe.generation,
      },
    };
    const record = { ...core, recordBinding: signRecord(core, this.ownerActivationToken) };
    validateRecord(record, this);
    this.persist(record);
    this._record = record;
    return this.record;
  }

  assertUseBinding({ tenant, policyId, policyGeneration, policySourceDigest }) {
    let loaded;
    try {
      loaded = JSON.parse(readFileSync(this.activationPath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT" || error instanceof SyntaxError) {
        throw new Error("POLICY_ACTIVATION_RECORD_INVALID_DENIED");
      }
      throw error;
    }
    this._record = validateRecord(loaded, this).record;
    if (this._record.dispatch.status !== "ACTIVE") {
      throw new Error("POLICY_DISPATCH_FROZEN_DENIED");
    }
    const active = this._record.active;
    if (
      tenant !== active.tenant
      || policyId !== active.policyId
      || policyGeneration !== active.generation
      || !equalSecret(policySourceDigest, active.policySourceDigest)
    ) throw new Error("POLICY_USE_GENERATION_MISMATCH_DENIED");
    return true;
  }
}
