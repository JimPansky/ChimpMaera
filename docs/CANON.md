# The ChimpMaera Canon

## The Laws of Agency, Authority, and Evolution

**Version:** 0.2 local revision

**Status:** English canonical documentation in the current public source;
individual product surfaces retain their own evidence and maturity boundaries
**Language governance:** English is the canonical language for maintained
repository product and technical documentation. Localized material belongs to
separate localization workflows and does not control this document.

The Canon defines ChimpMaera's durable laws. Deployment recipes, product
profiles, adapters, maturity procedures, and operator choices belong in the
[Zoo Field Guide](ZOO-FIELD-GUIDE.md). A particular Docker, VM, MicroVM, WASM,
remote-worker, or OS-sandbox implementation is not a Canon law.

The ability to plan or use a tool does not grant permission to act. Models may
be wrong, inputs and outputs may be hostile, credentials may be overpowered,
and outcomes may be ambiguous. ChimpMaera therefore treats an Agent as
untrusted workload code and mediates meaningful crossings between it and
models, tools, networks, durable state, secrets, reads, and effects.

## Alignment, Fitness, and Maturity

**Canon alignment**, **fitness for use**, and **maturity** are distinct claims.
Alignment means preserving the applicable laws and representing the actual
state honestly. Fitness is determined for a specific operating context.
Maturity describes the safeguards and evidence achieved for an exact version,
adapter, configuration, threat model, and environment; it is neither admission
nor certification.

An early or minimally evidenced tool may be admitted, evaluated, used, and
improved. Admission does not require a maturity declaration or proof of
completeness. Missing safeguards and evidence are visible development or trust
gaps. The operator decides whether the disclosed state fits its context.

A law becomes applicable when its capability, crossing, effect, or hazard is
present. A claim of non-applicability identifies the absent trigger. The narrow
foundation is truthfulness and no silent expansion of authority. Known
capabilities, boundaries, evidence, gaps, and operating limits must not be
knowingly misrepresented or materially concealed.

## Core Terms

- **Agent / Untrusted Runtime:** Model-assisted or deterministic planning and
  tool-calling workload. It is not an authority, Policy, credential, or effect
  boundary.
- **Capability:** A technically executable function. **Authority:** Permission
  to use that capability under bound conditions.
- **Owner:** The person or accountable organisation that selects the root of
  authority and can restrict or revoke it.
- **Profile / Policy:** A versioned maximum operating envelope. Effective
  rights are the intersection of the envelope, identity, scope, current Policy,
  budgets, and active stop state.
- **Meaningful Boundary Crossing:** Any transfer from the Untrusted Runtime to
  or from a model, tool, network, process, filesystem or durable state, secret
  custodian, tenant, authoritative read source, or effect-capable system.
- **Agent Runtime Isolation Boundary / Untrusted Runtime Contract:** The
  mechanism-independent product boundary that contains Agent compute and
  exposes only declared, mediated crossings. Its enforcement adapter must use
  kernel-, hypervisor-, or equivalently OS-enforced isolation for applicable
  network, filesystem, credential, process, device, and namespace boundaries.
- **Gateway / Broker Plane:** Trusted components outside the Agent that
  authenticate, authorise, transform, rate-limit, route, use credentials,
  execute reads or effects, guard responses, and produce Evidence. These duties
  may be separated into multiple services; the Agent performs none of them.
- **Typed action:** A closed, versioned action form with unambiguous semantics.
  A **Plan** describes actions and bindings without producing effects; a
  **human-readable Diff** shows authoritative prior state, intended subsequent
  state, and material risks.
- **Approval:** A decision concerning an exactly bound action or Plan.
  **Enforcement boundary:** Trusted code outside the Agent that revalidates
  authority immediately before a real effect.
- **Readback:** An authoritative query of resulting state. **Receipt:** A
  record binding the request, decision, action, authority, target, Readback,
  and result without unnecessarily retaining sensitive payloads.
- **Managed durable state / Mind:** State intentionally retained outside
  ephemeral Agent compute under explicit tenant, purpose, data-class,
  provenance, retention, quota, reset, recovery, and access rules.
- **Replay:** Repetition of the same bound request without a duplicate effect.
  **Revocation** prevents future use; **Rollback** is a separately authorised
  compensating action; **Cleanup** removes only demonstrably owned resources.
- **Evidence:** Current, reproducible positive and negative observations that
  bind and limit a claim. Documentation or popularity alone is insufficient.

## Immutable Laws and Invariants

These laws apply where the relevant capability, crossing, effect, or hazard
occurs within the declared scope.

### CM-CAN-01 — Capability Is Not Authority

Code, a tool, a template, credentials, or a constructible request does not
grant permission to use it. Every effect requires a current basis of authority;
planning and execution remain separate.

Provider responses, tool output, retrieved documents, and recalled memory are
data, not Owner instruction. Their origin, trust, tenant, data class, and
instruction eligibility remain explicit across the planning boundary. A model
may emit a closed typed candidate; trusted code reconstructs the action from a
server-owned catalogue before normal Policy, Approval, and use-time checks.

### CM-CAN-02 — Authority Is Rooted in the Owner

The Owner selects a visible, versioned root of authority or Profile. Delegated
decisions remain within it. The Owner may deliberately select a broad or
full-control Profile, but the selection is explicit, typed, revocable, and
still subject to complete mediation, isolation, use-time checks, and Evidence.
Requirements do not activate a Profile.

### CM-CAN-03 — New Runtime Authority Starts Inactive

New actions, adapters, skills, fields, model routes, and authority paths do not
gain runtime authority through discovery, admission, installation, or update.
They remain inactive until explicitly enabled under a known Policy. Closed
schemas, allowlists, and rejecting dispatch prevent generic escape routes.

### CM-CAN-04 — Authority Is Minimal, Bounded, and Revocable

Only necessary action, read, data, network, time, model, resource, and tenant
scope is granted. Broader authority requires a visible Owner decision.
Effective rights are intersections; unknown or expanded scope is rejected.

### CM-CAN-05 — Effects Bind Identity and Semantics

Every effect binds the typed action, Actor, target, operation, content, Replay
identity, and all material scopes. A material change creates a different
action. Canonical serialisation and digests prevent authority reuse after
drift.

### CM-CAN-06 — A Material Effect Requires a Plan and Human-Readable Diff

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
authority immediately before the real effect. Only the applicable bounded
broker or adapter has effect-capable access.

### CM-CAN-09 — Credentials Remain Outside Untrusted Paths

Credentials remain in a bounded custodian or enforcement boundary. The Agent,
model, skill, template, general planner, log, and Mind receive typed opaque
references rather than reusable secrets. Secret use is purpose-, audience-,
scope-, time-, and generation-bound.

### CM-CAN-10 — Success Requires Readback and a Bound Receipt

Transport acceptance does not prove resulting state. Success requires an
authoritative, unambiguous Readback and a Receipt bound to the action, scope,
target, and Readback digest.

### CM-CAN-11 — Ambiguity Fails Closed

Missing, stale, contradictory, unavailable, or unverifiable identity, Policy,
Approval, target state, type, scope, budget, stop state, isolation control, or
Readback fails closed. Missing Evidence creates uncertainty, not authority,
proof, or success.

### CM-CAN-12 — Replay Is Deterministic and Idempotent

The same action and Replay identity produces the same result without duplicate
effect; changed content is a conflict. If an effect may have occurred but its
outcome is unknown, retry remains blocked until durable authoritative
reconciliation completes.

### CM-CAN-13 — Revocation, Rollback, and Cleanup Are Distinct

Replay proves none of them. Revocation prevents future authority; Rollback
requires a new authorised compensating action and verified resulting state;
Cleanup removes only demonstrably owned resources. Each applicable operation
has its own contract, Evidence, and failure handling.

### CM-CAN-14 — Effective Rights and Overrides Are Visible

Inheritance, requirements, Owner Profile, Policy boundaries, overrides,
budgets, stop state, and final rights are reviewable. Silent inheritance or
self-expansion is prohibited; conflicting assignment fails closed.

### CM-CAN-15 — Admission Does Not Grant Runtime Authority

Admission to a catalogue or Zoo requires neither completeness nor proof of
maturity. Provenance, signatures, reviews, ratings, and popularity may inform
trust, but do not activate runtime rights. Discovery, admission, installation,
Profile request, activation, and effect are separate transitions.

### CM-CAN-16 — Claims Follow Current Evidence

Every tested-property, security, maturity, reliability, or compatibility claim
binds the exact version, adapter, configuration, environment, threat model, and
evidence window tested. Historical or documentary Evidence does not transfer.
Missing Evidence must not be represented as proof or success.

### CM-CAN-17 — Evolution Is Explicit and Reviewable

New versions preserve applicable invariants or provide an explicit migration
covering risk, compatibility, Evidence, and fallback. Changes to action,
authority, isolation, Receipt, Replay, admission, model, state, or skill
semantics require versioned contracts and fresh Evidence.

### CM-CAN-18 — No Ambient Authority or Standing Privilege

The Untrusted Runtime begins with no reusable credential, unrestricted network,
host filesystem, arbitrary process, device, socket, model, tool, read, state,
or effect authority. Workload identity and capabilities are explicit,
short-lived where practicable, audience-bound, default-off, and attenuating.

### CM-CAN-19 — Meaningful Boundary Crossings Are Completely Mediated

Every meaningful crossing is authenticated, typed, Policy-checked, bounded,
observable at the interface, and receipted where it can read sensitive data,
change durable state, consume material resources, or produce an effect. A
gateway-only topology without enforced denial of alternate paths is a
convention, not complete mediation.

### CM-CAN-20 — Runtime Isolation Is Agent- and Mechanism-Agnostic

Every Agent runs inside an Untrusted Runtime Contract independent of Agent
brand or implementation. The selected adapter may use containers, VMs or
MicroVMs, WASM, remote workers, or an equivalently evidenced OS sandbox. It
must enforce applicable network, filesystem, credential, process, device,
resource, and namespace boundaries outside the Agent. Configuration promises
alone are insufficient.

### CM-CAN-21 — Pure Ephemeral Compute May Remain Local

Computation may remain inside the Untrusted Runtime without per-instruction
mediation only while it uses already admitted in-memory inputs, creates no
durable or shared state, consumes no undeclared material resource, accesses no
new secret or external read source, crosses no tenant or process boundary, and
cannot itself produce an effect. Any transition beyond that envelope is a
meaningful crossing governed by CM-CAN-19.

### CM-CAN-22 — Gateway, Decision, Broker, and Effect Duties Stay Separated

The Agent cannot become its own Gateway, Policy decision point, credential
broker, approval service, effect executor, Evidence administrator, or emergency
control. Components may be co-deployed only when the claimed trust and failure
boundary remains explicit and evidenced. Bypass routes fail closed.

### CM-CAN-23 — Model Traffic Is Mediated in Both Directions

Model requests and responses, including streams, attachments, structured
output, and tool-call candidates, cross typed guards. Only a broker resolves
model routes and credentials. Model output is untrusted data; tool candidates
are non-executable until separately typed, authorised, and brokered.

### CM-CAN-24 — Durable State and Mind Are Managed Boundaries

Durable Agent state is never an arbitrary host mount or ungoverned persistence
path. Reads and writes bind workload, tenant, purpose, data class, provenance,
trust, retention, quota, version, and reset/recovery semantics. Unknown,
cross-tenant, stale, or over-quota access fails closed.

### CM-CAN-25 — Skills and Extensions Have a Governed Lifecycle

Capability discovery returns descriptions, not authority. Skill provenance,
schema, declared capabilities, data flows, dependencies, tests, and limitations
are checked before admission; admission, installation, activation, update,
rollback, and quarantine are distinct. A just-in-time inspector or hook may
tighten, redact, pause, deny, or quarantine. It never grants or expands rights.

### CM-CAN-26 — Safety Includes Availability, Recovery, and Degraded Modes

Safety controls declare their availability dependencies, timeouts, durable
state, reconciliation, health, readiness, reset, and recovery duties. A failed
or partitioned Policy, identity, broker, state, Evidence, or stop dependency
cannot silently enable a direct path. Degraded modes are explicit, bounded,
observable, and no more authoritative than the last evidenced safe state.

### CM-CAN-27 — Transparency Is Observable and Data-Minimising

The system exposes defined inputs, outputs, decisions, actions, boundary
crossings, receipts, and limitations sufficient for accountability while
minimising secrets, personal data, private prompts, and unnecessary payloads.
It does not claim complete access to internal model thoughts, unknown side
channels, or unobservable implementation state.

### CM-CAN-28 — Isolation and Maturity Claims Are Adapter-Specific

Docker or any other mechanism may be a validated Reference Adapter and E2E
proof, but is not the product principle. Maturity advances only for the exact
contract surfaces and failure modes evidenced. No adapter proves resistance to
unknown side channels, compromised kernels or hypervisors, undiscovered
runtime flaws, or untested production environments.

## Administration

Administration may be manual, hybrid, or delegated within a versioned Owner
envelope. An administrative AI may grant, deny, or escalate only within that
envelope. It cannot invent rights, expand its own envelope, change Policies
silently, create or reveal credentials, administer its own Evidence, or turn a
request into authority. Emergency controls and the management plane remain
outside the Untrusted Runtime.

## Application

1. Identify the Agent, intended use, meaningful crossings, possible effects,
   runtime boundary, Owner root, and Trusted Computing Base.
2. Select a default-off Profile and an enforcement adapter whose mechanisms
   cover the claimed network, filesystem, credential, process, device,
   namespace, resource, and state surfaces.
3. Define closed request/response schemas, opaque secret references, minimal
   scope, budgets, stop state, and Policy for every crossing.
4. For material effects, create an effect-free Plan, human-readable Diff,
   exact Approval, use-time enforcement, Readback, and bound Receipt.
5. Guard model traffic bidirectionally; manage durable Mind and skill lifecycle
   separately from Agent-local ephemeral compute.
6. Test allowed paths and bypass, failure, partition, replay, exhaustion,
   reset, recovery, and cross-tenant paths against exact
   versions and configurations.
7. Publish supported claims, non-claims, maturity scope, TCB, assumptions,
   fallback, and review markers. Close the next meaningful gap without
   silently broadening authority.

Where downstream guidance conflicts with this Canon, the Canon takes
precedence.
