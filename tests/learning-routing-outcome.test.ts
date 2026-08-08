import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  LEARNING_ROUTING_CLAIM_BOUNDARY_V1,
  LEARNING_ROUTING_NON_CLAIMS_V1,
  ROUTING_ATTEMPT_SCHEMA_V1,
  ROUTING_CONTEXT_SCHEMA_V1,
  ROUTING_DECISION_SCHEMA_V1,
  VERIFICATION_IMPACT_PLAN_SCHEMA_V2,
  VERIFICATION_SHADOW_REPORT_SCHEMA_V2,
  WORK_RECEIPT_SCHEMA_V1,
  adaptRoutingOutcomeV1,
  canonicalJson,
  hasValidLearningRoutingLineageV1,
  routingAttemptDigestV1,
  routingContextDigestV1,
  routingDecisionDigestV1,
  type RoutingAttemptV1,
  type RoutingAuthoritativeEvidenceV1,
  type RoutingContextV1,
  type RoutingDecisionV1,
  type RoutingOutcomeAdapterInputV1,
  type VerificationImpactPlanV2,
  type VerificationShadowReportV2,
  type WorkReceiptV1,
} from "../packages/contracts/src/index.js";

const d = (value: string): string => createHash("sha256").update(value).digest("hex");
const recordDigest = (value: object): string => createHash("sha256").update(canonicalJson(value)).digest("hex");

function context(): RoutingContextV1 {
  const unsigned: Omit<RoutingContextV1, "contextDigest"> = {
    schemaVersion: ROUTING_CONTEXT_SCHEMA_V1,
    episodePseudonym: `ep_${"a".repeat(32)}`,
    snapshotDigests: { issue: d("issue"), base: d("base"), projection: d("projection"), acceptance: d("acceptance"), toolchain: d("toolchain") },
    cohort: {
      issueKind: "FEATURE", languageFamily: "TYPESCRIPT", packageFamily: "CONTRACTS",
      allowedFileCountBin: "TWO_TO_FIVE", projectionBytesBin: "UP_TO_128K", pathClasses: ["TEST"],
      hasReproduction: false, acceptanceCriteriaPresent: true, testProfileKnown: true,
      dependencyRelevant: false, schemaRelevant: true, contractRelevant: true, publicManifestRelevant: true,
    },
    assessments: { complexity: "MEDIUM", confidence: "HIGH", risk: "LOW", dataClass: "PUBLIC_OSS", explorationAllowed: false },
    observedAtMs: 1_000, featureCutoffMs: 999, featureSpecDigest: d("feature"),
    claimBoundary: LEARNING_ROUTING_CLAIM_BOUNDARY_V1, nonClaims: LEARNING_ROUTING_NON_CLAIMS_V1,
  };
  return { ...unsigned, contextDigest: routingContextDigestV1(unsigned) };
}

function decision(input: RoutingContextV1): RoutingDecisionV1 {
  const unsigned: Omit<RoutingDecisionV1, "decisionDigest"> = {
    schemaVersion: ROUTING_DECISION_SCHEMA_V1, decisionPseudonym: `dec_${"b".repeat(32)}`,
    episodePseudonym: input.episodePseudonym, sequence: 0, contextDigest: input.contextDigest,
    versions: { policy: d("policy"), featureSpec: input.featureSpecDigest, modelCatalog: d("catalog"),
      priceBook: d("price"), routerArtifact: d("router"), calibration: d("calibration"), verificationGraph: d("graph") },
    proposer: { kind: "STATIC_POLICY", artifactDigest: d("static"), trust: "UNTRUSTED_PROPOSER" },
    rankedOptions: [{ rank: 0, route: { workflow: "PLAN_FIRST", modelAlias: "cm.dev.primary", thinkingProfile: "STANDARD",
      contextProfile: "ISSUE_AND_BASE", verifierProfile: "STANDARD" }, predictedSuccessPpm: 800_000,
      predictedCostMicros: 200, predictedElapsedMs: 2_000, uncertaintyPpm: 100_000 }],
    policyEvaluation: { allowedOptionRanks: [0], deniedOptionRanks: [], reasonCodes: [] },
    selection: { mode: "STATIC_FALLBACK", selectedOptionRank: 0 },
    confidence: { band: "MEDIUM", supportingSampleCount: 0 },
    exploration: { mode: "OFF", propensityPpm: 0, budgetDigest: d("budget"), reasonCode: "POLICY_OR_AUTHORITY_DENIAL" },
    claimBoundary: LEARNING_ROUTING_CLAIM_BOUNDARY_V1, nonClaims: LEARNING_ROUTING_NON_CLAIMS_V1,
  };
  return { ...unsigned, decisionDigest: routingDecisionDigestV1(unsigned) };
}

function attempt(input: RoutingContextV1, selected: RoutingDecisionV1, overrides: Partial<RoutingAttemptV1> = {}): RoutingAttemptV1 {
  const candidateDigest = d("candidate");
  const unsigned: Omit<RoutingAttemptV1, "attemptDigest"> = {
    schemaVersion: ROUTING_ATTEMPT_SCHEMA_V1, attemptPseudonym: `att_${"c".repeat(32)}`,
    episodePseudonym: input.episodePseudonym, decisionDigest: selected.decisionDigest, parentAttemptDigest: null,
    action: "INITIAL", route: selected.rankedOptions[0]!.route, routeProfileDigest: d("route"),
    idempotencyKeyDigest: d("idempotency"), leaseDigest: d("lease"), startedAtMs: 1_100, endedAtMs: 1_300,
    terminalTransportState: "CONFIRMED", usage: { inputTokens: 100, outputTokens: 20, costMicros: 200, requests: 1, elapsedMs: 200 },
    candidateDigest, evidenceDigests: [d("test-evidence")], attemptOutcome: "CANDIDATE_PRODUCED", reasonCodes: [],
    claimBoundary: LEARNING_ROUTING_CLAIM_BOUNDARY_V1, nonClaims: LEARNING_ROUTING_NON_CLAIMS_V1,
    ...overrides,
  };
  return { ...unsigned, attemptDigest: routingAttemptDigestV1(unsigned) };
}

function receipt(selected: RoutingAttemptV1, overrides: Partial<WorkReceiptV1> = {}): WorkReceiptV1 {
  const unsigned: Omit<WorkReceiptV1, "receiptDigest"> = {
    schemaVersion: WORK_RECEIPT_SCHEMA_V1, workOrderDigest: d("work-order"), outcome: "SUCCEEDED",
    baseCommit: "1".repeat(40), candidateCommit: null, changedPaths: ["packages/contracts/src/fixture.ts"],
    changedPathsDigest: d("changed"), patchDigest: selected.candidateDigest!,
    tests: [{ command: "npm test", outcome: "PASS", outputDigest: d("test-output") }],
    review: { outcome: "PASS", findings: [] },
    modelUsage: { alias: selected.route.modelAlias, providerPolicyDigest: d("provider-policy"),
      requests: selected.usage.requests, inputTokens: selected.usage.inputTokens,
      outputTokens: selected.usage.outputTokens, costMicros: selected.usage.costMicros },
    capabilityUsage: ["cm.dev.test.run"], publication: { performed: false, identifiers: [] },
    readback: { synthetic: true, digest: d("readback") }, cleanup: { outcome: "PASS", writableStateRemaining: false },
    nonClaims: ["LOCAL_SYNTHETIC_ONLY"], ...overrides,
  };
  return { ...unsigned, receiptDigest: recordDigest(unsigned) };
}

function shadowReport(mode: VerificationImpactPlanV2["mode"] = "FULL_FALLBACK"): VerificationShadowReportV2 {
  const unsigned: Omit<VerificationImpactPlanV2, "planDigest"> = {
    schemaVersion: VERIFICATION_IMPACT_PLAN_SCHEMA_V2, mode, baseSha: "1".repeat(40), headSha: "2".repeat(40),
    graphDigest: d("graph"), changedPaths: ["packages/contracts/src/fixture.ts"], selectedNodes: ["repository-integrity"],
    selectedTests: ["npm test"], hardGates: ["npm test"], reasons: mode === "FULL_FALLBACK" ? ["UNMAPPED_PATH"] : [],
    authoritativeComparator: "npm test",
  };
  const plan = { ...unsigned, planDigest: recordDigest(unsigned) };
  return { schemaVersion: VERIFICATION_SHADOW_REPORT_SCHEMA_V2, status: "SHADOW_PASS",
    activation: "BLOCKED_SAMPLE_GATE", plan,
    comparator: { command: "npm test", authoritative: true, executed: true, exitCode: 0 } };
}

const gateTypes = {
  ACCEPTANCE: "TEST", TESTS: "TEST", POLICY: "POLICY", SCOPE: "SCOPE", SECRETS: "SECRET_SCAN",
  READBACK: "REVIEW", CLEANUP: "REVIEW",
} as const;

function fixture(): RoutingOutcomeAdapterInputV1 {
  const inputContext = context();
  const inputDecision = decision(inputContext);
  const inputAttempt = attempt(inputContext, inputDecision);
  const gates = Object.keys(gateTypes).map((gate, index) => ({
    gate: gate as keyof typeof gateTypes, required: true, executed: true, outcome: "PASS" as const,
    evidenceDigest: d(`gate-${index}`),
  }));
  const evidence: RoutingAuthoritativeEvidenceV1[] = gates.map((gate) => ({
    evidenceType: gateTypes[gate.gate], origin: "DETERMINISTIC_VERIFIER", digest: gate.evidenceDigest!,
    verifierVersionDigest: d(`verifier-${gate.gate}`), trust: "AUTHORITATIVE", authoritative: true,
    subjectDigest: inputAttempt.candidateDigest!, acceptanceSnapshotDigest: inputContext.snapshotDigests.acceptance,
    observedAtMs: 1_500, expiresAtMs: 2_500,
  }));
  return { context: inputContext, decisions: [inputDecision], attempts: [inputAttempt],
    receipts: [{ attemptDigest: inputAttempt.attemptDigest, receipt: receipt(inputAttempt), ciRuns: 1, humanReviewMinutes: 3 }],
    verificationReports: [shadowReport()], evidence, hardGates: gates,
    externalReview: { required: false, outcome: "NOT_REQUIRED", evidenceDigest: null }, nowMs: 2_000 };
}

test("LR-002 produces VERIFIED_RESOLVED only from complete authoritative full-fallback evidence", () => {
  const input = fixture();
  const outcome = adaptRoutingOutcomeV1(input);
  assert.equal(outcome.terminalState, "VERIFIED_RESOLVED");
  assert.deepEqual(outcome.totals, { calls: 1, scoutCalls: 0, testRuns: 1, ciRuns: 1, humanReviewMinutes: 3,
    inputTokens: 100, outputTokens: 20, costMicros: 200, elapsedMs: 200 });
  assert.equal(hasValidLearningRoutingLineageV1(input.context, input.decisions, input.attempts, outcome), true);
  assert.deepEqual(adaptRoutingOutcomeV1(structuredClone(input)), outcome);
});

test("LR-002 missing stale tampered mismatched and unrun evidence deny success", () => {
  const cases: readonly [string, (input: RoutingOutcomeAdapterInputV1) => void][] = [
    ["missing", (input) => (input as unknown as { evidence: RoutingAuthoritativeEvidenceV1[] }).evidence.pop()],
    ["stale", (input) => ((input.evidence[0] as { expiresAtMs: number }).expiresAtMs = 1_999)],
    ["tampered-report", (input) => ((input.verificationReports[0]!.plan as { graphDigest: string }).graphDigest = d("tampered"))],
    ["mismatched-subject", (input) => ((input.evidence[0] as { subjectDigest: string }).subjectDigest = d("other"))],
    ["unrun", (input) => ((input.hardGates[0] as { executed: boolean; outcome: string }).executed = false,
      (input.hardGates[0] as { outcome: string }).outcome = "NOT_RUN")],
  ];
  for (const [caseId, mutate] of cases) {
    const input = structuredClone(fixture());
    mutate(input);
    const outcome = adaptRoutingOutcomeV1(input);
    assert.equal(outcome.terminalState, "INSUFFICIENT_EVIDENCE", caseId);
    assert.ok(outcome.attribution.contributing.includes("EVIDENCE_INTEGRITY_OR_DRIFT")
      || outcome.attribution.primary === "EVIDENCE_INTEGRITY_OR_DRIFT"
      || outcome.attribution.contributing.includes("VERIFICATION_GAP_OR_FALSE_POSITIVE")
      || outcome.attribution.primary === "VERIFICATION_GAP_OR_FALSE_POSITIVE", caseId);
  }
});

test("LR-002 unknown transport is UNKNOWN and preserves multi-cause attribution without retry inference", () => {
  const input = fixture();
  const original = input.attempts[0]!;
  const unknown = attempt(input.context, input.decisions[0]!, { terminalTransportState: "UNKNOWN", attemptOutcome: "UNKNOWN",
    reasonCodes: ["TRANSPORT_OUTCOME_UNKNOWN", "TOOL_OR_ENVIRONMENT_FAILURE"] });
  const changed = { ...input, attempts: [unknown], receipts: [] };
  const outcome = adaptRoutingOutcomeV1(changed);
  assert.equal(outcome.terminalState, "UNKNOWN");
  assert.equal(outcome.attribution.primary, "TRANSPORT_OUTCOME_UNKNOWN");
  assert.ok(outcome.attribution.contributing.includes("TOOL_OR_ENVIRONMENT_FAILURE"));
  assert.equal(outcome.attribution.contributing.includes("MODEL_CAPABILITY_LIMIT"), false);
  assert.equal(outcome.attemptDigests.includes(original.attemptDigest), false);
});

test("LR-002 cleanup and readback negatives never resolve", () => {
  for (const caseId of ["cleanup", "readback"] as const) {
    const input = fixture();
    const selected = input.attempts[0]!;
    const badReceipt = caseId === "cleanup"
      ? receipt(selected, { cleanup: { outcome: "PASS", writableStateRemaining: true } } as unknown as Partial<WorkReceiptV1>)
      : receipt(selected, { readback: { synthetic: false, digest: d("readback") } } as unknown as Partial<WorkReceiptV1>);
    const changed = { ...input, receipts: [{ ...input.receipts[0]!, receipt: badReceipt }] };
    assert.equal(adaptRoutingOutcomeV1(changed).terminalState, "INSUFFICIENT_EVIDENCE", caseId);
  }
});

test("LR-002 failed gates and aborted attempts retain terminal semantics", () => {
  const failed = fixture();
  (failed.hardGates[0] as { outcome: string }).outcome = "FAIL";
  assert.equal(adaptRoutingOutcomeV1(failed).terminalState, "NOT_RESOLVED");

  const aborted = fixture();
  const abortAttempt = attempt(aborted.context, aborted.decisions[0]!, { terminalTransportState: "NOT_SENT",
    attemptOutcome: "ABORTED", candidateDigest: null, reasonCodes: ["OWNER_CANCELLED"] });
  assert.equal(adaptRoutingOutcomeV1({ ...aborted, attempts: [abortAttempt], receipts: [], evidence: [] }).terminalState, "ABORTED");
});
