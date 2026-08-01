# Daily POC demo guide

Version: `v0.2.0-poc.20260801.1`

## USE-CASE-VIDEO-DISCOVERY — Find the current ChimpMaera video overview

Inputs:

- A local checkout of source commit c0fa407d8224e98bdba9466850b8247f458ce914

Steps:

1. Open README.md.
2. Locate the Videos section.
3. Review the linked overview and security-boundary video descriptions.

Expected outcomes:

- The video overview is discoverable from the repository landing page.
- The text does not claim a stable release or production validation.

Demo utility: Provides a short, user-visible entry point for explaining the POC before deeper local demonstration.

Evidence: EVID-README-MERGED

## USE-CASE-VIDEO-PREFLIGHT — Inspect the fail-closed video preparation contract

Inputs:

- The repository-native cm.video/v1 documentation and schema

Steps:

1. Review tools/video-production-reference/README.md.
2. Inspect the cm.video/v1 schema.
3. Keep rendering and every public action disabled until local assets and approvals are complete.

Expected outcomes:

- The preparation path identifies exact render prerequisites.
- No upload, push or public action is available from the renderer contract.

Demo utility: Makes the video-production boundary inspectable without requiring a render or bespoke release script.

Evidence: EVID-VIDEO-README-MERGED, EVID-VIDEO-SCHEMA-MERGED

## Reproduction

- `git diff --name-status f06ed8968fd3091e62af08c5caa7ace07e4e16a0..c0fa407d8224e98bdba9466850b8247f458ce914`
- `npm run video:test`
