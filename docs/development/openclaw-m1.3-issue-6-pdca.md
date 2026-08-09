# OPENCLAW-M1.3 issue #6 — completion PDCA

Date: 2026-08-09

Integration baseline: `0dd0b67483e75de03acab9a3448b645172aeeb68`

The implementation was originally developed from `259d7e5c7a9d2953165dd05eeee84ec78443ce66`
and then reconciled onto the integration baseline while preserving the merged
OPENCLAW-M1.2 V2 workload, route, replay, manifest, release, and checksum
behavior.

Commit binding: this record and `security/openclaw-m1.3-evidence-v1.json` bind
to the Git commit that contains them, avoiding a circular embedded hash.

## Plan

Extend the merged, pinned, default-off Docker Reference Adapter only. Replace
unbounded/ambiguous local state with explicit ephemeral tmpfs and a
generation-bound managed mind store. Preserve the internal Gateway route,
provenance gate, replay evidence, and ownership-scoped rollback.

## Do

- made Agent/OpenClaw state container-instance ephemeral and added exact 1 MiB
  scratch;
- implemented allowed synthetic data classes, retention, exact quotas,
  tenant/workload/purpose/generation binding, two-phase scoped reset, and
  fail-closed recovery;
- preserved foreign workload canary state and effect replay receipts across
  semantic reset;
- expanded effective runtime readback and live probes for filesystem,
  privilege, mount, device/socket, scratch boundary/lifetime, readiness,
  restart, reset, stale state, and replay;
- added deterministic no-daemon lifecycle tests, schema, fixtures, operator
  boundaries, evidence, and immutable input/checksum bindings.

## Check

`npm run openclaw-m1.3:test` is the focused gate. The full repository, docs,
supply-chain, release-governance, secure-default, public-stage, and checksum
gates remain authoritative. Exact executed results are recorded in the
synthetic evidence file in the containing commit.

## Act

Rollback stops and purges only the labelled candidate runtime and synthetic
state, then reverts the containing commit. Re-review every state-contract or
runtime-control change. Do not promote local contract evidence into hostile-
host, production-data, backup, privacy/compliance, or disaster-recovery claims.
