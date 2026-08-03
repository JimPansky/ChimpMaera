import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { evaluateCandidate } from "../benchmarks/adaptability-m0/ai-blind/evaluate.mjs";
import { CLAIM_BOUNDARY, runBenchmark } from "../benchmarks/adaptability-m0/run.mjs";

const root = resolve(import.meta.dirname, "..");
const schema = JSON.parse(readFileSync(join(root, "schemas/adaptability-benchmark-result-v1.schema.json"), "utf8"));

function deterministicClock() {
  let tick = 0;
  return () => {
    tick += 0.01;
    return tick;
  };
}

test("ADB-001-M0 ADD and REPLACE result passes the closed schema", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const result = runBenchmark({
    sampleCount: 5,
    now: deterministicClock(),
    generatedAt: "2026-08-04T00:00:00.000Z",
  });
  assert.equal(ajv.validate(schema, result), true, JSON.stringify(ajv.errors));
  assert.equal(result.status, "PASS");
  assert.equal(result.claimBoundary, CLAIM_BOUNDARY);
  assert.equal(result.scenarios.add.providerCountBefore, 1);
  assert.equal(result.scenarios.add.providerCountAfter, 2);
  assert.equal(result.scenarios.replace.unchangedCore, true);
  assert.equal(result.scenarios.replace.unchangedConsumer, true);
  assert.equal(new Set(result.scenarios.replace.observations.map((entry) => entry.consumerDigest)).size, 1);
});

test("ADB-001-M0 checked-in measurement stays schema-valid and source-bound", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const evidence = JSON.parse(readFileSync(join(root, "benchmarks/adaptability-m0/records/adb-001-m0-local-20260804.json"), "utf8"));
  const current = runBenchmark({ sampleCount: 5, now: deterministicClock() });
  assert.equal(ajv.validate(schema, evidence), true, JSON.stringify(ajv.errors));
  assert.equal(evidence.status, "PASS");
  assert.equal(evidence.metrics.timing.providerA.cold.samples, 100);
  assert.equal(evidence.metrics.timing.providerB.warm.samples, 100);
  assert.equal(evidence.source.coreSha256, current.source.coreSha256);
  assert.equal(evidence.source.consumerSha256, current.source.consumerSha256);
  assert.equal(evidence.aiBlind.status, "PREPARED_NOT_RUN");
});

test("ADB-001-M0 measures rollback, retry, reuse, readback and zero residue without a speed conclusion", () => {
  const result = runBenchmark({ sampleCount: 5, now: deterministicClock() });
  assert.equal(result.metrics.timing.interpretation, "OBSERVED_LOCAL_PROCESS_TIMINGS_NOT_A_SPEED_CLAIM");
  assert.equal(result.metrics.timing.providerA.cold.samples, 5);
  assert.equal(result.metrics.timing.providerB.warm.samples, 5);
  assert.equal(result.metrics.edits.count > 0, true);
  assert.equal(result.metrics.loc.targetSpecificCore, 0);
  assert.deepEqual(result.metrics.retry, { attempts: 4, sameReceiptCount: 4 });
  assert.equal(result.metrics.reuse.providersUsingSameCore, 2);
  assert.equal(result.metrics.reuse.providersUsingSameConsumer, 2);
  assert.equal(result.metrics.reuse.providerSpecificCoreChanges, 0);
  assert.deepEqual(result.metrics.readback, { verifiedCount: 4, expectedCount: 4 });
  assert.deepEqual(result.metrics.rollback, { verifiedCount: 2, expectedCount: 2 });
  assert.deepEqual(result.metrics.residue, {
    receiptCountAfterReset: 0,
    targetDriftAfterReset: 0,
    externalResourceCount: 0,
  });
  assert.equal(result.nonClaims.includes("NO_SPEED_CLAIM_OR_COMPARATIVE_PERFORMANCE_CONCLUSION"), true);
});

test("ADB-001-M0 cross-provider binding mismatch fails closed with zero drift", () => {
  const result = runBenchmark({ sampleCount: 5, now: deterministicClock() });
  assert.deepEqual(result.negativeProbes, [{
    name: "provider-a-request-against-provider-b-binding",
    expected: "BUILDER_REQUEST_BINDING_DENIED",
    observed: "BUILDER_REQUEST_BINDING_DENIED",
    status: "PASS",
    ownedTargetDrift: 0,
    receiptCount: 0,
  }]);
});

test("ADB-001 AI-blind bundle stays prepared and the retained evaluator fails closed", () => {
  const input = JSON.parse(readFileSync(join(root, "benchmarks/adaptability-m0/ai-blind/participant-input.json"), "utf8"));
  assert.equal(input.status, "PREPARED_NOT_RUN");
  assert.equal(input.allowedParticipantEdit, "candidate/runtime-contract-provider-b.json");
  assert.match(input.claimBoundary, /INPUT_ONLY_NO_RESULT_OR_SPEED_CLAIM/);

  const providerBPath = join(root, "demo/builder-agent/runtime-contract-second-system-v1.json");
  const accepted = evaluateCandidate(providerBPath);
  assert.equal(accepted.status, "PASS", accepted.issues.join("\n"));
  assert.equal(accepted.execution.ownedTargetDrift, 0);
  assert.equal(accepted.execution.residueReceiptCount, 0);

  const temporary = mkdtempSync(join(tmpdir(), "cm-adb-blind-"));
  const candidate = JSON.parse(readFileSync(providerBPath, "utf8"));
  candidate.target.systemType = "unknown.unbound-provider";
  const tamperedPath = join(temporary, "candidate.json");
  writeFileSync(tamperedPath, `${JSON.stringify(candidate)}\n`);
  const denied = evaluateCandidate(tamperedPath);
  assert.equal(denied.status, "FAIL");
  assert.equal(denied.issues.includes("TARGET_SYSTEM_TYPE_MISMATCH"), true);
  assert.equal(denied.execution, null);
});
