# ChimpMaera documentation

Use this hub to find the right public document without treating roadmap text
as shipped evidence. ChimpMaera's current proof is a released, open-source
local PoC for governed and verifiable AI-agent actions across business systems.
The vendor-neutral Knowledge Operating System is the broader direction.

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
- [System Advisor Guide](SYSTEM-ADVISOR-GUIDE.md): reusable knowledge format.

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

- **Released / locally validated:** [Builder operator guide](BUILDER-AGENT-OPERATOR-GUIDE.md)
  and [Builder defaults](BUILDER-CONFIGURATION-DEFAULTS.md) cover typed,
  target-neutral contracts and two synthetic systems. No live-system builder
  or production UI is claimed.
- **Planned:** [Connect your first system](CONNECT-YOUR-FIRST-SYSTEM.md) is a
  governed blueprint beyond the bundled demo; steps marked planned are not
  current executable instructions.
- **Released / locally validated:** HMI/harness contracts provide authority-free
  generation, discovery and explanation surfaces; runtime execution authority
  and a production UI are absent.
- **External evidence required:** live Entra consent, Power Platform import,
  tenant policy, provider compatibility and production identity behavior.
- **Planned:** generic live connectors, production reversible-write onboarding,
  BI packs and broader resource-plane profiles.

## Limitations and status

| Capability | Status | Evidence boundary |
| --- | --- | --- |
| Governed synthetic CRM → ERP effect | **Released / locally validated** | One pinned loopback demo with fictional data, brokered execution, readback and receipt |
| Verification Fabric | **Released / locally validated** | Deterministic contract and negative fixtures; no production deployment proof |
| Update/Doctor | **Released / locally validated** | Check-only contracts and read-only diagnostics; no repair or update application |
| Builder and HMI/harness | **Released / locally validated** | Typed synthetic reuse and authority-free interface contracts; no live-system builder or production UI |
| Entra identity and Power Platform reads | **Released / external evidence required** | Closed authority-free contracts; no live tenant, consent, import or certification proof |
| Arbitrary-system onboarding and writes | **Planned** | Blueprint only beyond the bundled synthetic path |
| Vendor-neutral Knowledge Operating System | **Planned direction** | Product direction, not current shipped maturity |

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
