import {
  OPENCLAW_M14_GATEWAY_RESPONSE_SCHEMA,
  digest,
  openClawM14ExpectedPublicBindings,
} from "../capability-m1-4-adapter.mjs";

const RESULT_SCHEMA = "chimpmaera.openclaw-m1.4/sanitized-result/v2";
const EVIDENCE_TYPE = "SYNTHETIC_MEMORY_DIGEST_REFERENCE";
const REPLAY_STATES = new Set([
  "FIRST_EXECUTION",
  "RECOVERED_AUTHORITATIVE_READBACK",
  "RECOVERED_SAME_RECEIPT",
]);
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const RESPONSE_KEYS = ["responseDigest", "result", "schemaVersion", "status"];
const RESULT_KEYS = [
  "actionDigest", "actionId", "catalogueDigest", "catalogueVersion", "correlationDigest",
  "decisionDigest", "effectCount", "effectState", "evidenceRef", "outcome", "policyDigest",
  "policyGeneration", "providerResponseDigest", "readbackDigest", "receiptDigest", "replayState",
  "requestDigest", "requestIdDigest", "schemaVersion", "tenantDigest", "workloadIdentityDigest",
];
const EVIDENCE_KEYS = ["decisionDigest", "readbackDigest", "receiptDigest", "sinkDigest", "type"];
const RESULT_DIGEST_KEYS = RESULT_KEYS.filter((key) => key.endsWith("Digest"));
const EVIDENCE_DIGEST_KEYS = EVIDENCE_KEYS.filter((key) => key.endsWith("Digest"));

function exactKeys(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys);
}

function invalid() {
  throw new Error("CM_GATEWAY_RESPONSE_INVALID_DENIED");
}

export function validateOpenClawM14GatewayResponse(value, {
  correlationId,
  requestId,
  workloadContract,
} = {}) {
  if (!exactKeys(value, RESPONSE_KEYS)
    || !exactKeys(value.result, RESULT_KEYS)
    || !exactKeys(value.result.evidenceRef, EVIDENCE_KEYS)) invalid();
  const result = value.result;
  const evidence = result.evidenceRef;
  let expected;
  try {
    expected = openClawM14ExpectedPublicBindings({
      correlationId,
      requestId,
      workloadIdentity: workloadContract?.identity?.subject,
    });
  } catch {
    invalid();
  }
  const { responseDigest, ...responseCore } = value;
  if (value.schemaVersion !== OPENCLAW_M14_GATEWAY_RESPONSE_SCHEMA
    || value.status !== "PASS"
    || responseDigest !== digest(responseCore)
    || result.schemaVersion !== RESULT_SCHEMA
    || !REPLAY_STATES.has(result.replayState)
    || result.outcome !== "SYNTHETIC_EFFECT_READBACK_VERIFIED"
    || result.effectCount !== 1
    || result.effectState !== "CONFIRMED_ONE"
    || result.actionId !== expected.actionId
    || result.catalogueVersion !== expected.catalogueVersion
    || result.catalogueDigest !== expected.catalogueDigest
    || result.actionDigest !== expected.actionDigest
    || result.policyGeneration !== expected.policyGeneration
    || result.policyDigest !== expected.policyDigest
    || result.workloadIdentityDigest !== expected.workloadIdentityDigest
    || result.tenantDigest !== expected.tenantDigest
    || result.requestIdDigest !== expected.requestIdDigest
    || result.requestDigest !== expected.requestDigest
    || result.correlationDigest !== expected.correlationDigest
    || result.decisionDigest !== expected.decisionDigest
    || result.receiptDigest !== expected.receiptDigest
    || result.providerResponseDigest !== expected.providerResponseDigest
    || result.readbackDigest !== expected.readbackDigest
    || evidence.type !== EVIDENCE_TYPE
    || evidence.sinkDigest !== expected.evidenceSinkDigest
    || evidence.decisionDigest !== result.decisionDigest
    || evidence.receiptDigest !== result.receiptDigest
    || evidence.readbackDigest !== result.readbackDigest
    || !RESULT_DIGEST_KEYS.every((key) => DIGEST_PATTERN.test(result[key]))
    || !EVIDENCE_DIGEST_KEYS.every((key) => DIGEST_PATTERN.test(evidence[key]))) invalid();
  return value;
}
