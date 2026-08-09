import { createHash } from "node:crypto";
import {
  admitCapabilityExecutionAtGatewayV1,
  executeCapabilityAtBrokerV1,
  syntheticCapabilityActivationV1,
  syntheticCapabilityCatalogueV1,
  syntheticCapabilityExecutionRequestV1,
  syntheticCapabilityPolicyBindingV1,
} from "../../packages/contracts/src/capability-catalogue.ts";
import { canonicalJson } from "../../packages/contracts/src/canonical-json.js";

export const OBSERVED_AT = "2026-08-09T12:00:00Z";
export const canonicalCatalogue = syntheticCapabilityCatalogueV1();
export const canonicalPolicy = syntheticCapabilityPolicyBindingV1();
export const canonicalActivation = syntheticCapabilityActivationV1(canonicalCatalogue, "crm.contact.create");

function digest(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function redigest(value) {
  const draft = structuredClone(value);
  delete draft.digest;
  draft.digest = digest(draft);
  return draft;
}

export function admitWithCanonicalFixtures(request, { activation = canonicalActivation, policy = canonicalPolicy } = {}) {
  return admitCapabilityExecutionAtGatewayV1(
    canonicalCatalogue, activation, policy, request, OBSERVED_AT,
  );
}

export function brokerWithSyntheticResponse(request, response, { receipts = new Map() } = {}) {
  const decision = admitWithCanonicalFixtures(request);
  let effects = 0;
  const receipt = executeCapabilityAtBrokerV1(
    canonicalCatalogue,
    canonicalActivation,
    canonicalPolicy,
    decision,
    OBSERVED_AT,
    receipts,
    { prepare: () => ({ response, commit: () => { effects += 1; } }) },
    { nowMs: () => 0 },
  );
  return { decision, receipt, effects };
}

export function receiptForDecision(decision, response) {
  return executeCapabilityAtBrokerV1(
    canonicalCatalogue,
    canonicalActivation,
    canonicalPolicy,
    decision,
    OBSERVED_AT,
    new Map(),
    { prepare: () => ({ response, commit: () => {} }) },
    { nowMs: () => 0 },
  );
}

export function canonicalRequestFor({ correlationId, requestId, workloadIdentity }) {
  return {
    ...syntheticCapabilityExecutionRequestV1(canonicalCatalogue, "crm.contact.create", canonicalPolicy),
    correlationId,
    requestId,
    workloadIdentity,
  };
}

export function durableSnapshotAt(state, phase, validate, run) {
  let durable = structuredClone(state);
  let latched = false;
  const persist = () => {
    validate(state);
    if (!latched) durable = structuredClone(state);
    const reservation = Object.values(state.openclawM14InFlight)[0];
    if (phase === "RESERVED" && reservation?.status === "RESERVED") {
      latched = true;
      throw new Error("HARNESS_PROCESS_STOP_AFTER_RESERVATION");
    }
    if (phase === "COMMITTED" && reservation?.status === "COMMITTED") {
      latched = true;
      throw new Error("HARNESS_PROCESS_STOP_AFTER_COMMIT");
    }
  };
  try { run(persist); } catch (error) {
    if (!String(error?.message).startsWith("HARNESS_PROCESS_STOP_")) throw error;
  }
  return durable;
}
