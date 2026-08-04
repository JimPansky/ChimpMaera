import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const AGENT_WORK_EVENT_SCHEMA_V1 = "chimpmaera.agent-work-intelligence/event-record/v1" as const;
export const AGENT_WORK_EVENT_RESULT_SCHEMA_V1 = "chimpmaera.agent-work-intelligence/event-decision/v1" as const;
export const AGENT_WORK_EVENT_CLAIM_BOUNDARY_V1 =
  "DECLARATIVE_AGENT_WORK_EVENT_CONTRACT_ONLY_NO_COLLECTION_NO_TELEMETRY_NO_TRAINING_NO_PRODUCTION_INGESTION" as const;

export const AGENT_WORK_EVENT_PROHIBITED_FIELDS_V1 = [
  "command", "content", "credential", "email", "hostname", "ipAddress", "jobId", "message",
  "path", "prompt", "response", "secret", "sessionId", "tenantId", "token", "userId",
] as const;

export const AGENT_WORK_EVENT_FIELD_CLASSIFICATIONS_V1 = [
  ["/schemaVersion", "PUBLIC_FIXED"],
  ["/recordId", "PSEUDONYMOUS"],
  ["/lifecycle/state", "POLICY"],
  ["/lifecycle/policy", "POLICY"],
  ["/lifecycle/retainUntilMs", "POLICY"],
  ["/lifecycle/deletionRequestedAtMs", "POLICY"],
  ["/lifecycle/deleteByMs", "POLICY"],
  ["/lifecycle/deletedAtMs", "POLICY"],
  ["/payload/actorPseudonym", "PSEUDONYMOUS"],
  ["/payload/harnessPseudonym", "PSEUDONYMOUS"],
  ["/payload/source/kind", "PUBLIC_FIXED"],
  ["/payload/source/classification", "POLICY"],
  ["/payload/source/digest", "SENSITIVE_DIGEST"],
  ["/payload/event/kind", "PUBLIC_FIXED"],
  ["/payload/event/occurredAtMs", "POLICY"],
  ["/payload/event/outcome", "PUBLIC_FIXED"],
  ["/payload/event/reasonCodes", "PUBLIC_FIXED"],
  ["/payload/event/evidenceDigests", "SENSITIVE_DIGEST"],
  ["/payload/consent/basis", "POLICY"],
  ["/payload/consent/status", "POLICY"],
  ["/payload/consent/purposes", "POLICY"],
  ["/payload/consent/grantedAtMs", "POLICY"],
  ["/payload/consent/expiresAtMs", "POLICY"],
  ["/payload/consent/proofDigest", "SENSITIVE_DIGEST"],
  ["/payload/readback/visibility", "POLICY"],
  ["/tombstone/erasureDigest", "SENSITIVE_DIGEST"],
  ["/tombstone/reason", "PUBLIC_FIXED"],
  ["/claimBoundary", "PUBLIC_FIXED"],
  ["/recordDigest", "SENSITIVE_DIGEST"],
] as const;

export type AgentWorkEventOperationV1 = "VALIDATE" | "OWNER_READBACK" | "PUBLIC_READBACK" | "DELETE_PREVIEW";
export type AgentWorkEventReasonCodeV1 =
  | "RECORD_CONFORMANT"
  | "SCHEMA_DENIED"
  | "PROHIBITED_FIELD_DENIED"
  | "DIGEST_MISMATCH_DENIED"
  | "CONSENT_DENIED"
  | "CONSENT_EXPIRED_DENIED"
  | "RETENTION_POLICY_DENIED"
  | "PUBLIC_FIXTURE_POLICY_DENIED"
  | "READBACK_SCOPE_DENIED"
  | "DELETE_NOT_REQUESTED_DENIED"
  | "RETENTION_EXPIRED_DELETE_REQUIRED"
  | "CONSENT_WITHDRAWN_DELETE_REQUIRED"
  | "DELETION_REQUESTED"
  | "DELETED_RECORD_DENIED"
  | "TOMBSTONE_CONFIRMED";

export interface AgentWorkEventRecordV1 {
  readonly schemaVersion: typeof AGENT_WORK_EVENT_SCHEMA_V1;
  readonly recordId: string;
  readonly lifecycle: {
    readonly state: "ACTIVE" | "DELETION_REQUESTED" | "DELETED_TOMBSTONE";
    readonly policy: "EPHEMERAL_24H" | "BOUNDED_30D" | "BOUNDED_90D";
    readonly retainUntilMs: number;
    readonly deletionRequestedAtMs: number | null;
    readonly deleteByMs: number | null;
    readonly deletedAtMs: number | null;
  };
  readonly payload: {
    readonly actorPseudonym: string;
    readonly harnessPseudonym: string;
    readonly source: {
      readonly kind: "SYNTHETIC_FIXTURE" | "REPOSITORY_DERIVATION" | "TOOL_RECEIPT";
      readonly classification: "PUBLIC_SYNTHETIC" | "OWNER_PRIVATE_DERIVED";
      readonly digest: string;
    };
    readonly event: {
      readonly kind: "PLAN" | "CHANGE" | "TEST" | "REVIEW" | "RELEASE" | "ROLLBACK";
      readonly occurredAtMs: number;
      readonly outcome: "SUCCEEDED" | "FAILED" | "DENIED";
      readonly reasonCodes: readonly ("CHANGE_ACCEPTED" | "TEST_PASSED" | "POLICY_DENIED" | "ROLLBACK_CONFIRMED")[];
      readonly evidenceDigests: readonly string[];
    };
    readonly consent: {
      readonly basis: "SYNTHETIC_FIXTURE" | "EXPLICIT_OPT_IN" | "OWNER_AUTHORIZED_OPERATION";
      readonly status: "GRANTED" | "WITHDRAWN";
      readonly purposes: readonly ("PROCESS_IMPROVEMENT" | "KNOWLEDGE_REUSE" | "ASSURANCE" | "PUBLIC_REPRODUCIBILITY")[];
      readonly grantedAtMs: number;
      readonly expiresAtMs: number;
      readonly proofDigest: string;
    };
    readonly readback: {
      readonly visibility: "OWNER_ONLY" | "PUBLIC_SYNTHETIC";
    };
  } | null;
  readonly tombstone: {
    readonly erasureDigest: string;
    readonly reason: "RETENTION_EXPIRED" | "CONSENT_WITHDRAWN" | "OWNER_REQUEST";
  } | null;
  readonly claimBoundary: typeof AGENT_WORK_EVENT_CLAIM_BOUNDARY_V1;
  readonly recordDigest: string;
}

export interface AgentWorkEventDecisionV1 {
  readonly schemaVersion: typeof AGENT_WORK_EVENT_RESULT_SCHEMA_V1;
  readonly outcome: "ACCEPTED" | "DENIED" | "DELETE_REQUIRED" | "TOMBSTONE_CONFIRMED";
  readonly reasonCodes: readonly AgentWorkEventReasonCodeV1[];
  readonly claimBoundary: typeof AGENT_WORK_EVENT_CLAIM_BOUNDARY_V1;
}

const RETENTION_LIMIT_MS = {
  EPHEMERAL_24H: 86_400_000,
  BOUNDED_30D: 2_592_000_000,
  BOUNDED_90D: 7_776_000_000,
} as const;
const DELETION_SLA_MS = 604_800_000;

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

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isPseudonym(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function uniqueClosedArray(value: unknown, allowed: readonly string[], allowEmpty = false): value is string[] {
  return Array.isArray(value) && (allowEmpty || value.length > 0)
    && value.every((item) => typeof item === "string" && allowed.includes(item))
    && new Set(value).size === value.length;
}

function uniqueDigests(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 16 && value.every(isDigest) && new Set(value).size === value.length;
}

function normalizedKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function containsProhibitedField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsProhibitedField);
  if (!isRecord(value)) return false;
  const prohibited = new Set(AGENT_WORK_EVENT_PROHIBITED_FIELDS_V1.map(normalizedKey));
  return Object.entries(value).some(([key, nested]) => prohibited.has(normalizedKey(key)) || containsProhibitedField(nested));
}

function validLifecycle(value: unknown): value is AgentWorkEventRecordV1["lifecycle"] {
  return exactKeys(value, ["state", "policy", "retainUntilMs", "deletionRequestedAtMs", "deleteByMs", "deletedAtMs"])
    && ["ACTIVE", "DELETION_REQUESTED", "DELETED_TOMBSTONE"].includes(value.state as string)
    && ["EPHEMERAL_24H", "BOUNDED_30D", "BOUNDED_90D"].includes(value.policy as string)
    && isTimestamp(value.retainUntilMs)
    && (value.deletionRequestedAtMs === null || isTimestamp(value.deletionRequestedAtMs))
    && (value.deleteByMs === null || isTimestamp(value.deleteByMs))
    && (value.deletedAtMs === null || isTimestamp(value.deletedAtMs));
}

function validSource(value: unknown): value is NonNullable<AgentWorkEventRecordV1["payload"]>["source"] {
  return exactKeys(value, ["kind", "classification", "digest"])
    && ["SYNTHETIC_FIXTURE", "REPOSITORY_DERIVATION", "TOOL_RECEIPT"].includes(value.kind as string)
    && ["PUBLIC_SYNTHETIC", "OWNER_PRIVATE_DERIVED"].includes(value.classification as string)
    && isDigest(value.digest);
}

function validEvent(value: unknown): value is NonNullable<AgentWorkEventRecordV1["payload"]>["event"] {
  return exactKeys(value, ["kind", "occurredAtMs", "outcome", "reasonCodes", "evidenceDigests"])
    && ["PLAN", "CHANGE", "TEST", "REVIEW", "RELEASE", "ROLLBACK"].includes(value.kind as string)
    && isTimestamp(value.occurredAtMs) && ["SUCCEEDED", "FAILED", "DENIED"].includes(value.outcome as string)
    && uniqueClosedArray(value.reasonCodes, ["CHANGE_ACCEPTED", "TEST_PASSED", "POLICY_DENIED", "ROLLBACK_CONFIRMED"])
    && uniqueDigests(value.evidenceDigests);
}

function validConsent(value: unknown): value is NonNullable<AgentWorkEventRecordV1["payload"]>["consent"] {
  return exactKeys(value, ["basis", "status", "purposes", "grantedAtMs", "expiresAtMs", "proofDigest"])
    && ["SYNTHETIC_FIXTURE", "EXPLICIT_OPT_IN", "OWNER_AUTHORIZED_OPERATION"].includes(value.basis as string)
    && ["GRANTED", "WITHDRAWN"].includes(value.status as string)
    && uniqueClosedArray(value.purposes, ["PROCESS_IMPROVEMENT", "KNOWLEDGE_REUSE", "ASSURANCE", "PUBLIC_REPRODUCIBILITY"])
    && isTimestamp(value.grantedAtMs) && isTimestamp(value.expiresAtMs) && isDigest(value.proofDigest);
}

function validPayload(value: unknown): value is NonNullable<AgentWorkEventRecordV1["payload"]> {
  return exactKeys(value, ["actorPseudonym", "harnessPseudonym", "source", "event", "consent", "readback"])
    && isPseudonym(value.actorPseudonym) && isPseudonym(value.harnessPseudonym)
    && validSource(value.source) && validEvent(value.event) && validConsent(value.consent)
    && exactKeys(value.readback, ["visibility"])
    && ["OWNER_ONLY", "PUBLIC_SYNTHETIC"].includes(value.readback.visibility as string);
}

function validTombstone(value: unknown): value is NonNullable<AgentWorkEventRecordV1["tombstone"]> {
  return exactKeys(value, ["erasureDigest", "reason"]) && isDigest(value.erasureDigest)
    && ["RETENTION_EXPIRED", "CONSENT_WITHDRAWN", "OWNER_REQUEST"].includes(value.reason as string);
}

function validRecord(value: unknown): value is AgentWorkEventRecordV1 {
  if (!exactKeys(value, ["schemaVersion", "recordId", "lifecycle", "payload", "tombstone", "claimBoundary", "recordDigest"])) return false;
  if (value.schemaVersion !== AGENT_WORK_EVENT_SCHEMA_V1
    || typeof value.recordId !== "string" || !/^awi-record:[a-z0-9][a-z0-9-]{7,63}$/.test(value.recordId)
    || !validLifecycle(value.lifecycle) || !isDigest(value.recordDigest)
    || value.claimBoundary !== AGENT_WORK_EVENT_CLAIM_BOUNDARY_V1) return false;
  if (value.lifecycle.state === "ACTIVE") {
    return validPayload(value.payload) && value.tombstone === null
      && value.lifecycle.deletionRequestedAtMs === null && value.lifecycle.deleteByMs === null
      && value.lifecycle.deletedAtMs === null;
  }
  if (value.lifecycle.state === "DELETION_REQUESTED") {
    return validPayload(value.payload) && value.tombstone === null
      && isTimestamp(value.lifecycle.deletionRequestedAtMs) && isTimestamp(value.lifecycle.deleteByMs)
      && value.lifecycle.deletedAtMs === null;
  }
  return value.payload === null && validTombstone(value.tombstone)
    && isTimestamp(value.lifecycle.deletionRequestedAtMs) && isTimestamp(value.lifecycle.deleteByMs)
    && isTimestamp(value.lifecycle.deletedAtMs);
}

function decision(outcome: AgentWorkEventDecisionV1["outcome"], reasonCodes: AgentWorkEventReasonCodeV1[]): AgentWorkEventDecisionV1 {
  return { schemaVersion: AGENT_WORK_EVENT_RESULT_SCHEMA_V1, outcome, reasonCodes, claimBoundary: AGENT_WORK_EVENT_CLAIM_BOUNDARY_V1 };
}

export function agentWorkEventRecordDigestV1(value: Record<string, unknown>): string {
  const unsigned = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "recordDigest"));
  return createHash("sha256").update(canonicalJson(unsigned)).digest("hex");
}

export function evaluateAgentWorkEventV1(
  value: unknown,
  operation: AgentWorkEventOperationV1,
  evaluatedAtMs: number,
): AgentWorkEventDecisionV1 {
  if (containsProhibitedField(value)) return decision("DENIED", ["PROHIBITED_FIELD_DENIED"]);
  if (!validRecord(value) || !["VALIDATE", "OWNER_READBACK", "PUBLIC_READBACK", "DELETE_PREVIEW"].includes(operation)
    || !isTimestamp(evaluatedAtMs)) return decision("DENIED", ["SCHEMA_DENIED"]);
  if (agentWorkEventRecordDigestV1(value as unknown as Record<string, unknown>) !== value.recordDigest) {
    return decision("DENIED", ["DIGEST_MISMATCH_DENIED"]);
  }

  const lifecycle = value.lifecycle;
  if (lifecycle.deletionRequestedAtMs !== null && lifecycle.deleteByMs !== null
    && (lifecycle.deleteByMs < lifecycle.deletionRequestedAtMs
      || lifecycle.deleteByMs - lifecycle.deletionRequestedAtMs > DELETION_SLA_MS)) {
    return decision("DENIED", ["RETENTION_POLICY_DENIED"]);
  }
  if (lifecycle.state === "DELETED_TOMBSTONE") {
    if ((lifecycle.deletedAtMs as number) < (lifecycle.deletionRequestedAtMs as number)
      || (lifecycle.deletedAtMs as number) > evaluatedAtMs) return decision("DENIED", ["RETENTION_POLICY_DENIED"]);
    return operation === "OWNER_READBACK" || operation === "PUBLIC_READBACK"
      ? decision("DENIED", ["DELETED_RECORD_DENIED"])
      : decision("TOMBSTONE_CONFIRMED", ["TOMBSTONE_CONFIRMED"]);
  }

  const payload = value.payload as NonNullable<AgentWorkEventRecordV1["payload"]>;
  const consent = payload.consent;
  if (consent.expiresAtMs <= consent.grantedAtMs || payload.event.occurredAtMs < consent.grantedAtMs
    || lifecycle.retainUntilMs < payload.event.occurredAtMs
    || lifecycle.retainUntilMs > consent.expiresAtMs
    || lifecycle.retainUntilMs - payload.event.occurredAtMs > RETENTION_LIMIT_MS[lifecycle.policy]) {
    return decision("DENIED", ["RETENTION_POLICY_DENIED"]);
  }
  if (consent.status === "WITHDRAWN") return decision("DELETE_REQUIRED", ["CONSENT_WITHDRAWN_DELETE_REQUIRED"]);
  if (payload.event.occurredAtMs > consent.expiresAtMs || evaluatedAtMs > consent.expiresAtMs) {
    return decision("DENIED", ["CONSENT_EXPIRED_DENIED"]);
  }
  if (consent.purposes.length === 0) return decision("DENIED", ["CONSENT_DENIED"]);
  if (payload.source.classification === "PUBLIC_SYNTHETIC"
    && (payload.source.kind !== "SYNTHETIC_FIXTURE" || consent.basis !== "SYNTHETIC_FIXTURE"
      || !consent.purposes.includes("PUBLIC_REPRODUCIBILITY") || payload.readback.visibility !== "PUBLIC_SYNTHETIC")) {
    return decision("DENIED", ["PUBLIC_FIXTURE_POLICY_DENIED"]);
  }
  if (operation === "PUBLIC_READBACK"
    && (payload.source.classification !== "PUBLIC_SYNTHETIC" || payload.readback.visibility !== "PUBLIC_SYNTHETIC")) {
    return decision("DENIED", ["READBACK_SCOPE_DENIED"]);
  }
  if (lifecycle.state === "DELETION_REQUESTED") return decision("DELETE_REQUIRED", ["DELETION_REQUESTED"]);
  if (operation === "DELETE_PREVIEW") return decision("DENIED", ["DELETE_NOT_REQUESTED_DENIED"]);
  if (evaluatedAtMs > lifecycle.retainUntilMs) return decision("DELETE_REQUIRED", ["RETENTION_EXPIRED_DELETE_REQUIRED"]);
  return decision("ACCEPTED", ["RECORD_CONFORMANT"]);
}

export function renderPublicAgentWorkEventDecisionV1(
  value: unknown,
  evaluatedAtMs: number,
): string {
  return canonicalJson(evaluateAgentWorkEventV1(value, "PUBLIC_READBACK", evaluatedAtMs));
}
