import { canonicalJson, sha256 } from "./enforcement-gate.mjs";
import { validateAdminAiPocPolicy } from "./admin-ai-policy.mjs";
import {
  POLICY_EVALUATION_INPUT_SCHEMA,
  TRUSTED_POLICY_CONTEXT_SCHEMA,
  createInternalStaticPolicyEvaluator,
  validatePolicyDecision,
} from "./policy-evaluator.mjs";

const ACTOR = "agent:admin-ai-poc";
const REQUEST_SCHEMA = "chimpmaera.demo/admin-ai-request/v1";
const DECISION_SCHEMA = "chimpmaera.demo/admin-ai-decision/v4";

function assertExactKeys(value, expected, code) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort())
      !== JSON.stringify([...expected].sort())
  ) throw new Error(code);
}

export { validateAdminAiPocPolicy } from "./admin-ai-policy.mjs";

function validateRequest(request) {
  assertExactKeys(
    request,
    ["actor", "replayKey", "requestKind", "schemaVersion"],
    "ADMIN_AI_REQUEST_INVALID_DENIED",
  );
  if (
    request.schemaVersion !== REQUEST_SCHEMA
    || request.actor !== ACTOR
    || typeof request.requestKind !== "string"
    || request.requestKind.length < 1
    || request.requestKind.length > 100
    || typeof request.replayKey !== "string"
    || !/^admin-ai:poc:[a-zA-Z0-9:._-]{8,140}$/.test(request.replayKey)
  ) throw new Error("ADMIN_AI_REQUEST_INVALID_DENIED");
}

function contactAction(replayKey) {
  return {
    actionType: "PROVIDER_MUTATION",
    actor: ACTOR,
    payload: {
      body: {
        description: "ChimpMaera Admin AI deterministic PoC contact",
        emailAddress: "admin-ai-poc@example.invalid",
        firstName: "Avery",
        lastName: "Admin AI PoC",
      },
      method: "POST",
      path: "/Contact",
    },
    replayKey,
    scope: {
      actor: ACTOR,
      entity: "Contact",
      operation: "CREATE_IF_ABSENT",
      provider: "espocrm",
      tenant: "panskys-zoo-demo",
    },
  };
}

function orderAction(replayKey) {
  return {
    actionType: "PROVIDER_MUTATION",
    actor: ACTOR,
    payload: {
      body: {
        date: 1767225600,
        ref_client: "CM-ADMIN-AI-ESCALATION-001",
        socid: 7,
      },
      method: "POST",
      path: "/orders",
    },
    replayKey,
    scope: {
      actor: ACTOR,
      entity: "Order",
      operation: "CREATE_IF_ABSENT",
      provider: "dolibarr",
      tenant: "panskys-zoo-demo",
    },
  };
}

function intentFor(request, action) {
  const requestDigest = sha256(canonicalJson(request));
  if (request.requestKind === "SYNTHETIC_ESPOCRM_CONTACT_CREATE") {
    return {
      schemaVersion: POLICY_EVALUATION_INPUT_SCHEMA,
      actor: request.actor,
      capability: "customer.contact.create",
      operation: "CREATE_IF_ABSENT",
      resource: "CustomerContact",
      tenant: "panskys-zoo-demo",
      materiality: "LOW_SYNTHETIC",
      adapter: { adapterId: "espocrm-contact", adapterVersion: "1.0.0" },
      actionDigest: sha256(canonicalJson(action)),
      scopeDigest: sha256(canonicalJson(action.scope)),
      replayKey: request.replayKey,
      requestDigest,
    };
  }
  if (request.requestKind === "SYNTHETIC_DOLIBARR_ORDER_CREATE") {
    return {
      schemaVersion: POLICY_EVALUATION_INPUT_SCHEMA,
      actor: request.actor,
      capability: "sales.order.create",
      operation: "CREATE_IF_ABSENT",
      resource: "SalesOrder",
      tenant: "panskys-zoo-demo",
      materiality: "MATERIAL_SYNTHETIC",
      adapter: { adapterId: "dolibarr-order", adapterVersion: "1.0.0" },
      actionDigest: sha256(canonicalJson(action)),
      scopeDigest: sha256(canonicalJson(action.scope)),
      replayKey: request.replayKey,
      requestDigest,
    };
  }
  return {
    schemaVersion: POLICY_EVALUATION_INPUT_SCHEMA,
    actor: request.actor,
    capability: "request.undeclared",
    operation: "UNDECLARED_REQUEST",
    resource: "UndeclaredRequest",
    tenant: "panskys-zoo-demo",
    materiality: "UNDECLARED",
    adapter: { adapterId: "deny-only", adapterVersion: "1.0.0" },
    actionDigest: null,
    scopeDigest: null,
    replayKey: request.replayKey,
    requestDigest,
  };
}

export class AdminAiPoc {
  constructor({
    policy,
    policyDigest,
    signAuthority,
    policyEvaluator,
    trustedPolicyContext,
  }) {
    this.policy = validateAdminAiPocPolicy(policy);
    if (!/^[a-f0-9]{64}$/.test(policyDigest)) {
      throw new Error("ADMIN_AI_POLICY_DIGEST_INVALID_DENIED");
    }
    this.policyDigest = policyDigest;
    this.signAuthority = signAuthority;
    this.policyEvaluator = policyEvaluator ?? createInternalStaticPolicyEvaluator({
      policy: this.policy,
      policySourceDigest: policyDigest,
    });
    this.trustedPolicyContext = trustedPolicyContext ?? {
      schemaVersion: TRUSTED_POLICY_CONTEXT_SCHEMA,
      profileId: "SAFE_GUIDED",
      profileGeneration: "standalone-test-v1",
      policyId: this.policy.policyId,
      policyGeneration: 1,
      policySourceDigest: policyDigest,
      policySemanticDigest: this.policyEvaluator.policySemanticDigest,
    };
  }

  decide(request) {
    validateRequest(request);
    const plannedAction = request.requestKind === "SYNTHETIC_ESPOCRM_CONTACT_CREATE"
      ? contactAction(request.replayKey)
      : request.requestKind === "SYNTHETIC_DOLIBARR_ORDER_CREATE"
        ? orderAction(request.replayKey)
        : null;
    const input = intentFor(request, plannedAction);
    const policyDecision = validatePolicyDecision(
      this.policyEvaluator.evaluate(input, this.trustedPolicyContext),
      input,
      this.trustedPolicyContext,
    );
    if (
      (input.capability === "request.undeclared" && policyDecision.outcome !== "DENY")
      || (input.capability === "sales.order.create"
        && policyDecision.outcome === "AUTO_GRANT")
    ) throw new Error("POLICY_DECISION_EXCEEDS_ADAPTER_CEILING_DENIED");
    const action = policyDecision.outcome === "DENY" ? null : plannedAction;
    const actionDigest = action === null ? null : sha256(canonicalJson(action));
    const requestId = sha256(canonicalJson(request));
    const core = {
      schemaVersion: DECISION_SCHEMA,
      requestId,
      actor: request.actor,
      requestKind: request.requestKind,
      outcome: policyDecision.outcome,
      reasonCodes: policyDecision.reasonCodes,
      actionDigest,
      policyId: this.trustedPolicyContext.policyId,
      policyGeneration: this.trustedPolicyContext.policyGeneration,
      policyDigest: this.policyDigest,
      replayKey: request.replayKey,
    };
    const decisionDigest = sha256(canonicalJson(core));
    const authority = policyDecision.outcome === "AUTO_GRANT"
      ? this.signAuthority({
        actor: action.actor,
        scope: action.scope,
        actionDigest,
        replayKey: action.replayKey,
        policyId: this.trustedPolicyContext.policyId,
        policyGeneration: this.trustedPolicyContext.policyGeneration,
        policyDigest: this.policyDigest,
        decisionDigest,
      })
      : null;
    return {
      status: "PASS",
      decision: {
        ...core,
        decisionDigest,
        action,
        authority,
      },
    };
  }
}
