import { canonicalJson, sha256 } from "./enforcement-gate.mjs";

export const APPROVAL_SNAPSHOT_SCHEMA =
  "chimpmaera.demo/authoritative-approval-snapshot/v1";
export const BUSINESS_DIFF_SCHEMA = "chimpmaera.demo/business-diff/v2";
export const APPROVAL_REQUESTER = "requester:local-demo";
export const APPROVAL_PURPOSE = "CREATE_SYNTHETIC_SALES_ORDER";
export const MATERIAL_FIELDS = Object.freeze([
  "customerReference",
  "customerId",
  "orderDateEpoch",
]);

function fail(code) {
  throw new Error(code);
}

function exactKeys(value, expected, code) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())
  ) fail(code);
}

function assertHex(value, code) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail(code);
}

function assertAction(action, code) {
  if (
    action?.actionType !== "PROVIDER_MUTATION"
    || action.actor !== "agent:admin-ai-poc"
    || action.scope?.provider !== "dolibarr"
    || action.scope?.tenant !== "panskys-zoo-demo"
    || action.scope?.entity !== "Order"
    || action.scope?.operation !== "CREATE_IF_ABSENT"
    || action.payload?.method !== "POST"
    || action.payload?.path !== "/orders"
    || action.payload?.body?.ref_client !== "CM-ADMIN-AI-ESCALATION-001"
    || action.payload?.body?.socid !== 7
    || action.payload?.body?.date !== 1767225600
  ) fail(code);
}

function normalizeMatch(record) {
  exactKeys(record, ["date", "id", "ref_client", "socid"],
    "APPROVAL_SNAPSHOT_SOURCE_INVALID_DENIED");
  if (
    !Number.isSafeInteger(record.id)
    || record.id < 1
    || record.ref_client !== "CM-ADMIN-AI-ESCALATION-001"
    || Number(record.socid) !== 7
    || Number(record.date) !== 1767225600
  ) fail("APPROVAL_SNAPSHOT_SOURCE_INVALID_DENIED");
  return {
    id: record.id,
    customerReference: record.ref_client,
    customerId: Number(record.socid),
    orderDateEpoch: Number(record.date),
  };
}

export function createAuthoritativeApprovalSnapshot(action, records) {
  assertAction(action, "APPROVAL_SNAPSHOT_ACTION_INVALID_DENIED");
  if (!Array.isArray(records) || records.length > 2) {
    fail("APPROVAL_SNAPSHOT_SOURCE_INVALID_DENIED");
  }
  const matches = records.map(normalizeMatch).sort((left, right) => left.id - right.id);
  if (new Set(matches.map(({ id }) => id)).size !== matches.length) {
    fail("APPROVAL_SNAPSHOT_SOURCE_INVALID_DENIED");
  }
  const query = {
    field: "customerReference",
    operator: "EXACT",
    value: action.payload.body.ref_client,
    limit: 2,
  };
  const versionCore = {
    provider: action.scope.provider,
    tenant: action.scope.tenant,
    entity: action.scope.entity,
    query,
    materialFields: MATERIAL_FIELDS,
    matches,
  };
  const core = {
    schemaVersion: APPROVAL_SNAPSHOT_SCHEMA,
    provider: action.scope.provider,
    tenant: action.scope.tenant,
    entity: action.scope.entity,
    requester: APPROVAL_REQUESTER,
    purpose: APPROVAL_PURPOSE,
    query,
    complete: true,
    truncated: false,
    materialFields: [...MATERIAL_FIELDS],
    matches,
    version: sha256(canonicalJson(versionCore)),
  };
  return { ...core, snapshotDigest: sha256(canonicalJson(core)) };
}

export function validateAuthoritativeApprovalSnapshot(snapshot, action) {
  const code = "APPROVAL_SNAPSHOT_INVALID_DENIED";
  assertAction(action, code);
  exactKeys(snapshot, [
    "complete", "entity", "matches", "materialFields", "provider", "purpose",
    "query", "requester", "schemaVersion", "snapshotDigest", "tenant",
    "truncated", "version",
  ], code);
  exactKeys(snapshot.query, ["field", "limit", "operator", "value"], code);
  if (
    snapshot.schemaVersion !== APPROVAL_SNAPSHOT_SCHEMA
    || snapshot.provider !== action.scope.provider
    || snapshot.tenant !== action.scope.tenant
    || snapshot.entity !== action.scope.entity
    || snapshot.requester !== APPROVAL_REQUESTER
    || snapshot.purpose !== APPROVAL_PURPOSE
    || snapshot.complete !== true
    || snapshot.truncated !== false
    || canonicalJson(snapshot.materialFields) !== canonicalJson(MATERIAL_FIELDS)
    || snapshot.query.field !== "customerReference"
    || snapshot.query.operator !== "EXACT"
    || snapshot.query.value !== action.payload.body.ref_client
    || snapshot.query.limit !== 2
    || !Array.isArray(snapshot.matches)
    || snapshot.matches.length > 2
  ) fail(code);
  for (const match of snapshot.matches) {
    exactKeys(match, [
      "customerId", "customerReference", "id", "orderDateEpoch",
    ], code);
    if (
      !Number.isSafeInteger(match.id)
      || match.id < 1
      || match.customerReference !== action.payload.body.ref_client
      || match.customerId !== action.payload.body.socid
      || match.orderDateEpoch !== action.payload.body.date
    ) fail(code);
  }
  if (
    new Set(snapshot.matches.map(({ id }) => id)).size !== snapshot.matches.length
    || canonicalJson(snapshot.matches)
      !== canonicalJson([...snapshot.matches].sort((left, right) => left.id - right.id))
  ) fail(code);
  assertHex(snapshot.version, code);
  assertHex(snapshot.snapshotDigest, code);
  const { snapshotDigest, ...core } = snapshot;
  const { version, ...versionless } = core;
  const versionCore = {
    provider: versionless.provider,
    tenant: versionless.tenant,
    entity: versionless.entity,
    query: versionless.query,
    materialFields: versionless.materialFields,
    matches: versionless.matches,
  };
  if (
    sha256(canonicalJson(versionCore)) !== version
    || sha256(canonicalJson(core)) !== snapshotDigest
  ) fail(code);
  return snapshot;
}

export function assertApprovalSnapshotFresh(expected, current, action) {
  validateAuthoritativeApprovalSnapshot(expected, action);
  validateAuthoritativeApprovalSnapshot(current, action);
  if (
    current.version !== expected.version
    || current.snapshotDigest !== expected.snapshotDigest
  ) fail("APPROVAL_SNAPSHOT_STALE_DENIED");
}

export function deriveAuthoritativeBusinessDiff(action, snapshot, policy) {
  validateAuthoritativeApprovalSnapshot(snapshot, action);
  exactKeys(policy, ["digest", "generation", "id"],
    "APPROVAL_DIFF_POLICY_INVALID_DENIED");
  if (
    policy.id !== "admin-ai-poc-policy-v1"
    || !Number.isSafeInteger(policy.generation)
    || policy.generation < 1
  ) fail("APPROVAL_DIFF_POLICY_INVALID_DENIED");
  assertHex(policy.digest, "APPROVAL_DIFF_POLICY_INVALID_DENIED");
  return {
    schemaVersion: BUSINESS_DIFF_SCHEMA,
    summary: "Create one synthetic Dolibarr sales order if absent.",
    target: {
      provider: action.scope.provider,
      tenant: action.scope.tenant,
      entity: action.scope.entity,
    },
    requester: snapshot.requester,
    purpose: snapshot.purpose,
    priorState: {
      matchCount: snapshot.matches.length,
      complete: snapshot.complete,
      snapshotVersion: snapshot.version,
      snapshotDigest: snapshot.snapshotDigest,
    },
    materialFields: [...snapshot.materialFields],
    changes: [
      { field: "customerReference", before: snapshot.matches[0]?.customerReference ?? null,
        after: action.payload.body.ref_client },
      { field: "customerId", before: snapshot.matches[0]?.customerId ?? null,
        after: action.payload.body.socid },
      { field: "orderDateEpoch", before: snapshot.matches[0]?.orderDateEpoch ?? null,
        after: action.payload.body.date },
    ],
    impacts: {
      data: "One fictional local ERP order record.",
      budget: { currency: "EUR", upperBound: "0.00" },
      sideEffects: ["CREATE_LOCAL_ORDER_RECORD"],
    },
    rollback: {
      mode: "SEPARATE_APPROVAL_REQUIRED",
      description: "Any compensating delete or cancellation requires a new fresh-state Plan and approval.",
    },
    policy,
  };
}
