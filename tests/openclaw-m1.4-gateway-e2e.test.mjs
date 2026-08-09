import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  authorizeGatewayRequest,
  canonicalOpenClawM14CorrelationId,
  createInvocationIdentity,
  createSyntheticIdentity,
  encodeSyntheticIdentity,
} from "../demo/openclaw-agent/plugin/identity-v2.mjs";
import {
  digest,
  executeOpenClawM14Capability,
  syntheticOpenClawM14Request,
  validateOpenClawM14State,
} from "../demo/openclaw-agent/capability-m1-4-adapter.mjs";
import {
  admitWithCanonicalFixtures,
  brokerWithSyntheticResponse,
  canonicalActivation,
  canonicalCatalogue,
  canonicalPolicy,
  durableSnapshotAt,
  receiptForDecision,
  redigest,
} from "./helpers/openclaw-m1-4-harness.mjs";
import { validateOpenClawM14GatewayResponse } from "../demo/openclaw-agent/plugin/response-v1.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const fixture = path.join(root, "demo/openclaw-agent");
const workloadContract = JSON.parse(await readFile(path.join(fixture, "gateway-workload-contract-v2.json"), "utf8"));
const route = workloadContract.identity.route;
const requestSchema = "chimpmaera.security/capability-execution-request/v1";
const digestPattern = /^[a-f0-9]{64}$/;
const envelopeKeys = ["responseDigest", "result", "schemaVersion", "status"];
const resultKeys = [
  "actionDigest", "actionId", "catalogueDigest", "catalogueVersion", "correlationDigest",
  "decisionDigest", "effectCount", "effectState", "evidenceRef", "outcome", "policyDigest",
  "policyGeneration", "providerResponseDigest", "readbackDigest", "receiptDigest", "replayState",
  "requestDigest", "requestIdDigest", "schemaVersion", "tenantDigest", "workloadIdentityDigest",
];
const evidenceRefKeys = ["decisionDigest", "readbackDigest", "receiptDigest", "sinkDigest", "type"];

function gatewayExchange(handler, request) {
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

function gatewayRequest(handler, targetRoute, { method = "POST", headers = {}, body } = {}) {
  const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  request.method = method;
  request.url = targetRoute;
  request.headers = headers;
  return gatewayExchange(handler, request);
}

async function freshGateway(label, statePath) {
  const temporary = await mkdtemp(path.join(tmpdir(), `cm-openclaw-m14-${label}-`));
  process.env.CM_AAS035_STATE_PATH = statePath ?? path.join(temporary, "state.json");
  const gatewayUrl = `${pathToFileURL(path.join(fixture, "gateway.mjs")).href}?m14=${label}-${Date.now()}`;
  const { gatewayHandler } = await import(gatewayUrl);
  return { gatewayHandler, temporary };
}

async function cleanup(temporary) {
  delete process.env.CM_AAS035_STATE_PATH;
  await rm(temporary, { recursive: true, force: true });
}

function invocationFor(requestId, invocationId) {
  return createInvocationIdentity(workloadContract, { requestId, invocationId });
}

function headersFor(invocation, schema = requestSchema) {
  const headers = {
    authorization: `Synthetic ${encodeSyntheticIdentity(invocation.identity)}`,
    host: "capability-gateway:8080",
    "content-type": "application/json",
    "x-cm-correlation-id": invocation.correlationId,
  };
  if (schema !== null) headers["x-cm-request-schema"] = schema;
  return headers;
}

function authorizationFor(invocation) {
  return authorizeGatewayRequest(workloadContract, {
    protocol: "http:", dnsTarget: "capability-gateway", host: "capability-gateway", port: 8080,
    method: "POST", path: route,
    authorization: `Synthetic ${encodeSyntheticIdentity(invocation.identity)}`,
    correlationId: invocation.correlationId,
  });
}

function requestFor(invocation, requestId = "request:openclaw-m14-0001") {
  return syntheticOpenClawM14Request({
    correlationId: invocation.correlationId,
    requestId,
    workloadIdentity: workloadContract.identity.subject,
  });
}

async function invoke(handler, requestId, invocationId, mutate = (value) => value) {
  const invocation = invocationFor(requestId, invocationId);
  return gatewayRequest(handler, route, {
    headers: headersFor(invocation),
    body: mutate(requestFor(invocation, requestId)),
  });
}

function assertNoMarkers(value, markers, { credentialScan = true } = {}) {
  const text = JSON.stringify(value);
  for (const marker of markers) assert.equal(text.includes(marker), false, `marker leaked: ${marker}`);
  if (credentialScan) assert.doesNotMatch(text, /(?:password|secret|token|authorization|credential)/i);
}

function assertSanitized(value, invocation, requestId) {
  assertNoMarkers(value, [
    invocation.correlationId,
    requestId,
    "alex@example.test",
    "Alex Example",
    workloadContract.identity.subject,
    invocation.identity.claims.jti,
    encodeSyntheticIdentity(invocation.identity),
    ["", "private", "provider", "path"].join("/"),
  ]);
}

function assertPublicProjection(response, invocation, requestId) {
  assert.deepEqual(Object.keys(response).sort(), envelopeKeys);
  assert.deepEqual(Object.keys(response.result).sort(), resultKeys);
  assert.deepEqual(Object.keys(response.result.evidenceRef).sort(), evidenceRefKeys);
  assert.equal(response.schemaVersion, "chimpmaera.openclaw-m1.4/gateway-broker-response/v1");
  assert.equal(response.status, "PASS");
  assert.equal(response.result.schemaVersion, "chimpmaera.openclaw-m1.4/sanitized-result/v2");
  assert.equal(response.result.outcome, "SYNTHETIC_EFFECT_READBACK_VERIFIED");
  assert.equal(response.result.effectState, "CONFIRMED_ONE");
  assert.equal(response.result.effectCount, 1);
  assert.equal(response.result.actionId, "crm.contact.create");
  assert.equal(response.result.requestIdDigest, digest(requestId));
  for (const [key, value] of Object.entries(response.result)) {
    if (key.endsWith("Digest")) assert.match(value, digestPattern, key);
  }
  for (const key of ["decisionDigest", "readbackDigest", "receiptDigest", "sinkDigest"]) {
    assert.match(response.result.evidenceRef[key], digestPattern, `evidenceRef.${key}`);
  }
  assert.equal(response.result.evidenceRef.receiptDigest, response.result.receiptDigest);
  assert.equal(response.result.evidenceRef.readbackDigest, response.result.readbackDigest);
  assertSanitized(response, invocation, requestId);
}

function redigestDecision(decision) {
  const changed = structuredClone(decision);
  delete changed.decisionDigest;
  changed.decisionDigest = digest(changed);
  return changed;
}

function redigestAuthorizationBinding(binding) {
  const changed = structuredClone(binding);
  delete changed.bindingDigest;
  changed.bindingDigest = digest(changed);
  return changed;
}

function redigestResponseEnvelope(response) {
  const changed = structuredClone(response);
  delete changed.responseDigest;
  changed.responseDigest = digest(changed);
  return changed;
}

function alternateValidCorrelation(requestId) {
  const canonical = canonicalOpenClawM14CorrelationId(requestId);
  const suffix = canonical.endsWith("000000000000") ? "111111111111" : "000000000000";
  return canonical.replace(/[a-f0-9]{12}$/, suffix);
}

function emptyM14State() {
  return { openclawM14Effects: {}, openclawM14InFlight: {} };
}

function directInvocation(requestId, invocationId) {
  const invocation = invocationFor(requestId, invocationId);
  return { invocation, request: requestFor(invocation, requestId), authorization: authorizationFor(invocation) };
}

function validateM14State(state) {
  return validateOpenClawM14State(state, workloadContract);
}

function executeDirect(state, input, persist = () => validateM14State(state)) {
  return executeOpenClawM14Capability(state, input.request, input.authorization, workloadContract, persist);
}

test("OPENCLAW-M1.4 canonical CRM request returns one closed sanitized projection and fixture readback", async () => {
  const { gatewayHandler, temporary } = await freshGateway("positive");
  try {
    const requestId = "request:openclaw-m14-positive-0001";
    const invocation = invocationFor(requestId, "m14-positive-invocation-0001");
    const response = await gatewayRequest(gatewayHandler, route, {
      headers: headersFor(invocation), body: requestFor(invocation, requestId),
    });
    assert.equal(response.status, 200);
    assertPublicProjection(response.body, invocation, requestId);
    assert.equal(response.body.result.replayState, "FIRST_EXECUTION");

    const evidence = await gatewayRequest(gatewayHandler, "/v1/evidence", {
      method: "GET", headers: { "x-cm-workload-identity": workloadContract.identity.subject },
    });
    assert.equal(evidence.status, 200);
    assert.equal(evidence.body.openClawM14EffectCount, 1);
    assert.deepEqual(evidence.body.openClawM14ReceiptDigests, [response.body.result.receiptDigest]);
    assertNoMarkers(evidence.body, [
      invocation.correlationId, requestId, invocation.identity.claims.jti,
      "alex@example.test", "Alex Example", "/private/provider/path",
    ], { credentialScan: false });
  } finally { await cleanup(temporary); }
});

test("OPENCLAW-M1.4 plugin consumer rejects exact-key malicious responses after envelope redigest", () => {
  const state = emptyM14State();
  const input = directInvocation("request:openclaw-m14-plugin-0001", "m14-plugin-consumer-0001");
  const valid = executeDirect(state, input);
  const context = {
    correlationId: input.invocation.correlationId,
    requestId: input.request.requestId,
    workloadContract,
  };
  assert.equal(validateOpenClawM14GatewayResponse(valid, context), valid);

  const probes = [
    ["envelope version", (value) => { value.schemaVersion = "chimpmaera.openclaw-m1.4/gateway-broker-response/v0"; }],
    ["result version", (value) => { value.result.schemaVersion = "chimpmaera.openclaw-m1.4/sanitized-result/v1"; }],
    ["replay state", (value) => { value.result.replayState = "FORGED_REPLAY"; }],
    ["action", (value) => { value.result.actionId = "erp.order.create"; }],
    ["catalogue version", (value) => { value.result.catalogueVersion = "9.9.9"; }],
    ["catalogue digest", (value) => { value.result.catalogueDigest = "a".repeat(64); }],
    ["action digest", (value) => { value.result.actionDigest = "b".repeat(64); }],
    ["policy generation", (value) => { value.result.policyGeneration = "9.9.9"; }],
    ["policy digest", (value) => { value.result.policyDigest = "c".repeat(64); }],
    ["workload digest", (value) => { value.result.workloadIdentityDigest = "d".repeat(64); }],
    ["tenant digest", (value) => { value.result.tenantDigest = "e".repeat(64); }],
    ["request id digest", (value) => { value.result.requestIdDigest = "f".repeat(64); }],
    ["request digest", (value) => { value.result.requestDigest = "0".repeat(64); }],
    ["correlation digest", (value) => { value.result.correlationDigest = "1".repeat(64); }],
    ["provider digest", (value) => { value.result.providerResponseDigest = "2".repeat(64); }],
    ["invalid receipt digest", (value) => { value.result.receiptDigest = "not-a-digest"; value.result.evidenceRef.receiptDigest = "not-a-digest"; }],
    ["coordinated decision digest", (value) => {
      value.result.decisionDigest = "8".repeat(64);
      value.result.evidenceRef.decisionDigest = value.result.decisionDigest;
    }],
    ["coordinated receipt digest", (value) => {
      value.result.receiptDigest = "9".repeat(64);
      value.result.evidenceRef.receiptDigest = value.result.receiptDigest;
    }],
    ["evidence type", (value) => { value.result.evidenceRef.type = "PRIVATE_PROVIDER_PATH"; }],
    ["evidence sink", (value) => { value.result.evidenceRef.sinkDigest = "3".repeat(64); }],
    ["evidence decision", (value) => { value.result.evidenceRef.decisionDigest = "4".repeat(64); }],
    ["evidence receipt", (value) => { value.result.evidenceRef.receiptDigest = "5".repeat(64); }],
    ["evidence readback", (value) => { value.result.evidenceRef.readbackDigest = "6".repeat(64); }],
    ["outcome", (value) => { value.result.outcome = "EXECUTED_WITHOUT_READBACK"; }],
    ["effect metadata", (value) => { value.result.effectCount = 2; }],
  ];
  for (const [label, mutate] of probes) {
    const forged = structuredClone(valid);
    mutate(forged);
    assert.throws(
      () => validateOpenClawM14GatewayResponse(redigestResponseEnvelope(forged), context),
      /CM_GATEWAY_RESPONSE_INVALID_DENIED/,
      label,
    );
  }
});

test("OPENCLAW-M1.4 fail-closed probes deny before synthetic effect", async () => {
  const { gatewayHandler, temporary } = await freshGateway("negatives");
  try {
    const probes = [
      ["inactive-erp", "ACTION_INACTIVE_DENIED", (draft) => {
        const erp = canonicalCatalogue.actions[1];
        Object.assign(draft, { actionId: erp.actionId, actionVersion: erp.version, actionDigest: erp.digest, resource: erp.resource, request: { quantity: 2, sku: "SYN-ZOO-001" } });
      }],
      ["catalogue-digest", "CATALOGUE_DIGEST_MISMATCH_DENIED", (draft) => { draft.catalogueDigest = "0".repeat(64); }],
      ["action-digest", "ACTION_DIGEST_MISMATCH_DENIED", (draft) => { draft.actionDigest = "0".repeat(64); }],
      ["unknown-action", "ACTION_UNKNOWN_DENIED", (draft) => { draft.actionId = "credential-shaped-material"; }],
      ["tenant", "CROSS_TENANT_DENIED", (draft) => { draft.tenant = "tenant:foreign"; }],
      ["policy", "POLICY_BINDING_MISMATCH_DENIED", (draft) => { draft.policyDigest = "0".repeat(64); }],
      ["evidence", "EVIDENCE_SINK_MISSING_DENIED", (draft) => { draft.evidenceSink.sinkId = "evidence:other"; }],
      ["resource", "REQUEST_RESOURCE_DENIED", (draft) => { draft.resource = "espocrm.contact"; }],
      ["malformed-email", "REQUEST_SCHEMA_INVALID_DENIED", (draft) => { draft.request.email = "not-an-email"; }],
      ["oversize-email", "REQUEST_SCHEMA_INVALID_DENIED", (draft) => { draft.request.email = `${"a".repeat(121)}@example.test`; }],
      ["unknown-field", "REQUEST_SCHEMA_INVALID_DENIED", (draft) => { draft.request.privatePath = "/private/provider/path"; }],
      ["correlation", "CORRELATION_MISSING_DENIED", (draft) => { draft.correlationId = "corr-aas035-other-0001"; }],
    ];
    for (const [label, code, mutate] of probes) {
      const requestId = `request:openclaw-m14-${label}`;
      const invocation = invocationFor(requestId, `m14-negative-${label}-0001`);
      const body = structuredClone(requestFor(invocation, requestId));
      mutate(body);
      const response = await gatewayRequest(gatewayHandler, route, { headers: headersFor(invocation), body });
      assert.equal(response.status, 403, label);
      assert.equal(response.body.status, "DENY", label);
      assert.equal(response.body.code, code, label);
      assert.equal(response.body.effectCount, 0, label);
      assertSanitized(response.body, invocation, requestId);
    }
    const bypass = await gatewayRequest(gatewayHandler, "/v1/providers/direct", {
      headers: { "x-cm-workload-identity": workloadContract.identity.subject }, body: {},
    });
    assert.equal(bypass.status, 403);
    assert.equal(bypass.body.error, "ROUTE_DENIED");
    const evidence = await gatewayRequest(gatewayHandler, "/v1/evidence", {
      method: "GET", headers: { "x-cm-workload-identity": workloadContract.identity.subject },
    });
    assert.equal(evidence.body.openClawM14EffectCount, 0);
  } finally { await cleanup(temporary); }
});

test("OPENCLAW-M1.4 transport schema mismatches stay M1.4-classified and leak no caller material", async () => {
  const { gatewayHandler, temporary } = await freshGateway("schema-classification");
  try {
    const cases = [
      ["missing-header", null, requestSchema],
      ["wrong-header", "chimpmaera.security/capability-execution-request/v0", requestSchema],
      ["missing-body", requestSchema, undefined],
      ["wrong-body", requestSchema, "chimpmaera.security/capability-execution-request/v0"],
      ["conflicting", "chimpmaera.security/capability-execution-request/v2", "chimpmaera.security/capability-execution-request/v0"],
    ];
    for (const [label, headerSchema, bodySchema] of cases) {
      const requestId = `request:openclaw-m14-schema-${label}`;
      const invocation = invocationFor(requestId, `m14-schema-${label}-0001`);
      const body = { ...requestFor(invocation, requestId), schemaVersion: bodySchema };
      body.request = { email: "marker-email@example.test", name: "marker-private-name" };
      const response = await gatewayRequest(gatewayHandler, route, { headers: headersFor(invocation, headerSchema), body });
      assert.equal(response.status, 403, label);
      assert.equal(response.body.schemaVersion, "chimpmaera.openclaw-m1.4/gateway-denial/v1", label);
      assert.equal(response.body.code, "REQUEST_SCHEMA_MISMATCH_DENIED", label);
      assert.equal(response.body.effectCount, 0, label);
      assertNoMarkers(response.body, [
        invocation.correlationId, requestId, invocation.identity.claims.jti,
        encodeSyntheticIdentity(invocation.identity),
        workloadContract.identity.subject, "marker-email@example.test", "marker-private-name",
      ]);
    }
  } finally { await cleanup(temporary); }
});

test("OPENCLAW-M1.4 retry and concurrent duplicate recovery produce one effect per request", async () => {
  const { gatewayHandler, temporary } = await freshGateway("duplicates");
  try {
    const requestId = "request:openclaw-m14-dupe-0001";
    const firstInvocation = invocationFor(requestId, "m14-dupe-invocation-0001");
    const retryInvocation = invocationFor(requestId, "m14-dupe-invocation-0002");
    const first = await gatewayRequest(gatewayHandler, route, { headers: headersFor(firstInvocation), body: requestFor(firstInvocation, requestId) });
    const retry = await gatewayRequest(gatewayHandler, route, { headers: headersFor(retryInvocation), body: requestFor(retryInvocation, requestId) });
    assertPublicProjection(first.body, firstInvocation, requestId);
    assertPublicProjection(retry.body, retryInvocation, requestId);
    assert.equal(first.body.result.replayState, "FIRST_EXECUTION");
    assert.equal(retry.body.result.replayState, "RECOVERED_SAME_RECEIPT");
    assert.equal(firstInvocation.correlationId, retryInvocation.correlationId);
    assert.notEqual(firstInvocation.identity.claims.jti, retryInvocation.identity.claims.jti);
    assert.equal(first.body.result.receiptDigest, retry.body.result.receiptDigest);
    assert.equal(first.body.result.correlationDigest, retry.body.result.correlationDigest);
    assert.equal(first.body.result.decisionDigest, retry.body.result.decisionDigest);
    assert.equal(first.body.responseDigest === retry.body.responseDigest, false);
    assert.equal(validateOpenClawM14GatewayResponse(first.body, {
      correlationId: firstInvocation.correlationId, requestId, workloadContract,
    }), first.body);
    assert.equal(validateOpenClawM14GatewayResponse(retry.body, {
      correlationId: retryInvocation.correlationId, requestId, workloadContract,
    }), retry.body);

    const concurrentId = "request:openclaw-m14-dupe-0002";
    const [left, right] = await Promise.all([
      invoke(gatewayHandler, concurrentId, "m14-concurrent-invocation-left"),
      invoke(gatewayHandler, concurrentId, "m14-concurrent-invocation-right"),
    ]);
    assert.deepEqual([left.status, right.status].sort(), [200, 200]);
    assert.equal(left.body.result.receiptDigest, right.body.result.receiptDigest);
    assert.equal(left.body.result.decisionDigest, right.body.result.decisionDigest);
    assert.equal(left.body.result.correlationDigest, right.body.result.correlationDigest);
    assert.deepEqual([left.body.result.replayState, right.body.result.replayState].sort(), ["FIRST_EXECUTION", "RECOVERED_SAME_RECEIPT"]);
    const evidence = await gatewayRequest(gatewayHandler, "/v1/evidence", {
      method: "GET", headers: { "x-cm-workload-identity": workloadContract.identity.subject },
    });
    assert.equal(evidence.body.openClawM14EffectCount, 2);
    assert.equal(evidence.body.openClawM14ReceiptDigests.length, 2);
  } finally { await cleanup(temporary); }
});

test("OPENCLAW-M1.4 durable reservation and post-commit restart recovery never duplicate", () => {
  const reservedInput = directInvocation("request:openclaw-m14-crash-reserved", "m14-crash-reserved-0001");
  const reservedProcess = emptyM14State();
  const persistedReservation = durableSnapshotAt(reservedProcess, "RESERVED", validateM14State,
    (persist) => executeDirect(reservedProcess, reservedInput, persist));
  assert.equal(Object.keys(persistedReservation.openclawM14Effects).length, 0);
  assert.equal(persistedReservation.openclawM14InFlight[reservedInput.request.requestId].status, "RESERVED");
  const denied = executeDirect(structuredClone(persistedReservation), reservedInput);
  assert.equal(denied.code, "REPLAY_IN_FLIGHT_DENIED");

  const committedInput = directInvocation("request:openclaw-m14-crash-commit", "m14-crash-commit-0001");
  const committedProcess = emptyM14State();
  const persistedCommit = durableSnapshotAt(committedProcess, "COMMITTED", validateM14State,
    (persist) => executeDirect(committedProcess, committedInput, persist));
  assert.equal(persistedCommit.openclawM14InFlight[committedInput.request.requestId].status, "COMMITTED");
  assert.deepEqual(persistedCommit.openclawM14InFlight[committedInput.request.requestId].readback, { contactId: "synthetic-contact-001" });
  const restarted = structuredClone(persistedCommit);
  const recovery = executeDirect(restarted, committedInput);
  assert.equal(recovery.result.replayState, "RECOVERED_AUTHORITATIVE_READBACK");
  assert.equal(Object.keys(restarted.openclawM14Effects).length, 1);
  assert.equal(Object.keys(restarted.openclawM14InFlight).length, 0);
  const retry = executeDirect(restarted, committedInput);
  assert.equal(retry.result.replayState, "RECOVERED_SAME_RECEIPT");
  assert.equal(retry.result.receiptDigest, recovery.result.receiptDigest);
  assert.equal(Object.keys(restarted.openclawM14Effects).length, 1);
});

test("OPENCLAW-M1.4 binds workload identity, audience, route, and freshness before effect", async () => {
  const { gatewayHandler, temporary } = await freshGateway("identity-binding");
  try {
    const requestId = "request:openclaw-m14-identity";
    const valid = invocationFor(requestId, "m14-identity-valid-0001");
    const workloadMismatch = await gatewayRequest(gatewayHandler, route, {
      headers: headersFor(valid), body: { ...requestFor(valid, requestId), workloadIdentity: "workload:synthetic-agent" },
    });
    assert.equal(workloadMismatch.status, 403);
    assert.equal(workloadMismatch.body.code, "IDENTITY_SUBJECT_DENIED");
    assertSanitized(workloadMismatch.body, valid, requestId);

    for (const [label, overrides, code] of [
      ["audience", { audience: "chimpmaera://wrong" }, "IDENTITY_AUDIENCE_DENIED"],
      ["identity-route", { route: "/v1/providers/direct" }, "IDENTITY_ROUTE_DENIED"],
      ["stale", { issuedAt: "2026-08-09T11:58:00.000Z", expiresAt: "2026-08-09T11:59:00.000Z" }, "IDENTITY_EXPIRED_DENIED"],
      ["alternate-valid-window", {
        issuedAt: "2026-08-09T11:59:59.000Z", expiresAt: "2026-08-09T12:00:59.000Z",
      }, "IDENTITY_EXPIRED_DENIED"],
    ]) {
      const invocation = invocationFor(requestId, `m14-identity-${label}-0001`);
      invocation.identity = createSyntheticIdentity(workloadContract, {
        correlationId: invocation.correlationId, jti: invocation.identity.claims.jti, overrides,
      });
      const response = await gatewayRequest(gatewayHandler, route, { headers: headersFor(invocation), body: requestFor(invocation, requestId) });
      assert.equal(response.status, 403, label);
      assert.equal(response.body.code, code, label);
      assertSanitized(response.body, invocation, requestId);
    }
    const alternateCorrelation = alternateValidCorrelation(requestId);
    const alternateInvocation = {
      correlationId: alternateCorrelation,
      identity: createSyntheticIdentity(workloadContract, {
        correlationId: alternateCorrelation,
        jti: "jti-aas035-openclaw-m14-alternate-correlation-0001",
      }),
    };
    const alternateResponse = await gatewayRequest(gatewayHandler, route, {
      headers: headersFor(alternateInvocation), body: requestFor(alternateInvocation, requestId),
    });
    assert.equal(alternateResponse.status, 403);
    assert.equal(alternateResponse.body.code, "CORRELATION_MISSING_DENIED");
    assertSanitized(alternateResponse.body, alternateInvocation, requestId);
    const wrongRoute = await gatewayRequest(gatewayHandler, "/v1/providers/direct", {
      headers: headersFor(valid), body: requestFor(valid, requestId),
    });
    assert.equal(wrongRoute.status, 403);
    assert.equal(wrongRoute.body.error, "ROUTE_DENIED");
  } finally { await cleanup(temporary); }
});

test("OPENCLAW-M1.4 canonical admission and response validation deny before effect", () => {
  for (const [label, mutate, code] of [
    ["oversize-email", (request) => { request.request.email = `${"a".repeat(121)}@example.test`; }, "REQUEST_SCHEMA_INVALID_DENIED"],
    ["malformed-email", (request) => { request.request.email = "not-an-email"; }, "REQUEST_SCHEMA_INVALID_DENIED"],
    ["stale-action", (request) => { request.actionVersion = "0.9.0"; }, "ACTION_VERSION_STALE_DENIED"],
    ["stale-catalogue", (request) => { request.catalogueVersion = "0.9.0"; }, "CATALOGUE_VERSION_STALE_DENIED"],
  ]) {
    const state = emptyM14State();
    const input = directInvocation(`request:openclaw-m14-${label}`, `m14-contract-${label}-0001`);
    mutate(input.request);
    const result = executeDirect(state, input);
    assert.equal(result.code, code, label);
    assert.equal(Object.keys(state.openclawM14Effects).length, 0, label);
    assert.equal(Object.keys(state.openclawM14InFlight).length, 0, label);
  }

  const canonicalInput = directInvocation("request:openclaw-m14-contract-fixture", "m14-contract-fixture-0001");
  for (const [label, fixtureValue, code] of [
    ["stale activation", { activation: redigest({ ...canonicalActivation, expiresAt: "2026-08-09T11:00:00Z" }) }, "ACTIVATION_STALE_DENIED"],
    ["stale policy", { policy: redigest({ ...canonicalPolicy, expiresAt: "2026-08-09T11:00:00Z" }) }, "POLICY_STALE_DENIED"],
  ]) {
    const decision = admitWithCanonicalFixtures(canonicalInput.request, fixtureValue);
    assert.equal(decision.outcome, "DENY", label);
    assert.deepEqual(decision.issues, [code], label);
  }
  const mismatch = brokerWithSyntheticResponse(canonicalInput.request, { contactId: "live-contact-1" });
  assert.equal(mismatch.receipt.outcome, "DENY");
  assert.deepEqual(mismatch.receipt.issues, ["RESPONSE_SCHEMA_INVALID_DENIED"]);
  assert.equal(mismatch.effects, 0);
});

test("OPENCLAW-M1.4 persisted records reject decision, binding, readback, receipt, and ordinal tampering", () => {
  const committed = emptyM14State();
  const first = directInvocation("request:openclaw-m14-tamper-0001", "m14-tamper-invocation-0001");
  const second = directInvocation("request:openclaw-m14-tamper-0002", "m14-tamper-invocation-0002");
  executeDirect(committed, first);
  executeDirect(committed, second);
  const reservedProcess = emptyM14State();
  const reservedInput = directInvocation("request:openclaw-m14-tamper-reserved", "m14-tamper-reserved-0001");
  const reserved = durableSnapshotAt(reservedProcess, "RESERVED", validateM14State,
    (persist) => executeDirect(reservedProcess, reservedInput, persist));
  const records = [
    [committed, "openclawM14Effects", first.request.requestId],
    [reserved, "openclawM14InFlight", reservedInput.request.requestId],
  ];
  for (const [source, collection, requestId] of records) {
    const mutations = [
      (record) => { record.decision.decisionDigest = "0".repeat(64); },
      (record) => { record.decision.ticket.request = { email: "replacement@example.test", name: "Replacement" }; },
      (record) => { record.requestDigest = "0".repeat(64); },
      (record) => { record.correlationDigest = "0".repeat(64); },
      (record) => { record.decision.correlationDigest = "0".repeat(64); },
      (record) => { record.decision.ticket.correlationDigest = "0".repeat(64); },
      (record) => { record.decision.extra = "forbidden"; },
      (record) => { record.decision.ticket.extra = "forbidden"; },
      (record) => { record.decision.ticket.catalogueDigest = "0".repeat(64); },
      (record) => { record.decision.ticket.actionDigest = "0".repeat(64); },
      (record) => { record.decision.ticket.activationDigest = "0".repeat(64); },
      (record) => { record.decision.ticket.policyId = "policy:other"; },
      (record) => { record.decision.ticket.policyDigest = "0".repeat(64); },
      (record) => { record.decision.ticket.policyVersion = "0.9.0"; },
    ];
    for (const mutate of mutations) {
      const draft = structuredClone(source);
      mutate(draft[collection][requestId]);
      assert.throws(() => validateM14State(draft), /STATE_INVALID_DENIED/);
    }
  }
  for (const mutate of [
    (draft) => { draft.openclawM14Effects[first.request.requestId].readback.contactId = "synthetic-contact-999"; },
    (draft) => { draft.openclawM14Effects[first.request.requestId].receipt.response.contactId = "synthetic-contact-999"; },
    (draft) => { draft.openclawM14Effects[first.request.requestId].receipt.privatePath = "/private/provider/path"; },
    (draft) => { draft.openclawM14Effects[second.request.requestId].effectOrdinal = draft.openclawM14Effects[first.request.requestId].effectOrdinal; },
  ]) {
    const draft = structuredClone(committed);
    mutate(draft);
    assert.throws(() => validateM14State(draft), /STATE_INVALID_DENIED/);
  }
});

test("OPENCLAW-M1.4 rejects coordinated redigested state for provider and authorization forgeries", () => {
  const effectState = emptyM14State();
  const effectInput = directInvocation("request:openclaw-m14-forgery-effect", "m14-forgery-effect-0001");
  executeDirect(effectState, effectInput);
  const effectId = effectInput.request.requestId;

  const reservedProcess = emptyM14State();
  const reservedInput = directInvocation("request:openclaw-m14-forgery-reserved", "m14-forgery-reserved-0001");
  const reservedState = durableSnapshotAt(reservedProcess, "RESERVED", validateM14State,
    (persist) => executeDirect(reservedProcess, reservedInput, persist));
  const reservedId = reservedInput.request.requestId;

  const forgedReadback = structuredClone(effectState);
  const forgedEffect = forgedReadback.openclawM14Effects[effectId];
  forgedEffect.readback = { contactId: "synthetic-contact-999" };
  forgedEffect.readbackDigest = digest(forgedEffect.readback);
  forgedEffect.receipt = receiptForDecision(forgedEffect.decision, forgedEffect.readback);
  assert.equal(forgedEffect.receipt.outcome, "EXECUTED");
  assert.throws(() => validateM14State(forgedReadback), /STATE_INVALID_DENIED/);

  const forgedReservedReadback = structuredClone(reservedState);
  const forgedReservation = forgedReservedReadback.openclawM14InFlight[reservedId];
  forgedReservation.status = "COMMITTED";
  forgedReservation.response = { contactId: "synthetic-contact-999" };
  forgedReservation.readback = structuredClone(forgedReservation.response);
  forgedReservation.readbackDigest = digest(forgedReservation.readback);
  assert.throws(() => validateM14State(forgedReservedReadback), /STATE_INVALID_DENIED/);

  for (const [source, collection, requestId] of [
    [effectState, "openclawM14Effects", effectId],
    [reservedState, "openclawM14InFlight", reservedId],
  ]) {
    const authorizationProbes = [
      ["audience", (binding) => { binding.audience = "chimpmaera://forged"; }],
      ["scope", (binding) => { binding.scope = ["capability:erp.order.create"]; }],
      ["route", (binding) => { binding.network.path = "/v1/providers/direct"; }],
      ["network host", (binding) => { binding.network.host = "provider.internal"; }],
      ["issued future", (binding) => { binding.issuedAt = "2026-08-09T12:01:00.000Z"; }],
      ["alternate valid window", (binding) => {
        binding.issuedAt = "2026-08-09T11:59:59.000Z";
        binding.expiresAt = "2026-08-09T12:00:59.000Z";
      }],
      ["expired", (binding) => { binding.expiresAt = "2026-08-09T12:00:00.000Z"; }],
      ["ttl", (binding) => { binding.expiresAt = "2026-08-09T12:02:00.000Z"; }],
      ["contract digest", (binding) => { binding.workloadContractDigest = "7".repeat(64); }],
      ["binding shape", (binding) => { binding.extra = "forbidden"; }],
    ];
    for (const [label, mutate] of authorizationProbes) {
      const forged = structuredClone(source);
      const record = forged[collection][requestId];
      mutate(record.authorizationBinding);
      record.authorizationBinding = redigestAuthorizationBinding(record.authorizationBinding);
      assert.throws(() => validateM14State(forged), /STATE_INVALID_DENIED/, `${collection}:${label}`);
    }

    const forgedCorrelation = structuredClone(source);
    const record = forgedCorrelation[collection][requestId];
    const forgedCorrelationId = alternateValidCorrelation(requestId);
    const forgedDigest = digest(forgedCorrelationId);
    record.correlationDigest = forgedDigest;
    record.authorizationBinding.correlationId = forgedCorrelationId;
    record.authorizationBinding.correlationDigest = forgedDigest;
    record.authorizationBinding = redigestAuthorizationBinding(record.authorizationBinding);
    record.decision.correlationDigest = forgedDigest;
    record.decision.ticket.correlationDigest = forgedDigest;
    record.decision = redigestDecision(record.decision);
    if (collection === "openclawM14Effects") {
      record.receipt = receiptForDecision(record.decision, record.readback);
      assert.equal(record.receipt.outcome, "EXECUTED");
    }
    assert.throws(() => validateM14State(forgedCorrelation), /STATE_INVALID_DENIED/, `${collection}:correlation`);
  }

  const forgedContract = structuredClone(workloadContract);
  forgedContract.identity.audience = "chimpmaera://forged";
  assert.throws(() => validateOpenClawM14State(effectState, forgedContract), /STATE_INVALID_DENIED/);
});

async function walkFiles(relative) {
  const absolute = path.join(root, relative);
  if ((await stat(absolute)).isFile()) return [relative];
  const entries = await readdir(absolute, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => walkFiles(path.posix.join(relative, entry.name))))).flat();
}

test("OPENCLAW-M1.4 every shipped runtime input exposes no fault or alternate-contract controls", async () => {
  const dockerfiles = ["demo/openclaw-agent/gateway.Dockerfile", "demo/openclaw-agent/openclaw.Dockerfile"];
  const copied = new Set(["demo/openclaw-agent/compose.yaml", ...dockerfiles]);
  for (const dockerfile of dockerfiles) {
    const source = await readFile(path.join(root, dockerfile), "utf8");
    for (const line of source.split("\n").filter((candidate) => candidate.startsWith("COPY "))) {
      const match = line.match(/^COPY(?:\s+--\S+)*\s+(\S+)\s+\S+$/);
      assert.ok(match, `${dockerfile}: unparsed COPY`);
      for (const file of await walkFiles(match[1])) copied.add(file);
    }
  }
  const forbidden = /CM_OPENCLAW_M14_TEST_MODE|TEST_CRASH|options\.fault|options\.contracts|responseOverride|interruptBeforeCommit|ambiguousAfterCommit/;
  for (const relative of [...copied].sort()) {
    if (!/\.(?:mjs|js|ts|json|yaml|yml)$|Dockerfile$/.test(relative)) continue;
    assert.doesNotMatch(await readFile(path.join(root, relative), "utf8"), forbidden, relative);
  }
});
