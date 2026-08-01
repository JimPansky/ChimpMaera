# ChimpMaera POC Daily — 2026-08-01

Candidate version: `v0.2.0-poc.20260801.1`

Source: `f06ed8968fd3091e62af08c5caa7ace07e4e16a0` → `c0fa407d8224e98bdba9466850b8247f458ce914`

This is a prepared local candidate, not a published GitHub release.

## User-visible highlights

- **REL-DAILY-HIGHLIGHT-VIDEO — Video overview is easier to discover.** The repository landing page now points readers to the current ChimpMaera videos without changing runtime behavior. (cases: REL-DAILY-001; files: README.md)

## Evidence-bound claims

- **CM-CLAIM-VIDEO-BOUNDARY [MERGED]** The merged reference video contract requires public actions to remain forbidden during local validation and rendering. Evidence: EVID-VIDEO-README-MERGED, EVID-VIDEO-SCHEMA-MERGED, EVID-VIDEO-TEST-MERGED.
- **CM-CLAIM-VIDEO-DISCOVERY [MERGED]** The merged repository README links readers to the current ChimpMaera video overview. Evidence: EVID-README-MERGED.

## Explicit non-claims

- **NONCLAIM-VIDEO-CERTIFICATION** (CM-CLAIM-VIDEO-BOUNDARY) The reference renderer is not a production or security certification.
- **NONCLAIM-VIDEO-PUBLICATION** (CM-CLAIM-VIDEO-DISCOVERY) This candidate does not prove that a new video was uploaded or publicly released.
