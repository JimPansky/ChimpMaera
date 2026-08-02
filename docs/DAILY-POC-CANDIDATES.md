# Daily POC candidate pipeline

`REL-DAILY-001` prepares one deterministic, evidence-bound candidate package
from one canonical manifest and a clean frozen Git source. It never publishes.
The manifest is the only editorial source for release notes, demo instructions,
claims, non-claims, the README pointer, evidence indexes and video inputs.

## Version and title policy

- Candidate version: `v<next-semver>-poc.YYYYMMDD.N`.
- `N` starts at 1 and increments for each additional candidate on the same day.
- Current repository example: `v0.2.0-poc.20260802.1`.
- The current public release is `v0.1.0`; it is a separate stable predecessor
  line, not the identity of the current Daily candidate.
- `v0.2.0-poc.20260801.1` is the current example's explicit provenance
  predecessor only. It must not appear in Today or Current candidate fields.
- Until a tag and GitHub release exist, the Daily must be described as a local
  candidate and **not published**. A prepared or merged candidate is not a
  release.
- Underscores and other non-SemVer spellings fail schema validation.
- GitHub release title, if a later authorized stage uses the candidate:
  `ChimpMaera POC Daily — YYYY-MM-DD`.
- Stable releases and Daily POC candidates have separate lifecycles.

Every prior snapshot embedded in `history` carries a self-digest. Daily history
is limited to the same target release line. The compiler rejects tamper,
cross-line mixing, malformed predecessor identities, non-earlier snapshots,
duplicate date/sequence pairs and a previous source head that does not equal
the new base. This is deterministic integrity evidence, not a signature: a
later publication stage must bind any cryptographic attestation.

The frozen source README must use the timeless `# ChimpMaera` product heading
and separate `Current public release`, `Daily candidate` and `Provenance
predecessor` status lines. The Daily line must contain the exact target version
and `not published`; the predecessor identity is forbidden in that line.
Unmarked foreign version lines in current manifest fields fail closed.

## Prepare locally

The source checkout must be clean, be exactly at `source.head`, and contain
`source.base` as an ancestor. Use a separate detached checkout when authoring
the manifest or compiler in another worktree.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run daily-poc:test
node scripts/daily-poc.mjs prepare \
  --manifest examples/daily-poc/v0.2.0-poc.20260802.1/manifest.json \
  --source-repo /path/to/clean/frozen/source \
  --output /path/to/new/candidate-output
```

`prepare` resolves Git commits and changed files, validates evidence paths and
hashes, checks claim maturity, scans inputs and outputs, then writes files
atomically. An existing output directory is reusable only when its owned state
has the same manifest digest. Existing differing bytes fail closed.

## Verdicts

- `READY_CANDIDATE`: material source change exists and every preparation gate
  passed. This is not publication authority.
- `NO_MATERIAL_CHANGE`: the source diff is empty. No release notes, video brief
  or fake daily release is generated.
- `BLOCKED`: `candidate-report.json` contains stable machine-readable reasons.
  A broken public release is never attempted.

The ready package contains deterministic release notes, demo guide, evidence
summary/index, limitations, README pointer, video brief/narration/storyboard,
closed video-adapter request, SPDX input SBOM, provenance, run report, snapshot,
artifact manifest, candidate report and `SHA256SUMS`.

## Verify and resume

```bash
node scripts/daily-poc.mjs verify \
  --manifest /path/to/manifest.json \
  --source-repo /path/to/clean/frozen/source \
  --output /path/to/candidate-output
(cd /path/to/candidate-output && sha256sum -c SHA256SUMS)
```

`.daily-poc-state.json` is the minimal durable resume record. Each generated
file is written through a same-directory temporary file and rename. Re-running
with the same manifest verifies or fills missing owned bytes and converges to
the same final state. A different manifest digest, foreign output directory or
changed existing artifact blocks instead of overwriting work.

For a blocked run:

1. Read `candidate-report.json` and preserve it as negative evidence.
2. Correct the manifest, source checkout or evidence in a new output directory.
3. Increment the same-day sequence if editorial candidate identity changed.
4. Do not weaken claim, evidence, secret, path or publication gates.

## Video boundary

The generated `video-adapter.json` targets the existing `cm.video/v1` contract
at `tools/video-production-reference/`. Render defaults to off. `--render-video`
requires all assets to be accepted and hash-locked, the renderer to exist, and
the exact `LOCAL_RENDER:<candidate-version>` binding. Missing prerequisites
produce `BLOCKED`; no silent renderer or asset fallback exists. The adapter has
no upload or publication capability.

## CI boundary

`.github/workflows/daily-poc-candidate.yml` has read-only repository permission,
checks out the frozen source separately, runs focused adversarial tests, and
retains preparation evidence. Scheduled execution is inert unless repository
variable `CM_DAILY_POC_SCHEDULE_ENABLED` is explicitly set to `true`.
Credentials are not persisted. No tag, release, push, README edit or upload to
YouTube exists in the workflow.

## Troubleshooting

- `SOURCE_HEAD_MISMATCH` or `SOURCE_WORKTREE_DIRTY`: use a clean detached source
  checkout at the manifest head.
- `TAMPERED_PRIOR_SNAPSHOT`: restore the verified snapshot bytes; never repair
  only the digest.
- `HISTORY_RELEASE_LINE_MISMATCH` or `UNMARKED_MIXED_RELEASE_LINE`: keep stable
  history and Daily provenance explicit instead of blending their identities.
- `README_*`: restore the timeless product heading and the three explicit,
  correctly bound status lines; never describe a local Daily as released.
- `STALE_EVIDENCE` or `EVIDENCE_HASH_MISMATCH`: recompute evidence from the
  frozen source and update maturity honestly.
- `CLAIM_EXCEEDS_EVIDENCE_MATURITY`: lower the claim or obtain stronger
  evidence; do not rewrite narration around the gate.
- `OWNED_OUTPUT_TAMPER_OR_DRIFT`: preserve the directory for investigation and
  prepare into a new directory.
- `VIDEO_RENDERER_*`: keep the candidate in preparation-only mode until every
  exact local prerequisite is satisfied.
