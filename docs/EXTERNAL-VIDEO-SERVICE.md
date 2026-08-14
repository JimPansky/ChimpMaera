# External Video Service Boundary

Status: **released contract / optional external artifact**.

ChimpMaera no longer embeds the video Docker reference implementation in the
main repository. The video renderer is consumed as a separate, portable,
SHA-256-pinned artifact. CM keeps only the contract needed to verify that the
operator intentionally selected the expected artifact version and digest.

## Contract

- Config schema: `chimpmaera.external-video-service/config/v1`
- Readback schema: `chimpmaera.external-video-service/readback/v1`
- Expected artifact version: `2026.08.02-v2`
- Minimum video contract: `cm.video/v1`
- Required artifact checksum: SHA-256 of the `.tar.gz`

Configuration keys:

- `CM_VIDEO_REFERENCE_ARTIFACT_URL`
- `CM_VIDEO_REFERENCE_ARTIFACT_SHA256`
- `CM_VIDEO_REFERENCE_VERSION`
- `CM_VIDEO_REFERENCE_CONTRACT_VERSION`
- `CM_VIDEO_REFERENCE_TIMEOUT_MS`

If no external video artifact is configured, the boundary is disabled. Unsafe
URLs, non-HTTPS URLs, private-address hosts, missing digests, version drift,
timeout drift, unavailable artifacts and checksum mismatches fail closed.

## Authority Boundary

CM does not own or start video Docker, does not mount video job/assets/output,
does not forward credentials, does not expose render or upload endpoints, and
does not claim video publication. Rendering remains an explicit external
operator workflow after artifact verification.

The separated artifact for this increment is:

- `chimpmaera-video-reference-2026.08.02-v2.tar.gz`
- SHA-256: `6aed9a5ded7341ea636c3de9f2bb99115501211024a7d51cb077edb1a33a6919`
- Sidecar SHA-256: `294110c4f988a762773084a900bf7e3f4044322a8b36040b48d80e100bbe9404`

Clean-room evidence for the artifact before pruning:

- Unit tests: 85/85 PASS.
- Reference closure: PASS, 42 checked paths.
- Compose config: PASS.
- Docker smoke from `.git`-free extraction with
  `CM_VIDEO_VCS_REF=external-artifact-20260814`: PASS, including synthetic
  render/QA, SHA-256 output verification, consumed-delta validation,
  audience-copy fixtures and OCI label checks.

## Rollback

Before publication, discard the feature branch and keep the archive evidence.
After protected merge, use a protected revert or fix PR. After release, preserve
the tag and assets; correct only with a successor release or explicit
withdrawal. Do not replace the separated video artifact in place.
