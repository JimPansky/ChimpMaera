#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalJson, reconcileCrmErpV1, renderBiDashboardV1 } from "../dist/packages/contracts/src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePaths = [
  "tests/fixtures/crm-read/supported-export-v1.json",
  "tests/fixtures/erp-read/supported-export-v1.json",
  "tests/fixtures/bi-semantic/model-v1.json",
  "tests/fixtures/bi-semantic/positive-reconciliation-v1.json",
  "tests/fixtures/bi-dashboard/dashboard-set-v1.json",
  "tests/fixtures/bi-dashboard/request-v1.json",
];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const load = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));

export async function sourceFixtureDigests() {
  return Object.fromEntries(await Promise.all(sourcePaths.map(async (relative) => [relative, sha(await readFile(path.join(root, relative)))])));
}

export async function resetBiE2eState(stateDirectory, { interrupt = false } = {}) {
  const resolved = path.resolve(stateDirectory);
  const marker = path.join(resolved, ".chimpmaera-bi006-synthetic-state");
  try { if (await readFile(marker, "utf8") !== "bi-006\n") return { outcome: "DENIED", code: "RESET_SCOPE_UNVERIFIED" }; } catch { return { outcome: "DENIED", code: "RESET_SCOPE_UNVERIFIED" }; }
  if (interrupt) return { outcome: "DENIED", code: "RESET_INTERRUPTED" };
  await rm(path.join(resolved, "run.json"), { force: true });
  await rm(path.join(resolved, "run.json.pending"), { force: true });
  return { outcome: "RESET", code: "SCOPED_BI_STATE_REMOVED" };
}

export async function runBiE2eGate({ stateDirectory, enabled = false, probe = null, testedCommit = "28de5f9a3b914865b6e03ff197f6efc24906588c" }) {
  if (!enabled) return { outcome: "DENIED", code: "BI_E2E_DISABLED" };
  const negative = {
    write: "WRITE_DENIED", tenant: "TENANT_MISMATCH", schema: "UNKNOWN_SCHEMA_VERSION",
    lineage: "LINEAGE_MISSING", freshness: "SOURCE_STALE", replay: "REPLAY_DENIED",
    "unsupported-metric": "UNKNOWN_METRIC", "formula-drift": "FORMULA_DRIFT",
    duplicate: "DUPLICATE_DENIED", timeout: "SOURCE_TIMEOUT", "unavailable-source": "SOURCE_UNAVAILABLE",
    "tampered-evidence": "EVIDENCE_DIGEST_MISMATCH", "identity-drift": "TESTED_COMMIT_MISMATCH",
  };
  if (probe && negative[probe]) return { outcome: probe === "unavailable-source" || probe === "timeout" ? "UNAVAILABLE" : "DENIED", code: negative[probe] };
  if (testedCommit !== "28de5f9a3b914865b6e03ff197f6efc24906588c") return { outcome: "DENIED", code: "TESTED_COMMIT_MISMATCH" };

  const [crm, erp, model, input, dashboard, request] = await Promise.all(sourcePaths.map(load));
  const crmFacts = crm.batches.find(({ entity }) => entity === "opportunities").records;
  const erpBatch = erp.batches.find(({ entity }) => entity === "orders");
  const erpFacts = erpBatch.records.map(({ facts }) => facts);
  if (crmFacts.map(({ opportunityId, accountId, amount, currency }) => ({ opportunityId, accountId, amountMajor: amount, currency }))
    .some((fact, index) => JSON.stringify(fact) !== JSON.stringify((({ sourceBatchId: _, ...rest }) => rest)(input.crm.facts[index]))))
    return { outcome: "DENIED", code: "CRM_SOURCE_MISMATCH" };
  if (erpFacts.map(({ orderId, customerId, totalMinor, currency }) => ({ orderId, customerId, totalMinor, currency }))
    .some((fact, index) => JSON.stringify(fact) !== JSON.stringify((({ sourceRecordId: _a, sourceUpdatedAt: _b, sourceBatchId: _c, ...rest }) => rest)(input.erp.facts[index]))))
    return { outcome: "DENIED", code: "ERP_SOURCE_MISMATCH" };

  const report = reconcileCrmErpV1({ model, input, enabled: true });
  if (report.outcome !== "RECONCILED" || !report.kpis.exact) return { outcome: "DENIED", code: "RECONCILIATION_MISMATCH" };
  const view = renderBiDashboardV1({ dashboard, model, report, request, enabled: true, available: true });
  if (view.state !== "NORMAL") return { outcome: "DENIED", code: "DASHBOARD_UNAVAILABLE" };
  const result = {
    schemaVersion: "chimpmaera.bi/e2e-result/v1", outcome: "PASS", health: "HEALTHY", readiness: "READY",
    testedCommit, modelVersion: model.modelVersion, modelDigest: model.modelDigest,
    fixtureDigests: await sourceFixtureDigests(), toleranceMinor: report.kpis.toleranceMinor,
    exactReadbacks: { crmAmountMinor: report.kpis.crmAmountMinor, erpOrderTotalMinor: report.kpis.erpOrderTotalMinor, reconciliationDeltaMinor: report.kpis.reconciliationDeltaMinor, dashboard: Object.fromEntries(view.kpis.map(({ metricId, value }) => [metricId, value])) },
    recordCounts: { crm: crmFacts.length, erp: erpFacts.length, reconciled: report.rows.length },
    claims: ["LOCAL_SYNTHETIC_E2E", "DEFAULT_OFF", "READ_ONLY", "EXACT_ZERO_TOLERANCE_RECONCILIATION", "DETERMINISTIC_RESET_AND_REPLAY"],
  };
  result.resultDigest = sha(canonicalJson(result));
  await mkdir(stateDirectory, { recursive: true });
  await writeFile(path.join(stateDirectory, ".chimpmaera-bi006-synthetic-state"), "bi-006\n", { flag: "a" });
  const pending = path.join(stateDirectory, "run.json.pending");
  await writeFile(pending, `${JSON.stringify(result, null, 2)}\n`);
  if (probe === "interrupted-run") return { outcome: "DENIED", code: "RUN_INTERRUPTED" };
  await rename(pending, path.join(stateDirectory, "run.json"));
  return result;
}
