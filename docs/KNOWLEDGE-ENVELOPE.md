# Universal Knowledge Envelope (AWI-03)

Status: **local, synthetic, default-off contract slice**.

The v1 envelope stores attributable knowledge without declaring it globally true. Its immutable canonical digest binds the statement, exact citations and source digests, domain-neutral or governed extended kind, epistemic status, trust, freshness, sensitivity, permitted uses, scope, conflicts, derivation, taxonomy generation, candidate status and an explicitly empty authority object. These dimensions do not imply one another: high trust does not make evidence fresh, a generation candidate is not curated truth, and knowledge never grants an approval or capability.

## Selection and explanation

`selectKnowledgeV1` sorts candidates by immutable ID and returns every selected and rejected candidate with stable rationale. `CURATED` admits only exact-scope, fresh, allowed-licence/sensitivity, sufficiently trusted, `CURATED_READ` knowledge; unverified, unresolved, disputed or conflicting envelopes are denied. `EXPLORATORY` still requires scope, freshness, licence, sensitivity, trust and permitted use, and admits unresolved material only when `allowUnresolvedExploratory` is explicit. Conflicts remain residual output.

`explainKnowledgeSelectionV1` is a pure read-only HMI projection. It exposes selected and rejected candidates, citations, epistemic status, rationale, scope, taxonomy/generation identity and residual conflicts. Its credential, policy approval, capability, tool, write and execution collections are exact empty arrays. It creates no route or effect path.

## Taxonomy governance and rollback

Taxonomies are digest-bound immutable generations. A successor must use the same taxonomy identity, advance exactly one generation, bind the prior generation, and preserve every kind unless an explicit one-to-one rename names an existing prior kind. Missing, duplicate, jumping or destructive migrations retain the prior taxonomy as both active and last-known-good.

Rollback is operator-controlled and repository-local:

1. Disable the AWI-03 profile/route (it is default-off in this slice).
2. Restore the exact prior taxonomy/generation digest recorded as last-known-good; do not synthesize a replacement generation.
3. Retain rejected and conflicting evidence append-only for audit/re-evaluation.
4. Remove only scoped synthetic AWI-03 state. Do not alter unrelated accepted generations.

## Boundaries

This proves strict local contracts and synthetic fixtures only. It does not prove global truth, corpus completeness, production storage/retrieval, online enrichment, a live provider/model, production taxonomy governance, legal/licence determination, certification, deployment, availability, performance, autonomous acceptance, or any execution authority.
