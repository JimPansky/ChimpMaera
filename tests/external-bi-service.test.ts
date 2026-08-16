import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  canonicalJson,
  configureExternalBiServiceV2,
  EXTERNAL_BI_SERVICE_CAPABILITIES_V2,
  invokeExternalBiServiceV2,
  probeExternalBiServiceV2,
  type ExternalBiServiceConfigDecisionV2,
} from "../packages/contracts/src/index.js";

const goodEnv = { BI_AGENT_BASE_URL: "http://127.0.0.1:18790", BI_AGENT_TIMEOUT_MS: "5000" };
const sha256 = (value: unknown) => `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
const descriptor = {
  "bi.status.read": { action: "status", authority: "read-only" },
  "bi.discovery.run": { action: "discovery", authority: "local-evidence-write" },
  "bi.analysis.run": { action: "analyze", authority: "source-read-only" },
  "bi.graph.adaptive-v1.plan": { action: "plan", authority: "proposal-only" },
  "bi.preview.create": { action: "preview", authority: "proposal-only" },
  "bi.readback.read": { action: "readback", authority: "read-only" },
} as const;

function verified(): ExternalBiServiceConfigDecisionV2 {
  const decision = configureExternalBiServiceV2(goodEnv);
  assert.equal(decision.outcome, "VERIFIED");
  return decision;
}

function signedAttestation(overrides: Record<string, unknown> = {}) {
  const body = {
    schemaVersion: "superset-bi-agent.external/capability-attestation/v2",
    product: { id: "superset-bi-agent", version: "v0.8.0", component: "bi-agent-runtime" },
    contract: { id: "superset-bi-agent.external", version: "2.0.0" },
    capabilities: EXTERNAL_BI_SERVICE_CAPABILITIES_V2.map((id) => ({ id, ...descriptor[id] })),
    graph: { acceptedIncumbent: "adaptive-v1", candidatePromotion: "none" },
    boundaries: { sourceDatabaseCredentialsAccepted: false, freeSqlAccepted: false, rawSourceRowsReturned: false, modelMutationAuthority: false, directSupersetMutationIntentAccepted: false, persistentSupersetWorkflow: "trusted-preview-approval-apply-readback-rollback-only" },
    ...overrides,
  };
  return { ...body, attestation: { algorithm: "sha256-canonical-json", digest: sha256(body) } };
}

function signedResult(attestationDigest: string, requestId: string, action: string, result: Record<string, unknown> = {}) {
  const body = {
    schemaVersion: "superset-bi-agent.external/intent-result/v2", requestId, action,
    runtime: { product: { id: "superset-bi-agent", version: "v0.8.0", component: "bi-agent-runtime" }, contract: { id: "superset-bi-agent.external", version: "2.0.0" } },
    capabilityAttestationDigest: attestationDigest,
    result: action === "status" ? { status: "READY", engine: "mssql", sourceMode: "fixture", catalogReady: true, ...result } : result,
  };
  return { ...body, integrity: { algorithm: "sha256-canonical-json", digest: sha256(body) } };
}

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function fakeFetch(attestation = signedAttestation(), capture: Array<{ url: string; init?: RequestInit }> = []): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    capture.push(init === undefined ? { url } : { url, init });
    if (url.endsWith("/v2/capabilities")) return response(attestation);
    if (url.endsWith("/v2/intents")) {
      const request = JSON.parse(String(init?.body));
      return response(signedResult(attestation.attestation.digest, request.requestId, request.action, { receiptId: "fixture-receipt", proposalOnly: true }));
    }
    return response({ code: "UNEXPECTED_ROUTE" }, 404);
  }) as typeof fetch;
}

test("v2 config is default-off and rejects direct Superset ownership", () => {
  assert.equal(configureExternalBiServiceV2({}).outcome, "DISABLED");
  assert.deepEqual(configureExternalBiServiceV2({ ...goodEnv, SUPERSET_BASE_URL: "http://127.0.0.1:18088" }), {
    outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_DIRECT_SUPERSET_CONFIG_DENIED"],
  });
});

test("v2 config pins exact product/contract, bounded timeout and a credential-free root URL", () => {
  const cases = [
    [{ ...goodEnv, BI_AGENT_EXPECTED_PRODUCT_VERSION: "v0.8.1" }, "EXTERNAL_BI_SERVICE_PRODUCT_VERSION_DENIED"],
    [{ ...goodEnv, BI_AGENT_EXPECTED_CONTRACT_VERSION: "2.0.1" }, "EXTERNAL_BI_SERVICE_CONTRACT_VERSION_DENIED"],
    [{ ...goodEnv, BI_AGENT_TIMEOUT_MS: "99" }, "EXTERNAL_BI_SERVICE_TIMEOUT_DENIED"],
    [{ ...goodEnv, BI_AGENT_BASE_URL: ["http://user", ":pass@127.0.0.1:18790"].join("") }, "EXTERNAL_BI_SERVICE_URL_DENIED"],
    [{ ...goodEnv, BI_AGENT_BASE_URL: "http://169.254.169.254" }, "EXTERNAL_BI_SERVICE_URL_DENIED"],
    [{ ...goodEnv, BI_AGENT_BASE_URL: "http://127.0.0.1:18790/api" }, "EXTERNAL_BI_SERVICE_URL_DENIED"],
  ] as const;
  for (const [env, code] of cases) {
    const result = configureExternalBiServiceV2(env);
    assert.equal(result.outcome, "DENIED");
    if (result.outcome === "DENIED") assert.deepEqual(result.reasonCodes, [code]);
  }
});

test("v2 client accepts a digest-bound v0.8.0 / 2.0.0 attestation and status", async () => {
  const result = await probeExternalBiServiceV2(verified(), fakeFetch());
  assert.equal(result.outcome, "VERIFIED");
  if (result.outcome === "VERIFIED") assert.equal(result.readback.directSupersetAccessByCm, false);
});

test("thin v2 client forwards only the six high-level intents to SBA and validates every envelope", async () => {
  const actions = ["status", "discovery", "analyze", "plan", "preview", "readback"] as const;
  const capture: Array<{ url: string; init?: RequestInit }> = [];
  for (const action of actions) {
    const result = await invokeExternalBiServiceV2(verified(), {
      requestId: `cm-${action}`,
      action,
      ...(action === "discovery" ? { input: { command: "start", sessionId: "cm-cleanroom" } }
        : action === "plan" || action === "preview" ? { input: { objective: "Review weekly order value", receiptId: "fixture-receipt" } }
          : {}),
    }, fakeFetch(signedAttestation(), capture));
    assert.equal(result.outcome, "VERIFIED", action);
  }
  assert(capture.every(({ url }) => url.startsWith("http://127.0.0.1:18790/v2/")));
  assert(capture.every(({ url }) => !/superset|18088/i.test(new URL(url).pathname)));
  const serialized = JSON.stringify(capture);
  assert.doesNotMatch(serialized, /authorization|bearer|password|credential|rawRows|SELECT\s/i);
});

test("draft negative: wrong server-attested product version is denied", async () => {
  const result = await probeExternalBiServiceV2(verified(), fakeFetch(signedAttestation({ product: { id: "superset-bi-agent", version: "v0.8.1", component: "bi-agent-runtime" } })));
  assert.deepEqual(result, { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_PRODUCT_VERSION_DENIED"] });
});

test("negative: wrong server-attested contract version is denied", async () => {
  const result = await probeExternalBiServiceV2(verified(), fakeFetch(signedAttestation({ contract: { id: "superset-bi-agent.external", version: "2.0.1" } })));
  assert.deepEqual(result, { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_CONTRACT_VERSION_DENIED"] });
});

test("draft negative: missing required capability is denied", async () => {
  const capabilities = EXTERNAL_BI_SERVICE_CAPABILITIES_V2.slice(1).map((id) => ({ id, ...descriptor[id] }));
  const result = await probeExternalBiServiceV2(verified(), fakeFetch(signedAttestation({ capabilities })));
  assert.deepEqual(result, { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_CAPABILITY_MISSING"] });
});

test("draft negative: attestation digest tamper is denied", async () => {
  const attestation = signedAttestation();
  attestation.graph.acceptedIncumbent = "tampered";
  const result = await probeExternalBiServiceV2(verified(), fakeFetch(attestation));
  assert.deepEqual(result, { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_DIGEST_DENIED"] });
});

test("draft negative: unreachable service is typed unavailable", async () => {
  const unreachable = (async () => { throw new TypeError("unreachable"); }) as typeof fetch;
  const result = await probeExternalBiServiceV2(verified(), unreachable);
  assert.deepEqual(result, { outcome: "UNAVAILABLE", reasonCodes: ["EXTERNAL_BI_SERVICE_UNAVAILABLE"] });
});

test("negative: malformed attestation and malformed intent payloads fail closed", async () => {
  const malformedAttestation = (async () => new Response("{", { status: 200 })) as typeof fetch;
  assert.deepEqual(await probeExternalBiServiceV2(verified(), malformedAttestation), {
    outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_ATTESTATION_MALFORMED"],
  });

  const attestation = signedAttestation();
  const malformedIntent = (async (input: string | URL | Request) => String(input).endsWith("/v2/capabilities")
    ? response(attestation)
    : new Response("{", { status: 200 })) as typeof fetch;
  assert.deepEqual(await probeExternalBiServiceV2(verified(), malformedIntent), {
    outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_RESPONSE_MALFORMED"],
  });
});

test("negative: status response tamper and attestation-binding drift are denied", async () => {
  const attestation = signedAttestation();
  const tampered = signedResult(attestation.attestation.digest, "cm-external-bi-probe", "status");
  tampered.result.status = "NOT_READY";
  const tamperedFetch = (async (input: string | URL | Request) => String(input).endsWith("/v2/capabilities")
    ? response(attestation) : response(tampered)) as typeof fetch;
  assert.deepEqual(await probeExternalBiServiceV2(verified(), tamperedFetch), {
    outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_DIGEST_DENIED"],
  });

  const rebound = signedResult("sha256:" + "0".repeat(64), "cm-external-bi-probe", "status");
  const reboundFetch = (async (input: string | URL | Request) => String(input).endsWith("/v2/capabilities")
    ? response(attestation) : response(rebound)) as typeof fetch;
  assert.deepEqual(await probeExternalBiServiceV2(verified(), reboundFetch), {
    outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_DIGEST_DENIED"],
  });
});

test("negative: timeout is typed unavailable", async () => {
  const decision = configureExternalBiServiceV2({ BI_AGENT_BASE_URL: "http://127.0.0.1:18790", BI_AGENT_TIMEOUT_MS: "100" });
  const timeoutFetch = (async (_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  })) as typeof fetch;
  assert.deepEqual(await probeExternalBiServiceV2(decision, timeoutFetch), {
    outcome: "UNAVAILABLE", reasonCodes: ["EXTERNAL_BI_SERVICE_UNAVAILABLE"],
  });
});

test("negative: denied action, direct route metadata, credentials, raw rows and SQL never reach fetch", async () => {
  const probes = [
    { requestId: "deny-action", action: "publish" },
    { requestId: "deny-url", action: "plan", input: { objective: "Review weekly orders", url: "http://127.0.0.1:18088" } },
    { requestId: "deny-password", action: "discovery", input: { password: "not-forwarded" } },
    { requestId: "deny-rows", action: "analyze", input: { rawRows: [{ id: 1 }] } },
    { requestId: "deny-sql", action: "plan", input: { objective: "SELECT all orders" } },
  ] as const;
  for (const probe of probes) {
    let calls = 0;
    const neverFetch = (async () => { calls += 1; throw new Error("must not fetch"); }) as typeof fetch;
    const result = await invokeExternalBiServiceV2(verified(), probe as never, neverFetch);
    assert.equal(result.outcome, "DENIED");
    assert.equal(calls, 0);
  }
});
