import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import { KNOWLEDGE_AUTHORITY_BOUNDARY_V1, type KnowledgeEnvelopeV1, type KnowledgeTaxonomyV1, validateKnowledgeEnvelopeV1, validateKnowledgeTaxonomyV1 } from "./knowledge-envelope.js";

export const CONTRIBUTION_ENVELOPE_SCHEMA_V1 = "chimpmaera.knowledge/contribution-envelope/v1" as const;
export const QUALIFICATION_RECEIPT_SCHEMA_V1 = "chimpmaera.knowledge/qualification-receipt/v1" as const;
export const KNOWLEDGE_EDITION_SCHEMA_V1 = "chimpmaera.knowledge/edition/v1" as const;
export const KNOWLEDGE_LKG_POINTER_SCHEMA_V1 = "chimpmaera.knowledge/lkg-pointer/v1" as const;
export const APPLICABILITY_VOCABULARY_V1 = "chimpmaera.knowledge/applicability-vocabulary/v1" as const;

export const APPLICABILITY_DIMENSIONS_V1 = [
  "domain", "knowledge_type", "role_responsibility", "industry", "organization_context",
  "geography_jurisdiction_policy", "process_stage", "system_config",
  "prerequisites_constraints_exceptions", "task_audience_outcome", "valid_time_freshness",
  "epistemic_status", "evidence_strength", "sensitivity", "license",
] as const;
export type ApplicabilityDimensionV1 = typeof APPLICABILITY_DIMENSIONS_V1[number];
export type ApplicabilityStateV1 = "VALUE" | "UNKNOWN" | "NOT_PROVIDED" | "NOT_APPLICABLE" | "EXPLICITLY_UNRESTRICTED";
export type ApplicabilityProvenanceV1 = "DECLARED" | "EVIDENCE_DERIVED" | "INFERRED";
export type ApplicabilityValueV1 = Readonly<{ state: ApplicabilityStateV1; values: readonly string[]; provenance: ApplicabilityProvenanceV1 | null }>;
export type ApplicabilityScopeV1 = Readonly<Record<ApplicabilityDimensionV1, ApplicabilityValueV1>>;
export type RelationKindV1 = "EXACT_DUPLICATE" | "EQUIVALENT" | "CORE_PLUS_CONTEXTUAL_DELTA" | "SUBSUMPTION" | "DISJOINT_VARIANT" | "OVERLAPPING_CONFLICT";
export interface RelationProposalV1 {
  readonly leftClaimId: string; readonly rightClaimId: string; readonly kind: RelationKindV1; readonly rationale: string;
  readonly commonCore: string | null; readonly leftContextualDelta: string | null; readonly rightContextualDelta: string | null;
  readonly subsumingClaimId: string | null; readonly subsumedClaimId: string | null;
}

export interface AtomicClaimV1 {
  readonly claimId: string;
  readonly statement: string;
  readonly selector: { readonly encoding: "UTF16_CODE_UNIT_OFFSET"; readonly start: number; readonly end: number; readonly exact: string };
  readonly submissionDigest: string;
  readonly applicability: ApplicabilityScopeV1;
  readonly evidenceRefs: readonly string[];
}

export interface ContributionEnvelopeV1 {
  readonly schemaVersion: typeof CONTRIBUTION_ENVELOPE_SCHEMA_V1;
  readonly contributionId: string;
  readonly rawInput: string;
  readonly submissionDigest: string;
  readonly licence: "CC0-1.0" | "CC-BY-4.0" | "APACHE-2.0" | "OWNER_AUTHORIZED" | "UNKNOWN";
  readonly dataClassification: "PUBLIC_SYNTHETIC" | "OWNER_PRIVATE";
  readonly evidenceRefs: readonly string[];
  readonly claims: readonly AtomicClaimV1[];
  readonly contributionDigest: string;
}

export interface QualificationReceiptV1 {
  readonly schemaVersion: typeof QUALIFICATION_RECEIPT_SCHEMA_V1;
  readonly contributionDigest: string;
  readonly configDigest: string;
  readonly acceptedContextDigest: string;
  readonly outcome: "PROPOSED" | "NEEDS_CONTEXT" | "QUARANTINED";
  readonly claims: readonly AtomicClaimV1[];
  readonly relations: readonly RelationProposalV1[];
  readonly questions: readonly { readonly dimension: ApplicabilityDimensionV1; readonly question: string; readonly claimIds: readonly string[] }[];
  readonly quarantine: readonly { readonly reason: "AMBIGUOUS_LICENCE" | "SECRET_DETECTED" | "DISALLOWED_PERSONAL_DATA" | "UNSUPPORTED_EVIDENCE" | "MODEL_OUTPUT_UNAVAILABLE_OR_MALFORMED"; readonly detail: string }[];
  readonly activation: "NOT_AUTHORIZED";
  readonly authorityBoundary: typeof KNOWLEDGE_AUTHORITY_BOUNDARY_V1;
  readonly receiptDigest: string;
}

export interface KnowledgeEditionV1 {
  readonly schemaVersion: typeof KNOWLEDGE_EDITION_SCHEMA_V1;
  readonly editionId: string;
  readonly generation: number;
  readonly priorEditionDigest: string | null;
  readonly taxonomy: { readonly taxonomyId: string; readonly generation: number; readonly taxonomyDigest: string };
  readonly applicabilityVocabulary: typeof APPLICABILITY_VOCABULARY_V1;
  readonly envelopeDigests: readonly string[];
  readonly editionDigest: string;
}
export interface KnowledgeLkgPointerV1 { readonly schemaVersion: typeof KNOWLEDGE_LKG_POINTER_SCHEMA_V1; readonly pointerId: string; readonly editionDigest: string; readonly generation: number; readonly pointerDigest: string }

const sha = (value: unknown): string => createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex");
const plain = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const exact = (v: unknown, keys: readonly string[]): v is Record<string, unknown> => plain(v) && canonicalJson(Object.keys(v).sort()) === canonicalJson([...keys].sort());
const hex = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const bounded = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v);
const identifier = (v: unknown): v is string => typeof v === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(v);
const uniqueStrings = (v: unknown, max = 32): v is string[] => Array.isArray(v) && v.length <= max && v.every((x) => bounded(x, 160)) && new Set(v).size === v.length;
const withoutDigest = (v: Record<string, unknown>, field: string) => Object.fromEntries(Object.entries(v).filter(([key]) => key !== field));
export const contributionEnvelopeDigestV1 = (v: Omit<ContributionEnvelopeV1, "contributionDigest"> | Record<string, unknown>) => sha(withoutDigest(v as Record<string, unknown>, "contributionDigest"));
export const qualificationReceiptDigestV1 = (v: Omit<QualificationReceiptV1, "receiptDigest"> | Record<string, unknown>) => sha(withoutDigest(v as Record<string, unknown>, "receiptDigest"));
export const knowledgeEditionDigestV1 = (v: Omit<KnowledgeEditionV1, "editionDigest"> | Record<string, unknown>) => sha(withoutDigest(v as Record<string, unknown>, "editionDigest"));
export const knowledgeLkgPointerDigestV1 = (v: Omit<KnowledgeLkgPointerV1, "pointerDigest"> | Record<string, unknown>) => sha(withoutDigest(v as Record<string, unknown>, "pointerDigest"));

function validApplicability(v: unknown): v is ApplicabilityScopeV1 {
  if (!exact(v, APPLICABILITY_DIMENSIONS_V1)) return false;
  return APPLICABILITY_DIMENSIONS_V1.every((dimension) => {
    const item = v[dimension];
    if (!exact(item, ["state", "values", "provenance"]) || !["VALUE", "UNKNOWN", "NOT_PROVIDED", "NOT_APPLICABLE", "EXPLICITLY_UNRESTRICTED"].includes(item.state as string) || !uniqueStrings(item.values, 16)) return false;
    if (item.state === "VALUE") return item.values.length > 0 && ["DECLARED", "EVIDENCE_DERIVED", "INFERRED"].includes(item.provenance as string);
    if ((item.values as unknown[]).length !== 0) return false;
    if (["NOT_APPLICABLE", "EXPLICITLY_UNRESTRICTED"].includes(item.state as string)) return ["DECLARED", "EVIDENCE_DERIVED"].includes(item.provenance as string);
    return item.state === "UNKNOWN" ? item.provenance === null || item.provenance === "INFERRED" : item.provenance === null;
  });
}
function validClaim(v: unknown, raw: string, submissionDigest: string): v is AtomicClaimV1 {
  if (!exact(v, ["claimId", "statement", "selector", "submissionDigest", "applicability", "evidenceRefs"]) || !identifier(v.claimId) || !bounded(v.statement, 2048) || v.submissionDigest !== submissionDigest || !validApplicability(v.applicability) || !uniqueStrings(v.evidenceRefs, 16)) return false;
  if (!exact(v.selector, ["encoding", "start", "end", "exact"]) || v.selector.encoding !== "UTF16_CODE_UNIT_OFFSET" || !Number.isSafeInteger(v.selector.start) || !Number.isSafeInteger(v.selector.end)) return false;
  const start = v.selector.start as number, end = v.selector.end as number;
  return start >= 0 && end > start && end <= raw.length && raw.slice(start, end) === v.selector.exact;
}
export function validateContributionEnvelopeV1(v: unknown): v is ContributionEnvelopeV1 {
  if (!exact(v, ["schemaVersion", "contributionId", "rawInput", "submissionDigest", "licence", "dataClassification", "evidenceRefs", "claims", "contributionDigest"]) || v.schemaVersion !== CONTRIBUTION_ENVELOPE_SCHEMA_V1 || !identifier(v.contributionId) || typeof v.rawInput !== "string" || v.rawInput.length < 1 || v.rawInput.length > 32768 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v.rawInput) || v.submissionDigest !== sha(v.rawInput) || !["CC0-1.0", "CC-BY-4.0", "APACHE-2.0", "OWNER_AUTHORIZED", "UNKNOWN"].includes(v.licence as string) || !["PUBLIC_SYNTHETIC", "OWNER_PRIVATE"].includes(v.dataClassification as string) || !uniqueStrings(v.evidenceRefs, 32) || !Array.isArray(v.claims) || v.claims.length < 1 || v.claims.length > 64 || !hex(v.contributionDigest)) return false;
  const claimIds = v.claims.map((claim) => plain(claim) ? claim.claimId : undefined);
  return new Set(claimIds).size === claimIds.length && v.claims.every((claim) => validClaim(claim, v.rawInput as string, v.submissionDigest as string)) && contributionEnvelopeDigestV1(v) === v.contributionDigest;
}

export interface QualificationConfigV1 { readonly configId: string; readonly materialDimensions: readonly ApplicabilityDimensionV1[]; readonly supportedEvidencePrefixes: readonly string[]; readonly optionalModel: "DISABLED" | "REQUIRED" | "FALLBACK_DETERMINISTIC" }
export type AcceptedContextV1 = Readonly<Partial<Record<ApplicabilityDimensionV1, readonly string[]>>>;
export interface OptionalModelProposalV1 { readonly schemaVersion: "chimpmaera.knowledge/model-proposal/v1"; readonly status: "PROPOSAL"; readonly contributionDigest: string; readonly proposals: readonly { readonly claimId: string; readonly dimension: ApplicabilityDimensionV1; readonly values: readonly string[] }[] }

export function validateQualificationConfigV1(v: unknown): v is QualificationConfigV1 {
  return exact(v, ["configId", "materialDimensions", "supportedEvidencePrefixes", "optionalModel"]) && bounded(v.configId, 96)
    && Array.isArray(v.materialDimensions) && v.materialDimensions.length <= APPLICABILITY_DIMENSIONS_V1.length && new Set(v.materialDimensions).size === v.materialDimensions.length && v.materialDimensions.every((d) => APPLICABILITY_DIMENSIONS_V1.includes(d as ApplicabilityDimensionV1))
    && uniqueStrings(v.supportedEvidencePrefixes, 16) && (v.supportedEvidencePrefixes as string[]).length > 0 && (v.supportedEvidencePrefixes as string[]).every((prefix) => /^[a-z][a-z0-9-]{1,31}:$/.test(prefix))
    && ["DISABLED", "REQUIRED", "FALLBACK_DETERMINISTIC"].includes(v.optionalModel as string);
}
export function validateAcceptedContextV1(v: unknown): v is AcceptedContextV1 {
  return plain(v) && Object.keys(v).every((key) => APPLICABILITY_DIMENSIONS_V1.includes(key as ApplicabilityDimensionV1) && uniqueStrings(v[key], 16) && (v[key] as unknown[]).length > 0);
}
function validateOptionalModelProposalV1(v: unknown, contribution: ContributionEnvelopeV1): v is OptionalModelProposalV1 {
  if (!exact(v, ["schemaVersion", "status", "contributionDigest", "proposals"]) || v.schemaVersion !== "chimpmaera.knowledge/model-proposal/v1" || v.status !== "PROPOSAL" || v.contributionDigest !== contribution.contributionDigest || !Array.isArray(v.proposals) || v.proposals.length > 64) return false;
  const claimIds = new Set(contribution.claims.map((claim) => claim.claimId));
  return v.proposals.every((proposal) => exact(proposal, ["claimId", "dimension", "values"]) && claimIds.has(proposal.claimId as string) && APPLICABILITY_DIMENSIONS_V1.includes(proposal.dimension as ApplicabilityDimensionV1) && uniqueStrings(proposal.values, 16) && (proposal.values as unknown[]).length > 0);
}

export function validateQualificationReceiptV1(v: unknown, contribution: ContributionEnvelopeV1, config: QualificationConfigV1, acceptedContext: AcceptedContextV1, modelOutput?: unknown): v is QualificationReceiptV1 {
  if (!validateContributionEnvelopeV1(contribution) || !validateQualificationConfigV1(config) || !validateAcceptedContextV1(acceptedContext)) return false;
  if (!exact(v, ["schemaVersion", "contributionDigest", "configDigest", "acceptedContextDigest", "outcome", "claims", "relations", "questions", "quarantine", "activation", "authorityBoundary", "receiptDigest"]) || v.schemaVersion !== QUALIFICATION_RECEIPT_SCHEMA_V1 || !hex(v.contributionDigest) || !hex(v.configDigest) || !hex(v.acceptedContextDigest) || !["PROPOSED", "NEEDS_CONTEXT", "QUARANTINED"].includes(v.outcome as string) || !Array.isArray(v.claims) || v.claims.length > 64 || !Array.isArray(v.relations) || v.relations.length > 256 || !Array.isArray(v.questions) || v.questions.length > 15 || !Array.isArray(v.quarantine) || v.quarantine.length > 5 || v.activation !== "NOT_AUTHORIZED" || v.authorityBoundary !== KNOWLEDGE_AUTHORITY_BOUNDARY_V1 || !hex(v.receiptDigest)) return false;
  if (v.contributionDigest !== contribution.contributionDigest || v.configDigest !== sha(config) || v.acceptedContextDigest !== sha(acceptedContext) || canonicalJson(v.claims) !== canonicalJson(contribution.claims)) return false;
  const claimIds = contribution.claims.map((claim) => claim.claimId), claimIdSet = new Set(claimIds);
  if (claimIdSet.size !== claimIds.length) return false;
  if (!v.relations.every((r) => exact(r, ["leftClaimId", "rightClaimId", "kind", "rationale", "commonCore", "leftContextualDelta", "rightContextualDelta", "subsumingClaimId", "subsumedClaimId"]) && claimIdSet.has(r.leftClaimId as string) && claimIdSet.has(r.rightClaimId as string) && r.leftClaimId !== r.rightClaimId && ["EXACT_DUPLICATE", "EQUIVALENT", "CORE_PLUS_CONTEXTUAL_DELTA", "SUBSUMPTION", "DISJOINT_VARIANT", "OVERLAPPING_CONFLICT"].includes(r.kind as string) && bounded(r.rationale, 256) && [r.commonCore, r.leftContextualDelta, r.rightContextualDelta].every((text) => text === null || bounded(text, 2048)) && (r.kind !== "CORE_PLUS_CONTEXTUAL_DELTA" || (bounded(r.commonCore, 2048) && bounded(r.leftContextualDelta, 2048) && bounded(r.rightContextualDelta, 2048))) && (r.kind === "SUBSUMPTION" ? claimIdSet.has(r.subsumingClaimId as string) && claimIdSet.has(r.subsumedClaimId as string) && r.subsumingClaimId !== r.subsumedClaimId : r.subsumingClaimId === null && r.subsumedClaimId === null))) return false;
  if (!v.questions.every((q) => exact(q, ["dimension", "question", "claimIds"]) && APPLICABILITY_DIMENSIONS_V1.includes(q.dimension as ApplicabilityDimensionV1) && bounded(q.question, 512) && uniqueStrings(q.claimIds, 64) && (q.claimIds as string[]).length > 0 && (q.claimIds as string[]).every((id) => claimIdSet.has(id)))) return false;
  if (!v.quarantine.every((q) => exact(q, ["reason", "detail"]) && ["AMBIGUOUS_LICENCE", "SECRET_DETECTED", "DISALLOWED_PERSONAL_DATA", "UNSUPPORTED_EVIDENCE", "MODEL_OUTPUT_UNAVAILABLE_OR_MALFORMED"].includes(q.reason as string) && bounded(q.detail, 256))) return false;
  const consistent = v.outcome === "QUARANTINED" ? v.quarantine.length > 0 && v.questions.length === 0 : v.outcome === "NEEDS_CONTEXT" ? v.quarantine.length === 0 && v.questions.length > 0 : v.quarantine.length === 0 && v.questions.length === 0;
  if (!consistent || qualificationReceiptDigestV1(v) !== v.receiptDigest) return false;
  return canonicalJson(v) === canonicalJson(qualifyContributionV1(contribution, config, acceptedContext, modelOutput));
}

export function validateKnowledgeEditionV1(v: unknown): v is KnowledgeEditionV1 {
  return exact(v, ["schemaVersion", "editionId", "generation", "priorEditionDigest", "taxonomy", "applicabilityVocabulary", "envelopeDigests", "editionDigest"]) && v.schemaVersion === KNOWLEDGE_EDITION_SCHEMA_V1 && identifier(v.editionId) && Number.isSafeInteger(v.generation) && (v.generation as number) > 0 && (v.priorEditionDigest === null || hex(v.priorEditionDigest)) && exact(v.taxonomy, ["taxonomyId", "generation", "taxonomyDigest"]) && identifier(v.taxonomy.taxonomyId) && Number.isSafeInteger(v.taxonomy.generation) && hex(v.taxonomy.taxonomyDigest) && v.applicabilityVocabulary === APPLICABILITY_VOCABULARY_V1 && Array.isArray(v.envelopeDigests) && v.envelopeDigests.length > 0 && v.envelopeDigests.length <= 1024 && v.envelopeDigests.every(hex) && new Set(v.envelopeDigests).size === v.envelopeDigests.length && hex(v.editionDigest) && knowledgeEditionDigestV1(v) === v.editionDigest;
}
export function validateKnowledgeLkgPointerV1(v: unknown): v is KnowledgeLkgPointerV1 {
  return exact(v, ["schemaVersion", "pointerId", "editionDigest", "generation", "pointerDigest"]) && v.schemaVersion === KNOWLEDGE_LKG_POINTER_SCHEMA_V1 && identifier(v.pointerId) && hex(v.editionDigest) && Number.isSafeInteger(v.generation) && (v.generation as number) > 0 && hex(v.pointerDigest) && knowledgeLkgPointerDigestV1(v) === v.pointerDigest;
}

export function qualifyContributionV1(contribution: ContributionEnvelopeV1, config: QualificationConfigV1, acceptedContext: AcceptedContextV1 = {}, modelOutput?: unknown): QualificationReceiptV1 {
  if (!validateContributionEnvelopeV1(contribution) || !validateQualificationConfigV1(config) || !validateAcceptedContextV1(acceptedContext)) throw new Error("QUALIFICATION_INPUT_DENIED");
  const quarantine: QualificationReceiptV1["quarantine"][number][] = [];
  if (contribution.licence === "UNKNOWN") quarantine.push({ reason: "AMBIGUOUS_LICENCE", detail: "A supported explicit licence is required." });
  if (/(?:api[_-]?key|password|secret)\s*[:=]\s*\S+/i.test(contribution.rawInput)) quarantine.push({ reason: "SECRET_DETECTED", detail: "Credential-like material is not processed." });
  if (/\b(?:\d{3}-\d{2}-\d{4}|\d{16})\b/.test(contribution.rawInput)) quarantine.push({ reason: "DISALLOWED_PERSONAL_DATA", detail: "Personal or payment identifier pattern detected." });
  if (contribution.evidenceRefs.some((ref) => !config.supportedEvidencePrefixes.some((prefix) => ref.startsWith(prefix)))) quarantine.push({ reason: "UNSUPPORTED_EVIDENCE", detail: "An evidence reference is outside configured namespaces." });
  if (config.optionalModel === "REQUIRED" && !validateOptionalModelProposalV1(modelOutput, contribution)) quarantine.push({ reason: "MODEL_OUTPUT_UNAVAILABLE_OR_MALFORMED", detail: "Required optional-model output was unavailable or malformed; deterministic input remains preserved." });
  const materialDimensions = config.materialDimensions as readonly ApplicabilityDimensionV1[];
  const questions = materialDimensions.flatMap((dimension) => {
    const claimIds = contribution.claims.filter((claim) => ["UNKNOWN", "NOT_PROVIDED"].includes(claim.applicability[dimension].state) && !(acceptedContext[dimension]?.length)).map((claim) => claim.claimId).sort();
    return claimIds.length ? [{ dimension, question: `What ${dimension.replaceAll("_", " ")} applies to ${claimIds.join(", ")}?`, claimIds }] : [];
  });
  const relations: QualificationReceiptV1["relations"][number][] = [];
  for (let i = 0; i < contribution.claims.length; i++) for (let j = i + 1; j < contribution.claims.length; j++) {
    const left = contribution.claims[i]!, right = contribution.claims[j]!;
    const normalized = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
    let kind: RelationKindV1 | null = null, rationale = "", commonCore: string | null = null, leftContextualDelta: string | null = null, rightContextualDelta: string | null = null, subsumingClaimId: string | null = null, subsumedClaimId: string | null = null;
    if (left.statement.trim().toLowerCase() === right.statement.trim().toLowerCase()) { kind = "EXACT_DUPLICATE"; rationale = "Canonical statements are identical."; }
    else if (normalized(left.statement) === normalized(right.statement)) { kind = "EQUIVALENT"; rationale = "Statements normalize to the same bounded text."; }
    else if (normalized(left.statement).includes(normalized(right.statement)) || normalized(right.statement).includes(normalized(left.statement))) { const leftBroader = normalized(left.statement).length < normalized(right.statement).length; kind = "SUBSUMPTION"; subsumingClaimId = leftBroader ? left.claimId : right.claimId; subsumedClaimId = leftBroader ? right.claimId : left.claimId; rationale = "The shorter exact assertion is the proposed broader claim; both full statements remain immutable and no scope is broadened."; }
    else {
      const disjoint = ["organization_context", "system_config"].some((d) => {
        const a = left.applicability[d as ApplicabilityDimensionV1], b = right.applicability[d as ApplicabilityDimensionV1];
        return a.state === "VALUE" && b.state === "VALUE" && !a.values.some((v) => b.values.includes(v));
      });
      const leftSentences = left.statement.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean), rightSentences = right.statement.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
      const sharedSentence = leftSentences.find((sentence) => rightSentences.includes(sentence));
      if (disjoint) { kind = "DISJOINT_VARIANT"; rationale = "Material organization or system scopes are disjoint."; }
      else if (sharedSentence && leftSentences.length > 1 && rightSentences.length > 1) { kind = "CORE_PLUS_CONTEXTUAL_DELTA"; commonCore = sharedSentence; leftContextualDelta = leftSentences.filter((s) => normalized(s) !== normalized(sharedSentence)).join(" "); rightContextualDelta = rightSentences.filter((s) => normalized(s) !== normalized(sharedSentence)).join(" "); rationale = "An exact shared sentence is retained as core; both non-empty contextual deltas remain explicit."; }
      else if (left.applicability.domain.state === "VALUE" && right.applicability.domain.state === "VALUE" && left.applicability.domain.values.some((v) => right.applicability.domain.values.includes(v))) { kind = "OVERLAPPING_CONFLICT"; rationale = "Different assertions overlap in the same explicit domain; no default precedence is proposed."; }
    }
    if (kind) relations.push({ leftClaimId: left.claimId, rightClaimId: right.claimId, kind, rationale, commonCore, leftContextualDelta, rightContextualDelta, subsumingClaimId, subsumedClaimId });
  }
  const effectiveQuestions = quarantine.length ? [] : questions;
  const unsigned = { schemaVersion: QUALIFICATION_RECEIPT_SCHEMA_V1, contributionDigest: contribution.contributionDigest, configDigest: sha(config), acceptedContextDigest: sha(acceptedContext), outcome: quarantine.length ? "QUARANTINED" : effectiveQuestions.length ? "NEEDS_CONTEXT" : "PROPOSED", claims: contribution.claims, relations, questions: effectiveQuestions, quarantine, activation: "NOT_AUTHORIZED", authorityBoundary: KNOWLEDGE_AUTHORITY_BOUNDARY_V1 } as const;
  return { ...unsigned, receiptDigest: qualificationReceiptDigestV1(unsigned) };
}

export type ApplicabilityRetrievalV1 = { readonly outcome: "SELECTED" | "NO_MATCH" | "NEEDS_CONTEXT" | "CONFLICT"; readonly selected: readonly KnowledgeEnvelopeV1[]; readonly blockedDimensions: readonly ApplicabilityDimensionV1[]; readonly conflicts: readonly string[] };
export function retrieveApplicableKnowledgeV1(candidates: readonly { envelope: KnowledgeEnvelopeV1; applicability: ApplicabilityScopeV1 }[], taxonomy: KnowledgeTaxonomyV1, context: Readonly<Partial<Record<ApplicabilityDimensionV1, readonly string[]>>>, material: readonly ApplicabilityDimensionV1[]): ApplicabilityRetrievalV1 {
  const blocked = new Set<ApplicabilityDimensionV1>();
  const applicable = candidates.filter(({ envelope, applicability }) => {
    if (validateKnowledgeEnvelopeV1(envelope, taxonomy).length || !validApplicability(applicability)) return false;
    return APPLICABILITY_DIMENSIONS_V1.every((d) => {
      const scope = applicability[d], query = context[d];
      if (material.includes(d) && (["UNKNOWN", "NOT_PROVIDED"].includes(scope.state) || (!query?.length && scope.state === "VALUE"))) { blocked.add(d); return false; }
      if (!query?.length || ["NOT_APPLICABLE", "EXPLICITLY_UNRESTRICTED"].includes(scope.state)) return true;
      return scope.state === "VALUE" && query.some((value) => scope.values.includes(value));
    });
  }).sort((a, b) => a.envelope.envelopeId.localeCompare(b.envelope.envelopeId));
  if (blocked.size) return { outcome: "NEEDS_CONTEXT", selected: [], blockedDimensions: [...blocked].sort(), conflicts: [] };
  const ids = new Set(applicable.map(({ envelope }) => envelope.envelopeId));
  const conflicts = [...new Set(applicable.flatMap(({ envelope }) => envelope.conflictsWith.filter((id) => ids.has(id))))].sort();
  if (conflicts.length) return { outcome: "CONFLICT", selected: [], blockedDimensions: [], conflicts };
  return { outcome: applicable.length ? "SELECTED" : "NO_MATCH", selected: applicable.map(({ envelope }) => envelope), blockedDimensions: [], conflicts: [] };
}

export type KnowledgeActivationResultV1 = { outcome: "ACTIVATED" | "ROLLED_BACK"; active: KnowledgeEditionV1; pointer: KnowledgeLkgPointerV1 } | { outcome: "DENIED_NO_VALID_LKG"; active: null; pointer: null; reason: "CURRENT_EDITION_INVALID" | "LKG_POINTER_INVALID" };
export function activateKnowledgeEditionV1(current: KnowledgeEditionV1, candidate: KnowledgeEditionV1, pointer: KnowledgeLkgPointerV1, taxonomy: KnowledgeTaxonomyV1, envelopes: readonly KnowledgeEnvelopeV1[]): KnowledgeActivationResultV1 {
  const validEdition = (edition: KnowledgeEditionV1) => validateKnowledgeEditionV1(edition) && validateKnowledgeTaxonomyV1(taxonomy) && edition.taxonomy.taxonomyDigest === taxonomy.taxonomyDigest && edition.taxonomy.generation === taxonomy.generation && edition.envelopeDigests.every((digest) => envelopes.some((e) => e.envelopeDigest === digest && validateKnowledgeEnvelopeV1(e, taxonomy).length === 0));
  const pointerValid = validateKnowledgeLkgPointerV1(pointer) && pointer.editionDigest === current.editionDigest && pointer.generation === current.generation;
  if (!validEdition(current)) return { outcome: "DENIED_NO_VALID_LKG", active: null, pointer: null, reason: "CURRENT_EDITION_INVALID" };
  if (!pointerValid) return { outcome: "DENIED_NO_VALID_LKG", active: null, pointer: null, reason: "LKG_POINTER_INVALID" };
  const atomic = validEdition(candidate) && candidate.generation === current.generation + 1 && candidate.priorEditionDigest === current.editionDigest;
  if (!atomic) return { outcome: "ROLLED_BACK", active: current, pointer };
  const nextUnsigned = { schemaVersion: KNOWLEDGE_LKG_POINTER_SCHEMA_V1, pointerId: pointer.pointerId, editionDigest: candidate.editionDigest, generation: candidate.generation } as const;
  return { outcome: "ACTIVATED", active: candidate, pointer: { ...nextUnsigned, pointerDigest: knowledgeLkgPointerDigestV1(nextUnsigned) } };
}
