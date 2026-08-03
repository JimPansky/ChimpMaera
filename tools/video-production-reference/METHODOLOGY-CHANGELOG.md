# Methodology evolution

The methodology version describes validated production contracts in this reference image. It is independent of product releases and does not assert production maturity, certification, or universal quality.

## 2026.08.03 audience-copy gate v1 (v2 hardening)

This Docker increment keeps methodology `2026.08.02-v2` and adds a separately
labelled publication-ready audience-copy gate.

- Rejects self-referential upload/publication state, review-candidate and
  readiness state, QA pass/fail, human-review state, build/render instructions,
  artifact hashes/paths, and internal workflow identifiers from audience copy.
- Applies before synthesis to voice-over, public metadata, thumbnail text, and
  on-screen copy; after subtitle generation; and to hash-bound final ASR/OCR
  `audienceText` observations.
- Keeps operational detail valid in sidecar evidence and delivery messages.
- Preserves legitimate statements such as local synthetic proof-of-concept and
  not-production-ready boundaries, plus factual descriptions of a verified
  public release.
- Adds eight positive and nine negative fixtures across all eight required
  channels. The in-container fixture validator fails closed on a stale policy
  digest, missing channel coverage, or missing rule coverage.

Why: v2 already governed English copy and ASR/OCR receipt provenance, but it
did not distinguish public audience copy from internal production status.

## 2026.08.02-v2

This increment closes a measured gap between the public reference and a public-safe process delta from a governed video run.

- Added generic machine-readable process-delta and consumed-delta contracts with SHA-256 bindings.
- Added a reusable `cm.video/v2` methodology layer for claim/evidence/non-claim bindings and timed claim-to-visual correlation.
- Added named, revision-hash-bound English-copy and semantic-correlation reviews.
- Added a configurable public-copy policy. The included ChimpMaera example enforces the canonical name, English public copy, English narration numbers, and structured number exceptions.
- Added a deliberately designed ten-second outro contract with four fail-closed timing probes. Silent-outro acceptance was deliberately not carried forward.
- Added portable full-decode, stream-parity, loudness, subtitle, safe-area, ASR, and OCR evidence families. ASR/OCR engines are not bundled; their reports must be independently generated and hash-bound.
- Added positive and negative methodology fixtures plus an in-container smoke path.
- Added inspectable OCI methodology, source-revision, and documentation labels.

Why: the previous `2026.07.30-v1` image validated locked inputs and basic render/media properties, but could not prove the current editorial bindings or consume public-safe process deltas.

## 2026.07.30-v1

Initial CPU-first reference renderer with fail-closed asset locks, immutable output directories, basic decode/media QA, optional reference assets, and public-action denial.
