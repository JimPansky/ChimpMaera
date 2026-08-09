import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LEARNING_ROUTING_THREATS_V1,
  buildLearningRoutingThreatPackV1,
  canonicalJson,
  inspectLearningRoutingPrivacyProbeV1,
} from "../packages/contracts/src/index.js";

const PUBLIC_SEED = "lr-003-public-synthetic-seed-v1";

test("LR-003 deterministic replay covers every finite threat and matches the retained manifest", () => {
  const first = buildLearningRoutingThreatPackV1(PUBLIC_SEED);
  const second = buildLearningRoutingThreatPackV1(PUBLIC_SEED);
  assert.deepEqual(first, second);
  assert.equal(first.fixtures.length, LEARNING_ROUTING_THREATS_V1.length);
  assert.deepEqual(new Set(first.fixtures.map(({ threat }) => threat)), new Set(LEARNING_ROUTING_THREATS_V1));
  assert.equal(new Set(first.fixtures.map(({ fixtureDigest }) => fixtureDigest)).size, first.fixtures.length);
  assert.ok(first.fixtures.every(({ rawContentIncluded, publicSyntheticOnly, expectedReasonCode }) =>
    !rawContentIncluded && publicSyntheticOnly && typeof expectedReasonCode === "string"));
  const retained = JSON.parse(readFileSync("tests/fixtures/learning-routing/threat-replay-manifest-v1.json", "utf8"));
  assert.deepEqual(retained, {
    schemaVersion: first.schemaVersion,
    packVersion: first.packVersion,
    fixtureCount: first.fixtures.length,
    threatIds: first.fixtures.map(({ threat }) => threat),
    fixtureDigests: first.replay.fixtureDigests,
    manifestDigest: first.manifestDigest,
  });
});

test("LR-003 secret path raw-content and retention probes deny without echoing candidate data", () => {
  const seededSecret = ["ghp", "seeded", "canary", "must", "not", "persist"].join("-");
  const absolutePath = ["", "private", "synthetic", "workspace", "item.ts"].join("/");
  const candidates = [
    { credentialValue: seededSecret },
    { artifactLocation: absolutePath },
    { rawResponse: "0".repeat(64) },
    { retention: "INDEFINITE" },
  ];
  for (const candidate of candidates) {
    const result = inspectLearningRoutingPrivacyProbeV1(candidate);
    assert.deepEqual(result, ["PRIVACY_OR_SECRET_HANDLING_FAILURE"]);
    assert.equal(canonicalJson(result).includes(Object.values(candidate)[0]!), false);
  }
  const serializedPack = canonicalJson(buildLearningRoutingThreatPackV1(PUBLIC_SEED));
  assert.equal(serializedPack.includes(seededSecret), false);
  assert.equal(serializedPack.includes(absolutePath), false);
  assert.equal(/raw(?:Prompt|Response|Content)\s*:/i.test(serializedPack), false);
});

test("LR-003 promotion and stop criteria fail closed", () => {
  const pack = buildLearningRoutingThreatPackV1(PUBLIC_SEED);
  assert.deepEqual(pack.promotionCriteria, {
    expectedReplaysPpm: 1_000_000, missingThreats: 0, privacyFindings: 0, unexpectedSuccesses: 0,
  });
  assert.deepEqual(pack.stopCriteria, {
    anyUnexpectedSuccess: true, anyPrivacyFinding: true, anyReplayNondeterminism: true,
    unknownTransportMisclassified: true,
  });
  const unknown = pack.fixtures.find(({ threat }) => threat === "UNKNOWN_TRANSPORT");
  assert.ok(unknown);
  assert.match(unknown.fixtureId, /^lr003:/);
  assert.equal(unknown.expectedReasonCode, "TRANSPORT_OUTCOME_UNKNOWN");
  assert.equal(unknown.expectedTerminalState, "UNKNOWN");
});
