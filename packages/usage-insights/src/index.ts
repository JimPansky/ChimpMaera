import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { request } from "node:http";
import { dirname, resolve } from "node:path";
import { isProxy } from "node:util/types";

import { canonicalJson } from "../../contracts/src/canonical-json.js";
import {
  USAGE_INSIGHTS_CAPABILITY_IDS_V1,
  USAGE_INSIGHTS_EVENT_SCHEMA_V1,
  USAGE_INSIGHTS_LIFECYCLE_OUTCOMES_V1,
  USAGE_INSIGHTS_PRODUCT_IDS_V1,
  USAGE_INSIGHTS_PRODUCT_VERSION_V1,
  USAGE_INSIGHTS_SMALL_CELL_THRESHOLD,
  UsageInsightsRuntimeV1,
  type UsageInsightsEventRecordV1,
  type UsageInsightsRuntimeSnapshotV1,
  verifyUsageInsightsEventV1,
} from "../../contracts/src/usage-insights.js";

export const USAGE_INSIGHTS_LOCAL_STATE_SCHEMA_V1 = "chimpmaera.usage-insights/local-state/v1" as const;
export const USAGE_INSIGHTS_CONSENT_SCHEMA_V1 = "chimpmaera.usage-insights/consent/v1" as const;
export const USAGE_INSIGHTS_SHARE_SCHEMA_V1 = "chimpmaera.usage-insights/share-envelope/v1" as const;
export const USAGE_INSIGHTS_RECEIVER_ACK_SCHEMA_V1 = "chimpmaera.usage-insights/receiver-ack/v1" as const;
export const USAGE_INSIGHTS_LOCAL_PREVIEW_SCHEMA_V1 = "chimpmaera.usage-insights/local-preview/v1" as const;
export const USAGE_INSIGHTS_LOCAL_EXPORT_SCHEMA_V1 = "chimpmaera.usage-insights/local-export/v1" as const;
export const USAGE_INSIGHTS_REPORT_SCHEMA_V1 = "chimpmaera.usage-insights/report/v1" as const;
export const USAGE_INSIGHTS_SHARE_RECEIPT_SCHEMA_V1 = "chimpmaera.usage-insights/share-receipt/v1" as const;
export const USAGE_INSIGHTS_DELETE_RECEIPT_SCHEMA_V1 = "chimpmaera.usage-insights/delete-receipt/v1" as const;
export const USAGE_INSIGHTS_COMPLETION_BOUNDARY_V1 =
  "DEFAULT_OFF_LOCAL_ONLY_UNLESS_EXPLICIT_LOOPBACK_OPT_IN_SYNTHETIC_REFERENCE_NO_PRODUCTION" as const;

export const USAGE_INSIGHTS_CONSENT_PROFILES_V1 = ["basic", "capability", "diagnostics"] as const;
export type UsageInsightsConsentProfileV1 = (typeof USAGE_INSIGHTS_CONSENT_PROFILES_V1)[number];
export type UsageInsightsConsentStateV1 = "DISABLED" | "GRANTED" | "REVOKED";

export const USAGE_INSIGHTS_DIAGNOSTICS_MAX_TTL_MS = 86_400_000 as const;
export const USAGE_INSIGHTS_RETENTION_INTERVAL_MS = 3_600_000 as const;
export const USAGE_INSIGHTS_MAX_SHARED_BATCHES = 128 as const;
export const USAGE_INSIGHTS_MAX_STORE_BYTES = 4_194_304 as const;

const STORE_FILE_MODE = 0o600;
const MAX_RESPONSE_BYTES = 4_096;
const MAX_SAFE_STRING = 1_024;
const MAX_SAFE_ARRAY = 4_096;
const MAX_SAFE_KEYS = 32;
const MAX_SAFE_DEPTH = 9;
const MAX_SAFE_OBJECTS = 8_512;
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const DELETE_ID_PATTERN = /^delete:v1:[a-f0-9]{64}$/;
const EVENT_ID_PATTERN = /^event:v1:[a-f0-9]{64}$/;
const INSTALLATION_ID_PATTERN = /^sha256:[a-f0-9]{64}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const LOOPBACK_ENDPOINT_PATTERN = /^http:\/\/(?:127\.0\.0\.1|\[::1\]):([1-9][0-9]{0,4})\/v1\/usage-insights$/;

const BASIC_OUTCOMES = new Set([
  "INSTALL_STARTED", "INSTALL_SUCCEEDED", "INSTALL_FAILED",
  "UPGRADE_STARTED", "UPGRADE_SUCCEEDED", "UPGRADE_FAILED", "UNINSTALLED",
]);
const CAPABILITY_OUTCOMES = new Set([...BASIC_OUTCOMES, "FIRST_SUCCESS", "RUNNING", "STOPPED"]);
const DIAGNOSTICS_OUTCOMES = new Set([
  ...CAPABILITY_OUTCOMES, "ERROR", "DENIED", "ROLLBACK_SUCCEEDED", "ROLLBACK_FAILED",
]);

interface SafeContext {
  readonly seen: Set<object>;
  objects: number;
}

function failBoundary(code: string): never {
  throw new TypeError(code);
}

function safeClone(
  value: unknown,
  context: SafeContext = { seen: new Set(), objects: 0 },
  depth = 0,
): unknown {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.length > MAX_SAFE_STRING) failBoundary("USAGE_INSIGHTS_UNSAFE_STRUCTURE");
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) failBoundary("USAGE_INSIGHTS_UNSAFE_STRUCTURE");
    return value;
  }
  if (typeof value !== "object" || depth > MAX_SAFE_DEPTH) {
    return failBoundary("USAGE_INSIGHTS_UNSAFE_STRUCTURE");
  }
  if (isProxy(value)) failBoundary("USAGE_INSIGHTS_UNSAFE_STRUCTURE");
  if (context.seen.has(value)) failBoundary("USAGE_INSIGHTS_UNSAFE_STRUCTURE");
  context.seen.add(value);
  context.objects += 1;
  if (context.objects > MAX_SAFE_OBJECTS) failBoundary("USAGE_INSIGHTS_UNSAFE_STRUCTURE");

  const isArray = Array.isArray(value);
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
    keys = Reflect.ownKeys(value);
  } catch {
    return failBoundary("USAGE_INSIGHTS_UNSAFE_STRUCTURE");
  }
  if (prototype !== (isArray ? Array.prototype : Object.prototype)) {
    failBoundary("USAGE_INSIGHTS_UNSAFE_STRUCTURE");
  }
  if (!isArray && keys.length > MAX_SAFE_KEYS) failBoundary("USAGE_INSIGHTS_UNSAFE_STRUCTURE");

  const descriptors = new Map<string, PropertyDescriptor>();
  for (const key of keys) {
    if (typeof key !== "string" || DANGEROUS_KEYS.has(key) || key.length > 128) {
      failBoundary("USAGE_INSIGHTS_UNSAFE_STRUCTURE");
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    } catch {
      return failBoundary("USAGE_INSIGHTS_UNSAFE_STRUCTURE");
    }
    if (descriptor === undefined || !("value" in descriptor)) failBoundary("USAGE_INSIGHTS_UNSAFE_STRUCTURE");
    if ((!isArray || key !== "length") && descriptor.enumerable !== true) {
      failBoundary("USAGE_INSIGHTS_UNSAFE_STRUCTURE");
    }
    descriptors.set(key, descriptor);
  }

  if (isArray) {
    const length = descriptors.get("length")?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_SAFE_ARRAY || keys.length !== length + 1) {
      failBoundary("USAGE_INSIGHTS_UNSAFE_STRUCTURE");
    }
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors.get(String(index));
      if (descriptor === undefined) failBoundary("USAGE_INSIGHTS_UNSAFE_STRUCTURE");
      result.push(safeClone(descriptor.value, context, depth + 1));
    }
    return result;
  }

  const result: Record<string, unknown> = {};
  for (const [key, descriptor] of descriptors) {
    result[key] = safeClone(descriptor.value, context, depth + 1);
  }
  return result;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function isTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function digestExcluding(value: Record<string, unknown>, excluded: string): string {
  const unsigned: Record<string, unknown> = {};
  for (const key of Object.keys(value)) if (key !== excluded) unsigned[key] = value[key];
  return createHash("sha256").update(canonicalJson(unsigned), "utf8").digest("hex");
}

function newDeleteId(): string {
  return `delete:v1:${randomBytes(32).toString("hex")}`;
}

function profileAllows(profile: UsageInsightsConsentProfileV1, outcome: string): boolean {
  if (profile === "basic") return BASIC_OUTCOMES.has(outcome);
  if (profile === "capability") return CAPABILITY_OUTCOMES.has(outcome);
  return DIAGNOSTICS_OUTCOMES.has(outcome);
}

function validProfile(value: unknown): value is UsageInsightsConsentProfileV1 {
  return (USAGE_INSIGHTS_CONSENT_PROFILES_V1 as readonly unknown[]).includes(value);
}

export interface UsageInsightsConsentV1 {
  readonly schemaVersion: typeof USAGE_INSIGHTS_CONSENT_SCHEMA_V1;
  readonly state: UsageInsightsConsentStateV1;
  readonly profile: UsageInsightsConsentProfileV1 | null;
  readonly grantedAtMs: number | null;
  readonly expiresAtMs: number | null;
  readonly revokedAtMs: number | null;
  readonly sharingEnabled: boolean;
  readonly endpoint: string | null;
}

export interface UsageInsightsShareEnvelopeV1 {
  readonly schemaVersion: typeof USAGE_INSIGHTS_SHARE_SCHEMA_V1;
  readonly profile: UsageInsightsConsentProfileV1;
  readonly deletionId: string;
  readonly sharedAtMs: number;
  readonly events: readonly UsageInsightsEventRecordV1[];
  readonly claimBoundary: typeof USAGE_INSIGHTS_COMPLETION_BOUNDARY_V1;
  readonly envelopeDigest: string;
}

interface PendingShareV1 {
  readonly endpoint: string;
  readonly envelope: UsageInsightsShareEnvelopeV1;
}

interface SharedBatchReceiptV1 {
  readonly endpoint: string;
  readonly deletionId: string;
  readonly sharedAtMs: number;
  readonly eventCount: number;
}

interface StoredStateV1 {
  readonly schemaVersion: typeof USAGE_INSIGHTS_LOCAL_STATE_SCHEMA_V1;
  readonly consent: UsageInsightsConsentV1;
  readonly runtimeSnapshot: UsageInsightsRuntimeSnapshotV1;
  readonly pendingShare: PendingShareV1 | null;
  readonly sharedBatches: readonly SharedBatchReceiptV1[];
  readonly savedAtMs: number;
  readonly claimBoundary: typeof USAGE_INSIGHTS_COMPLETION_BOUNDARY_V1;
  readonly stateDigest: string;
}

function copyConsent(consent: UsageInsightsConsentV1): UsageInsightsConsentV1 {
  return { ...consent };
}

export function validateUsageInsightsLoopbackEndpointV1(value: unknown): string {
  if (typeof value !== "string" || value.length > 128) throw new TypeError("LOOPBACK_ENDPOINT_DENIED");
  const match = LOOPBACK_ENDPOINT_PATTERN.exec(value);
  if (match === null) throw new TypeError("LOOPBACK_ENDPOINT_DENIED");
  const port = Number(match[1]);
  if (!Number.isInteger(port) || port < 1_024 || port > 65_535) throw new TypeError("LOOPBACK_ENDPOINT_DENIED");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError("LOOPBACK_ENDPOINT_DENIED");
  }
  if (parsed.protocol !== "http:" || parsed.username !== "" || parsed.password !== ""
    || parsed.search !== "" || parsed.hash !== "" || parsed.pathname !== "/v1/usage-insights") {
    throw new TypeError("LOOPBACK_ENDPOINT_DENIED");
  }
  return value;
}

function validateEventRecord(value: unknown): UsageInsightsEventRecordV1 {
  const cloned = safeClone(value);
  const record = recordOf(cloned);
  if (record === null || !exactKeys(record, [
    "schemaVersion", "eventId", "installationId", "productId", "capabilityId",
    "productVersion", "lifecycleOutcome", "occurredAtMs", "eventDigest",
  ])) throw new TypeError("OUTBOUND_EVENT_DENIED");
  if (record.schemaVersion !== USAGE_INSIGHTS_EVENT_SCHEMA_V1
    || typeof record.eventId !== "string" || !EVENT_ID_PATTERN.test(record.eventId)
    || typeof record.installationId !== "string" || !INSTALLATION_ID_PATTERN.test(record.installationId)
    || !(USAGE_INSIGHTS_PRODUCT_IDS_V1 as readonly unknown[]).includes(record.productId)
    || !(USAGE_INSIGHTS_CAPABILITY_IDS_V1 as readonly unknown[]).includes(record.capabilityId)
    || record.productVersion !== USAGE_INSIGHTS_PRODUCT_VERSION_V1
    || !(USAGE_INSIGHTS_LIFECYCLE_OUTCOMES_V1 as readonly unknown[]).includes(record.lifecycleOutcome)
    || !isTimestamp(record.occurredAtMs)
    || typeof record.eventDigest !== "string" || !DIGEST_PATTERN.test(record.eventDigest)
    || verifyUsageInsightsEventV1(record).outcome !== "ACCEPTED") {
    throw new TypeError("OUTBOUND_EVENT_DENIED");
  }
  return record as unknown as UsageInsightsEventRecordV1;
}

export function validateUsageInsightsShareEnvelopeV1(value: unknown): UsageInsightsShareEnvelopeV1 {
  let prepared: unknown;
  try {
    prepared = safeClone(value);
  } catch {
    throw new TypeError("OUTBOUND_ENVELOPE_DENIED");
  }
  const record = recordOf(prepared);
  if (record === null || !exactKeys(record, [
    "schemaVersion", "profile", "deletionId", "sharedAtMs", "events", "claimBoundary", "envelopeDigest",
  ])
    || record.schemaVersion !== USAGE_INSIGHTS_SHARE_SCHEMA_V1
    || !validProfile(record.profile)
    || typeof record.deletionId !== "string" || !DELETE_ID_PATTERN.test(record.deletionId)
    || !isTimestamp(record.sharedAtMs)
    || !Array.isArray(record.events) || record.events.length === 0 || record.events.length > MAX_SAFE_ARRAY
    || record.claimBoundary !== USAGE_INSIGHTS_COMPLETION_BOUNDARY_V1
    || typeof record.envelopeDigest !== "string" || !DIGEST_PATTERN.test(record.envelopeDigest)
    || digestExcluding(record, "envelopeDigest") !== record.envelopeDigest) {
    throw new TypeError("OUTBOUND_ENVELOPE_DENIED");
  }

  const events = record.events.map(validateEventRecord);
  const eventIds = new Set<string>();
  const installationIds = new Set<string>();
  for (const event of events) {
    if (!profileAllows(record.profile, event.lifecycleOutcome)
      || event.occurredAtMs > record.sharedAtMs || eventIds.has(event.eventId)) {
      throw new TypeError("OUTBOUND_ENVELOPE_DENIED");
    }
    eventIds.add(event.eventId);
    installationIds.add(event.installationId);
  }
  if (installationIds.size !== 1) throw new TypeError("OUTBOUND_ENVELOPE_DENIED");
  return {
    schemaVersion: USAGE_INSIGHTS_SHARE_SCHEMA_V1,
    profile: record.profile,
    deletionId: record.deletionId,
    sharedAtMs: record.sharedAtMs,
    events,
    claimBoundary: USAGE_INSIGHTS_COMPLETION_BOUNDARY_V1,
    envelopeDigest: record.envelopeDigest,
  };
}

function makeEnvelope(
  profile: UsageInsightsConsentProfileV1,
  deletionId: string,
  sharedAtMs: number,
  events: readonly UsageInsightsEventRecordV1[],
): UsageInsightsShareEnvelopeV1 {
  const value = {
    schemaVersion: USAGE_INSIGHTS_SHARE_SCHEMA_V1,
    profile,
    deletionId,
    sharedAtMs,
    events: events.map((event) => ({ ...event })),
    claimBoundary: USAGE_INSIGHTS_COMPLETION_BOUNDARY_V1,
    envelopeDigest: "",
  };
  return { ...value, envelopeDigest: digestExcluding(value, "envelopeDigest") };
}

function defaultConsent(): UsageInsightsConsentV1 {
  return {
    schemaVersion: USAGE_INSIGHTS_CONSENT_SCHEMA_V1,
    state: "DISABLED",
    profile: null,
    grantedAtMs: null,
    expiresAtMs: null,
    revokedAtMs: null,
    sharingEnabled: false,
    endpoint: null,
  };
}

function validateConsent(value: unknown): UsageInsightsConsentV1 {
  const record = recordOf(value);
  if (record === null || !exactKeys(record, [
    "schemaVersion", "state", "profile", "grantedAtMs", "expiresAtMs", "revokedAtMs",
    "sharingEnabled", "endpoint",
  ])
    || record.schemaVersion !== USAGE_INSIGHTS_CONSENT_SCHEMA_V1
    || !["DISABLED", "GRANTED", "REVOKED"].includes(record.state as string)
    || (record.profile !== null && !validProfile(record.profile))
    || (record.grantedAtMs !== null && !isTimestamp(record.grantedAtMs))
    || (record.expiresAtMs !== null && !isTimestamp(record.expiresAtMs))
    || (record.revokedAtMs !== null && !isTimestamp(record.revokedAtMs))
    || typeof record.sharingEnabled !== "boolean"
    || (record.endpoint !== null && typeof record.endpoint !== "string")) {
    throw new TypeError("INVALID_USAGE_INSIGHTS_LOCAL_STATE");
  }
  const consent = record as unknown as UsageInsightsConsentV1;
  if (consent.state === "DISABLED" && (consent.profile !== null || consent.grantedAtMs !== null
      || consent.expiresAtMs !== null || consent.revokedAtMs !== null || consent.sharingEnabled || consent.endpoint !== null)) {
    throw new TypeError("INVALID_USAGE_INSIGHTS_LOCAL_STATE");
  }
  if (consent.state === "GRANTED" && (consent.profile === null || consent.grantedAtMs === null
      || consent.revokedAtMs !== null || (consent.sharingEnabled !== (consent.endpoint !== null)))) {
    throw new TypeError("INVALID_USAGE_INSIGHTS_LOCAL_STATE");
  }
  if (consent.state === "REVOKED" && (consent.profile === null || consent.grantedAtMs === null
      || consent.revokedAtMs === null || consent.sharingEnabled || consent.endpoint !== null)) {
    throw new TypeError("INVALID_USAGE_INSIGHTS_LOCAL_STATE");
  }
  if (consent.profile === "diagnostics") {
    if (consent.expiresAtMs === null || consent.grantedAtMs === null
      || consent.expiresAtMs <= consent.grantedAtMs
      || consent.expiresAtMs - consent.grantedAtMs > USAGE_INSIGHTS_DIAGNOSTICS_MAX_TTL_MS) {
      throw new TypeError("INVALID_USAGE_INSIGHTS_LOCAL_STATE");
    }
  } else if (consent.expiresAtMs !== null) {
    throw new TypeError("INVALID_USAGE_INSIGHTS_LOCAL_STATE");
  }
  if (consent.endpoint !== null) validateUsageInsightsLoopbackEndpointV1(consent.endpoint);
  return { ...consent };
}

function validatePending(value: unknown): PendingShareV1 | null {
  if (value === null) return null;
  const record = recordOf(value);
  if (record === null || !exactKeys(record, ["endpoint", "envelope"]) || typeof record.endpoint !== "string") {
    throw new TypeError("INVALID_USAGE_INSIGHTS_LOCAL_STATE");
  }
  return {
    endpoint: validateUsageInsightsLoopbackEndpointV1(record.endpoint),
    envelope: validateUsageInsightsShareEnvelopeV1(record.envelope),
  };
}

function validateReceipt(value: unknown): SharedBatchReceiptV1 {
  const record = recordOf(value);
  if (record === null || !exactKeys(record, ["endpoint", "deletionId", "sharedAtMs", "eventCount"])
    || typeof record.endpoint !== "string"
    || typeof record.deletionId !== "string" || !DELETE_ID_PATTERN.test(record.deletionId)
    || !isTimestamp(record.sharedAtMs)
    || !Number.isSafeInteger(record.eventCount) || (record.eventCount as number) < 1
    || (record.eventCount as number) > MAX_SAFE_ARRAY) {
    throw new TypeError("INVALID_USAGE_INSIGHTS_LOCAL_STATE");
  }
  return {
    endpoint: validateUsageInsightsLoopbackEndpointV1(record.endpoint),
    deletionId: record.deletionId,
    sharedAtMs: record.sharedAtMs,
    eventCount: record.eventCount as number,
  };
}

function readStoredState(path: string, nowMs: number): {
  consent: UsageInsightsConsentV1;
  runtime: UsageInsightsRuntimeV1;
  pendingShare: PendingShareV1 | null;
  sharedBatches: SharedBatchReceiptV1[];
} {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.size > USAGE_INSIGHTS_MAX_STORE_BYTES) {
    throw new TypeError("USAGE_INSIGHTS_STORE_SECURITY_DENIED");
  }
  const text = readFileSync(path, "utf8");
  if (Buffer.byteLength(text, "utf8") > USAGE_INSIGHTS_MAX_STORE_BYTES) {
    throw new TypeError("USAGE_INSIGHTS_STORE_SECURITY_DENIED");
  }
  let parsed: unknown;
  try {
    parsed = safeClone(JSON.parse(text) as unknown);
  } catch {
    throw new TypeError("INVALID_USAGE_INSIGHTS_LOCAL_STATE");
  }
  const record = recordOf(parsed);
  if (record === null || !exactKeys(record, [
    "schemaVersion", "consent", "runtimeSnapshot", "pendingShare", "sharedBatches",
    "savedAtMs", "claimBoundary", "stateDigest",
  ])
    || record.schemaVersion !== USAGE_INSIGHTS_LOCAL_STATE_SCHEMA_V1
    || !isTimestamp(record.savedAtMs) || record.savedAtMs > nowMs
    || record.claimBoundary !== USAGE_INSIGHTS_COMPLETION_BOUNDARY_V1
    || typeof record.stateDigest !== "string" || !DIGEST_PATTERN.test(record.stateDigest)
    || digestExcluding(record, "stateDigest") !== record.stateDigest
    || !Array.isArray(record.sharedBatches) || record.sharedBatches.length > USAGE_INSIGHTS_MAX_SHARED_BATCHES) {
    throw new TypeError("INVALID_USAGE_INSIGHTS_LOCAL_STATE");
  }
  const consent = validateConsent(record.consent);
  const runtime = UsageInsightsRuntimeV1.restore(record.runtimeSnapshot, nowMs);
  const runtimeStatus = runtime.status(nowMs);
  if ((consent.state === "DISABLED" && runtimeStatus.state !== "DISABLED")
    || (consent.state === "GRANTED" && runtimeStatus.state !== "ENABLED")
    || (consent.state === "REVOKED" && !["REVOKED", "DELETED"].includes(runtimeStatus.state))) {
    throw new TypeError("INVALID_USAGE_INSIGHTS_LOCAL_STATE");
  }
  const pendingShare = validatePending(record.pendingShare);
  const sharedBatches = record.sharedBatches.map(validateReceipt);
  const deletionIds = [
    ...sharedBatches.map((batch) => batch.deletionId),
    ...(pendingShare === null ? [] : [pendingShare.envelope.deletionId]),
  ];
  if (new Set(deletionIds).size !== deletionIds.length) throw new TypeError("INVALID_USAGE_INSIGHTS_LOCAL_STATE");
  return { consent, runtime, pendingShare, sharedBatches };
}

function secureParent(path: string): void {
  const parent = dirname(path);
  const stat = lstatSync(parent);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(parent) !== parent) {
    throw new TypeError("USAGE_INSIGHTS_STORE_SECURITY_DENIED");
  }
}

function writeStoredState(path: string, value: StoredStateV1): void {
  secureParent(path);
  if (existsSync(path)) {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) {
      throw new TypeError("USAGE_INSIGHTS_STORE_SECURITY_DENIED");
    }
  }
  const payload = `${canonicalJson(value)}\n`;
  if (Buffer.byteLength(payload, "utf8") > USAGE_INSIGHTS_MAX_STORE_BYTES) {
    throw new TypeError("USAGE_INSIGHTS_STORE_CAPACITY_DENIED");
  }
  const temporary = `${path}.tmp-${randomBytes(8).toString("hex")}`;
  let descriptor: number | null = null;
  try {
    descriptor = openSync(temporary, "wx", STORE_FILE_MODE);
    writeFileSync(descriptor, payload, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    renameSync(temporary, path);
    const directoryDescriptor = openSync(dirname(path), "r");
    try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
  } catch (error) {
    if (descriptor !== null) closeSync(descriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
    throw error;
  }
}

export interface UsageInsightsTransportV1 {
  share(endpoint: string, envelope: UsageInsightsShareEnvelopeV1): Promise<void>;
  delete(endpoint: string, deletionId: string): Promise<void>;
}

function requestLoopback(
  endpoint: string,
  method: "POST" | "DELETE",
  deletionId: string | null,
  body: string | null,
): Promise<{ statusCode: number; body: string }> {
  const safeEndpoint = validateUsageInsightsLoopbackEndpointV1(endpoint);
  const parsed = new URL(safeEndpoint);
  const path = deletionId === null
    ? parsed.pathname
    : `${parsed.pathname}/${encodeURIComponent(deletionId)}`;
  return new Promise((resolvePromise, rejectPromise) => {
    const requestValue = request({
      protocol: "http:",
      hostname: parsed.hostname === "[::1]" ? "::1" : parsed.hostname,
      port: parsed.port,
      path,
      method,
      agent: false,
      headers: body === null ? { accept: "application/json" } : {
        accept: "application/json",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body, "utf8"),
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          response.destroy(new Error("LOOPBACK_RESPONSE_CAPACITY_DENIED"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolvePromise({
        statusCode: response.statusCode ?? 0,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
      response.on("error", rejectPromise);
    });
    requestValue.setTimeout(2_000, () => requestValue.destroy(new Error("LOOPBACK_TRANSPORT_TIMEOUT")));
    requestValue.on("error", () => rejectPromise(new Error("LOOPBACK_TRANSPORT_FAILED")));
    if (body !== null) requestValue.write(body);
    requestValue.end();
  });
}

export class UsageInsightsLoopbackTransportV1 implements UsageInsightsTransportV1 {
  async share(endpoint: string, envelope: UsageInsightsShareEnvelopeV1): Promise<void> {
    const verified = validateUsageInsightsShareEnvelopeV1(envelope);
    const response = await requestLoopback(endpoint, "POST", null, canonicalJson(verified));
    if (response.statusCode !== 202) throw new Error("LOOPBACK_SHARE_DENIED");
    let parsed: unknown;
    try { parsed = safeClone(JSON.parse(response.body) as unknown); }
    catch { throw new Error("LOOPBACK_SHARE_ACK_DENIED"); }
    const record = recordOf(parsed);
    if (record === null || !exactKeys(record, ["schemaVersion", "accepted", "deletionId"])
      || record.schemaVersion !== USAGE_INSIGHTS_RECEIVER_ACK_SCHEMA_V1
      || record.accepted !== true || record.deletionId !== verified.deletionId) {
      throw new Error("LOOPBACK_SHARE_ACK_DENIED");
    }
  }

  async delete(endpoint: string, deletionId: string): Promise<void> {
    if (!DELETE_ID_PATTERN.test(deletionId)) throw new TypeError("DELETE_ID_DENIED");
    const response = await requestLoopback(endpoint, "DELETE", deletionId, null);
    if (response.statusCode !== 204 || response.body !== "") throw new Error("LOOPBACK_DELETE_DENIED");
  }
}

export interface UsageInsightsReportV1 {
  readonly schemaVersion: typeof USAGE_INSIGHTS_REPORT_SCHEMA_V1;
  readonly cohortLabel: "EXPLICIT_OPT_IN_ONLY";
  readonly coverageLabel: "PARTIAL_NON_REPRESENTATIVE_COHORT";
  readonly coverageNonclaims: readonly [
    "DOES_NOT_REPRESENT_ALL_INSTALLATIONS",
    "NO_PRODUCTION_OR_ADOPTION_CLAIM",
  ];
  readonly smallCellPolicy: "ALL_OR_NOTHING_DISTINCT_INSTALLATIONS_THRESHOLD_5";
  readonly minCellSize: typeof USAGE_INSIGHTS_SMALL_CELL_THRESHOLD;
  readonly publicationState: "EMPTY" | "SUPPRESSED" | "PUBLISHED";
  readonly installationsSeen: number | null;
  readonly suppressionReason: "ONE_OR_MORE_COHORTS_BELOW_THRESHOLD" | null;
  readonly metrics: {
    readonly installToFirstSuccess: {
      readonly eligibleInstallations: number;
      readonly successfulInstallations: number;
      readonly medianDurationMs: number | null;
    };
    readonly retention: {
      readonly eligibleInstallations: number;
      readonly retainedInstallations: number;
      readonly minimumReturnIntervalMs: typeof USAGE_INSIGHTS_RETENTION_INTERVAL_MS;
    };
    readonly errors: readonly UsageInsightsMetricCellV1[];
    readonly denials: readonly UsageInsightsMetricCellV1[];
    readonly rollbacks: readonly UsageInsightsMetricCellV1[];
    readonly versionFragmentation: {
      readonly distinctVersions: number;
      readonly versions: readonly UsageInsightsVersionCellV1[];
    };
  } | null;
  readonly generatedAtMs: number;
  readonly reportDigest: string;
}

export interface UsageInsightsMetricCellV1 {
  readonly capabilityId: string;
  readonly eventCount: number;
  readonly distinctInstallations: number;
}

export interface UsageInsightsVersionCellV1 {
  readonly productVersion: string;
  readonly eventCount: number;
  readonly distinctInstallations: number;
}

function metricCells(
  events: readonly UsageInsightsEventRecordV1[],
  outcomes: ReadonlySet<string>,
): UsageInsightsMetricCellV1[] {
  const cells = new Map<string, { count: number; installations: Set<string> }>();
  for (const event of events) {
    if (!outcomes.has(event.lifecycleOutcome)) continue;
    const cell = cells.get(event.capabilityId) ?? { count: 0, installations: new Set<string>() };
    cell.count += 1;
    cell.installations.add(event.installationId);
    cells.set(event.capabilityId, cell);
  }
  return [...cells.entries()].map(([capabilityId, cell]) => ({
    capabilityId,
    eventCount: cell.count,
    distinctInstallations: cell.installations.size,
  })).sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  return Math.floor(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

export function buildUsageInsightsReportV1(envelopes: unknown, generatedAtMs: number): UsageInsightsReportV1 {
  if (!isTimestamp(generatedAtMs)) throw new TypeError("INVALID_USAGE_INSIGHTS_REPORT_INPUT");
  let prepared: unknown;
  try { prepared = safeClone(envelopes); }
  catch { throw new TypeError("INVALID_USAGE_INSIGHTS_REPORT_INPUT"); }
  if (!Array.isArray(prepared) || prepared.length > USAGE_INSIGHTS_MAX_SHARED_BATCHES) {
    throw new TypeError("INVALID_USAGE_INSIGHTS_REPORT_INPUT");
  }
  const verified = prepared.map(validateUsageInsightsShareEnvelopeV1);
  const deletionIds = new Map<string, string>();
  const eventsById = new Map<string, UsageInsightsEventRecordV1>();
  for (const envelope of verified) {
    const priorEnvelope = deletionIds.get(envelope.deletionId);
    if (priorEnvelope !== undefined && priorEnvelope !== envelope.envelopeDigest) {
      throw new TypeError("CONFLICTING_USAGE_INSIGHTS_SHARE_ID");
    }
    deletionIds.set(envelope.deletionId, envelope.envelopeDigest);
    for (const event of envelope.events) {
      const prior = eventsById.get(event.eventId);
      if (prior !== undefined && prior.eventDigest !== event.eventDigest) {
        throw new TypeError("CONFLICTING_USAGE_INSIGHTS_EVENT_ID");
      }
      eventsById.set(event.eventId, event);
    }
  }
  const events = [...eventsById.values()].sort((a, b) => a.eventId.localeCompare(b.eventId));
  const byInstallation = new Map<string, UsageInsightsEventRecordV1[]>();
  for (const event of events) {
    const installation = byInstallation.get(event.installationId) ?? [];
    installation.push(event);
    byInstallation.set(event.installationId, installation);
  }

  const base = {
    schemaVersion: USAGE_INSIGHTS_REPORT_SCHEMA_V1,
    cohortLabel: "EXPLICIT_OPT_IN_ONLY" as const,
    coverageLabel: "PARTIAL_NON_REPRESENTATIVE_COHORT" as const,
    coverageNonclaims: [
      "DOES_NOT_REPRESENT_ALL_INSTALLATIONS",
      "NO_PRODUCTION_OR_ADOPTION_CLAIM",
    ] as const,
    smallCellPolicy: "ALL_OR_NOTHING_DISTINCT_INSTALLATIONS_THRESHOLD_5" as const,
    minCellSize: USAGE_INSIGHTS_SMALL_CELL_THRESHOLD,
    generatedAtMs,
  };
  if (events.length === 0) {
    const empty = {
      ...base,
      publicationState: "EMPTY" as const,
      installationsSeen: 0,
      suppressionReason: null,
      metrics: null,
      reportDigest: "",
    };
    return { ...empty, reportDigest: digestExcluding(empty, "reportDigest") };
  }

  const firstSuccessDurations: number[] = [];
  let installEligible = 0;
  let retentionEligible = 0;
  let retained = 0;
  for (const installationEvents of byInstallation.values()) {
    const orderedEvents = [...installationEvents].sort((a, b) => a.occurredAtMs - b.occurredAtMs);
    const installStarted = orderedEvents.find((event) => event.lifecycleOutcome === "INSTALL_STARTED");
    if (installStarted !== undefined) {
      installEligible += 1;
      const firstSuccess = orderedEvents.find((event) => event.lifecycleOutcome === "FIRST_SUCCESS"
        && event.occurredAtMs >= installStarted.occurredAtMs);
      if (firstSuccess !== undefined) firstSuccessDurations.push(firstSuccess.occurredAtMs - installStarted.occurredAtMs);
    }
    const running = orderedEvents.filter((event) => event.lifecycleOutcome === "RUNNING");
    if (running.length > 0) {
      retentionEligible += 1;
      if ((running.at(-1)?.occurredAtMs ?? 0) - (running[0]?.occurredAtMs ?? 0) >= USAGE_INSIGHTS_RETENTION_INTERVAL_MS) {
        retained += 1;
      }
    }
  }
  const errors = metricCells(events, new Set(["ERROR"]));
  const denials = metricCells(events, new Set(["DENIED"]));
  const rollbacks = metricCells(events, new Set(["ROLLBACK_SUCCEEDED", "ROLLBACK_FAILED"]));
  const versionGroups = new Map<string, { count: number; installations: Set<string> }>();
  for (const event of events) {
    const group = versionGroups.get(event.productVersion) ?? { count: 0, installations: new Set<string>() };
    group.count += 1;
    group.installations.add(event.installationId);
    versionGroups.set(event.productVersion, group);
  }
  const versions = [...versionGroups.entries()].map(([productVersion, group]) => ({
    productVersion,
    eventCount: group.count,
    distinctInstallations: group.installations.size,
  })).sort((a, b) => a.productVersion.localeCompare(b.productVersion));

  const belowThreshold = byInstallation.size < USAGE_INSIGHTS_SMALL_CELL_THRESHOLD
    || (installEligible > 0 && installEligible < USAGE_INSIGHTS_SMALL_CELL_THRESHOLD)
    || (firstSuccessDurations.length > 0 && firstSuccessDurations.length < USAGE_INSIGHTS_SMALL_CELL_THRESHOLD)
    || (installEligible - firstSuccessDurations.length > 0
      && installEligible - firstSuccessDurations.length < USAGE_INSIGHTS_SMALL_CELL_THRESHOLD)
    || (retentionEligible > 0 && retentionEligible < USAGE_INSIGHTS_SMALL_CELL_THRESHOLD)
    || (retained > 0 && retained < USAGE_INSIGHTS_SMALL_CELL_THRESHOLD)
    || (retentionEligible - retained > 0
      && retentionEligible - retained < USAGE_INSIGHTS_SMALL_CELL_THRESHOLD)
    || [...errors, ...denials, ...rollbacks].some(
      (cell) => cell.distinctInstallations < USAGE_INSIGHTS_SMALL_CELL_THRESHOLD,
    )
    || versions.some((cell) => cell.distinctInstallations < USAGE_INSIGHTS_SMALL_CELL_THRESHOLD);
  if (belowThreshold) {
    const suppressed = {
      ...base,
      publicationState: "SUPPRESSED" as const,
      installationsSeen: null,
      suppressionReason: "ONE_OR_MORE_COHORTS_BELOW_THRESHOLD" as const,
      metrics: null,
      reportDigest: "",
    };
    return { ...suppressed, reportDigest: digestExcluding(suppressed, "reportDigest") };
  }
  const metrics = {
    installToFirstSuccess: {
      eligibleInstallations: installEligible,
      successfulInstallations: firstSuccessDurations.length,
      medianDurationMs: median(firstSuccessDurations),
    },
    retention: {
      eligibleInstallations: retentionEligible,
      retainedInstallations: retained,
      minimumReturnIntervalMs: USAGE_INSIGHTS_RETENTION_INTERVAL_MS,
    },
    errors,
    denials,
    rollbacks,
    versionFragmentation: { distinctVersions: versions.length, versions },
  };
  const report = {
    ...base,
    publicationState: "PUBLISHED" as const,
    installationsSeen: byInstallation.size,
    suppressionReason: null,
    metrics,
    reportDigest: "",
  };
  return { ...report, reportDigest: digestExcluding(report, "reportDigest") };
}

export function renderUsageInsightsDashboardV1(reportValue: unknown): string {
  const prepared = recordOf(safeClone(reportValue));
  if (prepared === null || prepared.schemaVersion !== USAGE_INSIGHTS_REPORT_SCHEMA_V1
    || typeof prepared.reportDigest !== "string" || !DIGEST_PATTERN.test(prepared.reportDigest)
    || digestExcluding(prepared, "reportDigest") !== prepared.reportDigest) {
    throw new TypeError("INVALID_USAGE_INSIGHTS_REPORT");
  }
  const report = prepared as unknown as UsageInsightsReportV1;
  const lines = [
    "PANSPHAIRA Usage Insights — local reference dashboard",
    `Cohort: ${report.cohortLabel}`,
    `Coverage: ${report.coverageLabel}`,
    `Nonclaims: ${report.coverageNonclaims.join(", ")}`,
    `Small-cell policy: ${report.smallCellPolicy}`,
    `State: ${report.publicationState}`,
  ];
  if (report.metrics !== null) {
    lines.push(
      `Install-to-first-success: ${report.metrics.installToFirstSuccess.successfulInstallations}/${report.metrics.installToFirstSuccess.eligibleInstallations}`,
      `Retention: ${report.metrics.retention.retainedInstallations}/${report.metrics.retention.eligibleInstallations}`,
      `Errors: ${report.metrics.errors.reduce((sum, cell) => sum + cell.eventCount, 0)}`,
      `Denials: ${report.metrics.denials.reduce((sum, cell) => sum + cell.eventCount, 0)}`,
      `Rollbacks: ${report.metrics.rollbacks.reduce((sum, cell) => sum + cell.eventCount, 0)}`,
      `Version fragmentation: ${report.metrics.versionFragmentation.distinctVersions}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export class UsageInsightsLocalServiceV1 {
  readonly #storePath: string;
  #consent: UsageInsightsConsentV1;
  #runtime: UsageInsightsRuntimeV1;
  #pendingShare: PendingShareV1 | null;
  #sharedBatches: SharedBatchReceiptV1[];
  #exists: boolean;

  private constructor(
    storePath: string,
    consent: UsageInsightsConsentV1,
    runtime: UsageInsightsRuntimeV1,
    pendingShare: PendingShareV1 | null,
    sharedBatches: SharedBatchReceiptV1[],
    exists: boolean,
  ) {
    this.#storePath = storePath;
    this.#consent = consent;
    this.#runtime = runtime;
    this.#pendingShare = pendingShare;
    this.#sharedBatches = sharedBatches;
    this.#exists = exists;
  }

  static open(storePath: string, nowMs: number = Date.now()): UsageInsightsLocalServiceV1 {
    if (typeof storePath !== "string" || storePath.length === 0 || storePath.includes("\0") || !isTimestamp(nowMs)) {
      throw new TypeError("INVALID_USAGE_INSIGHTS_STORE_INPUT");
    }
    const absolute = resolve(storePath);
    secureParent(absolute);
    if (!existsSync(absolute)) {
      return new UsageInsightsLocalServiceV1(
        absolute, defaultConsent(), new UsageInsightsRuntimeV1(nowMs), null, [], false,
      );
    }
    const stored = readStoredState(absolute, nowMs);
    return new UsageInsightsLocalServiceV1(
      absolute, stored.consent, stored.runtime, stored.pendingShare, stored.sharedBatches, true,
    );
  }

  #persist(nowMs: number): void {
    const value = {
      schemaVersion: USAGE_INSIGHTS_LOCAL_STATE_SCHEMA_V1,
      consent: copyConsent(this.#consent),
      runtimeSnapshot: this.#runtime.snapshot(nowMs),
      pendingShare: this.#pendingShare === null ? null : {
        endpoint: this.#pendingShare.endpoint,
        envelope: this.#pendingShare.envelope,
      },
      sharedBatches: this.#sharedBatches.map((batch) => ({ ...batch })),
      savedAtMs: nowMs,
      claimBoundary: USAGE_INSIGHTS_COMPLETION_BOUNDARY_V1,
      stateDigest: "",
    };
    const stored = { ...value, stateDigest: digestExcluding(value, "stateDigest") };
    writeStoredState(this.#storePath, stored);
    this.#exists = true;
  }

  #refresh(nowMs: number): void {
    if (!isTimestamp(nowMs)) throw new TypeError("USAGE_INSIGHTS_INVALID_TIMESTAMP");
    if (this.#consent.state === "GRANTED" && this.#consent.profile === "diagnostics"
      && this.#consent.expiresAtMs !== null && nowMs >= this.#consent.expiresAtMs) {
      const status = this.#runtime.status(nowMs);
      if (status.state === "ENABLED") this.#runtime.revoke(nowMs);
      this.#consent = {
        ...this.#consent,
        state: "REVOKED",
        revokedAtMs: nowMs,
        sharingEnabled: false,
        endpoint: null,
      };
    } else {
      this.#runtime.status(nowMs);
    }
  }

  consentStatus(nowMs: number = Date.now()): Readonly<Record<string, unknown>> {
    const before = canonicalJson(this.#consent);
    this.#refresh(nowMs);
    if (this.#exists && before !== canonicalJson(this.#consent)) this.#persist(nowMs);
    return {
      schemaVersion: USAGE_INSIGHTS_CONSENT_SCHEMA_V1,
      state: this.#consent.state,
      profile: this.#consent.profile,
      grantedAtMs: this.#consent.grantedAtMs,
      expiresAtMs: this.#consent.expiresAtMs,
      revokedAtMs: this.#consent.revokedAtMs,
      networkMode: this.#consent.sharingEnabled ? "EXPLICIT_LOOPBACK_OPT_IN" : "OFF",
      endpointConfigured: this.#consent.endpoint !== null,
      retainedDataClasses: ["closed product/capability/version/outcome", "opaque rotating pseudonyms", "policy timestamps"],
      prohibitedDataClasses: ["free text", "prompts/chats/payloads", "paths/domains", "secrets", "tenant/user/customer identities"],
      notice: "Default is OFF. Local recording requires explicit profile consent; network sharing additionally requires explicit loopback enablement.",
      claimBoundary: USAGE_INSIGHTS_COMPLETION_BOUNDARY_V1,
    };
  }

  grant(
    profileValue: unknown,
    nowMs: number = Date.now(),
    diagnosticsTtlMs?: number,
  ): Readonly<Record<string, unknown>> {
    if (!validProfile(profileValue) || !isTimestamp(nowMs)) throw new TypeError("CONSENT_PROFILE_DENIED");
    if (profileValue === "diagnostics") {
      if (!Number.isSafeInteger(diagnosticsTtlMs) || (diagnosticsTtlMs as number) <= 0
        || (diagnosticsTtlMs as number) > USAGE_INSIGHTS_DIAGNOSTICS_MAX_TTL_MS
        || nowMs > Number.MAX_SAFE_INTEGER - (diagnosticsTtlMs as number)) {
        throw new TypeError("DIAGNOSTICS_TTL_DENIED");
      }
    } else if (diagnosticsTtlMs !== undefined) {
      throw new TypeError("DIAGNOSTICS_TTL_DENIED");
    }
    if (this.#consent.state === "GRANTED") throw new Error("CONSENT_ALREADY_GRANTED");
    if (this.#pendingShare !== null || this.#sharedBatches.length > 0) {
      throw new Error("MANAGED_SHARED_DATA_DELETE_REQUIRED");
    }
    this.#runtime = new UsageInsightsRuntimeV1(nowMs);
    this.#runtime.optIn(nowMs);
    this.#pendingShare = null;
    this.#consent = {
      schemaVersion: USAGE_INSIGHTS_CONSENT_SCHEMA_V1,
      state: "GRANTED",
      profile: profileValue,
      grantedAtMs: nowMs,
      expiresAtMs: profileValue === "diagnostics" ? nowMs + (diagnosticsTtlMs as number) : null,
      revokedAtMs: null,
      sharingEnabled: false,
      endpoint: null,
    };
    this.#persist(nowMs);
    return this.consentStatus(nowMs);
  }

  enableSharing(endpointValue: unknown, nowMs: number = Date.now()): Readonly<Record<string, unknown>> {
    this.#refresh(nowMs);
    if (this.#consent.state !== "GRANTED") throw new Error("CONSENT_REQUIRED");
    const endpoint = validateUsageInsightsLoopbackEndpointV1(endpointValue);
    this.#consent = { ...this.#consent, sharingEnabled: true, endpoint };
    this.#persist(nowMs);
    return this.consentStatus(nowMs);
  }

  disableSharing(nowMs: number = Date.now()): Readonly<Record<string, unknown>> {
    this.#refresh(nowMs);
    if (this.#consent.state !== "GRANTED") throw new Error("CONSENT_REQUIRED");
    this.#consent = { ...this.#consent, sharingEnabled: false, endpoint: null };
    this.#persist(nowMs);
    return this.consentStatus(nowMs);
  }

  record(value: unknown, nowMs: number = Date.now()): Readonly<Record<string, unknown>> {
    this.#refresh(nowMs);
    if (this.#consent.state !== "GRANTED" || this.#consent.profile === null) {
      return { outcome: "DENIED", reasonCodes: ["CONSENT_REQUIRED"] };
    }
    if (this.#pendingShare !== null) return { outcome: "DENIED", reasonCodes: ["PENDING_SHARE_DENIED"] };
    let prepared: unknown;
    try { prepared = safeClone(value); }
    catch { return { outcome: "DENIED", reasonCodes: ["UNSAFE_STRUCTURE_DENIED"] }; }
    const record = recordOf(prepared);
    if (record === null || !exactKeys(record, ["capabilityId", "lifecycleOutcome"])
      || !(USAGE_INSIGHTS_CAPABILITY_IDS_V1 as readonly unknown[]).includes(record.capabilityId)
      || !(USAGE_INSIGHTS_LIFECYCLE_OUTCOMES_V1 as readonly unknown[]).includes(record.lifecycleOutcome)
      || !profileAllows(this.#consent.profile, record.lifecycleOutcome as string)) {
      return { outcome: "DENIED", reasonCodes: ["PROFILE_OR_SCHEMA_DENIED"] };
    }
    const decision = this.#runtime.record({
      schemaVersion: "chimpmaera.usage-insights/event-input/v1",
      productId: USAGE_INSIGHTS_PRODUCT_IDS_V1[0],
      capabilityId: record.capabilityId,
      productVersion: USAGE_INSIGHTS_PRODUCT_VERSION_V1,
      lifecycleOutcome: record.lifecycleOutcome,
      occurredAtMs: nowMs,
    }, nowMs);
    if (decision.outcome === "ACCEPTED") this.#persist(nowMs);
    return decision;
  }

  status(nowMs: number = Date.now()): Readonly<Record<string, unknown>> {
    this.#refresh(nowMs);
    if (this.#exists) this.#persist(nowMs);
    return {
      schemaVersion: USAGE_INSIGHTS_LOCAL_PREVIEW_SCHEMA_V1,
      consent: this.consentStatus(nowMs),
      runtime: this.#runtime.status(nowMs),
      pendingShare: this.#pendingShare !== null,
      sharedBatchCount: this.#sharedBatches.length,
      networkDefault: "OFF",
      claimBoundary: USAGE_INSIGHTS_COMPLETION_BOUNDARY_V1,
    };
  }

  preview(nowMs: number = Date.now()): Readonly<Record<string, unknown>> {
    this.#refresh(nowMs);
    if (this.#exists) this.#persist(nowMs);
    return {
      schemaVersion: USAGE_INSIGHTS_LOCAL_PREVIEW_SCHEMA_V1,
      consent: this.consentStatus(nowMs),
      local: this.#runtime.preview(nowMs),
      pendingShare: this.#pendingShare === null ? null : {
        profile: this.#pendingShare.envelope.profile,
        eventCount: this.#pendingShare.envelope.events.length,
        sharedAtMs: this.#pendingShare.envelope.sharedAtMs,
      },
      sharedBatchCount: this.#sharedBatches.length,
      claimBoundary: USAGE_INSIGHTS_COMPLETION_BOUNDARY_V1,
    };
  }

  exportData(nowMs: number = Date.now()): Readonly<Record<string, unknown>> {
    this.#refresh(nowMs);
    if (this.#exists) this.#persist(nowMs);
    const value = {
      schemaVersion: USAGE_INSIGHTS_LOCAL_EXPORT_SCHEMA_V1,
      consent: {
        state: this.#consent.state,
        profile: this.#consent.profile,
        grantedAtMs: this.#consent.grantedAtMs,
        expiresAtMs: this.#consent.expiresAtMs,
        revokedAtMs: this.#consent.revokedAtMs,
        networkMode: this.#consent.sharingEnabled ? "EXPLICIT_LOOPBACK_OPT_IN" : "OFF",
      },
      runtimeSnapshot: this.#runtime.snapshot(nowMs),
      pendingShare: this.#pendingShare?.envelope ?? null,
      sharedBatches: this.#sharedBatches.map(({ deletionId, sharedAtMs, eventCount }) => ({
        deletionId, sharedAtMs, eventCount,
      })),
      exportedAtMs: nowMs,
      claimBoundary: USAGE_INSIGHTS_COMPLETION_BOUNDARY_V1,
      exportDigest: "",
    };
    return { ...value, exportDigest: digestExcluding(value, "exportDigest") };
  }

  localReport(nowMs: number = Date.now()): UsageInsightsReportV1 {
    this.#refresh(nowMs);
    const runtime = this.#runtime.status(nowMs);
    if (runtime.installationId === null || runtime.eventCount === 0 || this.#consent.profile === null) {
      return buildUsageInsightsReportV1([], nowMs);
    }
    const exported = this.#runtime.exportState(nowMs);
    const reportDeleteId = `delete:v1:${createHash("sha256")
      .update(canonicalJson(exported.eventRecords.map((event) => event.eventDigest)), "utf8").digest("hex")}`;
    return buildUsageInsightsReportV1([
      makeEnvelope(this.#consent.profile, reportDeleteId, nowMs, exported.eventRecords),
    ], nowMs);
  }

  revoke(nowMs: number = Date.now()): Readonly<Record<string, unknown>> {
    this.#refresh(nowMs);
    if (this.#consent.state !== "GRANTED") throw new Error("CONSENT_NOT_GRANTED");
    this.#runtime.revoke(nowMs);
    this.#consent = {
      ...this.#consent,
      state: "REVOKED",
      revokedAtMs: nowMs,
      sharingEnabled: false,
      endpoint: null,
    };
    this.#persist(nowMs);
    return this.consentStatus(nowMs);
  }

  rotate(nowMs: number = Date.now()): string {
    this.#refresh(nowMs);
    if (this.#consent.state !== "GRANTED") throw new Error("CONSENT_REQUIRED");
    if (this.#pendingShare !== null) throw new Error("PENDING_SHARE_DENIED");
    const installationId = this.#runtime.rotateInstallationId(nowMs);
    this.#persist(nowMs);
    return installationId;
  }

  async share(
    transport: UsageInsightsTransportV1 = new UsageInsightsLoopbackTransportV1(),
    nowMs: number = Date.now(),
  ): Promise<Readonly<Record<string, unknown>>> {
    this.#refresh(nowMs);
    if (this.#consent.state !== "GRANTED" || this.#consent.profile === null
      || !this.#consent.sharingEnabled || this.#consent.endpoint === null) {
      throw new Error("EXPLICIT_SHARING_CONSENT_REQUIRED");
    }
    if (this.#pendingShare === null) {
      if (this.#sharedBatches.length >= USAGE_INSIGHTS_MAX_SHARED_BATCHES) {
        throw new Error("SHARED_BATCH_CAPACITY_DENIED");
      }
      const exported = this.#runtime.exportState(nowMs);
      if (exported.eventRecords.length === 0) throw new Error("NO_EVENTS_TO_SHARE");
      this.#pendingShare = {
        endpoint: this.#consent.endpoint,
        envelope: makeEnvelope(this.#consent.profile, newDeleteId(), nowMs, exported.eventRecords),
      };
      this.#persist(nowMs);
    }
    const pending = this.#pendingShare;
    await transport.share(pending.endpoint, pending.envelope);
    this.#sharedBatches.push({
      endpoint: pending.endpoint,
      deletionId: pending.envelope.deletionId,
      sharedAtMs: pending.envelope.sharedAtMs,
      eventCount: pending.envelope.events.length,
    });
    this.#pendingShare = null;
    this.#runtime.rotateInstallationId(nowMs);
    this.#persist(nowMs);
    return {
      schemaVersion: USAGE_INSIGHTS_SHARE_RECEIPT_SCHEMA_V1,
      deletionId: pending.envelope.deletionId,
      sharedEventCount: pending.envelope.events.length,
      oldEpochErasedBeforeNewPseudonymExposed: true,
      claimBoundary: USAGE_INSIGHTS_COMPLETION_BOUNDARY_V1,
    };
  }

  async deleteManagedData(
    transport?: UsageInsightsTransportV1,
    nowMs: number = Date.now(),
  ): Promise<Readonly<Record<string, unknown>>> {
    this.#refresh(nowMs);
    const remote = [
      ...(this.#pendingShare === null ? [] : [{
        endpoint: this.#pendingShare.endpoint,
        deletionId: this.#pendingShare.envelope.deletionId,
      }]),
      ...this.#sharedBatches.map(({ endpoint, deletionId }) => ({ endpoint, deletionId })),
    ];
    if (remote.length > 0 && transport === undefined) throw new Error("SHARED_DATA_DELETE_REQUIRED");
    for (const item of remote) await transport?.delete(item.endpoint, item.deletionId);
    const runtimeState = this.#runtime.status(nowMs).state;
    if (runtimeState !== "DELETED") this.#runtime.deleteState(nowMs);
    if (this.#exists) {
      const stat = lstatSync(this.#storePath);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new TypeError("USAGE_INSIGHTS_STORE_SECURITY_DENIED");
      unlinkSync(this.#storePath);
      const directoryDescriptor = openSync(dirname(this.#storePath), "r");
      try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
    }
    this.#exists = false;
    this.#pendingShare = null;
    this.#sharedBatches = [];
    this.#consent = defaultConsent();
    this.#runtime = new UsageInsightsRuntimeV1(nowMs);
    return {
      schemaVersion: USAGE_INSIGHTS_DELETE_RECEIPT_SCHEMA_V1,
      localStateDeleted: true,
      sharedBatchesDeleted: remote.length,
      claimBoundary: USAGE_INSIGHTS_COMPLETION_BOUNDARY_V1,
    };
  }
}
