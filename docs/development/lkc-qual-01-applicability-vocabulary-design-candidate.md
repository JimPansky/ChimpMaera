# Design Candidate: Minimal Cross-Domain Applicability Vocabulary and Controlled Extension Mechanism for Issue #116

**Run:** `cm-glm52-thinking-issue-116-20260804`
**Repository:** `JimPansky/ChimpMaera`
**Pinned base:** `2a880dd041e204187edcb8d8ae0f30d12b9d6b95`
**Issue body SHA-256:** `f183999f87c789e171cb225bca73fec6c5336c934de45c053f8ce2b6d64e11d2`
**Data class:** `PUBLIC_OSS`
**Artifact class:** Non-normative, non-executable design candidate.

---

## 1. Status and Non-Claims

**Status:** Finalizable design candidate for owner review. This document proposes a minimal cross-domain Applicability Vocabulary and a controlled extension mechanism to satisfy the design work required by Issue #116. It is a concept for local review, not a schema freeze, implementation, deployment, activation, or authority decision.

**Non-claims:**
- Does not claim implementation, production-readiness, deployment, or activation.
- Does not claim authority to approve, reject, supersede, revoke, or publish knowledge.
- Does not introduce a parallel Knowledge Envelope, taxonomy source of truth, Verification Fabric, or authority plane.
- Does not treat model confidence, semantic similarity, popularity, or specificity as truth criteria.
- Does not define runtime permissions, credentials, execution rights, or policy approval.
- Does not claim that the current public-main lacks all applicability concepts; rather, it lacks the structured, cross-domain vocabulary with the required independent dimensions requested in #116.
- Does not claim this design is normative or binding. It is an informative candidate subject to an independent semantic gate.

---

## 2. Claim-by-Claim Source Matrix

| # | Constraint / Requirement | Source | Adherence in this Design |
|---|---|---|---|
| C-1 | Four distinct value states: Unknown, not provided, not applicable, explicitly unrestricted | Issue #116 body | Four distinct enum members in a closed `ValueState` algebra; distinct in representation, matching, selection, explanation, and remediation. |
| C-2 | Independent dimensions for domain, knowledge type, role/responsibility, industry, organization context, geography/jurisdiction/policy, process/stage, system/provider/product/version/config/data-model, prerequisites/constraints/exceptions, task/audience/outcome, valid-time/freshness, epistemic status, evidence strength, sensitivity, license | Issue #116 body; defect dossier | 15 independent core dimensions, each first-class and independently queryable. Grouped sub-fields within a dimension remain independently addressable via structured sub-slots. |
| C-3 | Industry must be independent from organization context | Defect dossier | `industry` and `organization_context` are separate dimensions. |
| C-4 | Valid-time/freshness must be independent from epistemic status | Defect dossier | `valid_time_freshness` and `epistemic_status` are separate dimensions. |
| C-5 | Evidence strength, sensitivity, and license must be first-class | Defect dossier | `evidence_strength`, `sensitivity`, and `license` are each independent dimensions. |
| C-6 | Preserve common core, make boundaries explicit, retain variants/conflicts, ask for missing differentiators | Issue #116 body | Core Claim and Scoped Variant objects; `NEEDS_CONTEXT` outcome; Conflict Records block default selection. |
| C-7 | Applicability before ranking; ambiguity/conflict set returned if multiple incompatible variants remain | Issue #116 body | Retrieval contract: filter by applicability, then rank; return conflict set if unresolved. |
| C-8 | Reuse and extend contracts from #44; no parallel records | Issue #116 body | Applicability Scope is a structured field within the Knowledge Envelope, not a new envelope. |
| C-9 | Immutable editions, supersession, revocation, LKG state | Issue #116 body; #54 | Editions are content-addressed, append-only; LKG is an external exact pointer, not a mutable flag inside edition bytes. |
| C-10 | Namespaced evidence, revalidation, exact LKG readback | #34 | Evidence links are namespaced; revalidation triggers new assessment; LKG readback is exact. |
| C-11 | Applicability = exact contexts, versions, assumptions, boundaries; drift invalidates/downgrades dependents | `docs/CANON.md` (CM-CAN-16, CM-CAN-17) | Drift detection invalidates dependent claims; evidence does not transfer by resemblance. |
| C-12 | Typed provenance, positive/negative evidence, rejected variants, unresolved hypotheses | `docs/KNOWLEDGE-HARVEST.md` | Provenance types: DECLARED, EVIDENCE_DERIVED, INFERRED, REVIEWER_CONFIRMED, VALIDATION_DERIVED. Evidence links support positive/negative relations. |
| C-13 | Each configuration requires its own evidence and applicability boundary; activation follows explicit governed routes | `docs/ARCHITECTURE.md` | `system_config` is a core dimension; no activation authority is invented here. |
| C-14 | No silent online enrichment or model-dependent persistence | Issue #116 body; #54 | Model-assisted splitting is optional and replaceable; deterministic validation functions independently. |
| C-15 | Deterministic canonical JSON output and qualification receipt | Issue #116 body | Canonicalization rules produce byte-identical output for identical input/config/context. |
| C-16 | Fail closed to LKG; disable affected profile without changing unrelated generations | #44, #54, #34 | Rollback restores exact LKG; mixed-generation prevention enforced. |
| C-17 | NO_MATCH never counts as applicable; BLOCKED/UNKNOWN/NOT_PROVIDED fail closed when material | Defect dossier | Multi-state matching algebra: NO_MATCH and BLOCKED both prevent applicability. |
| C-18 | Specificity is not truth; narrower scope does not resolve contradiction or grant precedence | Defect dossier; Issue #116 body | Subsumption preserves narrower claim without broadening; conflicts remain visible regardless of specificity. |
| C-19 | Extension admission is reviewable and deterministic without a new authority plane | Defect dossier; Issue #116 body | Admission only makes terms eligible for proposal/validation within existing Knowledge Envelope lifecycle; no registrar truth source, activation right, or runtime capability. |
| C-20 | Immutable editions bind core/profile versions and content digests; LKG is external exact pointer/readback | Defect dossier; #54; #34 | Edition bytes include vocabulary version bindings; LKG is a separate governed selection record. |
| C-21 | Ambiguity fails closed | `docs/CANON.md` (CM-CAN-11) | Missing, stale, contradictory, or unverifiable scope fails closed into NEEDS_CONTEXT or conflict set. |
| C-22 | Claims follow current evidence; historical evidence does not transfer | `docs/CANON.md` (CM-CAN-16) | Evidence links bind exact version/config/environment; drift invalidates. |
| C-23 | Evolution is explicit and reviewable; supersession is append-only, traceable, reversible | `docs/CANON.md` (CM-CAN-17) | Editions and profiles are versioned, append-only, with supersession chains. |
| C-24 | Admission does not grant runtime authority | `docs/CANON.md` (CM-CAN-15) | Extension profile admission is a catalogue eligibility event, not activation. |
| C-25 | Verification Fabric: missing, stale, mismatched, or self-produced evidence denies closure | #34 | Revalidation produces new assessment; prior reports remain immutable. |
| C-26 | Release governance: product increments, not calendar identity; fail-closed publication | `docs/RELEASE-GOVERNANCE.md` | This design does not claim a release; it is a design candidate only. |
| C-27 | Verification Fabric Shadow: FULL_FALLBACK for unmapped/unsafe/ambiguous | `docs/VERIFICATION-FABRIC-SHADOW.md` | Matching algebra returns NO_MATCH (not applicable) or BLOCKED (fail closed) for unmapped/ambiguous scope, analogous to FULL_FALLBACK safety. |

---

## 3. Minimal Cross-Domain Applicability Vocabulary

### 3.1 Core Dimensions

The minimal closed core vocabulary consists of **15 independent dimensions**. Each is first-class: independently addressable, independently queryable, and independently matchable. No dimension is nested inside another or hidden in a composite metadata bag.

| # | Dimension | Description | Sub-slots (independently addressable within the dimension) | Example Core Values |
|---|---|---|---|---|
| 1 | `domain` | Knowledge domain or field | — | `purchasing`, `software-development`, `healthcare` |
| 2 | `knowledge_type` | Kind of knowledge | — | `fact`, `definition`, `recommendation`, `constraint`, `observation`, `hypothesis`, `exception` |
| 3 | `role_responsibility` | Role and responsibility model | — | `requester`, `approver`, `executor`, `auditor` |
| 4 | `industry` | Industry sector | — | `manufacturing`, `retail`, `public-sector`, `technology` |
| 5 | `organization_context` | Organization type, size, maturity | `org_type`, `org_size`, `maturity` | `enterprise`, `smb`, `startup` |
| 6 | `geography_jurisdiction_policy` | Geography, jurisdiction, governing policy | `geography`, `jurisdiction`, `policy` | `eu-gdpr`, `us-ca-ccpa`, `internal-policy-v2` |
| 7 | `process_stage` | Process, process variant, lifecycle stage | `process`, `variant`, `lifecycle_stage` | `requisition`, `approval`, `fulfillment`, `payment` |
| 8 | `system_config` | System, provider, product, version, configuration, data model | `system`, `provider`, `product`, `version`, `configuration`, `data_model` | `sap-mm-4.6c`, `oracle-fusion-r13`, `custom-erp-v3` |
| 9 | `prerequisites_constraints_exceptions` | Enabling, constraining, or invalidating conditions | `prerequisite`, `constraint`, `exception` | `requires-contract`, `requires-approval-tier-2`, `exception-capex` |
| 10 | `task_audience_outcome` | Intended task, audience, outcome | `task`, `audience`, `outcome` | `procurement-analysis`, `compliance-audit`, `cost-reduction` |
| 11 | `valid_time_freshness` | Valid time window and freshness | `valid_from`, `valid_until`, `freshness_basis` | `valid-2024-01-01..2024-12-31`, `freshness-confirmed-2024-06-01` |
| 12 | `epistemic_status` | Epistemic classification of the claim | — | `verified`, `supported`, `contested`, `refuted`, `unverified` |
| 13 | `evidence_strength` | Strength of supporting evidence | — | `strength-high`, `strength-medium`, `strength-low`, `strength-none` |
| 14 | `sensitivity` | Data sensitivity classification | — | `public`, `internal`, `confidential`, `restricted` |
| 15 | `license` | Reuse license | — | `cc-by-4.0`, `cc-by-sa-4.0`, `proprietary`, `unlicensed` |

**Justification for grouped sub-slots:** Dimensions 5–10 contain related sub-concepts that are independently addressable and queryable within their dimension. They are grouped because they share a single semantic axis (e.g., `geography_jurisdiction_policy` all describe the governing context of a claim) and splitting them into separate top-level dimensions would inflate the core beyond the minimal useful set while creating cross-dimension dependency problems (e.g., a policy applies within a jurisdiction). The sub-slots remain independently queryable: a retrieval query can specify `geography_jurisdiction_policy.jurisdiction = eu` without specifying `geography_jurisdiction_policy.policy`. This preserves independent addressability without multiplying top-level dimensions. Dimensions 1–4 and 11–15 are atomic and have no sub-slots.

### 3.2 Closed Value-State Algebra

The four required value states are represented as distinct members of a closed algebraic type. They are distinct in representation, matching, selection, explanation, and remediation.

| State | Symbol | Semantics | Provenance Implication | Matching Behavior | Selection Impact | Explanation | Remediation |
|---|---|---|---|---|---|---|---|
| `UNKNOWN` | `⊥` | The value is unknown; the discriminator is material but no value has been determined. | May carry INFERRED provenance if a model attempted but could not resolve; otherwise untagged. | Fails closed: returns `BLOCKED` for material dimensions. | Blocks default selection; triggers `NEEDS_CONTEXT`. | "Missing material discriminator; value could not be determined." | Ask targeted differentiating question for this dimension. |
| `NOT_PROVIDED` | `∅` | The contributor did not provide a value and no inference has been made. | Provenance is explicitly absent; no INFERRED tag. | Fails closed: returns `BLOCKED` for material dimensions. | Blocks default selection; triggers `NEEDS_CONTEXT`. | "Contributor omitted material discriminator; no inference attempted." | Ask contributor to provide value for this dimension. |
| `NOT_APPLICABLE` | `⊘` | The dimension is irrelevant to this claim; the claim's validity does not depend on this axis. | Must be DECLARED or REVIEWER_CONFIRMED; cannot be INFERRED. | Returns `MATCH_IRRELEVANT`; does not constrain. | Does not block; claim remains selectable on other dimensions. | "Dimension explicitly declared irrelevant to this claim." | None needed; dimension is excluded from matching. |
| `UNRESTRICTED` | `⊤` | The dimension is relevant and the claim is explicitly valid for all values of this dimension. | Must be DECLARED or REVIEWER_CONFIRMED; cannot be INFERRED. | Returns `MATCH_ALL`; does not constrain. | Does not block; claim matches any query value for this dimension. | "Claim explicitly applies to all values of this dimension." | None needed; dimension is universally matched. |

**Mutual exclusivity rules (resolved):**
- `NOT_APPLICABLE` and `UNRESTRICTED` are mutually exclusive for the same dimension of the same claim. A dimension is either irrelevant (`NOT_APPLICABLE`) or relevant-and-all-valued (`UNRESTRICTED`), never both.
- `UNKNOWN` and `NOT_PROVIDED` are mutually exclusive. `UNKNOWN` implies an attempt was made to determine the value (possibly via inference) but failed; `NOT_PROVIDED` implies no attempt was made and no value was supplied.
- `NOT_APPLICABLE` and `UNKNOWN` are mutually exclusive: if a dimension is irrelevant, it cannot also be unknown.
- `UNRESTRICTED` and `UNKNOWN` are mutually exclusive: if a claim is explicitly all-valued, the value is not unknown.
- Ordinary explicit values and explicit value sets are distinct from all four special states. A dimension may hold a set of explicit values (e.g., `{sap-mm-4.6c, oracle-fusion-r13}`) or a single explicit value.

**Algebraic closure:** The set of value states is closed under the operations of matching, provenance tagging, and explanation. No operation produces a value state outside the five categories (four special states plus ordinary explicit values/sets).

### 3.3 Provenance of Scope Values

Every scope value carries a mandatory provenance tag. This prevents hiding inferred scope as contributor-provided fact, as required by Issue #116.

| Provenance | Semantics | Can be INFERRED? | Can hide evidence/sensitivity/license? |
|---|---|---|---|
| `DECLARED` | Explicitly stated by the contributor in the submission. | No. | No. Evidence, sensitivity, and license remain visible. |
| `EVIDENCE_DERIVED` | Extracted from cited source passages with exact source selectors. | No. | No. Source passage and evidence link remain visible. |
| `INFERRED` | Proposed by model or heuristic. Must be marked separately from DECLARED and EVIDENCE_DERIVED. | Yes, by definition. | No. Evidence, sensitivity, and license remain visible even if the scope value is inferred. |
| `REVIEWER_CONFIRMED` | Confirmed by a reviewer during the qualification workflow. | No. | No. Reviewer identity/role is recorded but evidence/sensitivity/license remain visible. |
| `VALIDATION_DERIVED` | Produced by deterministic validation or Verification Fabric assessment. | No. | No. Validation result and evidence bundle reference remain visible. |

**Non-hiding rule:** Provenance tags never suppress evidence links, sensitivity classification, or license declarations. A value tagged `INFERRED` for `sensitivity` does not hide the sensitivity value; it marks that the sensitivity classification was inferred rather than declared. The sensitivity dimension itself remains first-class and visible.

### 3.4 Cardinality

Each dimension accepts a set of values. The default cardinality is multi-valued: a claim may apply to multiple roles, jurisdictions, or system versions. Cardinality constraints are defined per dimension in the core vocabulary and may be further constrained by extension profiles.

**Resolved cardinality rules:**
- `domain`: single-valued per claim (a claim belongs to one domain).
- `knowledge_type`: single-valued per claim (a claim has one epistemic kind).
- `epistemic_status`: single-valued per claim.
- `evidence_strength`: single-valued per claim.
- `sensitivity`: single-valued per claim.
- `license`: single-valued per claim.
- `valid_time_freshness`: single-valued per claim (one valid-time window).
- All other dimensions: multi-valued by default, constrained by extension profiles.

### 3.5 Identifier and Version Rules

- **Core vocabulary identifiers** are prefixed `cm:applicability/v1/` and are immutable within version `v1`.
- **Extension profile identifiers** are prefixed `cm:applicability/ext/{namespace}/v{N}/` where `{namespace}` is a controlled namespace (e.g., `purchasing`, `healthcare`) and `{N}` is a monotonically increasing integer.
- **No unbounded tags.** Terms outside the core 15 dimensions or outside a registered extension profile are invalid and fail closed.
- **No second source of truth.** Extension profiles reference the core vocabulary; they do not redefine core dimensions or core value states.
- **Canonicalization rule (resolved):** Multi-valued dimension sets are sorted lexicographically by term identifier within each dimension for deterministic digest computation.

---

## 4. Multi-State Matching Algebra

### 4.1 Per-Dimension Matching

Given a query context $Q$ and a claim scope $S$, matching is performed per dimension $d$. The result is one of six states:

$$
\text{match}_d(Q, S) = \begin{cases}
\text{MATCH\_IRRELEVANT} & \text{if } S_d = \oslash \text{ (NOT\_APPLICABLE)} \\
\text{MATCH\_ALL} & \text{if } S_d = \top \text{ (UNRESTRICTED)} \\
\text{MATCH\_EXPLICIT} & \text{if } S_d \notin \{\top, \oslash, \bot, \emptyset\} \text{ and } Q_d \in S_d \\
\text{NO\_MATCH} & \text{if } S_d \notin \{\top, \oslash, \bot, \emptyset\} \text{ and } Q_d \notin S_d \\
\text{BLOCKED} & \text{if } S_d \in \{\bot, \emptyset\} \text{ and } d \text{ is material} \\
\text{NON\_MATERIAL\_UNKNOWN} & \text{if } S_d \in \{\bot, \emptyset\} \text{ and } d \text{ is non-material}
\end{cases}
$$

### 4.2 Materiality

A dimension is **material** for a given claim if the claim's validity depends on that dimension. Materiality is determined by:
1. The `domain` and `knowledge_type` of the claim (e.g., `sensitivity` is always material; `jurisdiction` is material for policy claims but may be declared `NOT_APPLICABLE` for purely technical observations).
2. Extension profiles may declare additional materiality rules for their namespace.
3. If materiality is ambiguous, the dimension is treated as material (fail closed).

### 4.3 Claim-Level Applicability

A claim is **applicable** to query $Q$ if and only if:
- For every material dimension $d$: $\text{match}_d(Q, S) \in \{\text{MATCH\_EXPLICIT}, \text{MATCH\_ALL}, \text{MATCH\_IRRELEVANT}\}$
- No dimension returns $\text{NO\_MATCH}$
- No material dimension returns $\text{BLOCKED}$

A claim is **not applicable** if any dimension returns $\text{NO\_MATCH}$. $\text{NO\_MATCH}$ never counts as applicable.

A claim is **blocked** if any material dimension returns $\text{BLOCKED}$ and no dimension returns $\text{NO\_MATCH}$. A blocked claim cannot be selected and triggers $\text{NEEDS\_CONTEXT}$.

A claim is **non-material-unknown** if all material dimensions match but one or more non-material dimensions are $\text{UNKNOWN}$ or $\text{NOT\_PROVIDED}$. The claim remains applicable but the unknown non-material dimensions are surfaced in the explanation.

### 4.4 Summary Table

| Per-dimension result | Contributes to applicability? | Contributes to blocking? |
|---|---|---|
| MATCH_EXPLICIT | Yes | No |
| MATCH_ALL | Yes | No |
| MATCH_IRRELEVANT | Yes | No |
| NO_MATCH | No — claim is not applicable | N/A (pre-empts blocking) |
| BLOCKED (material) | No | Yes — triggers NEEDS_CONTEXT |
| NON_MATERIAL_UNKNOWN | Yes (claim still applicable) | No (surfaced in explanation) |

### 4.5 Preventing Unsafe Default Selection

- `UNKNOWN` and `NOT_PROVIDED` never match a query context for a material dimension. They return `BLOCKED` and fail closed.
- `UNRESTRICTED` matches any value but is explicit; it does not imply the claim is a default answer.
- `NO_MATCH` is terminal for the claim: the claim is not applicable regardless of other dimensions.
- The retrieval contract requires applicability filtering before ranking. Only applicable, non-blocked claims are ranked.
- If zero claims are applicable and at least one is blocked, retrieval returns `NEEDS_CONTEXT` with the smallest useful question set.
- If multiple applicable claims conflict and no scope dimension differentiates them, retrieval returns an `AMBIGUITY_SET` with the differentiating question. No single answer is invented.

---

## 5. Conflict, Ambiguity, Subsumption, Equivalence, Duplicate, Common-Core, Scoped-Variant, Prerequisite, Exception, and Missing-Context Semantics

### 5.1 Specificity Is Not Truth

A narrower scope aids separation but does not resolve an overlapping contradiction, does not grant precedence, and does not constitute a truth criterion. Specificity is a structural property of scope, not an epistemic authority. This rule applies to all semantics below.

### 5.2 Semantics

| Relation | Definition | Outcome | Specificity Rule |
|---|---|---|---|
| **Exact duplicate** | Two claims have identical assertions and identical applicability scopes. | Retain one canonical claim; aggregate independent evidence/provenance. | N/A — scopes are identical. |
| **Equivalent wording** | Two claims have semantically equivalent assertions but different source-specific wording. | Propose semantic equivalence; preserve source-specific assertions and evidence. | N/A — equivalence is semantic, not scope-based. |
| **Common core** | The smallest supported statement shared across compatible variants, where the exact same assertion is supported by evidence in all variants and no material constraint is dropped. | Extract common core as a Core Claim; create Scoped Variants as deltas. | The core is broader, not narrower. Generalization is marked `INFERRED` provenance. |
| **Scoped variant** | A delta valid only under declared conditions that differ from the common core. | Create Scoped Variant with explicit differentiators. | The variant is narrower than the core; this does not make it more true. |
| **Subsumption** | Claim A scope $\subseteq$ Claim B scope. | Relate by subsumption; do not broaden A. | A is narrower; A does not take precedence over B. If A and B conflict, the conflict is preserved. |
| **Disjoint variants** | Claims with non-overlapping scopes. | Coexist under explicit, machine-readable differentiators. | Neither is more specific; both are equally valid in their respective scopes. |
| **Overlapping contradiction** | Two claims with overlapping scopes but conflicting assertions that cannot be reconciled. | Create Conflict Record; no default selection; retrieval returns conflict set and differentiating question. | Narrower scope does not resolve the contradiction. Specificity is not truth. |
| **Prerequisite** | A condition that must hold for a claim to be valid. | Stored in `prerequisites_constraints_exceptions` dimension with `prerequisite` sub-slot. | A claim with more prerequisites is narrower; this does not make it more authoritative. |
| **Exception** | A condition that invalidates a claim. | Stored in `prerequisites_constraints_exceptions` dimension with `exception` sub-slot. | An exception narrows the claim; it does not create a competing truth. |
| **Missing context** | A material dimension is `UNKNOWN` or `NOT_PROVIDED`. | Return `NEEDS_CONTEXT` with the smallest useful question set. The claim cannot become a default answer. | Missing context is not specificity; it is absence. |
| **Ambiguity** | Multiple applicable claims conflict and no scope dimension differentiates them. | Return `AMBIGUITY_SET` with differentiating question. No single answer is invented. | Ambiguity is not resolved by picking the most specific claim. |

### 5.3 Conservative Generalization Test

A common core is only extracted if all of the following hold:
1. The exact same assertion is supported by evidence in all variants.
2. The generalization does not drop a material constraint present in any variant.
3. The generalization does not merge distinct concepts.
4. The common core is marked `INFERRED` provenance and shown separately to the contributor.
5. The contributor or reviewer confirms the generalization (transitioning provenance to `REVIEWER_CONFIRMED`).

If any condition fails, the variants are preserved as disjoint or conflicting. No manufactured common core is created.

### 5.4 Equivalence Semantics Across Claim Kinds

Equivalence is claim-kind-sensitive:
- For `fact` and `definition`: equivalence requires identical referent and identical truth conditions.
- For `recommendation`: equivalence requires identical recommended action and identical preconditions.
- For `constraint`: equivalence requires identical constrained behavior and identical boundary conditions.
- For `observation`: equivalence requires identical observed phenomenon and identical observation context.
- For `hypothesis`: equivalence requires identical hypothesis and identical testable predictions.
- For `exception`: equivalence requires identical invalidated claim and identical invalidating condition.

---

## 6. Provenance and Explanation Treatment

### 6.1 Provenance Lifecycle

Every scope value transitions through provenance states in a directed, append-only graph:

```
DECLARED ──────────────────────→ REVIEWER_CONFIRMED
EVIDENCE_DERIVED ───────────────→ REVIEWER_CONFIRMED
INFERRED ──────→ DECLARED (if contributor confirms)
INFERRED ──────→ EVIDENCE_DERIVED (if source passage found)
INFERRED ──────→ REVIEWER_CONFIRMED (if reviewer confirms)
VALIDATION_DERIVED ────────────→ REVIEWER_CONFIRMED
```

Provenance is never overwritten. A transition creates a new provenance tag; the prior tag remains in the append-only history. A value that was `INFERRED` and later confirmed by the contributor becomes `DECLARED` with a traceable link to the prior `INFERRED` state.

### 6.2 Explanation Requirements

Every retrieved claim must include:
1. **Scope rationale:** For each dimension, the matching result (MATCH_EXPLICIT, MATCH_ALL, MATCH_IRRELEVANT, BLOCKED, NON_MATERIAL_UNKNOWN) and the provenance of the scope value.
2. **Evidence summary:** Evidence links (positive/negative), source passages, edition digest, and freshness window.
3. **Epistemic status:** The `epistemic_status` and `evidence_strength` values.
4. **Sensitivity and license:** The `sensitivity` and `license` values, regardless of provenance.
5. **Conflict/ambiguity notice:** If the claim is part of a conflict set or ambiguity set, the notice identifies the conflicting claims and the differentiating question.
6. **Inferred scope disclosure:** Any `INFERRED` scope values are explicitly marked as inferred, not declared.

### 6.3 Non-Hiding Guarantee

Provenance tags, matching results, and explanations never suppress:
- Evidence links or source passages.
- Sensitivity classification.
- License declarations.
- Conflict records.
- Missing-context indicators.

An `INFERRED` sensitivity value is displayed as "sensitivity: internal (INFERRED)" not as "sensitivity: hidden."

---

## 7. Controlled Extension Profile Lifecycle and Admission Criteria

### 7.1 Extension Profile Structure

An extension profile is a versioned, namespaced document that defines:
- Specialized terms for core dimensions (e.g., `purchasing:v1` extends `process_stage` with `requisition`, `rfq`, `po-creation`, `goods-receipt`).
- Optional sub-dimensions scoped to the namespace (e.g., `purchasing:commodity_type` as a refinement of `prerequisites_constraints_exceptions`).
- Cardinality constraints for dimensions within the namespace.
- Mapping rules to core dimensions (e.g., `purchasing:commodity_type` maps to `prerequisites_constraints_exceptions.constraint`).
- Materiality rules for the namespace (e.g., `jurisdiction` is material for `purchasing` claims involving public-sector procurement).

### 7.2 Admission Criteria

Admission is a deterministic, reviewable eligibility check. It does not create a new authority plane, registrar truth source, profile activation right, policy approval, or runtime capability.

An extension profile is admitted if and only if:
1. **No core redefinition:** The profile does not redefine, rename, or remove any core dimension or core value state.
2. **Namespace isolation:** The profile's namespace does not collide with any existing registered namespace.
3. **Term uniqueness:** Terms within the profile are unique within the namespace and version.
4. **Mapping completeness:** Every sub-dimension declares a mapping to a core dimension.
5. **Deterministic validation:** The profile passes deterministic structural validation (schema shape, identifier format, no circular mappings).
6. **No authority claim:** The profile does not declare runtime permissions, capabilities, activation rights, or truth authority.
7. **Evidence boundary:** The profile declares its evidence expectations and applicability boundary.

Admission makes terms **eligible for proposal and validation** within the existing Knowledge Envelope lifecycle. It does not activate, publish, or authorize anything.

### 7.3 Lifecycle

1. **Proposal:** An extension profile is proposed as a versioned document with a namespace and version.
2. **Deterministic validation:** Structural validation checks admission criteria. This is deterministic and repeatable.
3. **Review:** The profile is reviewed for semantic consistency, collision avoidance, and mapping correctness. Review is a qualification step, not an authority decision.
4. **Registration:** The profile is registered under its namespace and version. Registration is append-only; prior versions remain immutable and queryable.
5. **Binding:** Knowledge Envelopes reference the extension profile by namespace and version. An envelope may reference multiple profiles.
6. **Supersession:** A new version of a profile supersedes the prior version. Prior versions remain immutable and queryable for historical editions.
7. **Deprecation:** A profile version may be deprecated but not deleted. Deprecated versions remain queryable for historical editions. New envelopes should not bind to deprecated versions.
8. **Revocation:** A profile version may be revoked if it is found to violate admission criteria retroactively. Revoked versions remain immutable for history but new envelopes cannot bind to them. Existing envelopes bound to a revoked profile are flagged for revalidation.

### 7.4 Collision and Conflict Rules

- **No redefinition of core dimensions.** Extensions may refine but not redefine.
- **Namespace isolation.** Terms in `purchasing:v1` and `healthcare:v1` cannot collide.
- **Cross-profile mapping.** If two profiles define semantically equivalent terms, a mapping may be proposed but must not merge them. The mapping is informative, not authoritative. Retrieval may surface both terms with the mapping noted.
- **Version compatibility.** A Knowledge Envelope bound to `purchasing:v1` cannot be silently reinterpreted under `purchasing:v2`. Reinterpretation requires a new edition.
- **No unregistered terms.** Terms outside the core vocabulary and outside a registered extension profile are invalid and fail closed.

---

## 8. Immutable Edition, Extension/Core Version Binding, LKG Pointer/Readback, Migration, Revalidation, Rollback, and Mixed-Generation Prevention

### 8.1 Immutable Edition Binding

A Knowledge Edition is an immutable, content-addressed record. Its bytes include:
- The content digest of all atomic claims, scopes, evidence links, and qualification decisions.
- The core vocabulary version binding (e.g., `cm:applicability/v1/`).
- The extension profile version bindings (e.g., `cm:applicability/ext/purchasing/v1/`).
- The supersession chain pointer (predecessor edition digest and reason).
- The submission digest of the originating contribution.

The edition's digest is computed over all of the above. Any change to vocabulary bindings, content, or supersession chain produces a different digest and therefore a different edition.

### 8.2 LKG Pointer and Readback

The Last-Known-Good (LKG) state is an **external, governed selection record** pointing to a specific immutable edition digest. It is not a mutable flag inside edition bytes.

- LKG readback returns the exact edition digest, its vocabulary bindings, and its content digest.
- LKG readback is exact: the readback digest must match the edition digest byte-for-byte.
- LKG readback is namespaced per #34: verdicts and evidence bundles are namespaced and cannot contaminate each other.
- If LKG readback fails (missing, stale, mismatched, or tampered), the system fails closed to the prior LKG or disables the affected profile.

### 8.3 Migration

- **Profile migration:** When `purchasing:v2` supersedes `purchasing:v1`, envelopes bound to `v1` are not silently reinterpreted. A new edition must be created to adopt `v2`. The new edition's supersession chain links to the prior edition.
- **Core migration:** If the core vocabulary moves to `v2`, a migration plan maps `v1` dimensions to `v2`. Existing editions remain bound to `v1`. New editions may adopt `v2`. The migration plan is itself a versioned, reviewable document.
- **No mixed generation.** An edition cannot mix `v1` and `v2` core vocabulary or `v1` and `v2` of the same extension profile. The edition's vocabulary binding is uniform. An edition may reference multiple different extension profiles (e.g., `purchasing:v1` and `healthcare:v1`) but not multiple versions of the same profile.

### 8.4 Revalidation

- Revalidation triggers a new Verification Fabric assessment (#34) without rewriting prior reports.
- If revalidation invalidates a claim, the claim is marked invalid in a new edition. The prior edition remains immutable.
- Dependents of the invalidated claim are flagged for drift review per CM-CAN-17.
- Revalidation is namespaced: a revalidation of `purchasing:v1` claims does not affect `healthcare:v1` claims.

### 8.5 Rollback

- If an edition activation fails or is revoked, the exact prior LKG edition is restored.
- **Zero-residue rollback:** No partial state from the failed edition persists. The rollback is atomic.
- **Mixed-generation prevention:** The restored LKG edition is uniformly bound to its original vocabulary versions. No cross-generation contamination occurs.
- Rollback is a separately authorized compensating action per CM-CAN-13, not a replay or revocation.

### 8.6 Compatibility with #44, #54, #34

| Contract | Adherence |
|---|---|
| #44: Universal Knowledge Envelope | Applicability Scope is a structured field within the Knowledge Envelope, not a parallel record. The envelope's digest binds the scope. |
| #44: Governed dynamic taxonomy | Extension profiles are the dynamic taxonomy mechanism. They are versioned, namespaced, and reviewable. |
| #44: Conflicts/citations | Conflict Records and Evidence Links are first-class objects within the envelope. |
| #44: Exact curated vs exploratory selection | Applicability filtering before ranking ensures only applicable claims are selected. Curated (accepted) and exploratory (draft) states are distinct. |
| #44: Capability output zero | No runtime capability, execution, or authority is granted by this design. |
| #44: Taxonomy migration | Extension profile versioning and supersession provide migration paths. |
| #44: LKG rollback | Editions are immutable; LKG fallback is exact and zero-residue. |
| #54: Immutable cited offline editions | Editions are content-addressed, append-only, with source passages and digests. |
| #54: Visible contradictions/shared-source dependence | Conflict Records and shared-source dependencies are preserved and surfaced. |
| #54: Accepted/unrevoked read-only generations | Retrieval consumes only accepted, unrevoked editions. |
| #54: Exact zero-residue LKG rollback | Rollback restores the exact prior edition; mixed-generation prevention enforced. |
| #54: No silent online fallback | All operations are offline by default; no silent network enrichment. |
| #34: Typed verification/evidence | Evidence Links are typed (positive/negative support, contradiction). |
| #34: Namespaced verdicts | Extension profiles and evidence links are namespaced. |
| #34: Revalidation | Revalidation triggers a new assessment without rewriting prior reports. |
| #34: No self-approval | This design does not grant approval authority. |
| #34: Exact LKG readback | LKG readback proves exact fallback target. |
| #34: Missing/stale/mismatched evidence denies closure | Revalidation with missing evidence fails closed. |

---

## 9. Worked Examples

### 9.1 Purchasing Domain

**Contribution A:** "Purchase orders above $10,000 require Tier-2 manager approval in SAP MM 4.6c for our manufacturing company."

**Atomic Claim:** "PO > $10K requires Tier-2 approval."

**Applicability Scope:**

| Dimension | Value | Provenance |
|---|---|---|
| `domain` | `purchasing` | DECLARED |
| `knowledge_type` | `constraint` | DECLARED |
| `role_responsibility` | `approver` | DECLARED |
| `industry` | `manufacturing` | DECLARED |
| `organization_context` | `UNKNOWN` (⊥) | — |
| `geography_jurisdiction_policy` | `NOT_PROVIDED` (∅) | — |
| `process_stage` | `approval` | DECLARED |
| `system_config` | `sap-mm-4.6c` | DECLARED |
| `prerequisites_constraints_exceptions` | `prerequisite: po > $10K` | DECLARED |
| `task_audience_outcome` | `procurement-analysis` | INFERRED |
| `valid_time_freshness` | `valid-2024-01-01..2024-12-31` | EVIDENCE_DERIVED |
| `epistemic_status` | `supported` | EVIDENCE_DERIVED |
| `evidence_strength` | `strength-medium` | INFERRED |
| `sensitivity` | `internal` | DECLARED |
| `license` | `cc-by-4.0` | DECLARED |

**Contribution B:** "In our retail enterprise, all POs require Tier-2 approval regardless of amount, using Oracle Fusion R13."

**Atomic Claim:** "All POs require Tier-2 approval."

**Applicability Scope:**

| Dimension | Value | Provenance |
|---|---|---|
| `domain` | `purchasing` | DECLARED |
| `knowledge_type` | `constraint` | DECLARED |
| `role_responsibility` | `approver` | DECLARED |
| `industry` | `retail` | DECLARED |
| `organization_context` | `enterprise` | DECLARED |
| `geography_jurisdiction_policy` | `NOT_PROVIDED` (∅) | — |
| `process_stage` | `approval` | DECLARED |
| `system_config` | `oracle-fusion-r13` | DECLARED |
| `prerequisites_constraints_exceptions` | `UNRESTRICTED` (⊤) | DECLARED ("regardless of amount") |
| `task_audience_outcome` | `procurement-analysis` | INFERRED |
| `valid_time_freshness` | `valid-2023-06-01..2024-05-31` | EVIDENCE_DERIVED |
| `epistemic_status` | `supported` | EVIDENCE_DERIVED |
| `evidence_strength` | `strength-medium` | INFERRED |
| `sensitivity` | `internal` | DECLARED |
| `license` | `cc-by-4.0` | DECLARED |

**Analysis:**
- **Common core:** None extracted. The assertions differ ("PO > $10K" vs "All POs"). The conservative generalization test fails because the material constraint `prerequisite: po > $10K` is dropped in B. No manufactured core is created.
- **Scoped variants:** Variant A is scoped by `system_config = sap-mm-4.6c`, `industry = manufacturing`, `prerequisite: po > $10K`. Variant B is scoped by `system_config = oracle-fusion-r13`, `industry = retail`, `prerequisite: UNRESTRICTED`.
- **Conflict:** None. The variants are disjoint by `system_config` and `industry`.
- **Missing context:** `organization_context` is `UNKNOWN` in A; `geography_jurisdiction_policy` is `NOT_PROVIDED` in both. If a query specifies an organization context or jurisdiction, A returns `BLOCKED` for `organization_context` and both return `BLOCKED` for `geography_jurisdiction_policy` (if material).

**Retrieval Scenario 1:**
- Query: "Does a $5,000 PO require Tier-2 approval in SAP MM 4.6c in manufacturing?"
- Query context: `domain=purchasing`, `process_stage=approval`, `system_config=sap-mm-4.6c`, `industry=manufacturing`, `prerequisites_constraints_exceptions.prerequisite=po=$5K`.
- Match against A: `system_config` matches (`sap-mm-4.6c`). `industry` matches (`manufacturing`). `prerequisites_constraints_exceptions.prerequisite` in A is `po > $10K`. Query value `po=$5K` does not satisfy. Result: `NO_MATCH`. Claim A is not applicable.
- Match against B: `system_config` does not match (`oracle-fusion-r13` vs `sap-mm-4.6c`). Result: `NO_MATCH`. Claim B is not applicable.
- Outcome: No applicable claim. Retrieval returns `NEEDS_CONTEXT`: "No claim found for SAP MM 4.6c with PO ≤ $10K in manufacturing. Is there a different threshold or exception?"

**Retrieval Scenario 2:**
- Query: "Does a $15,000 PO require Tier-2 approval in SAP MM 4.6c in manufacturing?"
- Query context: `domain=purchasing`, `process_stage=approval`, `system_config=sap-mm-4.6c`, `industry=manufacturing`, `prerequisites_constraints_exceptions.prerequisite=po=$15K`.
- Match against A: `system_config` matches. `industry` matches. `prerequisites_constraints_exceptions.prerequisite` in A is `po > $10K`. Query value `po=$15K` satisfies. Result: `MATCH_EXPLICIT`. `organization_context` is `UNKNOWN` — if material, returns `BLOCKED`. If non-material, returns `NON_MATERIAL_UNKNOWN`.
- Assuming `organization_context` is non-material for this query: Claim A is applicable. `geography_jurisdiction_policy` is `NOT_PROVIDED` — if non-material, returns `NON_MATERIAL_UNKNOWN`.
- Outcome: Claim A is returned with scope rationale: "Applies to purchasing, manufacturing, SAP MM 4.6c, PO > $10K. `organization_context` and `geography_jurisdiction_policy` were not provided (surfaced in explanation)."

**Retrieval Scenario 3 (conflict):**
- Contribution C: "In our manufacturing company using SAP MM 4.6c, POs above $10,000 require Tier-3 approval, not Tier-2."
- This overlaps with A on `system_config`, `industry`, and `prerequisite` but conflicts on `role_responsibility` (Tier-2 vs Tier-3).
- Result: `Conflict Record`. No default selection. Retrieval returns the conflict set: "Two claims conflict for SAP MM 4.6c, manufacturing, PO > $10K: Tier-2 (A) vs Tier-3 (C). Differentiating question: Which approval tier is required for POs > $10K in your SAP MM 4.6c configuration?"
- Specificity does not resolve this: both claims have the same scope specificity. Even if C were narrower (e.g., specific to a configuration variant), the narrower claim would not take precedence.

### 9.2 Software Development Domain (Second Domain)

**Contribution D:** "In our startup, we deploy to production using trunk-based development with feature flags."

**Atomic Claim:** "Deployment uses trunk-based development with feature flags."

**Applicability Scope:**

| Dimension | Value | Provenance |
|---|---|---|
| `domain` | `software-development` | DECLARED |
| `knowledge_type` | `observation` | DECLARED |
| `role_responsibility` | `developer` | DECLARED |
| `industry` | `technology` | DECLARED |
| `organization_context` | `startup` | DECLARED |
| `geography_jurisdiction_policy` | `NOT_APPLICABLE` (⊘) | DECLARED ("not relevant") |
| `process_stage` | `deployment` | DECLARED |
| `system_config` | `trunk-based-with-feature-flags` | DECLARED |
| `prerequisites_constraints_exceptions` | `prerequisite: requires-feature-flag-system` | INFERRED |
| `task_audience_outcome` | `devops-engineer` | INFERRED |
| `valid_time_freshness` | `valid-2023-01-01..open` | DECLARED |
| `epistemic_status` | `unverified` | DECLARED |
| `evidence_strength` | `strength-low` | INFERRED |
| `sensitivity` | `internal` | DECLARED |
| `license` | `cc-by-sa-4.0` | DECLARED |

**Contribution E:** "In our enterprise, we use release branches with staged rollout."

**Atomic Claim:** "Deployment uses release branches with staged rollout."

**Applicability Scope:**

| Dimension | Value | Provenance |
|---|---|---|
| `domain` | `software-development` | DECLARED |
| `knowledge_type` | `observation` | DECLARED |
| `role_responsibility` | `release-manager` | DECLARED |
| `industry` | `technology` | DECLARED |
| `organization_context` | `enterprise` | DECLARED |
| `geography_jurisdiction_policy` | `NOT_APPLICABLE` (⊘) | DECLARED |
| `process_stage` | `deployment` | DECLARED |
| `system_config` | `release-branches-staged-rollout` | DECLARED |
| `prerequisites_constraints_exceptions` | `prerequisite: requires-release-branch-policy` | INFERRED |
| `task_audience_outcome` | `devops-engineer` | INFERRED |
| `valid_time_freshness` | `valid-2022-01-01..open` | DECLARED |
| `epistemic_status` | `unverified` | DECLARED |
| `evidence_strength` | `strength-low` | INFERRED |
| `sensitivity` | `internal` | DECLARED |
| `license` | `cc-by-sa-4.0` | DECLARED |

**Analysis:**
- **Common core:** None extracted. The assertions differ ("trunk-based with feature flags" vs "release branches with staged rollout"). The conservative generalization test fails because the material `system_config` and `prerequisites_constraints_exceptions` differ.
- **Scoped variants:** Variant D is scoped by `organization_context = startup`, `system_config = trunk-based-with-feature-flags`. Variant E is scoped by `organization_context = enterprise`, `system_config = release-branches-staged-rollout`.
- **Conflict:** None. Disjoint by `organization_context` and `system_config`.
- **Unsafe abstraction rejected:** "All deployments use feature flags" is not a supported core because Variant E does not use feature flags. "All deployments use branching" is not a supported core because the branching strategies differ materially.

**Retrieval Scenario:**
- Query: "How does deployment work in a startup?"
- Query context: `domain=software-development`, `process_stage=deployment`, `organization_context=startup`.
- Match against D: `organization_context` matches (`startup`). `geography_jurisdiction_policy` is `NOT_APPLICABLE` → `MATCH_IRRELEVANT`. Other dimensions not specified in query do not constrain (query omits them, so they are not matched against; the claim's values for those dimensions are not queried). Result: applicable.
- Match against E: `organization_context` does not match (`enterprise` vs `startup`). Result: `NO_MATCH`. Claim E is not applicable.
- Outcome: Claim D is returned with scope rationale: "Applies to software-development, deployment, startup. `geography_jurisdiction_policy` declared not applicable. `prerequisites_constraints_exceptions.prerequisite` is inferred (requires-feature-flag-system) and marked separately from declared values. `evidence_strength` is low and inferred."

**Extension Profile Example:**
- A `software-development:v1` extension profile may define `process_stage` terms: `commit`, `build`, `test`, `stage`, `deploy`, `rollback`.
- It may define a sub-dimension `software-development:deployment_strategy` mapped to `system_config`.
- It may declare `geography_jurisdiction_policy` as non-material for `software-development` claims of `knowledge_type=observation` unless the observation involves compliance-restricted deployment.
- Admission checks: no core redefinition, namespace isolation (`software-development` ≠ `purchasing`), term uniqueness, mapping completeness, deterministic validation, no authority claim, evidence boundary declared.

---

## 10. Rejected Alternatives, Risks, Fallback, and Smallest Later Validation Plan

### 10.1 Rejected Alternatives

| Alternative | Rejection Reason |
|---|---|
| Free-form tag soup | Violates #116's requirement for controlled extension and avoidance of unbounded tags. |
| Universal ontology with all domain terms in core | Violates #116's requirement to avoid an overfitted universal ontology. |
| Merging `UNKNOWN` and `NOT_PROVIDED` into one state | Violates #116's explicit requirement for four distinct value states; their provenance, explanation, and remediation differ. |
| Merging `NOT_APPLICABLE` and `UNRESTRICTED` into one "wildcard" state | Violates #116's requirement for four distinct value states; `NOT_APPLICABLE` means irrelevant, `UNRESTRICTED` means relevant-and-all-valued. |
| Treating `UNRESTRICTED` as a default answer | Violates #116's requirement that no default selection occurs; `UNRESTRICTED` is explicit, not a fallback. |
| Parallel Knowledge Envelope for applicability | Violates #116's requirement to reuse and extend #44 contracts. |
| Similarity-based matching | Violates `docs/CANON.md` CM-CAN-16: evidence does not transfer by resemblance or popularity. |
| Silent online enrichment | Violates #116 and #54: no silent online fallback or model-dependent persistence. |
| Narrower scope resolves overlapping contradiction | Violates #116 and defect dossier: specificity is not truth; no default selection. |
| Mutable LKG flag inside immutable edition | Violates #54 and defect dossier: exact LKG readback requires external governed pointer, not mutable content. |
| Composite metadata bag for evidence/sensitivity/license | Violates defect dossier: evidence strength, sensitivity, and license must be first-class, not hidden. |
| Extension profiles adding new top-level dimensions | Creates unbounded growth; extensions may only add sub-dimensions scoped to their namespace. |
| Extension admission as authority/policy approval | Violates #116 and defect dossier: admission only makes terms eligible; no new authority plane. |
| Mixed-generation edition reads | Violates #54 and defect dossier: editions cannot mix vocabulary versions. |

### 10.2 Risks

| # | Risk | Mitigation |
|---|---|---|
| R-1 | Extension profiles proliferate into unbounded tag soup. | Controlled registration, namespace isolation, versioning, deterministic validation, and review. No unregistered terms. |
| R-2 | Inferred scope values are accidentally treated as declared. | Provenance tags are mandatory; model-assisted inference is marked `INFERRED` and shown separately to the contributor. Non-hiding guarantee enforced. |
| R-3 | Mixed-generation contamination during rollback. | Atomic rollback restores exact LKG edition; uniform vocabulary binding enforced; mixed-generation reads rejected. |
| R-4 | Overlapping contradictions are silently flattened. | Conflict Records are first-class; retrieval returns conflict sets; no default selection; specificity is not truth. |
| R-5 | Core vocabulary becomes an overfitted universal ontology. | Core is minimal (15 dimensions); specialized terms deferred to extensions; extensions cannot add top-level dimensions. |
| R-6 | Model outage loses raw contributions. | Raw contribution envelope is immutable and preserved before any model processing. Deterministic validation functions independently. |
| R-7 | `NOT_APPLICABLE` and `UNRESTRICTED` are conflated in implementation. | Mutual exclusivity rule is explicit in the algebra; both states are distinct enum members with distinct matching, explanation, and remediation. |
| R-8 | Materiality is ambiguous, causing unsafe selection. | If materiality is ambiguous, the dimension is treated as material (fail closed). |
| R-9 | Cross-profile term mapping merges distinct concepts. | Mappings are informative, not authoritative; both terms are surfaced in retrieval with the mapping noted. |
| R-10 | Extension admission becomes a second authority plane. | Admission only makes terms eligible for proposal/validation; no activation, no truth authority, no runtime capability. |

### 10.3 Fallback

If this design is not accepted:
- Revert to the current public-main state: the structured, cross-domain applicability vocabulary requested in #116 is not added.
- The Knowledge Envelope (#44) remains the source of truth.
- Applicability remains as currently defined in CANON/Knowledge Harvest, but retrieval cannot filter by the structured vocabulary before ranking.
- The design does not break existing contracts because it is non-normative and introduces no changes to the current codebase.
- No authority, capability, or runtime right is created or revoked by the non-acceptance of this candidate.

### 10.4 Smallest Later Validation Plan

| # | Validation Step | Precondition | What It Proves |
|---|---|---|---|
| V-1 | Define canonical JSON schema for Applicability Scope, ValueState algebra, and Extension Profile. | This design accepted. | Structural validity of the vocabulary. |
| V-2 | Build synthetic purchasing fixture with shared cores, variants, conflicts, missing context, and two system/version variants. | V-1 complete. | Base contracts from #116 M0 slice. |
| V-3 | Build synthetic software-development fixture to test cross-domain generalizability and extension profile lifecycle. | V-2 complete. | Cross-domain independence of dimensions. |
| V-4 | Test conservative generalization test against fixtures to ensure no manufactured common core. | V-3 complete. | No unsafe abstraction. |
| V-5 | Test multi-state matching algebra: NO_MATCH never applicable, BLOCKED/UNKNOWN/NOT_PROVIDED fail closed when material, MATCH_ALL/MATCH_IRRELEVANT do not block. | V-3 complete. | Matching algebra correctness. |
| V-6 | Test LKG rollback and mixed-generation prevention with synthetic editions. | V-4 complete. | #54/#34 compatibility. |
| V-7 | Test extension profile lifecycle: proposal, deterministic validation, review, registration, supersession, deprecation, revocation. | V-5 complete. | No second authority plane. |
| V-8 | Test provenance non-hiding: INFERRED scope values do not suppress evidence, sensitivity, or license. | V-6 complete. | Provenance correctness. |

---

## 11. Future Validation Topics

The following topics are not unresolved decisions for this design candidate. All design choices needed for this proposal are resolved above. These topics identify areas for later validation work that depends on acceptance of this candidate:

- Exact JSON schema field names and serialization order for canonical digest computation.
- Precise materiality rules per `domain` × `knowledge_type` combination.
- Localization and terminology mapping rules that avoid merging distinct concepts.
- Reviewer roles, separation of duties, and dispute handling flow within the qualification workflow.
- Privacy, tenant isolation, export, retention, and deletion semantics for contributed knowledge.
- Freshness, revalidation, supersession, and revocation policies by knowledge type.
- Context-question minimization algorithm for `NEEDS_CONTEXT` responses.
- Service API, event schema, Docker volume, resource limit, backup/LKG, and migration contract details.
- Multi-domain evaluation corpus design after the purchasing fixture proves base contracts.
- HMI presentation rules for scope, ambiguity, and evidence across harnesses.

---

## 12. Resolved Design Decisions Summary

All design decisions required for this candidate are resolved. There are no unresolved Open Decisions.

| Decision | Resolution |
|---|---|
| `NOT_APPLICABLE` and `UNRESTRICTED` coexistence | Mutually exclusive. A dimension is either irrelevant or relevant-and-all-valued, never both. |
| `UNKNOWN` and `NOT_PROVIDED` distinction | Distinct in representation, provenance, explanation, and remediation. Identical in fail-closed matching behavior (both return `BLOCKED` for material dimensions). |
| Extension profiles defining new dimensions | Extensions may define sub-dimensions scoped to their namespace but cannot add new top-level dimensions. |
| Canonicalization sort rule | Lexicographic sort by term identifier within each dimension. |
| Splitting composite metadata into independent dimensions | 15 independent dimensions; `valid_time_freshness`, `epistemic_status`, `evidence_strength`, `sensitivity`, and `license` are each separate first-class dimensions. |
| Materiality ambiguity | Treated as material (fail closed). |
| `UNRESTRICTED` as default | Not a default; explicit all-valued declaration. Does not imply default selection. |
| Specificity as truth | Not truth; narrower scope does not resolve contradiction or grant precedence. |
| Extension admission authority | No authority; admission only makes terms eligible for proposal/validation within existing lifecycle. |
| LKG representation | External governed pointer to immutable edition digest; not a mutable flag inside edition bytes. |
| Mixed-generation reads | Rejected; editions are uniformly bound to one vocabulary version per profile. |
