import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";

import {
  biDashboardSetDigestV1,
  contrastRatioV1,
  reconcileCrmErpV1,
  renderBiDashboardV1,
  verifyBiDashboardSetV1,
  type BiDashboardRequestV1,
  type BiDashboardSetV1,
  type BiReconciliationInputV1,
  type BiReconciliationReportV1,
  type BiSemanticModelV1,
} from "../packages/contracts/src/index.js";

const load = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const dashboard = () => load<BiDashboardSetV1>("tests/fixtures/bi-dashboard/dashboard-set-v1.json");
const model = () => load<BiSemanticModelV1>("tests/fixtures/bi-semantic/model-v1.json");
const input = () => load<BiReconciliationInputV1>("tests/fixtures/bi-semantic/positive-reconciliation-v1.json");
const request = () => load<BiDashboardRequestV1>("tests/fixtures/bi-dashboard/request-v1.json");
const report = (source: BiReconciliationInputV1 = input()): BiReconciliationReportV1 => reconcileCrmErpV1({ model: model(), input: source, enabled: true });
const render = (options: Partial<{ dashboard: unknown; model: unknown; report: unknown; request: unknown; enabled: boolean; available: boolean }> = {}) => renderBiDashboardV1({ dashboard: dashboard(), model: model(), report: report(), request: request(), enabled: true, available: true, ...options });

test("BI-005 freezes a default-off V1 dashboard set over exactly the accepted BI-004 formulas", () => {
  const value = dashboard();
  const schema = load<object>("schemas/contracts/bi-dashboard-v1.schema.json");
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.equal(verifyBiDashboardSetV1(value), true);
  assert.equal(value.contractDigest, biDashboardSetDigestV1(value));
  assert.equal(value.defaultEnabled, false);
  assert.deepEqual(value.kpis.map(({ id, unit, formula }) => ({ id, unit, formula })), model().measures);
  assert.deepEqual(value.authorityBoundary, {
    readOnly: true,
    dashboardWritesAllowed: false,
    crmWritesAllowed: false,
    erpWritesAllowed: false,
    catalogueWritesAllowed: false,
    policyWritesAllowed: false,
    effectDispatchAllowed: false,
    hiddenLineageDisclosureAllowed: false,
  });
});

test("BI-005 normal view reads KPI values directly and visibly exposes formula, freshness, trust, units, filters, limitations, and lineage", () => {
  const semantic = report();
  assert.equal(semantic.outcome, "RECONCILED");
  if (semantic.outcome !== "RECONCILED") return;
  const value = render({ report: semantic });
  assert.equal(value.state, "NORMAL");
  assert.equal(value.code, "DASHBOARD_READY");
  assert.deepEqual(value.kpis.map(({ metricId, value: kpiValue }) => [metricId, kpiValue]), [
    ["measure:crm-amount-minor", semantic.kpis.crmAmountMinor],
    ["measure:erp-order-total-minor", semantic.kpis.erpOrderTotalMinor],
    ["measure:reconciliation-delta-minor", semantic.kpis.reconciliationDeltaMinor],
  ]);
  for (const kpi of value.kpis) {
    assert.equal(kpi.unit, "EUR_MINOR");
    assert.ok(kpi.formula.length > 0);
    assert.match(kpi.semanticValuePath, /^\/kpis\//);
    assert.match(kpi.semanticFormulaPath, /^\/measures\/\d\/formula$/);
    assert.deepEqual(kpi.freshness, { status: "FRESH", observedAt: "2026-08-10T08:30:00Z", sourceGeneratedAt: ["2026-08-10T08:00:00Z"] });
    assert.deepEqual(kpi.trust, ["LOCAL_SYNTHETIC"]);
    assert.deepEqual(kpi.activeFilters, ["tenant=tenant:synthetic-zoo", "currency=EUR", "outcome=MATCHED"]);
    assert.equal(kpi.limitations.length, 5);
    assert.ok(kpi.sourceLineage.length > 0);
  }
  assert.match(value.html, /Formula readback/);
  assert.match(value.html, /Active filters/);
  assert.match(value.html, /Source lineage/);
  assert.match(value.html, /Limitations/);
});

test("BI-005 deterministic canonical-ID drill-through returns reconciled facts with sanitized lineage and no role-hidden source fields", () => {
  const overview = render();
  const selected = overview.drillThrough.availableCanonicalIds[0];
  assert.ok(selected);
  const selectedRequest = request() as any;
  selectedRequest.drillThrough.canonicalId = selected;
  const first = render({ request: selectedRequest });
  const second = render({ request: structuredClone(selectedRequest) });
  assert.deepEqual(first, second);
  assert.equal(first.drillThrough.rows.length, 1);
  assert.deepEqual(Object.keys(first.drillThrough.rows[0]!).sort(), ["canonicalId", "currency", "deltaMinor", "erpTotalMinor", "freshness", "crmAmountMinor", "outcome", "sanitizedLineage", "trust"].sort());
  const serialized = JSON.stringify(first);
  for (const hidden of ["opportunity:habitat-001", "order:synthetic-001", "erp-record:order-001", "sourceDigest", "dataset:zoo-bi-m1", "export:synthetic"]) assert.doesNotMatch(serialized, new RegExp(hidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const lineage of first.drillThrough.rows[0]!.sanitizedLineage) {
    assert.match(lineage.datasetRef, /^ref:[a-f0-9]{12}$/);
    assert.match(lineage.exportRef, /^ref:[a-f0-9]{12}$/);
    assert.match(lineage.digestRef, /^sha256:[a-f0-9]{12}$/);
    assert.match(lineage.readbackPath, /^\/rows\/\d+\/lineage\/(crm|erp)$/);
  }
});

test("BI-005 empty view preserves accepted zero KPI readback and explicitly marks unavailable freshness, trust, and lineage", () => {
  const emptyInput = input() as any;
  emptyInput.crm.facts = [];
  emptyInput.erp.facts = [];
  emptyInput.mappings = [];
  const value = render({ report: report(emptyInput) });
  assert.equal(value.state, "EMPTY");
  assert.equal(value.code, "NO_MATCHED_FACTS");
  assert.deepEqual(value.kpis.map((kpi) => kpi.value), [0, 0, 0]);
  assert.ok(value.kpis.every((kpi) => kpi.freshness.status === "UNAVAILABLE_NO_MATCHED_ROWS" && kpi.trust.length === 0 && kpi.sourceLineage.length === 0));
  assert.deepEqual(value.drillThrough, { selectedCanonicalId: null, availableCanonicalIds: [], rows: [] });
});

test("BI-005 stale sources, conflicting filters, denied access, and unavailable source render explicit non-KPI states", () => {
  const staleInput = input() as any;
  staleInput.observedAt = "2026-08-10T09:00:01Z";
  const stale = render({ report: report(staleInput) });
  const conflictRequest = request() as any;
  conflictRequest.filters.outcomes = ["MATCHED", "CONFLICTING"];
  const conflict = render({ request: conflictRequest });
  const deniedRequest = request() as any;
  deniedRequest.principalId = "principal:other";
  const denied = render({ request: deniedRequest });
  const unavailable = render({ available: false });
  assert.deepEqual([stale.state, stale.code, stale.kpis.length], ["STALE", "SOURCE_STALE", 0]);
  assert.deepEqual([conflict.state, conflict.code, conflict.kpis.length], ["CONFLICT", "CONFLICTING_FILTERS", 0]);
  assert.deepEqual([denied.state, denied.code, denied.kpis.length], ["DENIED", "ACCESS_DENIED", 0]);
  assert.deepEqual([unavailable.state, unavailable.code, unavailable.kpis.length], ["ERROR", "SOURCE_UNAVAILABLE", 0]);
  for (const value of [stale, conflict, denied, unavailable]) assert.match(value.html, /role="status"/);
});

test("BI-005 accessibility contract has semantic landmarks, native keyboard controls, meaningful labels, and deterministic contrast checks", () => {
  const overview = render();
  const selectedRequest = request() as any;
  selectedRequest.drillThrough.canonicalId = overview.drillThrough.availableCanonicalIds[0];
  const value = render({ request: selectedRequest });
  for (const element of ["<main", "<h1", "<section", "<h2", "<article", "<dl>", "<table>", "<caption>", "<th scope=\"col\""]) assert.match(value.html, new RegExp(element.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(value.html, /<button type="button"/);
  assert.match(value.html, /aria-label="Open reconciled fact canonical:/);
  assert.deepEqual(value.accessibility.headingOrder, [1, 2, 2, 3, 3, 2, 3, 3, 2, 3, 3, 2]);
  assert.equal(value.accessibility.keyboardOrder.length, 3);
  assert.ok(value.accessibility.contrastChecks.every((check) => check.pass && check.ratio >= check.minimum));
  assert.equal(contrastRatioV1("#1f2937", "#ffffff"), 14.68);
  assert.equal(value.accessibility.certificationClaimed, false);
});

interface NegativeProbe {
  readonly caseId: string;
  readonly target: "request" | "report" | "model" | "options";
  readonly path: string;
  readonly value: unknown;
  readonly expectedState: string;
  readonly expectedCode: string;
}

function mutatePath(target: any, path: string, value: unknown): void {
  const segments = path.split("/").slice(1);
  const leaf = segments.pop();
  assert.ok(leaf);
  let cursor = target;
  for (const segment of segments) cursor = cursor[segment];
  if (value === "__DELETE__") delete cursor[leaf];
  else cursor[leaf] = value;
}

test("BI-005 named fail-closed probe matrix denies every unaccepted boundary without fallback", () => {
  const probes = load<NegativeProbe[]>("tests/fixtures/bi-dashboard/negative-probes-v1.json");
  assert.equal(probes.length, 13);
  for (const probe of probes) {
    const options: any = { dashboard: dashboard(), model: model(), report: report(), request: request(), enabled: true, available: true };
    mutatePath(probe.target === "options" ? options : options[probe.target], probe.path, probe.value);
    const value = renderBiDashboardV1(options);
    assert.deepEqual([value.state, value.code, value.kpis.length, value.drillThrough.rows.length], [probe.expectedState, probe.expectedCode, 0, 0], probe.caseId);
  }
});

test("BI-005 tenant-safe drill-through rejects canonical IDs outside the current reconciled report", () => {
  const foreign = request() as any;
  foreign.drillThrough.canonicalId = `canonical:${"f".repeat(24)}`;
  const value = render({ request: foreign });
  assert.deepEqual([value.state, value.code], ["DENIED", "ACCESS_DENIED"]);
  assert.equal(value.drillThrough.rows.length, 0);
});

test("BI-005 never mutates dashboard, model, report, request, CRM, ERP, catalogue, policy, or effects", () => {
  const values = { dashboard: dashboard(), model: model(), report: report(), request: request(), enabled: true, available: true };
  const before = structuredClone(values);
  const value = renderBiDashboardV1(values);
  assert.deepEqual(values, before);
  assert.deepEqual(value.mutationProof, {
    attemptedOperations: [],
    dashboardWritesAllowed: false,
    crmWritesAllowed: false,
    erpWritesAllowed: false,
    catalogueWritesAllowed: false,
    policyWritesAllowed: false,
    effectDispatchAllowed: false,
    inputDigestBefore: value.mutationProof.inputDigestBefore,
    inputDigestAfter: value.mutationProof.inputDigestBefore,
  });
});

test("BI-005 output and readback digest are stable across repeated renders and request metric order", () => {
  const first = render();
  const reordered = request() as any;
  reordered.metricIds.reverse();
  const second = render({ request: reordered });
  assert.deepEqual(first.kpis, second.kpis);
  assert.equal(first.readbackDigest, render().readbackDigest);
});
