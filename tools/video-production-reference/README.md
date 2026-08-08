# ChimpMaera Video Production Reference

Canonical authoring and governance:

- [Governed visual storytelling](docs/VISUAL-LANGUAGE-AUTHORING.md)
- [Audience discovery and audience lock](docs/AUDIENCE-DISCOVERY.md)
- [2026-08-03 hardening evidence and maturity](docs/PROCESS-HARDENING-EVIDENCE.md)
- Machine contracts: `schemas/storyboard.schema.json`, `schemas/audience-discovery-canvas.schema.json`, `schemas/script-package.schema.json`, `schemas/learning-record.schema.json`
- Versioned audience, visual grammar, script, learning and privacy-safe event templates: `templates/`

This directory ships a public reference Docker for the current
ChimpMaera video-production workflow. It is intentionally reference-quality:
small, inspectable, fail-closed, and faithful to the contracts used for the
current CM videos. It is not a universal studio and it is not a production or
security certification.

The core image validates backward-compatible `cm.video/v1` jobs and governed
`cm.video/v2` jobs, checks every asset declared by the job, refuses public side
effects, renders ordered PNG shots plus an accepted WAV to MP4 only when
explicitly authorized, and emits QA evidence.

The inspectable methodology version is `2026.08.02-v2`. See
`METHODOLOGY-CHANGELOG.md`, `methodology/consumed-deltas.json`, and
`schemas/process-delta.schema.json` for the evidence-backed evolution record.
The image also exposes publication-ready audience-copy gate
`2026.08.03-v1`, which keeps production/review workflow status out of public
media while preserving factual product-maturity boundaries and verified public
release descriptions.

## Community Invitation

This reference exists so contributors can run, inspect, improve, or replace the
current ChimpMaera video-production path. Better renderers, QA probes,
localization workflows, GPU/TTS packaging, or documentation are welcome when
they preserve fail-closed checks for assets a job actually declares.

When a published video materially uses a community production path or
contributor work, the practical intent is to reference that path and credit the
relevant contributors in the description or comments where appropriate and only
with contributor consent. This is not a guaranteed promotion promise; it is a
visibility practice for meaningful, consented contributions.

## Optional Reference Assets

`assets/reference/` contains a short neutral German voice example with its
transcript and the current transparent negative logo. Their hashes and media
facts are in `assets/reference/reference-assets.json`.

These examples are optional, replaceable, modifiable, and omittable. A job does
not have to use either one and may declare its own `spec.referenceAssets`.
Declared reference assets retain fail-closed path, accepted-status, and SHA-256
checks. The lightweight synthetic smoke intentionally omits the bundled media.

See `ASSET-USAGE.md` for the copyright, trademark, warranty, attribution, and
user-responsibility boundary.

## Boundary

- Apache-2.0 covers this reference code, documentation, synthetic examples, and
  bundled media where the repository copyright notice applies.
- Apache-2.0 grants no trademark rights and no permission to imply official
  endorsement.
- This repo does not ship model weights, private paths, secrets, personal data,
  or a mandatory character or visual identity.
- Users remain responsible for their configuration, outputs, rights, and
  safety under applicable law and license terms. No warranty is provided.

## Core CLI

```bash
tools/video-production-reference/bin/cm-video validate --job /job/video-job.yaml
tools/video-production-reference/bin/cm-video render --job /job/video-job.yaml --output /output
tools/video-production-reference/bin/cm-video qa --job /job/video-job.yaml --output /output/<immutable-version>
tools/video-production-reference/bin/cm-video validate-and-render --job /job/video-job.yaml --output /output
```

Default mode is validate-only. Full rendering requires all of the following:

- `spec.render.full: true`
- `spec.mode: full-render`
- `spec.render.overwrite: false`
- `spec.render.publicActions: forbidden`
- `spec.gates.textGate: PASS`
- `spec.gates.shotGate: PASS`

The renderer refuses to overwrite an existing immutable output directory.

For independent modular work, `cm_video_ref.batch.run_independent` provides a
bounded WIP=2 fan-out that records `PASS`, `FAIL`, or `BLOCKED` per exact
revision without global fail-fast. `validate_exact_fan_in` permits assembly
only for six exact digest-bound revisions with automated QA, candidate hashes,
and exact final human approvals. These contracts perform no assembly, upload,
or publication action.

## Editorial duration boundary

ChimpMaera Daily videos have no fixed target or maximum duration. The material
determines the useful length: explain the essential user value and relevant
context clearly and enjoyably, without unnecessary technical depth,
repetition, or filler. The former `75–90 seconds` guidance is superseded.

Timing fields in this reference describe locked production assets and media
assembly only. `spec.video.durationSeconds` must equal both the ordered scene
total and the accepted WAV measurement. The renderer rejects a mismatch and
does not trim narration or pad audio to hit that number. Target/max duration,
duration-gate, cut-to-fit, and pad-to-fit controls are rejected. Legitimate
clip/outro timing, subtitle readability, encoding, safe-area, and platform
limits remain technical constraints rather than editorial runtime goals.

## Docker

Build the CPU-first core image:

```bash
cd tools/video-production-reference
docker compose build cm-video-reference
docker compose config
```

`/output` must be writable by the non-root container user. With Compose you can
use `CM_VIDEO_UID=$(id -u) CM_VIDEO_GID=$(id -g) docker compose run ...` for a
local developer run, or provision `.video-output` for UID/GID `65532`.

Generate synthetic examples and run the smoke:

```bash
./scripts/smoke.sh
```

Verify that documented local paths, Docker/Compose build inputs, commands,
schemas, and declared reference assets remain present and digest-consistent:

```bash
python3 tools/video-production-reference/scripts/verify_reference_closure.py
```

The runtime profile is network-disabled, non-root, read-only root filesystem,
drops all capabilities, sets `no-new-privileges`, mounts `/job` and `/assets`
read-only, mounts `/output` writable, and does not mount the Docker socket.

## Governed Methodology Layer

The v2 contract is renderer-neutral and adds:

- a hash-bound public-copy policy (the included example enforces ChimpMaera,
  English-only public copy, and English narration numbers);
- claim/evidence/non-claim bindings and timed claim-to-visual scene mappings;
- named, revision-hash-bound English-copy and semantic reviews;
- safe-area and subtitle preflight;
- a deliberately designed ten-second outro with four timing probes; and
- a post-render evidence manifest covering full decode, stream parity,
  loudness, subtitles, safe area, ASR, and OCR.
- a publication-ready audience-copy gate for voice-over, subtitles, on-screen
  text, thumbnails, title/description copy, and final ASR/OCR observations.

The CPU image does not bundle ASR/OCR models. It validates their hash-bound
receipts. A `smoke-fixture` may use clearly labelled fixture receipts, while a
`publication-candidate` requires every gate to use `executionMode: executed`.
This prevents fixture evidence from being promoted as publication evidence.
ASR/OCR receipts also carry a hash-bound `audienceText` observation. The
validator applies the same public-copy policy to that final observed text; QA
status and other operational details may remain in the receipt sidecar but not
inside `audienceText`.

## Output Evidence

A successful render creates `/output/<immutableOutputVersion>/` with:

- `STATUS.json`
- `OUTPUT-MANIFEST.json`
- `QA.json`
- `RENDER-COMMAND.txt`
- `SHA256SUMS`
- `candidate.mp4`

Validate-only writes no MP4. Rendering and QA use `ffprobe`, full decode, EBU
R128 loudness/true-peak, black-frame detection, and SHA-256 checksums. The
smoke also validates the consumed-delta chain, negative probes, four outro
frames, the methodology evidence manifest, the positive/negative audience-copy
matrix, and the OCI methodology and copy-gate labels. Fixture validation fails
when the policy checksum, required channel coverage, or rule coverage is stale.

Inspect a built image:

```bash
docker image inspect chimpmaera/video-production-reference:2026-08-02-v2 \
  --format '{{ index .Config.Labels "org.chimpmaera.video.methodology.version" }}'
```
