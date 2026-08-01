# Daily POC pipeline decision log

## REL-DAILY-D001 — one canonical manifest

Decision: every human-facing and machine-facing candidate artifact is compiled
from one versioned JSON manifest. Generated files are not editable sources.

Reason: claim maturity, use cases, evidence and video narration otherwise drift.
Fallback: retain the manifest and regenerate; never reconcile outputs manually.

## REL-DAILY-D002 — small adapter, existing video contract

Decision: emit a closed adapter request targeting repository-native
`cm.video/v1`; do not create a second renderer or per-release script.

Reason: the existing renderer already supplies asset locks, overwrite denial,
QA and public-action denial. Fallback: preparation-only artifacts remain useful
when render prerequisites are unavailable.

## REL-DAILY-D003 — deterministic operational evidence

Decision: checksum-bound reports use logical gate durations and manifest-derived
dates. Wall time stays outside the package.

Reason: actual timings would violate byte reproducibility. Review marker: if a
future evidence archive stores wall time, bind it as a separate non-candidate
observation rather than changing candidate bytes.

## REL-DAILY-D004 — publication is another stage

Decision: GitHub prerelease, YouTube upload and README mutation are rejected by
the preparation compiler even if approvals are written into the manifest.

Reason: manifest text is not Owner authority. Fallback: a future separately
authorized publication stage may consume only a `READY_CANDIDATE` snapshot and
must record its own effects and receipts.
