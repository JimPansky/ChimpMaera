import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import {
  createInitialGatewayState,
  gatewayDigest,
  loadGatewayState,
  persistGatewayState,
} from "../demo/openclaw-agent/gateway-state.mjs";
import {
  digest as m14Digest,
  executeOpenClawM14Capability,
  syntheticOpenClawM14Request,
  validateOpenClawM14State,
} from "../demo/openclaw-agent/capability-m1-4-adapter.mjs";
import { durableSnapshotAt, receiptForDecision } from "./helpers/openclaw-m1-4-harness.mjs";
import { canonicalOpenClawM14CorrelationId } from "../demo/openclaw-agent/plugin/identity-v2.mjs";
import {
  digest,
  MAX_ADVANCEABLE_MIND_GENERATION,
  MAX_MIND_GENERATION,
  mindStatus,
  resetMind,
  scopeId,
} from "../demo/openclaw-agent/mind-store.mjs";

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

function m14Authorization(correlationId) {
  const target = workloadContract.networkPolicy.egress.allow[0];
  return {
    schemaVersion: "chimpmaera.openclaw/gateway-authorization-result/v2",
    status: "ALLOW",
    correlationId,
    identity: {
      subject: workloadContract.identity.subject,
      audience: workloadContract.identity.audience,
      tenant: workloadContract.identity.tenant,
      scope: workloadContract.identity.scope,
      issuedAt: workloadContract.clock.now,
      expiresAt: new Date(Date.parse(workloadContract.clock.now) + 60_000).toISOString(),
    },
    network: {
      protocol: target.protocol,
      host: target.host,
      port: target.port,
      method: target.method,
      path: target.path,
    },
  };
}

function populateM14Effect(state, suffix = "disk-0001") {
  const requestId = `request:openclaw-m14-${suffix}`;
  const correlationId = canonicalOpenClawM14CorrelationId(requestId);
  const request = syntheticOpenClawM14Request({
    correlationId,
    requestId,
    workloadIdentity: workloadContract.identity.subject,
  });
  const result = executeOpenClawM14Capability(
    state, request, m14Authorization(correlationId), workloadContract, () => {},
  );
  assert.equal(result.status, "PASS");
  return request.requestId;
}

function populateM14Reservation(state, suffix = "disk-reserved-0001") {
  const requestId = `request:openclaw-m14-${suffix}`;
  const correlationId = canonicalOpenClawM14CorrelationId(requestId);
  const request = syntheticOpenClawM14Request({
    correlationId,
    requestId,
    workloadIdentity: workloadContract.identity.subject,
  });
  const durable = durableSnapshotAt(state, "RESERVED", (value) => validateOpenClawM14State(value, workloadContract), (persist) => {
    executeOpenClawM14Capability(state, request, m14Authorization(correlationId), workloadContract, persist);
  });
  Object.assign(state, durable);
  return request.requestId;
}

function redigestM14(value, field) {
  const changed = structuredClone(value);
  delete changed[field];
  changed[field] = m14Digest(changed);
  return changed;
}

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

function gatewayRequest(handler, route, body) {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.method = "POST";
  request.url = route;
  request.headers = { "x-cm-workload-identity": runtimeContract.workload.identity };
  return new Promise((resolve, reject) => {
    let status;
    const response = {
      writeHead(value) { status = value; },
      end(value) {
        try { resolve({ status, body: JSON.parse(String(value)) }); } catch (error) { reject(error); }
      },
    };
    try { handler(request, response); } catch (error) { reject(error); }
  });
}

test("realistic M1.2 file migrates atomically and preserves effects, replay, counters, and legacy mind", async () => {
  const legacy = JSON.parse(await readFile(path.join(root, "tests/fixtures/openclaw-state/gateway-state-v1.json"), "utf8"));
  const statePath = await stateFile(legacy);
  const loaded = loadGatewayState({ statePath, context, nowMs });
  assert.equal(loaded.migration, "V1_TO_V3");
  assert.equal(loaded.state.schemaVersion, "chimpmaera.openclaw/gateway-state/v3");
  assert.deepEqual(loaded.state.effects, legacy.effects);
  assert.deepEqual(loaded.state.openclawM14Effects, {});
  assert.deepEqual(loaded.state.openclawM14InFlight, {});
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

test("complete V3 envelope malformed shapes and unsafe bounds never load", async () => {
  const cases = [
    (s) => { s.effects = []; }, (s) => { s.effects = null; },
    (s) => { s.effects = { "aas035-openclaw-bad00001": {} }; },
    (s) => { s.openclawM14Effects = []; },
    (s) => { s.openclawM14InFlight = []; },
    (s) => { s.openclawM14InFlight = { "request:openclaw-m14-bad": "not-a-digest" }; },
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

test("tampered M1.4 V3 records fail closed from disk on restart", async () => {
  const valid = createInitialGatewayState(context, nowMs);
  const firstId = populateM14Effect(valid, "disk-tamper-0001");
  const secondId = populateM14Effect(valid, "disk-tamper-0002");
  const reservedId = populateM14Reservation(valid, "disk-tamper-reserved");
  let statePath = await stateFile(valid);
  assert.equal(Object.keys(loadGatewayState({ statePath, context, nowMs }).state.openclawM14Effects).length, 2);

  const mutations = [
    (state) => { state.openclawM14Effects[firstId].schemaVersion = "tampered"; },
    (state) => { state.openclawM14Effects[firstId].workloadIdentity = "workload:synthetic-agent"; },
    (state) => { state.openclawM14Effects[firstId].tenant = "tenant:other"; },
    (state) => { state.openclawM14Effects[firstId].policyGeneration = "0.9.0"; },
    (state) => { state.openclawM14Effects[firstId].requestDigest = "0".repeat(64); },
    (state) => { state.openclawM14Effects[firstId].correlationDigest = "0".repeat(64); },
    (state) => { state.openclawM14Effects[firstId].decision.decisionDigest = "0".repeat(64); },
    (state) => { state.openclawM14Effects[firstId].decision.ticket.request = { email: "replacement@example.test", name: "Replacement" }; },
    (state) => { state.openclawM14Effects[firstId].decision.ticket.request.extra = "forbidden"; },
    (state) => { state.openclawM14Effects[firstId].decision.extra = "forbidden"; },
    (state) => { state.openclawM14Effects[firstId].decision.correlationDigest = "0".repeat(64); },
    (state) => { state.openclawM14Effects[firstId].decision.ticket.correlationDigest = "0".repeat(64); },
    (state) => { state.openclawM14Effects[firstId].decision.ticket.actionDigest = "0".repeat(64); },
    (state) => { state.openclawM14Effects[firstId].decision.ticket.catalogueDigest = "0".repeat(64); },
    (state) => { state.openclawM14Effects[firstId].decision.ticket.activationDigest = "0".repeat(64); },
    (state) => { state.openclawM14Effects[firstId].decision.ticket.policyId = "policy:other"; },
    (state) => { state.openclawM14Effects[firstId].decision.ticket.policyDigest = "0".repeat(64); },
    (state) => { state.openclawM14Effects[firstId].decision.ticket.policyVersion = "0.9.0"; },
    (state) => { state.openclawM14Effects[firstId].readback.contactId = "synthetic-contact-999"; },
    (state) => { state.openclawM14Effects[firstId].receipt.response.contactId = "synthetic-contact-999"; },
    (state) => { state.openclawM14Effects[firstId].receipt.privatePath = "/private/provider/path"; },
    (state) => { state.openclawM14Effects[secondId].effectOrdinal = state.openclawM14Effects[firstId].effectOrdinal; },
    (state) => { state.openclawM14InFlight[reservedId].decision.decisionDigest = "0".repeat(64); },
    (state) => { state.openclawM14InFlight[reservedId].decision.ticket.request = { email: "replacement@example.test", name: "Replacement" }; },
    (state) => { state.openclawM14InFlight[reservedId].requestDigest = "0".repeat(64); },
    (state) => { state.openclawM14InFlight[reservedId].correlationDigest = "0".repeat(64); },
    (state) => { state.openclawM14InFlight[reservedId].decision.ticket.correlationDigest = "0".repeat(64); },
    (state) => { state.openclawM14InFlight[reservedId].decision.ticket.extra = "forbidden"; },
    (state) => { state.openclawM14InFlight[reservedId].decision.ticket.catalogueDigest = "0".repeat(64); },
    (state) => { state.openclawM14InFlight[reservedId].decision.ticket.actionDigest = "0".repeat(64); },
    (state) => { state.openclawM14InFlight[reservedId].decision.ticket.activationDigest = "0".repeat(64); },
    (state) => { state.openclawM14InFlight[reservedId].decision.ticket.policyId = "policy:other"; },
    (state) => { state.openclawM14InFlight[reservedId].decision.ticket.policyDigest = "0".repeat(64); },
    (state) => {
      const record = state.openclawM14Effects[firstId];
      record.readback = { contactId: "synthetic-contact-999" };
      record.readbackDigest = m14Digest(record.readback);
      record.receipt = receiptForDecision(record.decision, record.readback);
    },
    (state) => {
      const record = state.openclawM14Effects[firstId];
      record.authorizationBinding.audience = "chimpmaera://forged";
      record.authorizationBinding = redigestM14(record.authorizationBinding, "bindingDigest");
    },
    (state) => {
      const record = state.openclawM14InFlight[reservedId];
      record.authorizationBinding.scope = ["capability:erp.order.create"];
      record.authorizationBinding = redigestM14(record.authorizationBinding, "bindingDigest");
    },
    (state) => {
      const record = state.openclawM14Effects[firstId];
      const canonical = canonicalOpenClawM14CorrelationId(firstId);
      const correlationId = canonical.replace(/[a-f0-9]{12}$/, canonical.endsWith("000000000000")
        ? "111111111111" : "000000000000");
      const correlationDigest = m14Digest(correlationId);
      record.correlationDigest = correlationDigest;
      record.authorizationBinding.correlationId = correlationId;
      record.authorizationBinding.correlationDigest = correlationDigest;
      record.authorizationBinding = redigestM14(record.authorizationBinding, "bindingDigest");
      record.decision.correlationDigest = correlationDigest;
      record.decision.ticket.correlationDigest = correlationDigest;
      record.decision = redigestM14(record.decision, "decisionDigest");
      record.receipt = receiptForDecision(record.decision, record.readback);
    },
    (state) => {
      const record = state.openclawM14Effects[firstId];
      record.authorizationBinding.issuedAt = "2026-08-09T11:59:59.000Z";
      record.authorizationBinding.expiresAt = "2026-08-09T12:00:59.000Z";
      record.authorizationBinding = redigestM14(record.authorizationBinding, "bindingDigest");
    },
    (state) => {
      const record = state.openclawM14InFlight[reservedId];
      const canonical = canonicalOpenClawM14CorrelationId(reservedId);
      const correlationId = canonical.replace(/[a-f0-9]{12}$/, canonical.endsWith("000000000000")
        ? "111111111111" : "000000000000");
      const correlationDigest = m14Digest(correlationId);
      record.correlationDigest = correlationDigest;
      record.authorizationBinding.correlationId = correlationId;
      record.authorizationBinding.correlationDigest = correlationDigest;
      record.authorizationBinding = redigestM14(record.authorizationBinding, "bindingDigest");
      record.decision.correlationDigest = correlationDigest;
      record.decision.ticket.correlationDigest = correlationDigest;
      record.decision = redigestM14(record.decision, "decisionDigest");
    },
    (state) => {
      const record = state.openclawM14InFlight[reservedId];
      record.authorizationBinding.issuedAt = "2026-08-09T11:59:59.000Z";
      record.authorizationBinding.expiresAt = "2026-08-09T12:00:59.000Z";
      record.authorizationBinding = redigestM14(record.authorizationBinding, "bindingDigest");
    },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(valid);
    mutate(invalid);
    statePath = await stateFile(invalid);
    const before = await readFile(statePath, "utf8");
    assert.throws(() => loadGatewayState({ statePath, context, nowMs }), /OPENCLAW_M14_STATE_INVALID_DENIED/);
    assert.equal(await readFile(statePath, "utf8"), before);
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

test("gateway reload accepts the exact advanceable generation and boundary denial remains durable", async () => {
  const state = createInitialGatewayState(context, nowMs);
  state.mind.scopes[primary].generation = MAX_ADVANCEABLE_MIND_GENERATION;
  const statePath = await stateFile(state);
  const loaded = loadGatewayState({ statePath, context, nowMs });
  assert.equal(mindStatus(loaded.state.mind, runtimeContract).generation, MAX_ADVANCEABLE_MIND_GENERATION);
  resetMind(loaded.state.mind, runtimeContract, {
    workloadIdentity: runtimeContract.workload.identity, tenant: runtimeContract.workload.tenant,
    purpose: runtimeContract.workload.purpose, generation: MAX_ADVANCEABLE_MIND_GENERATION,
  }, { persist: () => persistGatewayState(statePath, loaded.state) });
  const boundary = loadGatewayState({ statePath, context, nowMs });
  assert.equal(mindStatus(boundary.state.mind, runtimeContract).generation, MAX_MIND_GENERATION);

  const memoryBefore = structuredClone(boundary.state);
  const diskBefore = await readFile(statePath, "utf8");
  let persistenceCalls = 0;
  assert.throws(() => resetMind(boundary.state.mind, runtimeContract, {
    workloadIdentity: runtimeContract.workload.identity, tenant: runtimeContract.workload.tenant,
    purpose: runtimeContract.workload.purpose, generation: MAX_MIND_GENERATION,
  }, { persist: () => { persistenceCalls += 1; persistGatewayState(statePath, boundary.state); } }),
  /MIND_GENERATION_EXHAUSTED_DENIED/);
  assert.equal(persistenceCalls, 0);
  assert.deepEqual(boundary.state, memoryBefore);
  assert.equal(await readFile(statePath, "utf8"), diskBefore);
  assert.equal(loadGatewayState({ statePath, context, nowMs }).state.mind.scopes[primary].generation, MAX_MIND_GENERATION);

  const previousStatePath = process.env.CM_AAS035_STATE_PATH;
  process.env.CM_AAS035_STATE_PATH = statePath;
  try {
    const gatewayUrl = new URL("../demo/openclaw-agent/gateway.mjs", import.meta.url);
    gatewayUrl.searchParams.set("generation-boundary", String(nowMs));
    const { gatewayHandler } = await import(gatewayUrl);
    const denial = await gatewayRequest(gatewayHandler, "/v1/reset", {
      workloadIdentity: runtimeContract.workload.identity, tenant: runtimeContract.workload.tenant,
      purpose: runtimeContract.workload.purpose, generation: MAX_MIND_GENERATION,
    });
    assert.equal(denial.status, 403);
    assert.equal(denial.body.error, "MIND_GENERATION_EXHAUSTED_DENIED");
    const deniedReload = loadGatewayState({ statePath, context, nowMs });
    assert.equal(deniedReload.state.mind.scopes[primary].generation, MAX_MIND_GENERATION);
    assert.equal(deniedReload.state.counters.denials, 1);
  } finally {
    if (previousStatePath === undefined) delete process.env.CM_AAS035_STATE_PATH;
    else process.env.CM_AAS035_STATE_PATH = previousStatePath;
  }

  const invalid = structuredClone(boundary.state);
  invalid.mind.scopes[primary].generation = Number.MAX_SAFE_INTEGER;
  const invalidPath = await stateFile(invalid);
  assert.throws(() => loadGatewayState({ statePath: invalidPath, context, nowMs }), /MIND_STATE_INVALID_DENIED/);
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
