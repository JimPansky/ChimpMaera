import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  computeLearningRoutingBaselineV1,
  normalizeHistoricalRoutingEpisodeV1,
  type HistoricalRoutingEpisodeV1,
} from "../packages/contracts/src/index.js";

const FIXTURE = "tests/fixtures/learning-routing/historical-episodes-august-v1.json";
const GOLDEN = "tests/fixtures/learning-routing/baseline-golden-v1.json";

function episodes(): HistoricalRoutingEpisodeV1[] {
  return JSON.parse(readFileSync(FIXTURE, "utf8")) as HistoricalRoutingEpisodeV1[];
}

function goldenProjection(report: ReturnType<typeof computeLearningRoutingBaselineV1>) {
  return {
    schemaVersion: report.schemaVersion,
    baselineVersion: report.baselineVersion,
    cohortDigest: report.cohortDigest,
    versionDigest: report.versionDigest,
    baselineDigest: report.baselineDigest,
    sourceCoverage: report.sourceCoverage,
    overall: report.overall,
    byRouteClass: report.byRouteClass,
  };
}

test("LR-004 August canary and public/sanitized Issue 41/58 cohort matches retained golden", () => {
  const report = computeLearningRoutingBaselineV1(episodes());
  const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
  assert.deepEqual(goldenProjection(report), golden);
  assert.deepEqual(report.sourceCoverage, {
    AUGUST_CANARY: 4, PUBLIC_ISSUE_41: 4, PUBLIC_ISSUE_58: 4, SANITIZED_SYNTHETIC: 0,
  });
  assert.equal(report.overall.episodeCount, 12);
  assert.equal(report.overall.verifiedSuccesses, 4);
  assert.equal(report.overall.vsrPpm, 333_333);
  assert.equal(report.overall.ecvrMicros, 333);
  assert.equal(report.overall.etvrMs, 1_563);
});

test("LR-004 includes every disposition in denominators and separates four route baselines", () => {
  const report = computeLearningRoutingBaselineV1(episodes());
  assert.deepEqual(Object.keys(report.byRouteClass), ["STATIC", "CURRENT", "CHEAP", "STRONG"]);
  for (const metrics of Object.values(report.byRouteClass)) {
    assert.equal(metrics.episodeCount, 3);
    assert.equal(metrics.verifiedSuccesses, 1);
    assert.equal(metrics.vsrPpm, 333_333);
  }
  assert.equal(report.overall.missingness.censored, 1);
  assert.equal(report.overall.missingness.incompleteEvidence, 3);
  assert.equal(report.overall.missingness.unknownTransport, 1);
});

test("LR-004 actual receipt cost overrides assumptions and unknown transport reserves cost", () => {
  const values = episodes();
  const actual = normalizeHistoricalRoutingEpisodeV1(values[0]);
  assert.equal(actual.billedCostMicros, 100);
  assert.notEqual(actual.billedCostMicros, values[0]!.usage.priceAssumptionCostMicros);
  const unknown = normalizeHistoricalRoutingEpisodeV1(values[7]);
  assert.equal(unknown.billedCostMicros, 20);
  assert.equal(unknown.reservedCostMicros, 100);
  assert.equal(unknown.totalCostMicros, 120);
  const report = computeLearningRoutingBaselineV1(values);
  assert.equal(report.overall.totals.billedCostMicros, 1_230);
  assert.equal(report.overall.totals.reservedCostMicros, 100);
  assert.equal(report.overall.totals.totalCostMicros, 1_330);
});

test("LR-004 incomplete verified claims normalize to INSUFFICIENT and never increase VSR", () => {
  const values = episodes();
  const incomplete = normalizeHistoricalRoutingEpisodeV1(values[11]);
  assert.equal(incomplete.disposition, "VERIFIED_RESOLVED");
  assert.equal(incomplete.normalizedDisposition, "INSUFFICIENT_EVIDENCE");
  assert.equal(incomplete.verifiedSuccess, false);
});

test("LR-004 cohort and version digests are stable under input reordering", () => {
  const values = episodes();
  const forward = computeLearningRoutingBaselineV1(values);
  const reverse = computeLearningRoutingBaselineV1([...values].reverse());
  assert.deepEqual(reverse, forward);
  assert.match(forward.cohortDigest, /^[a-f0-9]{64}$/);
  assert.match(forward.versionDigest, /^[a-f0-9]{64}$/);
});

test("LR-004 fails the complete cohort for raw fields, invalid costs, or duplicate pseudonyms", () => {
  const values = episodes();
  assert.throws(() => computeLearningRoutingBaselineV1([{ ...values[0]!, rawPrompt: "0".repeat(64) }]),
    /INVALID_HISTORICAL_ROUTING_EPISODE/);
  assert.throws(() => computeLearningRoutingBaselineV1([{ ...values[0]!, usage: { ...values[0]!.usage, calls: -1 } }]),
    /INVALID_HISTORICAL_ROUTING_EPISODE/);
  assert.throws(() => computeLearningRoutingBaselineV1([values[0], structuredClone(values[0])]),
    /DUPLICATE_HISTORICAL_EPISODE/);
});

test("LR-004 offline CLI emits the same digest without a collector or network input", () => {
  const result = spawnSync(process.execPath, ["scripts/learning-routing-baseline.mjs", FIXTURE], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const cliReport = JSON.parse(result.stdout);
  assert.equal(cliReport.baselineDigest, computeLearningRoutingBaselineV1(episodes()).baselineDigest);
  assert.equal(cliReport.claimBoundary, "READ_ONLY_OFFLINE_NO_ROUTING_ACTIVATION");
});
