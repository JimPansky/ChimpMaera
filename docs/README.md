# ChimpMaera documentation

This is the human- and machine-readable entry point to ChimpMaera's public
documentation. Start with the task you need; each capability claim links to
its evidence and limits.

## Start here

- **Run the local POC:** [Quickstart](QUICKSTART.md)
- **Understand the trust path:** [Architecture](ARCHITECTURE.md) and
  [Security Assurance](SECURITY-ASSURANCE.md)
- **Connect another system safely:**
  [Connect your first system](CONNECT-YOUR-FIRST-SYSTEM.md)
- **Verify a release:** [Release governance](RELEASE-GOVERNANCE.md) and
  [Supply chain](SUPPLY-CHAIN.md)
- **Contribute:** [Contributor workflow](../CONTRIBUTING.md)

## What works today

All entries below are local, synthetic proof-of-concept capabilities. They do
not establish production readiness, external write authority, certification or
support for a real tenant.

| Capability | Current proof | Evidence and limits |
| --- | --- | --- |
| Governed CRM-to-ERP action path | Proposal, policy, optional approval, brokered execution, authoritative readback, receipt and fail-closed probes | [Quickstart](QUICKSTART.md), [Security Assurance](SECURITY-ASSURANCE.md), [Known limitations](KNOWN-LIMITATIONS.md) |
| Verification Fabric | Digest-bound plans, checks, evidence and verdicts | [Security Assurance](SECURITY-ASSURANCE.md), [`release/governance.json`](../release/governance.json) |
| Update/Doctor | Check-only contracts and read-only diagnostics | [Architecture](ARCHITECTURE.md), [`release/governance.json`](../release/governance.json) |
| HMI and harness contracts | Authority-free discover/explain flows and synthetic adapter parity | [Security Assurance](SECURITY-ASSURANCE.md), [`release/governance.json`](../release/governance.json) |
| Azure/Entra identity profile | Deterministic authority-free identity contract | [Known limitations](KNOWN-LIMITATIONS.md), [`release/governance.json`](../release/governance.json) |
| Power Platform read connector | Synthetic read-only connector contract | [Known limitations](KNOWN-LIMITATIONS.md), [`release/governance.json`](../release/governance.json) |
| Portable connection design | Guides, typed capability contracts, policies and evidence patterns | [Connection guide](CONNECT-YOUR-FIRST-SYSTEM.md), [Zoo Field Guide](ZOO-FIELD-GUIDE.md) |

The broader vendor-neutral **Knowledge Operating System** is the project
direction. It is not listed as a current capability.

## Reference map

- **Normative rules:** [Canon](CANON.md)
- **Architecture and security:** [Architecture](ARCHITECTURE.md),
  [Agent runtime isolation contract](AGENT-RUNTIME-ISOLATION-CONTRACT.md),
  [Security Assurance](SECURITY-ASSURANCE.md)
- **Operations:** [Quickstart](QUICKSTART.md),
  [Builder operator guide](BUILDER-AGENT-OPERATOR-GUIDE.md),
  [Builder defaults](BUILDER-CONFIGURATION-DEFAULTS.md)
- **Knowledge and integration:** [System Advisor Guide](SYSTEM-ADVISOR-GUIDE.md),
  [Connection guide](CONNECT-YOUR-FIRST-SYSTEM.md),
  [Company-data validation](COMPANY-DATA-VALIDATION.md)
- **Release and risk:** [Release governance](RELEASE-GOVERNANCE.md),
  [Supply chain](SUPPLY-CHAIN.md), [Known limitations](KNOWN-LIMITATIONS.md)
- **Community:** [Zoo Field Guide](ZOO-FIELD-GUIDE.md),
  [Contributing](../CONTRIBUTING.md), [Support](../SUPPORT.md),
  [Private vulnerability reporting](../SECURITY.md)
- **Visibility maintenance:**
  [Discoverability baseline](DISCOVERABILITY-BASELINE.md) and
  [channel/automation matrix](VISIBILITY-CHANNEL-MATRIX.md)

## Document ownership

The root README provides orientation. Release Notes own increment detail,
issues and pull-request traceability. Security Assurance owns security claims,
evidence, TCB scope and non-claims. Architecture owns trust boundaries and
profiles. Guides own executable procedures. Known Limitations owns explicit
gaps. Roadmap issues own planned work.

Public-Truth drift, security-boundary errors and broken primary actions are
release blockers. Broader wording, layout and discoverability findings are
warning/review gates unless they create one of those failures.

Regular product increments are also available through the
[Releases Atom feed](https://github.com/JimPansky/ChimpMaera/releases.atom).
