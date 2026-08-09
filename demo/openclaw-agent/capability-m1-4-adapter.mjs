import { createHash } from "node:crypto";
import { canonicalJson } from "../../packages/contracts/src/canonical-json.js";
import { canonicalOpenClawM14CorrelationId } from "./plugin/identity-v2.mjs";
import {
  admitCapabilityExecutionAtGatewayV1,
  executeCapabilityAtBrokerV1,
  syntheticCapabilityActivationV1,
  syntheticCapabilityCatalogueV1,
  syntheticCapabilityExecutionRequestV1,
  syntheticCapabilityPolicyBindingV1,
  verifyCapabilityGatewayDecisionV1,
} from "../../packages/contracts/src/capability-catalogue.ts";

export const OPENCLAW_M14_REQUEST_SCHEMA = "chimpmaera.security/capability-execution-request/v1";
export const OPENCLAW_M14_GATEWAY_RESPONSE_SCHEMA = "chimpmaera.openclaw-m1.4/gateway-broker-response/v1";
export const OPENCLAW_M14_DENIAL_SCHEMA = "chimpmaera.openclaw-m1.4/gateway-denial/v1";
export const OPENCLAW_M14_STATE_SCHEMA = "chimpmaera.openclaw-m1.4/effect-state/v3";
export const OPENCLAW_M14_RESERVATION_SCHEMA = "chimpmaera.openclaw-m1.4/effect-reservation/v2";
export const OPENCLAW_M14_AUTHORIZATION_BINDING_SCHEMA = "chimpmaera.openclaw-m1.4/authorization-binding/v1";
export const OPENCLAW_M14_OBSERVED_AT = "2026-08-09T12:00:00Z";
export const OPENCLAW_M14_USER_IDENTITY = "user:synthetic-operator";

export { canonicalJson };

export function digest(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

const CATALOGUE = syntheticCapabilityCatalogueV1();
const POLICY = syntheticCapabilityPolicyBindingV1();
const ACTIVATION = syntheticCapabilityActivationV1(CATALOGUE, "crm.contact.create");
const ACTION = CATALOGUE.actions.find((candidate) => candidate.actionId === "crm.contact.create");
if (ACTION === undefined) throw new Error("OPENCLAW_M14_CANONICAL_ACTION_MISSING_DENIED");
const EVIDENCE_SINK = Object.freeze({ type: "SYNTHETIC_MEMORY", sinkId: "evidence:synthetic-memory" });
const FIXTURE_RESPONSE = Object.freeze({ contactId: "synthetic-contact-001" });
const REQUEST_PATTERN = /^request:openclaw-m14-[a-z0-9-]{4,40}$/;

function exactObject(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join("\n") === [...keys].sort().join("\n");
}

function safeDigest(value) {
  try { return digest(value); } catch { return null; }
}

function deny(code, readback = {}) {
  const safeDigestField = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : null;
  const safeVersion = (value) => typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value) ? value : null;
  const core = {
    schemaVersion: OPENCLAW_M14_DENIAL_SCHEMA,
    status: "DENY",
    code,
    catalogueVersion: safeVersion(readback.catalogueVersion),
    catalogueDigest: safeDigestField(readback.catalogueDigest),
    actionId: ["crm.contact.create", "erp.order.create"].includes(readback.actionId) ? readback.actionId : null,
    actionVersion: safeVersion(readback.actionVersion),
    actionDigest: safeDigestField(readback.actionDigest),
    correlationDigest: typeof readback.correlationId === "string" ? digest(readback.correlationId) : null,
    requestDigest: readback.request === undefined ? null : safeDigest(readback.request),
    effectCount: 0,
  };
  return { ...core, denialDigest: digest(core) };
}

export function sanitizedOpenClawM14Denial(error, correlationId) {
  const candidate = typeof error?.code === "string" ? error.code : error?.message;
  const code = typeof candidate === "string" && /^[A-Z0-9_]+_DENIED$/.test(candidate)
    ? candidate
    : "REQUEST_DENIED";
  return deny(code, { correlationId });
}

function authorizationIssue(request, authorization, runtime) {
  if (!exactObject(authorization, ["correlationId", "identity", "network", "schemaVersion", "status"])
    || authorization.status !== "ALLOW"
    || authorization.schemaVersion !== "chimpmaera.openclaw/gateway-authorization-result/v2") {
    return "IDENTITY_MISSING_DENIED";
  }
  const identity = authorization.identity;
  if (!exactObject(identity, ["audience", "expiresAt", "issuedAt", "scope", "subject", "tenant"])
    || !exactObject(authorization.network, ["host", "method", "path", "port", "protocol"])) {
    return "IDENTITY_MISSING_DENIED";
  }
  if (request.workloadIdentity !== runtime.identity.subject || identity?.subject !== runtime.identity.subject
    || request.workloadIdentity !== identity.subject) return "IDENTITY_SUBJECT_DENIED";
  if (request.tenant !== runtime.identity.tenant || identity.tenant !== runtime.identity.tenant) return "CROSS_TENANT_DENIED";
  if (identity.audience !== runtime.identity.audience) return "IDENTITY_AUDIENCE_DENIED";
  if (canonicalJson(identity.scope) !== canonicalJson(runtime.identity.scope)) return "IDENTITY_SCOPE_DENIED";
  let expectedCorrelation;
  try { expectedCorrelation = canonicalOpenClawM14CorrelationId(request.requestId); } catch {
    return "CORRELATION_MISSING_DENIED";
  }
  if (authorization.correlationId !== request.correlationId
    || request.correlationId !== expectedCorrelation) return "CORRELATION_MISSING_DENIED";
  const target = runtime.networkPolicy.egress.allow[0];
  if (authorization.network?.path !== runtime.identity.route || authorization.network?.path !== target?.path
    || authorization.network?.method !== target?.method || authorization.network?.host !== target?.host
    || authorization.network?.port !== target?.port || authorization.network?.protocol !== target?.protocol) {
    return "ROUTE_DENIED";
  }
  const now = Date.parse(runtime.clock.now);
  const canonicalExpiry = Number.isFinite(now) && Number.isInteger(runtime.clock.maxTtlSeconds)
    ? new Date(now + runtime.clock.maxTtlSeconds * 1000).toISOString()
    : null;
  if (identity.issuedAt !== runtime.clock.now || identity.expiresAt !== canonicalExpiry) {
    return "IDENTITY_EXPIRED_DENIED";
  }
  return null;
}

function authorizationBindingFor(authorization, runtime) {
  const core = {
    schemaVersion: OPENCLAW_M14_AUTHORIZATION_BINDING_SCHEMA,
    authorizationSchemaVersion: authorization.schemaVersion,
    status: authorization.status,
    subject: authorization.identity.subject,
    audience: authorization.identity.audience,
    tenant: authorization.identity.tenant,
    scope: [...authorization.identity.scope],
    issuedAt: authorization.identity.issuedAt,
    expiresAt: authorization.identity.expiresAt,
    correlationId: authorization.correlationId,
    correlationDigest: digest(authorization.correlationId),
    network: structuredClone(authorization.network),
    workloadContractDigest: digest(runtime),
  };
  return { ...core, bindingDigest: digest(core) };
}

function canonicalRequest({ correlationId, requestId, workloadIdentity }) {
  const request = syntheticCapabilityExecutionRequestV1(CATALOGUE, "crm.contact.create", POLICY);
  return { ...request, correlationId, requestId, workloadIdentity, userIdentity: OPENCLAW_M14_USER_IDENTITY };
}

export function syntheticOpenClawM14Request({ correlationId, workloadIdentity, requestId = "request:openclaw-m14-0001" }) {
  if (typeof workloadIdentity !== "string") throw new Error("OPENCLAW_M14_WORKLOAD_IDENTITY_REQUIRED_DENIED");
  return canonicalRequest({ correlationId, requestId, workloadIdentity });
}

export function openClawM14ExpectedPublicBindings({ correlationId, requestId, workloadIdentity }) {
  const request = canonicalRequest({ correlationId, requestId, workloadIdentity });
  const decision = admitCapabilityExecutionAtGatewayV1(
    CATALOGUE, ACTIVATION, POLICY, request, OPENCLAW_M14_OBSERVED_AT,
  );
  if (decision.outcome !== "ALLOW" || decision.ticket === null) {
    throw new Error("OPENCLAW_M14_EXPECTED_DECISION_INVALID_DENIED");
  }
  const receipt = canonicalReceipt(decision, FIXTURE_RESPONSE);
  if (receipt.outcome !== "EXECUTED") throw new Error("OPENCLAW_M14_EXPECTED_RECEIPT_INVALID_DENIED");
  return {
    actionId: ACTION.actionId,
    catalogueVersion: CATALOGUE.version,
    catalogueDigest: CATALOGUE.digest,
    actionDigest: ACTION.digest,
    policyGeneration: POLICY.version,
    policyDigest: POLICY.digest,
    workloadIdentityDigest: digest(workloadIdentity),
    tenantDigest: digest(request.tenant),
    requestIdDigest: digest(requestId),
    requestDigest: digest(request.request),
    correlationDigest: digest(correlationId),
    decisionDigest: decision.decisionDigest,
    receiptDigest: receipt.receiptDigest,
    providerResponseDigest: digest(FIXTURE_RESPONSE),
    readbackDigest: digest(FIXTURE_RESPONSE),
    evidenceSinkDigest: digest(EVIDENCE_SINK.sinkId),
  };
}

function publicResponse(request, decision, receipt, replayState, readback) {
  const readbackDigest = digest(readback);
  const evidenceRef = {
    type: "SYNTHETIC_MEMORY_DIGEST_REFERENCE",
    sinkDigest: digest(decision.ticket.evidenceSink.sinkId),
    decisionDigest: decision.decisionDigest,
    receiptDigest: receipt.receiptDigest,
    readbackDigest,
  };
  const core = {
    schemaVersion: OPENCLAW_M14_GATEWAY_RESPONSE_SCHEMA,
    status: "PASS",
    result: {
      schemaVersion: "chimpmaera.openclaw-m1.4/sanitized-result/v2",
      replayState,
      outcome: "SYNTHETIC_EFFECT_READBACK_VERIFIED",
      effectCount: 1,
      effectState: "CONFIRMED_ONE",
      actionId: ACTION.actionId,
      catalogueVersion: CATALOGUE.version,
      catalogueDigest: CATALOGUE.digest,
      actionDigest: ACTION.digest,
      policyGeneration: POLICY.version,
      policyDigest: POLICY.digest,
      workloadIdentityDigest: digest(request.workloadIdentity),
      tenantDigest: digest(request.tenant),
      requestIdDigest: digest(request.requestId),
      requestDigest: decision.requestDigest,
      correlationDigest: decision.correlationDigest,
      decisionDigest: decision.decisionDigest,
      receiptDigest: receipt.receiptDigest,
      providerResponseDigest: receipt.responseDigest,
      readbackDigest,
      evidenceRef,
    },
  };
  return { ...core, responseDigest: digest(core) };
}

function canonicalReceipt(decision, response, commit = () => {}) {
  return executeCapabilityAtBrokerV1(
    CATALOGUE,
    ACTIVATION,
    POLICY,
    decision,
    OPENCLAW_M14_OBSERVED_AT,
    new Map(),
    { prepare: () => ({ response, commit }) },
    { nowMs: () => 0 },
  );
}

function reservationFor(request, decision, authorizationBinding, effectOrdinal) {
  return {
    schemaVersion: OPENCLAW_M14_RESERVATION_SCHEMA,
    status: "RESERVED",
    requestId: request.requestId,
    workloadIdentity: request.workloadIdentity,
    tenant: request.tenant,
    policyGeneration: POLICY.version,
    requestDigest: decision.requestDigest,
    correlationDigest: decision.correlationDigest,
    authorizationBinding,
    decision,
    response: null,
    readback: null,
    readbackDigest: null,
    effectOrdinal,
  };
}

function effectRecord(reservation, receipt) {
  return {
    schemaVersion: OPENCLAW_M14_STATE_SCHEMA,
    requestId: reservation.requestId,
    workloadIdentity: reservation.workloadIdentity,
    tenant: reservation.tenant,
    policyGeneration: reservation.policyGeneration,
    requestDigest: reservation.requestDigest,
    correlationDigest: reservation.correlationDigest,
    authorizationBinding: reservation.authorizationBinding,
    decision: reservation.decision,
    receipt,
    readback: reservation.readback,
    readbackDigest: reservation.readbackDigest,
    effectOrdinal: reservation.effectOrdinal,
    replayStateForRetry: "RECOVERED_SAME_RECEIPT",
  };
}

function reconcileCommitted(state, request, reservation, persist) {
  const receipt = canonicalReceipt(reservation.decision, reservation.readback);
  if (receipt.outcome !== "EXECUTED") throw new Error("OPENCLAW_M14_RECONCILIATION_INVALID_DENIED");
  const record = effectRecord(reservation, receipt);
  state.openclawM14Effects[request.requestId] = record;
  delete state.openclawM14InFlight[request.requestId];
  persist();
  return publicResponse(request, record.decision, record.receipt, "RECOVERED_AUTHORITATIVE_READBACK", record.readback);
}

export function executeOpenClawM14Capability(state, request, authorization, runtime, persist) {
  if (typeof persist !== "function" || runtime === undefined) return deny("IDENTITY_MISSING_DENIED", request);
  const identityIssue = authorizationIssue(request, authorization, runtime);
  if (identityIssue !== null) return deny(identityIssue, request);
  if (request.userIdentity !== OPENCLAW_M14_USER_IDENTITY) return deny("IDENTITY_MISSING_DENIED", request);
  if (!REQUEST_PATTERN.test(request.requestId ?? "")) return deny("REQUEST_SCHEMA_INVALID_DENIED", request);
  if (canonicalJson(request.evidenceSink) !== canonicalJson(EVIDENCE_SINK)) {
    return deny("EVIDENCE_SINK_MISSING_DENIED", request);
  }

  const decision = admitCapabilityExecutionAtGatewayV1(
    CATALOGUE, ACTIVATION, POLICY, request, OPENCLAW_M14_OBSERVED_AT,
  );
  if (decision.outcome !== "ALLOW" || decision.ticket === null) {
    return deny(decision.issues[0] ?? "REQUEST_SCHEMA_INVALID_DENIED", request);
  }
  const authorizationBinding = authorizationBindingFor(authorization, runtime);

  function replayBindingMatches(record) {
    return canonicalJson(record.authorizationBinding) === canonicalJson(authorizationBinding)
      && canonicalJson(record.decision) === canonicalJson(decision);
  }

  const prior = state.openclawM14Effects[request.requestId];
  if (prior !== undefined) {
    if (prior.requestDigest !== decision.requestDigest || !replayBindingMatches(prior)) {
      return deny("REPLAY_CONFLICT_DENIED", request);
    }
    return publicResponse(request, prior.decision, prior.receipt, prior.replayStateForRetry, prior.readback);
  }
  const inFlight = state.openclawM14InFlight[request.requestId];
  if (inFlight !== undefined) {
    if (inFlight.requestDigest !== decision.requestDigest || !replayBindingMatches(inFlight)) {
      return deny("REPLAY_CONFLICT_DENIED", request);
    }
    if (inFlight.status === "COMMITTED") return reconcileCommitted(state, request, inFlight, persist);
    return deny("REPLAY_IN_FLIGHT_DENIED", request);
  }

  const ordinals = [
    ...Object.values(state.openclawM14Effects).map(({ effectOrdinal }) => effectOrdinal),
    ...Object.values(state.openclawM14InFlight).map(({ effectOrdinal }) => effectOrdinal),
  ];
  const reservation = reservationFor(
    request, decision, authorizationBinding, Math.max(0, ...ordinals) + 1,
  );
  state.openclawM14InFlight[request.requestId] = reservation;
  persist();

  const response = structuredClone(FIXTURE_RESPONSE);
  const receipt = canonicalReceipt(decision, response, () => {
    reservation.status = "COMMITTED";
    reservation.response = structuredClone(response);
    reservation.readback = structuredClone(response);
    reservation.readbackDigest = digest(reservation.readback);
    persist();
  });
  if (receipt.outcome !== "EXECUTED") {
    if (receipt.outcome === "AMBIGUOUS" && reservation.status === "COMMITTED") {
      return reconcileCommitted(state, request, reservation, persist);
    }
    delete state.openclawM14InFlight[request.requestId];
    persist();
    return deny(receipt.issues[0] ?? "RESPONSE_SCHEMA_INVALID_DENIED", request);
  }
  const record = effectRecord(reservation, receipt);
  state.openclawM14Effects[request.requestId] = record;
  delete state.openclawM14InFlight[request.requestId];
  persist();
  return publicResponse(request, decision, receipt, "FIRST_EXECUTION", record.readback);
}

function validatedAuthorizationBinding(record, requestId, runtime) {
  const binding = record.authorizationBinding;
  const bindingKeys = [
    "audience", "authorizationSchemaVersion", "bindingDigest", "correlationDigest", "correlationId",
    "expiresAt", "issuedAt", "network", "schemaVersion", "scope", "status", "subject", "tenant",
    "workloadContractDigest",
  ];
  const networkKeys = ["host", "method", "path", "port", "protocol"];
  if (!exactObject(binding, bindingKeys) || !exactObject(binding.network, networkKeys)) {
    throw new Error("OPENCLAW_M14_STATE_INVALID_DENIED");
  }
  const { bindingDigest, ...core } = binding;
  const target = runtime?.networkPolicy?.egress?.allow?.[0];
  const observed = Date.parse(runtime?.clock?.now);
  let expectedCorrelation;
  try { expectedCorrelation = canonicalOpenClawM14CorrelationId(requestId); } catch {
    throw new Error("OPENCLAW_M14_STATE_INVALID_DENIED");
  }
  const expectedExpiry = Number.isFinite(observed) && Number.isInteger(runtime?.clock?.maxTtlSeconds)
    ? new Date(observed + runtime.clock.maxTtlSeconds * 1000).toISOString()
    : null;
  if (binding.schemaVersion !== OPENCLAW_M14_AUTHORIZATION_BINDING_SCHEMA
    || binding.authorizationSchemaVersion !== "chimpmaera.openclaw/gateway-authorization-result/v2"
    || binding.status !== "ALLOW"
    || binding.bindingDigest !== safeDigest(core)
    || binding.workloadContractDigest !== safeDigest(runtime)
    || runtime?.networkPolicy?.default !== "DENY"
    || runtime?.networkPolicy?.egress?.allow?.length !== 1
    || binding.subject !== runtime?.identity?.subject
    || binding.audience !== runtime?.identity?.audience
    || binding.tenant !== runtime?.identity?.tenant
    || canonicalJson(binding.scope) !== canonicalJson(runtime?.identity?.scope)
    || binding.network.protocol !== target?.protocol
    || binding.network.host !== target?.host
    || binding.network.port !== target?.port
    || binding.network.method !== target?.method
    || binding.network.path !== target?.path
    || binding.network.path !== runtime?.identity?.route
    || binding.correlationId !== expectedCorrelation
    || binding.correlationDigest !== digest(binding.correlationId)
    || binding.correlationDigest !== record.correlationDigest
    || binding.issuedAt !== runtime.clock.now
    || binding.expiresAt !== expectedExpiry) {
    throw new Error("OPENCLAW_M14_STATE_INVALID_DENIED");
  }
  return binding;
}

function validatedDecision(record, requestId, runtime) {
  const authorizationBinding = validatedAuthorizationBinding(record, requestId, runtime);
  let decision;
  try { decision = verifyCapabilityGatewayDecisionV1(record.decision); } catch {
    throw new Error("OPENCLAW_M14_STATE_INVALID_DENIED");
  }
  const ticket = decision.ticket;
  const expectedPayload = syntheticCapabilityExecutionRequestV1(CATALOGUE, "crm.contact.create", POLICY).request;
  if (decision.outcome !== "ALLOW" || ticket === null || decision.issues.length !== 0
    || record.requestId !== requestId
    || record.workloadIdentity !== runtime.identity.subject
    || record.tenant !== POLICY.tenant
    || record.policyGeneration !== POLICY.version
    || record.requestDigest !== decision.requestDigest
    || record.requestDigest !== ticket.requestDigest
    || record.requestDigest !== digest(ticket.request)
    || record.correlationDigest !== decision.correlationDigest
    || record.correlationDigest !== ticket.correlationDigest
    || record.correlationDigest !== authorizationBinding.correlationDigest
    || canonicalJson(ticket.request) !== canonicalJson(expectedPayload)
    || ticket.requestId !== requestId
    || ticket.catalogueVersion !== CATALOGUE.version
    || ticket.catalogueDigest !== CATALOGUE.digest
    || ticket.actionId !== ACTION.actionId
    || ticket.actionVersion !== ACTION.version
    || ticket.actionDigest !== ACTION.digest
    || ticket.activationDigest !== ACTIVATION.digest
    || ticket.policyId !== POLICY.policyId
    || ticket.policyVersion !== POLICY.version
    || ticket.policyDigest !== POLICY.digest
    || ticket.tenant !== POLICY.tenant
    || canonicalJson(ticket.evidenceSink) !== canonicalJson(EVIDENCE_SINK)) {
    throw new Error("OPENCLAW_M14_STATE_INVALID_DENIED");
  }
  return decision;
}

function expectedReceipt(record, decision) {
  const receipt = canonicalReceipt(decision, record.readback);
  if (receipt.outcome !== "EXECUTED") throw new Error("OPENCLAW_M14_STATE_INVALID_DENIED");
  return receipt;
}

export function validateOpenClawM14State(state, runtime) {
  if (state === null || typeof state !== "object" || Array.isArray(state)
    || state.openclawM14Effects === null || typeof state.openclawM14Effects !== "object" || Array.isArray(state.openclawM14Effects)
    || state.openclawM14InFlight === null || typeof state.openclawM14InFlight !== "object" || Array.isArray(state.openclawM14InFlight)) {
    throw new Error("OPENCLAW_M14_STATE_INVALID_DENIED");
  }
  const ordinals = [];
  for (const [requestId, record] of Object.entries(state.openclawM14Effects)) {
    if (!exactObject(record, ["authorizationBinding", "correlationDigest", "decision", "effectOrdinal", "policyGeneration", "readback", "readbackDigest", "receipt", "replayStateForRetry", "requestDigest", "requestId", "schemaVersion", "tenant", "workloadIdentity"])
      || record.schemaVersion !== OPENCLAW_M14_STATE_SCHEMA
      || record.replayStateForRetry !== "RECOVERED_SAME_RECEIPT"
      || !Number.isSafeInteger(record.effectOrdinal) || record.effectOrdinal < 1
      || canonicalJson(record.readback) !== canonicalJson(FIXTURE_RESPONSE)
      || record.readbackDigest !== digest(FIXTURE_RESPONSE)) throw new Error("OPENCLAW_M14_STATE_INVALID_DENIED");
    const decision = validatedDecision(record, requestId, runtime);
    const expected = expectedReceipt(record, decision);
    if (canonicalJson(record.receipt) !== canonicalJson(expected)
      || canonicalJson(record.receipt.response) !== canonicalJson(record.readback)) {
      throw new Error("OPENCLAW_M14_STATE_INVALID_DENIED");
    }
    ordinals.push(record.effectOrdinal);
  }
  for (const [requestId, record] of Object.entries(state.openclawM14InFlight)) {
    if (!exactObject(record, ["authorizationBinding", "correlationDigest", "decision", "effectOrdinal", "policyGeneration", "readback", "readbackDigest", "requestDigest", "requestId", "response", "schemaVersion", "status", "tenant", "workloadIdentity"])
      || record.schemaVersion !== OPENCLAW_M14_RESERVATION_SCHEMA
      || !["RESERVED", "COMMITTED"].includes(record.status)
      || !Number.isSafeInteger(record.effectOrdinal) || record.effectOrdinal < 1) {
      throw new Error("OPENCLAW_M14_STATE_INVALID_DENIED");
    }
    const decision = validatedDecision(record, requestId, runtime);
    if (record.status === "RESERVED"
      ? record.response !== null || record.readback !== null || record.readbackDigest !== null
      : canonicalJson(record.response) !== canonicalJson(FIXTURE_RESPONSE)
        || canonicalJson(record.readback) !== canonicalJson(FIXTURE_RESPONSE)
        || record.readbackDigest !== digest(FIXTURE_RESPONSE)
        || canonicalJson(record.response) !== canonicalJson(record.readback)
        || expectedReceipt(record, decision).outcome !== "EXECUTED") {
      throw new Error("OPENCLAW_M14_STATE_INVALID_DENIED");
    }
    ordinals.push(record.effectOrdinal);
  }
  if (new Set(ordinals).size !== ordinals.length
    || ordinals.sort((left, right) => left - right).some((value, index) => value !== index + 1)) {
    throw new Error("OPENCLAW_M14_STATE_INVALID_DENIED");
  }
}
