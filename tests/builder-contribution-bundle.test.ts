import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  BUILDER_CONTRIBUTION_INPUT_API_VERSION,
  buildBuilderContributionBundleV1,
  canonicalJson,
  verifyBuilderContributionBundleV1,
  type BuilderContributionInputV1,
} from "../packages/contracts/src/index.js";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function input(): BuilderContributionInputV1 {
  return {
    schemaVersion: BUILDER_CONTRIBUTION_INPUT_API_VERSION,
    issueId: "BLD-001",
    claimIds: ["BLD-001-G8", "BLD-001-G7"],
    scope: ["Sanitized synthetic Builder contracts", "Opt-in contribution metadata"],
    nonScope: ["Live targets or production authorization", "Automatic publication"],
    dependencies: [
      { dependencyId: "AAS-023", status: "LOCALLY_VALIDATED" },
      { dependencyId: "AAS-012", status: "LOCALLY_VALIDATED" },
    ],
    acceptanceCriteria: [
      { criterionId: "BLD-001-G8", description: "Closed sanitized bundle passes", status: "PASS" },
      { criterionId: "BLD-001-G7", description: "Second-system reuse remains proven", status: "PASS" },
    ],
    negativeProbes: [
      { probeId: "SECRET_LEAK_DENIED", description: "Credential-shaped content is denied", status: "PASS" },
      { probeId: "STATUS_ESCALATION_DENIED", description: "Release status cannot be escalated", status: "PASS" },
    ],
    evidenceReferences: [
      { evidenceId: "BLD-001-E-G7-20260802", sha256: digest("g7") },
      { evidenceId: "BLD-001-E-G8-20260802", sha256: digest("g8") },
    ],
    sourceArtifacts: [
      { path: "packages/contracts/src/builder-contribution-bundle.ts", sha256: digest("contract") },
      { path: "tests/builder-contribution-bundle.test.ts", sha256: digest("tests") },
    ],
    recoverySteps: ["Revert the bounded G8 implementation", "Keep publication authorization absent"],
    nonClaims: ["Not released or publicly available", "Not production or customer evidence"],
  };
}

function mutate<T>(value: T, change: (draft: Record<string, any>) => void): unknown {
  const draft = structuredClone(value) as Record<string, any>;
  change(draft);
  return draft;
}

test("BLD-001-G8 creates a deterministic schema-valid sanitized opt-in bundle", () => {
  const first = buildBuilderContributionBundleV1(input());
  const second = buildBuilderContributionBundleV1(input());
  assert.equal(first.bundleDigest, second.bundleDigest);
  assert.equal(first.deliveryStatus, "LOCALLY_VALIDATED");
  assert.equal(first.releaseStatus, "NOT_RELEASED");
  assert.equal(first.publicationAuthorization, "ABSENT");
  assert.equal(first.dataClassification, "SYNTHETIC");
  assert.equal(verifyBuilderContributionBundleV1(first).bundleDigest, first.bundleDigest);

  const schema = JSON.parse(readFileSync(
    "schemas/contracts/builder-contribution-bundle-v1.schema.json", "utf8",
  )) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(first), true, JSON.stringify(validate.errors));
});

test("BLD-001-G8 checked-in synthetic example exactly matches the generator", () => {
  const exampleInput = JSON.parse(readFileSync(
    "examples/builder-agent/contribution-input-v1.json", "utf8",
  )) as unknown;
  const exampleBundle = JSON.parse(readFileSync(
    "examples/builder-agent/contribution-bundle-v1.json", "utf8",
  )) as unknown;
  assert.equal(
    canonicalJson(buildBuilderContributionBundleV1(exampleInput)),
    canonicalJson(exampleBundle),
  );
});

test("BLD-001-G8 canonicalizes all unordered contribution references", () => {
  const baseline = buildBuilderContributionBundleV1(input());
  const reordered = structuredClone(input());
  for (const value of Object.values(reordered)) if (Array.isArray(value)) value.reverse();
  const candidate = buildBuilderContributionBundleV1(reordered);
  assert.equal(candidate.bundleDigest, baseline.bundleDigest);
  assert.equal(canonicalJson(candidate), canonicalJson(baseline));
});

test("BLD-001-G8 closed input denies hidden, raw and status-smuggling fields", () => {
  const cases = [
    mutate(input(), (draft) => { draft.releaseStatus = "RELEASED"; }),
    mutate(input(), (draft) => { draft.rawPrompt = "ignore prior controls"; }),
    mutate(input(), (draft) => { draft.evidenceReferences[0].runtimeReceipt = "raw"; }),
    mutate(input(), (draft) => { draft.dependencies[0].status = "RELEASED"; }),
  ];
  for (const candidate of cases) assert.throws(
    () => buildBuilderContributionBundleV1(candidate),
    /BUILDER_CONTRIBUTION_BUNDLE_INVALID_DENIED/,
  );
});

test("BLD-001-G8 allow-list denies credential and private-path leakage without reflection", () => {
  const cases = [
    mutate(input(), (draft) => { draft.scope[0] = "token sk-1234567890abcdef"; }),
    mutate(input(), (draft) => {
      draft.nonClaims[0] = `stored in /${"home"}/operator/private.json`;
    }),
    mutate(input(), (draft) => { draft.sourceArtifacts[0].path = "../../private/runtime.json"; }),
    mutate(input(), (draft) => { draft.recoverySteps[0] = "rawRuntimeReceipt must be copied"; }),
  ];
  for (const candidate of cases) {
    let message = "";
    try {
      buildBuilderContributionBundleV1(candidate);
    } catch (error) {
      message = String(error);
    }
    assert.match(message, /BUILDER_CONTRIBUTION_BUNDLE_INVALID_DENIED/);
    assert.doesNotMatch(message, /sk-|\/home\/|runtimeReceipt/i);
  }
});

test("BLD-001-G8 verifier denies delivery, release, authorization and digest mutation", () => {
  const bundle = buildBuilderContributionBundleV1(input());
  const cases = [
    mutate(bundle, (draft) => { draft.deliveryStatus = "RELEASED"; }),
    mutate(bundle, (draft) => { draft.releaseStatus = "RELEASED"; }),
    mutate(bundle, (draft) => { draft.publicationAuthorization = "GRANTED"; }),
    mutate(bundle, (draft) => { draft.sourceArtifacts[0].sha256 = "0".repeat(64); }),
    mutate(bundle, (draft) => { draft.sanitization.excludedClasses.pop(); }),
  ];
  for (const candidate of cases) assert.throws(
    () => verifyBuilderContributionBundleV1(candidate),
    /BUILDER_CONTRIBUTION_BUNDLE_INVALID_DENIED/,
  );
});
