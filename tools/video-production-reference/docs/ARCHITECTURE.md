# Architecture

## Goal

Ship the current ChimpMaera video-development environment as an inspectable
reference, not as a mature studio. The implementation follows the handoff
contracts from `cm-video-production-implementation-handoff-20260730`.

## Runtime Shape

The core image contains only Python, PyYAML, FFmpeg, schemas, QA gates, and the
`cm-video` CLI. Runtime security is supplied by Compose and smoke commands:
network off, non-root UID 65532, read-only root, all capabilities dropped,
`no-new-privileges`, read-only `/job` and `/assets`, writable `/output`, and no
Docker socket.

## Flow

1. `validate` loads the `cm.video/v1` job and fails closed on missing declared
   assets, hash mismatch, path escape, rejected/unknown status, public actions,
   invalid timing, missing text/shot gates, wrong PNG dimensions, wrong WAV
   format, or forbidden strings. `spec.referenceAssets` is optional; omission
   is valid, while declarations are checked exactly.
2. `render` repeats validation, refuses an existing immutable output directory,
   assembles static PNG shots with direct dissolves, pads/trims locked WAV audio,
   writes `candidate.mp4`, and records the exact render command.
3. `qa` runs `ffprobe`, full-decodes the MP4, checks dimensions, fps, pixel
   format, duration, audio sample rate, and writes QA evidence plus checksums.

## Evidence Files

Each render produces a versioned output directory with `STATUS.json`,
`OUTPUT-MANIFEST.json`, `QA.json`, `RENDER-COMMAND.txt`, `SHA256SUMS`, and
`candidate.mp4`.

## Optional GPU/TTS

The GPU/TTS profile is deliberately separate. It documents the actual Qwen3-TTS
and Whisper contract, including offline `/models` mount and model commit, but it
is not built by default and cannot silently fall back to a different path.

## Reference Media Boundary

The source package includes a short voice example and transparent logo under
`assets/reference/`. They are inputs for experimentation, not runtime
dependencies or forced identity choices. Their generic manifest IDs are
source-independent, and users may replace or omit them. `ASSET-USAGE.md`
defines the copyright, trademark, warranty, and responsibility boundary.
