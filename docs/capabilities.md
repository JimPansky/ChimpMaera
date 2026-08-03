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
| Builder contracts | **Released / locally validated** | [Builder guide](BUILDER-AGENT-OPERATOR-GUIDE.md), [current-release byte binding](../release/governance.json), [BLD-001 local PDCA source](../docs/development/bld-001-builder-agent-m1-pdca.md) | Typed target-neutral planning and synthetic two-system reuse; no live-system builder, automatic adapter generator or production UI. The historical PDCA's pre-release status describes its dated checkpoint, while current release governance owns byte status. |
| Resource-plane profiles M0 | **Released / locally validated** | [Resource-plane guide](RESOURCE-PLANE-PROFILES.md), [`CM-REL-012` release binding](../release/governance.json) | Declarative plan for exactly seven closed planes with SAFE_GUIDED/CUSTOM/FULL_CONTROL diff only; no runtime activation, host authority change, resource access or production claim |
| HMI/Harness multitool and contribution preflight | **Released / locally validated** | [`CM-REL-006` HMI/Harness release evidence](../release/governance.json), [contribution-preflight PDCA](../docs/development/hmi-010-authority-free-contribute-preflight-pdca.md) | Authority-free local-synthetic generation, discover/explain and digest-bound preparation only; no submission, publication, external write, credential, route or production UI |
| Microsoft Entra identity profile | **Released / external evidence required** | [`CM-REL-007` Azure/Entra release evidence](../release/governance.json), [identity PDCA](../docs/development/azid-001-authority-free-azure-identity-profile-pdca.md) | Closed single-tenant Authorization Code + PKCE contract using exactly `cm.discovery.read`; no live tenant, registration, consent, token validation or production identity proof |
| Power Platform five-read connector | **Released / external evidence required** | [`CM-REL-008` Power Platform release evidence](../release/governance.json), [read-connector PDCA](../docs/development/ppread-001-authority-free-power-platform-read-connector-pdca.md) | Exactly five authority-free operations, all bound to `cm.discovery.read`; no import, live Gateway/tenant, consent, DLP, certification or production behavior. `cm.operator.read` remains a future separate administrative-read profile. |
| Arbitrary-system onboarding and writes | **Planned** | [Connection blueprint](CONNECT-YOUR-FIRST-SYSTEM.md) | Not an executable path beyond the bundled synthetic fixture |
| Knowledge-driven Operating System | **Current product category; broad live realization planned** | [Documentation scope](README.md), [root architecture story](../README.md) | The category and released local-synthetic contract foundation are current; arbitrary live-system adaptation, autonomous outcome learning and production fitness remain planned/unproven |

The machine-readable release record is
[`release/governance.json`](../release/governance.json). The root README owns
orientation; [Security Assurance](SECURITY-ASSURANCE.md) owns scoped security
claims; [Known Limitations](KNOWN-LIMITATIONS.md) owns current non-claims. The
[curated roadmap](roadmap.md) links planned work to live issues without making
it a second maturity source.
