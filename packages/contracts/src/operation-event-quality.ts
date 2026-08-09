import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const OPERATION_EVENT_QUALITY_SCHEMA_V1 =
  "chimpmaera.cm-obs/operation-event-quality/v1" as const;
export const OPERATION_EVENT_QUALITY_DECISION_SCHEMA_V1 =
  "chimpmaera.cm-obs/operation-event-quality-decision/v1" as const;
export const OPERATION_EVENT_QUALITY_CLAIM_BOUNDARY_V1 =
  "DECLARATIVE_CM_OBS_CONTRACT_ONLY_NO_COLLECTOR_NO_DASHBOARD_AUTHORITY_NO_RUNTIME_ACTIVATION_NO_PRODUCTION_TELEMETRY" as const;

export const OPERATION_EVENT_QUALITY_PROHIBITED_FIELDS_V1 = [
  "collectorUrl", "command", "content", "credential", "email", "hostname",
  "ipAddress", "message", "path", "prompt", "providerKey", "rawPrompt",
  "rawResponse", "secret", "sessionId", "tenantId", "token", "userId",
] as const;

export const OPERATION_EVENT_QUALITY_FIELD_CLASSIFICATIONS_V1 = [
  ["/schemaVersion", "PUBLIC_FIXED"],
  ["/operation/operationId", "PSEUDONYMOUS"],
  ["/operation/runId", "PSEUDONYMOUS"],
  ["/operation/attemptId", "PSEUDONYMOUS"],
  ["/operation/traceId", "PSEUDONYMOUS"],
  ["/operation/correlationId", "PSEUDONYMOUS_NULLABLE"],
  ["/times/eventTimeMs", "POLICY"],
  ["/times/observedTimeMs", "POLICY"],
  ["/times/ingestTimeMs", "POLICY"],
  ["/source/producer", "PUBLIC_FIXED"],
  ["/source/sequence", "PUBLIC_FIXED"],
  ["/source/replayWindowMs", "POLICY"],
  ["/source/eventDigest", "SENSITIVE_DIGEST"],
  ["/source/previousEventDigest", "SENSITIVE_DIGEST_NULLABLE"],
  ["/source/rawEvidenceDigest", "SENSITIVE_DIGEST"],
  ["/source/rawEvidenceRef", "PUBLIC_SYNTHETIC_REFERENCE"],
  ["/source/rawEvidenceClass", "PUBLIC_FIXED"],
  ["/missingness/status", "PUBLIC_FIXED"],
  ["/missingness/reasons", "PUBLIC_FIXED"],
  ["/missingness/expectedAtMs", "POLICY_NULLABLE"],
  ["/quality/state", "PUBLIC_FIXED"],
  ["/quality/purpose", "PUBLIC_FIXED"],
  ["/quality/purposeFit", "POLICY"],
  ["/quality/assessmentKind", "PUBLIC_FIXED"],
  ["/quality/assessmentDigest", "SENSITIVE_DIGEST"],
  ["/retention/classification", "POLICY"],
  ["/retention/retainUntilMs", "POLICY"],
  ["/retention/minimization", "PUBLIC_FIXED"],
  ["/retention/rollbackProfile", "PUBLIC_FIXED"],
  ["/claimBoundary", "PUBLIC_FIXED"],
  ["/recordDigest", "SENSITIVE_DIGEST"],
] as const;

export type OperationEventQualityMissingnessReasonV1 =
  | "EVIDENCE_NOT_PRODUCED"
  | "SOURCE_REDACTED"
  | "LATE_OBSERVED_EVENT"
  | "DIGEST_UNAVAILABLE"
  | "SEQUENCE_GAP"
  | "ASSESSMENT_PENDING";

export type OperationEventQualityReasonCodeV1 =
  | "OBS_RECORD_CONFORMANT"
  | "SCHEMA_DENIED"
  | "PROHIBITED_FIELD_DENIED"
  | "DIGEST_MISMATCH_DENIED"
  | "EVENT_DIGEST_MISMATCH_DENIED"
  | "TIME_ORDER_DENIED"
  | "MISSINGNESS_REASON_DENIED"
  | "LATE_WINDOW_DENIED"
  | "QUALITY_STATE_DENIED"
  | "RAW_EVIDENCE_POLICY_DENIED"
  | "RETENTION_POLICY_DENIED"
  | "APPEND_ONLY_ASSESSMENT_DENIED";

export interface OperationEventQualityRecordV1 {
  readonly schemaVersion: typeof OPERATION_EVENT_QUALITY_SCHEMA_V1;
  readonly operation: {
    readonly operationId: string;
    readonly runId: string;
    readonly attemptId: string;
    readonly traceId: string;
    readonly correlationId: string | null;
  };
  readonly times: {
    readonly eventTimeMs: number;
    readonly observedTimeMs: number;
    readonly ingestTimeMs: number;
  };
  readonly source: {
    readonly producer: "AWI" | "VERIFICATION_FABRIC" | "DEV_WORKER" | "LEARNING_ROUTER" | "BI_PROJECTION" | "CM_OBS_FIXTURE";
    readonly sequence: number;
    readonly replayWindowMs: number;
    readonly eventDigest: string;
    readonly previousEventDigest: string | null;
    readonly rawEvidenceDigest: string;
    readonly rawEvidenceRef: string;
    readonly rawEvidenceClass: "PUBLIC_SYNTHETIC" | "OWNER_PRIVATE_REFERENCE";
  };
  readonly missingness: {
    readonly status: "PRESENT" | "MISSING" | "PROVISIONAL";
    readonly reasons: readonly OperationEventQualityMissingnessReasonV1[];
    readonly expectedAtMs: number | null;
  };
  readonly quality: {
    readonly state: "PASS" | "WARN" | "QUARANTINE" | "BLOCK" | "UNKNOWN";
    readonly purpose: "AWI_JOIN" | "VF_ATTESTATION" | "DEV_WORKER_RECEIPT" | "LR_EPISODE_NORMALIZATION" | "BI_READ_ONLY_PROJECTION";
    readonly purposeFit: boolean;
    readonly assessmentKind: "APPEND_ONLY_ASSESSMENT";
    readonly assessmentDigest: string;
  };
  readonly retention: {
    readonly classification: "PUBLIC_SYNTHETIC" | "OWNER_PRIVATE_DERIVED";
    readonly retainUntilMs: number;
    readonly minimization: "DIGESTS_AND_REASON_CODES_ONLY_NO_RAW_CONTENT";
    readonly rollbackProfile: "DISABLE_OBS_PROJECTION_FAIL_CLOSED";
  };
  readonly claimBoundary: typeof OPERATION_EVENT_QUALITY_CLAIM_BOUNDARY_V1;
  readonly recordDigest: string;
}

export interface OperationEventQualityDecisionV1 {
  readonly schemaVersion: typeof OPERATION_EVENT_QUALITY_DECISION_SCHEMA_V1;
  readonly outcome: "ACCEPTED" | "DENIED";
  readonly reasonCodes: readonly OperationEventQualityReasonCodeV1[];
  readonly claimBoundary: typeof OPERATION_EVENT_QUALITY_CLAIM_BOUNDARY_V1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isIdentifier(value: unknown, prefix: string): value is string {
  return typeof value === "string" && new RegExp(`^${prefix}:[a-z0-9][a-z0-9-]{7,63}$`).test(value);
}

function isTraceId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
}

function uniqueClosedArray(value: unknown, allowed: readonly string[], allowEmpty = false): value is string[] {
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
  const prohibited = new Set(OPERATION_EVENT_QUALITY_PROHIBITED_FIELDS_V1.map(normalizedKey));
  return Object.entries(value).some(([key, nested]) => prohibited.has(normalizedKey(key)) || containsProhibitedField(nested));
}

function validOperation(value: unknown): value is OperationEventQualityRecordV1["operation"] {
  return exactKeys(value, ["operationId", "runId", "attemptId", "traceId", "correlationId"])
    && isIdentifier(value.operationId, "op")
    && isIdentifier(value.runId, "run")
    && isIdentifier(value.attemptId, "attempt")
    && isTraceId(value.traceId)
    && (value.correlationId === null || isIdentifier(value.correlationId, "corr"));
}

function validTimes(value: unknown): value is OperationEventQualityRecordV1["times"] {
  return exactKeys(value, ["eventTimeMs", "observedTimeMs", "ingestTimeMs"])
    && isTimestamp(value.eventTimeMs)
    && isTimestamp(value.observedTimeMs)
    && isTimestamp(value.ingestTimeMs);
}

function validSource(value: unknown): value is OperationEventQualityRecordV1["source"] {
  return exactKeys(value, [
    "producer", "sequence", "replayWindowMs", "eventDigest", "previousEventDigest",
    "rawEvidenceDigest", "rawEvidenceRef", "rawEvidenceClass",
  ])
    && ["AWI", "VERIFICATION_FABRIC", "DEV_WORKER", "LEARNING_ROUTER", "BI_PROJECTION", "CM_OBS_FIXTURE"].includes(value.producer as string)
    && isPositiveInteger(value.sequence)
    && isPositiveInteger(value.replayWindowMs)
    && isDigest(value.eventDigest)
    && (value.previousEventDigest === null || isDigest(value.previousEventDigest))
    && isDigest(value.rawEvidenceDigest)
    && typeof value.rawEvidenceRef === "string"
    && /^obs-fixture:[a-z0-9][a-z0-9-]{7,63}$/.test(value.rawEvidenceRef)
    && ["PUBLIC_SYNTHETIC", "OWNER_PRIVATE_REFERENCE"].includes(value.rawEvidenceClass as string);
}

function validMissingness(value: unknown): value is OperationEventQualityRecordV1["missingness"] {
  const allowed: readonly OperationEventQualityMissingnessReasonV1[] = [
    "EVIDENCE_NOT_PRODUCED", "SOURCE_REDACTED", "LATE_OBSERVED_EVENT",
    "DIGEST_UNAVAILABLE", "SEQUENCE_GAP", "ASSESSMENT_PENDING",
  ];
  return exactKeys(value, ["status", "reasons", "expectedAtMs"])
    && ["PRESENT", "MISSING", "PROVISIONAL"].includes(value.status as string)
    && uniqueClosedArray(value.reasons, allowed, true)
    && (value.expectedAtMs === null || isTimestamp(value.expectedAtMs));
}

function validQuality(value: unknown): value is OperationEventQualityRecordV1["quality"] {
  return exactKeys(value, ["state", "purpose", "purposeFit", "assessmentKind", "assessmentDigest"])
    && ["PASS", "WARN", "QUARANTINE", "BLOCK", "UNKNOWN"].includes(value.state as string)
    && ["AWI_JOIN", "VF_ATTESTATION", "DEV_WORKER_RECEIPT", "LR_EPISODE_NORMALIZATION", "BI_READ_ONLY_PROJECTION"].includes(value.purpose as string)
    && typeof value.purposeFit === "boolean"
    && value.assessmentKind === "APPEND_ONLY_ASSESSMENT"
    && isDigest(value.assessmentDigest);
}

function validRetention(value: unknown): value is OperationEventQualityRecordV1["retention"] {
  return exactKeys(value, ["classification", "retainUntilMs", "minimization", "rollbackProfile"])
    && ["PUBLIC_SYNTHETIC", "OWNER_PRIVATE_DERIVED"].includes(value.classification as string)
    && isTimestamp(value.retainUntilMs)
    && value.minimization === "DIGESTS_AND_REASON_CODES_ONLY_NO_RAW_CONTENT"
    && value.rollbackProfile === "DISABLE_OBS_PROJECTION_FAIL_CLOSED";
}

function validRecord(value: unknown): value is OperationEventQualityRecordV1 {
  return exactKeys(value, [
    "schemaVersion", "operation", "times", "source", "missingness", "quality",
    "retention", "claimBoundary", "recordDigest",
  ])
    && value.schemaVersion === OPERATION_EVENT_QUALITY_SCHEMA_V1
    && validOperation(value.operation)
    && validTimes(value.times)
    && validSource(value.source)
    && validMissingness(value.missingness)
    && validQuality(value.quality)
    && validRetention(value.retention)
    && value.claimBoundary === OPERATION_EVENT_QUALITY_CLAIM_BOUNDARY_V1
    && isDigest(value.recordDigest);
}

function decision(
  outcome: OperationEventQualityDecisionV1["outcome"],
  reasonCodes: OperationEventQualityReasonCodeV1[],
): OperationEventQualityDecisionV1 {
  return {
    schemaVersion: OPERATION_EVENT_QUALITY_DECISION_SCHEMA_V1,
    outcome,
    reasonCodes,
    claimBoundary: OPERATION_EVENT_QUALITY_CLAIM_BOUNDARY_V1,
  };
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function eventDigestInput(value: OperationEventQualityRecordV1): Record<string, unknown> {
  return {
    schemaVersion: value.schemaVersion,
    operation: value.operation,
    times: value.times,
    source: {
      producer: value.source.producer,
      sequence: value.source.sequence,
      replayWindowMs: value.source.replayWindowMs,
      previousEventDigest: value.source.previousEventDigest,
      rawEvidenceDigest: value.source.rawEvidenceDigest,
      rawEvidenceRef: value.source.rawEvidenceRef,
      rawEvidenceClass: value.source.rawEvidenceClass,
    },
    missingness: value.missingness,
    quality: value.quality,
    retention: value.retention,
    claimBoundary: value.claimBoundary,
  };
}

export function operationEventQualityEventDigestV1(value: OperationEventQualityRecordV1): string {
  return digest(eventDigestInput(value));
}

export function operationEventQualityRecordDigestV1(value: Record<string, unknown>): string {
  const unsigned = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "recordDigest"));
  return digest(unsigned);
}

export function evaluateOperationEventQualityV1(value: unknown): OperationEventQualityDecisionV1 {
  if (containsProhibitedField(value)) return decision("DENIED", ["PROHIBITED_FIELD_DENIED"]);
  if (!validRecord(value)) return decision("DENIED", ["SCHEMA_DENIED"]);
  if (operationEventQualityRecordDigestV1(value as unknown as Record<string, unknown>) !== value.recordDigest) {
    return decision("DENIED", ["DIGEST_MISMATCH_DENIED"]);
  }
  if (operationEventQualityEventDigestV1(value) !== value.source.eventDigest) {
    return decision("DENIED", ["EVENT_DIGEST_MISMATCH_DENIED"]);
  }
  if (value.times.eventTimeMs > value.times.observedTimeMs || value.times.observedTimeMs > value.times.ingestTimeMs) {
    return decision("DENIED", ["TIME_ORDER_DENIED"]);
  }
  if (value.retention.retainUntilMs < value.times.ingestTimeMs) {
    return decision("DENIED", ["RETENTION_POLICY_DENIED"]);
  }
  if (value.retention.classification === "PUBLIC_SYNTHETIC"
    && value.source.rawEvidenceClass !== "PUBLIC_SYNTHETIC") {
    return decision("DENIED", ["RAW_EVIDENCE_POLICY_DENIED"]);
  }
  if (value.missingness.status === "PRESENT"
    && (value.missingness.reasons.length !== 0 || value.missingness.expectedAtMs !== null)) {
    return decision("DENIED", ["MISSINGNESS_REASON_DENIED"]);
  }
  if (value.missingness.status !== "PRESENT"
    && (value.missingness.reasons.length === 0 || value.missingness.expectedAtMs === null)) {
    return decision("DENIED", ["MISSINGNESS_REASON_DENIED"]);
  }
  const isLate = value.times.observedTimeMs - value.times.eventTimeMs > value.source.replayWindowMs;
  if (isLate
    && (value.missingness.status !== "PROVISIONAL"
      || !value.missingness.reasons.includes("LATE_OBSERVED_EVENT")
      || !["WARN", "QUARANTINE"].includes(value.quality.state))) {
    return decision("DENIED", ["LATE_WINDOW_DENIED"]);
  }
  if (value.quality.assessmentKind !== "APPEND_ONLY_ASSESSMENT") {
    return decision("DENIED", ["APPEND_ONLY_ASSESSMENT_DENIED"]);
  }
  if ((value.quality.state === "PASS" && (!value.quality.purposeFit || value.missingness.status !== "PRESENT"))
    || (value.quality.state === "BLOCK" && value.quality.purposeFit)
    || (value.quality.state === "UNKNOWN" && value.missingness.status === "PRESENT")) {
    return decision("DENIED", ["QUALITY_STATE_DENIED"]);
  }
  return decision("ACCEPTED", ["OBS_RECORD_CONFORMANT"]);
}

export function renderPublicOperationEventQualityDecisionV1(value: unknown): string {
  return canonicalJson(evaluateOperationEventQualityV1(value));
}
