import { createHash } from "node:crypto";

import { canonicalJson } from "./canonical-json.js";

export const BI_EXECUTION_SPINE_SCHEMA_V1 =
  "chimpmaera.cm-bi-exec/governed-bi-execution-spine/v1" as const;
export const BI_EXECUTION_SPINE_DECISION_SCHEMA_V1 =
  "chimpmaera.cm-bi-exec/governed-bi-execution-spine-decision/v1" as const;
export const BI_EXECUTION_SPINE_CLAIM_BOUNDARY_V1 =
  "DECLARATIVE_BI_EXECUTION_SPINE_CONTRACT_ONLY_NO_RUNTIME_NO_SQL_ENGINE_NO_DASHBOARD_AUTHORITY_NO_PRODUCTION_DATA" as const;

export const BI_EXECUTION_SPINE_REQUIRED_QUESTIONS_V1 = [
  "crm-risk-exposure",
  "erp-margin-drift",
  "operation-quality-exception-rate",
] as const;

export const BI_EXECUTION_SPINE_DENIED_CAPABILITIES_V1 = [
  "ARBITRARY_SQL",
  "PYTHON",
  "SHELL",
  "NETWORK",
  "CREDENTIALS",
  "LIVE_CONNECTOR",
  "DASHBOARD_AUTHORITY",
] as const;

export const BI_EXECUTION_SPINE_PROHIBITED_FIELDS_V1 = [
  "command", "connectionString", "credential", "email", "hostname",
  "ipAddress", "password", "path", "prompt", "python", "rawEvidence",
  "rawPrompt", "rawResponse", "rawSql", "secret", "sessionId", "shell",
  "sql", "tenantId", "token", "userId",
] as const;

export type BiExecutionSpineReasonCodeV1 =
  | "BI_EXECUTION_SPINE_VERIFIED"
  | "BI_EXECUTION_SPINE_SCHEMA_DENIED"
  | "BI_EXECUTION_SPINE_PROHIBITED_FIELD_DENIED"
  | "BI_EXECUTION_SPINE_SENSITIVE_VALUE_DENIED"
  | "BI_EXECUTION_SPINE_DIGEST_DENIED"
  | "BI_EXECUTION_SPINE_ARTIFACT_DIGEST_DENIED"
  | "BI_EXECUTION_SPINE_QUESTION_SET_DENIED"
  | "BI_EXECUTION_SPINE_QUESTION_SEMANTICS_DENIED"
  | "BI_EXECUTION_SPINE_SOURCE_DENIED"
  | "BI_EXECUTION_SPINE_QUERY_SAFETY_DENIED"
  | "BI_EXECUTION_SPINE_RECEIPT_DENIED"
  | "BI_EXECUTION_SPINE_VERIFICATION_DENIED"
  | "BI_EXECUTION_SPINE_CLAIM_DENIED"
  | "BI_EXECUTION_SPINE_VISUALIZATION_DENIED"
  | "BI_EXECUTION_SPINE_TENANT_BOUNDARY_DENIED";

export interface BiExecutionSpineQuestionV1 {
  readonly questionId: typeof BI_EXECUTION_SPINE_REQUIRED_QUESTIONS_V1[number];
  readonly intent: {
    readonly actor: "CM_AGENT_SYNTHETIC";
    readonly purpose: "READ_ONLY_BUSINESS_ANSWER";
    readonly naturalLanguage: string;
    readonly tenantBoundary: "PUBLIC_SYNTHETIC_ONLY";
  };
  readonly sources: readonly {
    readonly system: "CRM_FIXTURE" | "ERP_FIXTURE" | "CM_OBS_FIXTURE";
    readonly sourceDigest: string;
    readonly operationQualityDigest: string;
    readonly freshnessMs: number;
    readonly missingnessReasons: readonly (
      | "NONE"
      | "EVIDENCE_NOT_PRODUCED"
      | "SOURCE_REDACTED"
      | "LATE_OBSERVED_EVENT"
      | "SEQUENCE_GAP"
    )[];
  }[];
  readonly semanticModel: {
    readonly modelId: "cm-bi-semantic-synthetic-v1";
    readonly version: "1.0.0";
    readonly entities: readonly ("account" | "invoice" | "order" | "operation_event")[];
    readonly metric: "risk_exposure_eur" | "margin_drift_pct" | "quality_exception_rate";
    readonly unit: "EUR" | "PERCENT";
    readonly grain: "account_month" | "product_month" | "operation_day";
    readonly formulaDigest: string;
  };
  readonly queryPlan: {
    readonly planId: string;
    readonly kind: "DECLARATIVE_AGGREGATE_PLAN";
    readonly allowedFields: readonly string[];
    readonly capabilitiesDenied: readonly typeof BI_EXECUTION_SPINE_DENIED_CAPABILITIES_V1[number][];
    readonly planDigest: string;
  };
  readonly executionReceipt: {
    readonly receiptId: string;
    readonly status: "SIMULATED_VERIFIED";
    readonly executedAtMs: number;
    readonly rowCount: number;
    readonly resultDigest: string;
    readonly receiptDigest: string;
  };
  readonly verificationReport: {
    readonly outcome: "VERIFIED";
    readonly sourceLineageComplete: true;
    readonly formulaVerified: true;
    readonly freshness: "FRESH";
    readonly privacyVerified: true;
    readonly qualityStates: readonly ("PASS" | "WARN")[];
    readonly missingnessReasons: readonly [];
    readonly denialReasons: readonly [];
  };
  readonly claim: {
    readonly outcome: "ANSWERED";
    readonly statement: string;
    readonly confidence: "BOUNDED_SYNTHETIC";
    readonly nonAuthority: "NOT_A_DASHBOARD_NOT_PRODUCTION_NOT_SYSTEM_OF_RECORD";
    readonly claimDigest: string;
  };
  readonly visualization: {
    readonly kind: "KPI" | "BAR" | "TABLE";
    readonly fields: readonly string[];
    readonly unsupportedReason: null;
    readonly visualizationDigest: string;
  };
  readonly questionDigest: string;
}

export interface BiExecutionSpineBundleV1 {
  readonly schemaVersion: typeof BI_EXECUTION_SPINE_SCHEMA_V1;
  readonly spineId: "cm-bi-exec-001-synthetic-contract-v1";
  readonly contractVersion: "1.0.0";
  readonly evidenceClass: "PUBLIC_SYNTHETIC";
  readonly questions: readonly BiExecutionSpineQuestionV1[];
  readonly claimBoundary: typeof BI_EXECUTION_SPINE_CLAIM_BOUNDARY_V1;
  readonly bundleDigest: string;
}

export type BiExecutionSpineDecisionV1 =
  | {
    readonly schemaVersion: typeof BI_EXECUTION_SPINE_DECISION_SCHEMA_V1;
    readonly outcome: "VERIFIED";
    readonly reasonCodes: readonly ["BI_EXECUTION_SPINE_VERIFIED"];
    readonly questionCount: 3;
    readonly claimBoundary: typeof BI_EXECUTION_SPINE_CLAIM_BOUNDARY_V1;
    readonly bundleDigest: string;
  }
  | {
    readonly schemaVersion: typeof BI_EXECUTION_SPINE_DECISION_SCHEMA_V1;
    readonly outcome: "DENIED";
    readonly reasonCodes: readonly BiExecutionSpineReasonCodeV1[];
    readonly claimBoundary: typeof BI_EXECUTION_SPINE_CLAIM_BOUNDARY_V1;
  };

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 240;
}

function isClosedArray(value: unknown, allowed: readonly string[], allowEmpty = false): value is string[] {
  return Array.isArray(value) && (allowEmpty || value.length > 0)
    && value.every((item) => typeof item === "string" && allowed.includes(item))
    && new Set(value).size === value.length;
}

function normalizedKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function containsProhibitedField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsProhibitedField);
  if (!isRecord(value)) return false;
  const prohibited = new Set(BI_EXECUTION_SPINE_PROHIBITED_FIELDS_V1.map(normalizedKey));
  return Object.entries(value).some(([key, nested]) => prohibited.has(normalizedKey(key)) || containsProhibitedField(nested));
}

function containsSensitiveValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitiveValue);
  if (isRecord(value)) return Object.values(value).some(containsSensitiveValue);
  if (typeof value !== "string") return false;
  return /-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(value)
    || /\bgh[pousr]_[A-Za-z0-9]{20,}\b/.test(value)
    || /(?:^|\s)(?:\/home\/|\/Users\/)[^\s]+/.test(value)
    || /\btenant-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/i.test(value);
}

function contentWithoutKey(value: Record<string, unknown>, omittedKey: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== omittedKey));
}

function validSources(value: unknown): value is BiExecutionSpineQuestionV1["sources"] {
  const systems = ["CRM_FIXTURE", "ERP_FIXTURE", "CM_OBS_FIXTURE"];
  const reasons = ["NONE", "EVIDENCE_NOT_PRODUCED", "SOURCE_REDACTED", "LATE_OBSERVED_EVENT", "SEQUENCE_GAP"];
  return Array.isArray(value) && value.length >= 1 && value.length <= 3 && value.every((source) =>
    exactKeys(source, ["system", "sourceDigest", "operationQualityDigest", "freshnessMs", "missingnessReasons"])
    && systems.includes(source.system as string)
    && isDigest(source.sourceDigest)
    && isDigest(source.operationQualityDigest)
    && isTimestamp(source.freshnessMs)
    && isClosedArray(source.missingnessReasons, reasons)
  );
}

function validQuestion(value: unknown): value is BiExecutionSpineQuestionV1 {
  return exactKeys(value, [
    "questionId", "intent", "sources", "semanticModel", "queryPlan", "executionReceipt",
    "verificationReport", "claim", "visualization", "questionDigest",
  ])
    && (BI_EXECUTION_SPINE_REQUIRED_QUESTIONS_V1 as readonly string[]).includes(value.questionId as string)
    && exactKeys(value.intent, ["actor", "purpose", "naturalLanguage", "tenantBoundary"])
    && value.intent.actor === "CM_AGENT_SYNTHETIC"
    && value.intent.purpose === "READ_ONLY_BUSINESS_ANSWER"
    && isNonEmptyString(value.intent.naturalLanguage)
    && value.intent.tenantBoundary === "PUBLIC_SYNTHETIC_ONLY"
    && validSources(value.sources)
    && exactKeys(value.semanticModel, ["modelId", "version", "entities", "metric", "unit", "grain", "formulaDigest"])
    && value.semanticModel.modelId === "cm-bi-semantic-synthetic-v1"
    && value.semanticModel.version === "1.0.0"
    && isClosedArray(value.semanticModel.entities, ["account", "invoice", "order", "operation_event"])
    && ["risk_exposure_eur", "margin_drift_pct", "quality_exception_rate"].includes(value.semanticModel.metric as string)
    && ["EUR", "PERCENT"].includes(value.semanticModel.unit as string)
    && ["account_month", "product_month", "operation_day"].includes(value.semanticModel.grain as string)
    && isDigest(value.semanticModel.formulaDigest)
    && exactKeys(value.queryPlan, ["planId", "kind", "allowedFields", "capabilitiesDenied", "planDigest"])
    && /^plan:[a-z0-9][a-z0-9-]{7,63}$/.test(String(value.queryPlan.planId))
    && value.queryPlan.kind === "DECLARATIVE_AGGREGATE_PLAN"
    && isClosedArray(value.queryPlan.allowedFields, [
      "account_id", "customer_segment", "invoice_amount_eur", "invoice_status",
      "product_family", "order_margin_pct", "operation_quality_state", "operation_event_day",
    ])
    && isClosedArray(value.queryPlan.capabilitiesDenied, BI_EXECUTION_SPINE_DENIED_CAPABILITIES_V1)
    && isDigest(value.queryPlan.planDigest)
    && exactKeys(value.executionReceipt, ["receiptId", "status", "executedAtMs", "rowCount", "resultDigest", "receiptDigest"])
    && /^receipt:[a-z0-9][a-z0-9-]{7,63}$/.test(String(value.executionReceipt.receiptId))
    && value.executionReceipt.status === "SIMULATED_VERIFIED"
    && isTimestamp(value.executionReceipt.executedAtMs)
    && Number.isSafeInteger(value.executionReceipt.rowCount)
    && (value.executionReceipt.rowCount as number) >= 0
    && isDigest(value.executionReceipt.resultDigest)
    && isDigest(value.executionReceipt.receiptDigest)
    && exactKeys(value.verificationReport, [
      "outcome", "sourceLineageComplete", "formulaVerified", "freshness", "privacyVerified",
      "qualityStates", "missingnessReasons", "denialReasons",
    ])
    && value.verificationReport.outcome === "VERIFIED"
    && value.verificationReport.sourceLineageComplete === true
    && value.verificationReport.formulaVerified === true
    && value.verificationReport.freshness === "FRESH"
    && value.verificationReport.privacyVerified === true
    && isClosedArray(value.verificationReport.qualityStates, ["PASS", "WARN"])
    && Array.isArray(value.verificationReport.missingnessReasons)
    && value.verificationReport.missingnessReasons.length === 0
    && Array.isArray(value.verificationReport.denialReasons)
    && value.verificationReport.denialReasons.length === 0
    && exactKeys(value.claim, ["outcome", "statement", "confidence", "nonAuthority", "claimDigest"])
    && value.claim.outcome === "ANSWERED"
    && isNonEmptyString(value.claim.statement)
    && value.claim.confidence === "BOUNDED_SYNTHETIC"
    && value.claim.nonAuthority === "NOT_A_DASHBOARD_NOT_PRODUCTION_NOT_SYSTEM_OF_RECORD"
    && isDigest(value.claim.claimDigest)
    && exactKeys(value.visualization, ["kind", "fields", "unsupportedReason", "visualizationDigest"])
    && ["KPI", "BAR", "TABLE"].includes(value.visualization.kind as string)
    && isClosedArray(value.visualization.fields, value.queryPlan.allowedFields)
    && value.visualization.unsupportedReason === null
    && isDigest(value.visualization.visualizationDigest)
    && isDigest(value.questionDigest);
}

function denied(reason: BiExecutionSpineReasonCodeV1): BiExecutionSpineDecisionV1 {
  return {
    schemaVersion: BI_EXECUTION_SPINE_DECISION_SCHEMA_V1,
    outcome: "DENIED",
    reasonCodes: [reason],
    claimBoundary: BI_EXECUTION_SPINE_CLAIM_BOUNDARY_V1,
  };
}

function questionContent(value: BiExecutionSpineQuestionV1): Record<string, unknown> {
  return contentWithoutKey(value as unknown as Record<string, unknown>, "questionDigest");
}

export function biExecutionSpinePlanDigestV1(value: BiExecutionSpineQuestionV1["queryPlan"]): string {
  return digest(contentWithoutKey(value as unknown as Record<string, unknown>, "planDigest"));
}

export function biExecutionSpineReceiptDigestV1(value: BiExecutionSpineQuestionV1["executionReceipt"]): string {
  return digest(contentWithoutKey(value as unknown as Record<string, unknown>, "receiptDigest"));
}

export function biExecutionSpineClaimDigestV1(value: BiExecutionSpineQuestionV1["claim"]): string {
  return digest(contentWithoutKey(value as unknown as Record<string, unknown>, "claimDigest"));
}

export function biExecutionSpineVisualizationDigestV1(value: BiExecutionSpineQuestionV1["visualization"]): string {
  return digest(contentWithoutKey(value as unknown as Record<string, unknown>, "visualizationDigest"));
}

export function biExecutionSpineQuestionDigestV1(value: BiExecutionSpineQuestionV1): string {
  return digest(questionContent(value));
}

export function biExecutionSpineBundleDigestV1(value: BiExecutionSpineBundleV1): string {
  const unsigned = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "bundleDigest"));
  return digest(unsigned);
}

export function evaluateBiExecutionSpineV1(value: unknown): BiExecutionSpineDecisionV1 {
  if (containsProhibitedField(value)) return denied("BI_EXECUTION_SPINE_PROHIBITED_FIELD_DENIED");
  if (containsSensitiveValue(value)) return denied("BI_EXECUTION_SPINE_SENSITIVE_VALUE_DENIED");
  if (!exactKeys(value, [
    "schemaVersion", "spineId", "contractVersion", "evidenceClass", "questions",
    "claimBoundary", "bundleDigest",
  ])
    || value.schemaVersion !== BI_EXECUTION_SPINE_SCHEMA_V1
    || value.spineId !== "cm-bi-exec-001-synthetic-contract-v1"
    || value.contractVersion !== "1.0.0"
    || value.evidenceClass !== "PUBLIC_SYNTHETIC"
    || value.claimBoundary !== BI_EXECUTION_SPINE_CLAIM_BOUNDARY_V1
    || !isDigest(value.bundleDigest)
    || !Array.isArray(value.questions)
    || value.questions.length !== 3
    || !value.questions.every(validQuestion)) {
    return denied("BI_EXECUTION_SPINE_SCHEMA_DENIED");
  }

  const bundle = value as unknown as BiExecutionSpineBundleV1;
  const ids = bundle.questions.map((question) => question.questionId).sort();
  if (canonicalJson(ids) !== canonicalJson([...BI_EXECUTION_SPINE_REQUIRED_QUESTIONS_V1].sort())) {
    return denied("BI_EXECUTION_SPINE_QUESTION_SET_DENIED");
  }
  const expectedSemantics: Record<BiExecutionSpineQuestionV1["questionId"], {
    systems: readonly string[];
    entities: readonly string[];
    metric: string;
    unit: string;
    grain: string;
    allowedFields: readonly string[];
  }> = {
    "crm-risk-exposure": {
      systems: ["CRM_FIXTURE", "ERP_FIXTURE"],
      entities: ["account", "invoice"],
      metric: "risk_exposure_eur",
      unit: "EUR",
      grain: "account_month",
      allowedFields: ["account_id", "customer_segment", "invoice_amount_eur", "invoice_status"],
    },
    "erp-margin-drift": {
      systems: ["ERP_FIXTURE"],
      entities: ["order"],
      metric: "margin_drift_pct",
      unit: "PERCENT",
      grain: "product_month",
      allowedFields: ["product_family", "order_margin_pct"],
    },
    "operation-quality-exception-rate": {
      systems: ["CM_OBS_FIXTURE"],
      entities: ["operation_event"],
      metric: "quality_exception_rate",
      unit: "PERCENT",
      grain: "operation_day",
      allowedFields: ["operation_quality_state", "operation_event_day"],
    },
  };
  if (bundle.questions.some((question) => {
    const expected = expectedSemantics[question.questionId];
    return canonicalJson([...question.sources.map((source) => source.system)].sort()) !== canonicalJson([...expected.systems].sort())
      || canonicalJson([...question.semanticModel.entities].sort()) !== canonicalJson([...expected.entities].sort())
      || question.semanticModel.metric !== expected.metric
      || question.semanticModel.unit !== expected.unit
      || question.semanticModel.grain !== expected.grain
      || canonicalJson([...question.queryPlan.allowedFields].sort()) !== canonicalJson([...expected.allowedFields].sort());
  })) {
    return denied("BI_EXECUTION_SPINE_QUESTION_SEMANTICS_DENIED");
  }
  if (bundle.questions.some((question) =>
    biExecutionSpinePlanDigestV1(question.queryPlan) !== question.queryPlan.planDigest
    || biExecutionSpineReceiptDigestV1(question.executionReceipt) !== question.executionReceipt.receiptDigest
    || biExecutionSpineClaimDigestV1(question.claim) !== question.claim.claimDigest
    || biExecutionSpineVisualizationDigestV1(question.visualization) !== question.visualization.visualizationDigest
  )) {
    return denied("BI_EXECUTION_SPINE_ARTIFACT_DIGEST_DENIED");
  }
  if (biExecutionSpineBundleDigestV1(bundle) !== bundle.bundleDigest
    || bundle.questions.some((question) => biExecutionSpineQuestionDigestV1(question) !== question.questionDigest)) {
    return denied("BI_EXECUTION_SPINE_DIGEST_DENIED");
  }
  if (bundle.questions.some((question) => new Set(question.sources.map((source) => source.system)).size !== question.sources.length)) {
    return denied("BI_EXECUTION_SPINE_SOURCE_DENIED");
  }
  if (bundle.questions.some((question) =>
    question.sources.some((source) => source.freshnessMs > 86_400_000 || !source.missingnessReasons.includes("NONE"))
  )) {
    return denied("BI_EXECUTION_SPINE_SOURCE_DENIED");
  }
  if (bundle.questions.some((question) =>
    canonicalJson([...question.queryPlan.capabilitiesDenied].sort())
      !== canonicalJson([...BI_EXECUTION_SPINE_DENIED_CAPABILITIES_V1].sort())
      || question.queryPlan.allowedFields.length === 0
  )) {
    return denied("BI_EXECUTION_SPINE_QUERY_SAFETY_DENIED");
  }
  if (bundle.questions.some((question) => question.executionReceipt.rowCount <= 0)) {
    return denied("BI_EXECUTION_SPINE_RECEIPT_DENIED");
  }
  if (bundle.questions.some((question) =>
    question.verificationReport.outcome !== "VERIFIED"
    || question.verificationReport.sourceLineageComplete !== true
    || question.verificationReport.formulaVerified !== true
    || question.verificationReport.freshness !== "FRESH"
    || question.verificationReport.privacyVerified !== true
    || question.verificationReport.missingnessReasons.length !== 0
    || question.verificationReport.denialReasons.length !== 0
  )) {
    return denied("BI_EXECUTION_SPINE_VERIFICATION_DENIED");
  }
  if (bundle.questions.some((question) => question.intent.tenantBoundary !== "PUBLIC_SYNTHETIC_ONLY")) {
    return denied("BI_EXECUTION_SPINE_TENANT_BOUNDARY_DENIED");
  }
  if (bundle.questions.some((question) =>
    question.claim.outcome !== "ANSWERED"
    || question.claim.nonAuthority !== "NOT_A_DASHBOARD_NOT_PRODUCTION_NOT_SYSTEM_OF_RECORD"
    || question.claim.confidence !== "BOUNDED_SYNTHETIC"
    || /\b(?:authoritative|system of record|production(?:-ready)?|official dashboard)\b/i.test(question.claim.statement)
  )) {
    return denied("BI_EXECUTION_SPINE_CLAIM_DENIED");
  }
  if (bundle.questions.some((question) => question.visualization.unsupportedReason !== null || question.visualization.fields.length === 0)) {
    return denied("BI_EXECUTION_SPINE_VISUALIZATION_DENIED");
  }

  return {
    schemaVersion: BI_EXECUTION_SPINE_DECISION_SCHEMA_V1,
    outcome: "VERIFIED",
    reasonCodes: ["BI_EXECUTION_SPINE_VERIFIED"],
    questionCount: 3,
    claimBoundary: BI_EXECUTION_SPINE_CLAIM_BOUNDARY_V1,
    bundleDigest: bundle.bundleDigest,
  };
}

export function renderPublicBiExecutionSpineDecisionV1(value: unknown): string {
  return canonicalJson(evaluateBiExecutionSpineV1(value));
}
