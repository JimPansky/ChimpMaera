import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveBuilderAuthorityV1,
  syntheticBuilderAuthorityInputV1,
} from "../packages/contracts/src/builder-authority.js";

test("BLD-001-G1 SAFE_GUIDED is the explainable default", () => {
  const first = resolveBuilderAuthorityV1(syntheticBuilderAuthorityInputV1());
  const second = resolveBuilderAuthorityV1(syntheticBuilderAuthorityInputV1());

  assert.equal(first.profile.selected, "SAFE_GUIDED");
  assert.equal(first.profile.defaulted, true);
  assert.deepEqual(first.effectiveRights, [
    "bundle.publish",
    "zoo.record.read",
    "zoo.record.update",
  ]);
  assert.deepEqual(first.automaticRights, ["zoo.record.read"]);
  assert.deepEqual(first.ownerApprovalRights, [
    "bundle.publish",
    "zoo.record.update",
  ]);
  assert.equal(first.resultDigest, second.resultDigest);
  assert.equal(first.decisions.every(({ reasonFacts }) =>
    reasonFacts.length === 6
      && reasonFacts.includes("PROFILE:SAFE_GUIDED_DEFAULT")), true);
});

test("BLD-001-G1 CUSTOM can auto-route any owner-admitted effective right", () => {
  const input = {
    ...structuredClone(syntheticBuilderAuthorityInputV1("CUSTOM")),
    customRules: [
      { rightId: "bundle.publish", route: "AUTO_EXECUTE" as const },
      { rightId: "zoo.record.update", route: "AUTO_EXECUTE" as const },
    ],
  };
  const result = resolveBuilderAuthorityV1(input);

  assert.equal(result.profile.selected, "CUSTOM");
  assert.deepEqual(result.automaticRights, [
    "bundle.publish",
    "zoo.record.update",
  ]);
  assert.deepEqual(result.effectiveRights, [
    "bundle.publish",
    "zoo.record.update",
  ]);
  assert.equal(result.decisions.find(({ rightId }) => rightId === "zoo.record.read")?.route, "DENY");
});

test("BLD-001-G1 RAMPAGE aliases preserve host, assignment and constraint ceilings", () => {
  const rampage = {
    ...structuredClone(syntheticBuilderAuthorityInputV1("RAMPAGE")),
    hostSystemCeiling: ["zoo.record.read", "zoo.record.update"],
    assignments: ["bundle.publish", "zoo.record.update"],
    currentConstraints: ["zoo.record.update"],
  };
  const result = resolveBuilderAuthorityV1(rampage);

  assert.equal(result.profile.selected, "RAMPAGE_FULL_CONTROL_LAB");
  assert.deepEqual(result.effectiveRights, ["zoo.record.update"]);
  assert.deepEqual(result.automaticRights, ["zoo.record.update"]);
  assert.equal(result.decisions.find(({ rightId }) => rightId === "bundle.publish")
    ?.reasonFacts.includes("HOST_SYSTEM_CEILING:EXCLUDED"), true);

  const alias = {
    ...structuredClone(rampage),
    requestedProfile: "FULL_CONTROL_LAB" as const,
  };
  const aliasResult = resolveBuilderAuthorityV1(alias);
  assert.deepEqual(aliasResult.decisions, result.decisions);
});

test("BLD-001-G1 malformed, unknown, duplicate and hidden override inputs deny", () => {
  const cases: unknown[] = [];

  const unknownProfile = structuredClone(syntheticBuilderAuthorityInputV1());
  (unknownProfile as { requestedProfile: string }).requestedProfile = "GOD_MODE";
  cases.push(unknownProfile);

  const duplicateBase = structuredClone(syntheticBuilderAuthorityInputV1());
  const duplicateRight = {
    ...duplicateBase,
    registeredRights: [
      ...duplicateBase.registeredRights,
      duplicateBase.registeredRights[0]!,
    ],
  };
  cases.push(duplicateRight);

  const unknownAssignmentBase = structuredClone(syntheticBuilderAuthorityInputV1());
  const unknownAssignment = {
    ...unknownAssignmentBase,
    assignments: [...unknownAssignmentBase.assignments, "unknown.effect"],
  };
  cases.push(unknownAssignment);

  const hiddenSafeOverride = {
    ...structuredClone(syntheticBuilderAuthorityInputV1()),
    customRules: [{
      rightId: "bundle.publish",
      route: "AUTO_EXECUTE" as const,
    }],
  };
  cases.push(hiddenSafeOverride);

  const unknownField = {
    ...structuredClone(syntheticBuilderAuthorityInputV1()),
    hiddenProductCeiling: ["zoo.record.read"],
  };
  cases.push(unknownField);

  for (const candidate of cases) {
    assert.throws(
      () => resolveBuilderAuthorityV1(candidate),
      /BUILDER_AUTHORITY_INPUT_INVALID_DENIED/,
    );
  }
});
