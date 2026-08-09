import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {
  digest,
  initialMindState,
  MAX_ADVANCEABLE_MIND_GENERATION,
  MAX_MIND_GENERATION,
  mindStatus,
  readMind,
  recoverMindState,
  resetMind,
  writeMind,
} from "../demo/openclaw-agent/mind-store.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(readFileSync(path.join(root, "demo/openclaw-agent/runtime-contract-v1.json"), "utf8"));
const schema = JSON.parse(readFileSync(path.join(root, "schemas/runtime/openclaw-state-contract-v1.schema.json"), "utf8"));
const fixture = JSON.parse(readFileSync(path.join(root, "tests/fixtures/openclaw-state/lifecycle-v1.json"), "utf8"));
const binding = {
  workloadIdentity: contract.workload.identity,
  tenant: contract.workload.tenant,
  purpose: contract.workload.purpose,
};

function harness() {
  const state = initialMindState(contract);
  const snapshots = [];
  const persist = () => snapshots.push(structuredClone(state));
  return { state, snapshots, persist };
}

function entry(overrides = {}) {
  return { ...binding, generation: 1, key: "synthetic.note", dataClass: "SYNTHETIC_WORKING_NOTE", value: "synthetic fixture", ...overrides };
}

test("OPENCLAW-M1.3 contract binds allowed classes, retention, quotas, reset and recovery", () => {
  assert.equal(new Ajv2020({ strict: true }).compile(schema)(contract), true);
  assert.equal(schema.properties.schemaVersion.const, contract.schemaVersion);
  assert.deepEqual(schema.properties.mindStore.properties.allowedDataClasses.const, contract.mindStore.allowedDataClasses);
  assert.equal(schema.properties.scratch.properties.capacityBytes.const, contract.scratch.capacityBytes);
  assert.equal(fixture.schemaVersion, "chimpmaera.openclaw-m1.3/synthetic-lifecycle-fixture/v1");
  assert.deepEqual(contract.mindStore.binding, ["workloadIdentity", "tenant", "purpose", "generation"]);
  assert.deepEqual(contract.mindStore.allowedDataClasses, ["SYNTHETIC_PREFERENCE", "SYNTHETIC_WORKING_NOTE"]);
  assert.equal(contract.mindStore.retention.expiryBehavior, "DENY_AND_PURGE_ON_ACCESS");
  assert.equal(contract.mindStore.reset.interruptionBehavior, "READ_WRITE_DENIED_UNTIL_RECOVERY_COMPLETES");
  assert.equal(contract.mindStore.recovery.staleReplayBehavior, "DENY");
  assert.equal(contract.scratch.capacityBytes, 1_048_576);
  assert.equal(contract.scratch.lifetime, "CONTAINER_INSTANCE_ONLY_PURGED_ON_RESTART");
  assert.deepEqual(fixture.expectedDenials.sort(), [
    "MIND_CONTRACT_DENIED", "MIND_ENTRY_QUOTA_DENIED", "MIND_GENERATION_EXHAUSTED_DENIED", "MIND_RECOVERY_REPLAY_DENIED", "MIND_RESET_IN_PROGRESS_DENIED",
    "MIND_RETENTION_EXPIRED_DENIED", "MIND_SCOPE_DENIED", "MIND_STALE_GENERATION_DENIED", "MIND_STATE_INVALID_DENIED",
    "MIND_TOTAL_QUOTA_DENIED",
  ]);
});

test("exact value, total and entry quota boundaries pass and one beyond denies", () => {
  const total = harness();
  for (let index = 0; index < 8; index += 1) {
    writeMind(total.state, contract, entry({ key: `total.${index}`, value: "x".repeat(2048) }), { nowMs: 1_000, persist: total.persist });
  }
  assert.equal(Object.values(total.state.scopes).flatMap((scope) => Object.values(scope.entries)).filter((value) => value.createdAtMs === 1_000).reduce((sum, value) => sum + Buffer.byteLength(value.value), 0), 16_384);
  assert.throws(() => writeMind(total.state, contract, entry({ key: "total.beyond", value: "x" }), { nowMs: 1_000, persist: total.persist }), /MIND_TOTAL_QUOTA_DENIED/);
  assert.equal(mindStatus(total.state, contract).phase, "READY");
  assert.throws(() => writeMind(harness().state, contract, entry({ value: "x".repeat(2049) }), { nowMs: 1_000, persist() {} }), /MIND_CONTRACT_DENIED/);

  const count = harness();
  for (let index = 0; index < 16; index += 1) writeMind(count.state, contract, entry({ key: `count.${index}`, value: "" }), { nowMs: 1_000, persist: count.persist });
  assert.throws(() => writeMind(count.state, contract, entry({ key: "count.beyond", value: "" }), { nowMs: 1_000, persist: count.persist }), /MIND_ENTRY_QUOTA_DENIED/);
});

test("cross-tenant read/write, denied classes and expired entries fail closed", () => {
  const subject = harness();
  assert.throws(() => writeMind(subject.state, contract, entry({ tenant: "tenant:synthetic-foreign" }), { nowMs: 1_000, persist: subject.persist }), /MIND_SCOPE_DENIED/);
  assert.throws(() => readMind(subject.state, contract, { ...binding, tenant: "tenant:synthetic-foreign", generation: 1, key: "isolation.canary" }, { nowMs: 1_000, persist: subject.persist }), /MIND_SCOPE_DENIED/);
  assert.throws(() => writeMind(subject.state, contract, entry({ dataClass: "CREDENTIAL" }), { nowMs: 1_000, persist: subject.persist }), /MIND_CONTRACT_DENIED/);
  writeMind(subject.state, contract, entry(), { nowMs: 1_000, persist: subject.persist });
  assert.throws(() => readMind(subject.state, contract, { ...binding, generation: 1, key: "synthetic.note" }, { nowMs: 86_401_000, persist: subject.persist }), /MIND_RETENTION_EXPIRED_DENIED/);
  assert.throws(() => readMind(subject.state, contract, { ...binding, generation: 1, key: "synthetic.note" }, { nowMs: 86_401_001, persist: subject.persist }), /MIND_ENTRY_NOT_FOUND_DENIED/);
});

test("scoped reset preserves foreign state and replay evidence while stale state denies", () => {
  const subject = harness();
  const effects = { receipt: "synthetic-replay-receipt" };
  writeMind(subject.state, contract, entry(), { nowMs: 1_000, persist: subject.persist });
  const foreignBefore = digest(subject.state.scopes[Object.keys(subject.state.scopes).find((key) => subject.state.scopes[key].generation === 7)]);
  const result = resetMind(subject.state, contract, { ...binding, generation: 1 }, { persist: subject.persist });
  assert.equal(result.status, "PASS");
  assert.equal(result.generation, 2);
  assert.equal(digest(subject.state.scopes[Object.keys(subject.state.scopes).find((key) => subject.state.scopes[key].generation === 7)]), foreignBefore);
  assert.deepEqual(effects, { receipt: "synthetic-replay-receipt" });
  assert.throws(() => readMind(subject.state, contract, { ...binding, generation: 1, key: "synthetic.note" }, { nowMs: 1_001, persist: subject.persist }), /MIND_STALE_GENERATION_DENIED/);
  assert.equal(resetMind(subject.state, contract, { ...binding, generation: 1 }, { persist: subject.persist }).reset, "ALREADY_COMMITTED");
});

test("interrupted reset is not ready, recovery completes once, and replay fails safely", () => {
  const subject = harness();
  writeMind(subject.state, contract, entry(), { nowMs: 1_000, persist: subject.persist });
  assert.throws(() => resetMind(subject.state, contract, { ...binding, generation: 1 }, { persist: subject.persist, interruptAfterPrepare: true }), /SYNTHETIC_RESET_INTERRUPTED/);
  assert.equal(mindStatus(subject.state, contract).phase, "RESET_RECOVERY_REQUIRED");
  assert.throws(() => writeMind(subject.state, contract, entry(), { nowMs: 1_001, persist: subject.persist }), /MIND_RESET_IN_PROGRESS_DENIED/);
  assert.equal(recoverMindState(subject.state, contract, subject.persist).status, "RECOVERED_RESET_COMMITTED");
  assert.equal(mindStatus(subject.state, contract).phase, "READY");
  assert.equal(recoverMindState(subject.state, contract, subject.persist).status, "CLEAN");
  assert.throws(() => writeMind(subject.state, contract, entry(), { nowMs: 1_002, persist: subject.persist }), /MIND_STALE_GENERATION_DENIED/);

  const invalid = harness();
  invalid.state.reset = { scope: "0".repeat(64), fromGeneration: 4, toGeneration: 4 };
  assert.throws(() => recoverMindState(invalid.state, contract, invalid.persist), /MIND_RECOVERY_REPLAY_DENIED/);
  const foreignReplay = harness();
  const foreignScope = Object.keys(foreignReplay.state.scopes).find((key) => foreignReplay.state.scopes[key].generation === 7);
  foreignReplay.state.reset = { scope: foreignScope, fromGeneration: 7, toGeneration: 8 };
  assert.throws(() => recoverMindState(foreignReplay.state, contract, foreignReplay.persist), /MIND_RECOVERY_REPLAY_DENIED/);
  const missingPrimary = harness();
  delete missingPrimary.state.scopes[Object.keys(missingPrimary.state.scopes).find((key) => missingPrimary.state.scopes[key].generation === 1)];
  assert.throws(() => mindStatus(missingPrimary.state, contract), /MIND_STATE_INVALID_DENIED/);
});

test("persisted entry tampering and stale nested generation fail closed", () => {
  const digestTamper = harness();
  writeMind(digestTamper.state, contract, entry(), { nowMs: 1_000, persist: digestTamper.persist });
  const primary = Object.values(digestTamper.state.scopes).find((scope) => scope.generation === 1);
  primary.entries["synthetic.note"].value = "tampered synthetic fixture";
  assert.throws(() => mindStatus(digestTamper.state, contract), /MIND_STATE_INVALID_DENIED/);

  const generationTamper = harness();
  writeMind(generationTamper.state, contract, entry(), { nowMs: 1_000, persist: generationTamper.persist });
  const generationScope = Object.values(generationTamper.state.scopes).find((scope) => scope.generation === 1);
  generationScope.entries["synthetic.note"].generation = 2;
  assert.throws(() => recoverMindState(generationTamper.state, contract, generationTamper.persist), /MIND_STATE_INVALID_DENIED/);
});

test("generation boundary prevalidation advances exactly once and denial is mutation-free", () => {
  const subject = harness();
  const primaryKey = Object.keys(subject.state.scopes).find((key) => subject.state.scopes[key].generation === 1);
  subject.state.scopes[primaryKey].generation = MAX_ADVANCEABLE_MIND_GENERATION;
  const result = resetMind(subject.state, contract, {
    ...binding, generation: MAX_ADVANCEABLE_MIND_GENERATION,
  }, { persist: subject.persist });
  assert.equal(result.generation, MAX_MIND_GENERATION);
  assert.equal(mindStatus(subject.state, contract).generation, MAX_MIND_GENERATION);

  const before = structuredClone(subject.state);
  const persistedCount = subject.snapshots.length;
  assert.throws(() => resetMind(subject.state, contract, {
    ...binding, generation: MAX_MIND_GENERATION,
  }, { persist: subject.persist }), /MIND_GENERATION_EXHAUSTED_DENIED/);
  assert.deepEqual(subject.state, before);
  assert.equal(subject.snapshots.length, persistedCount);

  subject.state.scopes[primaryKey].generation = Number.MAX_SAFE_INTEGER;
  assert.throws(() => mindStatus(subject.state, contract), /MIND_STATE_INVALID_DENIED/);
});
