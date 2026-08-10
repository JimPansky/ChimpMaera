import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { resetBiE2eState, runBiE2eGate, sourceFixtureDigests } from "../scripts/bi-e2e-gate.mjs";

const temporary = async (t) => { const value = await mkdtemp(path.join(tmpdir(), "cm-bi006-")); t.after(() => rm(value, { recursive: true, force: true })); return value; };

test("BI-006 remains default-off", async (t) => assert.deepEqual(await runBiE2eGate({ stateDirectory: await temporary(t) }), { outcome: "DENIED", code: "BI_E2E_DISABLED" }));
test("BI-006 fresh setup reaches healthy/ready with exact source, KPI and dashboard readbacks", async (t) => {
  const result = await runBiE2eGate({ stateDirectory: await temporary(t), enabled: true });
  assert.deepEqual([result.outcome, result.health, result.readiness], ["PASS", "HEALTHY", "READY"]);
  assert.deepEqual(result.recordCounts, { crm: 3, erp: 3, reconciled: 3 }); assert.equal(result.toleranceMinor, 0);
  assert.deepEqual(result.exactReadbacks, { crmAmountMinor: 8750000, erpOrderTotalMinor: 8750000, reconciliationDeltaMinor: 0, dashboard: { "measure:crm-amount-minor": 8750000, "measure:erp-order-total-minor": 8750000, "measure:reconciliation-delta-minor": 0 } });
});
test("BI-006 source fixtures remain byte-identical across run and scoped reset", async (t) => {
  const directory = await temporary(t); const before = await sourceFixtureDigests(); await runBiE2eGate({ stateDirectory: directory, enabled: true });
  assert.deepEqual(await resetBiE2eState(directory), { outcome: "RESET", code: "SCOPED_BI_STATE_REMOVED" }); assert.deepEqual(await sourceFixtureDigests(), before);
});
test("BI-006 reset refuses unmarked state and preserves unrelated files", async (t) => {
  const directory = await temporary(t); await writeFile(path.join(directory, "keep"), "unchanged"); assert.deepEqual(await resetBiE2eState(directory), { outcome: "DENIED", code: "RESET_SCOPE_UNVERIFIED" });
  await runBiE2eGate({ stateDirectory: directory, enabled: true }); await resetBiE2eState(directory); assert.equal(await readFile(path.join(directory, "keep"), "utf8"), "unchanged");
});
test("BI-006 rerun and replay are deterministic without duplicate records", async (t) => {
  const directory = await temporary(t); const first = await runBiE2eGate({ stateDirectory: directory, enabled: true }); await resetBiE2eState(directory); const second = await runBiE2eGate({ stateDirectory: directory, enabled: true });
  assert.deepEqual(second, first); assert.equal(second.recordCounts.reconciled, 3);
});
test("BI-006 interrupted run recovers atomically without upgraded claims", async (t) => {
  const directory = await temporary(t); assert.deepEqual(await runBiE2eGate({ stateDirectory: directory, enabled: true, probe: "interrupted-run" }), { outcome: "DENIED", code: "RUN_INTERRUPTED" });
  const recovered = await runBiE2eGate({ stateDirectory: directory, enabled: true }); assert.equal(recovered.outcome, "PASS"); assert.equal(recovered.claims.includes("PRODUCTION_READY"), false);
});
test("BI-006 named denial and unavailable probes fail closed", async (t) => {
  const directory = await temporary(t); const cases = { write: "WRITE_DENIED", tenant: "TENANT_MISMATCH", schema: "UNKNOWN_SCHEMA_VERSION", lineage: "LINEAGE_MISSING", freshness: "SOURCE_STALE", replay: "REPLAY_DENIED", "unsupported-metric": "UNKNOWN_METRIC", "formula-drift": "FORMULA_DRIFT", duplicate: "DUPLICATE_DENIED", timeout: "SOURCE_TIMEOUT", "unavailable-source": "SOURCE_UNAVAILABLE" };
  for (const [probe, code] of Object.entries(cases)) { const value = await runBiE2eGate({ stateDirectory: directory, enabled: true, probe }); assert.equal(value.code, code, probe); assert.ok(["DENIED", "UNAVAILABLE"].includes(value.outcome), probe); }
});
test("BI-006 interrupted reset is non-destructive and recoverable", async (t) => { const directory = await temporary(t); await runBiE2eGate({ stateDirectory: directory, enabled: true }); assert.deepEqual(await resetBiE2eState(directory, { interrupt: true }), { outcome: "DENIED", code: "RESET_INTERRUPTED" }); assert.equal(JSON.parse(await readFile(path.join(directory, "run.json"))).outcome, "PASS"); assert.equal((await resetBiE2eState(directory)).outcome, "RESET"); });
test("BI-006 evidence tamper and identity drift are observable", async (t) => { const directory = await temporary(t); for (const [probe, code] of [["tampered-evidence", "EVIDENCE_DIGEST_MISMATCH"], ["identity-drift", "TESTED_COMMIT_MISMATCH"]]) assert.deepEqual(await runBiE2eGate({ stateDirectory: directory, enabled: true, probe }), { outcome: "DENIED", code }); assert.deepEqual(await runBiE2eGate({ stateDirectory: directory, enabled: true, testedCommit: "f".repeat(40) }), { outcome: "DENIED", code: "TESTED_COMMIT_MISMATCH" }); });
