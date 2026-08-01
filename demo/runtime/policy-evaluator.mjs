import { canonicalJson, sha256 } from "./enforcement-gate.mjs";
import { validateAdminAiPocPolicy } from "./admin-ai-policy.mjs";

export const POLICY_EVALUATION_INPUT_SCHEMA =
  "chimpmaera.demo/policy-evaluation-input/v1";
export const TRUSTED_POLICY_CONTEXT_SCHEMA =
  "chimpmaera.demo/trusted-policy-context/v1";
export const POLICY_DECISION_SCHEMA =
  "chimpmaera.demo/policy-decision/v1";

const OUTCOMES = new Set(["AUTO_GRANT", "OWNER_ESCALATION", "DENY"]);
const REASONS = new Set([
  "POLICY_SYNTHETIC_CONTACT_AUTO_GRANTED",
  "POLICY_ORDER_REQUIRES_OWNER",
  "POLICY_REQUEST_NOT_ALLOWED",
]);

function assertExactKeys(value, expected, code) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())
  ) throw new Error(code);
}
function assertDigest(value, code) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(code);
  }
}

export function validatePolicyEvaluationInput(input) {
  assertExactKeys(input, [
    "actionDigest",
    "actor",
    "adapter",
    "capability",
    "materiality",
    "operation",
    "replayKey",
    "requestDigest",
    "resource",
    "schemaVersion",
    "scopeDigest",
    "tenant",
  ], "POLICY_EVALUATION_INPUT_INVALID_DENIED");
  assertExactKeys(
    input.adapter,
    ["adapterId", "adapterVersion"],
    "POLICY_EVALUATION_INPUT_INVALID_DENIED",
  );
  if (
    input.schemaVersion !== POLICY_EVALUATION_INPUT_SCHEMA
    || input.actor !== "agent:admin-ai-poc"
    || !/^[a-z][a-z0-9.-]{2,80}$/.test(input.capability)
    || !/^[A-Z][A-Z0-9_]{2,80}$/.test(input.operation)
    || !/^[A-Za-z][A-Za-z0-9]{2,80}$/.test(input.resource)
    || input.tenant !== "panskys-zoo-demo"
    || !["LOW_SYNTHETIC", "MATERIAL_SYNTHETIC", "UNDECLARED"].includes(
      input.materiality,
    )
    || !/^[a-z][a-z0-9.-]{2,80}$/.test(input.adapter.adapterId)
    || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(input.adapter.adapterVersion)
    || !/^admin-ai:poc:[a-zA-Z0-9:._-]{8,140}$/.test(input.replayKey)
  ) throw new Error("POLICY_EVALUATION_INPUT_INVALID_DENIED");
  assertDigest(input.requestDigest, "POLICY_EVALUATION_INPUT_INVALID_DENIED");
  for (const value of [input.actionDigest, input.scopeDigest]) {
    if (value !== null) {
      assertDigest(value, "POLICY_EVALUATION_INPUT_INVALID_DENIED");
    }
  }
  if ((input.actionDigest === null) !== (input.scopeDigest === null)) {
    throw new Error("POLICY_EVALUATION_INPUT_INVALID_DENIED");
  }
  return input;
}

export function validateTrustedPolicyContext(context) {
  assertExactKeys(context, [
    "policyGeneration",
    "policyId",
    "policySemanticDigest",
    "policySourceDigest",
    "profileGeneration",
    "profileId",
    "schemaVersion",
  ], "TRUSTED_POLICY_CONTEXT_INVALID_DENIED");
  if (
    context.schemaVersion !== TRUSTED_POLICY_CONTEXT_SCHEMA
    || context.profileId !== "SAFE_GUIDED"
    || typeof context.profileGeneration !== "string"
    || context.profileGeneration.length < 8
    || context.policyId !== "admin-ai-poc-policy-v1"
    || !Number.isSafeInteger(context.policyGeneration)
    || context.policyGeneration < 1
  ) throw new Error("TRUSTED_POLICY_CONTEXT_INVALID_DENIED");
  assertDigest(
    context.policySourceDigest,
    "TRUSTED_POLICY_CONTEXT_INVALID_DENIED",
  );
  assertDigest(
    context.policySemanticDigest,
    "TRUSTED_POLICY_CONTEXT_INVALID_DENIED",
  );
  return context;
}

function decisionCore(input, context, fields) {
  return {
    schemaVersion: POLICY_DECISION_SCHEMA,
    inputDigest: sha256(canonicalJson(input)),
    contextDigest: sha256(canonicalJson(context)),
    evaluator: {
      providerId: fields.providerId,
      providerVersion: fields.providerVersion,
    },
    outcome: fields.outcome,
    reasonCodes: fields.reasonCodes,
    constraints: {
      authorityIssuer: "CHIMPMAERA_GATE_ONLY",
      maximumEffects: fields.outcome === "DENY" ? 0 : 1,
      exactInputRequired: true,
    },
  };
}

export function validatePolicyDecision(decision, input, context) {
  validatePolicyEvaluationInput(input);
  validateTrustedPolicyContext(context);
  assertExactKeys(decision, [
    "constraints",
    "contextDigest",
    "decisionDigest",
    "evaluator",
    "inputDigest",
    "outcome",
    "reasonCodes",
    "schemaVersion",
  ], "POLICY_DECISION_INVALID_DENIED");
  assertExactKeys(
    decision.evaluator,
    ["providerId", "providerVersion"],
    "POLICY_DECISION_INVALID_DENIED",
  );
  assertExactKeys(decision.constraints, [
    "authorityIssuer",
    "exactInputRequired",
    "maximumEffects",
  ], "POLICY_DECISION_INVALID_DENIED");
  if (
    decision.schemaVersion !== POLICY_DECISION_SCHEMA
    || !/^[a-z][a-z0-9.-]{2,80}$/.test(decision.evaluator.providerId)
    || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(decision.evaluator.providerVersion)
    || !OUTCOMES.has(decision.outcome)
    || !Array.isArray(decision.reasonCodes)
    || decision.reasonCodes.length !== 1
    || !REASONS.has(decision.reasonCodes[0])
    || decision.constraints.authorityIssuer !== "CHIMPMAERA_GATE_ONLY"
    || decision.constraints.exactInputRequired !== true
    || decision.constraints.maximumEffects !== (decision.outcome === "DENY" ? 0 : 1)
  ) throw new Error("POLICY_DECISION_INVALID_DENIED");
  for (const value of [
    decision.inputDigest,
    decision.contextDigest,
    decision.decisionDigest,
  ]) assertDigest(value, "POLICY_DECISION_INVALID_DENIED");
  const { decisionDigest, ...core } = decision;
  if (
    decision.inputDigest !== sha256(canonicalJson(input))
    || decision.contextDigest !== sha256(canonicalJson(context))
    || decisionDigest !== sha256(canonicalJson(core))
  ) throw new Error("POLICY_DECISION_INVALID_DENIED");
  return decision;
}

export function createInternalStaticPolicyEvaluator({
  policy,
  policySourceDigest,
}) {
  const validatedPolicy = validateAdminAiPocPolicy(policy);
  assertDigest(policySourceDigest, "POLICY_PROVIDER_CONFIG_INVALID_DENIED");
  const policySemanticDigest = sha256(canonicalJson(validatedPolicy));
  const ruleByCapability = new Map([
    ["customer.contact.create", validatedPolicy.rules[0]],
    ["sales.order.create", validatedPolicy.rules[1]],
  ]);
  return Object.freeze({
    providerId: "internal-static",
    providerVersion: "1.0.0",
    policySemanticDigest,
    evaluate(input, context) {
      validatePolicyEvaluationInput(input);
      validateTrustedPolicyContext(context);
      if (
        context.policyId !== validatedPolicy.policyId
        || context.policySourceDigest !== policySourceDigest
        || context.policySemanticDigest !== policySemanticDigest
      ) throw new Error("POLICY_PROVIDER_CONTEXT_MISMATCH_DENIED");
      const rule = ruleByCapability.get(input.capability)
        ?? validatedPolicy.rules[2];
      const core = decisionCore(input, context, {
        providerId: "internal-static",
        providerVersion: "1.0.0",
        outcome: rule.outcome,
        reasonCodes: [rule.reasonCode],
      });
      return {
        ...core,
        decisionDigest: sha256(canonicalJson(core)),
      };
    },
  });
}
