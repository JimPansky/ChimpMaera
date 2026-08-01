# REL-DAILY-001 — Daily POC snapshot pipeline PDCA

Status: locally validated; publication prohibited

Claim boundary: repository-local candidate preparation only. This record does
not authorize push, PR, merge, tag, GitHub release, YouTube upload, deployment,
README publication or Owner-infrastructure changes.

## Backlog record

- **ID:** REL-DAILY-001
- **Outcome:** one versioned Daily POC manifest deterministically prepares an
  honest release/video candidate or a transparent no-change/blocked verdict.
- **Risk lane:** L3 acceptance because release builder, CI trust and public
  claim preparation are touched; actual public effects remain absent.
- **Rollback:** revert the isolated local commit. Stable releases and runtime
  behavior are unchanged.
- **External gates:** Owner-authorized GitHub prerelease, Owner-authorized
  YouTube publication and Owner-authorized README mutation remain separate.

## Plan

Reuse the existing public release scans, checksums and `cm.video/v1` renderer.
Add only a canonical schema, deterministic compiler, closed video adapter,
resumable owned state, workflow, fixtures, documentation and focused evidence.
Reject unsafe claims and all public effects.

## Do

Implementation surfaces:

- `schemas/daily-poc-manifest-v1.schema.json`
- `scripts/daily-poc.mjs`
- `examples/daily-poc/v0.2.0-poc.20260801.1/`
- `tests/daily-poc.test.mjs` and the adversarial matrix
- `.github/workflows/daily-poc-candidate.yml`
- Daily POC operator, iteration, change and decision documentation

## Check — REL-DAILY-001 evidence gate

| # | Gate | Evidence | Status |
|---:|---|---|---|
| 1 | Canonical manifest/schema and version policy | schema, realistic manifest, operator guide | PASS |
| 2 | Material-change and previous-snapshot resolver | Git resolver and history self-digest tests | PASS |
| 3 | Claim/use-case/evidence maturity enforcement | compiler semantic gates and negative matrix | PASS |
| 4 | Deterministic multi-artifact compiler | generated preview, double-build and verify tests | PASS |
| 5 | Video brief/storyboard/closed adapter | generated video artifacts and renderer-unavailable test | PASS |
| 6 | CI/local orchestration, default-off publication, resume | workflow, run state and partial/restart test | PASS |
| 7 | Focused/full tests, negative matrix and scans | commands and results below | PASS |
| 8 | Realistic preview, PDCA, clean commit/worktree, zero external mutation | local commit and final handoff state | PASS at local handoff |

Evidence results:

- `npm run daily-poc:test`: 22/22 pass, including 16 named adversarial
  fixtures, no-change, drift, partial/resume and independent double build.
- `npm test`: 72/72 pass.
- `npm run video:test`: 15/15 pass. A stale pre-existing assertion referred
  to the removed README heading `Additional tooling`; the narrow test now
  binds the current `Watch ChimpMaera` section and retains the spoiler scan.
- Example candidate: `READY_CANDIDATE`; its `SHA256SUMS` passes and `verify`
  proves byte equality against an independent fixed-input rebuild.
- Root checksum closure, JSON/YAML parse, `node --check`, `git diff --check`
  and the deterministic public-tree/archive builder pass.
- The fetched `origin/main` baseline has no separate supply-chain verifier;
  its relevant public builder, manifest, archive-path, secret/path scan and
  checksum gates were exercised instead of importing an unmerged framework.
- No install/runtime smoke was run because no changed byte affects the demo
  installer or runtime. No Docker build/run was needed because the example
  correctly remains render-disabled with planned assets.
- External mutation count: zero. No push, PR, merge, tag, release, upload,
  deployment, README mutation or Owner-infrastructure action occurred.

Runtime/install smoke is not applicable: these bytes add repository tooling,
schemas, CI preparation, docs and fixtures; they do not change the demo
installer or runtime behavior. Relevant project, video, checksum, public-tree
and supply-chain-adjacent gates remain required.

## Act

Keep the metric closed at 8/8. The next phase is daily
operation and measurement, not more framework work. Tune lead time, gate
failure classes, script correction count and readability feedback from actual
candidates. Publication remains separately authorized.
