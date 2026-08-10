import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  APPLICABILITY_DIMENSIONS_V1, APPLICABILITY_VOCABULARY_V1, CONTRIBUTION_ENVELOPE_SCHEMA_V1,
  KNOWLEDGE_EDITION_SCHEMA_V1, KNOWLEDGE_LKG_POINTER_SCHEMA_V1,
  activateKnowledgeEditionV1, canonicalJson, contributionEnvelopeDigestV1,
  knowledgeEditionDigestV1, knowledgeLkgPointerDigestV1, qualificationReceiptDigestV1, qualifyContributionV1,
  retrieveApplicableKnowledgeV1, validateAcceptedContextV1, validateContributionEnvelopeV1, validateQualificationConfigV1, validateQualificationReceiptV1,
  type ApplicabilityDimensionV1, type ApplicabilityScopeV1, type ContributionEnvelopeV1,
  type KnowledgeEditionV1, type KnowledgeEnvelopeV1, type KnowledgeLkgPointerV1, type KnowledgeTaxonomyV1,
} from "../packages/contracts/src/index.js";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const value = (v: string, provenance: "DECLARED" | "EVIDENCE_DERIVED" | "INFERRED" = "DECLARED") => ({ state: "VALUE" as const, values: [v], provenance });
const scope = (overrides: Partial<ApplicabilityScopeV1> = {}): ApplicabilityScopeV1 => Object.fromEntries(APPLICABILITY_DIMENSIONS_V1.map((d) => [d, overrides[d] ?? { state: "NOT_PROVIDED", values: [], provenance: null }])) as unknown as ApplicabilityScopeV1;

function contribution(rawInput: string, statements: readonly string[], overrides: Partial<ApplicabilityScopeV1> = {}, licence: ContributionEnvelopeV1["licence"] = "CC0-1.0", claimOverrides: readonly Partial<ApplicabilityScopeV1>[] = []): ContributionEnvelopeV1 {
  const submissionDigest = sha(rawInput);
  let cursor = 0;
  const claims = statements.map((statement, index) => {
    const start = rawInput.indexOf(statement, cursor); assert.notEqual(start, -1); cursor = start + statement.length;
    return { claimId: `claim:item-${index + 1}`, statement, selector: { encoding: "UTF16_CODE_UNIT_OFFSET" as const, start, end: start + statement.length, exact: statement }, submissionDigest, applicability: scope({ ...overrides, ...claimOverrides[index] }), evidenceRefs: ["fixture:purchasing-v1"] };
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
  assert.equal(validateQualificationReceiptV1(a, input, config, {}), true);
});

test("LKC-QUAL-01 JSON Schema and runtime reject the same invalid applicability state combinations", () => {
  const base = contribution("Requests require approval.", ["Requests require approval."], { domain: value("purchasing") });
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const validate = ajv.compile(JSON.parse(readFileSync("schemas/contracts/knowledge-contribution-envelope-v1.schema.json", "utf8")));
  const probes = [
    { state: "VALUE", values: [], provenance: null },
    { state: "UNKNOWN", values: ["purchasing"], provenance: null },
    { state: "NOT_PROVIDED", values: [], provenance: "DECLARED" },
    { state: "NOT_PROVIDED", values: [], provenance: "INFERRED" },
    { state: "NOT_APPLICABLE", values: [], provenance: "INFERRED" },
    { state: "EXPLICITLY_UNRESTRICTED", values: [], provenance: null },
    { state: "VALUE", values: ["bad\nvalue"], provenance: "DECLARED" },
    { state: "VALUE", values: ["duplicate", "duplicate"], provenance: "DECLARED" },
  ];
  for (const probe of probes) {
    const tampered: any = structuredClone(base); tampered.claims[0].applicability.domain = probe; tampered.contributionDigest = contributionEnvelopeDigestV1(tampered);
    assert.equal(validate(tampered), false, probe.state); assert.equal(validateContributionEnvelopeV1(tampered), false, probe.state);
  }
  const validStates = [value("purchasing", "INFERRED"), { state: "UNKNOWN", values: [], provenance: "INFERRED" }, { state: "NOT_PROVIDED", values: [], provenance: null }, { state: "NOT_APPLICABLE", values: [], provenance: "DECLARED" }, { state: "EXPLICITLY_UNRESTRICTED", values: [], provenance: "EVIDENCE_DERIVED" }];
  for (const state of validStates) {
    const candidate: any = structuredClone(base); candidate.claims[0].applicability.domain = state; candidate.contributionDigest = contributionEnvelopeDigestV1(candidate);
    assert.equal(validate(candidate), true, state.state); assert.equal(validateContributionEnvelopeV1(candidate), true, state.state);
  }
});

test("LKC-QUAL-01 executable purchasing golden cases produce typed relations, policy exceptions and missing context", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/knowledge-quality/purchasing-v1.json", "utf8"));
  for (const golden of fixture.relationCases) {
    const statements = golden.claims.map((claim: any) => claim.statement), raw = statements.join("\n");
    const perClaim = golden.claims.map((claim: any) => ({ organization_context: value(claim.organization), system_config: value(claim.system) }));
    const input = contribution(raw, statements, { domain: value("purchasing"), license: value("CC0-1.0") }, "CC0-1.0", perClaim);
    const receipt = qualifyContributionV1(input, { configId: "golden-relations-v1", materialDimensions: [], supportedEvidencePrefixes: ["fixture:"], optionalModel: "DISABLED" });
    assert.equal(receipt.relations.length, 1, golden.caseId); const relation = receipt.relations[0]!; assert.deepEqual({ kind: relation.kind, commonCore: relation.commonCore, leftContextualDelta: relation.leftContextualDelta, rightContextualDelta: relation.rightContextualDelta }, golden.expected, golden.caseId);
    if (golden.caseId === "subsumption") { assert.equal(relation.subsumingClaimId, input.claims[0]!.claimId); assert.equal(relation.subsumedClaimId, input.claims[1]!.claimId); }
    if (golden.caseId === "unsafe-abstraction-denied") assert.equal(receipt.relations.some((relation) => relation.kind === "CORE_PLUS_CONTEXTUAL_DELTA"), false);
  }
  for (const workflow of fixture.workflowCases) {
    const overrides: any = { domain: value("purchasing"), license: value("CC0-1.0") };
    for (const [dimension, configured] of Object.entries(workflow.applicability)) overrides[dimension] = value(configured as string);
    const input = contribution(workflow.statement, [workflow.statement], overrides);
    const receipt = qualifyContributionV1(input, { configId: "golden-workflow-v1", materialDimensions: workflow.materialDimensions, supportedEvidencePrefixes: ["fixture:"], optionalModel: "DISABLED" });
    assert.equal(receipt.outcome, workflow.expectedOutcome, workflow.caseId);
    if (workflow.expectedQuestionDimension) assert.equal(receipt.questions[0]?.dimension, workflow.expectedQuestionDimension);
    if (workflow.caseId === "policy-exception") assert.deepEqual(receipt.claims[0]!.applicability.prerequisites_constraints_exceptions.values, ["recorded-board-exception"]);
  }
});

test("LKC-QUAL-01 quarantines licence, secret, personal data, evidence and model failures without activation", () => {
  const raw = "password=fictional-token 123-45-6789";
  const input = contribution(raw, [raw], { domain: value("purchasing") }, "UNKNOWN");
  const receipt = qualifyContributionV1({ ...input, evidenceRefs: ["remote:unsupported"], contributionDigest: contributionEnvelopeDigestV1({ ...input, evidenceRefs: ["remote:unsupported"] }) }, { configId: "fail-closed-v1", materialDimensions: [], supportedEvidencePrefixes: ["fixture:"], optionalModel: "REQUIRED" }, {}, { status: "BROKEN" });
  assert.equal(receipt.outcome, "QUARANTINED");
  assert.deepEqual(receipt.quarantine.map((q) => q.reason), ["AMBIGUOUS_LICENCE", "SECRET_DETECTED", "DISALLOWED_PERSONAL_DATA", "UNSUPPORTED_EVIDENCE", "MODEL_OUTPUT_UNAVAILABLE_OR_MALFORMED"]);
  assert.equal(receipt.claims[0]?.selector.exact, raw);
});

test("LKC-QUAL-01 validates config, accepted context and replaceable model proposals as untrusted input", () => {
  const input = contribution("Requests require approval.", ["Requests require approval."], { domain: value("purchasing"), license: value("CC0-1.0") });
  const base = { configId: "adversarial-boundary-v1", materialDimensions: ["domain"] as ApplicabilityDimensionV1[], supportedEvidencePrefixes: ["fixture:"], optionalModel: "DISABLED" as const };
  assert.equal(validateQualificationConfigV1(base), true); assert.equal(validateAcceptedContextV1({ domain: ["purchasing"] }), true);
  for (const invalid of [{ ...base, optionalModel: "MAYBE" }, { ...base, materialDimensions: ["domain", "domain"] }, { ...base, supportedEvidencePrefixes: ["fixture:", "fixture:"] }, { ...base, supportedEvidencePrefixes: ["https://remote/"] }]) assert.throws(() => qualifyContributionV1(input, invalid as any), /QUALIFICATION_INPUT_DENIED/);
  for (const invalid of [{ invented_dimension: ["x"] }, { domain: [] }, { domain: ["x", "x"] }, { domain: [""] }]) assert.throws(() => qualifyContributionV1(input, base, invalid as any), /QUALIFICATION_INPUT_DENIED/);
  const required = { ...base, materialDimensions: [], optionalModel: "REQUIRED" as const };
  const marker = qualifyContributionV1(input, required, {}, { status: "VALID" }); assert.equal(marker.outcome, "QUARANTINED"); assert.deepEqual(marker.claims, input.claims);
  const validModel = { schemaVersion: "chimpmaera.knowledge/model-proposal/v1", status: "PROPOSAL", contributionDigest: input.contributionDigest, proposals: [{ claimId: input.claims[0]!.claimId, dimension: "domain", values: ["purchasing"] }] } as const;
  assert.equal(qualifyContributionV1(input, required, {}, validModel).outcome, "PROPOSED");
  const fallback = qualifyContributionV1(input, { ...base, materialDimensions: [], optionalModel: "FALLBACK_DETERMINISTIC" }, {}, { status: "BROKEN" }); assert.equal(fallback.outcome, "PROPOSED"); assert.deepEqual(fallback.claims, input.claims);
  assert.equal(qualifyContributionV1(input, base, {}, { status: "BROKEN" }).outcome, "PROPOSED");
});

test("LKC-QUAL-01 receipt validation binds exact contribution, claims, references and outcome semantics", () => {
  const input = contribution("Requests require approval.\nExceptions require review.", ["Requests require approval.", "Exceptions require review."], { domain: value("purchasing"), system_config: { state: "UNKNOWN", values: [], provenance: null }, license: value("CC0-1.0") });
  const config = { configId: "receipt-binding-v1", materialDimensions: ["system_config"] as ApplicabilityDimensionV1[], supportedEvidencePrefixes: ["fixture:"], optionalModel: "DISABLED" as const }, context = {};
  const receipt = qualifyContributionV1(input, config, context); assert.equal(validateQualificationReceiptV1(receipt, input, config, context), true);
  const mutateAndRehash = (mutate: (value: any) => void) => { const value: any = structuredClone(receipt); mutate(value); value.receiptDigest = qualificationReceiptDigestV1(value); return value; };
  const probes = [
    mutateAndRehash((v) => { v.claims[0].claimId = "claim:attacker"; }),
    mutateAndRehash((v) => { v.claims[0].selector.start += 1; }),
    mutateAndRehash((v) => { v.claims[0].submissionDigest = "0".repeat(64); }),
    mutateAndRehash((v) => { v.claims[0].applicability.domain.provenance = null; }),
    mutateAndRehash((v) => { v.relations[0].leftClaimId = "claim:missing"; }),
    mutateAndRehash((v) => { v.relations[0].kind = "EQUIVALENT"; }),
    mutateAndRehash((v) => { v.questions[0].claimIds = ["claim:missing"]; }),
    mutateAndRehash((v) => { v.questions[0].dimension = "domain"; }),
    mutateAndRehash((v) => { v.claims[1].claimId = v.claims[0].claimId; }),
    mutateAndRehash((v) => { v.outcome = "PROPOSED"; }),
    mutateAndRehash((v) => { v.quarantine = [{ reason: "AMBIGUOUS_LICENCE", detail: "invalid combination" }]; }),
  ];
  for (const probe of probes) assert.equal(validateQualificationReceiptV1(probe, input, config, context), false);
  const other = contribution("Other raw input.", ["Other raw input."], { domain: value("purchasing") });
  assert.equal(validateQualificationReceiptV1(receipt, other, config, context), false);
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
  const corruptCurrent = { ...current, editionDigest: "0".repeat(64) };
  assert.deepEqual(activateKnowledgeEditionV1(corruptCurrent, candidate, pointer, taxonomy, [item]), { outcome: "DENIED_NO_VALID_LKG", active: null, pointer: null, reason: "CURRENT_EDITION_INVALID" });
  const corruptPointer = { ...pointer, pointerDigest: "0".repeat(64) };
  assert.deepEqual(activateKnowledgeEditionV1(current, candidate, corruptPointer, taxonomy, [item]), { outcome: "DENIED_NO_VALID_LKG", active: null, pointer: null, reason: "LKG_POINTER_INVALID" });
});
