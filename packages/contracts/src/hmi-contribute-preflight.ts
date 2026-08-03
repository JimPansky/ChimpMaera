import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import { verifyHmiGenerationV1, type HmiGenerationBundleV1 } from "./hmi-core.js";
import type { HmiAdapterMappingV1 } from "./hmi-harness-adapter.js";

export const HMI_CONTRIBUTE_PREFLIGHT_SCHEMA_V1 = "chimpmaera.hmi/contribute-preflight/v1" as const;
export const HMI_CONTRIBUTE_PREFLIGHT_CONTRACT_VERSION_V1 = "1.0.0" as const;

export type HmiContributePreflightReasonV1 =
  | "CONTRIBUTION_CAPABILITY_ABSENT"
  | "PUBLICATION_ROUTE_ABSENT";

export interface HmiContributePreflightV1 {
  readonly schemaVersion: typeof HMI_CONTRIBUTE_PREFLIGHT_SCHEMA_V1;
  readonly operation: "contribute";
  readonly requestDigest: string;
  readonly inputDigest: string;
  readonly generationDigest: string;
  readonly preparationStatus: "PREPARATION_ONLY";
  readonly preflightReasons: readonly [
    "CONTRIBUTION_CAPABILITY_ABSENT",
    "PUBLICATION_ROUTE_ABSENT",
  ];
  readonly subjectCapabilityIds: readonly string[];
  readonly citedSourceIds: readonly string[];
  readonly evidenceStatus: "LOCAL_SYNTHETIC";
  readonly authority: {
    readonly requestedRights: readonly [];
    readonly routeIds: readonly [];
    readonly writeTargets: readonly [];
  };
  readonly effects: {
    readonly submissionPerformed: false;
    readonly publicationPerformed: false;
  };
}

export type HmiContributePreflightDenialCodeV1 =
  | "HMI_CONTRIBUTE_SCHEMA_DENIED"
  | "HMI_CONTRIBUTE_OPERATION_DENIED"
  | "HMI_CONTRIBUTE_BINDING_DENIED"
  | "HMI_CONTRIBUTE_PREPARATION_DENIED"
  | "HMI_CONTRIBUTE_SUBJECT_DENIED"
  | "HMI_CONTRIBUTE_CITATION_DENIED"
  | "HMI_CONTRIBUTE_AUTHORITY_DENIED"
  | "HMI_CONTRIBUTE_EFFECT_DENIED";

export type HmiContributePreflightValidationV1 =
  | {
    readonly outcome: "ACCEPTED";
    readonly payload: HmiContributePreflightV1;
    readonly canonicalBytes: string;
    readonly payloadDigest: string;
  }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly [HmiContributePreflightDenialCodeV1] };

const requiredPreflightReasons: readonly HmiContributePreflightReasonV1[] = [
  "CONTRIBUTION_CAPABILITY_ABSENT",
  "PUBLICATION_ROUTE_ABSENT",
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

function isContractId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
}

function sortedUnique(value: unknown, minimum: number, maximum: number): string[] | null {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum
    || !value.every(isContractId) || new Set(value).size !== value.length) return null;
  return [...value].sort();
}

function denied(reason: HmiContributePreflightDenialCodeV1): HmiContributePreflightValidationV1 {
  return { outcome: "DENIED", reasonCodes: [reason] };
}

export function validateHmiContributePreflightV1(
  bundle: HmiGenerationBundleV1,
  mapping: HmiAdapterMappingV1,
  value: unknown,
): HmiContributePreflightValidationV1 {
  const generation = verifyHmiGenerationV1(bundle);
  if (generation.outcome !== "VERIFIED" || mapping.outcome !== "MAPPED") {
    return denied("HMI_CONTRIBUTE_BINDING_DENIED");
  }
  if (!exactKeys(value, [
    "schemaVersion", "operation", "requestDigest", "inputDigest", "generationDigest",
    "preparationStatus", "preflightReasons", "subjectCapabilityIds", "citedSourceIds",
    "evidenceStatus", "authority", "effects",
  ]) || value.schemaVersion !== HMI_CONTRIBUTE_PREFLIGHT_SCHEMA_V1) {
    return denied("HMI_CONTRIBUTE_SCHEMA_DENIED");
  }
  if (value.operation !== "contribute" || mapping.request.operation !== "contribute") {
    return denied("HMI_CONTRIBUTE_OPERATION_DENIED");
  }
  if (!isDigest(value.requestDigest) || value.requestDigest !== mapping.requestDigest
    || !isDigest(value.inputDigest) || mapping.request.inputDigest === null
    || value.inputDigest !== mapping.request.inputDigest
    || !isDigest(value.generationDigest) || value.generationDigest !== mapping.request.generationDigest
    || value.generationDigest !== generation.generationDigest) {
    return denied("HMI_CONTRIBUTE_BINDING_DENIED");
  }
  if (value.preparationStatus !== "PREPARATION_ONLY"
    || canonicalJson(value.preflightReasons) !== canonicalJson(requiredPreflightReasons)
    || value.evidenceStatus !== "LOCAL_SYNTHETIC") {
    return denied("HMI_CONTRIBUTE_PREPARATION_DENIED");
  }

  const subjectCapabilityIds = sortedUnique(value.subjectCapabilityIds, 0, 4);
  const mappedSelectors = [...mapping.request.selectors].sort();
  if (subjectCapabilityIds === null || subjectCapabilityIds.length !== 0
    || canonicalJson(subjectCapabilityIds) !== canonicalJson(mappedSelectors)) {
    return denied("HMI_CONTRIBUTE_SUBJECT_DENIED");
  }

  const citedSourceIds = sortedUnique(value.citedSourceIds, 1, mapping.request.limits.maxReferences);
  const generationSources = new Set(bundle.manifest.provenance.map((item) => item.sourceId));
  if (citedSourceIds === null || citedSourceIds.some((item) => !generationSources.has(item))) {
    return denied("HMI_CONTRIBUTE_CITATION_DENIED");
  }
  if (!exactKeys(value.authority, ["requestedRights", "routeIds", "writeTargets"])) {
    return denied("HMI_CONTRIBUTE_SCHEMA_DENIED");
  }
  const authorityLists = [value.authority.requestedRights, value.authority.routeIds, value.authority.writeTargets];
  if (!authorityLists.every(Array.isArray) || authorityLists.some((items) => (items as unknown[]).length !== 0)) {
    return denied("HMI_CONTRIBUTE_AUTHORITY_DENIED");
  }
  if (!exactKeys(value.effects, ["submissionPerformed", "publicationPerformed"])) {
    return denied("HMI_CONTRIBUTE_SCHEMA_DENIED");
  }
  if (value.effects.submissionPerformed !== false || value.effects.publicationPerformed !== false) {
    return denied("HMI_CONTRIBUTE_EFFECT_DENIED");
  }

  const payload: HmiContributePreflightV1 = {
    schemaVersion: HMI_CONTRIBUTE_PREFLIGHT_SCHEMA_V1,
    operation: "contribute",
    requestDigest: value.requestDigest,
    inputDigest: value.inputDigest,
    generationDigest: value.generationDigest,
    preparationStatus: "PREPARATION_ONLY",
    preflightReasons: ["CONTRIBUTION_CAPABILITY_ABSENT", "PUBLICATION_ROUTE_ABSENT"],
    subjectCapabilityIds,
    citedSourceIds,
    evidenceStatus: "LOCAL_SYNTHETIC",
    authority: { requestedRights: [], routeIds: [], writeTargets: [] },
    effects: { submissionPerformed: false, publicationPerformed: false },
  };
  const canonicalBytes = canonicalJson(payload);
  return { outcome: "ACCEPTED", payload, canonicalBytes, payloadDigest: sha256(canonicalBytes) };
}
