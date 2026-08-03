# Verification planning and contribution preflight release handoff

Status: release candidate assembled from public `main` and proven local source
commits. Publication remains gated by the complete repository suite, required
GitHub CI, exact merged-commit asset construction and anonymous readback.

## User value

- Verification Fabric v2 gives maintainers a deterministic Evidence-DAG plan
  showing which verification nodes a change affects and why. Any uncertainty
  falls back to the full suite, which remains authoritative.
- HMI contribution preflight gives users a canonical, digest-bound way to
  prepare and inspect a contribution intent without acquiring a publication
  route, write authority or issue-submission behavior.

## Included components

### Verification Fabric v2 Shadow

- Public implementation: `packages/contracts/src/verification-fabric-v2.ts`,
  `schemas/contracts/verification-evidence-dag-v2.schema.json`,
  `schemas/contracts/verification-attestation-v2.schema.json`,
  `verification/verification-dag-v2.json`, `scripts/verification-plan.mjs` and
  `scripts/verification-shadow.mjs`.
- Positive proof: 16/16 focused Verification Fabric v1+v2 tests pass; the real
  Shadow plan executes the complete comparator.
- Fail-closed proof: 13/13 v2 selector and mutation probes cover central,
  unmapped, unsafe, ambiguous, invalid, cyclic, drifting and selector-failure
  inputs with over-selection or `FULL_FALLBACK`.
- Binding: issue #69, PR #70, merge commit
  `7f35f0033dfc6429ea7f8d2f67af16aeabcc0736`, and
  `docs/development/vf-002-verification-fabric-v2-shadow-pdca.md`.
- Non-claims: status remains `SHADOW_READY`; 0/24 materially different Shadow
  samples are recorded. No authoritative incremental skipping, result reuse,
  latency SLO or production-readiness claim is made.

### HMI contribution preflight

- Public implementation: `packages/contracts/src/hmi-contribute-preflight.ts`,
  `schemas/contracts/hmi-contribute-preflight-v1.schema.json`,
  `tests/fixtures/hmi/positive-contribute-preflight-v1.json`,
  `tests/hmi-contribute-preflight.test.ts` and
  `tests/hmi-post-contribute-consistency.test.ts`.
- Positive proof: 42/42 focused HMI tests pass, including 7/7 contribution
  preflight and 4/4 post-contribution cross-contract probes.
- Fail-closed proof: stale request/generation bindings, invented provenance,
  selector/capability widening, authority fields and submission/publication
  effects deny deterministically.
- Binding: issue #42; source commits
  `499f04c99fe4edbe896c778eeffab3d47204ab81`,
  `f7a66ce7a449f122bfbacc986d4c9ac6f99bd35a`,
  `dccd2cf1f6b1dc4b49b9fb93d3f1cb4bec947697` and
  `b68019917fe2773f9b87e93525c47a2bd249f4c5`; evidence HMI-009 through
  HMI-012 under `docs/development/`.
- Provenance: all nine feature/schema/fixture/test/evidence files are
  byte-identical to the clean source branch. `package.json`, the contract
  export and public manifest were union-integrated onto current public `main`.
- Non-claims: preparation and preflight only. No issue submission,
  publication, external write, live harness, route, credential, planning,
  validation, handoff or runtime authority is included.

## Excluded scope

- AZX-001 and the whole new Azure/identity increment are excluded. Its own
  bounded assessment records conflicting `cm.discovery.read` and
  `cm.operator.read` mappings in two current plan artifacts. Publishing that
  slice would bind contradictory permission truth.
- Funding metadata already on `main` is incidental state, not a release
  headline.
- Video tooling, Capability Cells (#63), the author guide (#64), ERP benchmark,
  Resource-Plane profiles and unrelated backlog are not part of this release.

## Release boundary

Proposed regular tag: `v0.2.0-poc.20260803.3`.

Proposed title: **ChimpMaera — Verification Planning and Contribution
Preflight Increment**.

Assets must be built from the exact merged release commit. The release must be
`draft=false`, `prerelease=false`, become regular Latest, and pass anonymous
tag/release/asset/hash/raw-main readback before public completion is claimed.
