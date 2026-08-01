# AAS-037 Managed Skill Lifecycle PDCA

Date: 2026-08-01  
Phase: Admin-AI security expansion / managed skill lifecycle  
Starting checkpoint: `da76543e12390c3f3d899e178eac17bc4f513759`  
Branch: `feat/admin-ai-aas-037-managed-skill-lifecycle`  
Starting metric: **0/6**

## Plan and maturity gate

AAS-036 is complete at 8/8 and is not reopened. AAS-037 is locally reachable:
the canonical admission contract, immutable local package resolution,
deterministic analysis and profile routing, atomic store generations, a pinned
isolated OpenClaw package and adversarial fixtures need neither a live registry
nor production credentials. Installation, activation and capability grant are
three separate decisions. The managed store is writable only through its
broker; an agent may request a change but cannot mutate the store or approve
itself.

### Exact 6/6 acceptance

1. A versioned, closed Skill Admission IR binds tenant, requester, immutable
   source/version/digest, manifest, `SKILL.md`, tool declarations,
   dependencies, requested capabilities and package bytes. Unknown fields,
   formats, mutable references and byte/digest disagreement deny.
2. Deterministic analysis produces a quality/risk report for provenance,
   licence, dependency pinning, secrets, network, filesystem, process,
   persistence, install scripts, path/symlink safety and transitive rights.
3. An explainable decision matrix returns recommendation, rationale, impacts
   and routing for SAFE_GUIDED, CUSTOM and RAMPAGE. RAMPAGE preserves admitted
   functionality but cannot validate malformed/tampered/cross-tenant/self-
   approved input. Installation never grants requested capabilities.
4. A brokered store atomically stages and installs immutable versions, then
   activates separately, supports idempotent same-request replay, serialises
   concurrent writes, reads back receipts and restores a prior generation on
   activation failure or explicit rollback.
5. The pinned isolated OpenClaw runtime completes one request/install/activate/
   use/readback/rollback E2E. A compatibility matrix records exact evidence for
   OpenClaw and marks Hermes/Claude Code materialisation and runtime execution
   honestly unproven unless pinned local formats become available.
6. The negative matrix covers mutable source, digest swap, malicious scripts,
   hidden network/credential/process access, path escape/symlink, dependency
   confusion, transitive escalation, post-approval mutation, cross-tenant
   reuse, replay/concurrent install, failed activation and rollback. Focused,
   full, supply-chain and public-staging validation, clean commits and zero
   owned residue pass. Exactly one isolated full smoke runs after relevant
   bytes freeze; a repeat requires a recorded correcting byte change.

### Conservative assumptions, risks, fallbacks and review markers

- **Immutable source fixture:** a local content-addressed package replaces a
  live registry. Risk: it cannot prove registry identity or availability.
  Fallback: mutable URLs, tags and unresolved sources deny. Review when an
  Owner-authorised registry/trust root is selected.
- **Licence/provenance evidence:** the admission manifest carries a finite
  SPDX allowlist and digest-bound provenance statement. Risk: this is not a
  legal opinion or signature-chain proof. Fallback: unknown/missing evidence
  routes to deny or Owner confirmation without installation. Review when
  production signing and licence policy are selected.
- **Sandbox analysis:** deterministic declarations and bounded byte scanning
  are authoritative for this local proof. Risk: they do not prove arbitrary
  code safe. Fallback: install scripts, executable payloads and undeclared
  authority indicators quarantine. Review before admitting executable package
  formats.
- **Runtime compatibility:** OpenClaw is proved only at its pinned local
  version and package format. Hermes and Claude Code remain protocol/material-
  iser/runtime unproven without exact pinned artefacts and licences.

### Rollback boundary

Deactivate the skill, atomically restore the prior immutable tenant generation,
retain digest-only receipts, and remove only the labelled isolated AAS-037
containers/volumes. Rollback never grants capability rights and never mutates
the Owner OpenClaw or another tenant's generation.

### Honest non-claims

This work does not claim arbitrary skill code safety, live-registry or package-
signature compatibility, legal licence clearance, production sandbox/store/
trust-root custody, hostile-host containment, universal agent compatibility or
release readiness. It does not touch the Owner OpenClaw, Gateway, vLLM, models,
credentials, production systems or external accounts.

## Do

Pending.

## Check

Pending.

## Act

Pending.
