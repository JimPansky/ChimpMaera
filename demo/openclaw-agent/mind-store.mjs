import { createHash } from "node:crypto";

export const MIND_STATE_VERSION = "chimpmaera.openclaw/mind-state/v1";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function digest(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function scopeId({ workloadIdentity, tenant, purpose }) {
  return digest({ workloadIdentity, tenant, purpose });
}

export function initialMindState(contract, { nowMs = 0 } = {}) {
  const retentionMs = contract.mindStore.retention.seconds * 1000;
  if (!Number.isSafeInteger(nowMs) || nowMs < 0
    || !Number.isSafeInteger(retentionMs) || nowMs > Number.MAX_SAFE_INTEGER - retentionMs) {
    deny("MIND_CLOCK_INVALID_DENIED");
  }
  const primary = scopeId({
    workloadIdentity: contract.workload.identity,
    tenant: contract.workload.tenant,
    purpose: contract.workload.purpose,
  });
  const foreign = scopeId(contract.mindStore.syntheticIsolationCanary.scope);
  return {
    schemaVersion: MIND_STATE_VERSION,
    scopes: {
      [primary]: { generation: 1, entries: {} },
      [foreign]: {
        generation: 7,
        entries: {
          "isolation.canary": {
            key: "isolation.canary",
            dataClass: "SYNTHETIC_WORKING_NOTE",
            value: "synthetic foreign workload canary",
            valueDigest: digest("synthetic foreign workload canary"),
            createdAtMs: nowMs,
            expiresAtMs: nowMs + retentionMs,
            generation: 7,
          },
        },
      },
    },
    reset: null,
  };
}

function deny(code) {
  throw new Error(code);
}

function exactObject(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function boundScope(contract, binding) {
  const expected = {
    workloadIdentity: contract.workload.identity,
    tenant: contract.workload.tenant,
    purpose: contract.workload.purpose,
  };
  if (binding === null || typeof binding !== "object" || Array.isArray(binding)
    || Object.entries(expected).some(([key, value]) => binding[key] !== value)) {
    deny("MIND_SCOPE_DENIED");
  }
  return scopeId(expected);
}

export function validateMindState(state, contract) {
  if (!exactObject(state, ["schemaVersion", "scopes", "reset"])
    || state.schemaVersion !== MIND_STATE_VERSION
    || state.scopes === null || typeof state.scopes !== "object" || Array.isArray(state.scopes)
    || Object.keys(state.scopes).length > contract.mindStore.quota.maxScopes
    || !(state.reset === null || (exactObject(state.reset, ["scope", "fromGeneration", "toGeneration"])
      && /^[a-f0-9]{64}$/.test(state.reset.scope)
      && Number.isSafeInteger(state.reset.fromGeneration) && state.reset.fromGeneration >= 1
      && Number.isSafeInteger(state.reset.toGeneration) && state.reset.toGeneration >= 1))) {
    deny("MIND_STATE_INVALID_DENIED");
  }
  for (const [key, scope] of Object.entries(state.scopes)) {
    if (!/^[a-f0-9]{64}$/.test(key) || !Number.isSafeInteger(scope?.generation) || scope.generation < 1
      || scope.entries === null || typeof scope.entries !== "object" || Array.isArray(scope.entries)
      || !exactObject(scope, scope.lastResetFrom === undefined
        ? ["generation", "entries"] : ["generation", "entries", "lastResetFrom"])
      || (scope.lastResetFrom !== undefined
        && (!Number.isSafeInteger(scope.lastResetFrom) || scope.lastResetFrom !== scope.generation - 1))) {
      deny("MIND_STATE_INVALID_DENIED");
    }
    if (Object.keys(scope.entries).length > contract.mindStore.quota.maxEntries) {
      deny("MIND_STATE_INVALID_DENIED");
    }
    let totalBytes = 0;
    for (const [entryKey, entry] of Object.entries(scope.entries)) {
      if (!exactObject(entry, ["key", "dataClass", "value", "valueDigest", "createdAtMs", "expiresAtMs", "generation"])
        || entry.key !== entryKey || !/^[a-z][a-z0-9.-]{2,48}$/.test(entry.key)
        || !contract.mindStore.allowedDataClasses.includes(entry.dataClass)
        || typeof entry.value !== "string" || Buffer.byteLength(entry.value) > contract.mindStore.quota.maxValueBytes
        || entry.valueDigest !== digest(entry.value)
        || !Number.isSafeInteger(entry.createdAtMs) || entry.createdAtMs < 0
        || !Number.isSafeInteger(entry.expiresAtMs) || entry.expiresAtMs <= entry.createdAtMs
        || entry.expiresAtMs - entry.createdAtMs > contract.mindStore.retention.seconds * 1000
        || entry.generation !== scope.generation) {
        deny("MIND_STATE_INVALID_DENIED");
      }
      totalBytes += Buffer.byteLength(entry.value);
    }
    if (totalBytes > contract.mindStore.quota.maxTotalBytes) deny("MIND_STATE_INVALID_DENIED");
  }
}

export function purgeExpiredMindEntries(state, contract, nowMs) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) deny("MIND_CLOCK_INVALID_DENIED");
  validateMindState(state, contract);
  let purged = 0;
  for (const scope of Object.values(state.scopes)) {
    for (const [key, entry] of Object.entries(scope.entries)) {
      if (entry.expiresAtMs <= nowMs) {
        delete scope.entries[key];
        purged += 1;
      }
    }
  }
  return purged;
}

export function recoverMindState(state, contract, persist) {
  validateMindState(state, contract);
  if (state.reset === null) return { status: "CLEAN", recovered: false };
  const { scope, fromGeneration, toGeneration } = state.reset;
  const current = state.scopes[scope];
  const bound = scopeId({ workloadIdentity: contract.workload.identity, tenant: contract.workload.tenant, purpose: contract.workload.purpose });
  if (scope !== bound
    || !Number.isSafeInteger(fromGeneration) || !Number.isSafeInteger(toGeneration)
    || toGeneration !== fromGeneration + 1 || current?.generation !== fromGeneration) {
    deny("MIND_RECOVERY_REPLAY_DENIED");
  }
  state.scopes[scope] = { generation: toGeneration, entries: {}, lastResetFrom: fromGeneration };
  state.reset = null;
  persist(state);
  return { status: "RECOVERED_RESET_COMMITTED", recovered: true, generation: toGeneration };
}

export function mindStatus(state, contract) {
  validateMindState(state, contract);
  const scope = boundScope(contract, {
    workloadIdentity: contract.workload.identity,
    tenant: contract.workload.tenant,
    purpose: contract.workload.purpose,
  });
  if (state.scopes[scope] === undefined) deny("MIND_STATE_INVALID_DENIED");
  return {
    phase: state.reset === null ? "READY" : "RESET_RECOVERY_REQUIRED",
    generation: state.scopes[scope]?.generation,
  };
}

function expire(scope, nowMs) {
  for (const [key, entry] of Object.entries(scope.entries)) {
    if (entry.expiresAtMs <= nowMs) delete scope.entries[key];
  }
}

export function writeMind(state, contract, request, { nowMs, persist }) {
  validateMindState(state, contract);
  if (state.reset !== null) deny("MIND_RESET_IN_PROGRESS_DENIED");
  if (!exactObject(request, ["workloadIdentity", "tenant", "purpose", "generation", "key", "dataClass", "value"])) {
    deny("MIND_CONTRACT_DENIED");
  }
  const scopeKey = boundScope(contract, request);
  const scope = state.scopes[scopeKey];
  if (scope === undefined || request.generation !== scope.generation) deny("MIND_STALE_GENERATION_DENIED");
  if (!/^[a-z][a-z0-9.-]{2,48}$/.test(request.key)
    || !contract.mindStore.allowedDataClasses.includes(request.dataClass)
    || typeof request.value !== "string"
    || Buffer.byteLength(request.value) > contract.mindStore.quota.maxValueBytes) {
    deny("MIND_CONTRACT_DENIED");
  }
  expire(scope, nowMs);
  const retentionMs = contract.mindStore.retention.seconds * 1000;
  if (!Number.isSafeInteger(nowMs) || nowMs < 0
    || nowMs > Number.MAX_SAFE_INTEGER - retentionMs) deny("MIND_CLOCK_INVALID_DENIED");
  const entry = {
    key: request.key,
    dataClass: request.dataClass,
    value: request.value,
    valueDigest: digest(request.value),
    createdAtMs: nowMs,
    expiresAtMs: nowMs + retentionMs,
    generation: scope.generation,
  };
  const next = { ...scope.entries, [request.key]: entry };
  if (Object.keys(next).length > contract.mindStore.quota.maxEntries) deny("MIND_ENTRY_QUOTA_DENIED");
  const total = Object.values(next).reduce((sum, item) => sum + Buffer.byteLength(item.value), 0);
  if (total > contract.mindStore.quota.maxTotalBytes) deny("MIND_TOTAL_QUOTA_DENIED");
  scope.entries = next;
  persist(state);
  return { status: "PASS", entry, generation: scope.generation };
}

export function readMind(state, contract, request, { nowMs, persist }) {
  validateMindState(state, contract);
  if (state.reset !== null) deny("MIND_RESET_IN_PROGRESS_DENIED");
  if (!exactObject(request, ["workloadIdentity", "tenant", "purpose", "generation", "key"])) deny("MIND_CONTRACT_DENIED");
  const scopeKey = boundScope(contract, request);
  const scope = state.scopes[scopeKey];
  if (scope === undefined || request.generation !== scope.generation) deny("MIND_STALE_GENERATION_DENIED");
  const entry = scope.entries[request.key];
  if (entry === undefined) deny("MIND_ENTRY_NOT_FOUND_DENIED");
  if (entry.expiresAtMs <= nowMs) {
    delete scope.entries[request.key];
    persist(state);
    deny("MIND_RETENTION_EXPIRED_DENIED");
  }
  return { status: "PASS", entry, generation: scope.generation };
}

export function resetMind(state, contract, request, { persist, interruptAfterPrepare = false }) {
  validateMindState(state, contract);
  if (state.reset !== null) deny("MIND_RESET_IN_PROGRESS_DENIED");
  if (!exactObject(request, ["workloadIdentity", "tenant", "purpose", "generation"])) deny("RESET_SCOPE_DENIED");
  const scopeKey = boundScope(contract, request);
  const scope = state.scopes[scopeKey];
  if (scope !== undefined && request.generation === scope.lastResetFrom && Object.keys(scope.entries).length === 0) {
    return { status: "PASS", reset: "ALREADY_COMMITTED", generation: scope.generation, isolationDigest: digest(Object.fromEntries(Object.entries(state.scopes).filter(([key]) => key !== scopeKey))) };
  }
  if (scope === undefined || request.generation !== scope.generation) deny("MIND_STALE_GENERATION_DENIED");
  const isolationDigestBefore = digest(Object.fromEntries(Object.entries(state.scopes).filter(([key]) => key !== scopeKey)));
  state.reset = { scope: scopeKey, fromGeneration: scope.generation, toGeneration: scope.generation + 1 };
  persist(state);
  if (interruptAfterPrepare) deny("SYNTHETIC_RESET_INTERRUPTED");
  recoverMindState(state, contract, persist);
  const isolationDigestAfter = digest(Object.fromEntries(Object.entries(state.scopes).filter(([key]) => key !== scopeKey)));
  if (isolationDigestAfter !== isolationDigestBefore) deny("MIND_RESET_ISOLATION_VIOLATION_DENIED");
  return { status: "PASS", reset: contract.mindStore.reset.behavior, generation: scope.generation + 1, isolationDigest: isolationDigestAfter };
}
