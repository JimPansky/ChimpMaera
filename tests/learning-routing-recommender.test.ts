import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  LEARNING_ROUTING_CLAIM_BOUNDARY_V1,
  LEARNING_ROUTING_NON_CLAIMS_V1,
  ROUTING_CONTEXT_SCHEMA_V1,
  canonicalJson,
  recommendLearningRouteV1,
  recordLearningRoutingRecommendationV1,
  routingContextDigestV1,
  type LearningRoutingRecommendationInputV1,
  type RoutingContextV1,
} from "../packages/contracts/src/index.js";

const digest = (character: string): string => character.repeat(64);

function contextFixture(): RoutingContextV1 {
  const unsigned: Omit<RoutingContextV1, "contextDigest"> = {
    schemaVersion: ROUTING_CONTEXT_SCHEMA_V1,
    episodePseudonym: `ep_${"a".repeat(32)}`,
    snapshotDigests: { issue: digest("1"), base: digest("2"), projection: digest("3"), acceptance: digest("4"), toolchain: digest("5") },
    cohort: {
      issueKind: "DOCS", languageFamily: "MARKDOWN", packageFamily: "DOCS", allowedFileCountBin: "ONE",
      projectionBytesBin: "UP_TO_32K", pathClasses: ["DOCS"], hasReproduction: false,
      acceptanceCriteriaPresent: true, testProfileKnown: true, dependencyRelevant: false,
      schemaRelevant: false, contractRelevant: false, publicManifestRelevant: false,
    },
    assessments: { complexity: "LOW", confidence: "HIGH", risk: "LOW", dataClass: "PUBLIC_OSS", explorationAllowed: false },
    observedAtMs: 1_786_182_400_000,
    featureCutoffMs: 1_786_182_399_000,
    featureSpecDigest: digest("6"),
    claimBoundary: LEARNING_ROUTING_CLAIM_BOUNDARY_V1,
    nonClaims: LEARNING_ROUTING_NON_CLAIMS_V1,
  };
  return { ...unsigned, contextDigest: routingContextDigestV1(unsigned) };
}

function inputFixture(): LearningRoutingRecommendationInputV1 {
  return {
    context: contextFixture(),
    authority: "ADVISORY_ONLY",
    evidence: { state: "VERIFIED_PUBLIC", sourceDigest: digest("7"), supportingSampleCount: 0 },
    availableModelAliases: ["cm.dev.fast", "cm.dev.primary", "cm.dev.review"],
  };
}

test("default-off recorder performs no filesystem access", () => {
  const recommendation = recommendLearningRouteV1(inputFixture());
  const impossiblePath = join(tmpdir(), "missing-parent", "must-not-exist.ndjson");
  assert.deepEqual(recordLearningRoutingRecommendationV1(recommendation, { outputFile: impossiblePath }), {
    status: "DISABLED", reasonCode: "RECORDER_DISABLED", recordDigest: null,
  });
});

test("enabled recorder appends a digest-bound minimized recommendation", () => {
  const directory = mkdtempSync(join(tmpdir(), "cm-lr-recorder-"));
  try {
    const outputFile = join(directory, "recommendations.ndjson");
    const recommendation = recommendLearningRouteV1(inputFixture());
    const recorded = recordLearningRoutingRecommendationV1(recommendation, {
      enabled: true, outputFile, recordedAtMs: 1_786_182_401_000,
    });
    assert.equal(recorded.status, "RECORDED");
    const parsed = JSON.parse(readFileSync(outputFile, "utf8")) as Record<string, unknown>;
    assert.equal(parsed.recordDigest, recorded.recordDigest);
    assert.equal(JSON.stringify(parsed).includes("issue text"), false);
    assert.equal(JSON.stringify(parsed).includes("/home/"), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("privacy and authority boundaries fail closed to the static fallback", () => {
  const input = inputFixture();
  const privateUnsigned = { ...input.context, assessments: { ...input.context.assessments, dataClass: "RESTRICTED" } };
  const privateContext = { ...privateUnsigned, contextDigest: routingContextDigestV1(privateUnsigned) };
  const privacy = recommendLearningRouteV1({ ...input, context: privateContext });
  assert.equal(privacy.disposition, "STATIC_FALLBACK");
  assert.deepEqual(privacy.reasonCodes, ["PRIVACY_BOUNDARY_DENIAL", "INVALID_CONTEXT"]);

  const rawCandidate = recommendLearningRouteV1({ ...input, prompt: "ghp_seeded_secret" });
  assert.equal(rawCandidate.disposition, "STATIC_FALLBACK");
  assert.equal(JSON.stringify(rawCandidate).includes("ghp_seeded_secret"), false);

  const authority = recommendLearningRouteV1({ ...input, authority: "MERGE" });
  assert.equal(authority.disposition, "STATIC_FALLBACK");
  assert.deepEqual(authority.reasonCodes, ["AUTHORITY_BOUNDARY_DENIAL"]);
  assert.equal(authority.authority, "ADVISORY_ONLY");
});

test("recorder denies digest-consistent recommendations with raw extra fields", () => {
  const directory = mkdtempSync(join(tmpdir(), "cm-lr-forged-"));
  try {
    const recommendation = recommendLearningRouteV1(inputFixture());
    const { recommendationDigest: _oldDigest, ...unsigned } = recommendation;
    const forgedUnsigned = { ...unsigned, rawPrompt: "public issue body must still not be retained" };
    const forged = {
      ...forgedUnsigned,
      recommendationDigest: createHash("sha256").update(canonicalJson(forgedUnsigned), "utf8").digest("hex"),
    };
    assert.deepEqual(recordLearningRoutingRecommendationV1(forged as typeof recommendation, {
      enabled: true, outputFile: join(directory, "must-not-be-created.ndjson"), recordedAtMs: 1,
    }), { status: "DENIED", reasonCode: "INVALID_RECORD", recordDigest: null });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("missing unknown and unavailable evidence never produce a recommendation", () => {
  const input = inputFixture();
  const missing = recommendLearningRouteV1({ ...input, evidence: { state: "MISSING", sourceDigest: null, supportingSampleCount: 0 } });
  const unknown = recommendLearningRouteV1({ ...input, evidence: { state: "UNRECOGNIZED", sourceDigest: digest("7"), supportingSampleCount: 0 } });
  const unavailable = recommendLearningRouteV1({ ...input, availableModelAliases: ["cm.dev.primary"] });
  assert.deepEqual(missing.reasonCodes, ["MISSING_EVIDENCE"]);
  assert.deepEqual(unknown.reasonCodes, ["UNKNOWN_EVIDENCE"]);
  assert.deepEqual(unavailable.reasonCodes, ["MODEL_ALIAS_UNAVAILABLE", "PUBLIC_LOW_RISK_DIRECT"]);
  for (const result of [missing, unknown, unavailable]) assert.equal(result.disposition, "STATIC_FALLBACK");
});

test("deterministic replay emits the same route confidence reasons fallback and digest", () => {
  const input = inputFixture();
  const first = recommendLearningRouteV1(input);
  assert.deepEqual(first.route, { modelAlias: "cm.dev.fast", thinkingProfile: "MINIMAL", workflow: "DIRECT" });
  assert.deepEqual(first.confidence, { band: "LOW", supportingSampleCount: 0 });
  assert.deepEqual(first.reasonCodes, ["PUBLIC_LOW_RISK_DIRECT"]);
  assert.deepEqual(first.fallback, {
    modelAlias: "cm.dev.primary", thinkingProfile: "STANDARD", workflow: "PLAN_FIRST", reasonCode: "STATIC_CONSERVATIVE_DEFAULT",
  });
  for (let replay = 0; replay < 100; replay += 1) assert.deepEqual(recommendLearningRouteV1(input), first);
});
