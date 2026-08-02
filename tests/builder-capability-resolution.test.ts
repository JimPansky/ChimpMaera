import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  BUILDER_CAPABILITY_REGISTRATION_API_VERSION,
  BUILDER_CAPABILITY_RESOLUTION_INPUT_API_VERSION,
  createBuilderCapabilityRegistrationV1,
  discoverBuilderSystemV1,
  resolveBuilderCapabilitiesV1,
  verifyBuilderCapabilityResolutionV1,
  type BuilderCapabilityRegistrationV1,
  type BuilderDiscoveryInputV1,
} from "../packages/contracts/src/index.js";

function discoveryInput(): BuilderDiscoveryInputV1 {
  return JSON.parse(
    readFileSync("tests/fixtures/builder/g2-zoo-system.json", "utf8"),
  ) as BuilderDiscoveryInputV1;
}

function registration(): BuilderCapabilityRegistrationV1 {
  return JSON.parse(
    readFileSync("tests/fixtures/builder/g3-capability-registry.json", "utf8"),
  ) as BuilderCapabilityRegistrationV1;
}

function input(registrations: readonly BuilderCapabilityRegistrationV1[] = [registration()]) {
  return {
    schemaVersion: BUILDER_CAPABILITY_RESOLUTION_INPUT_API_VERSION,
    discovery: discoverBuilderSystemV1(discoveryInput()),
    registeredCapabilities: registrations,
  };
}

function mutate<T>(value: T, change: (draft: Record<string, any>) => void): unknown {
  const draft = structuredClone(value) as Record<string, any>;
  change(draft);
  return draft;
}

test("BLD-001-G3 fixture is digest-bound and result satisfies the public schema", () => {
  const fixture = registration();
  const { descriptorDigest, ...core } = fixture;
  assert.equal(
    createBuilderCapabilityRegistrationV1(core).descriptorDigest,
    descriptorDigest,
  );
  const schema = JSON.parse(
    readFileSync("schemas/contracts/builder-capability-resolution-v1.schema.json", "utf8"),
  ) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const result = resolveBuilderCapabilitiesV1(input());
  assert.equal(validate(result), true, JSON.stringify(validate.errors));
});

test("BLD-001-G3 reuses only the exact registered capability deterministically", () => {
  const first = resolveBuilderCapabilitiesV1(input());
  const second = resolveBuilderCapabilitiesV1(input());
  assert.equal(first.resultDigest, second.resultDigest);
  assert.equal(first.claim, "CAPABILITY_REUSE_PLAN_ONLY_NO_AUTHORITY_OR_EFFECT");
  assert.deepEqual(first.reusedCapabilities.map(({ capabilityId }) => capabilityId), [
    "habitat.temperature.read",
  ]);
  assert.equal(first.reusedCapabilities[0]?.lifecycleState, "INACTIVE");
  assert.equal(first.reusedCapabilities[0]?.executable, false);
  assert.equal(first.reusedCapabilities[0]?.authorityGranted, false);
  assert.equal(first.reusedCapabilities[0]?.effectAuthorized, false);
  assert.equal(verifyBuilderCapabilityResolutionV1(first).resultDigest, first.resultDigest);
});

test("BLD-001-G3 genuine gaps become versioned inactive UNRESOLVED_INTENT", () => {
  const result = resolveBuilderCapabilitiesV1(input());
  assert.equal(result.unresolvedIntents.length, 1);
  const proposal = result.unresolvedIntents[0];
  assert.equal(proposal?.proposalVersion, "1.0.0");
  assert.equal(proposal?.status, "UNRESOLVED_INTENT");
  assert.equal(proposal?.lifecycleState, "INACTIVE");
  assert.equal(proposal?.capabilityHint, "habitat.setpoint.update");
  assert.match(proposal?.risk ?? "", /rollback binding|effect authorization/);
  assert.deepEqual(proposal?.dependencyRefs, [
    "context:setpoint-rollback",
    "context:setpoint-safety",
    "guide:unknown-habitat-v1",
    "object:habitat",
  ]);
  assert.match(proposal?.recommendation ?? "", /exact capability descriptor/);
  assert.equal(proposal?.executable, false);
  assert.equal(proposal?.authorityGranted, false);
  assert.equal(proposal?.effectAuthorized, false);
});

test("BLD-001-G3 empty and fuzzy registries never imply reuse, authority or effect", () => {
  const empty = resolveBuilderCapabilitiesV1(input([]));
  assert.equal(empty.reusedCapabilities.length, 0);
  assert.equal(empty.unresolvedIntents.length, 2);

  const exact = registration();
  const { descriptorDigest: _ignored, ...core } = exact;
  const fuzzy = createBuilderCapabilityRegistrationV1({
    ...core,
    capabilityId: "habitat.temperature",
  });
  const fuzzyResult = resolveBuilderCapabilitiesV1(input([fuzzy]));
  assert.equal(fuzzyResult.reusedCapabilities.length, 0);
  assert.equal(fuzzyResult.unresolvedIntents.length, 2);
  assert.equal(JSON.stringify(fuzzyResult).includes("providerCall"), false);
});

test("BLD-001-G3 denies incompatible collisions, duplicates, tampering and hidden fields", () => {
  const base = input();
  const exact = registration();
  const { descriptorDigest: _ignored, ...core } = exact;
  const incompatible = createBuilderCapabilityRegistrationV1({
    ...core,
    effectClasses: ["REVERSIBLE_WRITE"],
  });
  const cases = [
    input([incompatible]),
    input([exact, exact]),
    mutate(base, (draft) => { draft.registeredCapabilities[0].descriptorDigest = "0".repeat(64); }),
    mutate(base, (draft) => { draft.registeredCapabilities[0].lifecycleState = "ACTIVE"; }),
    mutate(base, (draft) => { draft.discovery.recordDigest = "0".repeat(64); }),
    mutate(base, (draft) => { draft.rawPayload = { secret: "forbidden" }; }),
  ];
  for (const candidate of cases) {
    assert.throws(
      () => resolveBuilderCapabilitiesV1(candidate),
      /BUILDER_CAPABILITY_RESOLUTION_INVALID_DENIED/,
    );
  }
});

test("BLD-001-G3 verifier rejects result mutation and authority-shaped hidden fields", () => {
  const result = resolveBuilderCapabilitiesV1(input());
  for (const candidate of [
    mutate(result, (draft) => { draft.unresolvedIntents[0].executable = true; }),
    mutate(result, (draft) => { draft.authorityToken = "synthetic"; }),
  ]) {
    assert.throws(
      () => verifyBuilderCapabilityResolutionV1(candidate),
      /BUILDER_CAPABILITY_RESOLUTION_INVALID_DENIED/,
    );
  }
  assert.equal(BUILDER_CAPABILITY_REGISTRATION_API_VERSION.endsWith("/v1"), true);
});
