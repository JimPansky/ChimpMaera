import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";

import {
  ERP_ORDER_CLAIM_BOUNDARY_V1,
  ErpOrderCapabilityCellV1,
  erpOrderConsumerV1,
  erpOrderProfileDigestV1,
  evaluateErpOrderProfileV1,
  syntheticCapabilityCatalogueV1,
  syntheticErpOrderProfilesV1,
  type ErpOrderProfileV1,
} from "../packages/contracts/src/index.js";

function fixture() {
  const catalogue = syntheticCapabilityCatalogueV1();
  const profiles = syntheticErpOrderProfilesV1(catalogue);
  const core = new ErpOrderCapabilityCellV1({
    catalogue,
    profiles,
    activeProfileDigest: profiles[0].profileDigest,
  });
  return { catalogue, profiles, core };
}

function request(suffix: string) {
  return { requestId: `request:erp-cell-${suffix}`, sku: "SYN-CELL-ERP-01", quantity: 2 } as const;
}

function runSlice() {
  const { profiles, core } = fixture();
  const first = erpOrderConsumerV1(core, request("provider-a-001"));
  assert.throws(() => erpOrderConsumerV1(core, request("provider-a-001")), /ERP_ORDER_REPLAY_DENIED/);
  const switched = core.switchProfile(profiles[0].profileDigest, profiles[1].profileDigest);
  const second = erpOrderConsumerV1(core, request("provider-b-001"));
  assert.throws(() => erpOrderConsumerV1(core, request("provider-b-001")), /ERP_ORDER_REPLAY_DENIED/);
  const rolledBack = core.rollbackProfile(switched);
  const beforeReset = core.evidence();
  const reset = core.reset();
  return { first, switched, second, rolledBack, beforeReset, reset };
}

test("CAP-CELL-ERP-01 freezes exactly two closed catalogue-bound provider profiles", () => {
  const schema = JSON.parse(readFileSync("schemas/contracts/erp-order-capability-cell-profile-v1.schema.json", "utf8")) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const { catalogue, profiles } = fixture();
  assert.equal(profiles.length, 2);
  assert.deepEqual(profiles.map(({ provider }) => provider.kind), ["SYNTHETIC_LEDGER_A", "SYNTHETIC_COMMERCE_B"]);
  const action = catalogue.actions.find(({ actionId }) => actionId === "erp.order.create");
  assert.ok(action);
  for (const profile of profiles) {
    assert.equal(validate(profile), true, JSON.stringify(validate.errors));
    assert.deepEqual(evaluateErpOrderProfileV1(profile, catalogue), { outcome: "CONFORMANT" });
    assert.equal(profile.catalogueBinding.actionDigest, action.digest);
    assert.equal(erpOrderProfileDigestV1(profile), profile.profileDigest);
    assert.equal(profile.claimBoundary, ERP_ORDER_CLAIM_BOUNDARY_V1);
    assert.equal(profile.runtime.network, "DISABLED");
    assert.equal(profile.runtime.externalCalls, false);
    assert.equal(profile.runtime.activationAuthority, false);
  }
  assert.notDeepEqual(profiles[0].provider.requestSchema, profiles[1].provider.requestSchema);
  assert.notDeepEqual(profiles[0].provider.mapping, profiles[1].provider.mapping);
});

test("CAP-CELL-ERP-01 uses the identical consumer/core across exact profile switch and emits rights diff", () => {
  const { profiles, core } = fixture();
  const coreSource = ErpOrderCapabilityCellV1.toString();
  const consumerSource = erpOrderConsumerV1.toString();
  const coreDigest = createHash("sha256").update(coreSource).digest("hex");
  const consumerDigest = createHash("sha256").update(consumerSource).digest("hex");
  const first = erpOrderConsumerV1(core, request("provider-a-002"));
  const switched = core.switchProfile(profiles[0].profileDigest, profiles[1].profileDigest);
  const second = erpOrderConsumerV1(core, request("provider-b-002"));
  assert.equal(first.actionId, "erp.order.create");
  assert.equal(second.actionId, "erp.order.create");
  assert.notEqual(first.bindingId, second.bindingId);
  assert.equal(createHash("sha256").update(ErpOrderCapabilityCellV1.toString()).digest("hex"), coreDigest);
  assert.equal(createHash("sha256").update(erpOrderConsumerV1.toString()).digest("hex"), consumerDigest);
  assert.deepEqual(switched.rightsDiff, {
    removed: ["sales-order.create", "sales-order.delete-rollback", "sales-order.readback"],
    added: ["order.cancel-rollback", "order.create", "order.readback"],
    retained: [],
  });
  assert.equal(switched.unchangedAction, "erp.order.create");
  assert.equal(switched.fromProfileDigest, profiles[0].profileDigest);
  assert.equal(switched.toProfileDigest, profiles[1].profileDigest);
});

test("CAP-CELL-ERP-01 readback receipts, rollback, replay denial and reset leave zero residue", () => {
  const result = runSlice();
  for (const receipt of [result.first, result.second]) {
    assert.equal(receipt.outcome, "SYNTHETIC_ORDER_READBACK_AND_ROLLBACK_VERIFIED");
    assert.equal(receipt.effectCount, 1);
    assert.equal(receipt.rollbackCount, 1);
    assert.equal(receipt.beforeDigest, receipt.finalDigest);
    assert.notEqual(receipt.beforeDigest, receipt.mutationDigest);
    assert.match(receipt.readbackDigest, /^[a-f0-9]{64}$/);
    assert.match(receipt.receiptDigest, /^[a-f0-9]{64}$/);
  }
  assert.equal(result.rolledBack.outcome, "EXACT_PROFILE_ROLLED_BACK");
  assert.equal(result.beforeReset.executions, 2);
  assert.equal(result.beforeReset.replayDenials, 2);
  assert.equal(result.beforeReset.profileSwitches, 1);
  assert.equal(result.beforeReset.profileRollbacks, 1);
  assert.equal(result.beforeReset.providerOrderCount, 0);
  assert.equal(result.beforeReset.activeProfileDigest, result.beforeReset.lkgProfileDigest);
  assert.equal(result.reset.retainedReceiptDigests.length, 2);
  assert.equal(result.reset.residue.providerOrderCount, 0);
  assert.equal(result.reset.residue.receiptDigests.length, 0);
  assert.equal(result.reset.residue.executions, 0);
  assert.equal(result.reset.residue.replayDenials, 0);
});

test("CAP-CELL-ERP-01 complete double-run evidence is deterministic", () => {
  assert.deepEqual(runSlice(), runSlice());
});

test("CAP-CELL-ERP-01 incompatible semantics, profile drift and forged rollback fail closed without residue", () => {
  const { catalogue, profiles, core } = fixture();
  const incompatible = structuredClone(profiles[1]) as ErpOrderProfileV1;
  (incompatible.semantics as unknown as Record<string, unknown>).quantityMeaning = "ACCOUNTING_BASE_UNITS";
  (incompatible as unknown as Record<string, unknown>).profileDigest = erpOrderProfileDigestV1(incompatible);
  assert.deepEqual(evaluateErpOrderProfileV1(incompatible, catalogue), {
    outcome: "DENIED",
    reason: "ERP_PROFILE_INCOMPATIBLE_SEMANTICS_DENIED",
  });

  const tampered = structuredClone(profiles[1]) as unknown as Record<string, unknown>;
  tampered.hiddenProviderAuthority = true;
  assert.deepEqual(evaluateErpOrderProfileV1(tampered, catalogue), {
    outcome: "DENIED",
    reason: "ERP_PROFILE_SCHEMA_DENIED",
  });

  assert.throws(() => core.switchProfile("f".repeat(64), profiles[1].profileDigest), /ERP_PROFILE_EXACT_SWITCH_DENIED/);
  assert.equal(core.evidence().activeProfileDigest, profiles[0].profileDigest);
  const switched = core.switchProfile(profiles[0].profileDigest, profiles[1].profileDigest);
  const forged = { ...switched, switchDigest: "f".repeat(64) };
  assert.throws(() => core.rollbackProfile(forged), /ERP_PROFILE_ROLLBACK_DENIED/);
  const widened = { ...switched, hiddenAuthority: true } as unknown as typeof switched;
  assert.throws(() => core.rollbackProfile(widened), /ERP_PROFILE_ROLLBACK_DENIED/);
  assert.equal(core.evidence().activeProfileDigest, profiles[1].profileDigest);
  assert.equal(core.evidence().providerOrderCount, 0);
  assert.equal(core.evidence().receiptDigests.length, 0);
});

test("CAP-CELL-ERP-01 changed files contain no credential, host, private path or external-call material", () => {
  const paths = [
    "packages/contracts/src/erp-order-capability-cell.ts",
    "schemas/contracts/erp-order-capability-cell-profile-v1.schema.json",
  ];
  const source = paths.map((path) => readFileSync(path, "utf8")).join("\n");
  for (const denied of [
    /-----BEGIN .*PRIVATE KEY-----/,
    /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /https?:\/\/(?!json-schema\.org|pansphaira\.invalid)/,
    /\/home\/[A-Za-z0-9._-]+\//,
    /\/mnt\/[A-Za-z0-9._-]+\//,
  ]) assert.equal(denied.test(source), false, denied.source);
});
