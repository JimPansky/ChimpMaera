import { canonicalJson } from "./enforcement-gate.mjs";

function assertExactKeys(value, expected, code) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())
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
    ) throw new Error("ADMIN_AI_POLICY_INVALID_DENIED");
  }
  return policy;
}
