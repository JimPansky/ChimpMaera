import { canonicalJson } from "./canonical-json.js";
import {
  KNOWLEDGE_AUTHORITY_BOUNDARY_V1,
  KNOWLEDGE_ENVELOPE_SCHEMA_V1,
  knowledgeEnvelopeDigestV1,
  validateKnowledgeEnvelopeV1,
  validateKnowledgeTaxonomyV1,
  type EpistemicStatusV1,
  type KnowledgeEnvelopeV1,
  type KnowledgeTaxonomyV1,
} from "./knowledge-envelope.js";

export const PLUGIN_KNOWLEDGE_HARVEST_SCHEMA_V1 =
  "chimpmaera.knowledge/plugin-harvest-request/v1" as const;
export const PLUGIN_KNOWLEDGE_HARVEST_BOUNDARY_V1 =
  "EVIDENCE_ONLY_UNTRUSTED_DATA_NO_INSTRUCTION_TRUTH_AUTHORITY_EXECUTION_OR_INGESTION" as const;

export type PluginKnowledgeSourceKindV1 =
  | "OFFICIAL_PRIMARY_SOURCE"
  | "PINNED_PLUGIN_METADATA"
  | "ETL02_PREFLIGHT";
export type PluginKnowledgeEvidencePolarityV1 = "POSITIVE" | "NEGATIVE" | "UNKNOWN";
export type PluginKnowledgeKindV1 = "OBSERVATION" | "CLAIM" | "PROCEDURE" | "UNRESOLVED";

export interface PluginKnowledgeHarvestRequestV1 {
  readonly schemaVersion: typeof PLUGIN_KNOWLEDGE_HARVEST_SCHEMA_V1;
  readonly taxonomy: KnowledgeTaxonomyV1;
  readonly scope: {
    readonly namespace: string;
    readonly audience: "PUBLIC_SYNTHETIC" | "OWNER_PRIVATE";
  };
  readonly source: {
    readonly sourceId: string;
    readonly kind: PluginKnowledgeSourceKindV1;
    readonly locator: string;
    readonly snapshotDigest: string;
    readonly citation: string;
    readonly selector: string;
    readonly observedAtMs: number;
    readonly reviewedAtMs: number;
    readonly expiresAtMs: number;
    readonly licence: KnowledgeEnvelopeV1["attribution"][number]["licence"];
    readonly permittedUses: KnowledgeEnvelopeV1["permittedUses"];
  };
  readonly records: readonly {
    readonly envelopeId: string;
    readonly kind: PluginKnowledgeKindV1;
    readonly evidencePolarity: PluginKnowledgeEvidencePolarityV1;
    readonly statement: string;
    readonly epistemicStatus: EpistemicStatusV1;
    readonly trust: KnowledgeEnvelopeV1["trust"];
    readonly sensitivity: KnowledgeEnvelopeV1["sensitivity"];
    readonly conflictsWith: readonly string[];
    readonly derivedFrom: readonly string[];
  }[];
}

export interface PluginKnowledgeHarvestResultV1 {
  readonly sourceSnapshotDigest: string;
  readonly envelopes: readonly KnowledgeEnvelopeV1[];
  readonly authorityBoundary: typeof PLUGIN_KNOWLEDGE_HARVEST_BOUNDARY_V1;
}

export interface PluginKnowledgeSourceInvalidationV1 {
  readonly sourceId: string;
  readonly replacementSnapshotDigest: string;
  readonly invalidatedEnvelopeIds: readonly string[];
  readonly downgradedEnvelopes: readonly KnowledgeEnvelopeV1[];
  readonly authorityBoundary: typeof PLUGIN_KNOWLEDGE_HARVEST_BOUNDARY_V1;
}

const DIGEST = /^[a-f0-9]{64}$/;
const ID = /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/;
const ALLOWED_USES = ["CURATED_READ", "EXPLORATORY_READ", "KNOWLEDGE_GENERATION_CANDIDATE"] as const;
const USE_ORDER = new Map(ALLOWED_USES.map((value, index) => [value, index]));
const LICENCES = ["CC0-1.0", "CC-BY-4.0", "APACHE-2.0", "MIT", "OWNER_AUTHORIZED"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function isSafeJsonData(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value));
  if (typeof value !== "object" || ancestors.has(value)) return false;
  const next = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return false;
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable
        || !isSafeJsonData(descriptor.value, next)) return false;
    }
    return keys.every((key) => key === "length" || (typeof key === "string" && /^(0|[1-9][0-9]*)$/.test(key)));
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || ["__proto__", "constructor", "prototype"].includes(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable
      || !isSafeJsonData(descriptor.value, next)) return false;
  }
  return true;
}

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max
    && !/[\u0000-\u001f]/.test(value);
}

function timestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function uniqueIds(value: unknown, max = 32): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every((item) => typeof item === "string" && ID.test(item))
    && new Set(value).size === value.length;
}

function validRequest(value: unknown): value is PluginKnowledgeHarvestRequestV1 {
  if (!isSafeJsonData(value)
    || !exact(value, ["schemaVersion", "taxonomy", "scope", "source", "records"])
    || value.schemaVersion !== PLUGIN_KNOWLEDGE_HARVEST_SCHEMA_V1
    || !validateKnowledgeTaxonomyV1(value.taxonomy)
    || !exact(value.scope, ["namespace", "audience"])
    || !text(value.scope.namespace, 96)
    || !["PUBLIC_SYNTHETIC", "OWNER_PRIVATE"].includes(String(value.scope.audience))
    || !exact(value.source, ["sourceId", "kind", "locator", "snapshotDigest", "citation", "selector", "observedAtMs", "reviewedAtMs", "expiresAtMs", "licence", "permittedUses"])
    || typeof value.source.sourceId !== "string" || !ID.test(value.source.sourceId)
    || !["OFFICIAL_PRIMARY_SOURCE", "PINNED_PLUGIN_METADATA", "ETL02_PREFLIGHT"].includes(String(value.source.kind))
    || typeof value.source.snapshotDigest !== "string" || !DIGEST.test(value.source.snapshotDigest)
    || value.source.locator !== `content+sha256:${value.source.snapshotDigest}`
    || !text(value.source.citation, 300) || !text(value.source.selector, 160)
    || !timestamp(value.source.observedAtMs) || !timestamp(value.source.reviewedAtMs) || !timestamp(value.source.expiresAtMs)
    || (value.source.observedAtMs as number) > (value.source.reviewedAtMs as number)
    || (value.source.reviewedAtMs as number) >= (value.source.expiresAtMs as number)
    || !LICENCES.includes(value.source.licence as typeof LICENCES[number])
    || !Array.isArray(value.source.permittedUses) || value.source.permittedUses.length === 0
    || value.source.permittedUses.length > ALLOWED_USES.length
    || !value.source.permittedUses.every((use) => ALLOWED_USES.includes(use as typeof ALLOWED_USES[number]))
    || new Set(value.source.permittedUses).size !== value.source.permittedUses.length
    || !Array.isArray(value.records) || value.records.length === 0 || value.records.length > 128) return false;

  const envelopeIds = new Set<string>();
  for (const item of value.records) {
    if (!exact(item, ["envelopeId", "kind", "evidencePolarity", "statement", "epistemicStatus", "trust", "sensitivity", "conflictsWith", "derivedFrom"])
      || typeof item.envelopeId !== "string" || !ID.test(item.envelopeId) || envelopeIds.has(item.envelopeId)
      || !["OBSERVATION", "CLAIM", "PROCEDURE", "UNRESOLVED"].includes(String(item.kind))
      || !["POSITIVE", "NEGATIVE", "UNKNOWN"].includes(String(item.evidencePolarity))
      || !text(item.statement, 2048)
      || !["VERIFIED", "SUPPORTED", "UNVERIFIED", "DISPUTED", "UNRESOLVED"].includes(String(item.epistemicStatus))
      || !["LOW", "MEDIUM", "HIGH"].includes(String(item.trust))
      || !["PUBLIC", "INTERNAL", "RESTRICTED"].includes(String(item.sensitivity))
      || !uniqueIds(item.conflictsWith) || !uniqueIds(item.derivedFrom)
      || item.conflictsWith.includes(item.envelopeId) || item.derivedFrom.includes(item.envelopeId)
      || (item.kind === "UNRESOLVED" && item.epistemicStatus !== "UNRESOLVED")
      || (item.evidencePolarity === "UNKNOWN" && item.epistemicStatus !== "UNRESOLVED")
      || (item.conflictsWith.length > 0 && !["DISPUTED", "UNRESOLVED"].includes(String(item.epistemicStatus)))) return false;
    envelopeIds.add(item.envelopeId);
  }
  return true;
}

function normalizedUses(
  sourceUses: KnowledgeEnvelopeV1["permittedUses"],
  item: PluginKnowledgeHarvestRequestV1["records"][number],
): KnowledgeEnvelopeV1["permittedUses"] {
  const eligible = ["VERIFIED", "SUPPORTED"].includes(item.epistemicStatus)
    && item.evidencePolarity !== "UNKNOWN" && item.conflictsWith.length === 0;
  const uses = eligible ? [...sourceUses] : sourceUses.filter((use) => use === "EXPLORATORY_READ");
  if (uses.length === 0) uses.push("EXPLORATORY_READ");
  return uses.sort((left, right) => (USE_ORDER.get(left) ?? 99) - (USE_ORDER.get(right) ?? 99));
}

export function harvestPluginKnowledgeV1(value: unknown): PluginKnowledgeHarvestResultV1 {
  if (!validRequest(value)) throw new Error("PLUGIN_KNOWLEDGE_INPUT_DENIED");
  const citation = `${value.source.citation} | selector=${value.source.selector} | evidence=`;
  const envelopes = [...value.records].sort((left, right) => left.envelopeId.localeCompare(right.envelopeId)).map((item) => {
    const permittedUses = normalizedUses(value.source.permittedUses, item);
    const eligible = ["VERIFIED", "SUPPORTED"].includes(item.epistemicStatus)
      && item.evidencePolarity !== "UNKNOWN" && item.conflictsWith.length === 0
      && permittedUses.includes("KNOWLEDGE_GENERATION_CANDIDATE");
    const unsigned: Omit<KnowledgeEnvelopeV1, "envelopeDigest"> = {
      schemaVersion: KNOWLEDGE_ENVELOPE_SCHEMA_V1,
      envelopeId: item.envelopeId,
      taxonomy: {
        taxonomyId: value.taxonomy.taxonomyId,
        generation: value.taxonomy.generation,
        taxonomyDigest: value.taxonomy.taxonomyDigest,
      },
      scope: { namespace: value.scope.namespace, audience: value.scope.audience },
      kind: item.kind,
      statement: item.statement,
      attribution: [{
        sourceId: value.source.sourceId,
        citation: `${citation}${item.evidencePolarity}`,
        sourceDigest: value.source.snapshotDigest,
        observedAtMs: value.source.observedAtMs,
        licence: value.source.licence,
      }],
      epistemicStatus: item.epistemicStatus,
      trust: item.epistemicStatus === "UNRESOLVED" ? "LOW" : item.trust,
      freshness: { assessedAtMs: value.source.reviewedAtMs, staleAfterMs: value.source.expiresAtMs },
      sensitivity: item.sensitivity,
      permittedUses,
      conflictsWith: [...item.conflictsWith].sort(),
      derivedFrom: [...item.derivedFrom].sort(),
      generationCandidate: eligible ? "ACCEPTED" : "NOT_CANDIDATE",
      authority: { credentials: [], policyApprovals: [], capabilities: [], toolAccess: [], writeTargets: [], executionRoutes: [] },
      authorityBoundary: KNOWLEDGE_AUTHORITY_BOUNDARY_V1,
    };
    return { ...unsigned, envelopeDigest: knowledgeEnvelopeDigestV1(unsigned) };
  });
  if (envelopes.some((envelope) => validateKnowledgeEnvelopeV1(envelope, value.taxonomy).length > 0)) {
    throw new Error("PLUGIN_KNOWLEDGE_OUTPUT_DENIED");
  }
  return {
    sourceSnapshotDigest: value.source.snapshotDigest,
    envelopes,
    authorityBoundary: PLUGIN_KNOWLEDGE_HARVEST_BOUNDARY_V1,
  };
}

export function invalidatePluginKnowledgeForSourceChangeV1(
  taxonomy: KnowledgeTaxonomyV1,
  priorEnvelopes: readonly KnowledgeEnvelopeV1[],
  sourceId: string,
  replacementSnapshotDigest: string,
  reviewedAtMs: number,
): PluginKnowledgeSourceInvalidationV1 {
  if (!validateKnowledgeTaxonomyV1(taxonomy) || !Array.isArray(priorEnvelopes)
    || typeof sourceId !== "string" || !ID.test(sourceId) || !DIGEST.test(replacementSnapshotDigest)
    || !timestamp(reviewedAtMs)
    || priorEnvelopes.some((envelope) => validateKnowledgeEnvelopeV1(envelope, taxonomy).length > 0)) {
    throw new Error("PLUGIN_KNOWLEDGE_INVALIDATION_INPUT_DENIED");
  }
  const affected = priorEnvelopes
    .filter((envelope) => envelope.attribution.some((source: KnowledgeEnvelopeV1["attribution"][number]) => source.sourceId === sourceId && source.sourceDigest !== replacementSnapshotDigest))
    .sort((left, right) => left.envelopeId.localeCompare(right.envelopeId));
  const downgradedEnvelopes = affected.map((envelope) => {
    const unsigned: Omit<KnowledgeEnvelopeV1, "envelopeDigest"> = {
      ...envelope,
      epistemicStatus: "UNRESOLVED",
      trust: "LOW",
      freshness: { assessedAtMs: reviewedAtMs, staleAfterMs: reviewedAtMs },
      permittedUses: ["EXPLORATORY_READ"],
      generationCandidate: "NOT_CANDIDATE",
    };
    return { ...unsigned, envelopeDigest: knowledgeEnvelopeDigestV1(unsigned) };
  });
  return {
    sourceId,
    replacementSnapshotDigest,
    invalidatedEnvelopeIds: affected.map((envelope) => envelope.envelopeId),
    downgradedEnvelopes,
    authorityBoundary: PLUGIN_KNOWLEDGE_HARVEST_BOUNDARY_V1,
  };
}
