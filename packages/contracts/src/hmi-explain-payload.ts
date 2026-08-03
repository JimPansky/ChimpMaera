import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import { verifyHmiGenerationV1, type HmiGenerationBundleV1 } from "./hmi-core.js";
import type { HmiAdapterMappingV1 } from "./hmi-harness-adapter.js";

export const HMI_EXPLAIN_PAYLOAD_SCHEMA_V1 = "chimpmaera.hmi/explain-payload/v1" as const;
export const HMI_EXPLAIN_PAYLOAD_CONTRACT_VERSION_V1 = "1.0.0" as const;

export interface HmiExplainPayloadV1 {
  readonly schemaVersion: typeof HMI_EXPLAIN_PAYLOAD_SCHEMA_V1;
  readonly operation: "explain";
  readonly requestDigest: string;
  readonly generationDigest: string;
  readonly subjectCapabilityIds: readonly string[];
  readonly citedSourceIds: readonly string[];
  readonly citationPolicy: "CITATIONS_REQUIRED";
  readonly evidenceStatus: "LOCAL_SYNTHETIC";
  readonly authority: {
    readonly requestedRights: readonly [];
    readonly routeIds: readonly [];
    readonly writeTargets: readonly [];
  };
}

export type HmiExplainPayloadReasonCodeV1 =
  | "HMI_EXPLAIN_SCHEMA_DENIED"
  | "HMI_EXPLAIN_OPERATION_DENIED"
  | "HMI_EXPLAIN_BINDING_DENIED"
  | "HMI_EXPLAIN_SUBJECT_DENIED"
  | "HMI_EXPLAIN_CITATION_DENIED"
  | "HMI_EXPLAIN_AUTHORITY_DENIED";

export type HmiExplainPayloadValidationV1 =
  | {
    readonly outcome: "ACCEPTED";
    readonly payload: HmiExplainPayloadV1;
    readonly canonicalBytes: string;
    readonly payloadDigest: string;
  }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly [HmiExplainPayloadReasonCodeV1] };

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

function isContractId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
}

function sortedUnique(value: unknown, minimum: number, maximum: number): string[] | null {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum
    || !value.every(isContractId) || new Set(value).size !== value.length) return null;
  return [...value].sort();
}

function denied(reason: HmiExplainPayloadReasonCodeV1): HmiExplainPayloadValidationV1 {
  return { outcome: "DENIED", reasonCodes: [reason] };
}

export function validateHmiExplainPayloadV1(
  bundle: HmiGenerationBundleV1,
  mapping: HmiAdapterMappingV1,
  value: unknown,
): HmiExplainPayloadValidationV1 {
  const generation = verifyHmiGenerationV1(bundle);
  if (generation.outcome !== "VERIFIED" || mapping.outcome !== "MAPPED") {
    return denied("HMI_EXPLAIN_BINDING_DENIED");
  }
  if (!exactKeys(value, [
    "schemaVersion", "operation", "requestDigest", "generationDigest", "subjectCapabilityIds",
    "citedSourceIds", "citationPolicy", "evidenceStatus", "authority",
  ]) || value.schemaVersion !== HMI_EXPLAIN_PAYLOAD_SCHEMA_V1) {
    return denied("HMI_EXPLAIN_SCHEMA_DENIED");
  }
  if (value.operation !== "explain" || mapping.request.operation !== "explain") {
    return denied("HMI_EXPLAIN_OPERATION_DENIED");
  }
  if (!isDigest(value.requestDigest) || value.requestDigest !== mapping.requestDigest
    || !isDigest(value.generationDigest) || value.generationDigest !== mapping.request.generationDigest
    || value.generationDigest !== generation.generationDigest) {
    return denied("HMI_EXPLAIN_BINDING_DENIED");
  }
  if (value.citationPolicy !== "CITATIONS_REQUIRED" || value.evidenceStatus !== "LOCAL_SYNTHETIC") {
    return denied("HMI_EXPLAIN_CITATION_DENIED");
  }

  const subjectCapabilityIds = sortedUnique(value.subjectCapabilityIds, 0, 4);
  const mappedSelectors = [...mapping.request.selectors].sort();
  const generationCapabilities = new Set(bundle.manifest.capabilities.map((item) => item.capabilityId));
  if (subjectCapabilityIds === null
    || canonicalJson(subjectCapabilityIds) !== canonicalJson(mappedSelectors)
    || subjectCapabilityIds.some((item) => !generationCapabilities.has(item))) {
    return denied("HMI_EXPLAIN_SUBJECT_DENIED");
  }

  const citedSourceIds = sortedUnique(value.citedSourceIds, 1, mapping.request.limits.maxReferences);
  const generationSources = new Set(bundle.manifest.provenance.map((item) => item.sourceId));
  if (citedSourceIds === null || citedSourceIds.some((item) => !generationSources.has(item))) {
    return denied("HMI_EXPLAIN_CITATION_DENIED");
  }
  if (!exactKeys(value.authority, ["requestedRights", "routeIds", "writeTargets"])) {
    return denied("HMI_EXPLAIN_SCHEMA_DENIED");
  }
  const authorityLists = [value.authority.requestedRights, value.authority.routeIds, value.authority.writeTargets];
  if (!authorityLists.every(Array.isArray) || authorityLists.some((items) => (items as unknown[]).length !== 0)) {
    return denied("HMI_EXPLAIN_AUTHORITY_DENIED");
  }

  const payload: HmiExplainPayloadV1 = {
    schemaVersion: HMI_EXPLAIN_PAYLOAD_SCHEMA_V1,
    operation: "explain",
    requestDigest: value.requestDigest,
    generationDigest: value.generationDigest,
    subjectCapabilityIds,
    citedSourceIds,
    citationPolicy: "CITATIONS_REQUIRED",
    evidenceStatus: "LOCAL_SYNTHETIC",
    authority: { requestedRights: [], routeIds: [], writeTargets: [] },
  };
  const canonicalBytes = canonicalJson(payload);
  return { outcome: "ACCEPTED", payload, canonicalBytes, payloadDigest: sha256(canonicalBytes) };
}
