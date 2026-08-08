import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import {
  LEARNING_ROUTING_CLAIM_BOUNDARY_V1,
  LEARNING_ROUTING_NON_CLAIMS_V1,
  ROUTING_ATTEMPT_SCHEMA_V1,
  ROUTING_CONTEXT_SCHEMA_V1,
  ROUTING_DECISION_SCHEMA_V1,
  ROUTING_OUTCOME_SCHEMA_V1,
  hasValidLearningRoutingLineageV1,
  hasValidRoutingAttemptDigestV1,
  hasValidRoutingContextDigestV1,
  hasValidRoutingDecisionDigestV1,
  hasValidRoutingOutcomeDigestV1,
  routingAttemptDigestV1,
  routingContextDigestV1,
  routingDecisionDigestV1,
  routingOutcomeDigestV1,
  type RoutingAttemptV1,
  type RoutingContextV1,
  type RoutingDecisionV1,
  type RoutingOutcomeV1,
} from "../packages/contracts/src/index.js";

const DIGESTS = Array.from({ length: 32 }, (_, index) => (index + 1).toString(16).padStart(2, "0").repeat(32));
const digest = (index: number): string => DIGESTS[index] ?? DIGESTS[0]!;

function compileSchema(filename: string): ValidateFunction {
  const schema = JSON.parse(readFileSync(`schemas/contracts/${filename}`, "utf8")) as object;
  return new Ajv2020({ allErrors: true, strict: true }).compile(schema);
}

const validators = {
  context: compileSchema("routing-context-v1.schema.json"),
  decision: compileSchema("routing-decision-v1.schema.json"),
  attempt: compileSchema("routing-attempt-v1.schema.json"),
  outcome: compileSchema("routing-outcome-v1.schema.json"),
};

function contextFixture(): RoutingContextV1 {
  const unsigned: Omit<RoutingContextV1, "contextDigest"> = {
    schemaVersion: ROUTING_CONTEXT_SCHEMA_V1,
    episodePseudonym: `ep_${"a".repeat(32)}`,
    snapshotDigests: { issue: digest(1), base: digest(2), projection: digest(3), acceptance: digest(4), toolchain: digest(5) },
    cohort: {
      issueKind: "FEATURE", languageFamily: "TYPESCRIPT", packageFamily: "CONTRACTS",
      allowedFileCountBin: "TWO_TO_FIVE", projectionBytesBin: "UP_TO_128K", pathClasses: ["TEST"],
      hasReproduction: false, acceptanceCriteriaPresent: true, testProfileKnown: true,
      dependencyRelevant: false, schemaRelevant: true, contractRelevant: true, publicManifestRelevant: false,
    },
    assessments: { complexity: "MEDIUM", confidence: "HIGH", risk: "LOW", dataClass: "PUBLIC_OSS", explorationAllowed: false },
    observedAtMs: 1_786_182_400_000,
    featureCutoffMs: 1_786_182_399_000,
    featureSpecDigest: digest(6),
    claimBoundary: LEARNING_ROUTING_CLAIM_BOUNDARY_V1,
    nonClaims: LEARNING_ROUTING_NON_CLAIMS_V1,
  };
  return { ...unsigned, contextDigest: routingContextDigestV1(unsigned) };
}

function decisionFixture(context: RoutingContextV1): RoutingDecisionV1 {
  const unsigned: Omit<RoutingDecisionV1, "decisionDigest"> = {
    schemaVersion: ROUTING_DECISION_SCHEMA_V1,
    decisionPseudonym: `dec_${"b".repeat(32)}`,
    episodePseudonym: context.episodePseudonym,
    sequence: 0,
    contextDigest: context.contextDigest,
    versions: {
      policy: digest(7), featureSpec: context.featureSpecDigest, modelCatalog: digest(8), priceBook: digest(9),
      routerArtifact: digest(10), calibration: digest(11), verificationGraph: digest(12),
    },
    proposer: { kind: "RULE_BASED_CANDIDATE", artifactDigest: digest(13), trust: "UNTRUSTED_PROPOSER" },
    rankedOptions: [{
      rank: 0,
      route: { workflow: "PLAN_FIRST", modelAlias: "cm.dev.primary", thinkingProfile: "STANDARD", contextProfile: "ISSUE_AND_BASE", verifierProfile: "STANDARD" },
      predictedSuccessPpm: 800_000, predictedCostMicros: 40_000, predictedElapsedMs: 120_000, uncertaintyPpm: 100_000,
    }],
    policyEvaluation: { allowedOptionRanks: [0], deniedOptionRanks: [], reasonCodes: [] },
    selection: { mode: "STATIC_FALLBACK", selectedOptionRank: 0 },
    confidence: { band: "MEDIUM", supportingSampleCount: 0 },
    exploration: { mode: "OFF", propensityPpm: 0, budgetDigest: digest(14), reasonCode: "POLICY_OR_AUTHORITY_DENIAL" },
    claimBoundary: LEARNING_ROUTING_CLAIM_BOUNDARY_V1,
    nonClaims: LEARNING_ROUTING_NON_CLAIMS_V1,
  };
  return { ...unsigned, decisionDigest: routingDecisionDigestV1(unsigned) };
}

function attemptFixture(context: RoutingContextV1, decision: RoutingDecisionV1): RoutingAttemptV1 {
  const unsigned: Omit<RoutingAttemptV1, "attemptDigest"> = {
    schemaVersion: ROUTING_ATTEMPT_SCHEMA_V1,
    attemptPseudonym: `att_${"c".repeat(32)}`,
    episodePseudonym: context.episodePseudonym,
    decisionDigest: decision.decisionDigest,
    parentAttemptDigest: null,
    action: "INITIAL",
    route: decision.rankedOptions[0]!.route,
    routeProfileDigest: digest(15), idempotencyKeyDigest: digest(16), leaseDigest: digest(17),
    startedAtMs: 1_786_182_401_000, endedAtMs: 1_786_182_403_000,
    terminalTransportState: "NOT_SENT",
    usage: { inputTokens: 0, outputTokens: 0, costMicros: 0, requests: 0, elapsedMs: 2_000 },
    candidateDigest: null,
    evidenceDigests: [digest(18)],
    attemptOutcome: "NO_CANDIDATE",
    reasonCodes: ["POLICY_OR_AUTHORITY_DENIAL"],
    claimBoundary: LEARNING_ROUTING_CLAIM_BOUNDARY_V1,
    nonClaims: LEARNING_ROUTING_NON_CLAIMS_V1,
  };
  return { ...unsigned, attemptDigest: routingAttemptDigestV1(unsigned) };
}

function outcomeFixture(context: RoutingContextV1, decision: RoutingDecisionV1, attempt: RoutingAttemptV1): RoutingOutcomeV1 {
  const unsigned: Omit<RoutingOutcomeV1, "outcomeDigest"> = {
    schemaVersion: ROUTING_OUTCOME_SCHEMA_V1,
    episodePseudonym: context.episodePseudonym,
    contextDigest: context.contextDigest,
    decisionDigests: [decision.decisionDigest],
    attemptDigests: [attempt.attemptDigest],
    terminalState: "INSUFFICIENT_EVIDENCE",
    acceptanceSnapshotDigest: context.snapshotDigests.acceptance,
    evidenceSet: [{
      evidenceType: "POLICY", origin: "DETERMINISTIC_VERIFIER", digest: digest(18),
      verifierVersionDigest: digest(19), trust: "AUTHORITATIVE", authoritative: true,
      observedAtMs: 1_786_182_404_000, expiresAtMs: 1_786_268_804_000,
    }],
    hardGates: [{ gate: "TESTS", required: true, executed: false, outcome: "NOT_RUN", evidenceDigest: null }],
    externalReview: { required: false, outcome: "NOT_REQUIRED", evidenceDigest: null },
    totals: { calls: 0, scoutCalls: 0, testRuns: 0, ciRuns: 0, humanReviewMinutes: 0, inputTokens: 0, outputTokens: 0, costMicros: 0, elapsedMs: 3_000 },
    attribution: { primary: "POLICY_OR_AUTHORITY_DENIAL", contributing: [], confidence: "HIGH", evidenceDigests: [digest(18)] },
    claimBoundary: LEARNING_ROUTING_CLAIM_BOUNDARY_V1,
    nonClaims: LEARNING_ROUTING_NON_CLAIMS_V1,
  };
  return { ...unsigned, outcomeDigest: routingOutcomeDigestV1(unsigned) };
}

function fixtures(): [RoutingContextV1, RoutingDecisionV1, RoutingAttemptV1, RoutingOutcomeV1] {
  const context = contextFixture();
  const decision = decisionFixture(context);
  const attempt = attemptFixture(context, decision);
  return [context, decision, attempt, outcomeFixture(context, decision, attempt)];
}

function reordered(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return value.map((item, index) => reordered(item, seed + index + 1));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  let state = seed >>> 0;
  for (let index = entries.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swap = state % (index + 1);
    [entries[index], entries[swap]] = [entries[swap]!, entries[index]!];
  }
  return Object.fromEntries(entries.map(([key, item], index) => [key, reordered(item, seed + index + 17)]));
}

test("LR-001 freezes four closed schemas and valid digest-bound fixtures", () => {
  const [context, decision, attempt, outcome] = fixtures();
  const records = [
    ["context", validators.context, context, hasValidRoutingContextDigestV1],
    ["decision", validators.decision, decision, hasValidRoutingDecisionDigestV1],
    ["attempt", validators.attempt, attempt, hasValidRoutingAttemptDigestV1],
    ["outcome", validators.outcome, outcome, hasValidRoutingOutcomeDigestV1],
  ] as const;
  for (const [recordId, validate, value, digestValid] of records) {
    assert.equal(validate(value), true, `${recordId}: ${JSON.stringify(validate.errors)}`);
    assert.equal(digestValid(value as never), true, recordId);
  }
  assert.equal(hasValidLearningRoutingLineageV1(context, [decision], [attempt], outcome), true);
});

test("LR-001 canonical digests survive 100 object-key reorderings per contract", () => {
  const [context, decision, attempt, outcome] = fixtures();
  const records = [
    ["context", validators.context, context, routingContextDigestV1, context.contextDigest],
    ["decision", validators.decision, decision, routingDecisionDigestV1, decision.decisionDigest],
    ["attempt", validators.attempt, attempt, routingAttemptDigestV1, attempt.attemptDigest],
    ["outcome", validators.outcome, outcome, routingOutcomeDigestV1, outcome.outcomeDigest],
  ] as const;
  for (const [recordId, validate, value, computeDigest, expectedDigest] of records) {
    for (let seed = 1; seed <= 100; seed += 1) {
      const candidate = reordered(value, seed) as Record<string, unknown>;
      assert.equal(validate(candidate), true, `${recordId}/${seed}: ${JSON.stringify(validate.errors)}`);
      assert.equal(computeDigest(candidate), expectedDigest, `${recordId}/${seed}`);
    }
  }
});

test("LR-001 denies unknown authority budget runtime and prohibited raw-content fields", () => {
  const [context, decision, attempt, outcome] = fixtures();
  const seededSecret = "ghp_seeded_secret_must_never_persist";
  const cases: readonly [string, ValidateFunction, Record<string, unknown>][] = [
    ["context-prompt", validators.context, { ...context, prompt: seededSecret }],
    ["context-path", validators.context, { ...context, cohort: { ...context.cohort, filePath: "/private/repo/file.ts" } }],
    ["decision-authority", validators.decision, { ...decision, authority: "MERGE" }],
    ["decision-route-budget", validators.decision, { ...decision, rankedOptions: [{ ...decision.rankedOptions[0]!, route: { ...decision.rankedOptions[0]!.route, budget: 9_999_999 } }] }],
    ["decision-route-runtime", validators.decision, { ...decision, rankedOptions: [{ ...decision.rankedOptions[0]!, route: { ...decision.rankedOptions[0]!.route, runtime: "ACTIVE" } }] }],
    ["attempt-response", validators.attempt, { ...attempt, rawResponse: seededSecret }],
    ["attempt-command-output", validators.attempt, { ...attempt, usage: { ...attempt.usage, commandOutput: seededSecret } }],
    ["outcome-user-id", validators.outcome, { ...outcome, userId: "6565471155" }],
    ["outcome-evidence-raw", validators.outcome, { ...outcome, evidenceSet: [{ ...outcome.evidenceSet[0]!, rawEvidence: seededSecret }] }],
  ];
  for (const [caseId, validate, candidate] of cases) {
    assert.equal(validate(candidate), false, caseId);
  }
});

test("LR-001 denies enum crossover and claim-boundary drift", () => {
  const [context, decision, attempt, outcome] = fixtures();
  const cases: readonly [string, ValidateFunction, Record<string, unknown>][] = [
    ["complexity-risk", validators.context, { ...context, assessments: { ...context.assessments, complexity: "CRITICAL" } }],
    ["risk-confidence", validators.context, { ...context, assessments: { ...context.assessments, risk: "MEDIUM_CONFIDENCE" } }],
    ["workflow-recovery", validators.decision, { ...decision, rankedOptions: [{ ...decision.rankedOptions[0]!, route: { ...decision.rankedOptions[0]!.route, workflow: "REFLECT" } }] }],
    ["model-workflow", validators.decision, { ...decision, rankedOptions: [{ ...decision.rankedOptions[0]!, route: { ...decision.rankedOptions[0]!.route, modelAlias: "PLAN_FIRST" } }] }],
    ["thinking-context", validators.decision, { ...decision, rankedOptions: [{ ...decision.rankedOptions[0]!, route: { ...decision.rankedOptions[0]!.route, thinkingProfile: "ISSUE_ONLY" } }] }],
    ["verifier-model", validators.attempt, { ...attempt, route: { ...attempt.route, verifierProfile: "cm.dev.review" } }],
    ["outcome-reason-state", validators.outcome, { ...outcome, terminalState: "OWNER_CANCELLED" }],
    ["claim-boundary", validators.outcome, { ...outcome, claimBoundary: "PRODUCTION_ACTIVE" }],
  ];
  for (const [caseId, validate, candidate] of cases) assert.equal(validate(candidate), false, caseId);
});

test("LR-001 detects digest drift and cross-record lineage tampering", () => {
  const [context, decision, attempt, outcome] = fixtures();
  const contextDrift = { ...context, observedAtMs: context.observedAtMs + 1 } as RoutingContextV1;
  assert.equal(validators.context(contextDrift), true);
  assert.equal(hasValidRoutingContextDigestV1(contextDrift), false);

  const wrongContextDecisionUnsigned = { ...decision, contextDigest: digest(20) };
  const wrongContextDecision = {
    ...wrongContextDecisionUnsigned,
    decisionDigest: routingDecisionDigestV1(wrongContextDecisionUnsigned),
  } as RoutingDecisionV1;
  assert.equal(validators.decision(wrongContextDecision), true);
  assert.equal(hasValidRoutingDecisionDigestV1(wrongContextDecision), true);
  assert.equal(hasValidLearningRoutingLineageV1(context, [wrongContextDecision], [attempt], outcome), false);

  const wrongDecisionAttemptUnsigned = { ...attempt, decisionDigest: digest(21) };
  const wrongDecisionAttempt = {
    ...wrongDecisionAttemptUnsigned,
    attemptDigest: routingAttemptDigestV1(wrongDecisionAttemptUnsigned),
  } as RoutingAttemptV1;
  assert.equal(validators.attempt(wrongDecisionAttempt), true);
  assert.equal(hasValidLearningRoutingLineageV1(context, [decision], [wrongDecisionAttempt], outcome), false);

  const wrongAcceptanceOutcomeUnsigned = { ...outcome, acceptanceSnapshotDigest: digest(22) };
  const wrongAcceptanceOutcome = {
    ...wrongAcceptanceOutcomeUnsigned,
    outcomeDigest: routingOutcomeDigestV1(wrongAcceptanceOutcomeUnsigned),
  } as RoutingOutcomeV1;
  assert.equal(validators.outcome(wrongAcceptanceOutcome), true);
  assert.equal(hasValidLearningRoutingLineageV1(context, [decision], [attempt], wrongAcceptanceOutcome), false);
});
