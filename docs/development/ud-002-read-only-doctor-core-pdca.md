# UD-002 Read-only Doctor core — local PDCA evidence

## Claim boundary

This record supports named deterministic fixture diagnostics for issue #59. It does not prove Compose, Docker, host, cloud, tenant, database, update, repair, migration, release, deployment, production-readiness, or production-performance behavior.

## Plan

Implement immutable `QUICK` and `STANDARD` probe selections over a fixture-only observation contract. Acceptance requires stable output independent of fixture ordering, a canonical report digest, zero mutation claims, typed timeout/unavailable/lock-drift results, strict unknown-field and duplicate-probe denial, and an allowlisted public projection that excludes private observations.

Conservative assumption: fixture observations carry already measured synthetic `durationMs`; the core compares that value with a supplied positive timeout budget without calling a runtime adapter. Risk: this does not test live cancellation or platform observation. Fallback: remove this additive runner while retaining UD-001 contracts. Review marker: require a separate UD-003 adapter boundary and least-privilege review before any live observation.

## Do

- Added fixed five-probe `QUICK` and twelve-probe `STANDARD` selections.
- Added a closed fixture validator, deterministic runner, typed finding projection, automatic version-lock comparison, and canonical report digest.
- Added a fail-closed public renderer that accepts only the closed Doctor report projection and rejects digest drift.
- Added private observation canaries, timeout, unavailable, lock-drift, mutation-claim, duplicate, unknown-field, reorder, and digest-tamper tests.
- Added the new test source to the public-release manifest; no runtime, repair, release, issue, or external state changed.

## Check

- Focused build and UD-001/UD-002 suites: 8/8 tests passed.
- TypeScript lint passed.
- Relevant full suite passed 238/238 tests. Supply-chain verification returned `PASS`, release-governance verification passed, and the isolated public-release staging probe passed after final manifest integration.
- Evidence remains local and synthetic; elapsed fixture values are inputs, not measured platform SLOs.

## Act

Keep fixture profiles immutable and fail closed. The next independent frontier is UD-003, a read-only local Compose observation adapter, subject to a fresh checkpoint and writer lock. Rejected action: opening Docker, probing real services, or implementing repair/update behavior, because those cross the verified fixture-only boundary and require separate authority and evidence.
