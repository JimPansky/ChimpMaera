import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const BI_SEMANTIC_MODEL_SCHEMA_V1 = "chimpmaera.bi/semantic-model/v1" as const;
export const BI_RECONCILIATION_INPUT_SCHEMA_V1 = "chimpmaera.bi/reconciliation-input/v1" as const;
export const BI_RECONCILIATION_REPORT_SCHEMA_V1 = "chimpmaera.bi/reconciliation-report/v1" as const;

export type ReconciliationOutcomeV1 = "MATCHED" | "UNMATCHED" | "AMBIGUOUS" | "DUPLICATE" | "STALE" | "CONFLICTING";
export type ModelGateCodeV1 = "MODEL_DISABLED" | "UNKNOWN_SCHEMA_VERSION" | "MODEL_INVALID" | "FORMULA_DRIFT" | "LINEAGE_MISSING" | "TENANT_MISMATCH" | "SOURCE_STALE" | "CURRENCY_UNIT_MISMATCH" | "NULL_DENIED" | "UNSUPPORTED_FIELD" | "SOURCE_INVALID";

export interface BiSemanticModelV1 {
  readonly schemaVersion: typeof BI_SEMANTIC_MODEL_SCHEMA_V1;
  readonly modelVersion: "1.0.0";
  readonly modelId: "semantic-model:crm-erp-reconciliation-v1";
  readonly defaultEnabled: false;
  readonly tenantId: "tenant:synthetic-zoo";
  readonly entities: readonly ["CRM_OPPORTUNITY", "ERP_ORDER", "CANONICAL_REVENUE_FACT"];
  readonly relationships: readonly [{ readonly id: "relationship:opportunity-order"; readonly from: "CRM_OPPORTUNITY"; readonly to: "ERP_ORDER"; readonly cardinality: "ZERO_OR_ONE_TO_ZERO_OR_ONE"; readonly join: "DECLARED_SOURCE_ID_PAIR_ONLY" }];
  readonly dimensions: readonly [{ readonly id: "dimension:tenant"; readonly expression: "canonical.tenantId" }, { readonly id: "dimension:currency"; readonly expression: "canonical.currency" }, { readonly id: "dimension:outcome"; readonly expression: "reconciliation.outcome" }];
  readonly measures: readonly [
    { readonly id: "measure:crm-amount-minor"; readonly unit: "EUR_MINOR"; readonly formula: "SUM(MATCHED.crm.amount_major * 100)" },
    { readonly id: "measure:erp-order-total-minor"; readonly unit: "EUR_MINOR"; readonly formula: "SUM(MATCHED.erp.total_minor)" },
    { readonly id: "measure:reconciliation-delta-minor"; readonly unit: "EUR_MINOR"; readonly formula: "measure:crm-amount-minor - measure:erp-order-total-minor" }
  ];
  readonly policy: { readonly toleranceMinor: 0; readonly maxAgeSeconds: 3600; readonly unknownFieldsAllowed: false; readonly nullsAllowed: false; readonly writesAllowed: false; readonly sourceWriteBackAllowed: false; readonly probabilisticMergeAllowed: false; readonly conflictResolution: "EXPLICIT_ONLY" };
  readonly modelDigest: string;
}

export interface BiReconciliationInputV1 {
  readonly schemaVersion: typeof BI_RECONCILIATION_INPUT_SCHEMA_V1;
  readonly tenantId: string;
  readonly observedAt: string;
  readonly crm: { readonly schemaVersion: "chimpmaera.connector/crm-supported-export/v1"; readonly exportId: string; readonly generatedAt: string; readonly expiresAt: string; readonly trust: "LOCAL_SYNTHETIC"; readonly lineage: { readonly sourceSystem: "SYNTHETIC_CRM"; readonly sourceDatasetId: string; readonly sourceDigest: string }; readonly facts: readonly { readonly opportunityId: string; readonly accountId: string; readonly amountMajor: number; readonly currency: "EUR"; readonly sourceBatchId: string }[] };
  readonly erp: { readonly schemaVersion: "chimpmaera.connector/erp-supported-export/v1"; readonly exportId: string; readonly generatedAt: string; readonly expiresAt: string; readonly trust: "LOCAL_SYNTHETIC"; readonly lineage: { readonly sourceSystem: "SYNTHETIC_ERP"; readonly sourceDatasetId: string; readonly sourceDigest: string }; readonly facts: readonly { readonly orderId: string; readonly customerId: string; readonly totalMinor: number; readonly currency: "EUR"; readonly sourceRecordId: string; readonly sourceUpdatedAt: string; readonly sourceBatchId: string }[] };
  readonly mappings: readonly { readonly crmOpportunityId: string; readonly erpOrderId: string }[];
}

const MODEL_CONTENT = {
  schemaVersion: BI_SEMANTIC_MODEL_SCHEMA_V1, modelVersion: "1.0.0", modelId: "semantic-model:crm-erp-reconciliation-v1", defaultEnabled: false, tenantId: "tenant:synthetic-zoo",
  entities: ["CRM_OPPORTUNITY", "ERP_ORDER", "CANONICAL_REVENUE_FACT"],
  relationships: [{ id: "relationship:opportunity-order", from: "CRM_OPPORTUNITY", to: "ERP_ORDER", cardinality: "ZERO_OR_ONE_TO_ZERO_OR_ONE", join: "DECLARED_SOURCE_ID_PAIR_ONLY" }],
  dimensions: [{ id: "dimension:tenant", expression: "canonical.tenantId" }, { id: "dimension:currency", expression: "canonical.currency" }, { id: "dimension:outcome", expression: "reconciliation.outcome" }],
  measures: [{ id: "measure:crm-amount-minor", unit: "EUR_MINOR", formula: "SUM(MATCHED.crm.amount_major * 100)" }, { id: "measure:erp-order-total-minor", unit: "EUR_MINOR", formula: "SUM(MATCHED.erp.total_minor)" }, { id: "measure:reconciliation-delta-minor", unit: "EUR_MINOR", formula: "measure:crm-amount-minor - measure:erp-order-total-minor" }],
  policy: { toleranceMinor: 0, maxAgeSeconds: 3600, unknownFieldsAllowed: false, nullsAllowed: false, writesAllowed: false, sourceWriteBackAllowed: false, probabilisticMergeAllowed: false, conflictResolution: "EXPLICIT_ONLY" },
} as const;

const sha = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
const object = (value: unknown): value is Record<string, any> => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value: unknown, keys: readonly string[]) => object(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const timestamp = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) && !Number.isNaN(Date.parse(value));
const id = (value: unknown) => typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
const digest = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

export function biSemanticModelDigestV1(value: Omit<BiSemanticModelV1, "modelDigest"> | BiSemanticModelV1): string { return sha(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "modelDigest"))); }
export function verifyBiSemanticModelV1(value: unknown): value is BiSemanticModelV1 {
  return exactKeys(value, [...Object.keys(MODEL_CONTENT), "modelDigest"]) && digest((value as any).modelDigest)
    && canonicalJson(Object.fromEntries(Object.entries(value as any).filter(([key]) => key !== "modelDigest"))) === canonicalJson(MODEL_CONTENT)
    && (value as any).modelDigest === sha(MODEL_CONTENT);
}

export type BiReconciliationReportV1 = { readonly outcome: "DENIED"; readonly code: ModelGateCodeV1 } | {
  readonly outcome: "RECONCILED"; readonly schemaVersion: typeof BI_RECONCILIATION_REPORT_SCHEMA_V1; readonly modelVersion: "1.0.0"; readonly tenantId: string;
  readonly rows: readonly { readonly canonicalId: string; readonly outcome: ReconciliationOutcomeV1; readonly tenantId: string; readonly crmOpportunityId: string | null; readonly erpOrderId: string | null; readonly sourceIds: readonly string[]; readonly trust: readonly ["LOCAL_SYNTHETIC", "LOCAL_SYNTHETIC"]; readonly freshness: { readonly observedAt: string; readonly crmGeneratedAt: string; readonly erpGeneratedAt: string }; readonly lineage: { readonly crm: { readonly exportId: string; readonly datasetId: string; readonly digest: string; readonly batchId: string | null }; readonly erp: { readonly exportId: string; readonly datasetId: string; readonly digest: string; readonly batchId: string | null; readonly sourceRecordId: string | null; readonly sourceUpdatedAt: string | null } }; readonly values: { readonly crmAmountMinor: number | null; readonly erpTotalMinor: number | null; readonly deltaMinor: number | null; readonly currency: "EUR" | null } }[];
  readonly kpis: { readonly crmAmountMinor: number; readonly erpOrderTotalMinor: number; readonly reconciliationDeltaMinor: number; readonly toleranceMinor: 0; readonly exact: boolean; readonly formulaIds: readonly ["measure:crm-amount-minor", "measure:erp-order-total-minor", "measure:reconciliation-delta-minor"]; readonly sourceReadbackIds: readonly string[] };
  readonly sourceMutationProof: { readonly attemptedOperations: readonly []; readonly writesAllowed: false; readonly sourceWriteBackAllowed: false; readonly inputDigestBefore: string; readonly inputDigestAfter: string };
  readonly reportDigest: string;
};

function validateInput(value: unknown): ModelGateCodeV1 | null {
  if (!object(value) || value.schemaVersion !== BI_RECONCILIATION_INPUT_SCHEMA_V1) return "UNKNOWN_SCHEMA_VERSION";
  if (!exactKeys(value, ["schemaVersion", "tenantId", "observedAt", "crm", "erp", "mappings"])) return "UNSUPPORTED_FIELD";
  if (!id(value.tenantId) || !timestamp(value.observedAt) || !object(value.crm) || !object(value.erp) || !Array.isArray(value.mappings)) return "SOURCE_INVALID";
  const sourceKeys = ["schemaVersion", "exportId", "generatedAt", "expiresAt", "trust", "lineage", "facts"];
  if (!("lineage" in value.crm) || !("lineage" in value.erp)) return "LINEAGE_MISSING";
  if (!exactKeys(value.crm, sourceKeys) || !exactKeys(value.erp, sourceKeys)) return "UNSUPPORTED_FIELD";
  if (value.crm.schemaVersion !== "chimpmaera.connector/crm-supported-export/v1" || value.erp.schemaVersion !== "chimpmaera.connector/erp-supported-export/v1") return "UNKNOWN_SCHEMA_VERSION";
  for (const source of [value.crm, value.erp]) if (!id(source.exportId) || !timestamp(source.generatedAt) || !timestamp(source.expiresAt) || source.trust !== "LOCAL_SYNTHETIC" || !Array.isArray(source.facts)) return "SOURCE_INVALID";
  if (!exactKeys(value.crm.lineage, ["sourceSystem", "sourceDatasetId", "sourceDigest"]) || !exactKeys(value.erp.lineage, ["sourceSystem", "sourceDatasetId", "sourceDigest"]) || value.crm.lineage.sourceSystem !== "SYNTHETIC_CRM" || value.erp.lineage.sourceSystem !== "SYNTHETIC_ERP" || !id(value.crm.lineage.sourceDatasetId) || !id(value.erp.lineage.sourceDatasetId) || !digest(value.crm.lineage.sourceDigest) || !digest(value.erp.lineage.sourceDigest)) return "LINEAGE_MISSING";
  const crmKeys = ["opportunityId", "accountId", "amountMajor", "currency", "sourceBatchId"]; const erpKeys = ["orderId", "customerId", "totalMinor", "currency", "sourceRecordId", "sourceUpdatedAt", "sourceBatchId"];
  for (const fact of value.crm.facts) { if (!exactKeys(fact, crmKeys)) return "UNSUPPORTED_FIELD"; if (Object.values(fact).some((v) => v === null)) return "NULL_DENIED"; if (!id(fact.opportunityId) || !id(fact.accountId) || !Number.isSafeInteger(fact.amountMajor) || fact.amountMajor < 0 || fact.currency !== "EUR" || !id(fact.sourceBatchId)) return fact.currency !== "EUR" ? "CURRENCY_UNIT_MISMATCH" : "SOURCE_INVALID"; }
  for (const fact of value.erp.facts) { if (!exactKeys(fact, erpKeys)) return "UNSUPPORTED_FIELD"; if (Object.values(fact).some((v) => v === null)) return "NULL_DENIED"; if (!id(fact.orderId) || !id(fact.customerId) || !Number.isSafeInteger(fact.totalMinor) || fact.totalMinor < 0 || fact.currency !== "EUR" || !id(fact.sourceRecordId) || !timestamp(fact.sourceUpdatedAt) || !id(fact.sourceBatchId)) return fact.currency !== "EUR" ? "CURRENCY_UNIT_MISMATCH" : "SOURCE_INVALID"; }
  for (const mapping of value.mappings) if (!exactKeys(mapping, ["crmOpportunityId", "erpOrderId"]) || !id(mapping.crmOpportunityId) || !id(mapping.erpOrderId)) return "SOURCE_INVALID";
  return null;
}

export function reconcileCrmErpV1({ model, input, enabled }: { model: unknown; input: unknown; enabled: boolean }): BiReconciliationReportV1 {
  if (!enabled) return { outcome: "DENIED", code: "MODEL_DISABLED" };
  if (object(model) && model.schemaVersion !== BI_SEMANTIC_MODEL_SCHEMA_V1) return { outcome: "DENIED", code: "UNKNOWN_SCHEMA_VERSION" };
  if (!verifyBiSemanticModelV1(model)) return { outcome: "DENIED", code: object(model) && Array.isArray(model.measures) ? "FORMULA_DRIFT" : "MODEL_INVALID" };
  const inputError = validateInput(input); if (inputError) return { outcome: "DENIED", code: inputError }; const typed = input as BiReconciliationInputV1;
  if (typed.tenantId !== model.tenantId) return { outcome: "DENIED", code: "TENANT_MISMATCH" };
  const stale = Date.parse(typed.observedAt) > Date.parse(typed.crm.expiresAt) || Date.parse(typed.observedAt) > Date.parse(typed.erp.expiresAt) || Date.parse(typed.observedAt) - Date.parse(typed.crm.generatedAt) > model.policy.maxAgeSeconds * 1000 || Date.parse(typed.observedAt) - Date.parse(typed.erp.generatedAt) > model.policy.maxAgeSeconds * 1000;
  const before = sha(typed); const crmCounts = new Map<string, number>(); const erpCounts = new Map<string, number>();
  for (const fact of typed.crm.facts) crmCounts.set(fact.opportunityId, (crmCounts.get(fact.opportunityId) ?? 0) + 1); for (const fact of typed.erp.facts) erpCounts.set(fact.orderId, (erpCounts.get(fact.orderId) ?? 0) + 1);
  const crmById = new Map(typed.crm.facts.map((fact) => [fact.opportunityId, fact])); const erpById = new Map(typed.erp.facts.map((fact) => [fact.orderId, fact]));
  const allPairs = typed.mappings; const keys = new Set([...typed.crm.facts.map((f) => `crm:${f.opportunityId}`), ...typed.erp.facts.map((f) => `erp:${f.orderId}`)]); const rows: any[] = [];
  const emitted = new Set<string>();
  for (const key of [...keys].sort()) {
    const separator = key.indexOf(":"); const side = key.slice(0, separator); const sourceId = key.slice(separator + 1); const candidates = side === "crm" ? allPairs.filter((m) => m.crmOpportunityId === sourceId) : allPairs.filter((m) => m.erpOrderId === sourceId); const crmId = side === "crm" ? sourceId : candidates[0]?.crmOpportunityId ?? null; const erpId = side === "erp" ? sourceId : candidates[0]?.erpOrderId ?? null; const pairKey = `${crmId ?? "none"}|${erpId ?? "none"}`; if (emitted.has(pairKey)) continue; emitted.add(pairKey);
    const crm = crmId ? crmById.get(crmId) : undefined; const erp = erpId ? erpById.get(erpId) : undefined; let outcome: ReconciliationOutcomeV1 = "MATCHED";
    if (stale) outcome = "STALE"; else if ((crmId && (crmCounts.get(crmId) ?? 0) > 1) || (erpId && (erpCounts.get(erpId) ?? 0) > 1)) outcome = "DUPLICATE"; else if (candidates.length > 1) outcome = "AMBIGUOUS"; else if (!crm || !erp || candidates.length === 0) outcome = "UNMATCHED"; else if (crm.currency !== erp.currency || crm.amountMajor * 100 !== erp.totalMinor) outcome = "CONFLICTING";
    const canonicalId = `canonical:${sha({ tenantId: typed.tenantId, crmId: crmId ?? null, erpId: erpId ?? null }).slice(0, 24)}`; rows.push({ canonicalId, outcome, tenantId: typed.tenantId, crmOpportunityId: crmId, erpOrderId: erpId, sourceIds: [crmId, erpId, erp?.sourceRecordId].filter(Boolean).sort(), trust: [typed.crm.trust, typed.erp.trust], freshness: { observedAt: typed.observedAt, crmGeneratedAt: typed.crm.generatedAt, erpGeneratedAt: typed.erp.generatedAt }, lineage: { crm: { exportId: typed.crm.exportId, datasetId: typed.crm.lineage.sourceDatasetId, digest: typed.crm.lineage.sourceDigest, batchId: crm?.sourceBatchId ?? null }, erp: { exportId: typed.erp.exportId, datasetId: typed.erp.lineage.sourceDatasetId, digest: typed.erp.lineage.sourceDigest, batchId: erp?.sourceBatchId ?? null, sourceRecordId: erp?.sourceRecordId ?? null, sourceUpdatedAt: erp?.sourceUpdatedAt ?? null } }, values: { crmAmountMinor: crm ? crm.amountMajor * 100 : null, erpTotalMinor: erp?.totalMinor ?? null, deltaMinor: crm && erp ? crm.amountMajor * 100 - erp.totalMinor : null, currency: crm?.currency ?? erp?.currency ?? null } });
  }
  rows.sort((a, b) => a.canonicalId.localeCompare(b.canonicalId)); const matched = rows.filter((row) => row.outcome === "MATCHED"); const crmAmountMinor = matched.reduce((sum, row) => sum + row.values.crmAmountMinor, 0); const erpOrderTotalMinor = matched.reduce((sum, row) => sum + row.values.erpTotalMinor, 0); const kpis = { crmAmountMinor, erpOrderTotalMinor, reconciliationDeltaMinor: crmAmountMinor - erpOrderTotalMinor, toleranceMinor: 0 as const, exact: Math.abs(crmAmountMinor - erpOrderTotalMinor) <= model.policy.toleranceMinor, formulaIds: ["measure:crm-amount-minor", "measure:erp-order-total-minor", "measure:reconciliation-delta-minor"] as const, sourceReadbackIds: matched.flatMap((row) => row.sourceIds).sort() };
  const body = { outcome: "RECONCILED" as const, schemaVersion: BI_RECONCILIATION_REPORT_SCHEMA_V1, modelVersion: model.modelVersion, tenantId: typed.tenantId, rows, kpis, sourceMutationProof: { attemptedOperations: [] as const, writesAllowed: model.policy.writesAllowed, sourceWriteBackAllowed: model.policy.sourceWriteBackAllowed, inputDigestBefore: before, inputDigestAfter: sha(typed) } }; return { ...body, reportDigest: sha(body) };
}
