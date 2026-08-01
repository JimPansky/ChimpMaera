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

Implemented the canonical TypeScript Skill Admission IR, closed manifest/file
validation, deterministic provenance/licence/dependency/access/transitive-
rights report, explainable profile matrix, content-addressed OpenClaw
materialiser and an in-memory reference broker/store. The store serialises a
tenant writer, separates install from activation and capability grant, returns
idempotent receipts and restores prior immutable generations.

Added a default-off, two-service Docker fixture. The pinned OpenClaw runtime is
non-root/read-only and sees the managed skill volume read-only; the non-root
manager alone stages and atomically renames exact bytes. Both services have one
internal network, no ports, host mounts, Docker socket or ambient credentials.
The OpenClaw plugin can request admission and separately request activation/
readback, but it cannot write the store or grant capabilities.

## Check

- Focused canonical/runtime tests: **12/12 PASS**.
- Complete repository tests: **128/128 PASS**.
- Video reference tests: **15/15 PASS**.
- Supply-chain checks: **6/6 PASS**, lock digest
  `280d51e2c6b154065ba03c746e43e56769d2f5f57107c97aea442b302c18b070`.
- Deterministic public staging: PASS, archive digest
  `1515336518dd3f3f44f5080bcd3dbf3668348f2266919a3d8b5d4388f5a40482`,
  temporary residue zero.
- Implementation commit:
  `94cc5f24436b274a252dae3ff9b0326fcf1b2c30`.
- Final isolated smoke `aas037-20260801T151252Z`: PASS in 31,238 ms. The real
  pinned OpenClaw runtime made three model calls, requested the immutable skill,
  received the same install receipt on replay, separately activated and read
  `Hello from the Zoo`, retained zero granted capabilities, produced three
  lifecycle receipts, passed eight denials, rolled back, reset and left zero
  labelled containers, networks, volumes or derivative images. The Owner
  process/config fingerprint was identical before, during and after.
- Two earlier smoke attempts failed closed and were fully purged. Run
  `aas037-20260801T150933Z` exposed Docker named-volume ownership; owned marker
  bytes corrected copy-up. Run `aas037-20260801T151118Z` exposed manager-private
  `0700/0400` materialisation; `0755/0444` corrected read-only consumer access
  without write authority. Each rerun followed a real correcting runtime-byte
  change; no smoke ran after the final PASS.

## Act

Close AAS-037 at **6/6** with verdict
`LOCAL_AAS_037_PASS_NOT_ARBITRARY_CODE_LIVE_REGISTRY_PRODUCTION_STORE_UNIVERSAL_AGENT_OR_RELEASE_CLAIM`.
Do not optimise or rerun it absent new regression evidence.

The frontier audit rechecked capability separation, provenance, package bytes,
runtime materialisation, tenant isolation, audit causality, recovery and claim
boundaries. No new distinct I5 gap was found: live registry/signature/legal-
licence/production store evidence remains external or preparable; Hermes and
Claude Code remain honestly unproven; cross-control audit and artifact trust
remain AAS-023/AAS-025. AAS-023 is the next internally ready I4/L item under the
existing ordered tie-break, ahead of AAS-025 and recurring I3 AAS-030.
