# The Zoo Field Guide

## Applying the ChimpMaera Canon in Practice

The [ChimpMaera Canon](CANON.md) defines durable laws. This Field Guide holds
changeable operator practice: Profiles, deployment adapters, recipes,
compatibility decisions, evidence procedures, and maturity language. It is a
growth path, not certification or an entry exam.

An unfinished tool can still enter the Zoo. The foundation is honesty: known
capabilities, boundaries, Evidence, gaps, Trusted Computing Base (TCB), and
operating limits must not be misrepresented, and authority must not expand
silently.

## 1. Draw the boundary before selecting a mechanism

Start with a data-flow and authority inventory, not a container choice. Name:

- the Agent and all model, tool, network, process, filesystem, durable Mind,
  secret, read, tenant, and effect crossings;
- the exact Gateway, Decision/Policy, Model Broker, Effect Broker, secret
  custodian, state service, approval, stop, and Evidence components;
- allowed and denied routes, data classes, budgets, timeouts, reset, recovery,
  and degraded modes;
- the TCB and the threat model the deployment is expected to withstand.

The engineering contract is
[Agent Runtime Isolation Contract](AGENT-RUNTIME-ISOLATION-CONTRACT.md).
Use it for adapter selection and conformance evidence.

## 2. Select an isolation adapter, not an Agent-specific Docker project

The product abstraction is the **Agent Runtime Isolation Boundary / Untrusted
Runtime Contract**. A conforming deployment may use:

- a hardened container with enforced network and mount policy;
- a VM or MicroVM with a smaller shared-host boundary;
- a WASM sandbox with closed host imports;
- a remote worker behind authenticated broker interfaces; or
- an equivalent, evidenced OS sandbox.

Select the smallest mechanism that satisfies the threat model. The mechanism
must enforce applicable network, filesystem, credential, process, device,
resource, and namespace boundaries outside the Agent. Merely asking an Agent
to use the Gateway is not isolation when alternate OS or network paths remain.

Docker is a valid Reference Adapter for the current local OpenClaw proof. It is
not mandatory per Agent and does not prove hostile-host resistance because the
daemon and host kernel remain in the TCB. Do not create separate Docker
architectures for Hermes, Claude Code, or another Agent unless a concrete
compatibility proof actually requires an adapter-specific implementation.

## 3. Choose an Owner Profile

Use typed, versioned, default-off Profiles. A practical family is:

1. **Observe:** bounded reads through brokers; no durable write or effect.
2. **Guided:** declared actions with Plan, Diff, exact Approval, use-time gate,
   Readback, and Receipt.
3. **Delegated:** selected typed actions may proceed inside tighter budgets,
   time windows, tenant and purpose scopes, with escalation for material risk.
4. **Broadest governed Owner Profile:** the broadest declared typed catalogue
   may be active by explicit Owner decision. Complete mediation, runtime
   isolation, stop controls, Evidence, and claim limits still apply; this is
   not ambient host, credential, or bypass authority.

Effective rights are always the intersection of Profile, identity, active
Policy, catalogue state, tenant/purpose, budget, time, and stop generation.
Unknown or conflicting state denies.

`FULL_CONTROL_LAB`, `RAMPAGE`, and `RAMPAGE_FULL_CONTROL_LAB` are aliases for a
separate dangerous lab/escape Profile, not another name for the broadest
governed Profile. The released local contract deliberately permits that lab
Profile to bypass ChimpMaera action and Approval gates up to the host process's
OS/host ceiling. Use it only after exact Owner risk acceptance in a disposable
or explicitly bounded environment. Record which layers are bypassed, downgrade
their mediation/security claims, preserve reset/rollback and recovery steps,
and reset to `SAFE_GUIDED` on restart, revoke or cleanup. Audit and emergency
controls improve transparency and recovery; they do not protect those controls
from an actor that the OS ceiling allows to alter or destroy them.

## 4. Mediate meaningful crossings

Use the following operator checklist:

| Crossing | Required path | Minimum controls |
| --- | --- | --- |
| Model request | Agent → Capability Frontdoor → Policy → Model Broker | typed route, workload/user/tenant/purpose, classification, budgets, secret redaction |
| Model response/stream | Provider → Response Guard → Agent | schema/MIME/size/stream limits, provenance, redaction, untrusted label, tool-candidate quarantine |
| Tool or effect | Agent → Gateway → Decision/Approval → Effect Broker → Provider | finite action, exact authority, credential custody, Replay, Readback, Receipt |
| External or sensitive read | Agent → Read Broker/adapter → source | field/row/tenant/purpose bounds, response ceiling, provenance, audit metadata |
| Network | Runtime → declared Gateway endpoint only | enforced route/DNS/protocol policy; direct provider, metadata, peer, control-plane, and Internet denial |
| Durable Mind/state | Agent → managed state API or bound volume | tenant/purpose/data class/trust, quota, retention, version, reset and recovery |
| Filesystem/process/device | runtime-local declared resources only | read-only base, bounded scratch, no host/socket/device/namespace escape; adapter-specific equivalents |
| Secret use | Broker → secret custodian | opaque handle, audience/purpose/scope/time/generation binding; no Agent-visible reusable value |
| Skill/extension | discovery → admission → install → activation | provenance, declared capabilities/data flows, tests, Policy activation, update/rollback/quarantine receipts |

Pure in-memory compute may remain local when it uses already admitted data and
cannot reach a new read source, shared or durable state, secret, tenant,
process, material resource, or effect. Mediate the transition, not every CPU
instruction.

## 5. Keep planes separate

Treat the Agent as compromised-capable workload code. It may propose typed
intent; it does not decide Policy, hold provider credentials, approve itself,
dispatch effects, write authoritative Evidence, or control emergency stop.

The Gateway authenticates and normalises crossings. Decision/Policy determines
current rights. Model, read, state, and effect brokers use their own narrowly
scoped access. The response guard prevents provider output from becoming an
implicit instruction or executable tool call. The Evidence plane records
sanitised correlations and digests. Separate deployment is preferable when
failure or compromise of one duty would invalidate the claim; co-deployment
must be called out in the TCB.

## 6. Manage model traffic, Mind, and skills

Model mediation is bidirectional. Pin supported protocol and field sets;
diagnose optional or unsupported fields; bound streams, attachments, and
structured outputs. Model-generated tool calls are candidates only. A
deterministic guard has authority; a future just-in-time model inspector may
only tighten, redact, pause, deny, or quarantine.

Keep transient reasoning and scratch ephemeral. Durable Mind is a separate
managed boundary with allowed data classes, source provenance, trust labels,
tenant/purpose, retention, quota, encryption/custody assumptions, reset, and
recovery. Do not mount an arbitrary host home or workspace as Agent memory.

Capability discovery lists descriptions and inactive status. For skills,
record source, digest/signature where available, declared capabilities and
data flows, dependencies, schemas, tests, limitations, and compatibility.
Admission never activates. Unknown provenance, capability drift, schema drift,
revocation, or suspicious output quarantines the skill and preserves the last
known safe generation.

### Current adaptation operating lifecycle

The published local-synthetic contract sequence is:

`Capability Contract → Governed Template → typed Adapter → Provider Binding`

- The Capability Contract fixes the user-facing semantic operation, closed
  inputs/outputs, identity and tenant context, invariants and expected Evidence.
- A Governed Template supplies versioned adapter, fixture, validation and
  recovery structure. Promotion or reuse grants no Authority.
- A typed Adapter binds provider fields and routes without widening the
  Capability Contract.
- A Provider Binding joins the exact contract/template/adapter versions,
  tenant and opaque credential reference. It remains inactive until its own
  governed activation route succeeds.

A System Advisor Guide supplies operation-scoped planning knowledge and a
Machine Manifest supplies stable system/object/operation identifiers. Both are
untrusted, authority-free inputs. AI may propose discovery, mapping, template,
adapter, configuration and test candidates; deterministic validation, Policy,
Approval and provider Readback remain authoritative.

Knowledge promotion records provenance, applicability, positive and negative
Evidence, invalidation and supersession. Source, assumption or outcome drift
invalidates or downgrades dependents. Supersession adds a traceable immutable
revision and retains a reversible path; it never rewrites history or activates
a capability.

Published maturity boundaries remain binding:

- Verification Fabric v2 remains **Shadow**; it explains an impact plan but the
  complete suite remains authoritative and no incremental skipping is active.
- HMI contribution preflight prepares canonical, digest-bound local-synthetic
  bytes only. It performs no submission, publication, external write,
  credential use or runtime activation.
- The released Entra profile and Power Platform read connector use exactly
  `cm.discovery.read` for all five closed operations. `cm.operator.read` is
  reserved for a future separate administrative-read Profile and is invalid on
  this connector.

## 7. Design for failure and recovery

For every trusted dependency state what happens when it is unavailable,
partitioned, slow, stale, or inconsistent.

- Policy, identity, broker, stop, state, and Evidence failures never open a
  direct Agent path.
- Read-only degraded modes are allowed only when explicitly defined and no more
  authoritative than the last evidenced safe state.
- Material effects require durable pre-effect reservation and reconciliation
  after ambiguous outcomes.
- Health means process liveness; readiness means all required enforcement
  dependencies and current generations are usable.
- Reset removes only owned mutable state. Recovery preserves other workloads,
  receipts, Replay safety, and quarantine state.
- Emergency revoke/freeze is independent of the Agent and checked at use time.

## 8. Collect reproducible, privacy-minimising Evidence

Evidence should bind the exact source commit, runtime and adapter versions or
digests, configuration/Policy/catalogue generations, platform assumptions,
tests, positive and negative counts, readback, residue, and evidence window.
Store payloads only when needed. Prefer correlation IDs, reason codes, digests,
counts, and redacted facts over prompts, model outputs, secrets, or personal
data.

Suggested voluntary maturity labels are:

- **M0 — Described:** boundaries and non-claims are documented; not tested.
- **M1 — Contract-tested:** deterministic contracts and denial paths pass.
- **M2 — Reference-adapter proven:** one exact adapter and Agent/version pass
  local E2E and negative probes.
- **M3 — Environment-evidenced:** the target environment adds independently
  reproduced operational, recovery, and TCB evidence.

These labels are scoped claims, not certification and not admission gates. A
property may be M2 for OpenClaw on one Docker adapter and M0 for Hermes,
Claude Code, a VM adapter, or production.

## 9. Use the OpenClaw evidence honestly

Existing AAS-035 evidence remains useful: it proves a pinned, default-off,
hardened Docker Reference Adapter, gateway-only synthetic topology, bounded
scratch and managed Mind, one typed OpenClaw E2E, denial probes, reset, and
clean fixture rollback for the exact tested local scope.

AAS-036 adds an agent-neutral, bidirectional Model Access Broker contract and a
real isolated OpenClaw proof against closed local fixtures. It does not prove a
live provider, production network or vault, universal Agent compatibility, or
injection elimination. Hermes and Claude Code protocol shapes or future
adapters must remain **unproven** until separately pinned and exercised.

Do not erase this evidence because Docker is not normative. Relabel it as
Reference Adapter / E2E proof, retain its exact version and non-claims, and use
its negative probes as the first conformance suite for other adapters.

## 10. Operator decision record

For each deployment record:

- **Assumption:** the conservative condition under which work proceeds;
- **Risk:** what the assumption cannot establish;
- **Fallback:** how to return to the last known safe, default-off state;
- **Review marker:** the event that requires reassessment;
- **Claim / non-claim:** the exact supported conclusion and excluded scope.

A useful default is: keep the runtime and all new capabilities inactive; allow
only a typed synthetic path; deny and evidence alternate paths; preserve
receipts; remove only labelled owned state. Revisit the decision whenever the
Agent/version, adapter, model route, skill, data class, Policy, tenant, TCB,
deployment environment, or public claim changes.
