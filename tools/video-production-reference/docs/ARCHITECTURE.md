# Architecture

## Goal

Ship the current ChimpMaera video-development environment as an inspectable
reference, not as a mature studio. The implementation follows the handoff
contracts proven by the public-safe delta chain in `../methodology/`.
Canonical editorial inputs follow the
[template and segment authoring contract](TEMPLATE-SEGMENT-AUTHORING.md).

## Runtime Shape

The core image contains only Python, PyYAML, FFmpeg, schemas, policies,
methodology metadata, QA gates, and the
`cm-video` CLI. Runtime security is supplied by Compose and smoke commands:
network off, non-root UID 65532, read-only root, all capabilities dropped,
`no-new-privileges`, read-only `/job` and `/assets`, writable `/output`, and no
Docker socket.

## Flow

1. `validate` loads a backward-compatible `cm.video/v1` or governed
   `cm.video/v2` job and fails closed on missing declared
   assets, hash mismatch, path escape, rejected/unknown status, public actions,
   invalid timing, missing text/shot gates, wrong PNG dimensions, wrong WAV
   format, or forbidden strings. `spec.referenceAssets` is optional; omission
   is valid, while declarations are checked exactly. V2 also validates
   public-copy policy digests, English narration-number rules,
   claim/evidence/non-claim integrity, timed visual bindings, safe areas,
   subtitles, named hash-bound reviews, the ten-second outro probes, and the
   publication-ready audience-copy boundary for narration, visible copy, and
   optional title/description/thumbnail fields. It also rejects fixed Daily
   target/max/gate and cut/pad-to-fit controls.
2. `render` repeats validation, refuses an existing immutable output directory,
   assembles static PNG shots with direct dissolves, preserves the already
   duration-matched locked WAV without trim/pad-to-fit filters, writes
   `candidate.mp4`, and records the exact render command.
3. `qa` runs `ffprobe`, full-decodes the MP4, checks dimensions, fps, pixel
   format, duration and audio sample rate, measures EBU R128 loudness and true
   peak, rejects black-frame events, and writes QA evidence plus checksums.
4. `validate-methodology-evidence` verifies artifact hashes, seven portable QA
   families, named revision-bound reviews, and four outro probes. Fixture
   evidence is accepted only for a manifest explicitly marked
   `smoke-fixture`; publication candidates require executed evidence. The
   hash-bound ASR/OCR receipts must expose `audienceText`, which is checked by
   the same publication-ready copy policy while sidecar status remains outside
   the audience field.
5. `validate-consumed-deltas` verifies the public process-delta chain and its
   assumption/risk/fallback/review/rollback record.
6. `validate-audience-copy-fixtures` replays positive and negative fixtures in
   the container and rejects stale policy hashes, channel coverage, or rule
   coverage.

Independent segment renders may use `cm_video_ref.batch.run_independent` with
the conservative WIP=2 ceiling. One module exception becomes only that
module's `FAIL` outcome and never cancels siblings. GPU-backed adapters remain
responsible for a separate WIP=1 TTS/ASR semaphore. `validate_exact_fan_in`
keeps Daily assembly fail-closed until six exact storyboard digests each bind
automated QA, a candidate hash, and the final human approval. Neither helper
uploads or publishes.

Editorial duration is content-driven. Scene and clip timing remains a technical
assembly contract, but no total Daily runtime is a target, maximum, pass/fail
goal, truncation trigger, or padding target.

## Evidence Files

Each render produces a versioned output directory with `STATUS.json`,
`OUTPUT-MANIFEST.json`, `QA.json`, `RENDER-COMMAND.txt`, `SHA256SUMS`, and
`candidate.mp4`.

## Model-backed QA Boundary

No ASR, OCR, TTS, CUDA, NVENC, or model weights are bundled. The reference
validates contracts and receipts around those steps; it does not claim model
accuracy or host equivalence.

## Reference Media Boundary

The source package includes a short voice example and transparent logo under
`assets/reference/`. They are inputs for experimentation, not runtime
dependencies or forced identity choices. Their generic manifest IDs are
source-independent, and users may replace or omit them. `ASSET-USAGE.md`
defines the copyright, trademark, warranty, and responsibility boundary.
