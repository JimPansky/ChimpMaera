# Daily POC pipeline change log

## 2026-08-01 — REL-DAILY-001 v1

- Added the versioned canonical manifest schema and realistic
  `v0.2.0-poc.20260801.1` fixture.
- Added one deterministic manifest compiler for release, demo, evidence,
  limitation, README-pointer and video preparation artifacts.
- Reused the repository-native `cm.video/v1` contract through a closed,
  render-default-off adapter.
- Added durable atomic resume state, three candidate verdicts, SHA-256, SPDX
  input SBOM and provenance pointers.
- Added manual/configurably scheduled CI with publication effects absent.
- Added adversarial fixtures for the required negative matrix.

Rollback: revert the local REL-DAILY-001 commit. No remote publication or
runtime state depends on these bytes.
