import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  evaluateSignalReleaseIntakeV1,
  type SignalReleaseIntakeGateV1,
  type SignalReleaseIntakeV1,
} from "../packages/contracts/src/index.js";

const POSITIVE = "tests/fixtures/signal-release-intake/positive-v1.json";
const NEGATIVE = "tests/fixtures/signal-release-intake/rejections-v1.json";

function positive(): SignalReleaseIntakeV1 {
  return JSON.parse(readFileSync(POSITIVE, "utf8")) as SignalReleaseIntakeV1;
}

test("ASF-INTAKE-2 accepts only when all nine pre-candidate gates pass", () => {
  const decision = evaluateSignalReleaseIntakeV1(positive());
  assert.equal(decision.disposition, "PRE_CANDIDATE");
  assert.deepEqual(decision.rejectionReasons, []);
  assert.equal(decision.evaluatedGates.length, 9);
  assert.equal(decision.authorityBoundary, "LOCAL_SYNTHETIC_DECISION_NO_MONITORING_POSTING_OR_RELEASE");
});

test("ASF-INTAKE-2 returns stable reasons for every closed rejection fixture", () => {
  const fixtures = JSON.parse(readFileSync(NEGATIVE, "utf8")) as Array<{
    caseId: string; gate: SignalReleaseIntakeGateV1; reason: string;
  }>;
  assert.equal(fixtures.length, 9);
  for (const fixture of fixtures) {
    const input = positive();
    const decision = evaluateSignalReleaseIntakeV1({
      ...input, gates: { ...input.gates, [fixture.gate]: false },
    });
    assert.equal(decision.disposition, "REJECTED", fixture.caseId);
    assert.deepEqual(decision.rejectionReasons, [fixture.reason], fixture.caseId);
  }
});

test("ASF-INTAKE-2 is deterministic and aggregates denials in canonical gate order", () => {
  const input = positive();
  const rejected = { ...input, gates: { ...input.gates, THREAD_LIVE: false, IP_CLEAR: false } };
  const first = evaluateSignalReleaseIntakeV1(rejected);
  for (let replay = 0; replay < 100; replay += 1) assert.deepEqual(evaluateSignalReleaseIntakeV1(rejected), first);
  assert.deepEqual(first.rejectionReasons, ["THREAD_LIVE_DENIED", "IP_CLEAR_DENIED"]);
  assert.match(first.decisionDigest, /^[a-f0-9]{64}$/);
});

test("ASF-INTAKE-2 fails closed for missing, extra and malformed schema fields", () => {
  const input = positive();
  const { IP_CLEAR: _omitted, ...missingGate } = input.gates;
  assert.throws(() => evaluateSignalReleaseIntakeV1({ ...input, gates: missingGate }), /SCHEMA_DENIED/);
  assert.throws(() => evaluateSignalReleaseIntakeV1({ ...input, monitorUrl: "https://example.invalid" }), /SCHEMA_DENIED/);
  assert.throws(() => evaluateSignalReleaseIntakeV1({ ...input, signalDigest: "raw signal" }), /SCHEMA_DENIED/);
});
