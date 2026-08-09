import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";

import {
  BI_EXECUTION_SPINE_CLAIM_BOUNDARY_V1,
  BI_EXECUTION_SPINE_DENIED_CAPABILITIES_V1,
  BI_EXECUTION_SPINE_PROHIBITED_FIELDS_V1,
  BI_EXECUTION_SPINE_REQUIRED_QUESTIONS_V1,
  biExecutionSpineBundleDigestV1,
  biExecutionSpineClaimDigestV1,
  biExecutionSpinePlanDigestV1,
  biExecutionSpineQuestionDigestV1,
  biExecutionSpineReceiptDigestV1,
  biExecutionSpineVisualizationDigestV1,
  evaluateBiExecutionSpineV1,
  renderPublicBiExecutionSpineDecisionV1,
  type BiExecutionSpineBundleV1,
  type BiExecutionSpineQuestionV1,
  type BiExecutionSpineReasonCodeV1,
} from "../packages/contracts/src/index.js";

interface MutationFixture {
  readonly caseId: string;
  readonly operation: "replace" | "delete";
  readonly path: string;
  readonly value?: unknown;
  readonly expectedReason: BiExecutionSpineReasonCodeV1;
}

function fixture(): BiExecutionSpineBundleV1 {
  const raw = JSON.parse(readFileSync(
    "tests/fixtures/bi-execution-spine/positive-bundle-v1.json",
    "utf8",
  )) as BiExecutionSpineBundleV1;
  return raw;
}

function rehash(source: BiExecutionSpineBundleV1): BiExecutionSpineBundleV1 {
  const result = structuredClone(source) as unknown as Record<string, any>;
  result.questions = result.questions.map((question: BiExecutionSpineQuestionV1) => {
    const updated = structuredClone(question) as unknown as Record<string, any>;
    updated.queryPlan.planDigest = biExecutionSpinePlanDigestV1(updated.queryPlan);
    updated.executionReceipt.receiptDigest = biExecutionSpineReceiptDigestV1(updated.executionReceipt);
    updated.claim.claimDigest = biExecutionSpineClaimDigestV1(updated.claim);
    updated.visualization.visualizationDigest = biExecutionSpineVisualizationDigestV1(updated.visualization);
    updated.questionDigest = biExecutionSpineQuestionDigestV1(updated as BiExecutionSpineQuestionV1);
    return updated;
  });
  result.bundleDigest = biExecutionSpineBundleDigestV1(result as BiExecutionSpineBundleV1);
  return result as BiExecutionSpineBundleV1;
}

function rehashEnvelope(source: BiExecutionSpineBundleV1): BiExecutionSpineBundleV1 {
  const result = structuredClone(source) as unknown as Record<string, any>;
  result.questions = result.questions.map((question: BiExecutionSpineQuestionV1) => ({
    ...question,
    questionDigest: biExecutionSpineQuestionDigestV1(question),
  }));
  result.bundleDigest = biExecutionSpineBundleDigestV1(result as BiExecutionSpineBundleV1);
  return result as BiExecutionSpineBundleV1;
}

function replacePath(target: Record<string, any>, pointer: string, value: unknown): void {
  const parts = pointer.split("/").slice(1);
  const leaf = parts.pop();
  assert.ok(leaf !== undefined);
  let parent: any = target;
  for (const part of parts) parent = Array.isArray(parent) ? parent[Number(part)] : parent[part];
  parent[leaf] = value;
}

function deletePath(target: Record<string, any>, pointer: string): void {
  const parts = pointer.split("/").slice(1);
  const leaf = parts.pop();
  assert.ok(leaf !== undefined);
  let parent: any = target;
  for (const part of parts) parent = Array.isArray(parent) ? parent[Number(part)] : parent[part];
  delete parent[leaf];
}

function mutate(source: BiExecutionSpineBundleV1, mutation: MutationFixture): BiExecutionSpineBundleV1 {
  const result = structuredClone(source) as unknown as Record<string, any>;
  if (mutation.operation === "delete") deletePath(result, mutation.path);
  else replacePath(result, mutation.path, mutation.value);
  return rehash(result as BiExecutionSpineBundleV1);
}

function reorderObjects(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return value.map((item) => reorderObjects(item, seed + 1));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  const offset = entries.length === 0 ? 0 : seed % entries.length;
  const rotated = [...entries.slice(offset), ...entries.slice(0, offset)];
  if (seed % 2 === 1) rotated.reverse();
  return Object.fromEntries(rotated.map(([key, item], index) => [key, reorderObjects(item, seed + index + 1)]));
}

test("CM-BI-EXEC-001 freezes a governed BI execution spine schema", () => {
  const schema = JSON.parse(readFileSync(
    "schemas/contracts/bi-execution-spine-v1.schema.json",
    "utf8",
  )) as object;
  const input = fixture();
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(input), true, JSON.stringify(validate.errors));
  assert.deepEqual(evaluateBiExecutionSpineV1(input), {
    schemaVersion: "chimpmaera.cm-bi-exec/governed-bi-execution-spine-decision/v1",
    outcome: "VERIFIED",
    reasonCodes: ["BI_EXECUTION_SPINE_VERIFIED"],
    questionCount: 3,
    claimBoundary: BI_EXECUTION_SPINE_CLAIM_BOUNDARY_V1,
    bundleDigest: input.bundleDigest,
  });
  assert.deepEqual(input.questions.map((question) => question.questionId), [...BI_EXECUTION_SPINE_REQUIRED_QUESTIONS_V1]);
  assert.ok(input.questions[0]);
  assert.deepEqual(input.questions[0].queryPlan.capabilitiesDenied, [...BI_EXECUTION_SPINE_DENIED_CAPABILITIES_V1]);
});

test("CM-BI-EXEC-001 binds deterministic receipts verification reports claims and visualizations", () => {
  const input = fixture();
  assert.equal(input.questions.length, 3);
  for (const question of input.questions) {
    assert.equal(biExecutionSpinePlanDigestV1(question.queryPlan), question.queryPlan.planDigest);
    assert.equal(biExecutionSpineReceiptDigestV1(question.executionReceipt), question.executionReceipt.receiptDigest);
    assert.equal(biExecutionSpineClaimDigestV1(question.claim), question.claim.claimDigest);
    assert.equal(biExecutionSpineVisualizationDigestV1(question.visualization), question.visualization.visualizationDigest);
    assert.equal(biExecutionSpineQuestionDigestV1(question), question.questionDigest);
    assert.equal(question.executionReceipt.status, "SIMULATED_VERIFIED");
    assert.equal(question.verificationReport.outcome, "VERIFIED");
    assert.equal(question.claim.confidence, "BOUNDED_SYNTHETIC");
    assert.equal(question.visualization.unsupportedReason, null);
  }
  assert.equal(biExecutionSpineBundleDigestV1(input), input.bundleDigest);
});

test("CM-BI-EXEC-001 canonical bundle digest is stable across 100 object-key reorderings", () => {
  const expected = fixture().bundleDigest;
  for (let index = 0; index < 100; index += 1) {
    const reordered = reorderObjects(fixture(), index) as BiExecutionSpineBundleV1;
    assert.equal(biExecutionSpineBundleDigestV1(reordered), expected, `reordering ${index}`);
  }
});

test("CM-BI-EXEC-001 negative matrix denies unsafe BI execution expansion", () => {
  const cases = JSON.parse(readFileSync(
    "tests/fixtures/bi-execution-spine/negative-matrix-v1.json",
    "utf8",
  )) as MutationFixture[];
  assert.equal(cases.length, 12);
  for (const negative of cases) {
    const result = evaluateBiExecutionSpineV1(mutate(fixture(), negative));
    assert.equal(result.outcome, "DENIED", negative.caseId);
    assert.ok(result.reasonCodes.includes(negative.expectedReason), `${negative.caseId}:${result.reasonCodes.join(",")}`);
  }
});

test("CM-BI-EXEC-001 denies stale nested digests after an envelope rehash", () => {
  const input = structuredClone(fixture()) as unknown as Record<string, any>;
  input.questions[0].queryPlan.planDigest = "f".repeat(64);
  assert.deepEqual(evaluateBiExecutionSpineV1(rehashEnvelope(input as BiExecutionSpineBundleV1)), {
    schemaVersion: "chimpmaera.cm-bi-exec/governed-bi-execution-spine-decision/v1",
    outcome: "DENIED",
    reasonCodes: ["BI_EXECUTION_SPINE_ARTIFACT_DIGEST_DENIED"],
    claimBoundary: BI_EXECUTION_SPINE_CLAIM_BOUNDARY_V1,
  });
});

test("CM-BI-EXEC-001 denies sensitive values and contradictory authority claims in allowed fields", () => {
  const sensitive = structuredClone(fixture()) as unknown as Record<string, any>;
  sensitive.questions[0].intent.naturalLanguage = `Read ${["", "home", "operator", "private", "cm-bi.json"].join("/")}`;
  assert.deepEqual(evaluateBiExecutionSpineV1(rehash(sensitive as BiExecutionSpineBundleV1)), {
    schemaVersion: "chimpmaera.cm-bi-exec/governed-bi-execution-spine-decision/v1",
    outcome: "DENIED",
    reasonCodes: ["BI_EXECUTION_SPINE_SENSITIVE_VALUE_DENIED"],
    claimBoundary: BI_EXECUTION_SPINE_CLAIM_BOUNDARY_V1,
  });

  const authority = structuredClone(fixture()) as unknown as Record<string, any>;
  authority.questions[0].claim.statement = "This is the authoritative production answer.";
  assert.deepEqual(evaluateBiExecutionSpineV1(rehash(authority as BiExecutionSpineBundleV1)), {
    schemaVersion: "chimpmaera.cm-bi-exec/governed-bi-execution-spine-decision/v1",
    outcome: "DENIED",
    reasonCodes: ["BI_EXECUTION_SPINE_CLAIM_DENIED"],
    claimBoundary: BI_EXECUTION_SPINE_CLAIM_BOUNDARY_V1,
  });
});

test("CM-BI-EXEC-001 denies digest forgery and seeded public leakage", () => {
  const forged = fixture() as unknown as Record<string, unknown>;
  forged.bundleDigest = "f".repeat(64);
  assert.deepEqual(evaluateBiExecutionSpineV1(forged), {
    schemaVersion: "chimpmaera.cm-bi-exec/governed-bi-execution-spine-decision/v1",
    outcome: "DENIED",
    reasonCodes: ["BI_EXECUTION_SPINE_DIGEST_DENIED"],
    claimBoundary: BI_EXECUTION_SPINE_CLAIM_BOUNDARY_V1,
  });

  assert.equal(BI_EXECUTION_SPINE_PROHIBITED_FIELDS_V1.length, 21);
  const seeded = [
    "-----BEGIN " + "PRIVATE KEY-----",
    ["", "home", "operator", "private", "cm-bi.json"].join("/"),
    "gh" + "p_seededNotARealCredential000000000",
    "tenant-00000000-0000-0000-0000-000000000000",
  ];
  for (const sensitiveValue of seeded) {
    const input = fixture() as unknown as Record<string, any>;
    input.questions[0].rawEvidence = sensitiveValue;
    const publicBytes = renderPublicBiExecutionSpineDecisionV1(input);
    assert.equal(publicBytes.includes(sensitiveValue), false);
    assert.deepEqual(Object.keys(JSON.parse(publicBytes)).sort(), [
      "claimBoundary", "outcome", "reasonCodes", "schemaVersion",
    ]);
  }
});
