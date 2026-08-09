import { createHash } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import {
  initialMindState,
  purgeExpiredMindEntries,
  recoverMindState,
  scopeId,
  validateMindState,
} from "./mind-store.mjs";
import { validateOpenClawM14State } from "./capability-m1-4-adapter.mjs";

export const GATEWAY_STATE_V1 = "chimpmaera.aas035/gateway-state/v1";
export const GATEWAY_STATE_V2 = "chimpmaera.aas035/gateway-state/v2";
export const GATEWAY_STATE_V3 = "chimpmaera.openclaw/gateway-state/v3";
export const MAX_GATEWAY_COUNTER = 1_000_000_000;

export function canonicalGatewayJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalGatewayJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonicalGatewayJson(value[key])}`,
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function gatewayDigest(value) {
  return createHash("sha256").update(canonicalGatewayJson(value)).digest("hex");
}

function deny(code) {
  throw new Error(code);
}

function exactObject(value, keys) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).sort().join("\n") === [...keys].sort().join("\n");
}

function validateCounters(counters, effectCount) {
  if (!exactObject(counters, ["modelCalls", "effectAttempts", "effects", "denials"])) {
    deny("GATEWAY_STATE_COUNTERS_INVALID_DENIED");
  }
  for (const value of Object.values(counters)) {
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_GATEWAY_COUNTER) {
      deny("GATEWAY_STATE_COUNTERS_INVALID_DENIED");
    }
  }
  if (counters.effects !== effectCount || counters.effectAttempts < counters.effects) {
    deny("GATEWAY_STATE_COUNTERS_INVALID_DENIED");
  }
}

function expectedEffect(context, requestId) {
  const request = { ...context.requestTemplate, requestId };
  const requestDigest = gatewayDigest(request);
  const providerResult = {
    fixture: "synthetic-contact-store",
    objectReference: `contact:${requestDigest.slice(0, 16)}`,
    ...request.payload,
  };
  const readback = structuredClone(providerResult);
  const core = {
    schemaVersion: "chimpmaera.aas035/effect-receipt/v1",
    workloadIdentity: context.runtimeContract.workload.identity,
    tenant: request.tenant,
    purpose: request.purpose,
    catalogueDigest: request.catalogueDigest,
    catalogueVersion: request.catalogueVersion,
    adapterId: request.adapterId,
    adapterVersion: request.adapterVersion,
    actionId: request.actionId,
    requestId,
    requestDigest,
    policyDigest: gatewayDigest(context.policy),
    authorityDigest: gatewayDigest(context.authority),
    effectDigest: gatewayDigest(providerResult),
    readbackDigest: gatewayDigest(readback),
    outcome: "SYNTHETIC_EFFECT_READBACK_VERIFIED",
  };
  return {
    requestDigest,
    providerResult,
    readback,
    receipt: { ...core, receiptDigest: gatewayDigest(core) },
  };
}

function validateEffects(effects, context) {
  if (effects === null || typeof effects !== "object" || Array.isArray(effects)) {
    deny("GATEWAY_STATE_EFFECTS_INVALID_DENIED");
  }
  const entries = Object.entries(effects);
  if (entries.length > context.policy.maxEffects) deny("GATEWAY_STATE_EFFECTS_INVALID_DENIED");
  for (const [requestId, record] of entries) {
    if (!/^aas035-[a-z0-9-]{8,48}$/.test(requestId)
      || canonicalGatewayJson(record) !== canonicalGatewayJson(expectedEffect(context, requestId))) {
      deny("GATEWAY_STATE_EFFECTS_INVALID_DENIED");
    }
  }
  return entries.length;
}

function validateIdentityReplay(identityReplay, workloadContract) {
  const maximum = workloadContract.identity.replayCacheMaxEntries;
  if (!Array.isArray(identityReplay) || identityReplay.length > maximum
    || identityReplay.some((value) => typeof value !== "string"
      || !/^jti-aas035-[a-z0-9-]{8,64}$/.test(value))
    || new Set(identityReplay).size !== identityReplay.length
    || identityReplay.join("\n") !== [...identityReplay].sort().join("\n")) {
    deny("GATEWAY_STATE_REPLAY_INVALID_DENIED");
  }
}

function validateLegacyMind(mind, runtimeContract) {
  if (mind === null || typeof mind !== "object" || Array.isArray(mind)) {
    deny("GATEWAY_STATE_V1_MIND_INVALID_DENIED");
  }
  const entries = Object.entries(mind);
  const quota = runtimeContract.mindStore.quota;
  if (entries.length > quota.maxEntries) deny("GATEWAY_STATE_V1_MIND_INVALID_DENIED");
  let totalBytes = 0;
  for (const [storageKey, entry] of entries) {
    if (!exactObject(entry, ["tenant", "purpose", "trust", "key", "value", "valueDigest"])
      || entry.tenant !== runtimeContract.workload.tenant
      || entry.purpose !== runtimeContract.workload.purpose
      || entry.trust !== runtimeContract.mindStore.trust
      || !/^[a-z][a-z0-9.-]{2,48}$/.test(entry.key)
      || storageKey !== `${entry.tenant}\n${entry.purpose}\n${entry.key}`
      || typeof entry.value !== "string"
      || Buffer.byteLength(entry.value) > quota.maxValueBytes
      || entry.valueDigest !== gatewayDigest(entry.value)) {
      deny("GATEWAY_STATE_V1_MIND_INVALID_DENIED");
    }
    totalBytes += Buffer.byteLength(entry.value);
  }
  if (totalBytes > quota.maxTotalBytes) deny("GATEWAY_STATE_V1_MIND_INVALID_DENIED");
  return entries.map(([, entry]) => entry);
}

export function createInitialGatewayState(context, nowMs) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) deny("GATEWAY_STATE_CLOCK_INVALID_DENIED");
  return {
    schemaVersion: GATEWAY_STATE_V3,
    effects: {},
    openclawM14Effects: {},
    openclawM14InFlight: {},
    mind: initialMindState(context.runtimeContract, { nowMs }),
    identityReplay: [],
    counters: { modelCalls: 0, effectAttempts: 0, effects: 0, denials: 0 },
  };
}

export function validateGatewayState(state, context) {
  if (!exactObject(state, [
    "schemaVersion", "effects", "openclawM14Effects", "openclawM14InFlight", "mind", "identityReplay", "counters",
  ])
    || state.schemaVersion !== GATEWAY_STATE_V3) {
    deny("GATEWAY_STATE_INVALID_DENIED");
  }
  const effectCount = validateEffects(state.effects, context);
  validateOpenClawM14State(state, context.workloadContract);
  validateCounters(state.counters, effectCount);
  validateIdentityReplay(state.identityReplay, context.workloadContract);
  validateMindState(state.mind, context.runtimeContract);
  const primary = scopeId({
    workloadIdentity: context.runtimeContract.workload.identity,
    tenant: context.runtimeContract.workload.tenant,
    purpose: context.runtimeContract.workload.purpose,
  });
  if (state.mind.scopes[primary] === undefined) deny("GATEWAY_STATE_MIND_PRIMARY_INVALID_DENIED");
  return state;
}

export function migrateGatewayStateV2(state, context) {
  if (!exactObject(state, ["schemaVersion", "effects", "mind", "identityReplay", "counters"])
    || state.schemaVersion !== GATEWAY_STATE_V2) {
    deny("GATEWAY_STATE_V2_INVALID_DENIED");
  }
  const effectCount = validateEffects(state.effects, context);
  validateCounters(state.counters, effectCount);
  validateIdentityReplay(state.identityReplay, context.workloadContract);
  validateMindState(state.mind, context.runtimeContract);
  return validateGatewayState({
    ...state,
    schemaVersion: GATEWAY_STATE_V3,
    openclawM14Effects: {},
    openclawM14InFlight: {},
  }, context);
}

export function migrateGatewayStateV1(state, context, nowMs) {
  if (!exactObject(state, ["schemaVersion", "effects", "mind", "identityReplay", "counters"])
    || state.schemaVersion !== GATEWAY_STATE_V1) {
    deny("GATEWAY_STATE_V1_INVALID_DENIED");
  }
  const effectCount = validateEffects(state.effects, context);
  validateCounters(state.counters, effectCount);
  validateIdentityReplay(state.identityReplay, context.workloadContract);
  const legacyMind = validateLegacyMind(state.mind, context.runtimeContract);
  const migrated = createInitialGatewayState(context, nowMs);
  migrated.effects = structuredClone(state.effects);
  migrated.identityReplay = [...state.identityReplay];
  migrated.counters = { ...state.counters };
  const primary = migrated.mind.scopes[scopeId({
    workloadIdentity: context.runtimeContract.workload.identity,
    tenant: context.runtimeContract.workload.tenant,
    purpose: context.runtimeContract.workload.purpose,
  })];
  for (const entry of legacyMind) {
    primary.entries[entry.key] = {
      key: entry.key,
      dataClass: "SYNTHETIC_WORKING_NOTE",
      value: entry.value,
      valueDigest: entry.valueDigest,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + context.runtimeContract.mindStore.retention.seconds * 1000,
      generation: 1,
    };
  }
  return validateGatewayState(migrated, context);
}

export function persistGatewayState(statePath, value) {
  const temporary = `${statePath}.tmp`;
  writeFileSync(temporary, `${canonicalGatewayJson(value)}\n`, { mode: 0o600 });
  renameSync(temporary, statePath);
}

export function loadGatewayState({ statePath, context, nowMs }) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) deny("GATEWAY_STATE_CLOCK_INVALID_DENIED");
  let value;
  try {
    value = JSON.parse(readFileSync(statePath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") deny("GATEWAY_STATE_PARSE_DENIED");
    value = createInitialGatewayState(context, nowMs);
    persistGatewayState(statePath, value);
    return { state: value, migration: "CREATED_V3", recovery: { status: "CLEAN", recovered: false }, expiredEntriesPurged: 0 };
  }

  let migration = "NONE";
  if (value?.schemaVersion === GATEWAY_STATE_V1) {
    value = migrateGatewayStateV1(value, context, nowMs);
    persistGatewayState(statePath, value);
    migration = "V1_TO_V3";
  } else if (value?.schemaVersion === GATEWAY_STATE_V2) {
    value = migrateGatewayStateV2(value, context);
    persistGatewayState(statePath, value);
    migration = "V2_TO_V3";
  } else {
    validateGatewayState(value, context);
  }

  const persist = () => persistGatewayState(statePath, value);
  const recovery = recoverMindState(value.mind, context.runtimeContract, persist);
  const expiredEntriesPurged = purgeExpiredMindEntries(value.mind, context.runtimeContract, nowMs);
  if (expiredEntriesPurged > 0) persist();
  validateGatewayState(value, context);
  return { state: value, migration, recovery, expiredEntriesPurged };
}
