import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { biSemanticModelDigestV1, reconcileCrmErpV1, verifyBiSemanticModelV1, type BiReconciliationInputV1, type BiSemanticModelV1 } from "../packages/contracts/src/index.js";

const load = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const model = () => load<BiSemanticModelV1>("tests/fixtures/bi-semantic/model-v1.json");
const input = () => load<BiReconciliationInputV1>("tests/fixtures/bi-semantic/positive-reconciliation-v1.json");
const run = (value: unknown = input(), contract: unknown = model()) => reconcileCrmErpV1({ model: contract, input: value, enabled: true });

test("BI-004 model is explicit, versioned, digest-bound, deterministic, and default-off", () => {
  const value = model(); const validate = new Ajv2020({ strict: true }).compile(load<object>("schemas/contracts/bi-semantic-model-v1.schema.json")); assert.equal(validate(value), true, JSON.stringify(validate.errors)); assert.equal(verifyBiSemanticModelV1(value), true); assert.equal(value.modelDigest, biSemanticModelDigestV1(value)); assert.equal(value.defaultEnabled, false);
  assert.deepEqual(value.entities, ["CRM_OPPORTUNITY", "ERP_ORDER", "CANONICAL_REVENUE_FACT"]); assert.equal(value.measures.length, 3); assert.ok(value.measures.every((measure) => measure.formula.length > 0));
  assert.deepEqual(value.policy, { toleranceMinor: 0, maxAgeSeconds: 3600, unknownFieldsAllowed: false, nullsAllowed: false, writesAllowed: false, sourceWriteBackAllowed: false, probabilisticMergeAllowed: false, conflictResolution: "EXPLICIT_ONLY" });
  assert.deepEqual(reconcileCrmErpV1({ model: value, input: input(), enabled: false }), { outcome: "DENIED", code: "MODEL_DISABLED" });
});

test("BI-004 matched facts preserve tenant, both source IDs, trust, freshness, lineage, and source readback", () => {
  const result = run(); assert.equal(result.outcome, "RECONCILED"); if (result.outcome !== "RECONCILED") return; assert.equal(result.rows.length, 3); assert.ok(result.rows.every((row) => row.outcome === "MATCHED"));
  for (const row of result.rows) { assert.equal(row.tenantId, "tenant:synthetic-zoo"); assert.ok(row.crmOpportunityId); assert.ok(row.erpOrderId); assert.equal(row.sourceIds.length, 3); assert.deepEqual(row.trust, ["LOCAL_SYNTHETIC", "LOCAL_SYNTHETIC"]); assert.match(row.lineage.crm.digest, /^[a-f0-9]{64}$/); assert.match(row.lineage.erp.digest, /^[a-f0-9]{64}$/); assert.ok(row.lineage.erp.sourceRecordId); }
  assert.deepEqual(result.sourceMutationProof, { attemptedOperations: [], writesAllowed: false, sourceWriteBackAllowed: false, inputDigestBefore: result.sourceMutationProof.inputDigestBefore, inputDigestAfter: result.sourceMutationProof.inputDigestBefore });
});

test("BI-004 KPIs recompute exactly from every demonstrated matched source readback", () => {
  const result = run(); assert.equal(result.outcome, "RECONCILED"); if (result.outcome !== "RECONCILED") return;
  assert.deepEqual(result.kpis, { crmAmountMinor: 8750000, erpOrderTotalMinor: 8750000, reconciliationDeltaMinor: 0, toleranceMinor: 0, exact: true, formulaIds: ["measure:crm-amount-minor", "measure:erp-order-total-minor", "measure:reconciliation-delta-minor"], sourceReadbackIds: ["erp-record:order-001", "erp-record:order-002", "erp-record:order-003", "opportunity:care-003", "opportunity:habitat-001", "opportunity:water-002", "order:synthetic-001", "order:synthetic-002", "order:synthetic-003"].sort() });
  assert.equal(result.kpis.crmAmountMinor, result.rows.reduce((sum, row) => sum + (row.outcome === "MATCHED" ? row.values.crmAmountMinor! : 0), 0)); assert.equal(result.kpis.erpOrderTotalMinor, result.rows.reduce((sum, row) => sum + (row.outcome === "MATCHED" ? row.values.erpTotalMinor! : 0), 0));
});

test("BI-004 classifies unmatched, ambiguous, duplicate, and conflicting records without mutation", () => {
  const value: any = input(); value.crm.facts.push({ ...value.crm.facts[0] }); value.crm.facts.push({ opportunityId: "opportunity:unmatched-004", accountId: "account:alpine-zoo", amountMajor: 100, currency: "EUR", sourceBatchId: "batch:opportunities-001" }); value.erp.facts.push({ orderId: "order:unmatched-004", customerId: "customer:zoo-001", totalMinor: 10000, currency: "EUR", sourceRecordId: "erp-record:order-004", sourceUpdatedAt: "2026-08-10T07:48:00Z", sourceBatchId: "batch:erp-orders-001" }); value.crm.facts.push({ opportunityId: "opportunity:matched-005", accountId: "account:alpine-zoo", amountMajor: 50, currency: "EUR", sourceBatchId: "batch:opportunities-001" }); value.erp.facts.push({ orderId: "order:matched-005", customerId: "customer:zoo-001", totalMinor: 5000, currency: "EUR", sourceRecordId: "erp-record:order-005", sourceUpdatedAt: "2026-08-10T07:49:00Z", sourceBatchId: "batch:erp-orders-001" }); value.mappings.push({ crmOpportunityId: "opportunity:matched-005", erpOrderId: "order:matched-005" }); value.mappings.push({ crmOpportunityId: "opportunity:water-002", erpOrderId: "order:synthetic-003" }); value.erp.facts[2].totalMinor = 2700000;
  const result = run(value); assert.equal(result.outcome, "RECONCILED"); if (result.outcome !== "RECONCILED") return; const outcomes = new Set(result.rows.map((row) => row.outcome)); for (const expected of ["MATCHED", "UNMATCHED", "AMBIGUOUS", "DUPLICATE", "CONFLICTING"]) assert.equal(outcomes.has(expected as any), true, expected); assert.equal(result.sourceMutationProof.inputDigestBefore, result.sourceMutationProof.inputDigestAfter);
});

test("BI-004 unknown model/input schema and formula drift fail closed", () => {
  const unknownModel: any = model(); unknownModel.schemaVersion = "chimpmaera.bi/semantic-model/v2"; assert.deepEqual(run(input(), unknownModel), { outcome: "DENIED", code: "UNKNOWN_SCHEMA_VERSION" });
  const unknownInput: any = input(); unknownInput.schemaVersion = "chimpmaera.bi/reconciliation-input/v2"; assert.deepEqual(run(unknownInput), { outcome: "DENIED", code: "UNKNOWN_SCHEMA_VERSION" });
  const drift: any = model(); drift.measures[0].formula = "SUM(crm.amount_major)"; assert.deepEqual(run(input(), drift), { outcome: "DENIED", code: "FORMULA_DRIFT" });
});

test("BI-004 lineage loss and tenant mismatch fail closed while stale sources remain explicit", () => {
  const missing: any = input(); delete missing.crm.lineage; assert.deepEqual(run(missing), { outcome: "DENIED", code: "LINEAGE_MISSING" });
  const tenant: any = input(); tenant.tenantId = "tenant:other"; assert.deepEqual(run(tenant), { outcome: "DENIED", code: "TENANT_MISMATCH" });
  const stale: any = input(); stale.observedAt = "2026-08-10T09:00:01Z"; const result = run(stale); assert.equal(result.outcome, "RECONCILED"); if (result.outcome === "RECONCILED") { assert.ok(result.rows.every((row) => row.outcome === "STALE")); assert.deepEqual(result.kpis, { crmAmountMinor: 0, erpOrderTotalMinor: 0, reconciliationDeltaMinor: 0, toleranceMinor: 0, exact: true, formulaIds: ["measure:crm-amount-minor", "measure:erp-order-total-minor", "measure:reconciliation-delta-minor"], sourceReadbackIds: [] }); }
});

test("BI-004 currency/unit mismatch, nulls, and unsupported fields fail closed", () => {
  const currency: any = input(); currency.crm.facts[0].currency = "USD"; assert.deepEqual(run(currency), { outcome: "DENIED", code: "CURRENCY_UNIT_MISMATCH" });
  const unit: any = input(); unit.erp.facts[0].totalMinor = 42000.5; assert.deepEqual(run(unit), { outcome: "DENIED", code: "SOURCE_INVALID" });
  const nullable: any = input(); nullable.erp.facts[0].sourceRecordId = null; assert.deepEqual(run(nullable), { outcome: "DENIED", code: "NULL_DENIED" });
  const unsupported: any = input(); unsupported.crm.facts[0].ownerEmail = "excluded@example.invalid"; assert.deepEqual(run(unsupported), { outcome: "DENIED", code: "UNSUPPORTED_FIELD" });
});

test("BI-004 output and canonical IDs are stable across repeated runs", () => { assert.deepEqual(run(), run()); });
