# UD-001 Update/Doctor contracts — local PDCA evidence

## Claim boundary

This record supports one synthetic, local product slice for issue #59. It does not prove update application, repair, migration execution, Docker or cloud observation, release, deployment, production readiness, or public readback.

## Plan

Freeze exact v1 lock/profile, check-only plan/receipt, and read-only Doctor report contracts. Acceptance requires closed JSON Schemas, canonical digest reproducibility across 100 object-key reorder repetitions, exact v1 acceptance, explicit v2 denial, mutable-target denial, digest and authority-delta denial, and a public projection with no seeded secret, private-path, address, or arbitrary-error channel.

Conservative assumption: v1 permits only `CHECK_ONLY` and `VALIDATE_CONTRACTS`, with identical before, target, and after lock digests. Risk: a later product phase may need additive action variants. Fallback: discard this local additive contract package without state impact. Review marker: require design review before the first pointer writer, privileged observer, migration executor, or authority-changing plan.

## Do

- Added three closed JSON Schema files covering the exact lock profile, operation plan/receipt, and Doctor report.
- Added exported TypeScript contracts, a finite reason/exit-code registry, canonical SHA-256 binding, and a fail-closed cross-contract verifier.
- Added one exact positive v1 fixture and eight named v1/v2 negative mutations.
- Added public-release manifest entries; no release, runtime, issue, or external state was changed.

## Check

- Focused build and UD-001 suite: 4/4 tests passed.
- Relevant full suite, first pass: 233/234 passed; the only failure was the expected unmanifested-new-source release guard.
- Final validation after manifest integration: TypeScript lint passed, supply-chain verification returned `PASS`, release-governance verification passed, the public-release staging probe passed, and the full suite passed 234/234 tests.
- Evidence is deterministic and synthetic; no runtime, release, or production claim is made.

## Act

Keep v1 immutable and fail-closed. The next independent frontier is UD-002, a fixture-only read-only Doctor core, subject to a fresh checkpoint and writer lock. Rejected action: implementing discovery, Docker access, apply, repair, or migration execution, because UD-001 is an authority-free contract freeze and those behaviors require separate evidence and review gates.
