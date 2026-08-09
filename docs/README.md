# ChimpMaera documentation

Use this hub to find the right public document without treating roadmap text
as shipped evidence. ChimpMaera's current product category is an open,
knowledge-driven operating system for governed, adaptable AI ecosystems. Its
current shipped maturity is a released, open-source local PoC for governed and
verifiable AI-agent actions across business systems; broad live-system and
production realization remains planned and unproven.

The current architecture is **Caged Agent → Gateway → Capability
Constellation**. The Agent is an untrusted proposer; the Gateway mediates typed
context, capability, Policy and Approval; stable capability contracts,
Governed Templates, typed Adapters and Provider Bindings form the constellation.
Only the declared local-synthetic paths are currently evidenced.

Status labels used here:

- **Released** — bytes are in the current regular release; evidence may still
  be limited to local synthetic fixtures.
- **Locally validated** — reproducible local evidence exists, but it does not
  establish live-system or production fitness.
- **Planned** — design or roadmap only; not executable product evidence.
- **External evidence required** — a claim needs a real provider, tenant,
  environment or independent operation that this repository cannot prove.

## Start

- **Released:** [Quickstart](QUICKSTART.md) for the synthetic CRM → ERP PoC.
- **Released:** [CRM → ERP approval and readback](use-cases/crm-erp-approval-readback.md)
  for the bounded intent-to-receipt walkthrough.
- **Released:** [Root README](../README.md) for product orientation and the
  `SAFE_GUIDED` ten-second flow.
- **Released:** [Release governance](RELEASE-GOVERNANCE.md) for Latest,
  manifests, hashes and anonymous readback.
- [Contributing](../CONTRIBUTING.md), [support](../SUPPORT.md), and the
  [private vulnerability route](../SECURITY.md).
- [When to use an alternative](alternatives.md) and the curated
  [Now / Next / Later view](roadmap.md).

## Understand

- [Canon](CANON.md): normative laws for agency, authority, effects and
  evidence.
- [Architecture](ARCHITECTURE.md): current local reference design and trust
  boundaries.
- [Zoo Field Guide](ZOO-FIELD-GUIDE.md): profiles, adapters and evidence
  procedures.
- [Agent runtime isolation contract](AGENT-RUNTIME-ISOLATION-CONTRACT.md):
  engineering contract for untrusted runtime crossings.
- [OpenClaw bounded runtime and state contract](OPENCLAW-BOUNDED-STATE-OPERATOR-GUIDE.md):
  default-off scratch, managed mind-store, reset/recovery and rollback semantics.
- [System Advisor Guide](SYSTEM-ADVISOR-GUIDE.md): reusable knowledge format.
- [Governed Knowledge Harvest](KNOWLEDGE-HARVEST.md): provenance,
  applicability, promotion, invalidation and supersession lifecycle.

## Verify

- [Security Assurance](SECURITY-ASSURANCE.md): scoped claims, maturity, TCB,
  evidence and non-claims.
- [SAFE_GUIDED secure-default proof](SECURE-DEFAULT-PROOF.md): human claim
  matrix, closed machine manifest and one deterministic proof command.
- [Known Limitations](KNOWN-LIMITATIONS.md): explicit gaps and external gates.
- [Supply-chain verification](SUPPLY-CHAIN.md): offline declaration checks and
  their limits.
- [Company-data validation](COMPANY-DATA-VALIDATION.md): canonical synthetic
  data constraints.
- [`release/governance.json`](../release/governance.json): machine-readable
  release and component evidence bindings.

## Extend

- **Locally validated candidate / not merged or released:** the
  [finite inactive capability/action catalogue](CAPABILITY-ACTION-CATALOGUE.md)
  binds strict synthetic action contracts to exact versions and digests and
  exercises fail-closed Gateway/broker admission. Presence, installation,
  discovery, listing, local validation, merge, and release do not activate an
  entry; activation is a separate exact maintainer authorization.
- **Released / locally validated:** [Builder operator guide](BUILDER-AGENT-OPERATOR-GUIDE.md)
  and [Builder defaults](BUILDER-CONFIGURATION-DEFAULTS.md) cover typed,
  target-neutral contracts and two synthetic systems. No live-system builder
  or production UI is claimed.
- **Planned:** [Connect your first system](CONNECT-YOUR-FIRST-SYSTEM.md) is a
  governed blueprint beyond the bundled demo; steps marked planned are not
  current executable instructions.
- **Released / locally validated:** HMI/harness contracts provide authority-free
  generation, discovery and explanation surfaces. The published
  [contribution preflight](../docs/development/hmi-010-authority-free-contribute-preflight-pdca.md)
  prepares canonical, digest-bound local-synthetic bytes; it performs no
  submission, publication, external write, credential use or runtime
  activation. A production UI is absent.
- **Locally validated / not in the current regular release:** [Skill Bundle
  canonical contracts](SKILL-BUNDLE-CONTRACTS.md) define strict manifest, lock,
  exact-file verification and compatibility identities for generation,
  analysis, installation and rollback consumers. They do not install, activate,
  publish, auto-update, grant capabilities or prove live registry/runtime
  safety.
- **Released contract / external evidence required:** the Entra profile and all
  five Power Platform read operations use exactly `cm.discovery.read`.
  `cm.operator.read` remains reserved for a future separate administrative-read
  profile. Live consent, import, tenant policy, provider compatibility and
  production identity behavior remain unproven.
- **Released / locally validated:** [Extension assurance profiles](EXTENSION-ASSURANCE-PROFILES.md)
  compare closed synthetic evidence, require eight universal hard-fail gates,
  expire stale evidence, and route security-shaped findings privately. They do
  not scan, accept, install, activate, certify, or grant authority to an
  extension or connector.
- **Released / locally validated:** the [minimized agent-work event contract](AGENT-WORK-EVENT-CONTRACT.md)
  classifies pseudonymous, consented, digest-bound synthetic records and their
  finite retention/deletion lifecycle. It adds no collector, telemetry,
  training feed, dashboard, ingestion path or runtime authority.
- **Locally validated / not in the current regular release:** the
  [governed BI execution spine candidate](BI-EXECUTION-SPINE-CONTRACT.md)
  validates a closed public-synthetic contract and simulated receipts. It does
  not independently prove formula/result bytes, run a query engine or dashboard,
  contact a provider, or grant authority.
- **Planned:** generic live connectors, production reversible-write onboarding,
  executable BI packs/runtimes and broader resource-plane profiles.

## Limitations and status

| Capability | Status | Evidence boundary |
| --- | --- | --- |
| Governed synthetic CRM → ERP effect | **Released / locally validated** | One pinned loopback demo with fictional data, brokered execution, readback and receipt |
| Verification Fabric | **Released / locally validated** | Deterministic contract and negative fixtures; no production deployment proof |
| Update/Migration/Doctor | **Released / locally validated** | Immutable six-axis locks, compatibility and read-only preview contracts; no discovery, repair, migration or update application |
| Builder contracts | **Released / locally validated** | Typed synthetic reuse and inactive target-neutral planning; no live-system builder or production UI |
| HMI/harness and contribution preflight | **Released / locally validated** | Authority-free interface and preparation contracts; no submission, publication or external write |
| Entra identity | **Released / external evidence required** | Closed `cm.discovery.read` identity contract; no live tenant, registration, consent or production identity proof |
| Power Platform five-read connector | **Released / external evidence required** | Five closed `cm.discovery.read` operations; no import, live Gateway/tenant, DLP or certification proof; `cm.operator.read` is future separate admin scope |
| Extension assurance profiles | **Released / locally validated** | Closed synthetic contract and eight hard-fail gates; no third-party scan, badge, acceptance, activation, authority, certification or production proof |
| Minimized agent-work event contract | **Released / locally validated** | Closed synthetic consent/retention/deletion record only; no collection, telemetry, training, ingestion or production proof |
| Arbitrary-system onboarding and writes | **Planned** | Blueprint only beyond the bundled synthetic path |
| Knowledge-driven Operating System | **Current product category; broad live realization planned** | Released local-synthetic foundation only; arbitrary live adaptation and production maturity remain unproven |

The root README owns orientation. Release Notes own increment detail, issues,
pull requests, assets and test summaries. Security Assurance owns security
claims and non-claims. Architecture owns trust boundaries. Guides own
procedures. Known Limitations owns gaps; roadmap issues own planned work.

Visibility maintenance is documented in the
[discoverability baseline](DISCOVERABILITY-BASELINE.md) and
[channel/automation matrix](VISIBILITY-CHANNEL-MATRIX.md). Public-Truth,
security-boundary and broken-primary-action failures are release blockers;
broad layout and discoverability findings remain review warnings unless they
create one of those failures. Follow regular increments through the
[Releases Atom feed](https://github.com/JimPansky/ChimpMaera/releases.atom).
