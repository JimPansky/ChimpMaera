#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  canonicalJson,
  configureExternalBiServiceV2,
  invokeExternalBiServiceV2,
  probeExternalBiServiceV2,
} from "../dist/packages/contracts/src/index.js";

const fixture = JSON.parse(await readFile(new URL("../tests/fixtures/external-bi-service-v2-clean-room.json", import.meta.url), "utf8"));
const baseUrl = process.argv[2] ?? fixture.biAgentBaseUrl;
const decision = configureExternalBiServiceV2({ BI_AGENT_BASE_URL: baseUrl, BI_AGENT_TIMEOUT_MS: "30000" });
assert.equal(decision.outcome, "VERIFIED");

const cmFetchTargets = [];
const auditedFetch = async (input, init) => {
  cmFetchTargets.push(String(input));
  return fetch(input, init);
};

const probe = await probeExternalBiServiceV2(decision, auditedFetch);
assert.equal(probe.outcome, fixture.expectedOutcome);
if (probe.outcome !== "VERIFIED") throw new Error(JSON.stringify(probe));
assert.equal(probe.readback.productVersion, fixture.expectedProductVersion);
assert.equal(probe.readback.contractVersion, fixture.expectedContractVersion);
assert.deepEqual(probe.readback.capabilities, fixture.requiredCapabilities);
assert.equal(probe.readback.directSupersetAccessByCm, fixture.expectedDirectSupersetAccessByCm);

async function invoke(requestId, action, input) {
  const result = await invokeExternalBiServiceV2(
    decision,
    { requestId, action, ...(input === undefined ? {} : { input }) },
    auditedFetch,
  );
  assert.equal(result.outcome, "VERIFIED", `${action}: ${JSON.stringify(result)}`);
  if (result.outcome !== "VERIFIED") throw new Error(JSON.stringify(result));
  return result.readback.result;
}

const status = await invoke("cm-g6-status", "status");
assert.equal(status.status, "READY");
const discovery = await invoke("cm-g6-discovery", "discovery", { command: "start", sessionId: "cm-g6-cleanroom" });
const analysis = await invoke("cm-g6-analyze", "analyze");
assert.equal(analysis.safety?.rawSourceRowsReturned, false);
assert.equal(analysis.safety?.credentialsReturned, false);
assert.equal(typeof analysis.receiptId, "string");
const plan = await invoke("cm-g6-plan", "plan", { objective: "Review weekly order value and coverage", receiptId: analysis.receiptId });
assert.equal(plan.graph?.acceptedIncumbent, "adaptive-v1");
assert.equal(plan.authority?.persistentActionAllowed, false);
const preview = await invoke("cm-g6-preview", "preview", { objective: "Preview weekly order value and coverage", receiptId: analysis.receiptId });
assert.equal(preview.authority?.proposalOnly, true);
assert.equal(preview.authority?.applyPerformed, false);
assert.equal(preview.authority?.approvalRequiredBeforePersistence, true);
const readback = await invoke("cm-g6-readback", "readback");
assert.equal(readback.superset?.status, fixture.expectedSupersetReadback);
assert.equal(readback.disclosure?.rawSourceRowsReturned, false);
assert.equal(readback.disclosure?.credentialsReturned, false);
assert.equal(readback.disclosure?.freeSqlReturned, false);

const sha256 = (value) => `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
const response = (value, statusCode = 200) => new Response(JSON.stringify(value), { status: statusCode, headers: { "content-type": "application/json" } });

async function modifiedLiveFetch(input, init, route, mutate, resign = false) {
  const live = await fetch(input, init);
  if (!String(input).endsWith(route)) return live;
  const value = await live.json();
  mutate(value);
  if (resign && route === "/v2/capabilities") {
    const body = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "attestation"));
    value.attestation = { algorithm: "sha256-canonical-json", digest: sha256(body) };
  }
  return response(value, live.status);
}

const negative = [];
async function expectProbe(name, fetchImpl, outcome, code, customDecision = decision) {
  const result = await probeExternalBiServiceV2(customDecision, fetchImpl);
  assert.equal(result.outcome, outcome, `${name}: ${JSON.stringify(result)}`);
  assert.deepEqual(result.reasonCodes, [code], name);
  negative.push({ name, outcome, code });
}

await expectProbe("wrong-version", (input, init) => modifiedLiveFetch(input, init, "/v2/capabilities", (value) => { value.product.version = "v0.8.1"; }), "DENIED", "EXTERNAL_BI_SERVICE_PRODUCT_VERSION_DENIED");
await expectProbe("contract-mismatch", (input, init) => modifiedLiveFetch(input, init, "/v2/capabilities", (value) => { value.contract.version = "2.0.1"; }), "DENIED", "EXTERNAL_BI_SERVICE_CONTRACT_VERSION_DENIED");
await expectProbe("capability-missing", (input, init) => modifiedLiveFetch(input, init, "/v2/capabilities", (value) => { value.capabilities = value.capabilities.filter(({ id }) => id !== "bi.readback.read"); }, true), "DENIED", "EXTERNAL_BI_SERVICE_CAPABILITY_MISSING");
await expectProbe("attestation-digest-tamper", (input, init) => modifiedLiveFetch(input, init, "/v2/capabilities", (value) => { value.graph.acceptedIncumbent = "tampered"; }), "DENIED", "EXTERNAL_BI_SERVICE_DIGEST_DENIED");
await expectProbe("response-digest-tamper", (input, init) => modifiedLiveFetch(input, init, "/v2/intents", (value) => { value.result.status = "TAMPERED"; }), "DENIED", "EXTERNAL_BI_SERVICE_DIGEST_DENIED");
await expectProbe("malformed-payload", async () => new Response("{", { status: 200 }), "DENIED", "EXTERNAL_BI_SERVICE_ATTESTATION_MALFORMED");

const unavailableDecision = configureExternalBiServiceV2({ BI_AGENT_BASE_URL: fixture.unreachableBiAgentBaseUrl, BI_AGENT_TIMEOUT_MS: "500" });
await expectProbe("unreachable", fetch, "UNAVAILABLE", "EXTERNAL_BI_SERVICE_UNAVAILABLE", unavailableDecision);
const timeoutDecision = configureExternalBiServiceV2({ BI_AGENT_BASE_URL: baseUrl, BI_AGENT_TIMEOUT_MS: "100" });
const timeoutFetch = async (_input, init) => new Promise((_resolve, reject) => {
  const signal = init?.signal;
  const hold = setTimeout(() => reject(new Error("timeout signal did not fire")), 1000);
  const rejectFromSignal = () => {
    clearTimeout(hold);
    reject(signal?.reason ?? new Error("request aborted"));
  };
  if (signal?.aborted) rejectFromSignal();
  else signal?.addEventListener("abort", rejectFromSignal, { once: true });
});
await expectProbe("timeout", timeoutFetch, "UNAVAILABLE", "EXTERNAL_BI_SERVICE_UNAVAILABLE", timeoutDecision);

let deniedFetchCalls = 0;
const deniedIntent = await invokeExternalBiServiceV2(decision, { requestId: "cm-g6-denied", action: "publish" }, async () => {
  deniedFetchCalls += 1;
  throw new Error("denied intent reached fetch");
});
assert.deepEqual(deniedIntent, { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_ACTION_DENIED"] });
assert.equal(deniedFetchCalls, 0);
negative.push({ name: "denied-intent", outcome: "DENIED", code: "EXTERNAL_BI_SERVICE_ACTION_DENIED" });

function assertNoSensitiveMaterial(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveMaterial(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value === "boolean" || typeof value === "number") return;
  if (typeof value === "string") {
    assert.doesNotMatch(value, /must-not-cross|Bearer\s+[A-Za-z0-9]|\bSELECT\s+.+\s+FROM\b/i, path);
    return;
  }
  assert.equal(typeof value, "object", path);
  for (const [key, item] of Object.entries(value)) {
    const compactKey = key.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
    if (["credentialvalue", "password", "passwd", "secret", "authorization", "cookie", "rawrows"].includes(compactKey)) {
      assert.ok(item === false || item === null, `${path}.${key} contains sensitive material`);
      continue;
    }
    assertNoSensitiveMaterial(item, `${path}.${key}`);
  }
}

const liveReadbacks = { status, analysis, discovery, plan, preview, readback };
assertNoSensitiveMaterial(liveReadbacks);
assert.doesNotMatch(JSON.stringify(liveReadbacks), /supersetBaseUrl/i);
const expectedOrigin = new URL(baseUrl).origin;
assert.ok(cmFetchTargets.length >= 14);
for (const target of cmFetchTargets) {
  const parsed = new URL(target);
  assert.equal(parsed.origin, expectedOrigin);
  assert.ok(["/v2/capabilities", "/v2/intents"].includes(parsed.pathname));
}

process.stdout.write(`${JSON.stringify({
  status: "PASS",
  productVersion: probe.readback.productVersion,
  contractVersion: probe.readback.contractVersion,
  intentChain: ["status", "discovery", "analyze", "plan", "preview", "readback"],
  receiptId: analysis.receiptId,
  graphIncumbent: plan.graph.acceptedIncumbent,
  previewProposalOnly: preview.authority.proposalOnly,
  supersetReadback: readback.superset.status,
  negativeMatrix: negative,
  rawSourceRowsReturned: false,
  credentialsReturned: false,
  directSupersetAccessByCm: false,
  sqlForwardedByCm: false,
  mutationOrPublishPerformed: false,
}, null, 2)}\n`);
