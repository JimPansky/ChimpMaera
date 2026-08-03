---
title: Capability, maturity, and evidence
description: Check ChimpMaera capabilities against released scope, local validation, external evidence requirements, and explicit limitations.
---

# Capability, maturity, and evidence

These status labels are intentionally narrow:

- **Released** means the bytes exist in the current regular release.
- **Locally validated** means reproducible local evidence exists; it does not
  establish live-system or production fitness.
- **Planned** means design or roadmap only.
- **External evidence required** means the repository cannot prove the claim
  without a real provider, tenant, environment, or independent operation.

| Capability | Status | Evidence | Boundary |
| --- | --- | --- | --- |
| Governed synthetic CRM → ERP effect | **Released / locally validated** | [CM-SEC-007 evidence and command](SECURITY-ASSURANCE.md#claim-evidence-matrix), [Quickstart](QUICKSTART.md) | One pinned loopback flow with fictional records; no live integration or production claim |
| SAFE_GUIDED authority default | **Released / locally validated** | [Closed proof manifest and negative probes](SECURE-DEFAULT-PROOF.md) | Declared local path only; no hostile-host or complete-mediation claim |
| Verification Fabric and Shadow planner | **Released / locally validated** | [Verification Fabric guide](VERIFICATION-FABRIC-SHADOW.md), [`CM-REL-004` release binding](../release/governance.json) | Deterministic contracts and Shadow planning; no production deployment proof |
| Update/Doctor observations | **Released / locally validated** | [Architecture boundary](ARCHITECTURE.md), [`CM-REL-005` release binding](../release/governance.json) | Check-only/read-only contracts; no update or repair application |
| Builder and HMI/harness contracts | **Released / locally validated** | [Builder guide](BUILDER-AGENT-OPERATOR-GUIDE.md), [`CM-REL-006` and `CM-REL-007`](../release/governance.json) | Typed synthetic reuse and authority-free output; no live builder or production UI |
| Entra identity profile and Power Platform reads | **Released / external evidence required** | [Known limitations](KNOWN-LIMITATIONS.md), [`CM-REL-008`](../release/governance.json) | Closed authority-free contracts only; no live tenant, consent, import, or certification proof |
| Arbitrary-system onboarding and writes | **Planned** | [Connection blueprint](CONNECT-YOUR-FIRST-SYSTEM.md) | Not an executable path beyond the bundled synthetic fixture |
| Vendor-neutral Knowledge Operating System | **Planned direction** | [Documentation scope](README.md) | Direction only; not current shipped maturity |

The machine-readable release record is
[`release/governance.json`](../release/governance.json). The root README owns
orientation; [Security Assurance](SECURITY-ASSURANCE.md) owns scoped security
claims; [Known Limitations](KNOWN-LIMITATIONS.md) owns current non-claims. The
[curated roadmap](roadmap.md) links planned work to live issues without making
it a second maturity source.
