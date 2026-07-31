import { canonicalJson, sha256 } from "./enforcement-gate.mjs";

const ACTOR = "agent:admin-ai-poc";
const REQUEST_SCHEMA = "chimpmaera.demo/admin-ai-request/v1";
const DECISION_SCHEMA = "chimpmaera.demo/admin-ai-decision/v2";

function assertExactKeys(value, expected, code) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort())
      !== JSON.stringify([...expected].sort())
  ) throw new Error(code);
}

export function validateAdminAiPocPolicy(policy) {
  assertExactKeys(policy, ["policyId", "rules", "schemaVersion"], "ADMIN_AI_POLICY_INVALID_DENIED");
  if (
    policy.schemaVersion !== "chimpmaera.demo/admin-ai-poc-policy/v1"
    || policy.policyId !== "admin-ai-poc-policy-v1"
    || !Array.isArray(policy.rules)
    || policy.rules.length !== 3
  ) throw new Error("ADMIN_AI_POLICY_INVALID_DENIED");
  const expected = [
    [
      "SYNTHETIC_ESPOCRM_CONTACT_CREATE",
      "AUTO_GRANT",
      "POLICY_SYNTHETIC_CONTACT_AUTO_GRANTED",
    ],
    [
      "SYNTHETIC_DOLIBARR_ORDER_CREATE",
      "OWNER_ESCALATION",
      "POLICY_ORDER_REQUIRES_OWNER",
    ],
    ["*", "DENY", "POLICY_REQUEST_NOT_ALLOWED"],
  ];
  for (const [index, rule] of policy.rules.entries()) {
    assertExactKeys(
      rule,
      ["outcome", "reasonCode", "requestKind"],
      "ADMIN_AI_POLICY_INVALID_DENIED",
    );
    if (
      canonicalJson([rule.requestKind, rule.outcome, rule.reasonCode])
        !== canonicalJson(expected[index])
    ) {
      throw new Error("ADMIN_AI_POLICY_INVALID_DENIED");
    }
  }
  return policy;
}

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

function businessDiff(action) {
  if (action === null) return null;
  if (action.scope.provider === "espocrm") {
    return {
      schemaVersion: "chimpmaera.demo/business-diff/v1",
      summary: "Create one synthetic EspoCRM contact if absent.",
      target: {
        provider: "espocrm",
        tenant: "panskys-zoo-demo",
        entity: "Contact",
      },
      before: "No contact with admin-ai-poc@example.invalid is required to exist.",
      changes: [
        { field: "firstName", before: null, after: "Avery" },
        { field: "lastName", before: null, after: "Admin AI PoC" },
        { field: "emailAddress", before: null, after: "admin-ai-poc@example.invalid" },
      ],
      consequence: "Adds one fictional local CRM contact; no external communication.",
    };
  }
  return {
    schemaVersion: "chimpmaera.demo/business-diff/v1",
    summary: "Create one synthetic Dolibarr sales order if absent.",
    target: {
      provider: "dolibarr",
      tenant: "panskys-zoo-demo",
      entity: "Order",
    },
    before: "No order with customer reference CM-ADMIN-AI-ESCALATION-001 is required to exist.",
    changes: [
      { field: "customerReference", before: null, after: "CM-ADMIN-AI-ESCALATION-001" },
      { field: "customerId", before: null, after: 7 },
      { field: "orderDateEpoch", before: null, after: 1767225600 },
    ],
    consequence: "Adds one fictional local ERP order; no payment, shipment, email, or deletion.",
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

export class AdminAiPoc {
  constructor({ policy, policyDigest, signAuthority }) {
    this.policy = validateAdminAiPocPolicy(policy);
    if (!/^[a-f0-9]{64}$/.test(policyDigest)) {
      throw new Error("ADMIN_AI_POLICY_DIGEST_INVALID_DENIED");
    }
    this.policyDigest = policyDigest;
    this.signAuthority = signAuthority;
  }

  decide(request) {
    validateRequest(request);
    const rule = this.policy.rules.find(({ requestKind }) =>
      requestKind === request.requestKind
    ) ?? this.policy.rules[2];
    const action = rule.outcome === "AUTO_GRANT"
      ? contactAction(request.replayKey)
      : rule.outcome === "OWNER_ESCALATION"
        ? orderAction(request.replayKey)
        : null;
    const actionDigest = action === null ? null : sha256(canonicalJson(action));
    const readableDiff = businessDiff(action);
    const businessDiffDigest = readableDiff === null
      ? null
      : sha256(canonicalJson(readableDiff));
    const requestId = sha256(canonicalJson(request));
    const core = {
      schemaVersion: DECISION_SCHEMA,
      requestId,
      actor: request.actor,
      requestKind: request.requestKind,
      outcome: rule.outcome,
      reasonCodes: [rule.reasonCode],
      actionDigest,
      businessDiffDigest,
      policyDigest: this.policyDigest,
      replayKey: request.replayKey,
    };
    const decisionDigest = sha256(canonicalJson(core));
    const authority = rule.outcome === "AUTO_GRANT"
      ? this.signAuthority({
        actor: action.actor,
        scope: action.scope,
        actionDigest,
        replayKey: action.replayKey,
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
        businessDiff: readableDiff,
        authority,
      },
    };
  }
}
