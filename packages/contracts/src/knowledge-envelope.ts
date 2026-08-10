import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const KNOWLEDGE_ENVELOPE_SCHEMA_V1 = "chimpmaera.knowledge/envelope/v1" as const;
export const KNOWLEDGE_TAXONOMY_SCHEMA_V1 = "chimpmaera.knowledge/taxonomy/v1" as const;
export const KNOWLEDGE_SELECTION_SCHEMA_V1 = "chimpmaera.knowledge/selection/v1" as const;
export const KNOWLEDGE_EXPLANATION_SCHEMA_V1 = "chimpmaera.hmi/knowledge-explanation/v1" as const;
export const KNOWLEDGE_AUTHORITY_BOUNDARY_V1 =
  "READ_ONLY_KNOWLEDGE_NO_CREDENTIAL_POLICY_CAPABILITY_TOOL_WRITE_OR_EXECUTION_AUTHORITY" as const;

export type KnowledgeKindV1 = "CLAIM" | "OBSERVATION" | "PROCEDURE" | "DEFINITION" | "RELATIONSHIP" | "UNRESOLVED" | string;
export type EpistemicStatusV1 = "VERIFIED" | "SUPPORTED" | "UNVERIFIED" | "DISPUTED" | "UNRESOLVED";
export type KnowledgeReasonV1 =
  | "SELECTED_CURATED" | "SELECTED_EXPLORATORY" | "SCOPE_MISMATCH" | "KIND_UNSUPPORTED"
  | "UNVERIFIED_DENIED" | "UNRESOLVED_DENIED" | "CONFLICT_DENIED" | "TRUST_DENIED"
  | "STALE_EVIDENCE_DENIED" | "MISSING_EVIDENCE_DENIED" | "SENSITIVITY_DENIED"
  | "LICENSE_DENIED" | "USE_DENIED" | "DIGEST_TAMPERED_DENIED" | "CIRCULAR_DERIVATION_DENIED"
  | "TAXONOMY_MISMATCH_DENIED" | "AUTHORITY_DENIED" | "SCHEMA_DENIED";

export interface KnowledgeTaxonomyV1 {
  readonly schemaVersion: typeof KNOWLEDGE_TAXONOMY_SCHEMA_V1;
  readonly taxonomyId: string;
  readonly generation: number;
  readonly priorGeneration: number | null;
  readonly kinds: readonly string[];
  readonly migrations: readonly { readonly fromKind: string; readonly toKind: string }[];
  readonly compatibility: "STRICT_ADDITIVE_OR_EXPLICIT_RENAME";
  readonly taxonomyDigest: string;
}

export interface KnowledgeEnvelopeV1 {
  readonly schemaVersion: typeof KNOWLEDGE_ENVELOPE_SCHEMA_V1;
  readonly envelopeId: string;
  readonly taxonomy: { readonly taxonomyId: string; readonly generation: number; readonly taxonomyDigest: string };
  readonly scope: { readonly namespace: string; readonly audience: "PUBLIC_SYNTHETIC" | "OWNER_PRIVATE" };
  readonly kind: KnowledgeKindV1;
  readonly statement: string;
  readonly attribution: readonly {
    readonly sourceId: string; readonly citation: string; readonly sourceDigest: string;
    readonly observedAtMs: number; readonly licence: "CC0-1.0" | "CC-BY-4.0" | "APACHE-2.0" | "OWNER_AUTHORIZED";
  }[];
  readonly epistemicStatus: EpistemicStatusV1;
  readonly trust: "LOW" | "MEDIUM" | "HIGH";
  readonly freshness: { readonly assessedAtMs: number; readonly staleAfterMs: number };
  readonly sensitivity: "PUBLIC" | "INTERNAL" | "RESTRICTED";
  readonly permittedUses: readonly ("CURATED_READ" | "EXPLORATORY_READ" | "KNOWLEDGE_GENERATION_CANDIDATE")[];
  readonly conflictsWith: readonly string[];
  readonly derivedFrom: readonly string[];
  readonly generationCandidate: "ACCEPTED" | "NOT_CANDIDATE";
  readonly authority: {
    readonly credentials: readonly []; readonly policyApprovals: readonly []; readonly capabilities: readonly [];
    readonly toolAccess: readonly []; readonly writeTargets: readonly []; readonly executionRoutes: readonly [];
  };
  readonly authorityBoundary: typeof KNOWLEDGE_AUTHORITY_BOUNDARY_V1;
  readonly envelopeDigest: string;
}

export interface KnowledgeSelectionPolicyV1 {
  readonly mode: "CURATED" | "EXPLORATORY";
  readonly scopeNamespace: string;
  readonly allowedSensitivity: readonly KnowledgeEnvelopeV1["sensitivity"][];
  readonly allowedLicences: readonly string[];
  readonly minimumTrust: KnowledgeEnvelopeV1["trust"];
  readonly evaluatedAtMs: number;
  readonly allowUnresolvedExploratory: boolean;
  readonly maxResults: number;
}

export interface KnowledgeSelectionV1 {
  readonly schemaVersion: typeof KNOWLEDGE_SELECTION_SCHEMA_V1;
  readonly mode: KnowledgeSelectionPolicyV1["mode"];
  readonly scopeNamespace: string;
  readonly taxonomyId: string;
  readonly taxonomyGeneration: number;
  readonly taxonomyDigest: string;
  readonly selected: readonly { readonly envelopeId: string; readonly envelopeDigest: string; readonly reason: KnowledgeReasonV1 }[];
  readonly rejected: readonly { readonly envelopeId: string; readonly envelopeDigest: string; readonly reasons: readonly KnowledgeReasonV1[] }[];
  readonly residualConflicts: readonly { readonly envelopeId: string; readonly conflictsWith: readonly string[] }[];
  readonly authorityBoundary: typeof KNOWLEDGE_AUTHORITY_BOUNDARY_V1;
  readonly selectionDigest: string;
}

const sha256 = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => record(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const id = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
const unique = (value: unknown, predicate: (item: unknown) => boolean, min = 0, max = 32): value is string[] => Array.isArray(value) && value.length >= min && value.length <= max && value.every(predicate) && new Set(value).size === value.length;
const text = (value: unknown, max = 512): value is string => typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);
const timestamp = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

export function knowledgeTaxonomyDigestV1(value: Omit<KnowledgeTaxonomyV1, "taxonomyDigest"> | Record<string, unknown>): string {
  return sha256(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "taxonomyDigest")));
}

export function knowledgeEnvelopeDigestV1(value: Omit<KnowledgeEnvelopeV1, "envelopeDigest"> | Record<string, unknown>): string {
  return sha256(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "envelopeDigest")));
}

export function validateKnowledgeTaxonomyV1(value: unknown): value is KnowledgeTaxonomyV1 {
  if (!exact(value, ["schemaVersion", "taxonomyId", "generation", "priorGeneration", "kinds", "migrations", "compatibility", "taxonomyDigest"])
    || value.schemaVersion !== KNOWLEDGE_TAXONOMY_SCHEMA_V1 || !id(value.taxonomyId)
    || !Number.isSafeInteger(value.generation) || (value.generation as number) < 1
    || !(value.priorGeneration === null || Number.isSafeInteger(value.priorGeneration))
    || !unique(value.kinds, (item) => typeof item === "string" && /^[A-Z][A-Z0-9_]{1,47}$/.test(item), 6)
    || !Array.isArray(value.migrations) || !value.migrations.every((item) => exact(item, ["fromKind", "toKind"]) && (value.kinds as string[]).includes(item.toKind as string))
    || value.compatibility !== "STRICT_ADDITIVE_OR_EXPLICIT_RENAME" || !digest(value.taxonomyDigest)) return false;
  return knowledgeTaxonomyDigestV1(value) === value.taxonomyDigest;
}

export function migrateKnowledgeTaxonomyV1(prior: KnowledgeTaxonomyV1, candidate: KnowledgeTaxonomyV1): { outcome: "ACTIVATED"; active: KnowledgeTaxonomyV1; lastKnownGood: KnowledgeTaxonomyV1 } | { outcome: "DENIED"; active: KnowledgeTaxonomyV1; lastKnownGood: KnowledgeTaxonomyV1; reason: "UNSAFE_MIGRATION_DENIED" } {
  const safe = validateKnowledgeTaxonomyV1(prior) && validateKnowledgeTaxonomyV1(candidate)
    && candidate.taxonomyId === prior.taxonomyId && candidate.generation === prior.generation + 1
    && candidate.priorGeneration === prior.generation
    && prior.kinds.every((kind) => candidate.kinds.includes(kind) || candidate.migrations.some((migration) => migration.fromKind === kind))
    && candidate.migrations.every((migration) => prior.kinds.includes(migration.fromKind) && migration.fromKind !== migration.toKind)
    && new Set(candidate.migrations.map((migration) => migration.fromKind)).size === candidate.migrations.length
    && new Set(candidate.migrations.map((migration) => migration.toKind)).size === candidate.migrations.length;
  return safe ? { outcome: "ACTIVATED", active: candidate, lastKnownGood: prior }
    : { outcome: "DENIED", active: prior, lastKnownGood: prior, reason: "UNSAFE_MIGRATION_DENIED" };
}

function authorityEmpty(value: unknown): boolean {
  return exact(value, ["credentials", "policyApprovals", "capabilities", "toolAccess", "writeTargets", "executionRoutes"])
    && Object.values(value).every((item) => Array.isArray(item) && item.length === 0);
}

export function validateKnowledgeEnvelopeV1(value: unknown, taxonomy: KnowledgeTaxonomyV1): readonly KnowledgeReasonV1[] {
  if (!validateKnowledgeTaxonomyV1(taxonomy) || !exact(value, ["schemaVersion", "envelopeId", "taxonomy", "scope", "kind", "statement", "attribution", "epistemicStatus", "trust", "freshness", "sensitivity", "permittedUses", "conflictsWith", "derivedFrom", "generationCandidate", "authority", "authorityBoundary", "envelopeDigest"])) return ["SCHEMA_DENIED"];
  if (value.authorityBoundary !== KNOWLEDGE_AUTHORITY_BOUNDARY_V1 || !authorityEmpty(value.authority)) return ["AUTHORITY_DENIED"];
  if (value.schemaVersion !== KNOWLEDGE_ENVELOPE_SCHEMA_V1 || !id(value.envelopeId) || !exact(value.taxonomy, ["taxonomyId", "generation", "taxonomyDigest"])
    || !exact(value.scope, ["namespace", "audience"]) || !text(value.scope.namespace, 96) || !["PUBLIC_SYNTHETIC", "OWNER_PRIVATE"].includes(value.scope.audience as string)
    || !text(value.statement, 2048) || !["VERIFIED", "SUPPORTED", "UNVERIFIED", "DISPUTED", "UNRESOLVED"].includes(value.epistemicStatus as string)
    || !["LOW", "MEDIUM", "HIGH"].includes(value.trust as string) || !["PUBLIC", "INTERNAL", "RESTRICTED"].includes(value.sensitivity as string)
    || !exact(value.freshness, ["assessedAtMs", "staleAfterMs"]) || !timestamp(value.freshness.assessedAtMs) || !timestamp(value.freshness.staleAfterMs)
    || !unique(value.permittedUses, (item) => ["CURATED_READ", "EXPLORATORY_READ", "KNOWLEDGE_GENERATION_CANDIDATE"].includes(item as string), 1)
    || !unique(value.conflictsWith, id) || !unique(value.derivedFrom, id) || !["ACCEPTED", "NOT_CANDIDATE"].includes(value.generationCandidate as string)
    || !digest(value.envelopeDigest)) return ["SCHEMA_DENIED"];
  if (value.taxonomy.taxonomyId !== taxonomy.taxonomyId || value.taxonomy.generation !== taxonomy.generation || value.taxonomy.taxonomyDigest !== taxonomy.taxonomyDigest) return ["TAXONOMY_MISMATCH_DENIED"];
  if (!taxonomy.kinds.includes(value.kind as string)) return ["KIND_UNSUPPORTED"];
  if (!Array.isArray(value.attribution) || value.attribution.length < 1 || value.attribution.length > 16 || !value.attribution.every((source) => exact(source, ["sourceId", "citation", "sourceDigest", "observedAtMs", "licence"]) && id(source.sourceId) && text(source.citation, 512) && digest(source.sourceDigest) && timestamp(source.observedAtMs) && ["CC0-1.0", "CC-BY-4.0", "APACHE-2.0", "OWNER_AUTHORIZED"].includes(source.licence as string))) return ["MISSING_EVIDENCE_DENIED"];
  if (value.conflictsWith.includes(value.envelopeId as string) || value.derivedFrom.includes(value.envelopeId as string)) return ["CIRCULAR_DERIVATION_DENIED"];
  if (value.generationCandidate === "ACCEPTED" && !value.permittedUses.includes("KNOWLEDGE_GENERATION_CANDIDATE")) return ["USE_DENIED"];
  if (knowledgeEnvelopeDigestV1(value) !== value.envelopeDigest) return ["DIGEST_TAMPERED_DENIED"];
  return [];
}

const trustRank = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
export function selectKnowledgeV1(taxonomy: KnowledgeTaxonomyV1, envelopes: readonly KnowledgeEnvelopeV1[], policy: KnowledgeSelectionPolicyV1): KnowledgeSelectionV1 {
  if (!validateKnowledgeTaxonomyV1(taxonomy) || !timestamp(policy.evaluatedAtMs) || !Number.isSafeInteger(policy.maxResults) || policy.maxResults < 1 || policy.maxResults > 100
    || (policy.mode === "CURATED" && policy.allowUnresolvedExploratory)) throw new Error("KNOWLEDGE_SELECTION_POLICY_DENIED");
  const selected: Array<{ envelopeId: string; envelopeDigest: string; reason: KnowledgeReasonV1 }> = [];
  const rejected: Array<{ envelopeId: string; envelopeDigest: string; reasons: KnowledgeReasonV1[] }> = [];
  const ordered = [...envelopes].sort((a, b) => a.envelopeId.localeCompare(b.envelopeId));
  const byId = new Map(ordered.map((item) => [item.envelopeId, item]));
  const cyclic = new Set<string>();
  const visit = (start: string, current: string, seen: Set<string>): void => {
    const envelope = byId.get(current);
    if (!envelope) return;
    for (const parent of envelope.derivedFrom) {
      if (parent === start) cyclic.add(start);
      else if (!seen.has(parent)) visit(start, parent, new Set([...seen, parent]));
    }
  };
  for (const envelope of ordered) visit(envelope.envelopeId, envelope.envelopeId, new Set([envelope.envelopeId]));
  for (const envelope of ordered) {
    const reasons = [...validateKnowledgeEnvelopeV1(envelope, taxonomy)];
    if (envelope.derivedFrom.some((parent) => !byId.has(parent))) reasons.push("MISSING_EVIDENCE_DENIED");
    if (cyclic.has(envelope.envelopeId)) reasons.push("CIRCULAR_DERIVATION_DENIED");
    if (envelope.scope.namespace !== policy.scopeNamespace) reasons.push("SCOPE_MISMATCH");
    if (!policy.allowedSensitivity.includes(envelope.sensitivity)) reasons.push("SENSITIVITY_DENIED");
    if (envelope.attribution.some((source) => !policy.allowedLicences.includes(source.licence))) reasons.push("LICENSE_DENIED");
    if (trustRank[envelope.trust] < trustRank[policy.minimumTrust]) reasons.push("TRUST_DENIED");
    if (envelope.freshness.staleAfterMs < policy.evaluatedAtMs) reasons.push("STALE_EVIDENCE_DENIED");
    const neededUse = policy.mode === "CURATED" ? "CURATED_READ" : "EXPLORATORY_READ";
    if (!envelope.permittedUses.includes(neededUse)) reasons.push("USE_DENIED");
    if (policy.mode === "CURATED") {
      if (envelope.epistemicStatus === "UNVERIFIED") reasons.push("UNVERIFIED_DENIED");
      if (envelope.epistemicStatus === "UNRESOLVED") reasons.push("UNRESOLVED_DENIED");
      if (envelope.epistemicStatus === "DISPUTED" || envelope.conflictsWith.length > 0) reasons.push("CONFLICT_DENIED");
    } else if (["UNVERIFIED", "UNRESOLVED", "DISPUTED"].includes(envelope.epistemicStatus) && !policy.allowUnresolvedExploratory) reasons.push("UNRESOLVED_DENIED");
    const stableReasons = [...new Set(reasons)];
    if (stableReasons.length === 0 && selected.length < policy.maxResults) selected.push({ envelopeId: envelope.envelopeId, envelopeDigest: envelope.envelopeDigest, reason: policy.mode === "CURATED" ? "SELECTED_CURATED" : "SELECTED_EXPLORATORY" });
    else rejected.push({ envelopeId: envelope.envelopeId, envelopeDigest: envelope.envelopeDigest, reasons: stableReasons.length ? stableReasons : ["USE_DENIED"] });
  }
  const residualConflicts = ordered.filter((item) => item.conflictsWith.length > 0).map((item) => ({ envelopeId: item.envelopeId, conflictsWith: [...item.conflictsWith].sort() }));
  const unsigned = { schemaVersion: KNOWLEDGE_SELECTION_SCHEMA_V1, mode: policy.mode, scopeNamespace: policy.scopeNamespace, taxonomyId: taxonomy.taxonomyId, taxonomyGeneration: taxonomy.generation, taxonomyDigest: taxonomy.taxonomyDigest, selected, rejected, residualConflicts, authorityBoundary: KNOWLEDGE_AUTHORITY_BOUNDARY_V1 } as const;
  return { ...unsigned, selectionDigest: sha256(unsigned) };
}

export function explainKnowledgeSelectionV1(selection: KnowledgeSelectionV1, envelopes: readonly KnowledgeEnvelopeV1[]) {
  const byId = new Map(envelopes.map((item) => [item.envelopeId, item]));
  const explain = (item: { envelopeId: string; envelopeDigest: string; reason?: KnowledgeReasonV1; reasons?: readonly KnowledgeReasonV1[] }) => {
    const envelope = byId.get(item.envelopeId);
    if (!envelope || envelope.envelopeDigest !== item.envelopeDigest) throw new Error("KNOWLEDGE_EXPLANATION_BINDING_DENIED");
    return { envelopeId: envelope.envelopeId, envelopeDigest: envelope.envelopeDigest, kind: envelope.kind, epistemicStatus: envelope.epistemicStatus, citations: envelope.attribution.map((source) => ({ sourceId: source.sourceId, citation: source.citation, sourceDigest: source.sourceDigest })), rationale: item.reason ? [item.reason] : item.reasons, conflictsWith: envelope.conflictsWith };
  };
  return { schemaVersion: KNOWLEDGE_EXPLANATION_SCHEMA_V1, operation: "explain", readOnly: true, scopeNamespace: selection.scopeNamespace, taxonomy: { taxonomyId: selection.taxonomyId, generation: selection.taxonomyGeneration, taxonomyDigest: selection.taxonomyDigest }, generation: { selectionDigest: selection.selectionDigest }, selected: selection.selected.map(explain), rejected: selection.rejected.map(explain), residualConflicts: selection.residualConflicts, authority: { credentials: [], policyApprovals: [], capabilities: [], toolAccess: [], writeTargets: [], executionRoutes: [] }, authorityBoundary: KNOWLEDGE_AUTHORITY_BOUNDARY_V1 } as const;
}
