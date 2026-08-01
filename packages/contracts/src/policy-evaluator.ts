import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const POLICY_EVALUATION_INPUT_API_VERSION =
  "chimpmaera.demo/policy-evaluation-input/v1" as const;
export const TRUSTED_POLICY_CONTEXT_API_VERSION =
  "chimpmaera.demo/trusted-policy-context/v1" as const;
export const POLICY_DECISION_API_VERSION =
  "chimpmaera.demo/policy-decision/v1" as const;

export type PolicyOutcomeV1 = "AUTO_GRANT" | "OWNER_ESCALATION" | "DENY";

export type PolicyEvaluationInputV1 = Readonly<{
  schemaVersion: typeof POLICY_EVALUATION_INPUT_API_VERSION;
  actor: string;
  capability: string;
  operation: string;
  resource: string;
  tenant: string;
  materiality: "LOW_SYNTHETIC" | "MATERIAL_SYNTHETIC" | "UNDECLARED";
  adapter: Readonly<{ adapterId: string; adapterVersion: string }>;
  actionDigest: string | null;
  scopeDigest: string | null;
  replayKey: string;
  requestDigest: string;
}>;

export type TrustedPolicyContextV1 = Readonly<{
  schemaVersion: typeof TRUSTED_POLICY_CONTEXT_API_VERSION;
  profileId: "SAFE_GUIDED";
  profileGeneration: string;
  policyId: string;
  policyGeneration: number;
  policySourceDigest: string;
  policySemanticDigest: string;
}>;

export type PolicyDecisionV1 = Readonly<{
  schemaVersion: typeof POLICY_DECISION_API_VERSION;
  inputDigest: string;
  contextDigest: string;
  evaluator: Readonly<{ providerId: string; providerVersion: string }>;
  outcome: PolicyOutcomeV1;
  reasonCodes: readonly string[];
  constraints: Readonly<{
    authorityIssuer: "CHIMPMAERA_GATE_ONLY";
    maximumEffects: 0 | 1;
    exactInputRequired: true;
  }>;
  decisionDigest: string;
}>;

export interface PolicyEvaluatorV1 {
  readonly providerId: string;
  readonly providerVersion: string;
  evaluate(
    input: PolicyEvaluationInputV1,
    trustedContext: TrustedPolicyContextV1,
  ): PolicyDecisionV1;
}
function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function exactKeys(value: unknown, expected: readonly string[]): boolean {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort())
      === canonicalJson([...expected].sort());
}

export function verifyPolicyDecisionV1(
  decision: PolicyDecisionV1,
  input: PolicyEvaluationInputV1,
  context: TrustedPolicyContextV1,
): boolean {
  if (!exactKeys(decision, [
    "constraints", "contextDigest", "decisionDigest", "evaluator",
    "inputDigest", "outcome", "reasonCodes", "schemaVersion",
  ])) return false;
  const { decisionDigest, ...core } = decision;
  return decision.schemaVersion === POLICY_DECISION_API_VERSION
    && input.schemaVersion === POLICY_EVALUATION_INPUT_API_VERSION
    && context.schemaVersion === TRUSTED_POLICY_CONTEXT_API_VERSION
    && decision.inputDigest === digest(input)
    && decision.contextDigest === digest(context)
    && decisionDigest === digest(core)
    && ["AUTO_GRANT", "OWNER_ESCALATION", "DENY"].includes(decision.outcome)
    && decision.constraints.authorityIssuer === "CHIMPMAERA_GATE_ONLY"
    && decision.constraints.exactInputRequired === true
    && decision.constraints.maximumEffects === (decision.outcome === "DENY" ? 0 : 1);
}
