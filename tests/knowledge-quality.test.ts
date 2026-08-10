import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  APPLICABILITY_DIMENSIONS_V1, APPLICABILITY_VOCABULARY_V1, CONTRIBUTION_ENVELOPE_SCHEMA_V1,
  KNOWLEDGE_EDITION_SCHEMA_V1, KNOWLEDGE_LKG_POINTER_SCHEMA_V1,
  activateKnowledgeEditionV1, canonicalJson, contributionEnvelopeDigestV1,
  knowledgeEditionDigestV1, knowledgeLkgPointerDigestV1, qualifyContributionV1,
  retrieveApplicableKnowledgeV1, validateContributionEnvelopeV1,
  type ApplicabilityDimensionV1, type ApplicabilityScopeV1, type ContributionEnvelopeV1,
  type KnowledgeEditionV1, type KnowledgeEnvelopeV1, type KnowledgeLkgPointerV1, type KnowledgeTaxonomyV1,
} from "../packages/contracts/src/index.js";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const value = (v: string, provenance: "DECLARED" | "EVIDENCE_DERIVED" | "INFERRED" = "DECLARED") => ({ state: "VALUE" as const, values: [v], provenance });
const scope = (overrides: Partial<ApplicabilityScopeV1> = {}): ApplicabilityScopeV1 => Object.fromEntries(APPLICABILITY_DIMENSIONS_V1.map((d) => [d, overrides[d] ?? { state: "NOT_PROVIDED", values: [], provenance: null }])) as unknown as ApplicabilityScopeV1;

function contribution(rawInput: string, statements: readonly string[], overrides: Partial<ApplicabilityScopeV1> = {}, licence: ContributionEnvelopeV1["licence"] = "CC0-1.0"): ContributionEnvelopeV1 {
  const submissionDigest = sha(rawInput);
  const claims = statements.map((statement, index) => {
    const start = rawInput.indexOf(statement); assert.notEqual(start, -1);
    return { claimId: `claim:item-${index + 1}`, statement, selector: { encoding: "UTF16_CODE_UNIT_OFFSET" as const, start, end: start + statement.length, exact: statement }, submissionDigest, applicability: scope(overrides), evidenceRefs: ["fixture:purchasing-v1"] };
  });
  const unsigned = { schemaVersion: CONTRIBUTION_ENVELOPE_SCHEMA_V1, contributionId: "contribution:purchasing-test", rawInput, submissionDigest, licence, dataClassification: "PUBLIC_SYNTHETIC" as const, evidenceRefs: ["fixture:purchasing-v1"], claims };
  return { ...unsigned, contributionDigest: contributionEnvelopeDigestV1(unsigned) };
}
const fixtures = () => JSON.parse(readFileSync("tests/fixtures/knowledge-envelope/taxonomy-generations-v1.json", "utf8")) as { activeTaxonomy: KnowledgeTaxonomyV1 };
const envelopes = () => JSON.parse(readFileSync("tests/fixtures/knowledge-envelope/apple-claims-v1.json", "utf8")) as KnowledgeEnvelopeV1[];

test("LKC-QUAL-01 preserves raw bytes, exact selectors, closed states and deterministic receipts", () => {
  const raw = "Requests require approval. Requests require approval.";
  const input = contribution(raw, ["Requests require approval.", "Requests require approval."], { domain: value("purchasing"), task_audience_outcome: value("buyer", "INFERRED"), license: value("CC0-1.0") });
  assert.equal(validateContributionEnvelopeV1(input), true);
  const ajv = new Ajv2020({ strict: true });
  const validate = ajv.compile(JSON.parse(readFileSync("schemas/contracts/knowledge-contribution-envelope-v1.schema.json", "utf8")));
  assert.equal(validate(input), true, JSON.stringify(validate.errors));
  const config = { configId: "deterministic-offline-v1", materialDimensions: ["domain"] as ApplicabilityDimensionV1[], supportedEvidencePrefixes: ["fixture:"], optionalModel: "DISABLED" as const };
  const a = qualifyContributionV1(input, config), b = qualifyContributionV1(structuredClone(input), structuredClone(config));
  assert.equal(canonicalJson(a), canonicalJson(b));
  assert.equal(a.relations[0]?.kind, "EXACT_DUPLICATE");
  assert.equal(a.claims[0]?.applicability.task_audience_outcome.provenance, "INFERRED");
  assert.equal(a.activation, "NOT_AUTHORIZED");
});

test("LKC-QUAL-01 targets missing material context and proposes all bounded relation kinds", () => {
  const statements = ["Every request requires approval.", "Every request requires approval!", "Every request requires approval. Acme context applies.", "Shared purchasing core applies for Acme.", "Shared purchasing core applies for Beta.", "Tier two applies.", "Tier three applies.", "Beta variant applies."];
  const raw = statements.join("\n");
  const input = contribution(raw, statements, { domain: value("purchasing"), system_config: { state: "UNKNOWN", values: [], provenance: null }, license: value("CC0-1.0") });
  const receipt = qualifyContributionV1(input, { configId: "relations-v1", materialDimensions: ["system_config"], supportedEvidencePrefixes: ["fixture:"], optionalModel: "DISABLED" });
  assert.equal(receipt.outcome, "NEEDS_CONTEXT");
  assert.deepEqual(receipt.questions.map((q) => q.dimension), ["system_config"]);
  const kinds = new Set(receipt.relations.map((r) => r.kind));
  assert.ok(kinds.has("EQUIVALENT")); assert.ok(kinds.has("SUBSUMPTION")); assert.ok(kinds.has("CORE_PLUS_CONTEXTUAL_DELTA")); assert.ok(kinds.has("OVERLAPPING_CONFLICT"));
  const disjointInput = contribution("Variant A.\nVariant B.", ["Variant A.", "Variant B."], { domain: value("purchasing"), organization_context: value("acme"), system_config: value("v2"), license: value("CC0-1.0") });
  const changed: any = structuredClone(disjointInput); changed.claims[1].applicability.organization_context = value("beta"); changed.contributionDigest = contributionEnvelopeDigestV1(changed);
  assert.equal(qualifyContributionV1(changed, { configId: "relations-v1", materialDimensions: [], supportedEvidencePrefixes: ["fixture:"], optionalModel: "DISABLED" }).relations[0]?.kind, "DISJOINT_VARIANT");
});

test("LKC-QUAL-01 quarantines licence, secret, personal data, evidence and model failures without activation", () => {
  const raw = "password=fictional-token 123-45-6789";
  const input = contribution(raw, [raw], { domain: value("purchasing") }, "UNKNOWN");
  const receipt = qualifyContributionV1({ ...input, evidenceRefs: ["remote:unsupported"], contributionDigest: contributionEnvelopeDigestV1({ ...input, evidenceRefs: ["remote:unsupported"] }) }, { configId: "fail-closed-v1", materialDimensions: [], supportedEvidencePrefixes: ["fixture:"], optionalModel: "REQUIRED" }, {}, { status: "BROKEN" });
  assert.equal(receipt.outcome, "QUARANTINED");
  assert.deepEqual(receipt.quarantine.map((q) => q.reason), ["AMBIGUOUS_LICENCE", "SECRET_DETECTED", "DISALLOWED_PERSONAL_DATA", "UNSUPPORTED_EVIDENCE", "MODEL_OUTPUT_UNAVAILABLE_OR_MALFORMED"]);
  assert.equal(receipt.claims[0]?.selector.exact, raw);
});

test("LKC-QUAL-01 applies scope before ranking, asks for context, and keeps overlap conflicts visible", () => {
  const taxonomy = fixtures().activeTaxonomy, items = envelopes().slice(2, 4);
  const scoped = items.map((envelope) => ({ envelope, applicability: scope({ domain: value("purchasing"), organization_context: value("acme"), system_config: value("procurefox-2.0") }) }));
  const missing = retrieveApplicableKnowledgeV1(scoped, taxonomy, { domain: ["purchasing"] }, ["system_config"]);
  assert.equal(missing.outcome, "NEEDS_CONTEXT"); assert.deepEqual(missing.blockedDimensions, ["system_config"]);
  const conflict = retrieveApplicableKnowledgeV1(scoped, taxonomy, { domain: ["purchasing"], system_config: ["procurefox-2.0"] }, ["system_config"]);
  assert.equal(conflict.outcome, "CONFLICT"); assert.equal(conflict.selected.length, 0); assert.ok(conflict.conflicts.length > 0);
  const noMatch = retrieveApplicableKnowledgeV1(scoped, taxonomy, { domain: ["purchasing"], system_config: ["other"] }, ["system_config"]);
  assert.equal(noMatch.outcome, "NO_MATCH");
});

test("LKC-QUAL-01 activates whole immutable editions or reads back exact LKG with no mixed generation", () => {
  const taxonomy = fixtures().activeTaxonomy, item = envelopes()[0]!;
  const currentUnsigned = { schemaVersion: KNOWLEDGE_EDITION_SCHEMA_V1, editionId: "edition:purchasing-1", generation: 1, priorEditionDigest: null, taxonomy: { taxonomyId: taxonomy.taxonomyId, generation: taxonomy.generation, taxonomyDigest: taxonomy.taxonomyDigest }, applicabilityVocabulary: APPLICABILITY_VOCABULARY_V1, envelopeDigests: [item.envelopeDigest] } as const;
  const current: KnowledgeEditionV1 = { ...currentUnsigned, editionDigest: knowledgeEditionDigestV1(currentUnsigned) };
  const candidateUnsigned = { ...currentUnsigned, editionId: "edition:purchasing-2", generation: 2, priorEditionDigest: current.editionDigest };
  const candidate: KnowledgeEditionV1 = { ...candidateUnsigned, editionDigest: knowledgeEditionDigestV1(candidateUnsigned) };
  const pointerUnsigned = { schemaVersion: KNOWLEDGE_LKG_POINTER_SCHEMA_V1, pointerId: "pointer:purchasing-lkg", editionDigest: current.editionDigest, generation: 1 } as const;
  const pointer: KnowledgeLkgPointerV1 = { ...pointerUnsigned, pointerDigest: knowledgeLkgPointerDigestV1(pointerUnsigned) };
  const activated = activateKnowledgeEditionV1(current, candidate, pointer, taxonomy, [item]);
  assert.equal(activated.outcome, "ACTIVATED"); assert.equal(activated.pointer.editionDigest, candidate.editionDigest);
  const mixedUnsigned = { ...candidateUnsigned, taxonomy: { ...candidate.taxonomy, generation: taxonomy.generation + 1 } };
  const mixed = { ...mixedUnsigned, editionDigest: knowledgeEditionDigestV1(mixedUnsigned) };
  const rolled = activateKnowledgeEditionV1(current, mixed, pointer, taxonomy, [item]);
  assert.equal(rolled.outcome, "ROLLED_BACK"); assert.deepEqual(rolled.active, current); assert.deepEqual(rolled.pointer, pointer);
});

test("purchasing fixture is bounded, fictional and covers variants, exceptions, duplicates, conflicts and missing context", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/knowledge-quality/purchasing-v1.json", "utf8"));
  assert.equal(fixture.contributions.length, 6); assert.deepEqual(fixture.expectedRelations, ["EXACT_DUPLICATE","EQUIVALENT","CORE_PLUS_CONTEXTUAL_DELTA","SUBSUMPTION","DISJOINT_VARIANT","OVERLAPPING_CONFLICT"]);
  assert.equal(fixture.contributions.some((c: any) => c.organization === null && c.system === null), true);
  assert.match(fixture.contributions[3].text, /exception/); assert.match(fixture.contributions[4].text, /tier-3/);
});
