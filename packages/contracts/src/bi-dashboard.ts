import { createHash } from "node:crypto";

import { canonicalJson } from "./canonical-json.js";
import {
  BI_RECONCILIATION_REPORT_SCHEMA_V1,
  BI_SEMANTIC_MODEL_SCHEMA_V1,
  verifyBiSemanticModelV1,
  type BiReconciliationReportV1,
  type BiSemanticModelV1,
} from "./bi-semantic-reconciliation.js";

export const BI_DASHBOARD_SCHEMA_V1 = "chimpmaera.bi/dashboard-set/v1" as const;
export const BI_DASHBOARD_REQUEST_SCHEMA_V1 = "chimpmaera.bi/dashboard-request/v1" as const;
export const BI_DASHBOARD_READBACK_SCHEMA_V1 = "chimpmaera.bi/dashboard-readback/v1" as const;
export const BI_DASHBOARD_VERSION_V1 = "1.0.0" as const;

export type BiDashboardMetricIdV1 =
  | "measure:crm-amount-minor"
  | "measure:erp-order-total-minor"
  | "measure:reconciliation-delta-minor";

export type BiDashboardStateV1 = "NORMAL" | "EMPTY" | "STALE" | "CONFLICT" | "DENIED" | "ERROR";

export type BiDashboardCodeV1 =
  | "DASHBOARD_READY"
  | "NO_MATCHED_FACTS"
  | "DASHBOARD_DISABLED"
  | "DASHBOARD_CONTRACT_INVALID"
  | "MODEL_BINDING_MISMATCH"
  | "STALE_MODEL"
  | "SOURCE_STALE"
  | "UNKNOWN_METRIC"
  | "TENANT_MISMATCH"
  | "CONFLICTING_FILTERS"
  | "ACCESS_DENIED"
  | "ROLE_HIDDEN_SOURCE_ID"
  | "MISSING_LINEAGE"
  | "MISSING_DATA"
  | "DIVIDE_BY_ZERO"
  | "INACCESSIBLE_INTERACTION"
  | "SOURCE_UNAVAILABLE"
  | "SEMANTIC_MODEL_DENIED"
  | "REPORT_INTEGRITY_INVALID"
  | "REQUEST_MALFORMED";

export interface BiDashboardSetV1 {
  readonly schemaVersion: typeof BI_DASHBOARD_SCHEMA_V1;
  readonly contractVersion: typeof BI_DASHBOARD_VERSION_V1;
  readonly dashboardSetId: "dashboard-set:crm-erp-reconciliation-v1";
  readonly defaultEnabled: false;
  readonly evidenceClass: "LOCAL_SYNTHETIC";
  readonly semanticBinding: {
    readonly schemaVersion: typeof BI_SEMANTIC_MODEL_SCHEMA_V1;
    readonly modelVersion: "1.0.0";
    readonly modelId: "semantic-model:crm-erp-reconciliation-v1";
    readonly modelDigest: "11c9a4c89b8fcee1a528fb6dbf339aa0460d4d8c02412d6330200e03c154913f";
  };
  readonly pages: readonly [
    { readonly id: "page:kpi-overview"; readonly label: "CRM and ERP reconciliation overview"; readonly landmark: "main" },
    { readonly id: "page:reconciled-fact-detail"; readonly label: "Reconciled fact detail"; readonly landmark: "section" },
  ];
  readonly kpis: readonly [
    { readonly id: "measure:crm-amount-minor"; readonly label: "Matched CRM amount"; readonly unit: "EUR_MINOR"; readonly formula: "SUM(MATCHED.crm.amount_major * 100)"; readonly semanticValuePath: "/kpis/crmAmountMinor"; readonly semanticFormulaPath: "/measures/0/formula" },
    { readonly id: "measure:erp-order-total-minor"; readonly label: "Matched ERP order total"; readonly unit: "EUR_MINOR"; readonly formula: "SUM(MATCHED.erp.total_minor)"; readonly semanticValuePath: "/kpis/erpOrderTotalMinor"; readonly semanticFormulaPath: "/measures/1/formula" },
    { readonly id: "measure:reconciliation-delta-minor"; readonly label: "Reconciliation delta"; readonly unit: "EUR_MINOR"; readonly formula: "measure:crm-amount-minor - measure:erp-order-total-minor"; readonly semanticValuePath: "/kpis/reconciliationDeltaMinor"; readonly semanticFormulaPath: "/measures/2/formula" },
  ];
  readonly filters: readonly [
    { readonly id: "filter:tenant"; readonly dimensionId: "dimension:tenant"; readonly allowedValues: readonly ["tenant:synthetic-zoo"]; readonly required: true },
    { readonly id: "filter:currency"; readonly dimensionId: "dimension:currency"; readonly allowedValues: readonly ["EUR"]; readonly required: true },
    { readonly id: "filter:outcome"; readonly dimensionId: "dimension:outcome"; readonly allowedValues: readonly ["MATCHED"]; readonly required: true },
  ];
  readonly drillThrough: {
    readonly selector: "CANONICAL_ID_ONLY";
    readonly visibleFields: readonly ["canonicalId", "outcome", "crmAmountMinor", "erpTotalMinor", "deltaMinor", "currency", "freshness", "trust", "sanitizedLineage"];
    readonly roleHiddenFields: readonly ["crmOpportunityId", "erpOrderId", "sourceIds", "sourceRecordId", "sourceDigest", "batchId", "datasetId", "exportId"];
    readonly rawSourceIdsVisible: false;
    readonly lineageSanitization: "SHA256_PREFIX_12";
  };
  readonly freshness: { readonly maxModelAgeSeconds: 3600; readonly staleBehavior: "BLOCK" };
  readonly accessibility: {
    readonly interactionMode: "KEYBOARD_AND_POINTER";
    readonly semanticStructure: readonly ["main", "h1", "section", "h2", "article", "dl", "table", "caption", "th"];
    readonly meaningfulLabelsRequired: true;
    readonly focusVisibleRequired: true;
    readonly contrast: {
      readonly background: "#ffffff";
      readonly text: "#1f2937";
      readonly secondaryText: "#374151";
      readonly link: "#0b4f6c";
      readonly focus: "#005fcc";
      readonly normalTextMinimum: 4.5;
      readonly nonTextMinimum: 3;
    };
  };
  readonly limitations: readonly [
    "Local synthetic readback only; no production analytics service or SLA.",
    "Only BI-004 MATCHED EUR facts contribute; unresolved and stale facts are excluded.",
    "Filters are intentionally fixed to one synthetic tenant, EUR, and MATCHED outcome.",
    "Accessibility checks are deterministic contract tests, not certification.",
    "No write-back, operational command, forecast, decision automation, or financial assurance.",
  ];
  readonly authorityBoundary: {
    readonly readOnly: true;
    readonly dashboardWritesAllowed: false;
    readonly crmWritesAllowed: false;
    readonly erpWritesAllowed: false;
    readonly catalogueWritesAllowed: false;
    readonly policyWritesAllowed: false;
    readonly effectDispatchAllowed: false;
    readonly hiddenLineageDisclosureAllowed: false;
  };
  readonly contractDigest: string;
}

export interface BiDashboardRequestV1 {
  readonly schemaVersion: typeof BI_DASHBOARD_REQUEST_SCHEMA_V1;
  readonly tenantId: string;
  readonly principalId: "principal:bi-m1-reader";
  readonly role: "BI_M1_READER";
  readonly observedAt: string;
  readonly modelValidatedAt: string;
  readonly metricIds: readonly BiDashboardMetricIdV1[];
  readonly filters: {
    readonly tenantIds: readonly string[];
    readonly currencies: readonly string[];
    readonly outcomes: readonly string[];
  };
  readonly drillThrough: { readonly canonicalId: string | null; readonly sourceId: string | null };
  readonly interactionMode: "KEYBOARD_AND_POINTER";
}

export interface BiDashboardLineageReadbackV1 {
  readonly system: "SYNTHETIC_CRM" | "SYNTHETIC_ERP";
  readonly readbackPath: string;
  readonly datasetRef: string;
  readonly exportRef: string;
  readonly digestRef: string;
  readonly batchRef: string | null;
  readonly sourceRecordRef: string | null;
}

export interface BiDashboardKpiReadbackV1 {
  readonly metricId: BiDashboardMetricIdV1;
  readonly label: string;
  readonly value: number;
  readonly formattedValue: string;
  readonly unit: "EUR_MINOR";
  readonly formula: string;
  readonly semanticValuePath: string;
  readonly semanticFormulaPath: string;
  readonly freshness: { readonly status: "FRESH" | "UNAVAILABLE_NO_MATCHED_ROWS"; readonly observedAt: string | null; readonly sourceGeneratedAt: readonly string[] };
  readonly trust: readonly ["LOCAL_SYNTHETIC"] | readonly [];
  readonly activeFilters: readonly ["tenant=tenant:synthetic-zoo", "currency=EUR", "outcome=MATCHED"];
  readonly limitations: BiDashboardSetV1["limitations"];
  readonly sourceLineage: readonly BiDashboardLineageReadbackV1[];
}

export interface BiDashboardDrillRowV1 {
  readonly canonicalId: string;
  readonly outcome: "MATCHED";
  readonly crmAmountMinor: number;
  readonly erpTotalMinor: number;
  readonly deltaMinor: number;
  readonly currency: "EUR";
  readonly freshness: { readonly observedAt: string; readonly crmGeneratedAt: string; readonly erpGeneratedAt: string };
  readonly trust: readonly ["LOCAL_SYNTHETIC", "LOCAL_SYNTHETIC"];
  readonly sanitizedLineage: readonly [BiDashboardLineageReadbackV1, BiDashboardLineageReadbackV1];
}

export interface BiDashboardReadbackV1 {
  readonly schemaVersion: typeof BI_DASHBOARD_READBACK_SCHEMA_V1;
  readonly dashboardVersion: typeof BI_DASHBOARD_VERSION_V1;
  readonly state: BiDashboardStateV1;
  readonly code: BiDashboardCodeV1;
  readonly heading: string;
  readonly statusMessage: string;
  readonly activeFilters: readonly string[];
  readonly kpis: readonly BiDashboardKpiReadbackV1[];
  readonly drillThrough: { readonly selectedCanonicalId: string | null; readonly availableCanonicalIds: readonly string[]; readonly rows: readonly BiDashboardDrillRowV1[] };
  readonly accessibility: {
    readonly landmarks: readonly string[];
    readonly headingOrder: readonly number[];
    readonly meaningfulLabels: readonly string[];
    readonly keyboardOrder: readonly string[];
    readonly contrastChecks: readonly { readonly token: "text" | "secondaryText" | "link" | "focus"; readonly ratio: number; readonly minimum: number; readonly pass: true }[];
    readonly certificationClaimed: false;
  };
  readonly mutationProof: {
    readonly attemptedOperations: readonly [];
    readonly dashboardWritesAllowed: false;
    readonly crmWritesAllowed: false;
    readonly erpWritesAllowed: false;
    readonly catalogueWritesAllowed: false;
    readonly policyWritesAllowed: false;
    readonly effectDispatchAllowed: false;
    readonly inputDigestBefore: string;
    readonly inputDigestAfter: string;
  };
  readonly html: string;
  readonly readbackDigest: string;
}

const DASHBOARD_CONTENT = {
  schemaVersion: BI_DASHBOARD_SCHEMA_V1,
  contractVersion: BI_DASHBOARD_VERSION_V1,
  dashboardSetId: "dashboard-set:crm-erp-reconciliation-v1",
  defaultEnabled: false,
  evidenceClass: "LOCAL_SYNTHETIC",
  semanticBinding: {
    schemaVersion: BI_SEMANTIC_MODEL_SCHEMA_V1,
    modelVersion: "1.0.0",
    modelId: "semantic-model:crm-erp-reconciliation-v1",
    modelDigest: "11c9a4c89b8fcee1a528fb6dbf339aa0460d4d8c02412d6330200e03c154913f",
  },
  pages: [
    { id: "page:kpi-overview", label: "CRM and ERP reconciliation overview", landmark: "main" },
    { id: "page:reconciled-fact-detail", label: "Reconciled fact detail", landmark: "section" },
  ],
  kpis: [
    { id: "measure:crm-amount-minor", label: "Matched CRM amount", unit: "EUR_MINOR", formula: "SUM(MATCHED.crm.amount_major * 100)", semanticValuePath: "/kpis/crmAmountMinor", semanticFormulaPath: "/measures/0/formula" },
    { id: "measure:erp-order-total-minor", label: "Matched ERP order total", unit: "EUR_MINOR", formula: "SUM(MATCHED.erp.total_minor)", semanticValuePath: "/kpis/erpOrderTotalMinor", semanticFormulaPath: "/measures/1/formula" },
    { id: "measure:reconciliation-delta-minor", label: "Reconciliation delta", unit: "EUR_MINOR", formula: "measure:crm-amount-minor - measure:erp-order-total-minor", semanticValuePath: "/kpis/reconciliationDeltaMinor", semanticFormulaPath: "/measures/2/formula" },
  ],
  filters: [
    { id: "filter:tenant", dimensionId: "dimension:tenant", allowedValues: ["tenant:synthetic-zoo"], required: true },
    { id: "filter:currency", dimensionId: "dimension:currency", allowedValues: ["EUR"], required: true },
    { id: "filter:outcome", dimensionId: "dimension:outcome", allowedValues: ["MATCHED"], required: true },
  ],
  drillThrough: {
    selector: "CANONICAL_ID_ONLY",
    visibleFields: ["canonicalId", "outcome", "crmAmountMinor", "erpTotalMinor", "deltaMinor", "currency", "freshness", "trust", "sanitizedLineage"],
    roleHiddenFields: ["crmOpportunityId", "erpOrderId", "sourceIds", "sourceRecordId", "sourceDigest", "batchId", "datasetId", "exportId"],
    rawSourceIdsVisible: false,
    lineageSanitization: "SHA256_PREFIX_12",
  },
  freshness: { maxModelAgeSeconds: 3600, staleBehavior: "BLOCK" },
  accessibility: {
    interactionMode: "KEYBOARD_AND_POINTER",
    semanticStructure: ["main", "h1", "section", "h2", "article", "dl", "table", "caption", "th"],
    meaningfulLabelsRequired: true,
    focusVisibleRequired: true,
    contrast: { background: "#ffffff", text: "#1f2937", secondaryText: "#374151", link: "#0b4f6c", focus: "#005fcc", normalTextMinimum: 4.5, nonTextMinimum: 3 },
  },
  limitations: [
    "Local synthetic readback only; no production analytics service or SLA.",
    "Only BI-004 MATCHED EUR facts contribute; unresolved and stale facts are excluded.",
    "Filters are intentionally fixed to one synthetic tenant, EUR, and MATCHED outcome.",
    "Accessibility checks are deterministic contract tests, not certification.",
    "No write-back, operational command, forecast, decision automation, or financial assurance.",
  ],
  authorityBoundary: {
    readOnly: true,
    dashboardWritesAllowed: false,
    crmWritesAllowed: false,
    erpWritesAllowed: false,
    catalogueWritesAllowed: false,
    policyWritesAllowed: false,
    effectDispatchAllowed: false,
    hiddenLineageDisclosureAllowed: false,
  },
} as const;

const sha = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");
const object = (value: unknown): value is Record<string, any> => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value: unknown, expected: readonly string[]): value is Record<string, any> => object(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort());
const timestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) && !Number.isNaN(Date.parse(value));
const canonicalId = (value: unknown): value is string => typeof value === "string" && /^canonical:[a-f0-9]{24}$/.test(value);
const escapeHtml = (value: unknown): string => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export function biDashboardSetDigestV1(value: Omit<BiDashboardSetV1, "contractDigest"> | BiDashboardSetV1): string {
  return sha(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "contractDigest")));
}

export function verifyBiDashboardSetV1(value: unknown): value is BiDashboardSetV1 {
  return exactKeys(value, [...Object.keys(DASHBOARD_CONTENT), "contractDigest"])
    && typeof value.contractDigest === "string"
    && /^[a-f0-9]{64}$/.test(value.contractDigest)
    && canonicalJson(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "contractDigest"))) === canonicalJson(DASHBOARD_CONTENT)
    && value.contractDigest === sha(DASHBOARD_CONTENT);
}

function srgbChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return 0.2126 * srgbChannel(red) + 0.7152 * srgbChannel(green) + 0.0722 * srgbChannel(blue);
}

export function contrastRatioV1(foreground: string, background: string): number {
  if (!/^#[a-f0-9]{6}$/i.test(foreground) || !/^#[a-f0-9]{6}$/i.test(background)) throw new TypeError("INVALID_CONTRAST_COLOR");
  const first = luminance(foreground);
  const second = luminance(background);
  const ratio = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  return Number(ratio.toFixed(2));
}

function sanitizeRef(value: string): string {
  return `ref:${sha(value).slice(0, 12)}`;
}

function sanitizedLineage(row: ReconciledRow, index: number): readonly [BiDashboardLineageReadbackV1, BiDashboardLineageReadbackV1] {
  return [
    {
      system: "SYNTHETIC_CRM",
      readbackPath: `/rows/${index}/lineage/crm`,
      datasetRef: sanitizeRef(row.lineage.crm.datasetId),
      exportRef: sanitizeRef(row.lineage.crm.exportId),
      digestRef: `sha256:${row.lineage.crm.digest.slice(0, 12)}`,
      batchRef: row.lineage.crm.batchId === null ? null : sanitizeRef(row.lineage.crm.batchId),
      sourceRecordRef: null,
    },
    {
      system: "SYNTHETIC_ERP",
      readbackPath: `/rows/${index}/lineage/erp`,
      datasetRef: sanitizeRef(row.lineage.erp.datasetId),
      exportRef: sanitizeRef(row.lineage.erp.exportId),
      digestRef: `sha256:${row.lineage.erp.digest.slice(0, 12)}`,
      batchRef: row.lineage.erp.batchId === null ? null : sanitizeRef(row.lineage.erp.batchId),
      sourceRecordRef: row.lineage.erp.sourceRecordId === null ? null : sanitizeRef(row.lineage.erp.sourceRecordId),
    },
  ];
}

type ReconciledReport = Extract<BiReconciliationReportV1, { outcome: "RECONCILED" }>;
type ReconciledRow = ReconciledReport["rows"][number];

const METRIC_VALUE_KEYS: Readonly<Record<BiDashboardMetricIdV1, keyof ReconciledReport["kpis"]>> = {
  "measure:crm-amount-minor": "crmAmountMinor",
  "measure:erp-order-total-minor": "erpOrderTotalMinor",
  "measure:reconciliation-delta-minor": "reconciliationDeltaMinor",
};

function reportBodyDigest(report: ReconciledReport): string {
  return sha(Object.fromEntries(Object.entries(report).filter(([key]) => key !== "reportDigest")));
}

function validRequestShape(value: unknown): value is BiDashboardRequestV1 {
  return exactKeys(value, ["schemaVersion", "tenantId", "principalId", "role", "observedAt", "modelValidatedAt", "metricIds", "filters", "drillThrough", "interactionMode"])
    && value.schemaVersion === BI_DASHBOARD_REQUEST_SCHEMA_V1
    && typeof value.tenantId === "string"
    && timestamp(value.observedAt)
    && timestamp(value.modelValidatedAt)
    && Array.isArray(value.metricIds)
    && exactKeys(value.filters, ["tenantIds", "currencies", "outcomes"])
    && Array.isArray(value.filters.tenantIds)
    && Array.isArray(value.filters.currencies)
    && Array.isArray(value.filters.outcomes)
    && exactKeys(value.drillThrough, ["canonicalId", "sourceId"])
    && (value.drillThrough.canonicalId === null || typeof value.drillThrough.canonicalId === "string")
    && (value.drillThrough.sourceId === null || typeof value.drillThrough.sourceId === "string");
}

function reportStructureCode(report: unknown): BiDashboardCodeV1 | null {
  if (!object(report) || report.outcome !== "RECONCILED") return "MISSING_DATA";
  if (!Array.isArray(report.rows) || !object(report.kpis)) return "MISSING_DATA";
  if (!Array.isArray(report.kpis.formulaIds) || !Array.isArray(report.kpis.sourceReadbackIds)) return "MISSING_DATA";
  for (const key of Object.values(METRIC_VALUE_KEYS)) if (!Number.isSafeInteger(report.kpis[key])) return "MISSING_DATA";
  for (const row of report.rows) {
    if (!object(row) || !object(row.lineage) || !object(row.lineage.crm) || !object(row.lineage.erp)) return "MISSING_LINEAGE";
    for (const side of [row.lineage.crm, row.lineage.erp]) {
      if (typeof side.exportId !== "string" || typeof side.datasetId !== "string" || typeof side.digest !== "string" || !/^[a-f0-9]{64}$/.test(side.digest)) return "MISSING_LINEAGE";
    }
    if (!object(row.values) || !object(row.freshness) || !Array.isArray(row.trust)) return "MISSING_DATA";
  }
  return null;
}

function blockedHtml(heading: string, statusMessage: string, state: BiDashboardStateV1): string {
  return `<main aria-labelledby="dashboard-heading"><h1 id="dashboard-heading">${escapeHtml(heading)}</h1><section aria-labelledby="dashboard-status-heading"><h2 id="dashboard-status-heading">Dashboard status</h2><p role="status" aria-live="polite" data-state="${escapeHtml(state)}">${escapeHtml(statusMessage)}</p></section></main>`;
}

function readyHtml(kpis: readonly BiDashboardKpiReadbackV1[], availableIds: readonly string[], drillRows: readonly BiDashboardDrillRowV1[], state: "NORMAL" | "EMPTY", statusMessage: string): string {
  const cards = kpis.map((kpi) => {
    const lineage = kpi.sourceLineage.length === 0
      ? "<li>No matched source lineage is available.</li>"
      : kpi.sourceLineage.map((entry) => `<li>${escapeHtml(entry.system)} at <code>${escapeHtml(entry.readbackPath)}</code>; dataset ${escapeHtml(entry.datasetRef)}; export ${escapeHtml(entry.exportRef)}; digest ${escapeHtml(entry.digestRef)}</li>`).join("");
    const limitations = kpi.limitations.map((limitation) => `<li>${escapeHtml(limitation)}</li>`).join("");
    return `<article aria-labelledby="${escapeHtml(kpi.metricId)}-heading"><h2 id="${escapeHtml(kpi.metricId)}-heading">${escapeHtml(kpi.label)}</h2><dl><dt>Value</dt><dd>${escapeHtml(kpi.formattedValue)}</dd><dt>Unit</dt><dd>${escapeHtml(kpi.unit)}</dd><dt>Formula</dt><dd><code>${escapeHtml(kpi.formula)}</code></dd><dt>Formula readback</dt><dd><code>${escapeHtml(kpi.semanticFormulaPath)}</code></dd><dt>Value readback</dt><dd><code>${escapeHtml(kpi.semanticValuePath)}</code></dd><dt>Freshness</dt><dd>${escapeHtml(kpi.freshness.status)}; observed ${escapeHtml(kpi.freshness.observedAt ?? "unavailable")}; sources ${escapeHtml(kpi.freshness.sourceGeneratedAt.join(", ") || "unavailable")}</dd><dt>Trust</dt><dd>${escapeHtml(kpi.trust.join(", ") || "unavailable")}</dd><dt>Active filters</dt><dd>${escapeHtml(kpi.activeFilters.join("; "))}</dd></dl><h3>Source lineage</h3><ul>${lineage}</ul><h3>Limitations</h3><ul>${limitations}</ul></article>`;
  }).join("");
  const buttons = availableIds.map((id) => `<button type="button" data-canonical-id="${escapeHtml(id)}" aria-label="Open reconciled fact ${escapeHtml(id)}">Open ${escapeHtml(id)}</button>`).join("");
  const rows = drillRows.map((row) => `<tr><th scope="row">${escapeHtml(row.canonicalId)}</th><td>${escapeHtml(row.outcome)}</td><td>${row.crmAmountMinor}</td><td>${row.erpTotalMinor}</td><td>${row.deltaMinor}</td><td>${escapeHtml(row.currency)}</td><td>${escapeHtml(row.freshness.observedAt)}</td><td>${escapeHtml(row.trust.join(", "))}</td><td>${escapeHtml(row.sanitizedLineage.map((item) => `${item.system}:${item.digestRef}`).join("; "))}</td></tr>`).join("");
  const table = drillRows.length === 0 ? "<p>No reconciled fact selected.</p>" : `<table><caption>Selected reconciled synthetic CRM and ERP fact</caption><thead><tr><th scope="col">Canonical ID</th><th scope="col">Outcome</th><th scope="col">CRM amount minor</th><th scope="col">ERP total minor</th><th scope="col">Delta minor</th><th scope="col">Currency</th><th scope="col">Observed at</th><th scope="col">Trust</th><th scope="col">Sanitized lineage</th></tr></thead><tbody>${rows}</tbody></table>`;
  return `<main aria-labelledby="dashboard-heading"><h1 id="dashboard-heading">CRM and ERP reconciliation dashboard</h1><p role="status" aria-live="polite" data-state="${state}">${escapeHtml(statusMessage)}</p><section aria-labelledby="kpi-overview-heading"><h2 id="kpi-overview-heading">KPI overview</h2>${cards}</section><section aria-labelledby="drill-heading"><h2 id="drill-heading">Reconciled fact detail</h2><nav aria-label="Reconciled fact drill-through">${buttons}</nav>${table}</section></main>`;
}

function contrastChecks(dashboard: BiDashboardSetV1): BiDashboardReadbackV1["accessibility"]["contrastChecks"] {
  const theme = dashboard.accessibility.contrast;
  const checks = [
    { token: "text" as const, ratio: contrastRatioV1(theme.text, theme.background), minimum: theme.normalTextMinimum },
    { token: "secondaryText" as const, ratio: contrastRatioV1(theme.secondaryText, theme.background), minimum: theme.normalTextMinimum },
    { token: "link" as const, ratio: contrastRatioV1(theme.link, theme.background), minimum: theme.normalTextMinimum },
    { token: "focus" as const, ratio: contrastRatioV1(theme.focus, theme.background), minimum: theme.nonTextMinimum },
  ];
  if (checks.some((check) => check.ratio < check.minimum)) throw new Error("CONTRAST_CHECK_FAILED");
  return checks.map((check) => ({ ...check, pass: true as const }));
}

function makeResult({ dashboard, request, state, code, heading, statusMessage, kpis = [], availableCanonicalIds = [], drillRows = [], inputDigestBefore, inputValue }: {
  dashboard: BiDashboardSetV1;
  request: BiDashboardRequestV1 | null;
  state: BiDashboardStateV1;
  code: BiDashboardCodeV1;
  heading: string;
  statusMessage: string;
  kpis?: readonly BiDashboardKpiReadbackV1[];
  availableCanonicalIds?: readonly string[];
  drillRows?: readonly BiDashboardDrillRowV1[];
  inputDigestBefore: string;
  inputValue: unknown;
}): BiDashboardReadbackV1 {
  const ready = state === "NORMAL" || state === "EMPTY";
  const selectedCanonicalId = ready ? request?.drillThrough.canonicalId ?? null : null;
  const body = {
    schemaVersion: BI_DASHBOARD_READBACK_SCHEMA_V1,
    dashboardVersion: BI_DASHBOARD_VERSION_V1,
    state,
    code,
    heading,
    statusMessage,
    activeFilters: ready ? ["tenant=tenant:synthetic-zoo", "currency=EUR", "outcome=MATCHED"] : [],
    kpis,
    drillThrough: { selectedCanonicalId, availableCanonicalIds, rows: drillRows },
    accessibility: {
      landmarks: ready ? ["main", "section:kpi-overview", "section:reconciled-fact-detail"] : ["main", "section:dashboard-status"],
      headingOrder: ready ? [1, 2, ...kpis.flatMap(() => [2, 3, 3]), 2] : [1, 2],
      meaningfulLabels: ready ? ["CRM and ERP reconciliation dashboard", "Reconciled fact drill-through", ...availableCanonicalIds.map((id) => `Open reconciled fact ${id}`)] : [heading, "Dashboard status"],
      keyboardOrder: ready ? availableCanonicalIds.map((id) => `drill:${id}`) : [],
      contrastChecks: contrastChecks(dashboard),
      certificationClaimed: false as const,
    },
    mutationProof: {
      attemptedOperations: [] as const,
      dashboardWritesAllowed: false as const,
      crmWritesAllowed: false as const,
      erpWritesAllowed: false as const,
      catalogueWritesAllowed: false as const,
      policyWritesAllowed: false as const,
      effectDispatchAllowed: false as const,
      inputDigestBefore,
      inputDigestAfter: sha(inputValue),
    },
    html: ready ? readyHtml(kpis, availableCanonicalIds, drillRows, state, statusMessage) : blockedHtml(heading, statusMessage, state),
  };
  return { ...body, readbackDigest: sha(body) };
}

export function renderBiDashboardV1({ dashboard, model, report, request, enabled, available = true }: {
  dashboard: unknown;
  model: unknown;
  report: unknown;
  request: unknown;
  enabled: boolean;
  available?: boolean;
}): BiDashboardReadbackV1 {
  const inputValue = { dashboard, model, report, request, enabled, available };
  const inputDigestBefore = sha(inputValue);
  const fallbackDashboard = { ...DASHBOARD_CONTENT, contractDigest: sha(DASHBOARD_CONTENT) } as unknown as BiDashboardSetV1;
  const deny = (state: BiDashboardStateV1, code: BiDashboardCodeV1, statusMessage: string, verifiedDashboard: BiDashboardSetV1 = fallbackDashboard, verifiedRequest: BiDashboardRequestV1 | null = null) => makeResult({ dashboard: verifiedDashboard, request: verifiedRequest, state, code, heading: "CRM and ERP reconciliation dashboard", statusMessage, inputDigestBefore, inputValue });

  if (!enabled) return deny("DENIED", "DASHBOARD_DISABLED", "Dashboard version 1.0.0 is disabled.");
  if (!available) return deny("ERROR", "SOURCE_UNAVAILABLE", "Dashboard source is unavailable; no KPI is displayed.");
  if (!verifyBiDashboardSetV1(dashboard)) return deny("DENIED", "DASHBOARD_CONTRACT_INVALID", "Dashboard contract validation failed.");
  const typedDashboard = dashboard;

  if (object(request) && object(request.calculation) && request.calculation.operator === "DIVIDE" && request.calculation.denominator === 0) {
    return deny("ERROR", "DIVIDE_BY_ZERO", "Unaccepted ratio calculation denied; BI-004 values remain unchanged.", typedDashboard);
  }
  if (!validRequestShape(request)) return deny("DENIED", "REQUEST_MALFORMED", "Dashboard request validation failed.", typedDashboard);
  const typedRequest = request;
  if (typedRequest.interactionMode !== typedDashboard.accessibility.interactionMode) return deny("DENIED", "INACCESSIBLE_INTERACTION", "Pointer-only or unlabeled interaction is not accessible and was denied.", typedDashboard, typedRequest);
  if (typedRequest.drillThrough.sourceId !== null) return deny("DENIED", "ROLE_HIDDEN_SOURCE_ID", "Raw source identifiers are role-hidden; use a canonical ID.", typedDashboard, typedRequest);
  if (typedRequest.principalId !== "principal:bi-m1-reader" || typedRequest.role !== "BI_M1_READER") return deny("DENIED", "ACCESS_DENIED", "The principal or role is not authorized for this read-only view.", typedDashboard, typedRequest);
  if (typedRequest.metricIds.length === 0 || typedRequest.metricIds.some((metricId) => !typedDashboard.kpis.some((kpi) => kpi.id === metricId))) return deny("DENIED", "UNKNOWN_METRIC", "Only accepted BI-004 metrics can be displayed.", typedDashboard, typedRequest);

  if (!verifyBiSemanticModelV1(model)
    || model.modelDigest !== typedDashboard.semanticBinding.modelDigest
    || model.modelVersion !== typedDashboard.semanticBinding.modelVersion
    || model.modelId !== typedDashboard.semanticBinding.modelId
    || canonicalJson(model.measures) !== canonicalJson(typedDashboard.kpis.map(({ id, unit, formula }) => ({ id, unit, formula })))) {
    return deny("DENIED", "MODEL_BINDING_MISMATCH", "The dashboard is not bound to the accepted BI-004 model and formulas.", typedDashboard, typedRequest);
  }
  const typedModel = model as BiSemanticModelV1;
  if (typedRequest.tenantId !== typedModel.tenantId) return deny("DENIED", "TENANT_MISMATCH", "Dashboard tenant does not match the accepted model.", typedDashboard, typedRequest);
  if (Date.parse(typedRequest.modelValidatedAt) > Date.parse(typedRequest.observedAt)
    || Date.parse(typedRequest.observedAt) - Date.parse(typedRequest.modelValidatedAt) > typedDashboard.freshness.maxModelAgeSeconds * 1000) {
    return deny("STALE", "STALE_MODEL", "The semantic model validation is stale; no KPI is displayed.", typedDashboard, typedRequest);
  }

  const filterConflict = typedRequest.filters.tenantIds.length !== 1
    || typedRequest.filters.tenantIds[0] !== typedRequest.tenantId
    || typedRequest.filters.currencies.length !== 1
    || typedRequest.filters.currencies[0] !== "EUR"
    || typedRequest.filters.outcomes.length !== 1
    || typedRequest.filters.outcomes[0] !== "MATCHED";
  if (filterConflict) return deny("CONFLICT", "CONFLICTING_FILTERS", "Filters conflict with the frozen BI-004 dimensions; no KPI is displayed.", typedDashboard, typedRequest);

  if (object(report) && report.outcome === "DENIED") return deny("DENIED", "SEMANTIC_MODEL_DENIED", `BI-004 denied the source report (${escapeHtml(report.code)}).`, typedDashboard, typedRequest);
  const structureCode = reportStructureCode(report);
  if (structureCode !== null) return deny("ERROR", structureCode, structureCode === "MISSING_LINEAGE" ? "Required source lineage is missing; no KPI is displayed." : "Required BI-004 report data is missing; no KPI is displayed.", typedDashboard, typedRequest);
  const typedReport = report as ReconciledReport;
  if (typedReport.tenantId !== typedRequest.tenantId || typedReport.rows.some((row) => row.tenantId !== typedRequest.tenantId)) return deny("DENIED", "TENANT_MISMATCH", "Dashboard, report, or row tenant mismatch; no data crossed the boundary.", typedDashboard, typedRequest);
  if (typedReport.schemaVersion !== BI_RECONCILIATION_REPORT_SCHEMA_V1 || typedReport.modelVersion !== typedModel.modelVersion || reportBodyDigest(typedReport) !== typedReport.reportDigest) return deny("ERROR", "REPORT_INTEGRITY_INVALID", "BI-004 report integrity validation failed; no KPI is displayed.", typedDashboard, typedRequest);
  if (typedReport.rows.some((row) => row.outcome === "STALE")) return deny("STALE", "SOURCE_STALE", "BI-004 marked the source facts stale; no KPI is displayed.", typedDashboard, typedRequest);
  if (canonicalJson(typedReport.kpis.formulaIds) !== canonicalJson(typedDashboard.kpis.map((kpi) => kpi.id))) return deny("DENIED", "MODEL_BINDING_MISMATCH", "BI-004 formula identifiers do not match the dashboard contract.", typedDashboard, typedRequest);
  if (typedReport.sourceMutationProof.attemptedOperations.length !== 0 || typedReport.sourceMutationProof.writesAllowed !== false || typedReport.sourceMutationProof.sourceWriteBackAllowed !== false || typedReport.sourceMutationProof.inputDigestBefore !== typedReport.sourceMutationProof.inputDigestAfter) return deny("ERROR", "REPORT_INTEGRITY_INVALID", "BI-004 mutation proof is not read-only; no KPI is displayed.", typedDashboard, typedRequest);

  const matchedRows = typedReport.rows.filter((row): row is ReconciledRow & { outcome: "MATCHED" } => row.outcome === "MATCHED");
  const availableCanonicalIds = matchedRows.map((row) => row.canonicalId).sort();
  if (typedRequest.drillThrough.canonicalId !== null && (!canonicalId(typedRequest.drillThrough.canonicalId) || !availableCanonicalIds.includes(typedRequest.drillThrough.canonicalId))) return deny("DENIED", "ACCESS_DENIED", "The requested canonical fact is not available in this tenant and filter scope.", typedDashboard, typedRequest);

  const selectedMetrics = typedDashboard.kpis.filter((kpi) => typedRequest.metricIds.includes(kpi.id));
  const sourceGeneratedAt = [...new Set(matchedRows.flatMap((row) => [row.freshness.crmGeneratedAt, row.freshness.erpGeneratedAt]))].sort();
  const kpis: BiDashboardKpiReadbackV1[] = selectedMetrics.map((definition) => {
    const value = typedReport.kpis[METRIC_VALUE_KEYS[definition.id]] as number;
    const sides = definition.id === "measure:crm-amount-minor" ? ["crm"] as const : definition.id === "measure:erp-order-total-minor" ? ["erp"] as const : ["crm", "erp"] as const;
    const sourceLineage = matchedRows.flatMap((row) => {
      const index = typedReport.rows.indexOf(row);
      const both = sanitizedLineage(row, index);
      return sides.map((side) => both[side === "crm" ? 0 : 1]);
    });
    return {
      metricId: definition.id,
      label: definition.label,
      value,
      formattedValue: new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, useGrouping: true }).format(value),
      unit: definition.unit,
      formula: definition.formula,
      semanticValuePath: definition.semanticValuePath,
      semanticFormulaPath: definition.semanticFormulaPath,
      freshness: matchedRows.length === 0 ? { status: "UNAVAILABLE_NO_MATCHED_ROWS", observedAt: null, sourceGeneratedAt: [] } : { status: "FRESH", observedAt: matchedRows[0]!.freshness.observedAt, sourceGeneratedAt },
      trust: matchedRows.length === 0 ? [] : ["LOCAL_SYNTHETIC"],
      activeFilters: ["tenant=tenant:synthetic-zoo", "currency=EUR", "outcome=MATCHED"],
      limitations: typedDashboard.limitations,
      sourceLineage,
    };
  });

  const drillRows: BiDashboardDrillRowV1[] = typedRequest.drillThrough.canonicalId === null ? [] : matchedRows
    .filter((row) => row.canonicalId === typedRequest.drillThrough.canonicalId)
    .map((row) => {
      const index = typedReport.rows.indexOf(row);
      if (row.values.crmAmountMinor === null || row.values.erpTotalMinor === null || row.values.deltaMinor === null || row.values.currency !== "EUR") throw new Error("MATCHED_ROW_DATA_MISSING");
      return {
        canonicalId: row.canonicalId,
        outcome: "MATCHED",
        crmAmountMinor: row.values.crmAmountMinor,
        erpTotalMinor: row.values.erpTotalMinor,
        deltaMinor: row.values.deltaMinor,
        currency: row.values.currency,
        freshness: row.freshness,
        trust: row.trust,
        sanitizedLineage: sanitizedLineage(row, index),
      };
    });

  const state = matchedRows.length === 0 ? "EMPTY" as const : "NORMAL" as const;
  const code = state === "EMPTY" ? "NO_MATCHED_FACTS" as const : "DASHBOARD_READY" as const;
  const statusMessage = state === "EMPTY" ? "No BI-004 MATCHED facts are available for the active filters." : `${matchedRows.length} reconciled synthetic fact${matchedRows.length === 1 ? "" : "s"} available.`;
  return makeResult({ dashboard: typedDashboard, request: typedRequest, state, code, heading: "CRM and ERP reconciliation dashboard", statusMessage, kpis, availableCanonicalIds, drillRows, inputDigestBefore, inputValue });
}
