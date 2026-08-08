import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import type { DevModelAliasV1 } from "./development-worker.js";

export const ROUTING_CONTEXT_SCHEMA_V1 = "chimpmaera.dev/routing-context/v1" as const;
export const ROUTING_DECISION_SCHEMA_V1 = "chimpmaera.dev/routing-decision/v1" as const;
export const ROUTING_ATTEMPT_SCHEMA_V1 = "chimpmaera.dev/routing-attempt/v1" as const;
export const ROUTING_OUTCOME_SCHEMA_V1 = "chimpmaera.dev/routing-outcome/v1" as const;
export const LEARNING_ROUTING_CLAIM_BOUNDARY_V1 =
  "LOCAL_SYNTHETIC_NO_ROUTING_ACTIVATION" as const;

export const LEARNING_ROUTING_NON_CLAIMS_V1 = [
  "NO_ROUTE_EXECUTION",
  "NO_AUTHORITY_GRANT",
  "NO_PROVIDER_CALL",
  "NO_PRODUCTION_ACTIVATION",
  "NO_TRAINING_INGESTION",
] as const;

export const LEARNING_ROUTING_WORKFLOWS_V1 = [
  "DIRECT",
  "PLAN_FIRST",
  "SCOUT_FIRST",
  "REPRODUCE_FIRST",
  "DECOMPOSE",
  "SECURITY_REVIEW",
] as const;
export const LEARNING_ROUTING_MODEL_ALIASES_V1 = [
  "cm.dev.fast",
  "cm.dev.primary",
  "cm.dev.review",
  "cm.dev.escalate",
] as const satisfies readonly DevModelAliasV1[];
export const LEARNING_ROUTING_THINKING_PROFILES_V1 = [
  "MINIMAL",
  "STANDARD",
  "DEEP",
] as const;
export const LEARNING_ROUTING_CONTEXT_PROFILES_V1 = [
  "ISSUE_ONLY",
  "ISSUE_AND_BASE",
  "TARGETED_REPOSITORY",
] as const;
export const LEARNING_ROUTING_VERIFIER_PROFILES_V1 = [
  "CONTRACT_ONLY",
  "STANDARD",
  "SECURITY",
] as const;
export const LEARNING_ROUTING_RECOVERY_ACTIONS_V1 = [
  "INITIAL",
  "REFLECT",
  "REPLAN",
  "SCOUT",
  "REPRODUCE",
  "ESCALATE",
  "HUMAN_REVIEW",
] as const;
export const LEARNING_ROUTING_REASON_CODES_V1 = [
  "MODEL_CAPABILITY_LIMIT",
  "THINKING_OR_OUTPUT_PROFILE_MISMATCH",
  "WORKFLOW_STRATEGY_MISMATCH",
  "LOCAL_IMPLEMENTATION_DEFECT",
  "CONTEXT_DEFICIT_OR_BAD_PROJECTION",
  "ISSUE_SPECIFICATION_GAP",
  "TOOL_OR_ENVIRONMENT_FAILURE",
  "VERIFICATION_GAP_OR_FALSE_POSITIVE",
  "POLICY_OR_AUTHORITY_DENIAL",
  "TRANSPORT_OUTCOME_UNKNOWN",
  "CONTROLLER_CONCURRENCY_OR_REPLAY",
  "EVIDENCE_INTEGRITY_OR_DRIFT",
  "PRIVACY_OR_SECRET_HANDLING_FAILURE",
  "OWNER_CANCELLED",
] as const;

export type LearningRoutingWorkflowV1 = typeof LEARNING_ROUTING_WORKFLOWS_V1[number];
export type LearningRoutingModelAliasV1 = typeof LEARNING_ROUTING_MODEL_ALIASES_V1[number];
export type LearningRoutingThinkingProfileV1 = typeof LEARNING_ROUTING_THINKING_PROFILES_V1[number];
export type LearningRoutingContextProfileV1 = typeof LEARNING_ROUTING_CONTEXT_PROFILES_V1[number];
export type LearningRoutingVerifierProfileV1 = typeof LEARNING_ROUTING_VERIFIER_PROFILES_V1[number];
export type LearningRoutingRecoveryActionV1 = typeof LEARNING_ROUTING_RECOVERY_ACTIONS_V1[number];
export type LearningRoutingReasonCodeV1 = typeof LEARNING_ROUTING_REASON_CODES_V1[number];
export type LearningRoutingNonClaimV1 = typeof LEARNING_ROUTING_NON_CLAIMS_V1[number];

export interface LearningRoutingRouteV1 {
  readonly workflow: LearningRoutingWorkflowV1;
  readonly modelAlias: LearningRoutingModelAliasV1;
  readonly thinkingProfile: LearningRoutingThinkingProfileV1;
  readonly contextProfile: LearningRoutingContextProfileV1;
  readonly verifierProfile: LearningRoutingVerifierProfileV1;
}

export interface RoutingContextV1 {
  readonly schemaVersion: typeof ROUTING_CONTEXT_SCHEMA_V1;
  readonly episodePseudonym: string;
  readonly snapshotDigests: {
    readonly issue: string;
    readonly base: string;
    readonly projection: string;
    readonly acceptance: string;
    readonly toolchain: string;
  };
  readonly cohort: {
    readonly issueKind: "BUG" | "FEATURE" | "DOCS" | "TEST" | "REFACTOR" | "SECURITY" | "EPIC_OR_UNFROZEN";
    readonly languageFamily: "TYPESCRIPT" | "JAVASCRIPT" | "PYTHON" | "SHELL" | "MARKDOWN" | "MIXED" | "OTHER";
    readonly packageFamily: "CONTRACTS" | "CONTROLLER" | "WORKER" | "VERIFICATION" | "DEMO" | "DOCS" | "OTHER";
    readonly allowedFileCountBin: "ONE" | "TWO_TO_FIVE" | "SIX_TO_TWENTY" | "OVER_TWENTY";
    readonly projectionBytesBin: "UP_TO_32K" | "UP_TO_128K" | "UP_TO_512K" | "OVER_512K";
    readonly pathClasses: readonly ("DOCS" | "TEST" | "RUNTIME" | "POLICY" | "SECURITY" | "RELEASE")[];
    readonly hasReproduction: boolean;
    readonly acceptanceCriteriaPresent: boolean;
    readonly testProfileKnown: boolean;
    readonly dependencyRelevant: boolean;
    readonly schemaRelevant: boolean;
    readonly contractRelevant: boolean;
    readonly publicManifestRelevant: boolean;
  };
  readonly assessments: {
    readonly complexity: "LOW" | "MEDIUM" | "HIGH" | "UNFROZEN";
    readonly confidence: "LOW" | "MEDIUM" | "HIGH";
    readonly risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    readonly dataClass: "PUBLIC_OSS" | "INTERNAL" | "RESTRICTED";
    readonly explorationAllowed: boolean;
  };
  readonly observedAtMs: number;
  readonly featureCutoffMs: number;
  readonly featureSpecDigest: string;
  readonly claimBoundary: typeof LEARNING_ROUTING_CLAIM_BOUNDARY_V1;
  readonly nonClaims: readonly LearningRoutingNonClaimV1[];
  readonly contextDigest: string;
}

export interface RoutingDecisionV1 {
  readonly schemaVersion: typeof ROUTING_DECISION_SCHEMA_V1;
  readonly decisionPseudonym: string;
  readonly episodePseudonym: string;
  readonly sequence: number;
  readonly contextDigest: string;
  readonly versions: {
    readonly policy: string;
    readonly featureSpec: string;
    readonly modelCatalog: string;
    readonly priceBook: string;
    readonly routerArtifact: string;
    readonly calibration: string;
    readonly verificationGraph: string;
  };
  readonly proposer: {
    readonly kind: "STATIC_POLICY" | "RULE_BASED_CANDIDATE" | "LEARNED_CANDIDATE";
    readonly artifactDigest: string;
    readonly trust: "UNTRUSTED_PROPOSER";
  };
  readonly rankedOptions: readonly {
    readonly rank: number;
    readonly route: LearningRoutingRouteV1;
    readonly predictedSuccessPpm: number;
    readonly predictedCostMicros: number;
    readonly predictedElapsedMs: number;
    readonly uncertaintyPpm: number;
  }[];
  readonly policyEvaluation: {
    readonly allowedOptionRanks: readonly number[];
    readonly deniedOptionRanks: readonly number[];
    readonly reasonCodes: readonly LearningRoutingReasonCodeV1[];
  };
  readonly selection: {
    readonly mode: "SELECTED" | "STATIC_FALLBACK" | "HUMAN_REVIEW";
    readonly selectedOptionRank: number | null;
  };
  readonly confidence: {
    readonly band: "LOW" | "MEDIUM" | "HIGH";
    readonly supportingSampleCount: number;
  };
  readonly exploration: {
    readonly mode: "OFF" | "SHADOW" | "CANARY";
    readonly propensityPpm: number;
    readonly budgetDigest: string;
    readonly reasonCode: LearningRoutingReasonCodeV1;
  };
  readonly claimBoundary: typeof LEARNING_ROUTING_CLAIM_BOUNDARY_V1;
  readonly nonClaims: readonly LearningRoutingNonClaimV1[];
  readonly decisionDigest: string;
}

export interface RoutingAttemptV1 {
  readonly schemaVersion: typeof ROUTING_ATTEMPT_SCHEMA_V1;
  readonly attemptPseudonym: string;
  readonly episodePseudonym: string;
  readonly decisionDigest: string;
  readonly parentAttemptDigest: string | null;
  readonly action: LearningRoutingRecoveryActionV1;
  readonly route: LearningRoutingRouteV1;
  readonly routeProfileDigest: string;
  readonly idempotencyKeyDigest: string;
  readonly leaseDigest: string;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly terminalTransportState: "NOT_SENT" | "CONFIRMED" | "FAILED" | "UNKNOWN";
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly costMicros: number;
    readonly requests: number;
    readonly elapsedMs: number;
  };
  readonly candidateDigest: string | null;
  readonly evidenceDigests: readonly string[];
  readonly attemptOutcome: "CANDIDATE_PRODUCED" | "NO_CANDIDATE" | "DENIED" | "ABORTED" | "UNKNOWN";
  readonly reasonCodes: readonly LearningRoutingReasonCodeV1[];
  readonly claimBoundary: typeof LEARNING_ROUTING_CLAIM_BOUNDARY_V1;
  readonly nonClaims: readonly LearningRoutingNonClaimV1[];
  readonly attemptDigest: string;
}

export interface RoutingOutcomeV1 {
  readonly schemaVersion: typeof ROUTING_OUTCOME_SCHEMA_V1;
  readonly episodePseudonym: string;
  readonly contextDigest: string;
  readonly decisionDigests: readonly string[];
  readonly attemptDigests: readonly string[];
  readonly terminalState: "VERIFIED_RESOLVED" | "NOT_RESOLVED" | "ABORTED" | "INSUFFICIENT_EVIDENCE" | "UNKNOWN";
  readonly acceptanceSnapshotDigest: string;
  readonly evidenceSet: readonly {
    readonly evidenceType: "TEST" | "POLICY" | "SCOPE" | "SECRET_SCAN" | "CHECKSUM" | "SUPPLY_CHAIN" | "REVIEW";
    readonly origin: "DETERMINISTIC_VERIFIER" | "INDEPENDENT_REVIEWER" | "HUMAN_REVIEWER" | "UNTRUSTED_CLAIM";
    readonly digest: string;
    readonly verifierVersionDigest: string;
    readonly trust: "AUTHORITATIVE" | "NON_AUTHORITATIVE";
    readonly authoritative: boolean;
    readonly observedAtMs: number;
    readonly expiresAtMs: number;
  }[];
  readonly hardGates: readonly {
    readonly gate: "ACCEPTANCE" | "TESTS" | "POLICY" | "SCOPE" | "SECRETS" | "READBACK" | "CLEANUP";
    readonly required: boolean;
    readonly executed: boolean;
    readonly outcome: "PASS" | "FAIL" | "NOT_RUN" | "UNKNOWN";
    readonly evidenceDigest: string | null;
  }[];
  readonly externalReview: {
    readonly required: boolean;
    readonly outcome: "PASS" | "FAIL" | "NOT_REQUIRED" | "NOT_RUN";
    readonly evidenceDigest: string | null;
  };
  readonly totals: {
    readonly calls: number;
    readonly scoutCalls: number;
    readonly testRuns: number;
    readonly ciRuns: number;
    readonly humanReviewMinutes: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly costMicros: number;
    readonly elapsedMs: number;
  };
  readonly attribution: {
    readonly primary: LearningRoutingReasonCodeV1;
    readonly contributing: readonly LearningRoutingReasonCodeV1[];
    readonly confidence: "LOW" | "MEDIUM" | "HIGH";
    readonly evidenceDigests: readonly string[];
  };
  readonly claimBoundary: typeof LEARNING_ROUTING_CLAIM_BOUNDARY_V1;
  readonly nonClaims: readonly LearningRoutingNonClaimV1[];
  readonly outcomeDigest: string;
}

function recordDigest(value: Record<string, unknown>, digestField: string): string {
  const unsigned = Object.fromEntries(Object.entries(value).filter(([key]) => key !== digestField));
  return createHash("sha256").update(canonicalJson(unsigned), "utf8").digest("hex");
}

export function routingContextDigestV1(value: Omit<RoutingContextV1, "contextDigest"> | Record<string, unknown>): string {
  return recordDigest(value as Record<string, unknown>, "contextDigest");
}

export function routingDecisionDigestV1(value: Omit<RoutingDecisionV1, "decisionDigest"> | Record<string, unknown>): string {
  return recordDigest(value as Record<string, unknown>, "decisionDigest");
}

export function routingAttemptDigestV1(value: Omit<RoutingAttemptV1, "attemptDigest"> | Record<string, unknown>): string {
  return recordDigest(value as Record<string, unknown>, "attemptDigest");
}

export function routingOutcomeDigestV1(value: Omit<RoutingOutcomeV1, "outcomeDigest"> | Record<string, unknown>): string {
  return recordDigest(value as Record<string, unknown>, "outcomeDigest");
}

export function hasValidRoutingContextDigestV1(value: RoutingContextV1): boolean {
  return routingContextDigestV1(value) === value.contextDigest;
}

export function hasValidRoutingDecisionDigestV1(value: RoutingDecisionV1): boolean {
  return routingDecisionDigestV1(value) === value.decisionDigest;
}

export function hasValidRoutingAttemptDigestV1(value: RoutingAttemptV1): boolean {
  return routingAttemptDigestV1(value) === value.attemptDigest;
}

export function hasValidRoutingOutcomeDigestV1(value: RoutingOutcomeV1): boolean {
  return routingOutcomeDigestV1(value) === value.outcomeDigest;
}

/** Pure lineage check only; it cannot execute a route or grant authority. */
export function hasValidLearningRoutingLineageV1(
  context: RoutingContextV1,
  decisions: readonly RoutingDecisionV1[],
  attempts: readonly RoutingAttemptV1[],
  outcome: RoutingOutcomeV1,
): boolean {
  if (!hasValidRoutingContextDigestV1(context)
    || !hasValidRoutingOutcomeDigestV1(outcome)
    || outcome.episodePseudonym !== context.episodePseudonym
    || outcome.contextDigest !== context.contextDigest
    || outcome.acceptanceSnapshotDigest !== context.snapshotDigests.acceptance) return false;

  const decisionDigests = new Set<string>();
  for (const decision of decisions) {
    if (!hasValidRoutingDecisionDigestV1(decision)
      || decision.episodePseudonym !== context.episodePseudonym
      || decision.contextDigest !== context.contextDigest
      || decisionDigests.has(decision.decisionDigest)) return false;
    decisionDigests.add(decision.decisionDigest);
  }
  if (canonicalJson([...decisionDigests].sort()) !== canonicalJson([...outcome.decisionDigests].sort())) return false;

  const attemptDigests = new Set<string>();
  for (const attempt of attempts) {
    if (!hasValidRoutingAttemptDigestV1(attempt)
      || attempt.episodePseudonym !== context.episodePseudonym
      || !decisionDigests.has(attempt.decisionDigest)
      || attemptDigests.has(attempt.attemptDigest)) return false;
    attemptDigests.add(attempt.attemptDigest);
  }
  for (const attempt of attempts) {
    if (attempt.parentAttemptDigest !== null && !attemptDigests.has(attempt.parentAttemptDigest)) return false;
  }
  return canonicalJson([...attemptDigests].sort()) === canonicalJson([...outcome.attemptDigests].sort());
}
