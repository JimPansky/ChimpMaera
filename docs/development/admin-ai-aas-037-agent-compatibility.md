# AAS-037 agent and profile compatibility

Date: 2026-08-01
Scope: isolated local evidence only

## Canonical admission path

Every adapter must produce the same digest-bound Skill Admission IR. Runtime
materialisation is downstream of admission and cannot change the approved
bytes, tenant, version, requested capabilities or decision. Installation,
capability grant and activation remain separate state transitions.

| Runtime | Package format | Materialiser | Real isolated runtime | Evidence / boundary |
| --- | --- | --- | --- | --- |
| OpenClaw 2026.7.1 | `SKILL.md` package | Proven, byte/digest preserving | Single final smoke required; result belongs in immutable evidence/PDCA | Pinned image digest; managed volume is read-only in the agent and writable only by the broker |
| Hermes | Exact format not pinned locally | Unproven | Unproven | Canonical IR is reusable; no format or runtime claim |
| Claude Code | Exact format not pinned locally | Unproven | Unproven | Canonical IR is reusable; no plugin/runtime claim |

## Defaults, overrides and effective decision

| Profile | Safe default | Owner-configurable behaviour | Invariant ceiling |
| --- | --- | --- | --- |
| SAFE_GUIDED | Low-risk, trusted, capability-free read-only package may auto-admit; activation stays separate | Owner can confirm an otherwise valid admitted package | No malformed, mutable, tampered, cross-tenant, unknown-capability or self-approved request |
| CUSTOM | Owner confirmation by default | Owner may enable low-risk read-only auto-admission and enumerate admitted capabilities | Installation grants zero capabilities; unadmitted or transitive-owner rights deny/quarantine |
| RAMPAGE | Gateway-mediated and exact-schema only | May auto-admit every registered capability and extension explicitly admitted by Owner policy | High/critical provenance findings cannot auto-admit; invalid/tampered/cross-tenant input remains denied |

The result returns recommendation, route, rationale and impacts. RAMPAGE
preserves admitted function but does not convert invalid input into valid input.
The agent never signs the Owner decision.

## Managed store boundary

The broker stages exact bytes, records a content digest, installs an immutable
version inactive, and activates only in a later transition. Same-operation
replay returns the same receipt; conflicting replay denies; a concurrent tenant
writer throttles. Activation failure atomically restores the prior generation.
Explicit rollback restores the prior immutable generation rather than editing
the current version in place. Receipts retain digests and decisions but no
secret or arbitrary package content.

## Review markers

Revisit Hermes or Claude Code only when exact pinned package formats, licences
and local runtimes exist. Revisit registry/signing claims only after an Owner-
selected trust root and registry are available. Arbitrary executable packages,
install scripts and undeclared network/filesystem/process/secret access remain
quarantined by this candidate.
