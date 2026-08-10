# INTAKE-001 Issue #46 PDCA

Status: implemented and locally verified on synthetic offline fixtures; not
merged, released, deployed, publicly submitted, or production-activated.

## Plan

Reuse VF-001 canonical evidence identities, ASF-01 fail-closed intake gates,
and HMI-01 authority-free contribution preflight. Add the smallest L2 contract
that can safely progress one allowed candidate, while proving zero public bytes
for security/private material and deterministic no-repeat recovery after an
uncertain write boundary.

Assumption: the repository's synthetic destination convention can be bounded
to `repo:*` and synthetic readback to `example.invalid`. Risk: a future reviewed
provider contract needs other identifiers. Fallback: add a separately reviewed
version rather than widening v1. Review marker: any real adapter, credential,
network route, non-synthetic data, autonomous trigger, or Issue #52 control
plane proposal.

## Do

Implemented a closed versioned lifecycle, deterministic sanitizer/classifier,
mandatory injected duplicate search, exact preview, five-minute exact-action
approval, declared least-privilege submit/readback adapter, deterministic
idempotency and attempt identities, immutable hash-chained transition evidence,
and fail-closed recovery states. No adapter implementation or public route was
added.

## Check

The eight focused tests own one complete positive lifecycle plus default-off,
quarantine, classification, exact/ambiguous duplicate, stale/mismatched/reused
approval, timeout, partial, receipt tamper, remote mismatch, missing/ambiguous
readback and history-tamper evidence. Objective counts and final commands are
recorded in `verification/intake-001-evidence-v1.json`.

## Act

Accept only `LOCAL_SYNTHETIC_NOT_RELEASED` after focused, adjacent VF/ASF/HMI,
governance, supply-chain, checksum, public-manifest and the single authoritative
repository suite pass. Rollback disables only this intake route/profile,
restores the exact prior accepted contract, retains evidence append-only, and
uses a protected revert after merge. Issue #39 remains the parent; Issue #52
remains separate and incomplete.
