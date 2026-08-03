# UD-003 Compose observation adapter — local PDCA evidence

## Claim boundary

This record supports one deterministic, authority-free adapter over synthetic local Compose snapshots for issue #59. It does not prove Docker access, live Compose collection, host inspection, cancellation, update, repair, migration, release, deployment, production readiness, or production performance.

## Plan

Translate a closed read-only Compose snapshot into the immutable UD-002 QUICK fixture contract. Acceptance requires deterministic output independent of service ordering, no input mutation, exact required-service allowlisting, typed unavailable and mismatch results, lock drift delegated to the existing Doctor core, a public report without service details, and strict denial of mutation claims, duplicate services, unknown fields, and unexpected services.

Conservative assumption: a separate collector has already obtained the Compose version, configuration digests, service states, health states, and lock digest without mutation. Risk: fabricated or stale snapshots can still be internally well-formed. Fallback: remove the additive adapter while retaining UD-001 and UD-002. Review marker: any live collector requires an independent least-privilege, freshness, timeout, and command-injection review before use.

## Do

- Added the closed `chimpmaera.doctor/compose-observation/v1` snapshot and service contracts.
- Added an authority-free adapter that performs no file, process, Docker, network, credential, repair, or update operation.
- Added fixed QUICK mappings for installation, runtime, configuration, version lock, and health readback.
- Added aggregate-only private observations and retained the existing allowlisted public report projection.
- Added positive, drift, stopped, unhealthy, unavailable, missing, mutation, unknown-field, duplicate, and unexpected-service tests.
- Added the test to the public source closure and refreshed its checksums.

## Check

- Focused build plus UD-001/002/003 suites: 11/11 tests passed.
- TypeScript lint passed.
- Relevant full suite: 241/241 tests passed.
- Source checksum closure passed; supply-chain verification returned `PASS`; release-governance verification passed.
- Isolated public-release staging and staged checksum verification passed.
- Evidence remains local and synthetic; no Docker or external runtime was opened.

## Act

Accept UD-003 as `IMPLEMENTED_LOCAL_SYNTHETIC`. Issue #59 now has frozen contracts, a fixture-only Doctor core, and an authority-free Compose snapshot adapter. Advance to the next checkpointed frontier, issue #42 HMI authority-free core, rather than extending this completed metric. Rejected action: adding a shelling-out Docker collector, because this slice has no reviewed process/command boundary and the adapter evidence does not require one.
