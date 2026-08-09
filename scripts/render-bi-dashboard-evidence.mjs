#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { reconcileCrmErpV1, renderBiDashboardV1 } from "../dist/packages/contracts/src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
if (args.some((argument) => argument !== "--check")) throw new Error("BI_DASHBOARD_EVIDENCE_ARGUMENT_DENIED");
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), "utf8"));
const shaBytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digest = (relative) => shaBytes(readFileSync(path.join(root, relative)));
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
const clone = (value) => structuredClone(value);

const dashboard = readJson("tests/fixtures/bi-dashboard/dashboard-set-v1.json");
const model = readJson("tests/fixtures/bi-semantic/model-v1.json");
const input = readJson("tests/fixtures/bi-semantic/positive-reconciliation-v1.json");
const baseRequest = readJson("tests/fixtures/bi-dashboard/request-v1.json");
const reconcile = (source) => reconcileCrmErpV1({ model, input: source, enabled: true });
const render = ({ report = reconcile(input), request = baseRequest, enabled = true, available = true } = {}) => renderBiDashboardV1({ dashboard, model, report, request, enabled, available });

const overview = render();
const normalRequest = clone(baseRequest);
normalRequest.drillThrough.canonicalId = overview.drillThrough.availableCanonicalIds[0];
const emptyInput = clone(input);
emptyInput.crm.facts = [];
emptyInput.erp.facts = [];
emptyInput.mappings = [];
const staleInput = clone(input);
staleInput.observedAt = "2026-08-10T09:00:01Z";
const conflictRequest = clone(baseRequest);
conflictRequest.filters.outcomes = ["MATCHED", "CONFLICTING"];
const deniedRequest = clone(baseRequest);
deniedRequest.principalId = "principal:other";

const readbacks = {
  normal: render({ request: normalRequest }),
  empty: render({ report: reconcile(emptyInput) }),
  stale: render({ report: reconcile(staleInput) }),
  conflict: render({ request: conflictRequest }),
  denied: render({ request: deniedRequest }),
  error: render({ available: false }),
};

const artifactDirectory = "verification/bi-005-dashboard-readbacks";
const artifactBytes = Object.fromEntries(Object.entries(readbacks).map(([name, value]) => [`${artifactDirectory}/${name}.json`, serialize(value)]));
for (const [relative, bytes] of Object.entries(artifactBytes)) {
  if (checkOnly) {
    if (readFileSync(path.join(root, relative), "utf8") !== bytes) throw new Error(`BI_DASHBOARD_READBACK_DRIFT:${relative}`);
  } else {
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    writeFileSync(path.join(root, relative), bytes);
  }
}

const evidence = {
  schemaVersion: "chimpmaera.verification/local-synthetic-report/v1",
  evidenceId: "evidence:bi-005-dashboard-readback-v1",
  issue: "#14",
  evidenceClass: "LOCAL_SYNTHETIC",
  commitBinding: "CONTAINING_DCO_SIGNED_COMMIT",
  futureCommitClaimed: false,
  sanitization: { rawSecrets: false, personalData: false, realFinancialRecords: false, productionIdentifiers: false, privateInfrastructure: false, exploitDetails: false, rawSourceIdentifiersInRenderedReadback: false },
  claims: ["DEFAULT_OFF_READ_ONLY_DASHBOARD_SET_V1", "BI_004_FORMULA_AND_VALUE_READBACK_ONLY", "VISIBLE_KPI_CONTEXT", "DETERMINISTIC_FIXED_FILTERS", "TENANT_SAFE_CANONICAL_DRILL_THROUGH", "SANITIZED_LINEAGE", "EXPLICIT_SIX_STATE_RENDERING", "DETERMINISTIC_ACCESSIBILITY_CHECKS", "FAIL_CLOSED_BOUNDARY", "NO_SOURCE_OR_CONTROL_PLANE_MUTATION"],
  nonClaims: ["WRITE_BACK_OR_OPERATIONAL_COMMANDS", "DMS_DASHBOARD", "EXECUTIVE_FORECAST_GUARANTEE", "PRODUCTION_ANALYTICS_SERVICE_OR_SLA", "REAL_TIME_GUARANTEE", "DECISION_AUTOMATION", "FINANCIAL_ASSURANCE", "ACCESSIBILITY_CERTIFICATION", "LIVE_CREDENTIALS_OR_REAL_DATA", "PROVIDER_ONBOARDING", "SERVICE_EXPOSURE", "DEPLOYMENT", "IMAGE_PUBLICATION", "PRODUCTION_ACTIVATION", "INFRASTRUCTURE_MUTATION"],
  semanticBinding: {
    schemaVersion: dashboard.semanticBinding.schemaVersion,
    modelVersion: dashboard.semanticBinding.modelVersion,
    modelDigest: dashboard.semanticBinding.modelDigest,
    acceptedMetricIds: dashboard.kpis.map(({ id }) => id),
    kpiToFormulaToSourceTrace: dashboard.kpis.map(({ id, formula, semanticFormulaPath, semanticValuePath }) => ({ metricId: id, formula, semanticFormulaPath, semanticValuePath, sourceReadback: "BI-004 report rows[].lineage plus rows[].values; raw source IDs are hashed before rendering" })),
  },
  stateReadback: Object.fromEntries(Object.entries(readbacks).map(([name, value]) => [name, { path: `${artifactDirectory}/${name}.json`, state: value.state, code: value.code, sha256: shaBytes(artifactBytes[`${artifactDirectory}/${name}.json`]) }])),
  artifacts: Object.fromEntries([
    ["implementation", "packages/contracts/src/bi-dashboard.ts"],
    ["schema", "schemas/contracts/bi-dashboard-v1.schema.json"],
    ["dashboardContract", "tests/fixtures/bi-dashboard/dashboard-set-v1.json"],
    ["request", "tests/fixtures/bi-dashboard/request-v1.json"],
    ["negativeProbes", "tests/fixtures/bi-dashboard/negative-probes-v1.json"],
    ["test", "tests/bi-dashboard.test.ts"],
    ["guide", "docs/BI-DASHBOARD-READBACK-GUIDE.md"],
    ["pdca", "docs/development/bi-005-dashboard-readback-pdca.md"],
    ["generator", "scripts/render-bi-dashboard-evidence.mjs"],
    ["bi004Implementation", "packages/contracts/src/bi-semantic-reconciliation.ts"],
    ["bi004Model", "tests/fixtures/bi-semantic/model-v1.json"],
    ["bi004Input", "tests/fixtures/bi-semantic/positive-reconciliation-v1.json"],
  ].map(([key, relative]) => [key, { path: relative, sha256: digest(relative) }])),
  verification: { command: "npm run bi-dashboard:test", expected: "10 tests pass and 6 deterministic readbacks match" },
  accessibility: { semanticLandmarks: true, orderedHeadings: true, nativeKeyboardButtons: true, meaningfulLabels: true, deterministicContrastChecks: true, certificationClaimed: false },
  sourceMutationProof: { attemptedOperations: [], dashboardWritesAllowed: false, crmWritesAllowed: false, erpWritesAllowed: false, catalogueWritesAllowed: false, policyWritesAllowed: false, effectDispatchAllowed: false, inputDigestsEqual: true },
  threatBoundary: "Validates checked-in local-synthetic BI-004 model/report bytes and one in-process read request. It does not claim protection from a hostile process replacing memory after validation, provider transport behavior, or production tenant controls.",
  rollback: "Disable dashboard/model version 1.0.0 and return to the last verified read-only BI-004 view; never substitute an unverified metric, widen permissions, or expose hidden lineage.",
};

const evidencePath = "verification/bi-005-dashboard-evidence-v1.json";
const evidenceBytes = serialize(evidence);
if (checkOnly) {
  if (readFileSync(path.join(root, evidencePath), "utf8") !== evidenceBytes) throw new Error("BI_DASHBOARD_EVIDENCE_DRIFT");
  process.stdout.write(`verified ${Object.keys(readbacks).length} deterministic BI-005 readbacks and evidence binding\n`);
} else {
  writeFileSync(path.join(root, evidencePath), evidenceBytes);
  process.stdout.write(`rendered ${Object.keys(readbacks).length} deterministic BI-005 readbacks and evidence binding\n`);
}
