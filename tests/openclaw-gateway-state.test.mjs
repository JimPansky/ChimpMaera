import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createInitialGatewayState,
  gatewayDigest,
  loadGatewayState,
  persistGatewayState,
} from "../demo/openclaw-agent/gateway-state.mjs";
import { digest, resetMind, scopeId } from "../demo/openclaw-agent/mind-store.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const runtimeContract = JSON.parse(await readFile(path.join(root, "demo/openclaw-agent/runtime-contract-v1.json"), "utf8"));
const workloadContract = JSON.parse(await readFile(path.join(root, "demo/openclaw-agent/gateway-workload-contract-v2.json"), "utf8"));
const requestTemplate = {
  schemaVersion: "chimpmaera.aas035/typed-capability-request/v1", tenant: runtimeContract.workload.tenant,
  purpose: runtimeContract.workload.purpose, catalogueDigest: runtimeContract.workload.catalogueDigest,
  catalogueVersion: runtimeContract.workload.catalogueVersion, adapterId: runtimeContract.workload.adapterId,
  adapterVersion: runtimeContract.workload.adapterVersion, actionId: runtimeContract.workload.actionId,
  resource: "espocrm.contact", effect: "CREATE", requestId: "aas035-openclaw-e2e-0001",
  payload: { email: "agent.fixture@synthetic.invalid", name: "AAS-035 Synthetic Agent" },
};
const policy = { policyId: "aas035-synthetic-policy-v1", generation: 1, workloadIdentity: runtimeContract.workload.identity,
  tenant: runtimeContract.workload.tenant, purpose: runtimeContract.workload.purpose,
  catalogueDigest: runtimeContract.workload.catalogueDigest, actionId: runtimeContract.workload.actionId, maxEffects: 32 };
const authority = { authorityId: "aas035-synthetic-authority-v1", policyDigest: gatewayDigest(policy),
  workloadIdentity: runtimeContract.workload.identity, tenant: runtimeContract.workload.tenant,
  purpose: runtimeContract.workload.purpose, actionId: runtimeContract.workload.actionId };
const context = { runtimeContract, workloadContract, requestTemplate, policy, authority };
const nowMs = 1_900_000_000_000;
const primary = scopeId({ workloadIdentity: runtimeContract.workload.identity, tenant: runtimeContract.workload.tenant, purpose: runtimeContract.workload.purpose });

async function stateFile(value) {
  const directory = await mkdtemp(path.join(tmpdir(), "cm-gateway-state-"));
  const statePath = path.join(directory, "state.json");
  await writeFile(statePath, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  return statePath;
}

function entry(key, value, durationMs = runtimeContract.mindStore.retention.seconds * 1000) {
  return { key, dataClass: "SYNTHETIC_WORKING_NOTE", value, valueDigest: digest(value),
    createdAtMs: nowMs, expiresAtMs: nowMs + durationMs, generation: 1 };
}

test("realistic M1.2 file migrates atomically and preserves effects, replay, counters, and legacy mind", async () => {
  const legacy = JSON.parse(await readFile(path.join(root, "tests/fixtures/openclaw-state/gateway-state-v1.json"), "utf8"));
  const statePath = await stateFile(legacy);
  const loaded = loadGatewayState({ statePath, context, nowMs });
  assert.equal(loaded.migration, "V1_TO_V2");
  assert.equal(loaded.state.schemaVersion, "chimpmaera.aas035/gateway-state/v2");
  assert.deepEqual(loaded.state.effects, legacy.effects);
  assert.deepEqual(loaded.state.identityReplay, legacy.identityReplay);
  assert.deepEqual(loaded.state.counters, legacy.counters);
  assert.equal(loaded.state.mind.scopes[primary].entries["working.note"].value, "synthetic legacy note");
  const reloaded = loadGatewayState({ statePath, context, nowMs });
  assert.equal(reloaded.migration, "NONE");
  assert.deepEqual(reloaded.state, loaded.state);
});

test("invalid M1.2 migration fails closed without changing the source file", async () => {
  const source = JSON.parse(await readFile(path.join(root, "tests/fixtures/openclaw-state/gateway-state-v1.json"), "utf8"));
  for (const mutate of [
    (legacy) => { legacy.effects[requestTemplate.requestId].receipt.receiptDigest = "0".repeat(64); },
    (legacy) => { legacy.mind = null; },
    (legacy) => { legacy.counters.effectAttempts = -1; },
    (legacy) => { legacy.identityReplay = ["malformed-replay-id"]; },
  ]) {
    const legacy = structuredClone(source); mutate(legacy);
    const statePath = await stateFile(legacy);
    const before = await readFile(statePath, "utf8");
    assert.throws(() => loadGatewayState({ statePath, context, nowMs }), /DENIED/);
    assert.equal(await readFile(statePath, "utf8"), before);
  }
});

test("persisted mind quota and retention exact boundaries pass; one beyond fails closed", async () => {
  const valid = createInitialGatewayState(context, nowMs);
  valid.mind.scopes[primary].entries = Object.fromEntries(Array.from({ length: 16 }, (_, index) => {
    const key = `entry.${String(index).padStart(2, "0")}`;
    return [key, entry(key, "x".repeat(1024))];
  }));
  let statePath = await stateFile(valid);
  assert.equal(loadGatewayState({ statePath, context, nowMs }).state.mind.scopes[primary].entries["entry.00"].value.length, 1024);

  for (const mutate of [
    (state) => { state.mind.scopes[primary].entries["entry.16"] = entry("entry.16", ""); },
    (state) => { state.mind.scopes[primary].entries["entry.00"] = entry("entry.00", "x".repeat(1025)); },
    (state) => { state.mind.scopes[primary].entries = { "entry.value": entry("entry.value", "x".repeat(2049)) }; },
    (state) => { state.mind.scopes[primary].entries = { "entry.retention": entry("entry.retention", "x", runtimeContract.mindStore.retention.seconds * 1000 + 1) }; },
  ]) {
    const invalid = structuredClone(valid); mutate(invalid); statePath = await stateFile(invalid);
    assert.throws(() => loadGatewayState({ statePath, context, nowMs }), /MIND_STATE_INVALID_DENIED/);
  }
  const exact = createInitialGatewayState(context, nowMs);
  exact.mind.scopes[primary].entries = { "entry.value": entry("entry.value", "x".repeat(2048)),
    "entry.retention": entry("entry.retention", "x", runtimeContract.mindStore.retention.seconds * 1000) };
  statePath = await stateFile(exact);
  assert.equal(loadGatewayState({ statePath, context, nowMs }).state.mind.scopes[primary].entries["entry.value"].value.length, 2048);
});

test("complete V2 envelope malformed shapes and unsafe bounds never load", async () => {
  const cases = [
    (s) => { s.effects = []; }, (s) => { s.effects = null; },
    (s) => { s.effects = { "aas035-openclaw-bad00001": {} }; },
    (s) => { s.counters = []; }, (s) => { s.counters.effects = -1; },
    (s) => { s.counters.denials = 1_000_000_001; },
    (s) => { s.identityReplay = null; }, (s) => { s.identityReplay = ["bad"]; },
    (s) => { s.identityReplay = ["jti-aas035-duplicate", "jti-aas035-duplicate"]; },
    (s) => { s.identityReplay = ["jti-aas035-z-sort000", "jti-aas035-a-sort000"]; },
    (s) => { s.identityReplay = Array.from({ length: 65 }, (_, i) => `jti-aas035-cache-${String(i).padStart(4, "0")}`); },
    (s) => { s.mind = []; }, (s) => { s.mind.reset = {}; },
    (s) => { s.mind.scopes[primary].entries = { "entry.tampered": { ...entry("entry.tampered", "x"), valueDigest: "0".repeat(64) } }; },
    (s) => { s.mind.scopes[primary].entries = { "entry.stale": { ...entry("entry.stale", "x"), generation: 2 } }; },
    (s) => { delete s.mind.scopes[primary]; },
    (s) => { s.mind.scopes = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [String(i).padStart(64, "0"), { generation: 1, entries: {} }])); },
  ];
  for (const mutate of cases) {
    const invalid = createInitialGatewayState(context, nowMs); mutate(invalid);
    const statePath = await stateFile(invalid);
    assert.throws(() => loadGatewayState({ statePath, context, nowMs }), /DENIED/);
  }
});

test("expired persisted entries are purged before readiness and remain absent after reload", async () => {
  const state = createInitialGatewayState(context, nowMs - 1);
  state.mind.scopes[primary].entries = {
    "entry.expired": {
      ...entry("entry.expired", "expired"),
      createdAtMs: nowMs - 1000,
      expiresAtMs: nowMs,
    },
  };
  const statePath = await stateFile(state);
  const loaded = loadGatewayState({ statePath, context, nowMs });
  assert.equal(loaded.expiredEntriesPurged, 1);
  assert.equal(loaded.state.mind.scopes[primary].entries["entry.expired"], undefined);
  assert.equal(loadGatewayState({ statePath, context, nowMs }).state.mind.scopes[primary].entries["entry.expired"], undefined);
});

test("disk recovery commits interrupted reset while preserving replay and effect receipt across reload", async () => {
  const legacy = JSON.parse(await readFile(path.join(root, "tests/fixtures/openclaw-state/gateway-state-v1.json"), "utf8"));
  const statePath = await stateFile(legacy);
  const migrated = loadGatewayState({ statePath, context, nowMs }).state;
  const receipt = migrated.effects[requestTemplate.requestId].receipt.receiptDigest;
  assert.throws(() => resetMind(migrated.mind, runtimeContract, {
    workloadIdentity: runtimeContract.workload.identity, tenant: runtimeContract.workload.tenant,
    purpose: runtimeContract.workload.purpose, generation: 1,
  }, { persist: () => persistGatewayState(statePath, migrated), interruptAfterPrepare: true }), /SYNTHETIC_RESET_INTERRUPTED/);
  const recovered = loadGatewayState({ statePath, context, nowMs });
  assert.equal(recovered.recovery.status, "RECOVERED_RESET_COMMITTED");
  assert.equal(recovered.state.effects[requestTemplate.requestId].receipt.receiptDigest, receipt);
  assert.deepEqual(recovered.state.identityReplay, legacy.identityReplay);
  const reloaded = loadGatewayState({ statePath, context, nowMs });
  assert.equal(reloaded.recovery.status, "CLEAN");
  assert.equal(reloaded.state.effects[requestTemplate.requestId].receipt.receiptDigest, receipt);
  assert.deepEqual(reloaded.state.identityReplay, legacy.identityReplay);
});
