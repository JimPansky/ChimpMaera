import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { canonicalJson, createErpReadAdapterV1, erpReadConnectorContractDigestV1, verifyErpReadConnectorContractV1, type ErpEntityV1, type ErpReadConnectorContractV1, type ErpReadRequestV1, type ErpSupportedExportV1 } from "../packages/contracts/src/index.js";

const load = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const contract = () => load<ErpReadConnectorContractV1>("tests/fixtures/erp-read/contract-v1.json");
const source = () => load<ErpSupportedExportV1>("tests/fixtures/erp-read/supported-export-v1.json");
const operation = (entity: ErpEntityV1) => ({ customers: "LIST_CUSTOMERS", orders: "LIST_ORDERS", invoices: "LIST_INVOICES" } as const)[entity];
const base = (entity: ErpEntityV1 = "invoices"): ErpReadRequestV1 => ({ operation: operation(entity), tenantId: "tenant:synthetic-zoo", principalId: "principal:bi-m1-reader", scopes: ["erp.synthetic.bi.read"], credentialPresent: true, fields: contract().fields[entity], pageSize: 2 });
const adapter = (overrides: { enabled?: boolean; source?: unknown; now?: string; contract?: unknown } = {}) => createErpReadAdapterV1({ contract: overrides.contract ?? contract(), source: overrides.source ?? source(), enabled: overrides.enabled ?? true, now: overrides.now ?? "2026-08-10T08:30:00Z" });
const redigest = (value: any): ErpSupportedExportV1 => { const lineage = { ...value.lineage }; delete lineage.sourceDigest; const content = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "lineage")); value.lineage.sourceDigest = createHash("sha256").update(canonicalJson({ ...content, lineage })).digest("hex"); return value; };

test("BI-003 contract is typed, schema-valid, default-off and least privilege", () => {
  const value = contract(); const validate = new Ajv2020({ strict: true }).compile(load<object>("schemas/contracts/erp-read-connector-v1.schema.json"));
  assert.equal(validate(value), true, JSON.stringify(validate.errors)); assert.equal(verifyErpReadConnectorContractV1(value), true); assert.equal(value.contractDigest, erpReadConnectorContractDigestV1(value));
  assert.equal(value.defaultEnabled, false); assert.deepEqual(value.identity.scopes, ["erp.synthetic.bi.read"]); assert.deepEqual(value.policy, { maxPageSize: 2, maxAgeSeconds: 3600, writesAllowed: false, approvalsAllowed: false, adminAllowed: false, broadDatabaseAccessAllowed: false, unknownFieldsAllowed: false });
});

test("BI-003 exact customer, order and invoice source readback preserves trust, identity, freshness, lineage, batch and record metadata", () => {
  for (const [index, entity] of (["customers", "orders", "invoices"] as const).entries()) {
    const result = adapter()(base(entity)); assert.equal(result.outcome, "READ"); if (result.outcome !== "READ") continue; const expected = source().batches[index]!;
    assert.deepEqual(result.records, expected.records.slice(0, 2).map((entry) => entry.facts)); assert.deepEqual(result.metadata.recordMetadata, expected.records.slice(0, 2).map((entry) => entry.recordMetadata));
    assert.equal(result.metadata.tenantId, "tenant:synthetic-zoo"); assert.equal(result.metadata.trust, "LOCAL_SYNTHETIC"); assert.equal(result.metadata.principalId, "principal:bi-m1-reader"); assert.equal(result.metadata.scope, "erp.synthetic.bi.read"); assert.deepEqual(result.metadata.batchIds, [expected.batchId]); assert.equal(result.metadata.sourceDatasetId, "dataset:zoo-bi-m1"); assert.equal(result.metadata.generatedAt, "2026-08-10T08:00:00Z"); assert.match(result.readbackDigest, /^[a-f0-9]{64}$/);
  }
});

test("BI-003 READ_SOURCE_FACTS is explicit and pagination, terminal and empty pages are deterministic", () => {
  const read = adapter(); const request = base("orders"); const first = read(request); assert.equal(first.outcome, "READ"); if (first.outcome !== "READ" || !first.metadata.nextCursor) return;
  const second = read({ ...request, cursor: first.metadata.nextCursor }); assert.equal(second.outcome, "READ"); if (second.outcome === "READ") { assert.equal(second.records.length, 1); assert.equal(second.metadata.nextCursor, null); }
  const terminal = read({ ...request, cursor: `erp1:${source().lineage.sourceDigest.slice(0, 16)}:orders:3` }); assert.equal(terminal.outcome, "READ"); if (terminal.outcome === "READ") assert.deepEqual(terminal.records, []);
  const facts = read({ ...base("customers"), operation: "READ_SOURCE_FACTS", entity: "customers" }); assert.equal(facts.outcome, "READ");
  const empty: any = source(); empty.batches[2].records = []; const emptyResult = adapter({ source: redigest(empty) })(base("invoices")); assert.equal(emptyResult.outcome, "READ"); if (emptyResult.outcome === "READ") { assert.deepEqual(emptyResult.records, []); assert.deepEqual(emptyResult.metadata.recordMetadata, []); }
});

test("BI-003 denies default-off, missing credentials, tenant mismatch, permission widening and undeclared fields", () => {
  assert.deepEqual(adapter({ enabled: false })(base()), { outcome: "DENIED", code: "CONNECTOR_DISABLED" });
  const probes: [unknown, string][] = [
    [{ ...base(), credentialPresent: false }, "CREDENTIAL_MISSING"], [{ ...base(), tenantId: "tenant:other" }, "TENANT_MISMATCH"],
    [{ ...base(), principalId: "principal:admin" }, "SCOPE_DENIED"], [{ ...base(), scopes: ["erp.synthetic.bi.read", "erp.write"] }, "SCOPE_DENIED"],
    [{ ...base(), fields: [...base().fields, "bankAccount"] }, "FIELD_DENIED"], [{ ...base(), pageSize: 3 }, "REQUEST_MALFORMED"],
  ]; for (const [request, code] of probes) assert.deepEqual(adapter()(request), { outcome: "DENIED", code });
});

test("BI-003 denies every named mutation/admin and broad database probe", () => {
  for (const op of ["CREATE_ORDER", "POST_INVOICE", "APPROVE_INVOICE", "WRITE_ORDER", "UPDATE_ORDER", "DELETE_ORDER", "ADMIN_EXPORT"]) assert.deepEqual(adapter()({ ...base(), operation: op }), { outcome: "DENIED", code: "MUTATION_DENIED" }, op);
  for (const op of ["QUERY_DATABASE", "RUN_SQL", "QUERY_TABLE", "DUMP_DATABASE", "EXPORT_ALL"]) assert.deepEqual(adapter()({ ...base(), operation: op }), { outcome: "DENIED", code: "DATABASE_ACCESS_DENIED" }, op);
  assert.deepEqual(adapter()({ ...base(), method: "POST" }), { outcome: "DENIED", code: "MUTATION_DENIED" }); assert.deepEqual(adapter()({ ...base(), sql: "synthetic-query-shape" }), { outcome: "DENIED", code: "DATABASE_ACCESS_DENIED" });
});

test("BI-003 denies stale, partial, malformed response, cursor replay and stale cursor deterministically", () => {
  assert.deepEqual(adapter({ now: "2026-08-10T09:00:01Z" })(base()), { outcome: "DENIED", code: "SOURCE_STALE" });
  const partial: any = source(); partial.batches[0].complete = false; assert.deepEqual(adapter({ source: partial })(base()), { outcome: "DENIED", code: "SOURCE_PARTIAL" });
  const malformed: any = source(); malformed.batches[0].records[0].facts.customerName = "undeclared"; assert.deepEqual(adapter({ source: malformed })(base()), { outcome: "DENIED", code: "SOURCE_MALFORMED" });
  const read = adapter(); const first = read(base("orders")); assert.equal(first.outcome, "READ"); if (first.outcome !== "READ" || !first.metadata.nextCursor) return; assert.equal(read({ ...base("orders"), cursor: first.metadata.nextCursor }).outcome, "READ"); assert.deepEqual(read({ ...base("orders"), cursor: first.metadata.nextCursor }), { outcome: "DENIED", code: "CURSOR_REPLAYED" });
  assert.deepEqual(adapter()({ ...base("orders"), cursor: "erp1:0000000000000000:orders:2" }), { outcome: "DENIED", code: "CURSOR_STALE" });
});

test("BI-003 malformed contract and source metadata fail closed without widening", () => {
  const badContract: any = contract(); badContract.policy.writesAllowed = true; assert.deepEqual(adapter({ contract: badContract })(base()), { outcome: "DENIED", code: "REQUEST_MALFORMED" });
  const mutations = [(s: any) => { s.tenantId = "tenant:other"; }, (s: any) => { s.batches[1].records[0].recordMetadata.lineageSequence = 0; }, (s: any) => { s.lineage.sourceDigest = "f".repeat(64); }, (s: any) => { s.batches[1].sequence = 1; }];
  for (const mutate of mutations) { const value: any = source(); mutate(value); assert.equal(adapter({ source: value })(base()).outcome, "DENIED"); }
});
