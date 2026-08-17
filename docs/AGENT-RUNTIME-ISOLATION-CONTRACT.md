# Agent Runtime Isolation Contract

Status: local architecture revision candidate

Date: 2026-08-01

Normative parent: [The PANSPHAIRA Canon](CANON.md), especially CM-CAN-18
through CM-CAN-28

## 1. Product abstraction

The product boundary is the **Agent Runtime Isolation Boundary**, also called
the **Untrusted Runtime Contract**. It contains Agent-local compute and exposes
only declared crossings to trusted PANSPHAIRA Gateway/Broker planes. It is
independent of Agent brand, model provider, protocol, and isolation mechanism.

In the current architecture vocabulary, the contained Agent/untrusted-runtime
side is the **Agent Sphere** and the mediated-capability side is the **Gateway
Sphere**. These are visualization labels for this existing boundary and its
trusted planes, not a new protocol, schema, API, service, or runtime layer.

The Agent may transform already admitted data and propose typed intent. It is
never the Policy decision point, approval authority, credential custodian,
effect broker, Evidence administrator, or emergency-control plane.

## 2. Exact isolation claim

“As completely isolated as technically evidenced” means, for an exact Agent,
adapter, configuration, host assumption, threat model, and evidence window:

1. every meaningful crossing in the claimed use is inventoried;
2. undeclared routes are denied by controls outside the Agent;
3. applicable network, filesystem, credential, process, device, namespace,
   resource, tenant, and durable-state limits are kernel-, hypervisor-,
   OS-sandbox-, or equivalently remote-boundary-enforced;
4. permitted crossings follow typed Gateway/Broker/Policy/Approval/Receipt
   paths;
5. allowed, bypass, stale-state, cross-tenant, exhaustion, failure, reset, and
   recovery probes exercise the claimed controls; and
6. the claim publishes its TCB, assumptions, non-claims, and reproduction
   evidence.

This is a scoped technical claim, not absolute isolation or proof against
unknown side channels, compromised hosts, kernel/hypervisor defects,
undiscovered vulnerabilities, or untested production environments.

## 3. Crossing contract

### Always mediated when present

| Surface | Minimum required mediation |
| --- | --- |
| Model requests and responses, including streams and attachments | route/credential custody, request and response guards, budgets, provenance, redaction, non-executable tool candidates |
| Tool and effect requests | finite schema, workload/user/tenant/purpose, current Policy, exact authority/Approval, credential use, Replay, Readback, Receipt |
| Network egress or ingress | declared endpoint/protocol/DNS route; direct provider, metadata, peer, host, control-plane, and public routes denied unless separately typed |
| Filesystem outside immutable base and bounded scratch | brokered read/write or managed state path with path, tenant, purpose, data-class, quota, and lifecycle bounds |
| Durable Mind/state | managed state contract, provenance/trust, version, retention, quota, reset, recovery, and tenant isolation |
| Secret or credential use | opaque reference resolved only inside a custodian/broker; no reusable value returned to Agent, model, Mind, or log |
| Sensitive or authoritative reads | row/field/tenant/purpose bounds, response ceiling, provenance, correlation, and sanitised Evidence |
| Process, device, socket, namespace, or privileged operation | denied by default; when required, a separately typed broker action with adapter-specific enforcement |
| Skill/extension lifecycle | separate discovery, admission, install, activation, update, rollback, and quarantine decisions and receipts |
| Cross-tenant, cross-workload, or shared-resource access | boundary-derived identity and explicit Policy; foreign access denied indistinguishably |

Always mediated applies to a crossing, not every instruction inside the
runtime. No Agent-visible alternate path may reach the protected target.

### Ephemeral compute exception

Local compute needs no per-operation Gateway call only while:

- inputs were already admitted;
- state remains in bounded memory or declared ephemeral scratch;
- no new secret, external read source, model, tool, process, device, tenant, or
  shared resource is reached;
- no durable/shared state changes;
- no material resource budget is exceeded; and
- no external effect can be produced.

Crossing any limit converts the operation into a mediated crossing.

## 4. Trusted Computing Base

The deployment TCB includes every component whose compromise can invalidate the
claim:

- Owner identity and approval root;
- workload identity verifier/issuer, clock, revocation and stop state;
- Capability Frontdoor, schema validation and Policy/decision components;
- Model Access Broker, route/credential custody and response guards;
- read, state/Mind, skill-lifecycle, and effect brokers/adapters in use;
- secret custodian and key custody;
- Replay/reconciliation state, authoritative Readback and Evidence stores;
- the chosen runtime adapter and its control plane; and
- the enforcing OS/kernel/container daemon/hypervisor/WASM runtime or remote
  worker host/network boundary.

The Agent, model/tool/retrieval output, skills, templates, and caller-supplied
facts are outside the TCB. Co-location expands blast radius and must be
declared. With Docker, the daemon and host kernel remain in the TCB.

## 5. Trusted-plane flow

    Agent Runtime
      -> Capability Frontdoor / Gateway
      -> Identity + Policy + Budget + Approval checks
      -> Model, Read, State, Skill, or Effect Broker
      -> External target or managed store
      -> Response Guard / authoritative Readback
      -> sanitised Receipt and bounded response
      -> Agent Runtime

Invariants:

- the Agent reaches only the declared Gateway interface;
- only the relevant broker reaches its protected target and credential;
- Policy output is use-time decision data, not Agent authority;
- response data never becomes an implicit action;
- the Agent cannot rewrite authoritative Evidence;
- management, activation, quarantine and stop controls remain outside the
  workload; and
- failure never enables a direct-path fallback.

## 6. Adapter requirements

A conforming adapter may use a container, VM/MicroVM, WASM sandbox, remote
worker, or equivalent OS sandbox. It must evidence each applicable property:

| Family | Required property |
| --- | --- |
| Identity | dedicated workload identity; no shared/ambient Owner or provider identity |
| Network | deny-by-default; declared Gateway only; bounded DNS and protocol behavior |
| Filesystem | immutable/read-only base where applicable; bounded scratch; no arbitrary host mount |
| Process/device | no host process control, privilege escalation, undeclared socket/device/namespace or equivalent host import |
| Credentials | none embedded in runtime image, environment, workspace, Mind, logs, or Agent-visible configuration |
| Resources | bounded CPU, memory, processes, storage, request, model, and attention budgets with safe exhaustion |
| State | managed durable state separate from ephemeral compute; tenant/purpose/quota/retention/reset/recovery |
| Lifecycle | default-off install, explicit activation, deterministic health/readiness/stop/reset/recovery and ownership-scoped cleanup |
| Supply chain | exact runtime/adapter identity, provenance and supported-platform evidence; drift denies |
| Observability | sanitised outcomes and correlations; no unnecessary prompts, outputs, secrets, personal data, or exploit material |

Adapter equivalence is evidence-based. A WASM sandbox may use closed host
imports rather than container namespaces. A remote worker shifts the TCB to its
host, network, identity, and broker endpoint; it does not eliminate it.

## 7. Governed profiles and dangerous lab full control

Profiles are typed, versioned, and default-off. The broadest governed Owner
Profile may activate the broadest declared catalogue for an exact workload,
tenant, purpose, budget, time, and environment. It does not:

- grant ambient host, provider, network, credential, or cross-tenant access;
- bypass Gateway/Broker mediation, isolation, stop, Evidence, or Receipts;
- activate unknown skills, routes, actions, or fields; or
- turn Agent/model output into self-authorising instructions.

An intentionally broad governed host/provider capability must itself be typed,
separately risk-accepted, brokered, and reflected in the TCB. This governed
choice remains inside the Untrusted Runtime Contract.

`FULL_CONTROL_LAB`, `RAMPAGE`, and `RAMPAGE_FULL_CONTROL_LAB` instead name a
deliberate dangerous lab/escape Profile in the released local setup contract.
It may bypass PANSPHAIRA action and Approval gates and can exercise only what
the host process's OS/host ceiling permits. It therefore does not inherit this
contract's complete-mediation, isolation, stop or security claims for bypassed
layers. Selection requires exact Owner risk acceptance, an isolated disposable
or equivalently bounded environment, a visible list of bypassed controls,
claim downgrade, and tested reset/rollback/recovery. The published lifecycle
resets to `SAFE_GUIDED` on restart, revoke or cleanup. Audit and emergency-stop
records are transparency/recovery mechanisms, not a security boundary against
an actor able to alter them under the OS ceiling.

## 8. Model, skill, and Mind duties

### Model

- Guard request and response directions independently.
- Bind workload, user, tenant, purpose, classification, route, model/provider,
  protocol, IDs, and budgets.
- Keep route credentials inside the broker.
- Bound bytes, schemas, MIME, attachments, streams, and partial failures.
- Label output untrusted; quarantine malformed, hidden, changed, or incomplete
  tool candidates before any effect.

### Skill

- Discovery returns descriptions and compatibility, not authority.
- Admission checks provenance, declared capabilities/data flows, dependencies,
  schemas, tests, and limitations.
- Installation and activation are separate; updates create a new generation.
- JIT hooks may only tighten, redact, pause, deny, or quarantine.
- Rollback restores a prior immutable safe generation and retains Receipts.

### Mind

- Separate ephemeral scratch from durable Mind.
- Bind durable entries to workload, tenant, purpose, data class, source,
  provenance, trust, retention, quota, version, and custody facts.
- Broker reads/writes and deny foreign, stale, unknown, or over-quota access.
- Reset/recovery removes only scoped mutable state while preserving other
  workloads, Replay safety, quarantine, and required Evidence.

## 9. Availability and recovery

Every trusted dependency declares liveness, readiness, timeout, retry,
partition, stale-generation, durable-state, reconciliation, and recovery
behavior:

- unavailable identity, Policy, stop, broker, secret, state, or Evidence denies
  the affected crossing;
- direct paths and embedded credentials are never degraded-mode fallbacks;
- an approved degraded read mode is read-only, bounded, labelled, time-limited,
  and no more authoritative than last evidenced state;
- ambiguous effect outcomes quarantine until authoritative reconciliation;
- reset/cleanup is ownership-scoped and idempotent; and
- recovery cannot resume expired, revoked, stale, or consumed authority.

## 10. Evidence and maturity

A conformance record binds exact source, Agent, adapter, base/runtime, Policy,
catalogue, schema, configuration, platform, TCB, and evidence window. It
includes positive route evidence and applicable denial/failure/reset/recovery
probes, sanitised counts/correlations/Readback/Receipts/residue, supported
claims, non-claims, fallback, and review marker.

Contract-tested, Reference-Adapter-proven, and environment-evidenced maturity
are separate. OpenClaw on one Docker adapter may have local E2E evidence while
Hermes, Claude Code, other versions/adapters, live providers, and production
remain unproven.

## 11. Claim ceiling

Complete mediation is claimed only for defined crossings and observable inputs,
outputs, decisions, actions, and Receipts. This contract does not assert:

- complete internal model thought or hidden-state transparency;
- absence of unknown covert or side channels;
- resistance to a compromised TCB, kernel, daemon, hypervisor, sandbox runtime,
  remote host, firmware, or hardware;
- elimination of prompt/tool injection or undiscovered vulnerabilities;
- production isolation, availability, privacy, compliance, or multi-tenancy
  without environment-specific Evidence; or
- compatibility for an Agent, model protocol, skill, or adapter not pinned and
  exercised.

## 12. Docker Reference Adapter decision

Docker remains a validated Reference Adapter and E2E proof for the current
local OpenClaw evidence. Preserve its provenance, controls, tests, Receipts,
limitations, and failure findings. Do not promote Docker to a Canon law and do
not discard its Evidence because other adapters are permitted.

Assumption: reuse the OpenClaw Docker proof as the first conformance fixture.
Risk: shared kernel/daemon and synthetic local services limit the claim.
Fallback: keep additional runtimes/adapters default-off and retain the
validated proof. Review when an Agent/version, adapter, live provider, target
environment, TCB component, or public claim changes.
