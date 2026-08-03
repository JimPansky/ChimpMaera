import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import type { HmiAdapterMappingV1, HmiOperationV1 } from "./hmi-harness-adapter.js";

export const HMI_DISCLOSURE_SCHEMA_V1 = "chimpmaera.hmi/disclosure/v1" as const;
export const HMI_DISCLOSURE_CONTRACT_VERSION_V1 = "1.0.0" as const;
export const HMI_DISCLOSURE_CLAIM_BOUNDARY_V1 =
  "LOCAL_SYNTHETIC_NOT_RELEASED_OR_PRODUCTION_READY" as const;

export type HmiDisclosureTierV1 = "SUMMARY" | "DETAIL" | "EVIDENCE";

export interface HmiDisclosureItemV1 {
  readonly itemId: string;
  readonly tier: HmiDisclosureTierV1;
  readonly text: string;
  readonly sourceIds: readonly string[];
  readonly evidenceDigest: string | null;
  readonly contentClass: "PUBLIC_SYNTHETIC";
  readonly claimStatus: "LOCAL_SYNTHETIC";
}

export interface HmiDisclosureInputV1 {
  readonly schemaVersion: typeof HMI_DISCLOSURE_SCHEMA_V1;
  readonly operation: HmiOperationV1;
  readonly requestDigest: string;
  readonly generationDigest: string;
  readonly requestedTier: HmiDisclosureTierV1;
  readonly maxItems: number;
  readonly items: readonly HmiDisclosureItemV1[];
  readonly authority: {
    readonly requestedRights: readonly [];
    readonly routeIds: readonly [];
    readonly writeTargets: readonly [];
  };
}

export interface HmiDisclosureEnvelopeV1 {
  readonly schemaVersion: typeof HMI_DISCLOSURE_SCHEMA_V1;
  readonly contractVersion: typeof HMI_DISCLOSURE_CONTRACT_VERSION_V1;
  readonly operation: HmiOperationV1;
  readonly requestDigest: string;
  readonly generationDigest: string;
  readonly effectiveTier: HmiDisclosureTierV1;
  readonly items: readonly HmiDisclosureItemV1[];
  readonly omittedCount: number;
  readonly authority: {
    readonly requestedRights: readonly [];
    readonly routeIds: readonly [];
    readonly writeTargets: readonly [];
  };
  readonly claimBoundary: typeof HMI_DISCLOSURE_CLAIM_BOUNDARY_V1;
}

export type HmiDisclosureReasonCodeV1 =
  | "HMI_DISCLOSURE_SCHEMA_DENIED"
  | "HMI_DISCLOSURE_BINDING_DENIED"
  | "HMI_DISCLOSURE_OPERATION_DENIED"
  | "HMI_DISCLOSURE_TIER_DENIED"
  | "HMI_DISCLOSURE_LIMIT_DENIED"
  | "HMI_DISCLOSURE_AUTHORITY_DENIED"
  | "HMI_DISCLOSURE_CONTENT_DENIED"
  | "HMI_DISCLOSURE_PROVENANCE_DENIED";

export type HmiDisclosureProjectionV1 =
  | {
    readonly outcome: "PUBLISHED";
    readonly disclosure: HmiDisclosureEnvelopeV1;
    readonly canonicalBytes: string;
    readonly disclosureDigest: string;
  }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly [HmiDisclosureReasonCodeV1] };

const tierRank: Readonly<Record<HmiDisclosureTierV1, number>> = {
  SUMMARY: 0,
  DETAIL: 1,
  EVIDENCE: 2,
};

const operations = new Set<HmiOperationV1>([
  "discover", "explain", "plan", "handoff", "validate", "contribute",
]);

const unsafeTextPatterns = [
  /(?:authorization\s*:\s*bearer|(?:api[\s_-]?key|password|secret|access[\s_-]?token)\s*[:=]\s*\S+)/iu,
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/u,
  /(?:^|[\s"'(])\/(?:home|Users)\/[A-Za-z0-9._-]+(?:\/|$)/u,
  /[A-Za-z]:\\Users\\[^\s\\]+/u,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu,
  /https?:\/\/[^/\s:@]+:[^/\s@]+@/iu,
  /(?:session|job)[\s_-]?id\s*[:=]\s*\S+/iu,
  /(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})/u,
];

function sha256(bytes: string): string {
  return createHash("sha256").update(bytes, "utf8").digest("hex");
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

function isId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
}

function isTier(value: unknown): value is HmiDisclosureTierV1 {
  return typeof value === "string" && Object.hasOwn(tierRank, value);
}

function isPublicSafeText(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 1_024
    && value === value.normalize("NFC") && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
    && !unsafeTextPatterns.some((pattern) => pattern.test(value));
}

function denied(reason: HmiDisclosureReasonCodeV1): HmiDisclosureProjectionV1 {
  return { outcome: "DENIED", reasonCodes: [reason] };
}

export function projectHmiDisclosureV1(
  mapping: HmiAdapterMappingV1,
  value: unknown,
): HmiDisclosureProjectionV1 {
  if (mapping.outcome !== "MAPPED") return denied("HMI_DISCLOSURE_BINDING_DENIED");
  if (!exactKeys(value, [
    "schemaVersion", "operation", "requestDigest", "generationDigest", "requestedTier", "maxItems", "items", "authority",
  ])) return denied("HMI_DISCLOSURE_SCHEMA_DENIED");
  if (value.schemaVersion !== HMI_DISCLOSURE_SCHEMA_V1) return denied("HMI_DISCLOSURE_SCHEMA_DENIED");
  if (typeof value.operation !== "string" || !operations.has(value.operation as HmiOperationV1)) {
    return denied("HMI_DISCLOSURE_OPERATION_DENIED");
  }
  if (value.operation !== mapping.request.operation || !isDigest(value.requestDigest)
    || value.requestDigest !== mapping.requestDigest || !isDigest(value.generationDigest)
    || value.generationDigest !== mapping.request.generationDigest) {
    return denied("HMI_DISCLOSURE_BINDING_DENIED");
  }
  if (!isTier(value.requestedTier)) return denied("HMI_DISCLOSURE_TIER_DENIED");
  if (!Number.isSafeInteger(value.maxItems) || (value.maxItems as number) < 1 || (value.maxItems as number) > 16
    || (value.maxItems as number) > mapping.request.limits.maxFindings
    || !Array.isArray(value.items) || value.items.length < 1 || value.items.length > 32
    || value.items.length > mapping.request.limits.maxFindings) {
    return denied("HMI_DISCLOSURE_LIMIT_DENIED");
  }
  if (!exactKeys(value.authority, ["requestedRights", "routeIds", "writeTargets"])) {
    return denied("HMI_DISCLOSURE_SCHEMA_DENIED");
  }
  const authorityLists = [value.authority.requestedRights, value.authority.routeIds, value.authority.writeTargets];
  if (!authorityLists.every(Array.isArray) || authorityLists.some((items) => (items as unknown[]).length !== 0)) {
    return denied("HMI_DISCLOSURE_AUTHORITY_DENIED");
  }

  const itemIds = new Set<string>();
  const sourceIds = new Set<string>();
  const validatedItems: HmiDisclosureItemV1[] = [];
  let totalBytes = 0;
  for (const item of value.items) {
    if (!exactKeys(item, ["itemId", "tier", "text", "sourceIds", "evidenceDigest", "contentClass", "claimStatus"])) {
      return denied("HMI_DISCLOSURE_SCHEMA_DENIED");
    }
    if (!isId(item.itemId) || itemIds.has(item.itemId) || !isTier(item.tier)) {
      return denied("HMI_DISCLOSURE_SCHEMA_DENIED");
    }
    if (item.contentClass !== "PUBLIC_SYNTHETIC" || item.claimStatus !== "LOCAL_SYNTHETIC"
      || !isPublicSafeText(item.text)) return denied("HMI_DISCLOSURE_CONTENT_DENIED");
    if (!Array.isArray(item.sourceIds) || item.sourceIds.length > 8
      || new Set(item.sourceIds).size !== item.sourceIds.length || !item.sourceIds.every(isId)) {
      return denied("HMI_DISCLOSURE_PROVENANCE_DENIED");
    }
    if (item.tier === "EVIDENCE") {
      if (!isDigest(item.evidenceDigest) || item.sourceIds.length === 0) {
        return denied("HMI_DISCLOSURE_PROVENANCE_DENIED");
      }
    } else if (item.evidenceDigest !== null) {
      return denied("HMI_DISCLOSURE_PROVENANCE_DENIED");
    }
    for (const sourceId of item.sourceIds) sourceIds.add(sourceId as string);
    if (sourceIds.size > mapping.request.limits.maxReferences) {
      return denied("HMI_DISCLOSURE_LIMIT_DENIED");
    }
    totalBytes += Buffer.byteLength(item.text, "utf8");
    if (totalBytes > 16_384) return denied("HMI_DISCLOSURE_LIMIT_DENIED");
    itemIds.add(item.itemId);
    validatedItems.push({
      itemId: item.itemId,
      tier: item.tier,
      text: item.text,
      sourceIds: [...item.sourceIds] as string[],
      evidenceDigest: item.evidenceDigest,
      contentClass: "PUBLIC_SYNTHETIC",
      claimStatus: "LOCAL_SYNTHETIC",
    });
  }

  const ordered = validatedItems.sort((left, right) =>
    tierRank[left.tier] - tierRank[right.tier] || (left.itemId < right.itemId ? -1 : left.itemId > right.itemId ? 1 : 0));
  const included = ordered
    .filter((item) => tierRank[item.tier] <= tierRank[value.requestedTier as HmiDisclosureTierV1])
    .slice(0, value.maxItems as number);
  const disclosure: HmiDisclosureEnvelopeV1 = {
    schemaVersion: HMI_DISCLOSURE_SCHEMA_V1,
    contractVersion: HMI_DISCLOSURE_CONTRACT_VERSION_V1,
    operation: value.operation as HmiOperationV1,
    requestDigest: value.requestDigest,
    generationDigest: value.generationDigest,
    effectiveTier: value.requestedTier as HmiDisclosureTierV1,
    items: included,
    omittedCount: validatedItems.length - included.length,
    authority: { requestedRights: [], routeIds: [], writeTargets: [] },
    claimBoundary: HMI_DISCLOSURE_CLAIM_BOUNDARY_V1,
  };
  const canonicalBytes = canonicalJson(disclosure);
  if (Buffer.byteLength(canonicalBytes, "utf8") > mapping.request.limits.maxOutputBytes) {
    return denied("HMI_DISCLOSURE_LIMIT_DENIED");
  }
  return {
    outcome: "PUBLISHED",
    disclosure,
    canonicalBytes,
    disclosureDigest: sha256(canonicalBytes),
  };
}
