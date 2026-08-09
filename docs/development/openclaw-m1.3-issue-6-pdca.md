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
- added a fail-closed atomic V1-to-V2 Gateway state migration that preserves
  validated M1.2 effects/receipts, replay JTIs, counters, and legacy mind data;
- validates the complete persisted V2 envelope, including exact shapes, safe
  counters and replay bounds, scope/value/entry/byte quotas, retention duration,
  digests and generations, before recovery or readiness;
- reloads realistic serialized state through the production loader to prove
  migration and interrupted-reset recovery preserve effect receipts and replay
  state across two successive restarts.
- bounds persisted/reset generations before readiness, prevalidates prepared and
  committed reset candidates before mutation, and proves exhaustion leaves the
  mind/journal unchanged while the Gateway durably records only the stable denial;
- derives a no-daemon regression from both Dockerfiles' `COPY` sources and
  requires every source to participate in the setup image cache key.

## Check

`npm run openclaw-m1.3:test` is the focused gate. The full repository, docs,
supply-chain, release-governance, secure-default, public-stage, and checksum
gates remain authoritative. Exact executed results are recorded in the
synthetic evidence file in the containing commit.

Final owner-lane readback on exact committed code/test tree
`541007a8fb9a54f6bbc94a30f7c3c05bc838a382` records the focused suite at
38/38 PASS (runtime lock 9, runtime contract 6, Gateway workload 9, Gateway
state persistence 7, mind lifecycle 7), authoritative `npm test` at 408/408
PASS (including secure-default metadata 12/12 and learning routing 26/26), and
secure-default proof at PASS with report digest
`adecbb0d86838c45bde09d2d44979f442a54b22ab401a7e7562ba6801ea3b07c`.
These results include deterministic Compose rendering, not live-container
execution. The earlier Codex sandbox Docker/socket and selected child-process
EPERM restrictions remain historical environment evidence; exact pinned images
were not started and live smoke remains unexecuted and unclaimed.

## Act

Rollback stops and purges only the labelled candidate runtime and synthetic
state, then reverts the containing commit. Re-review every state-contract or
runtime-control change. Do not promote local contract evidence into hostile-
host, production-data, backup, privacy/compliance, or disaster-recovery claims.
