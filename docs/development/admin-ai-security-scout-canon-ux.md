# Admin-AI security control UX and Canon scout

**Status:** read-only design scout; no runtime implementation claim
**Baseline inspected:** `feat/admin-ai-security-analysis-backlog` at `47da5ac`
**Scope:** owner-facing, fine-grained control of an administrative AI without a
per-agent switchboard
**Priority rule:** importance is the primary sort key; lower complexity breaks
ties. A low-importance item never outranks a high-importance item merely because
it is easy.

## 1. Executive verdict

ChimpMaera already has the right trust shape for a safe administrative AI:
capability is separate from authority, action forms are closed, policy
evaluation cannot issue authority, material action can be escalated to an exact
Owner decision, and the effect boundary revalidates the result. The current
demo proves this shape for two synthetic actions and one readable business
Diff. It does **not** yet provide a general operator control product.

The product should not expose hundreds of independent per-agent toggles. The
better control model is:

1. the Owner states an operational **intent** and selects a conservative
   **profile/template**;
2. ChimpMaera compiles that into an immutable, versioned Policy;
3. an **effective-rights view** explains the intersection of identity, profile,
   tenant, data, action, network, time, budget, exception and emergency state;
4. a **simulator** previews representative allow/escalate/deny decisions without
   producing authority or effects;
5. exceptions and material changes use bound approvals;
6. cumulative budgets, schedules, revocation and an independent emergency stop
   constrain continued operation;
7. receipts and explanations let the Owner reconstruct what was proposed,
   decided, attempted and observed.

The Canon makes most of this sustainable because its primitives compose around
typed actions, immutable Plans, intersections, exact approvals, an external
enforcement boundary and evidence-bound claims. It does not make the work
automatic. Three normative areas need explicit Canon clarification before a
production claim: cumulative authority/budgets, independence and availability
of emergency control, and separation of Policy-management authority from
ordinary operational authority.

## 2. Evidence-backed current state

| Area | Existing, evidenced behavior | Important boundary |
|---|---|---|
| Root profile | `SAFE_GUIDED` is selected in the runnable path; authority/profile generation is bound into decisions and leases. A profile schema also names development/lab profiles. | The runtime path is effectively hard-coded to `SAFE_GUIDED`; it is not a general profile compiler or assignment UI. |
| Intent and action | `admin-ai-poc.mjs` derives a neutral policy-evaluation input and a closed provider action from two fixed request kinds. | The Owner cannot declare business intent, data boundary, risk appetite or desired outcome. Unknown kinds deny. |
| Policy | `admin-ai-poc-policy-v1.json` has exact auto-grant, owner-escalation and catch-all deny rules. `policy-evaluator.mjs` binds source and semantic digests and cannot issue authority. | No user-authored rule set, inheritance, exception layer, simulation report or migration workflow exists. |
| Diff and approval | The Approval Workbench persists an exact proposal, readable business Diff and Approve/Reject receipt; approval yields a short, one-use lease. Tampering, expiry, replay and scope drift are denied by tests. | One synthetic order flow, one local Owner actor, local bearer identity; no production IAM/MFA, approval routing, reason capture or separation of duties. |
| Effect boundary | `enforcement-gate.mjs` validates the closed action, scope, Policy/profile bindings, lease use and semantic readback outside the Agent. | Provider reconciliation, provider Revoke and provider Rollback are known missing claims. |
| Network and credentials | Demo is loopback/internal-network constrained; local egress manifest is default-deny; secrets remain at the effect boundary. | There is no general per-capability destination/data-flow policy or production secret broker. Host/Docker compromise is outside the boundary. |
| Audit/evidence | Owner-decision and effect receipts are digest-bound and locally readable. | The local files are not an independently protected, append-only audit service; no retention/export/search/attestation claim. |
| Templates/onboarding | Earlier setup contracts contain curated demo templates, safe defaults, dry-run semantics and explicit trust tiers. | Those contracts do not currently compile an Owner's operational intent into the live Admin-AI Policy and effective-rights view. |
| Emergency and lifecycle | Canon distinguishes Revocation, Rollback and Cleanup and says an Admin AI cannot control emergency controls. | No runnable hard revoke/kill switch, budget freeze, quarantine or compensated rollback exists for Admin-AI effects. |

Primary repository evidence:

- `docs/CANON.md`, especially CM-CAN-01 through CM-CAN-17 and
  **Administration**
- `docs/ARCHITECTURE.md` and `docs/KNOWN-LIMITATIONS.md`
- `demo/runtime/admin-ai-poc.mjs`, `admin-ai-policy.mjs`,
  `policy-evaluator.mjs`, `approval-workbench.mjs` and
  `enforcement-gate.mjs`
- `demo/manifests/authority/*.json` and
  `schemas/contracts/poc-admin-authority-profile-v1.schema.json`
- `tests/demo-admin-ai-poc.test.mjs`,
  `tests/demo-policy-evaluator.test.mjs`,
  `tests/demo-approval-workbench.test.mjs` and
  `tests/demo-enforcement-gate.test.mjs`
- `packages/contracts/src/poc-early-admin-ai-setup.ts`,
  `poc-guided-demo-bootstrap.ts`, `poc-showcase.ts` and
  `poc-showcase-e2e.ts` for earlier intent/template/simulation concepts

Durable-memory retrieval was attempted through the prescribed memory service,
but that service was unavailable in this worker. No memory-only assertion is
therefore treated as evidence. The repository itself contains the applicable
intent-first, safe-profile and template concepts.

## 3. Operator mental model

The Owner should answer a small number of meaningful questions rather than
configure an implementation graph:

1. **Purpose:** What outcome may this Admin AI pursue?
2. **Where:** Which tenants, systems, resource types and data classes are in
   scope?
3. **How far:** Which actions are automatic, which need approval, and which are
   prohibited?
4. **How much:** What per-action and cumulative money, object, token, rate,
   network and storage budgets apply?
5. **When:** During which schedule and for how long may it operate?
6. **Who decides:** Who may approve, which actions require reauthentication or
   two-person control, and who may revoke?
7. **What if uncertain:** Does the system deny, escalate, quarantine or require
   reconciliation?
8. **How to stop/recover:** Which independent stop, revoke and compensating
   action paths exist?

ChimpMaera should compile these answers into Policy. Advanced users may inspect
or author Policy-as-code, but the canonical product view is the resulting
effective envelope and its provenance, not a giant matrix of raw switches.

### Effective-rights equation

For one proposed action, the UI should show the actual computation:

```text
effective authority =
  owner profile ceiling
  ∩ actor/delegation assignment
  ∩ capability and typed-action allowlist
  ∩ tenant/resource/data scope
  ∩ network/credential boundary
  ∩ schedule and lease time
  ∩ remaining cumulative budget
  ∩ approved exception (if any)
  ∩ current emergency/revocation state
```

Any unknown operand, conflict or expansion is a deny. Requirements and
templates may request rights but cannot contribute authority to this equation.

## 4. Control-to-Canon mapping

Classification:

- **Primitive:** the Canon already states a sufficient invariant; product
  contracts and UX remain to be built.
- **Extension:** consistent new semantics are needed, but no Canon contradiction
  exists.
- **Canon-gap candidate:** the current wording is too implicit for a strong
  product/security claim and should be amended or accompanied by a normative
  profile specification.

| Owner control | Expected product behavior | Canon mapping | Assessment |
|---|---|---|---|
| Profiles | Named conservative envelopes such as Guided, Read-only Analyst and Time-boxed Operator; compare versions and switch only by explicit Owner action. | CM-02, 03, 04, 14, 17 | **Primitive.** Current schema is a seed, not a runtime profile system. |
| Intent | Capture purpose, outcome, prohibited consequences and risk posture; compile to Policy without granting rights. | CM-01, 02, 05, 06; Growth Path 1–3 | **Extension.** Add a typed, versioned intent contract and deterministic compiler. |
| Human-readable Diffs | Show authoritative before/after, affected objects, cumulative impact, uncertainty and rollback availability from the enforced Plan. | CM-05, 06, 07 | **Primitive.** Existing one-action Diff is the narrow proof. |
| Effective permissions | Explain final allow/escalate/deny plus every contributing ceiling, override and generation; show why a tempting capability is unavailable. | CM-04, 11, 14 | **Primitive and high-value missing implementation.** |
| Simulation | Evaluate Policy and representative Plans against frozen state without authority, credentials or provider effect; disclose stale-state limits. | CM-01, 06, 08, 11, 16 | **Extension.** Policy simulation is straightforward; provider-outcome prediction is a narrower, evidence-bound claim. |
| Exceptions | Request a narrower overlay bound to actor, action, resource, data, time, uses, budget and reason; never exceed the Owner ceiling. | CM-04, 07, 14, 17 | **Extension.** Treat as a versioned sub-envelope, not an ad-hoc bypass. |
| Approval policy | Configure auto/owner/dual-control/deny by materiality; bind approvers, TTL, use count, reauthentication and reason. | CM-02, 07, 08, 11 | **Primitive plus identity extension.** Current one-Owner lease proves the core. |
| Budgets and rate limits | Enforce atomic per-action and cumulative ceilings; reserve before effect, reconcile after ambiguity, deny on stale counters. | CM-04, 08, 11, 12 | **Canon-gap candidate.** “Resource scope” is not explicit enough about aggregate consumption and concurrent reservation. |
| Schedules | Define activation windows, blackout periods, timezone, expiry and restart behavior; no queued action inherits a closed window. | CM-03, 04, 07, 11, 17 | **Extension.** Lease expiry exists; recurring schedule semantics do not. |
| Emergency stop and revoke | Independently freeze new authority and effect dispatch, invalidate generations, drain/quarantine uncertain work and preserve recovery evidence. | CM-04, 08, 11, 13; Administration | **Canon-gap candidate.** Independence, availability, fail-safe state and recovery ceremony should be normative. |
| Audit and explanation | Searchable timeline of intent, Plan, Policy inputs, rule provenance, approval, attempt, readback, uncertainty and receipts; explanation is derived from signed/hashed facts. | CM-10, 14, 16, 17 | **Primitive plus storage extension.** Never present model prose as the authority record. |
| Templates | Curated intent/profile/policy bundles with provenance and disclosed evidence; preview and explicit activation; updates cannot silently expand authority. | CM-03, 15, 16, 17 | **Primitive.** Existing guided templates can be adapted, not mistaken for runtime authority. |
| Onboarding | Short risk interview → recommended template → effective-rights preview → negative examples → simulation → explicit activation. | Alignment/Fitness, CM-02, 03, 14–17 | **Extension.** Operator chooses fitness; onboarding cannot certify it. |
| Policy administration | Separate permission to propose, review, activate, revoke and roll back Policy; the Admin AI cannot mutate its own ceiling or evidence. | CM-02, 08, 14, 17; Administration | **Canon-gap candidate.** Make management-plane separation and self-modification denial explicit. |
| Delegation | Show parent envelope, child intersection, expiry, depth and revocation lineage; delegation can only narrow. | CM-02, 04, 05, 14 | **Primitive plus contract extension.** |
| Data and egress control | Bind readable fields/data classes, writable fields, destinations, protocol/method, payload bounds and secret references to the action. | CM-04, 05, 08, 09 | **Primitive plus adapter-specific contracts.** Current default-deny egress manifest is not a general data-flow controller. |

## 5. Importance-first backlog candidates

Importance uses `I5 critical`, `I4 high`, `I3 medium`, `I2 low`. Complexity uses
`S`, `M`, `L`, `XL`. Ordering is lexicographic: higher importance first, then
lower complexity, then fewer dependencies and larger risk reduction. “Demo”
means a local synthetic proof only.

### I5 — critical controls

| Rank | Candidate | Complexity | Why it comes here | Dependencies | Minimum evidence gate |
|---:|---|:---:|---|---|---|
| 1 | **SEC-CTL-001 Policy self-protection and generation fence** | S | A stale or self-expanded Policy must never reach the effect boundary. Existing digests/generations make this a high-value quick closure. | Versioned policy-activation record | Mutated/stale generation, unsigned activation, Agent-authored activation and rollback-to-wrong-generation all deny before provider access. |
| 2 | **SEC-CTL-002 Effective-rights compiler and “permission X-ray”** | M | Owners cannot safely control what they cannot see. This also becomes the common substrate for simulation, onboarding and review. | Typed profile, assignment and constraint contracts | Golden allow/escalate/deny cases; unknown/conflicting operand denies; rendered explanation exactly matches machine decision inputs and digest. |
| 3 | **SEC-CTL-003 Independent revoke and emergency freeze** | M | Approval expiry is not an emergency control. A compromise or bad campaign needs an immediate independent stop. | Generation registry; effect-gate check; protected Owner identity | Freeze between approval and effect denies; restart stays frozen; stale worker/lease denied; only authorised recovery unfreezes; Agent cannot call control path. |
| 4 | **SEC-CTL-004 Atomic cumulative budgets** | L | Many individually valid low-risk effects can become a high-impact campaign. | Durable counter/reservation store; reconciliation state; clock model | Concurrent last-unit race yields at most one effect; exhausted/stale/unknown counters deny; ambiguous effect keeps budget reserved until reconciliation. |
| 5 | **SEC-CTL-005 Management-plane/effect-plane separation** | L | Fine-grained rules are cosmetic if the Agent can change Policy, evidence, credentials or its own stop control. | Deployment boundary and distinct credentials/identities | Compromised Agent fixture cannot activate Policy, alter audit/evidence, mint credentials, unfreeze or approve itself. |
| 6 | **SEC-CTL-006 Ambiguous-effect reconciliation surface** | L | Owner must see and resolve `may have happened` without an unsafe retry. This is also required for correct budgets. | Provider-specific authoritative readback and durable replay reservation | Timeout-after-apply fixture enters quarantine; retry denied; reconcile-to-applied or reconcile-to-not-applied produces bound receipt and correct budget. |

### I4 — high-value operator controls

| Rank | Candidate | Complexity | Product value | Dependencies | Minimum evidence gate |
|---:|---|:---:|---|---|---|
| 7 | **SEC-CTL-007 Effect-free Policy simulator** | S | Fast, safe answer to “what would this Agent be allowed to do?” and ideal onboarding/demo surface. | Effective-rights compiler | Simulation issues no lease, touches no provider and uses no credential; matrix covers representative allow/escalate/deny and stale-input denial. |
| 8 | **SEC-CTL-008 Capability/action catalogue with default inactive state** | S | Gives Owners a finite vocabulary rather than raw API permissions. | Adapter descriptors and typed-action registry | Undeclared adapter/action/field/path denies; admission and installation do not activate; catalogue shows evidence and non-claims. |
| 9 | **SEC-CTL-009 Intent contract and deterministic Policy compiler** | M | Converts an understandable business envelope into reproducible Policy without making free-form text authoritative. | Catalogue, profiles, compiler versioning | Same canonical intent produces same Policy digest; unsupported/ambiguous intent produces questions or deny, never broader Policy; round-trip explanation test. |
| 10 | **SEC-CTL-010 Time/use/budget-bounded exception workflow** | M | Lets the Owner solve exceptional work without permanently widening the base profile. | Effective rights, approvals, schedules/budgets | Exception cannot exceed root ceiling; scope/time/use/reason tamper denies; expiry and revoke work; base Policy remains byte-identical. |
| 11 | **SEC-CTL-011 Approval routing and step-up** | M | Materiality should select auto, one-Owner, reauth, two-person or deny. | Production identity later; local synthetic identities for demo | Same actor cannot satisfy prohibited dual roles; stale membership denies; exact Plan/diff bound through all approvals; rejection yields no authority. |
| 12 | **SEC-CTL-012 Schedule and maintenance-window control** | M | Prevents unattended action outside intended operating periods. | Trusted clock model, generations | DST/timezone boundaries, restart, queued work and window close all tested; closed/unknown time denies at effect boundary. |
| 13 | **SEC-CTL-013 Audit timeline and deterministic explanation** | M | Owners need a comprehensible “why” and incident reconstruction. | Receipt/event schema and protected storage boundary | Timeline joins intent→Plan→rule→approval→effect→readback by digests; missing/tampered link is visible; explanation cannot disagree with evaluated facts. |
| 14 | **SEC-CTL-014 Data/egress envelope** | L | A safe action also needs safe readable fields, outbound destinations and payload limits. | Data classification, adapter contracts, egress proxy/broker | Prompt-injected URL, undeclared field, oversized payload, secret read and cross-tenant reference deny outside the Agent. |

### I3 — usability and scale after the critical boundary exists

| Rank | Candidate | Complexity | Product value | Dependencies | Minimum evidence gate |
|---:|---|:---:|---|---|---|
| 15 | **SEC-CTL-015 Guided onboarding and safety templates** | M | Makes strong defaults accessible and reuses existing setup-template ideas. | Intent compiler, simulator, effective-rights view | Risk answers deterministically select/recommend a template; preview and negative examples precede activation; update expansion needs new Owner decision. |
| 16 | **SEC-CTL-016 Profile/Policy version diff and migration** | M | Allows safe evolution and review at scale. | Canonical contracts and activation records | Semantic expansion is highlighted; unchanged semantics retain digest behavior; rollback/fallback and fresh evidence are bound to version. |
| 17 | **SEC-CTL-017 Delegation lineage and child envelopes** | L | Useful for teams and specialist Agents without per-Agent sprawl. | Production identity, effective rights, revoke | Child rights are provably subset; parent revoke cascades; conflicting lineage denies; UI shows source and expiry. |
| 18 | **SEC-CTL-018 Audit export, retention and independent attestation** | L | Needed for operations/compliance, but after correct local records exist. | Protected audit service and retention policy | Complete bounded export, deletion/retention behavior, clock/source provenance, tamper detection and access-control tests. |

### I2 — deliberately later

| Rank | Candidate | Complexity | Reason for low order |
|---:|---|:---:|---|
| 19 | **SEC-CTL-019 Natural-language Policy authoring** | XL | Convenient but unsafe as an authority source; should only draft typed intent after deterministic controls exist. |
| 20 | **SEC-CTL-020 Cross-organisation policy federation** | XL | High coordination and identity complexity with limited local-demo value. |
| 21 | **SEC-CTL-021 Autonomous Policy optimisation** | XL | Risks silent expansion and reward hacking; advisory proposals only, never self-activation. |

## 6. Recommended implementation waves

### Wave A — visible safety truth (highest value per unit complexity)

Build `SEC-CTL-001`, `002`, `007` and `008` as one coherent vertical slice:

- typed capability/action descriptors;
- an effective-rights result with contributing sources and reason codes;
- a simulator endpoint that cannot issue authority;
- a “Permission X-ray” UI comparing allowed, escalated and denied actions;
- policy-generation activation and stale-generation negative probes.

This wave is demonstrable without a live LLM or production provider and reuses
the current PolicyEvaluator. It should be first because it makes all later
controls observable and testable.

### Wave B — stop and constrain campaigns

Build `SEC-CTL-003`, `004` and `006`:

- protected emergency freeze/revoke state checked at the effect boundary;
- atomic count/rate/resource reservations;
- explicit ambiguous-effect quarantine and reconciliation;
- UI showing remaining budget, frozen/quarantined state and recovery action.

This is more complex than Wave A but remains I5. Do not defer it behind easier
I3 onboarding work.

### Wave C — sustainable Owner policy

Build `SEC-CTL-009`, `010`, `011`, `012` and `013`:

- typed intent → deterministic Policy compiler;
- narrow exception overlays;
- approval tiers and step-up hooks;
- schedule semantics;
- evidence-derived audit/explanation timeline.

### Wave D — hardened boundary and approachable adoption

Build `SEC-CTL-005`, `014`, `015` and `016` as the deployment/data boundary and
onboarding/migration layer. Management-plane separation is I5, but its full
deployment proof may be developed in parallel with the earlier local contract
work; no production claim is allowed until it passes.

Delegation, independent audit export and federation follow only after a real
identity/deployment context exists.

## 7. Demo scenarios that show the controls honestly

### Demo 1 — Permission X-ray

The Owner selects `SAFE_GUIDED`. The UI shows:

- synthetic contact create → `AUTO_GRANT`, one effect, local tenant;
- synthetic order create → `OWNER_ESCALATION`;
- provider delete, raw shell, arbitrary URL and cross-tenant read → `DENY`;
- the exact profile, Policy generation, rule and adapter ceiling responsible.

**Proof:** the same frozen inputs go through simulator and live decision path
and produce matching decision facts; simulation produces no authority/effect.

### Demo 2 — Narrow exception, not broad elevation

An otherwise denied synthetic order is requested for one object, one use and
five minutes. The Owner sees the Diff and why normal Policy denied it. Approval
creates a narrow overlay; a changed object, amount, tenant, time, replay or
second use denies.

**Proof:** positive case plus mutation matrix; base Policy digest unchanged.

### Demo 3 — Campaign budget

The Agent may create at most three synthetic contacts in a window. Three
effects consume reservations; the fourth is denied. Two concurrent final-unit
attempts yield at most one provider call. A timeout quarantines the reserved
unit until reconciliation.

**Proof:** deterministic concurrency/barrier test, persisted restart test and
reconciliation receipts.

### Demo 4 — Emergency stop beats a valid approval

The Owner approves an exact action, then activates emergency freeze before
execution. The previously valid lease is rejected at the effect boundary. The
Agent cannot unfreeze itself. Restart preserves the freeze.

**Proof:** no provider call, stale generation denied, protected recovery receipt.

### Demo 5 — Schedule closes while work waits

An action is approved inside a synthetic maintenance window but reaches the
gate after it closes. It denies and requires a new decision; it is not silently
queued into the next window.

**Proof:** injected deterministic clock, timezone/DST and restart negative tests.

### Demo 6 — Prompt injection has no authority

A synthetic document tells the Agent to call an undeclared URL, reveal a secret
and delete records. The model/planner may propose text, but closed action,
field, data and egress contracts deny each effect.

**Proof:** planner output is treated as hostile input; all denials occur in
trusted code and no credential enters the planner trace.

### Demo 7 — Explain and reconstruct

The timeline answers: what the Owner intended, which Policy/profile was active,
why the evaluator escalated, what the Diff showed, who decided, what authority
was issued, what provider call occurred, what readback proved and whether the
budget changed.

**Proof:** every displayed assertion links to a digest-bound record; delete or
tamper with one link and the UI reports incomplete/unverified, never success.

### Demo 8 — Safe onboarding template

The Owner answers a short local synthetic risk interview, receives a
`Read-only Analyst` or `Guided Operator` recommendation, previews effective
rights and negative examples, runs the simulator, and explicitly activates the
versioned Policy. A later template update that broadens rights requires a fresh
Owner decision.

**Proof:** deterministic selection and compilation; no template/catalog action
grants authority; changed semantic digest blocks stale activation.

## 8. PDCA assessment of the Canon

### Plan

Test whether the Canon supports an operator-facing control system through a
small set of composable invariants rather than per-agent special cases.

### Do

Mapped profiles, intent, Diffs, exceptions, effective rights, simulation,
approvals, budgets, schedules, emergency controls, audit/explanation, templates
and onboarding to repository behavior and CM-CAN principles.

### Check

**What works well:**

- The authority intersection and default-inactive rules naturally compile into
  effective rights.
- Exact action/Plan digests make simulator, approval and enforcement reuse the
  same facts.
- The external enforcement boundary prevents model reasoning from becoming
  authority.
- Admission/installation/activation separation makes templates safe to browse
  and preview.
- Evidence/claim discipline supports honest demo growth.

**Where the Canon is insufficiently explicit:**

1. CM-04's resource/time scope should explicitly include cumulative and
   concurrent budgets, atomic reservation, reset semantics and ambiguous-effect
   accounting.
2. Administration/CM-13 should specify that emergency freeze and revocation are
   independently reachable, persist fail-safe state, are checked at every
   effect boundary and cannot be controlled by the delegated Agent.
3. CM-02/08/17 should explicitly separate Policy proposal, activation,
   rollback, evidence administration and operational effects; self-approval or
   self-expansion must fail even if the Agent can produce a syntactically valid
   Policy.

These are Canon-gap candidates, not evidence that the current demo violates the
Canon. The current demo simply does not claim those capabilities.

### Act

Recommendation: preserve the Canon's small core and add a concise normative
“Owner control and cumulative authority” extension/profile rather than bloating
the main Canon with UI mechanics. Implement Wave A first, while drafting the
three clarifications before Wave B/C claims depend on them.

**PDCA maturity verdict:** high enough to begin the local contract/demo Wave A;
not high enough for a production safety claim. The architecture is reusable,
but every new control still needs closed schemas, enforcement-bound checks,
negative tests and evidence-bound claims.

## 9. Honest non-claims

Until separately evidenced, none of this analysis means that ChimpMaera has:

- a live or safely sandboxed generative LLM;
- production IAM, MFA, two-person approval or organisation delegation;
- host-, kernel-, Docker-daemon- or hypervisor-grade isolation;
- a production secret broker, data-loss-prevention service or egress proxy;
- atomic provider budgets or distributed rate enforcement;
- an independently available emergency service;
- provider rollback, universal compensation or automatic reversibility;
- tamper-proof/externally attested audit storage;
- regulatory certification, universal compliance or production fitness;
- a safe natural-language-to-authority path.

The near-term demo claim should remain narrow: **ChimpMaera can deterministically
show how a versioned Owner envelope evaluates representative typed actions,
explain the effective result, simulate without authority, and enforce the
currently evidenced local synthetic boundary.** Later claims expand only when
their runtime bytes and negative evidence exist.

## 10. Autonomous decision record

- **Assumption:** “Admin AI” means a delegated administrative planner/tool
  caller under an Owner envelope, not a trusted security principal.
- **Why safe:** This is the Canon's explicit Agent model and is the conservative
  interpretation.
- **Risk:** A later product requirement may distinguish several human Owners,
  tenants or Agent identities.
- **Fallback:** Keep identity, assignment and delegation as versioned inputs;
  do not hard-code UI semantics into the Policy evaluator.
- **Review marker:** Revisit when production identity, multi-tenant deployment
  or a live LLM becomes an authorised workstream.

- **Assumption:** Importance is sorted before complexity; complexity only
  reorders equal-importance work.
- **Why safe:** This matches the Owner's stated priority rule.
- **Risk:** A critical item with external dependencies could stall delivery.
- **Fallback:** Build its locally provable contracts/negative tests while the
  next highest internally reachable item proceeds; do not weaken the critical
  item's priority or claim completion.
- **Review marker:** Re-score only when threat model, capability set or evidence
  changes.

- **Assumption:** Existing setup templates and simulations are design assets,
  not proof of current live Admin-AI enforcement.
- **Why safe:** It prevents cross-layer evidence inflation.
- **Fallback:** Reuse their contracts only after binding them into the actual
  Policy/effect path and rerunning negative gates.
- **Review marker:** Remove this limitation only after an integrated demo test
  proves the complete path.
