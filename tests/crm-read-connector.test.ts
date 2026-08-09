import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { createHash } from "node:crypto";
import { canonicalJson, createCrmReadAdapterV1, crmReadConnectorContractDigestV1, verifyCrmReadConnectorContractV1, type CrmReadConnectorContractV1, type CrmReadRequestV1, type CrmSupportedExportV1 } from "../packages/contracts/src/index.js";

const load = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const contract = () => load<CrmReadConnectorContractV1>("tests/fixtures/crm-read/contract-v1.json");
const source = () => load<CrmSupportedExportV1>("tests/fixtures/crm-read/supported-export-v1.json");
const base = (operation: CrmReadRequestV1["operation"] = "LIST_OPPORTUNITIES"): CrmReadRequestV1 => ({ operation, tenantId: "tenant:synthetic-zoo", principalId: "principal:bi-m1-reader", scopes: ["crm.synthetic.bi.read"], credentialPresent: true, fields: operation === "LIST_ACCOUNTS" ? ["accountId", "accountName", "industry"] : ["opportunityId", "accountId", "opportunityName", "stage", "amount", "currency", "expectedCloseDate"], pageSize: 2 });
const adapter = (overrides: { enabled?: boolean; source?: unknown; now?: string; contract?: unknown } = {}) => createCrmReadAdapterV1({ contract: overrides.contract ?? contract(), source: overrides.source ?? source(), enabled: overrides.enabled ?? true, now: overrides.now ?? "2026-08-09T10:30:00Z" });
const redigest = (value: any): CrmSupportedExportV1 => { const lineage = { ...value.lineage }; delete lineage.sourceDigest; const content = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "lineage")); value.lineage.sourceDigest = createHash("sha256").update(canonicalJson({ ...content, lineage })).digest("hex"); return value; };

test("BI-002 contract is versioned, typed, default-off, least privilege and schema-valid", () => {
  const value = contract(); const validate = new Ajv2020({ strict: true }).compile(load<object>("schemas/contracts/crm-read-connector-v1.schema.json"));
  assert.equal(validate(value), true, JSON.stringify(validate.errors)); assert.equal(verifyCrmReadConnectorContractV1(value), true); assert.equal(value.contractDigest, crmReadConnectorContractDigestV1(value));
  assert.equal(value.defaultEnabled, false); assert.deepEqual(value.identity.scopes, ["crm.synthetic.bi.read"]); assert.equal(value.policy.writesAllowed, false); assert.equal(value.policy.adminAllowed, false);
});

test("BI-002 exact account and opportunity source readback preserves metadata", () => {
  const read = adapter(); const accounts = read(base("LIST_ACCOUNTS")); assert.equal(accounts.outcome, "READ"); if (accounts.outcome !== "READ") return;
  assert.deepEqual(accounts.records, source().batches[0]?.records); assert.equal(accounts.metadata.tenantId, "tenant:synthetic-zoo"); assert.equal(accounts.metadata.trust, "LOCAL_SYNTHETIC"); assert.equal(accounts.metadata.recordCount, 2); assert.match(accounts.readbackDigest, /^[a-f0-9]{64}$/);
  const opportunities = read(base()); assert.equal(opportunities.outcome, "READ"); if (opportunities.outcome !== "READ") return;
  assert.deepEqual(opportunities.records, source().batches[1]?.records.slice(0, 2)); assert.deepEqual(opportunities.metadata.batchIds, ["batch:opportunities-001"]); assert.equal(opportunities.metadata.sourceDatasetId, "dataset:zoo-bi-m1");
});

test("BI-002 pagination, terminal and empty results are deterministic", () => {
  const read = adapter(); const first = read(base()); assert.equal(first.outcome, "READ"); if (first.outcome !== "READ") return; assert.ok(first.metadata.nextCursor);
  const second = read({ ...base(), cursor: first.metadata.nextCursor! }); assert.equal(second.outcome, "READ"); if (second.outcome !== "READ") return; assert.equal(second.records.length, 1); assert.equal(second.metadata.nextCursor, null);
  const terminal = read({ ...base(), cursor: `crm1:${source().lineage.sourceDigest.slice(0, 16)}:opportunities:3` }); assert.equal(terminal.outcome, "READ"); if (terminal.outcome === "READ") { assert.deepEqual(terminal.records, []); assert.equal(terminal.metadata.nextCursor, null); }
  const empty: any = source(); empty.batches[1].records = []; const emptyResult = adapter({ source: redigest(empty) })(base()); assert.equal(emptyResult.outcome, "READ"); if (emptyResult.outcome === "READ") { assert.deepEqual(emptyResult.records, []); assert.equal(emptyResult.metadata.recordCount, 0); }
});

test("BI-002 denies default-off, missing credential, tenant/scope/field widening, and mutations", () => {
  assert.deepEqual(adapter({ enabled: false })(base()), { outcome: "DENIED", code: "CONNECTOR_DISABLED" });
  const probes: [unknown, string][] = [
    [{ ...base(), credentialPresent: false }, "CREDENTIAL_MISSING"], [{ ...base(), tenantId: "tenant:other" }, "TENANT_MISMATCH"],
    [{ ...base(), scopes: ["crm.synthetic.bi.read", "crm.write"] }, "SCOPE_DENIED"], [{ ...base(), principalId: "principal:admin" }, "SCOPE_DENIED"],
    [{ ...base(), fields: [...base().fields, "ownerEmail"] }, "FIELD_DENIED"], [{ ...base(), operation: "CREATE_ACCOUNT" }, "MUTATION_DENIED"],
    [{ ...base(), method: "POST" }, "MUTATION_DENIED"], [{ ...base(), pageSize: 3 }, "REQUEST_MALFORMED"],
  ];
  for (const [request, code] of probes) assert.deepEqual(adapter()(request), { outcome: "DENIED", code });
});

test("BI-002 denies stale, partial, malformed, replayed and stale-cursor sources", () => {
  assert.deepEqual(adapter({ now: "2026-08-09T12:00:00Z" })(base()), { outcome: "DENIED", code: "SOURCE_STALE" });
  const partial: any = source(); partial.batches[0].complete = false; assert.deepEqual(adapter({ source: partial })(base()), { outcome: "DENIED", code: "SOURCE_PARTIAL" });
  const malformed = source(); (malformed.batches[0]!.records[0] as any).ownerEmail = "excluded@example.invalid"; assert.deepEqual(adapter({ source: malformed })(base()), { outcome: "DENIED", code: "SOURCE_MALFORMED" });
  const read = adapter(); const first = read(base()); assert.equal(first.outcome, "READ"); if (first.outcome !== "READ" || !first.metadata.nextCursor) return;
  assert.equal(read({ ...base(), cursor: first.metadata.nextCursor }).outcome, "READ"); assert.deepEqual(read({ ...base(), cursor: first.metadata.nextCursor }), { outcome: "DENIED", code: "CURSOR_REPLAYED" });
  assert.deepEqual(adapter()({ ...base(), cursor: "crm1:0000000000000000:opportunities:2" }), { outcome: "DENIED", code: "CURSOR_STALE" });
});

test("BI-002 malformed contract and source metadata fail closed", () => {
  const badContract = contract(); (badContract as any).policy.writesAllowed = true; assert.deepEqual(adapter({ contract: badContract })(base()), { outcome: "DENIED", code: "REQUEST_MALFORMED" });
  for (const mutate of [(s: any) => { s.tenantId = "tenant:other"; }, (s: any) => { s.batches[0].sequence = 2; s.batches[1].sequence = 1; }, (s: any) => { s.lineage.sourceDigest = "f".repeat(64); }]) { const value: any = source(); mutate(value); const result = adapter({ source: value })(base()); assert.equal(result.outcome, "DENIED"); }
});
