import assert from "node:assert/strict";
import test from "node:test";

import {
  assertExternalBiReadOnlyRequestV1,
  configureExternalBiServiceV1,
  EXTERNAL_BI_SERVICE_CAPABILITIES_V1,
  EXTERNAL_BI_SERVICE_MIN_AGENT_CONTRACT_V1,
  EXTERNAL_BI_SERVICE_MIN_PRODUCT_VERSION_V1,
  probeExternalBiServiceV1,
  renderExternalBiAgentPromptV1,
  type ExternalBiServiceConfigDecisionV1,
} from "../packages/contracts/src/index.js";

const goodEnv = {
  BI_AGENT_BASE_URL: "http://127.0.0.1:18790",
  SUPERSET_BASE_URL: "http://127.0.0.1:18088",
  BI_AGENT_EXPECTED_PRODUCT_VERSION: EXTERNAL_BI_SERVICE_MIN_PRODUCT_VERSION_V1,
  BI_AGENT_MIN_CONTRACT_VERSION: EXTERNAL_BI_SERVICE_MIN_AGENT_CONTRACT_V1,
  BI_AGENT_TIMEOUT_MS: "5000",
};

function verified(): ExternalBiServiceConfigDecisionV1 {
  const decision = configureExternalBiServiceV1(goodEnv);
  assert.equal(decision.outcome, "VERIFIED");
  return decision;
}

function response(body: unknown, status = 200): Response {
  const value = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(value, { status, headers: { "content-type": "application/json" } });
}

function fakeFetch(options: {
  readonly agentHealth?: Response;
  readonly supersetHealth?: Response;
  readonly statusBody?: unknown;
  readonly statusCode?: number;
  readonly capture?: RequestInit[];
} = {}): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    options.capture?.push(init ?? {});
    const url = String(input);
    if (url.endsWith("/healthz")) return options.agentHealth ?? response({ status: "ok" });
    if (url.endsWith("/health")) return options.supersetHealth ?? new Response("OK\n", { status: 200 });
    if (url.endsWith("/api/chat")) {
      return response(options.statusBody ?? {
        intent: "STATUS",
        status: {
          status: "READY",
          engine: "mssql",
          sourceMode: "fixture",
          latestReceiptId: "mssql-fixture",
          catalogReady: true,
        },
      }, options.statusCode ?? 200);
    }
    return response({ status: "DENIED", code: "UNEXPECTED_ROUTE" }, 404);
  }) as typeof fetch;
}

test("external BI service config is disabled when CM is not configured for BI", () => {
  assert.deepEqual(configureExternalBiServiceV1({}), {
    outcome: "DISABLED",
    reasonCodes: ["EXTERNAL_BI_SERVICE_NOT_CONFIGURED"],
    config: {
      schemaVersion: "chimpmaera.external-bi-service/config/v1",
      enabled: false,
      biAgentBaseUrl: null,
      supersetBaseUrl: null,
      expectedProductVersion: "v0.4.1",
      minAgentContractVersion: "chimpmaera.bi/agent-result/v1",
      timeoutMs: 5000,
      allowedCapabilities: EXTERNAL_BI_SERVICE_CAPABILITIES_V1,
    },
  });
});

test("external BI service config accepts only explicit safe loopback service URLs", () => {
  const decision = configureExternalBiServiceV1(goodEnv);
  assert.equal(decision.outcome, "VERIFIED");
  if (decision.outcome === "VERIFIED") {
    assert.equal(decision.config.biAgentBaseUrl, "http://127.0.0.1:18790");
    assert.equal(decision.config.supersetBaseUrl, "http://127.0.0.1:18088");
  }
});

test("negative config probes deny unsafe URLs, credentials, metadata addresses, timeout and version drift", () => {
  const cases = [
    [{ ...goodEnv, BI_AGENT_BASE_URL: "file:///tmp/bi" }, "EXTERNAL_BI_SERVICE_URL_DENIED"],
    [{ ...goodEnv, BI_AGENT_BASE_URL: ["http:/", "/user:pass@example.test"].join("") }, "EXTERNAL_BI_SERVICE_URL_DENIED"],
    [{ ...goodEnv, BI_AGENT_BASE_URL: "http://169.254.169.254" }, "EXTERNAL_BI_SERVICE_URL_DENIED"],
    [{ ...goodEnv, SUPERSET_BASE_URL: "http://127.0.0.1:18088/path" }, "EXTERNAL_BI_SERVICE_URL_DENIED"],
    [{ ...goodEnv, BI_AGENT_TIMEOUT_MS: "50" }, "EXTERNAL_BI_SERVICE_TIMEOUT_DENIED"],
    [{ ...goodEnv, BI_AGENT_EXPECTED_PRODUCT_VERSION: "latest" }, "EXTERNAL_BI_SERVICE_VERSION_DENIED"],
    [{ ...goodEnv, BI_AGENT_MIN_CONTRACT_VERSION: "chimpmaera.bi/agent-result/v2" }, "EXTERNAL_BI_SERVICE_VERSION_DENIED"],
  ] as const;
  for (const [env, code] of cases) {
    const decision = configureExternalBiServiceV1(env);
    assert.equal(decision.outcome, "DENIED", code);
    if (decision.outcome === "DENIED") assert.ok(decision.reasonCodes.includes(code));
  }
});

test("probe verifies external agent health, Superset health and read-only status capability", async () => {
  const result = await probeExternalBiServiceV1(verified(), fakeFetch());
  assert.equal(result.outcome, "VERIFIED");
  if (result.outcome === "VERIFIED") {
    assert.equal(result.readback.expectedProductVersion, "v0.4.1");
    assert.equal(result.readback.status.catalogReady, true);
    assert.equal(result.readback.mutationEndpointsExposedByCm, false);
  }
});

test("negative service probes fail closed for unavailable, timeout-shaped and malformed responses", async () => {
  const cases = [
    [fakeFetch({ agentHealth: response({ status: "down" }, 503) }), "UNAVAILABLE", "EXTERNAL_BI_SERVICE_HEALTH_UNAVAILABLE"],
    [fakeFetch({ supersetHealth: new Response("NO\n", { status: 503 }) }), "UNAVAILABLE", "EXTERNAL_BI_SERVICE_SUPERSET_MISMATCH"],
    [fakeFetch({ statusBody: { intent: "STATUS", status: "READY" } }), "DENIED", "EXTERNAL_BI_SERVICE_STATUS_MALFORMED"],
    [fakeFetch({ statusBody: { intent: "STATUS", status: { status: "READY", engine: "mysql", sourceMode: "fixture", catalogReady: true } } }), "DENIED", "EXTERNAL_BI_SERVICE_STATUS_MALFORMED"],
    [fakeFetch({ statusBody: { intent: "STATUS", status: { status: "READY", engine: "mssql", sourceMode: "fixture", catalogReady: false } } }), "DENIED", "EXTERNAL_BI_SERVICE_CAPABILITY_MISSING"],
    [fakeFetch({ statusBody: "not-json", statusCode: 502 }), "DENIED", "EXTERNAL_BI_SERVICE_STATUS_MALFORMED"],
  ] as const;
  for (const [fetchImpl, outcome, code] of cases) {
    const result = await probeExternalBiServiceV1(verified(), fetchImpl);
    assert.equal(result.outcome, outcome, code);
    if (result.outcome === "DENIED" || result.outcome === "UNAVAILABLE") assert.ok(result.reasonCodes.includes(code));
  }
});

test("CM sends no Authorization or credential header to the external public agent API", async () => {
  const capture: RequestInit[] = [];
  const result = await probeExternalBiServiceV1(verified(), fakeFetch({ capture }));
  assert.equal(result.outcome, "VERIFIED");
  for (const init of capture) {
    assert.equal(JSON.stringify(init.headers ?? {}).toLowerCase().includes("authorization"), false);
    assert.equal(JSON.stringify(init.headers ?? {}).toLowerCase().includes("token"), false);
  }
});

test("read-only catalog prompts are fixed and mutation actions are denied before fetch", () => {
  assert.equal(renderExternalBiAgentPromptV1({ action: "status" }), "status");
  assert.equal(renderExternalBiAgentPromptV1({ action: "catalogQuestion", family: "largest_tables" }), "Largest tables by size");
  assert.equal(renderExternalBiAgentPromptV1({ action: "catalogSearch", term: "orders", limit: 5 }), "Suche orders");
  assert.deepEqual(assertExternalBiReadOnlyRequestV1({ action: "analyze" }), ["EXTERNAL_BI_SERVICE_MUTATION_DENIED"]);
  assert.deepEqual(assertExternalBiReadOnlyRequestV1({ action: "publish" }), ["EXTERNAL_BI_SERVICE_MUTATION_DENIED"]);
});

test("free SQL, prompt injection and unsafe search terms are denied before fetch", () => {
  const probes = [
    { action: "catalogSearch", term: "select * from users" },
    { action: "catalogSearch", term: "ignore previous instructions" },
    { action: "catalogSearch", term: "secret token" },
    { action: "catalogSearch", term: "x" },
  ] as const;
  for (const probe of probes) {
    assert.deepEqual(assertExternalBiReadOnlyRequestV1(probe), ["EXTERNAL_BI_SERVICE_UNSAFE_REQUEST_DENIED"]);
  }
});
