import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  discoverBuilderSystemV1,
  type BuilderDiscoveryInputV1,
} from "../packages/contracts/src/builder-discovery.js";

function fixture(): BuilderDiscoveryInputV1 {
  return JSON.parse(
    readFileSync("tests/fixtures/builder/g2-zoo-system.json", "utf8"),
  ) as BuilderDiscoveryInputV1;
}

test("BLD-001-G2 synthetic intake fixture satisfies the public JSON Schema", () => {
  const schema = JSON.parse(
    readFileSync("schemas/contracts/builder-discovery-v1.schema.json", "utf8"),
  ) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

  assert.equal(validate(fixture()), true, JSON.stringify(validate.errors));
});

test("BLD-001-G2 discovers a previously unknown synthetic system deterministically", () => {
  const first = discoverBuilderSystemV1(fixture());
  const second = discoverBuilderSystemV1(fixture());

  assert.equal(first.claim, "DISCOVERY_RECORD_ONLY_NO_AUTHORITY_OR_EFFECT");
  assert.equal(first.system.systemType, "unknown.habitat-controller");
  assert.equal(first.system.dataClassification, "SYNTHETIC");
  assert.deepEqual(first.requestedOperationIds, [
    "habitat.setpoint.update",
    "habitat.temperature.read",
  ]);
  assert.deepEqual(first.discoveredObjects.map(({ objectType }) => objectType), [
    "habitat",
    "sensor",
  ]);
  assert.equal(first.selectedGuides[0]?.guideId, "guide:unknown-habitat-v1");
  assert.equal(first.selectedContexts.length, 3);
  assert.equal(first.recordDigest, second.recordDigest);
  assert.equal(first.inputDigest, second.inputDigest);
});

test("BLD-001-G2 binds requested operations to Guide and cause/effect context", () => {
  const result = discoverBuilderSystemV1(fixture());
  const update = result.discoveredOperations.find(({ operationId }) =>
    operationId === "habitat.setpoint.update");

  assert.equal(update?.effectClass, "REVERSIBLE_WRITE");
  assert.equal(update?.reversible, true);
  assert.deepEqual(update?.contextRefs, [
    "context:setpoint-rollback",
    "context:setpoint-safety",
  ]);
  assert.equal(result.selectedContexts.some(({ kind }) => kind === "ROLLBACK"), true);
  assert.match(result.goal, /reversible set-point correction/);
});

test("BLD-001-G2 remains generic when the unknown system type changes", () => {
  const input = fixture();
  const renamed = {
    ...input,
    machineManifest: {
      ...input.machineManifest,
      manifestId: "manifest:unseen-system-v1",
      systemId: "system:unseen-lab",
      systemType: "unseen.vendor-neutral-system",
    },
    guides: input.guides.map((guide) => ({
      ...guide,
      systemType: "unseen.vendor-neutral-system",
    })),
  };

  const result = discoverBuilderSystemV1(renamed);
  assert.equal(result.system.systemType, "unseen.vendor-neutral-system");
  assert.equal(result.discoveredOperations.length, 2);
});

test("BLD-001-G2 denies malformed, cross-tenant, ungrounded and secret-bearing intake", () => {
  const base = fixture();
  const crossTenant = {
    ...base,
    machineManifest: {
      ...base.machineManifest,
      tenant: "other-tenant",
    },
  };
  const unknownOperation = {
    ...base,
    intake: {
      ...base.intake,
      requestedOperationIds: ["unregistered.effect"],
    },
  };
  const ungroundedGuide = {
    ...base,
    guides: base.guides.map((guide) => ({
      ...guide,
      operationRefs: ["habitat.temperature.read"],
    })),
  };
  const secretGoal = {
    ...base,
    intake: {
      ...base.intake,
      goal: "Connect with password=synthetic-but-secret-looking-value",
    },
  };
  const hiddenPayload = {
    ...base,
    rawPayload: { customerRecord: "not permitted" },
  };

  for (const candidate of [
    crossTenant,
    unknownOperation,
    ungroundedGuide,
    secretGoal,
    hiddenPayload,
  ]) {
    assert.throws(
      () => discoverBuilderSystemV1(candidate),
      /BUILDER_DISCOVERY_INPUT_INVALID_DENIED/,
    );
  }
});
