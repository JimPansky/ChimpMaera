import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  KNOWLEDGE_AUTHORITY_BOUNDARY_V1,
  explainKnowledgeSelectionV1,
  knowledgeEnvelopeDigestV1,
  knowledgeTaxonomyDigestV1,
  migrateKnowledgeTaxonomyV1,
  selectKnowledgeV1,
  validateKnowledgeEnvelopeV1,
  validateKnowledgeTaxonomyV1,
  type KnowledgeEnvelopeV1,
  type KnowledgeReasonV1,
  type KnowledgeSelectionPolicyV1,
  type KnowledgeTaxonomyV1,
} from "../packages/contracts/src/index.js";

const taxonomyFixture = () => JSON.parse(readFileSync("tests/fixtures/knowledge-envelope/taxonomy-generations-v1.json", "utf8")) as { priorTaxonomy: KnowledgeTaxonomyV1; activeTaxonomy: KnowledgeTaxonomyV1 };
const envelopes = () => JSON.parse(readFileSync("tests/fixtures/knowledge-envelope/apple-claims-v1.json", "utf8")) as KnowledgeEnvelopeV1[];
const policy = (mode: "CURATED" | "EXPLORATORY", allow = false): KnowledgeSelectionPolicyV1 => ({ mode, scopeNamespace: "synthetic:apple-tree", allowedSensitivity: ["PUBLIC"], allowedLicences: ["CC0-1.0", "CC-BY-4.0"], minimumTrust: mode === "CURATED" ? "HIGH" : "LOW", evaluatedAtMs: 2_000, allowUnresolvedExploratory: allow, maxResults: 10 });

function replacePath(target: Record<string, any>, pointer: string, value: unknown): void {
  const parts = pointer.split("/").slice(1); const leaf = parts.pop(); assert.ok(leaf);
  let parent: any = target; for (const part of parts) parent = parent[part]; parent[leaf] = value;
}

test("AWI-03 validates exact taxonomy and attributable immutable envelopes", () => {
  const { activeTaxonomy } = taxonomyFixture();
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validateTaxonomy = ajv.compile(JSON.parse(readFileSync("schemas/contracts/knowledge-taxonomy-v1.schema.json", "utf8")));
  const validateEnvelope = ajv.compile(JSON.parse(readFileSync("schemas/contracts/knowledge-envelope-v1.schema.json", "utf8")));
  assert.equal(validateTaxonomy(activeTaxonomy), true, JSON.stringify(validateTaxonomy.errors));
  assert.equal(validateKnowledgeTaxonomyV1(activeTaxonomy), true);
  for (const envelope of envelopes()) {
    assert.equal(validateEnvelope(envelope), true, `${envelope.envelopeId}:${JSON.stringify(validateEnvelope.errors)}`);
    assert.deepEqual(validateKnowledgeEnvelopeV1(envelope, activeTaxonomy), []);
    assert.equal(knowledgeEnvelopeDigestV1(envelope), envelope.envelopeDigest);
    assert.equal(envelope.authorityBoundary, KNOWLEDGE_AUTHORITY_BOUNDARY_V1);
  }
  const unverified = envelopes().find((item) => item.envelopeId === "knowledge:apple-sweetness");
  assert.equal(unverified?.epistemicStatus, "UNVERIFIED");
  assert.equal(unverified?.attribution[0]?.citation, "Anonymous synthetic orchard note, fixture line 7; not independently verified.");
});

test("AWI-03 activates a deterministic additive taxonomy and retains exact LKG rollback", () => {
  const { priorTaxonomy, activeTaxonomy } = taxonomyFixture();
  assert.equal(migrateKnowledgeTaxonomyV1(priorTaxonomy, activeTaxonomy).outcome, "ACTIVATED");
  for (let replay = 0; replay < 100; replay += 1) assert.equal(knowledgeTaxonomyDigestV1(activeTaxonomy), activeTaxonomy.taxonomyDigest);
  const unsafeUnsigned = { ...activeTaxonomy, generation: 4, priorGeneration: 1, kinds: ["CLAIM", "OBSERVATION", "PROCEDURE", "DEFINITION", "RELATIONSHIP", "UNRESOLVED"] };
  const unsafe = { ...unsafeUnsigned, taxonomyDigest: knowledgeTaxonomyDigestV1(unsafeUnsigned) } as KnowledgeTaxonomyV1;
  const denied = migrateKnowledgeTaxonomyV1(priorTaxonomy, unsafe);
  assert.equal(denied.outcome, "DENIED");
  assert.deepEqual(denied.active, priorTaxonomy);
  assert.deepEqual(denied.lastKnownGood, priorTaxonomy);
});

test("AWI-03 curated selection admits only verified conflict-free exact-scope knowledge", () => {
  const result = selectKnowledgeV1(taxonomyFixture().activeTaxonomy, envelopes(), policy("CURATED"));
  assert.deepEqual(result.selected.map((item) => item.envelopeId), ["knowledge:apple-pruning"]);
  assert.equal(result.rejected.length, 3);
  assert.ok(result.rejected.find((item) => item.envelopeId === "knowledge:apple-sweetness")?.reasons.includes("UNVERIFIED_DENIED"));
  assert.equal(result.residualConflicts.length, 2);
  for (let replay = 0; replay < 100; replay += 1) assert.deepEqual(selectKnowledgeV1(taxonomyFixture().activeTaxonomy, envelopes().reverse(), policy("CURATED")), result);
});

test("AWI-03 exploratory selection is explicitly bounded and preserves unresolved conflict", () => {
  const denied = selectKnowledgeV1(taxonomyFixture().activeTaxonomy, envelopes(), policy("EXPLORATORY", false));
  assert.equal(denied.selected.length, 1);
  const allowed = selectKnowledgeV1(taxonomyFixture().activeTaxonomy, envelopes(), policy("EXPLORATORY", true));
  assert.equal(allowed.selected.length, 4);
  assert.equal(allowed.residualConflicts.length, 2);
  assert.throws(() => selectKnowledgeV1(taxonomyFixture().activeTaxonomy, envelopes(), { ...policy("CURATED"), allowUnresolvedExploratory: true }), /POLICY_DENIED/);
});

test("AWI-03 adversarial envelope fixtures fail closed with stable reasons", () => {
  const matrix = JSON.parse(readFileSync("tests/fixtures/knowledge-envelope/adversarial-matrix-v1.json", "utf8")) as Array<{ caseId: string; path: string; value: unknown; rehash: boolean; expected: KnowledgeReasonV1 }>;
  assert.equal(matrix.length, 6);
  for (const probe of matrix) {
    const value = structuredClone(envelopes()[0]) as unknown as Record<string, any>;
    replacePath(value, probe.path, probe.value);
    if (probe.rehash) value.envelopeDigest = knowledgeEnvelopeDigestV1(value);
    assert.ok(validateKnowledgeEnvelopeV1(value, taxonomyFixture().activeTaxonomy).includes(probe.expected), probe.caseId);
  }
  const cycle = envelopes().slice(0, 2).map((item) => structuredClone(item)) as any[];
  cycle[0].derivedFrom = [cycle[1].envelopeId]; cycle[0].envelopeDigest = knowledgeEnvelopeDigestV1(cycle[0]);
  cycle[1].derivedFrom = [cycle[0].envelopeId]; cycle[1].envelopeDigest = knowledgeEnvelopeDigestV1(cycle[1]);
  const cycleResult = selectKnowledgeV1(taxonomyFixture().activeTaxonomy, cycle, policy("EXPLORATORY", true));
  assert.equal(cycleResult.rejected.every((item) => item.reasons.includes("CIRCULAR_DERIVATION_DENIED")), true);
});

test("AWI-03 selection denies stale, sensitive, incompatible-licence and cross-scope candidates", () => {
  const { activeTaxonomy } = taxonomyFixture();
  const cases: Array<[KnowledgeReasonV1, (value: any) => void, Partial<KnowledgeSelectionPolicyV1>?]> = [
    ["STALE_EVIDENCE_DENIED", (value) => { value.freshness.staleAfterMs = 1_500; }],
    ["SENSITIVITY_DENIED", (value) => { value.sensitivity = "RESTRICTED"; }],
    ["LICENSE_DENIED", (value) => { value.attribution[0].licence = "OWNER_AUTHORIZED"; }],
    ["SCOPE_MISMATCH", (value) => { value.scope.namespace = "synthetic:other-orchard"; }],
  ];
  for (const [reason, mutate] of cases) {
    const value = structuredClone(envelopes()[0]) as any; mutate(value); value.envelopeDigest = knowledgeEnvelopeDigestV1(value);
    const result = selectKnowledgeV1(activeTaxonomy, [value], policy("CURATED"));
    assert.ok(result.rejected[0]?.reasons.includes(reason), reason);
  }
});

test("AWI-03 HMI explanation is citation-complete, conflict-visible and authority-free", () => {
  const items = envelopes();
  const selection = selectKnowledgeV1(taxonomyFixture().activeTaxonomy, items, policy("CURATED"));
  const explanation = explainKnowledgeSelectionV1(selection, items);
  assert.equal(explanation.operation, "explain");
  assert.equal(explanation.readOnly, true);
  assert.equal(explanation.selected.length, 1);
  assert.equal(explanation.rejected.length, 3);
  assert.equal(explanation.rejected.every((item) => item.citations.length > 0 && (item.rationale?.length ?? 0) > 0), true);
  assert.equal(explanation.residualConflicts.length, 2);
  assert.deepEqual(Object.values(explanation.authority), [[], [], [], [], [], []]);
  assert.equal(explanation.authorityBoundary, KNOWLEDGE_AUTHORITY_BOUNDARY_V1);
});
