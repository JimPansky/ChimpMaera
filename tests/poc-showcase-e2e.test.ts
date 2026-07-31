import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  PocShowcaseE2eError,
  buildPocShowcaseE2eCoverageMatrix,
  inventoryPocShowcaseUseCases,
  runPocShowcaseNegativeCase,
  simulatePocShowcaseUseCaseE2e,
  type PocShowcaseV1,
} from "../packages/contracts/src/index.js";

const manifestPath = "examples/poc-release/showcase-v1.json";
const showcase = JSON.parse(readFileSync(manifestPath, "utf8")) as PocShowcaseV1;

test("POC-SHOWCASE-E2E inventories every claimed functional use case", () => {
  const useCases = inventoryPocShowcaseUseCases(showcase);
  assert.equal(useCases.length, 6);
  assert.deepEqual(
    useCases.map(({ useCaseId }) => useCaseId),
    [
      "POC-UC-001",
      "POC-UC-002",
      "POC-UC-003",
      "POC-UC-004",
      "POC-UC-005",
      "POC-UC-006",
    ],
  );
  assert.ok(useCases.some(({ kind }) => kind === "CONTRIBUTOR_MODULE_AUTHORING"));
  assert.ok(useCases.some(({ kind }) => kind === "ONBOARDING_FIRST_RUN"));
});

test("POC-SHOWCASE-E2E proves every claimed use case through the full deterministic flow", () => {
  for (const { useCaseId, requiredFlow } of inventoryPocShowcaseUseCases(showcase)) {
    const first = simulatePocShowcaseUseCaseE2e(showcase, {
      useCaseId,
      runId: "canonical-run",
    });
    const second = simulatePocShowcaseUseCaseE2e(showcase, {
      useCaseId,
      runId: "canonical-run",
    });
    assert.equal(first.evidenceDigest, second.evidenceDigest);
    assert.deepEqual(first.typedPlan.stages, requiredFlow);
    assert.equal(first.policyDecision.decision, "ALLOW_WITH_DRY_RUN_APPROVAL");
    assert.equal(first.approvalDecision.mode, "ADMIN_AI_DRY_RUN");
    assert.equal(first.actionReceipts.length, first.useCase.declaredFunctionalScope.typedActions.length);
    assert.equal(first.typedResult.status, "PASS");
    assert.equal(first.auditRecord.containsSecretOrPii, false);
    assert.equal(first.replayReceipt.status, "IDEMPOTENT_REPLAY_ACCEPTED");
    assert.equal(first.revokeOrRollbackReceipt.status, "ROLLED_BACK_AND_REVOKED");
    assert.equal(first.cleanupResult.localResidueCount, 0);
    assert.match(first.outcomeSummary, new RegExp(useCaseId));
  }
});

test("POC-SHOWCASE-E2E negative matrix fails closed for every use case", () => {
  const expectedCodes = new Set([
    "UNKNOWN_MODULE_DENIED",
    "UNKNOWN_ACTION_DENIED",
    "UNAUTHORIZED_ACTOR_DENIED",
    "CROSS_TENANT_CELL_BINDING_DENIED",
    "STALE_APPROVAL_LEASE_DENIED",
    "TAMPERED_PLAN_DENIED",
    "TAMPERED_RECEIPT_DENIED",
    "DUPLICATE_REPLAY_DENIED",
    "EMBEDDED_SECRET_OR_PII_DENIED",
  ]);
  for (const useCase of inventoryPocShowcaseUseCases(showcase)) {
    for (const negativeCase of useCase.requiredNegativeCases) {
      assert.ok(expectedCodes.has(
        runPocShowcaseNegativeCase(showcase, useCase.useCaseId, negativeCase),
      ));
    }
  }
});

test("POC-SHOWCASE-E2E coverage matrix accepts only fully simulated E2E use cases", () => {
  const matrix = buildPocShowcaseE2eCoverageMatrix(showcase);
  assert.equal(matrix.baseline.overallMaturityPercent, 0);
  assert.equal(matrix.baseline.acceptedUseCases, 0);
  assert.equal(matrix.maturity.acceptedUseCases, 6);
  assert.equal(matrix.maturity.totalUseCases, 6);
  assert.equal(matrix.maturity.overallMaturityPercent, 100);
  assert.equal(matrix.entries.every(({ accepted }) => accepted), true);
  assert.equal(matrix.entries.every(({ missingStages }) => missingStages.length === 0), true);

  assert.throws(
    () => simulatePocShowcaseUseCaseE2e(showcase, {
      useCaseId: "POC-UC-001",
      actionIdOverride: "forge.delete_repository",
    }),
    PocShowcaseE2eError,
  );
});
