# Daily POC pipeline change log

## 2026-08-02 — REL-DAILY-003 release-identity cleanup

- Replaced the versioned README heading and lead with a timeless product
  identity and an explicit public-release / Daily-candidate / provenance block.
- Kept package version `0.1.0` as published stable-line metadata while removing
  the versioned product identity from its description.
- Bound the corrected candidate to checksum-valid source commit `f035ea90`.
- Added compiler gates for README status semantics, same-line Daily history,
  predecessor dates and unmarked mixed versions, with four adversarial cases.
- Rebuilt `v0.2.0-poc.20260802.1`; publication remains disabled.

## 2026-08-02 — REL-DAILY-002 candidate correction

- Corrected the README's three video destinations and bound labels to the
  public titles observed read-only on 2026-08-02.
- Replaced the synthetic v0.1 predecessor in the current example with the
  verified `v0.2.0-poc.20260801.1` snapshot as explicit provenance only.
- Separated repository-only Daily POC tooling and candidate evidence from the
  `cm-v0.1-public-rc-*` staging manifest.
- Initially prepared `v0.2.0-poc.20260802.1` from the merged baseline
  `c0fa407` to the locally validated, not-released source commit `7e9e6c7`;
  REL-DAILY-003 supersedes that source head with `f035ea90`.

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
