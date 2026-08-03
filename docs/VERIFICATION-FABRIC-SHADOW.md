# Verification Fabric v2 Shadow

Verification Fabric v2 computes an impacted verification plan from a Git
base/head diff and a versioned Evidence DAG. It is experimental Shadow
instrumentation: the existing complete test suite remains authoritative and is
always executed by the Shadow command.

## Commands

Generate a stable machine-readable plan and a one-line human summary:

```bash
npm run --silent verification:plan -- --base origin/main --head HEAD
```

Compute the same plan and execute the authoritative complete comparator:

```bash
npm run --silent verification:shadow -- --base origin/main --head HEAD
```

With npm's `--silent` wrapper, JSON is written cleanly to standard output; the
human summary and complete-suite test log are written to standard error. A plan contains the changed paths, selected
nodes/tests, mandatory hard gates, fallback reasons and a deterministic digest.

## Fail-closed behavior

The classifier selects the directly changed semantic owner and all downstream
dependants encoded in `verification/verification-dag-v2.json`. It produces
`FULL_FALLBACK` for:

- an unmapped or unsafe path;
- ambiguous ownership;
- a changed, invalid, cyclic or unknown-node graph;
- graph/input digest drift;
- central toolchain, environment or security input changes;
- any classifier failure.

`FULL_FALLBACK` is safe over-selection, not a failed validation verdict. In
both modes, `npm test` remains the authoritative Shadow comparator. Mandatory
lint, checksum, governance, supply-chain and isolated public-stage gates remain
declared in every plan and are not skipped by this slice.

## Prototype attestations

The v2 contract can inspect prototype attestations, but they are
non-authoritative. A prototype match requires exact schema version, graph and
node digests, toolchain and environment digests, owned tests and attestation
digest. Missing, tampered, stale or mismatched evidence denies. Canonical
source-bound nodes do not declare a TTL; exact digest drift invalidates them.
TTL/expiry fields are accepted only as a paired duration and justification.

## Activation boundary

Incremental skipping and authoritative result reuse remain disabled. A later
activation proposal requires at least 24 materially different Shadow changes
with 100% failure-detection recall against full-suite runs and no unexplained
selection gaps. The proposal must also retain weekly and architecture-change
cache-free deep audits, random complete-suite sampling and immediate fallback
to the current complete suite.

Target latency SLOs remain hypotheses until measured over that sample:
small-change feedback under 3 minutes, PR p95 under 10 minutes and release
validation under 30 minutes.
