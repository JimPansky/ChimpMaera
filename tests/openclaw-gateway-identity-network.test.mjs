import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  authorizeGatewayRequest,
  createInvocationIdentity,
  createSyntheticIdentity,
  encodeSyntheticIdentity,
  sanitizedDenial,
} from "../demo/openclaw-agent/plugin/identity-v2.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "demo/openclaw-agent");
const contract = JSON.parse(readFileSync(path.join(fixture, "gateway-workload-contract-v2.json"), "utf8"));
const typed = {
  schemaVersion: "chimpmaera.aas035/typed-capability-request/v1",
  tenant: "tenant:synthetic-zoo",
  purpose: "purpose:synthetic-contact-fixture",
  catalogueDigest: "1454c6bc785bc5185d7e1dc657cd62b620c2e2f9b79a80ac38e87573adf5c387",
  catalogueVersion: "1.0.0",
  adapterId: "espocrm-local-fixture",
  adapterVersion: "1.0.0",
  actionId: "crm.contact.create",
  resource: "espocrm.contact",
  effect: "CREATE",
  requestId: "aas035-http-retry-0001",
  payload: { email: "agent.fixture@synthetic.invalid", name: "AAS-035 Synthetic Agent" },
};

function request(label = "allow", { claimOverrides = {}, requestOverrides = {}, expiresAt } = {}) {
  const correlationId = `corr-aas035-${label}-0001`;
  const identity = createSyntheticIdentity(contract, {
    correlationId,
    jti: `jti-aas035-${label}-0001`,
    expiresAt,
    overrides: claimOverrides,
  });
  return {
    protocol: "http:",
    dnsTarget: "capability-gateway",
    host: "capability-gateway",
    port: 8080,
    method: "POST",
    path: "/v2/broker/capabilities/execute",
    authorization: `Synthetic ${encodeSyntheticIdentity(identity)}`,
    correlationId,
    ...requestOverrides,
  };
}

function denied(code, value) {
  assert.throws(
    () => authorizeGatewayRequest(contract, value),
    (error) => error?.code === code && error.message === code,
    code,
  );
}

test("OPENCLAW-M1.2 exact Gateway path allows a correlation-bound short-lived identity", () => {
  const value = request();
  const result = authorizeGatewayRequest(contract, value);
  assert.deepEqual(result, {
    schemaVersion: "chimpmaera.openclaw/gateway-authorization-result/v2",
    status: "ALLOW",
    correlationId: value.correlationId,
    identity: {
      subject: contract.identity.subject,
      audience: contract.identity.audience,
      tenant: contract.identity.tenant,
      scope: contract.identity.scope,
      issuedAt: contract.clock.now,
      expiresAt: "2026-08-09T12:01:00.000Z",
    },
    network: contract.networkPolicy.egress.allow[0],
  });
  assert.equal(Date.parse(result.identity.expiresAt) - Date.parse(result.identity.issuedAt), 60_000);
  assert.equal(contract.identity.replayCacheMaxEntries, 64);
});

test("OPENCLAW-M1.2 network policy is one finite allow and deterministic default deny", () => {
  assert.equal(contract.networkPolicy.default, "DENY");
  assert.deepEqual(contract.networkPolicy.dns.allow, ["capability-gateway"]);
  assert.equal(contract.networkPolicy.egress.allow.length, 1);
  assert.equal(contract.networkPolicy.composeInternal, true);
  const probes = [
    ["unexpected protocol", "PROTOCOL_DENIED", { protocol: "https:" }],
    ["unexpected DNS target", "DNS_TARGET_DENIED", { dnsTarget: "provider.invalid" }],
    ["direct internet", "DESTINATION_DENIED", { host: "example.com" }],
    ["direct provider", "DESTINATION_DENIED", { host: "api.openai.com" }],
    ["metadata service", "DESTINATION_DENIED", { host: "169.254.169.254" }],
    ["control plane", "DESTINATION_DENIED", { host: "host.docker.internal" }],
    ["peer service", "DESTINATION_DENIED", { host: "peer-service" }],
    ["unexpected port", "DESTINATION_DENIED", { port: 8081 }],
    ["unexpected method", "ROUTE_DENIED", { method: "GET" }],
    ["unexpected route", "ROUTE_DENIED", { path: "/v1/providers/direct" }],
  ];
  for (const [label, code, overrides] of probes) denied(code, request(label.replaceAll(" ", "-"), { requestOverrides: overrides }));
});

test("OPENCLAW-M1.2 identity negatives fail closed and reuse is replay-denied", () => {
  denied("IDENTITY_MISSING_DENIED", request("missing", { requestOverrides: { authorization: undefined } }));
  denied("IDENTITY_EXPIRED_DENIED", request("expired", { expiresAt: contract.clock.now }));
  denied("IDENTITY_AUDIENCE_DENIED", request("audience", { claimOverrides: { audience: "chimpmaera://unexpected.invalid/denied" } }));
  denied("IDENTITY_TENANT_DENIED", request("tenant", { claimOverrides: { tenant: "tenant:foreign" } }));
  denied("IDENTITY_SCOPE_DENIED", request("scope", { claimOverrides: { scope: ["capability:*" ] } }));
  denied("IDENTITY_ROUTE_DENIED", request("identity-route", { claimOverrides: { route: "/v2/broker/unexpected" } }));
  denied("IDENTITY_CORRELATION_DENIED", request("correlation", { requestOverrides: { correlationId: "corr-aas035-other-0001" } }));
  const malformed = request("proof");
  malformed.authorization = `${malformed.authorization.slice(0, -1)}A`;
  assert.throws(() => authorizeGatewayRequest(contract, malformed), /IDENTITY_(?:FORMAT|PROOF)_DENIED/);

  const replayIds = new Set();
  const reusable = request("reuse");
  assert.equal(authorizeGatewayRequest(contract, reusable, { replayIds }).status, "ALLOW");
  assert.throws(
    () => authorizeGatewayRequest(contract, reusable, { replayIds }),
    (error) => error?.code === "IDENTITY_REPLAY_DENIED",
  );
  const fullReplayCache = new Set(Array.from({ length: 64 }, (_, index) => `used-${index}`));
  assert.throws(
    () => authorizeGatewayRequest(contract, request("capacity"), { replayIds: fullReplayCache }),
    (error) => error?.code === "IDENTITY_REPLAY_CACHE_FULL_DENIED",
  );
});

function gatewayRequest(handler, route, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
    request.method = method;
    request.url = route;
    request.headers = headers;
    let status;
    const response = {
      writeHead(value) { status = value; },
      end(value) {
        try {
          resolve({ status, body: JSON.parse(String(value)) });
        } catch (error) {
          reject(error);
        }
      },
    };
    try {
      handler(request, response);
    } catch (error) {
      reject(error);
    }
  });
}

test("OPENCLAW-M1.2 exact smoke probe definitions reach their V2 denial boundaries", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "cm-openclaw-m12-smoke-"));
  const statePath = path.join(temporary, "state.json");
  process.env.CM_AAS035_STATE_PATH = statePath;
  try {
    assert.deepEqual(contract.smokeProbes.map((probe) => probe.mode), ["wrong-identity", "unknown-action"]);
    const gatewayUrl = `${pathToFileURL(path.join(fixture, "gateway.mjs")).href}?integration=m12-smoke-contract`;
    const { gatewayHandler } = await import(gatewayUrl);
    for (const probe of contract.smokeProbes) {
      assert.equal(probe.route, contract.identity.route);
      assert.equal(probe.route, contract.networkPolicy.egress.allow[0].path);
      const correlationId = `corr-aas035-${probe.mode}-0001`;
      const identity = createSyntheticIdentity(contract, {
        correlationId,
        jti: `jti-aas035-${probe.mode}-0001`,
        overrides: probe.identityOverrides,
      });
      const response = await gatewayRequest(gatewayHandler, probe.route, {
        method: "POST",
        headers: {
          authorization: `Synthetic ${encodeSyntheticIdentity(identity)}`,
          host: "capability-gateway:8080",
          "x-cm-correlation-id": correlationId,
        },
        body: { ...typed, ...probe.bodyOverrides },
      });
      assert.deepEqual(response, {
        status: 403,
        body: {
          schemaVersion: "chimpmaera.openclaw/gateway-denial/v2",
          status: "DENY",
          correlationId,
          code: probe.expectedCode,
        },
      });
    }
    const state = JSON.parse(await readFile(statePath, "utf8"));
    assert.equal(state.counters.effectAttempts, 1);
    assert.equal(state.counters.effects, 0);
    assert.deepEqual(state.effects, {});
    assert.equal(state.identityReplay.length, 1);
  } finally {
    delete process.env.CM_AAS035_STATE_PATH;
    await rm(temporary, { recursive: true, force: true });
  }
});

test("OPENCLAW-M1.2 legacy bypass creates no effect while fresh retry identity returns one exact receipt", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "cm-openclaw-m12-http-"));
  const statePath = path.join(temporary, "state.json");
  process.env.CM_AAS035_STATE_PATH = statePath;
  try {
    const gatewayUrl = `${pathToFileURL(path.join(fixture, "gateway.mjs")).href}?integration=m12-repair`;
    const { gatewayHandler } = await import(gatewayUrl);
    const legacy = await gatewayRequest(gatewayHandler, "/v1/capabilities/execute", {
      method: "POST",
      headers: { "x-cm-workload-identity": "workload:aas035-openclaw-agent-v1" },
      body: typed,
    });
    assert.deepEqual(legacy, {
      status: 403,
      body: { status: "DENY", error: "LEGACY_CAPABILITY_ROUTE_DENIED" },
    });
    let state = JSON.parse(await readFile(statePath, "utf8"));
    assert.equal(state.counters.effectAttempts, 0);
    assert.equal(state.counters.effects, 0);
    assert.deepEqual(state.effects, {});

    const firstInvocation = createInvocationIdentity(contract, {
      requestId: typed.requestId,
      invocationId: "fixture-invocation-0001",
    });
    const secondInvocation = createInvocationIdentity(contract, {
      requestId: typed.requestId,
      invocationId: "fixture-invocation-0002",
    });
    assert.notEqual(firstInvocation.identity.claims.jti, secondInvocation.identity.claims.jti);
    assert.deepEqual(firstInvocation, createInvocationIdentity(contract, {
      requestId: typed.requestId,
      invocationId: "fixture-invocation-0001",
    }));

    const invoke = (invocation) => gatewayRequest(gatewayHandler, contract.identity.route, {
      method: "POST",
      headers: {
        authorization: `Synthetic ${encodeSyntheticIdentity(invocation.identity)}`,
        host: "capability-gateway:8080",
        "x-cm-correlation-id": invocation.correlationId,
      },
      body: typed,
    });
    const first = await invoke(firstInvocation);
    const freshRetry = await invoke(secondInvocation);
    assert.equal(first.status, 200);
    assert.equal(first.body.result.replayState, "FIRST_EXECUTION");
    assert.equal(freshRetry.status, 200);
    assert.equal(freshRetry.body.result.replayState, "REPLAY_SAME_RECEIPT");
    assert.equal(first.body.result.receipt.receiptDigest, freshRetry.body.result.receipt.receiptDigest);
    assert.equal(first.body.correlationId, firstInvocation.correlationId);
    assert.equal(freshRetry.body.correlationId, secondInvocation.correlationId);

    const assertionReuse = await invoke(secondInvocation);
    assert.deepEqual(assertionReuse, {
      status: 403,
      body: {
        schemaVersion: "chimpmaera.openclaw/gateway-denial/v2",
        status: "DENY",
        correlationId: secondInvocation.correlationId,
        code: "IDENTITY_REPLAY_DENIED",
      },
    });
    state = JSON.parse(await readFile(statePath, "utf8"));
    assert.equal(state.counters.effectAttempts, 2);
    assert.equal(state.counters.effects, 1);
    assert.equal(Object.keys(state.effects).length, 1);
    assert.equal(state.identityReplay.length, 2);
  } finally {
    delete process.env.CM_AAS035_STATE_PATH;
    await rm(temporary, { recursive: true, force: true });
  }
});

test("OPENCLAW-M1.2 denial evidence is sanitized and does not echo identity material", () => {
  const output = sanitizedDenial(Object.assign(new Error("raw exploit detail"), { code: "IDENTITY_PROOF_DENIED" }), "corr-aas035-sanitize-0001");
  assert.deepEqual(Object.keys(output).sort(), ["code", "correlationId", "schemaVersion", "status"]);
  assert.equal(output.code, "IDENTITY_PROOF_DENIED");
  assert.doesNotMatch(JSON.stringify(output), /raw exploit|authorization|Synthetic |"claims"/i);
});

function fixtureFiles(directory) {
  return readdirSync(directory).sort().flatMap((name) => {
    const target = path.join(directory, name);
    return statSync(target).isDirectory() ? fixtureFiles(target) : [target];
  });
}

test("OPENCLAW-M1.2 fixture has no ambient proxy/credential channel or live credential-shaped bytes", () => {
  const compose = readFileSync(path.join(fixture, "compose.yaml"), "utf8");
  assert.doesNotMatch(compose, /\b(?:HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|AWS_|AZURE_|GOOGLE_|API_KEY|ACCESS_TOKEN|PASSWORD|CREDENTIAL)\b/i);
  assert.doesNotMatch(compose, /(?:docker\.sock|\.aws|\.azure|\.config\/gcloud|\.kube|hostPath)/i);
  const credentialPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bAKIA[A-Z0-9]{16}\b/,
    /\bsk-[A-Za-z0-9]{20,}\b/,
    /https?:\/\/[^\s/:]+:[^\s/@]+@/,
  ];
  for (const file of fixtureFiles(fixture)) {
    const bytes = readFileSync(file);
    if (bytes.includes(0)) continue;
    const text = bytes.toString("utf8");
    for (const pattern of credentialPatterns) assert.doesNotMatch(text, pattern, path.relative(root, file));
  }
  assert.equal(contract.credentialPolicy.liveCredentials, false);
  assert.equal(contract.identity.assurance, "PUBLIC_DETERMINISTIC_FIXTURE_BINDING_NOT_AUTHENTICATION");
});
