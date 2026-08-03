import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import type { HmiAdapterMappingV1 } from "./hmi-harness-adapter.js";

export const HMI_DISCOVER_PAYLOAD_SCHEMA_V1 = "chimpmaera.hmi/discover-payload/v1" as const;
export const HMI_DISCOVER_PAYLOAD_CONTRACT_VERSION_V1 = "1.0.0" as const;

export type HmiDiscoverEffectClassV1 = "DESCRIBE_ONLY" | "PLAN_ONLY" | "READ_ONLY_VALIDATE";

export interface HmiDiscoverPayloadV1 {
  readonly schemaVersion: typeof HMI_DISCOVER_PAYLOAD_SCHEMA_V1;
  readonly operation: "discover";
  readonly requestDigest: string;
  readonly generationDigest: string;
  readonly filters: {
    readonly capabilityIds: readonly string[];
    readonly effectClasses: readonly HmiDiscoverEffectClassV1[];
    readonly lifecycleStates: readonly ["DESCRIBED_INACTIVE"];
    readonly evidenceStatus: "LOCAL_SYNTHETIC";
  };
  readonly authority: {
    readonly requestedRights: readonly [];
    readonly routeIds: readonly [];
    readonly writeTargets: readonly [];
  };
}

export type HmiDiscoverPayloadReasonCodeV1 =
  | "HMI_DISCOVER_SCHEMA_DENIED"
  | "HMI_DISCOVER_OPERATION_DENIED"
  | "HMI_DISCOVER_BINDING_DENIED"
  | "HMI_DISCOVER_FILTER_DENIED"
  | "HMI_DISCOVER_AUTHORITY_DENIED";

export type HmiDiscoverPayloadValidationV1 =
  | {
    readonly outcome: "ACCEPTED";
    readonly payload: HmiDiscoverPayloadV1;
    readonly canonicalBytes: string;
    readonly payloadDigest: string;
  }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly [HmiDiscoverPayloadReasonCodeV1] };

const effectClasses = new Set<HmiDiscoverEffectClassV1>([
  "DESCRIBE_ONLY", "PLAN_ONLY", "READ_ONLY_VALIDATE",
]);

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

function isCapabilityId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
}

function sortedUnique(values: readonly string[]): string[] | null {
  if (new Set(values).size !== values.length) return null;
  return [...values].sort();
}

function denied(reason: HmiDiscoverPayloadReasonCodeV1): HmiDiscoverPayloadValidationV1 {
  return { outcome: "DENIED", reasonCodes: [reason] };
}

export function validateHmiDiscoverPayloadV1(
  mapping: HmiAdapterMappingV1,
  value: unknown,
): HmiDiscoverPayloadValidationV1 {
  if (mapping.outcome !== "MAPPED") return denied("HMI_DISCOVER_BINDING_DENIED");
  if (!exactKeys(value, [
    "schemaVersion", "operation", "requestDigest", "generationDigest", "filters", "authority",
  ]) || value.schemaVersion !== HMI_DISCOVER_PAYLOAD_SCHEMA_V1) {
    return denied("HMI_DISCOVER_SCHEMA_DENIED");
  }
  if (value.operation !== "discover" || mapping.request.operation !== "discover") {
    return denied("HMI_DISCOVER_OPERATION_DENIED");
  }
  if (!isDigest(value.requestDigest) || value.requestDigest !== mapping.requestDigest
    || !isDigest(value.generationDigest) || value.generationDigest !== mapping.request.generationDigest) {
    return denied("HMI_DISCOVER_BINDING_DENIED");
  }
  if (!exactKeys(value.filters, ["capabilityIds", "effectClasses", "lifecycleStates", "evidenceStatus"])) {
    return denied("HMI_DISCOVER_SCHEMA_DENIED");
  }
  if (!Array.isArray(value.filters.capabilityIds) || value.filters.capabilityIds.length > 4
    || !value.filters.capabilityIds.every(isCapabilityId)
    || !Array.isArray(value.filters.effectClasses) || value.filters.effectClasses.length < 1
    || value.filters.effectClasses.length > 3
    || !value.filters.effectClasses.every((item) => typeof item === "string"
      && effectClasses.has(item as HmiDiscoverEffectClassV1))
    || !Array.isArray(value.filters.lifecycleStates) || value.filters.lifecycleStates.length !== 1
    || value.filters.lifecycleStates[0] !== "DESCRIBED_INACTIVE"
    || value.filters.evidenceStatus !== "LOCAL_SYNTHETIC") {
    return denied("HMI_DISCOVER_FILTER_DENIED");
  }
  const capabilityIds = sortedUnique(value.filters.capabilityIds as string[]);
  const normalizedEffects = sortedUnique(value.filters.effectClasses as string[]);
  const mappedSelectors = [...mapping.request.selectors].sort();
  if (capabilityIds === null || normalizedEffects === null
    || canonicalJson(capabilityIds) !== canonicalJson(mappedSelectors)) {
    return denied("HMI_DISCOVER_FILTER_DENIED");
  }
  if (!exactKeys(value.authority, ["requestedRights", "routeIds", "writeTargets"])) {
    return denied("HMI_DISCOVER_SCHEMA_DENIED");
  }
  const authorityLists = [value.authority.requestedRights, value.authority.routeIds, value.authority.writeTargets];
  if (!authorityLists.every(Array.isArray) || authorityLists.some((items) => (items as unknown[]).length !== 0)) {
    return denied("HMI_DISCOVER_AUTHORITY_DENIED");
  }

  const payload: HmiDiscoverPayloadV1 = {
    schemaVersion: HMI_DISCOVER_PAYLOAD_SCHEMA_V1,
    operation: "discover",
    requestDigest: value.requestDigest,
    generationDigest: value.generationDigest,
    filters: {
      capabilityIds,
      effectClasses: normalizedEffects as HmiDiscoverEffectClassV1[],
      lifecycleStates: ["DESCRIBED_INACTIVE"],
      evidenceStatus: "LOCAL_SYNTHETIC",
    },
    authority: { requestedRights: [], routeIds: [], writeTargets: [] },
  };
  const canonicalBytes = canonicalJson(payload);
  return { outcome: "ACCEPTED", payload, canonicalBytes, payloadDigest: sha256(canonicalBytes) };
}
