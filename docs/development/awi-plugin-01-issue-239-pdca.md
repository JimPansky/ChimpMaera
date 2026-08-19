# AWI-PLUGIN-01 Issue #239 implementation PDCA

## Plan

Deliver a source-bound, deterministic adapter over `KnowledgeEnvelopeV1` only.
Evidence is limited to pinned official-primary and synthetic ETL-02 fixtures.
No foreign code, network, credentials, GitHub state, runtime, shared release
surface, or central delivery state is touched.

## Do

- Added the closed evidence-source and record input boundary.
- Added deterministic envelope mapping with empty authority arrays.
- Added exact citation/selector, observed/review/expiry, licence/use, conflict,
  unknown, negative-evidence, and source-change invalidation behavior.
- Added three independently digest-bound source fixtures: one exact MIT-licensed
  official statement, CC0 synthetic conflict/unknown/procedure metadata and one
  synthetic ETL-02 report. Focused tests include 100 permutations, fail-closed
  extra/accessor fields and curated conflict preservation.

## Check

The focused command and result are reported by the implementation lane. Owner
integration remains responsible for shared exports, scripts, verification DAG,
release governance, checksums, full-suite/CI evidence, PR, merge, and release.

## Act / rollback / non-claims

The adapter is additive and can be omitted or protected-reverted without
changing the accepted Knowledge Envelope generation. It claims deterministic
evidence transformation only, not truth, trust, compatibility, security,
execution safety, ingestion, endorsement, or production readiness.
