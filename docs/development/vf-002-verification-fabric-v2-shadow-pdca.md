# VF-002 Verification Fabric v2 Shadow — PDCA evidence

Status: **SHADOW / EXPERIMENTAL — incremental skipping is not active**

Parent: [#40](https://github.com/JimPansky/ChimpMaera/issues/40)

Slice: [#69](https://github.com/JimPansky/ChimpMaera/issues/69)

Public base: `7e69c0b0ed2da4ca849f1be3fc514e14f6fb48a0`

## Plan

The current complete `npm test` suite remains the authoritative comparator and
fail-safe. This bounded slice adds a deterministic Evidence DAG, impacted-plan
classifier, fail-closed prototype-attestation verifier and Shadow command. It
does not add a second verification lifecycle, change branch protection, skip a
required check, reuse a cached result authoritatively or create a release.

The target hypotheses are:

- small-change feedback under 3 minutes;
- pull-request p95 under 10 minutes;
- release validation under 30 minutes.

These are hypotheses, not achieved SLO claims. Activation is blocked until at
least **24 materially different changes** have run in Shadow with **100%
failure-detection recall** against the authoritative complete suite and no
unexplained selection gaps. Twenty-four samples are large enough to require a
mix of contract, schema, fixture, validator, toolchain, governance, security,
documentation and unmapped changes while remaining a bounded first activation
gate. A later decision must assess diversity, not merely count runs.

### Baseline

Three local warm runs were measured before implementation. The range is a
machine-local starting sample, not p95 evidence:

| Gate | Command | Result | Range |
| --- | --- | --- | ---: |
| Focused VF v1 | `npm run build` plus v1 test | 3/3 | 1.05–1.09 s |
| Complete suite | `npm test` | 280/280 | 4.17–4.35 s |
| Lint | `npm run lint` | pass | 0.83–0.89 s |
| Release governance | tests plus verifier | 15/15 + pass | 0.34–0.58 s |
| Supply chain | `npm run supply-chain:verify` | 6/6 declarations | 0.06–0.07 s |
| Isolated public stage | public-release builder | pass | 0.59 s |

### Architecture fit

V2 extends the existing `packages/contracts/src/verification-fabric.ts`
contract family. The canonical graph binds source, contract, schema, fixture,
validator, toolchain, environment, security and derived-evidence inputs by
SHA-256. Explicit dependency edges drive downstream invalidation; path
ownership only identifies the first changed semantic node.

## Do

- Added a closed Draft 2020-12 Evidence DAG schema and canonical graph.
- Added deterministic cycle/unknown-node validation and downstream closure.
- Added stable machine-readable plans with concise human summaries.
- Added `FULL_FALLBACK` for graph changes/drift, unsafe or unmapped paths,
  ambiguous ownership, central inputs and classifier failure.
- Added a closed prototype-attestation contract. Reuse requires exact node,
  graph, toolchain, environment, tests, version and digest binding. Missing,
  tampered, stale or mismatched evidence denies. This store remains
  non-authoritative/read-only in the slice.
- Added `npm run verification:plan` and `npm run verification:shadow`. Shadow
  computes the plan and still executes `npm test` as authoritative comparator.

No canonical node uses a time-to-live: source-bound evidence is invalidated by
exact digests. TTL fields are permitted only as a paired duration and written
justification; mutation tests exercise a bounded replay example.

## Check

The frozen local result is:

| Check | Result |
| --- | --- |
| VF v1 + v2 focused tests | 16/16 pass |
| VF v2 selector/negative probes | 13/13 pass |
| Authoritative complete suite | 293/293 pass |
| TypeScript lint/build | pass |
| Release governance | 15/15 plus repository verifier pass |
| Supply-chain declarations | 6/6 pass |
| Root checksum closure | 383/383 pass |
| Isolated public-stage checksum closure | 331/331 pass |
| Real base/head plan | `FULL_FALLBACK`, four nodes, six selected expectations, five hard gates, reason `GRAPH_CHANGED` |
| Real Shadow comparator | `SHADOW_PASS`, 293/293 authoritative tests; 5.35 s local wrapper sample |

The real slice correctly falls back because it changes the canonical graph
itself. This is expected fail-safe behavior, not evidence that selective mode
may be activated. The plan-only local wrapper sample was 1.06 seconds; neither
timing is a p95 or SLO claim.

Required probes cover single-node change, downstream invalidation,
cross-contract change, central/toolchain/security invalidation, unmapped and
unsafe paths, graph change/drift, invalid/cyclic/unknown graphs, ambiguous
ownership, missing/tampered/stale/mismatched attestations, deterministic plans,
mandatory hard gates, selector failure and comparator execution in both plan
modes.

## Act

Activation remains **blocked**. Shadow sampling must record, for every material
change, the selected expectation and complete-suite outcome without treating a
plan or attestation as authority. The later activation review requires:

1. 24 materially different Shadow changes with 100% failure-detection recall;
2. zero unexplained selection gaps and an explanation for every fallback;
3. a cache-free deep audit weekly and after every graph/toolchain/architecture
   change;
4. random complete-suite sampling even after any later activation;
5. immediate rollback to the current complete suite on classifier error,
   mismatch, stale/missing evidence, environment drift or recall loss.

Rollback is removal/disablement of the optional plan/Shadow command. The
complete suite and existing governance remain unchanged and authoritative, so
rollback does not depend on cached evidence or migration. Consciously rejected
actions are authoritative incremental skipping, authoritative cache reuse,
branch-protection or check weakening, CI bypass and release creation.
