# The ChimpMaera Canon

## Principles for Agency, Authority, and Evolution

**Version:** 0.1
**Status:** English canonical candidate
**Language governance:** English is the canonical language for maintained
repository product and technical documentation. Localized material belongs to
separate localization workflows and does not control this document.

The ChimpMaera Canon is a concise, practical guide to preparing and evolving
tools and integrations responsibly. It describes how intent may produce
external effects, how authority and effects are bounded and evidenced, and how
systems can evolve without silently expanding their rights.

The ability to plan or use a tool does not grant permission to act. Models may
be wrong, inputs may be hostile, credentials may be overpowered, and outcomes
may be ambiguous. The Canon turns these risks into reviewable boundaries,
decisions, and evidence-bound claims.

## Alignment, Fitness, and Development

**Canon alignment**, **fitness for use**, and an informally described
**development state** are distinct claims. Alignment means using the applicable
principles to guide development and representing the actual state honestly.
Fitness is determined in a specific operating context. The extent to which
safeguards, evidence, and operational practices have been developed describes
the development state, but it is neither an entry level nor a certification.

An early, unfinished, or minimally evidenced tool may be admitted, evaluated, used,
and improved by the community. Admission does not require a maturity
declaration, profile, score, or proof of completeness or evidence. Missing
practices and evidence are visible development or trust gaps; they do not
automatically indicate a lack of alignment. The operator decides whether and
how to use the tool based on its context, risk tolerance, and the information
available.

A practice becomes applicable only when the corresponding capability, effect,
or hazard is present, and the required depth grows with risk. A tool does not
need to implement safeguards pre-emptively for capabilities it does not have
and effects it cannot produce. A claim of non-applicability should identify the
absent trigger in a traceable manner; formal proof is not required for
admission or use.

The narrow foundation of alignment is truthfulness and the absence of silent
authority expansion. Known capabilities, authority boundaries, evidence, gaps,
and operating limits must not be knowingly misrepresented or materially
concealed. Beyond this foundation, the Canon is a growth path. Maintainers may
offer evidence and safeguards to earn trust; operators assess fitness for
themselves; use, feedback, and community contributions support organic
development.

## Core Terms

- **Agent:** A model-assisted or deterministic planner and tool caller; it is
  not an authority boundary in its own right.
- **Capability:** A technically executable function. **Authority:** Permission
  to use that capability under bound conditions.
- **Owner:** The person or accountable organisation that selects the root of
  authority and can restrict or revoke it.
- **Profile/Policy:** A versioned maximum operating envelope. Effective rights
  are the intersection of the envelope, identity, scope, and current policy.
- **Typed action:** A closed, versioned action form with unambiguous semantics.
  A **Plan** describes actions and bindings without producing effects; a
  **human-readable diff** shows the authoritative prior state, intended
  subsequent state, and material risks.
- **Approval:** A decision concerning an exactly bound action or Plan.
  **Enforcement boundary:** Trusted code outside the Agent that revalidates
  authority immediately before a real effect.
- **Readback:** An authoritative query of the resulting state. **Receipt:** A
  record binding the action, authority, target object, Readback, and result.
- **Replay:** Repetition of the same bound request without a duplicate effect.
  **Revocation** prevents future use; **Rollback** is a separately authorised
  compensating action; **Cleanup** removes only demonstrably owned resources.
- **Evidence:** Current, verifiable positive and negative observations that
  bound a claim. Documentation or popularity alone is insufficient.

## Principles and Practices

The following principles apply where the relevant capability, effect, or
hazard occurs within the declared scope. When a new capability is introduced,
its associated safeguard and evidence practices become applicable.

### CM-CAN-01 — Capability Is Not Authority

Code, a tool, a template, credentials, or a request that can be constructed
does not grant permission to use it. Every effect requires its own current basis of authority;
planning and execution interfaces remain separate.

Provider responses, tool output, retrieved documents, and recalled memory are
data, not Owner instruction. Their origin, trust, tenant, data class, and
instruction eligibility remain explicit across the planning boundary. A model
may emit a closed typed candidate; trusted code reconstructs the action from a
server-owned catalogue before normal Policy, Approval, and use-time checks.

### CM-CAN-02 — Authority Is Rooted in the Owner

The Owner selects a visible, versioned root of authority or Profile. Delegated
decisions remain within it. Selection, assignment, and effective rights are
explicit inputs to the authorisation check; requirements do not activate a
Profile.

### CM-CAN-03 — New Runtime Authority Starts Inactive

New actions, adapters, fields, and authority paths do not acquire runtime
authority through admission or installation. Effects remain disabled until
they are explicitly activated under a known Policy. Closed schemas, allowlists,
and rejecting dispatch logic prevent generic escape routes.

### CM-CAN-04 — Authority Is Minimal and Revocable

Only the necessary action, data, network, time, and resource scope is granted.
Broader authority requires a visible Owner decision. Effective rights are
intersections; unknown or expanded scope is rejected.

### CM-CAN-05 — Effects Bind Identity and Semantics

Every effect binds the typed action, Actor, target, operation, content, Replay
identity, and all material scopes. A material change creates a different
action. Canonical serialisation and digests prevent authority from being reused
after drift.

### CM-CAN-06 — A Material Effect Requires a Plan and a Human-Readable Diff

Before a material effect, the system presents the purpose, authoritative prior
state, intended subsequent state, and relevant risks. The diff is produced from
the same immutable, effect-free Plan that is later enforced. The prior-state
read is bounded, complete for the declared material fields, versioned and
digest-bound; hidden, truncated, stale or unverifiable state fails closed.

### CM-CAN-07 — Approval Is Exact and Bound to Use

An Approval binds the canonical digest, Actor, scope, target, Policy
generation, expiry, and permitted number of uses. All bindings are revalidated
when it is used; missing, changed, expired, revoked, or consumed authority is
rejected. For state-dependent material effects, the authoritative snapshot and
its version are revalidated at approval and immediately before the effect.

### CM-CAN-08 — Enforcement Occurs at the Effect Boundary

The Agent is never the final policy enforcement point. Trusted code revalidates
authority immediately before the real effect; only this bounded enforcement
boundary has access capable of producing effects.

### CM-CAN-09 — Credentials Remain Outside the Planning Path

Credentials exist only at the bounded enforcement boundary. The Agent,
Template, and general planner receive typed references rather than reusable
secrets. Untrusted content cannot select, rewrite, or disclose those references.

### CM-CAN-10 — Success Requires Readback and a Bound Receipt

Transport acceptance does not prove the resulting state. Success requires an
authoritative, unambiguous Readback and a Receipt bound to the action, scope,
target object, and Readback digest.

### CM-CAN-11 — Ambiguity Fails Closed

Missing, stale, contradictory, or unverifiable identity, Policy, Approval,
target state, type, scope, or Readback fails closed. Absent Evidence creates
uncertainty, not authority, proof, or confirmed success.

### CM-CAN-12 — Replay Is Deterministic and Idempotent

The same action and Replay identity produces the same result without a
duplicate effect; changed content is a conflict. If an effect may have occurred
but its outcome is unknown, retry remains blocked until authoritative
reconciliation with durable Replay state has completed.

### CM-CAN-13 — Revocation, Rollback, and Cleanup Are Distinct

Replay proves none of them. Revocation prevents future authority; Rollback
requires a new, authorised compensating action and a verified resulting state;
Cleanup removes only demonstrably owned resources. Each applicable operation
has its own contract, Evidence, and failure handling.

### CM-CAN-14 — Effective Rights and Overrides Are Visible

Inheritance, requirements, Owner Profile, Policy boundaries, overrides, and
final rights are reviewable. Silent inheritance or self-expansion is
prohibited; conflicting assignment fails closed.

### CM-CAN-15 — Admission Does Not Grant Runtime Authority

Admission to a catalogue or Zoo requires neither completeness nor proof of
maturity or evidence. Provenance, signatures, review, ratings, documentation,
and popularity may inform trust and selection, but they do not activate runtime
rights. Admission, installation, Profile request, activation, and effect remain
separate transitions.

### CM-CAN-16 — Claims Follow Current Evidence

Anyone claiming a tested property, security effect, or level of reliability
binds that claim to the version and scope actually tested. Historical, broader,
or purely documentary Evidence does not transfer. Missing Evidence does not
prevent admission or use; it must not be represented as proof or success.

### CM-CAN-17 — Evolution Is Explicit and Reviewable

New versions preserve applicable invariants or provide an explicit migration
that covers risks, compatibility, Evidence, and a fallback path. Changes to
action, authority, Receipt, Replay, or admission semantics require versioned
contracts and fresh Evidence.

## Administration

Administration may be manual, hybrid, or delegated within a narrow, versioned
Owner envelope. An administrative AI may grant, deny, or escalate only within
that envelope. It cannot invent rights, expand its own envelope, change
Policies silently, create credentials, or turn a request into authority by
itself. If it can modify the host, installation, Evidence store, or emergency
controls, audit records provide useful transparency and recovery Evidence but
are not a strong security boundary against it.

## Application and Growth Path

1. Identify the intended use, actual capabilities, possible effects, Actor,
   and authority boundary.
2. Select the relevant principles according to capability and risk; describe
   known gaps, limits, and missing Evidence without imposing a maturity format.
3. For material effects, design a closed action, minimal scope, effect-free
   Plan, human-readable diff, and bound decision.
4. Keep secrets and enforcement at the effect boundary; establish success only
   through Readback and a bound Receipt.
5. Test negative and closed failure paths; distinguish Replay, Revocation,
   Rollback, and Cleanup where applicable.
6. Allow operators to decide whether the disclosed state is sufficient for
   their context; treat missing Evidence neither as success nor as a bar to
   admission.
7. Close the next most important gap, reassess, and invite contributions that
   support further development. Community trust replaces neither Evidence for
   concrete claims nor Owner authority.

Growth is intentional. Important or useful systems may develop rapidly through
use and contributions; others may remain unfinished or narrow. Admission and
utility do not require artificial completeness. Every concrete claim remains
bound to its evidenced scope; where downstream guidance conflicts with this
Canon, the Canon takes precedence.
