import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { readSyntheticMappingRegistry, validateMappingRegistry } from "../demo/company-data/validate-mapping-registry.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function bindBytes(input) {
  input.registryBytes = Buffer.from(`${JSON.stringify(input.registry, null, 2)}\n`);
  return input;
}

function assertFailClosed(receipt, code) {
  assert.equal(receipt.status, "DENY");
  assert.equal(receipt.success, false);
  assert.equal(receipt.authority, "NONE");
  assert.equal(receipt.claim, "VALIDATION_ONLY");
  assert.equal(receipt.mutationAllowed, false);
  assert.equal(receipt.mutationCount, 0);
  assert.ok(receipt.violations.some((violation) => violation.code === code), `${code} was not reported`);
}

test("DATA-003 validates append lineage, provenance, five states and one active mapping", async () => {
  const input = await readSyntheticMappingRegistry(repoRoot);
  const first = validateMappingRegistry(input);
  const second = validateMappingRegistry(input);
  assert.deepEqual(first, second);
  assert.equal(first.status, "PASS");
  assert.equal(first.counts.entries, 5);
  assert.equal(first.counts.activeMappings, 1);
  assert.deepEqual(first.states, { ACTIVE: 1, STALE: 1, ORPHANED: 1, SUPERSEDED: 1, COMPENSATED: 1 });
  assert.match(first.digests.registry, /^sha256:[a-f0-9]{64}$/);
});

test("DATA-003 turns an active 404 readback into an orphan denial without mutation", async () => {
  const input = await readSyntheticMappingRegistry(repoRoot);
  input.registry = structuredClone(input.registry);
  const observation = input.registry.observations.find((item) => item.mappingId === "map-0002");
  observation.found = false;
  assertFailClosed(validateMappingRegistry(bindBytes(input)), "ORPHANED_TARGET");
});

test("DATA-003 denies target type or semantic-key drift without mutation", async () => {
  const input = await readSyntheticMappingRegistry(repoRoot);
  input.registry = structuredClone(input.registry);
  const observation = input.registry.observations.find((item) => item.mappingId === "map-0002");
  observation.targetObjectType = "WrongType";
  assertFailClosed(validateMappingRegistry(bindBytes(input)), "TARGET_TYPE_OR_SEMANTIC_DRIFT");
});

test("DATA-003 denies tampered replay lineage without mutation", async () => {
  const input = await readSyntheticMappingRegistry(repoRoot);
  input.registry = structuredClone(input.registry);
  input.registry.entries[2].actionDigest = input.registry.entries[1].actionDigest;
  assertFailClosed(validateMappingRegistry(bindBytes(input)), "TAMPERED_REPLAY");
});

test("DATA-003 denies name-only reuse without mutation", async () => {
  const input = await readSyntheticMappingRegistry(repoRoot);
  input.registry = structuredClone(input.registry);
  input.registry.entries[1].reuseBasis = "DISPLAY_NAME";
  assertFailClosed(validateMappingRegistry(bindBytes(input)), "NAME_ONLY_REUSE");
});

test("DATA-003 denies a second active mapping for the same target/type/tenant", async () => {
  const input = await readSyntheticMappingRegistry(repoRoot);
  input.registry = structuredClone(input.registry);
  const duplicate = structuredClone(input.registry.entries[1]);
  duplicate.sequence = 6;
  duplicate.mappingId = "map-0006";
  duplicate.receiptId = "receipt-map-0006";
  input.registry.entries.push(duplicate);
  assertFailClosed(validateMappingRegistry(bindBytes(input)), "SECOND_ACTIVE_MAPPING");
});
