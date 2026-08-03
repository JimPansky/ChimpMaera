# VF-001 Verification Fabric contracts — local PDCA evidence

## Claim boundary

This record supports one synthetic, local product slice for issue #40. It does not prove release, deployment, profile-specific validation, production readiness, artifact promotion, external authority, or public readback.

## Plan

Freeze one public V1 vocabulary for verification plans, check runs, evidence bundles, verdicts, self-test identity, revalidation triggers, and last-known-good (LKG) pointer/readback. Acceptance requires schema-valid positive evidence plus fail-closed stale, missing, mismatched, self-produced, corrupted-LKG, and unredacted-link negatives.

Conservative assumption: the first version publishes one aggregate schema with stable `$defs`. The definitions can later be split into individual files without changing their V1 field vocabulary. Review marker: confirm aggregate-versus-individual schema packaging before any release.

## Do

- Added a closed JSON Schema contract set and exported TypeScript contract vocabulary.
- Added a fail-closed cross-contract verifier with canonical SHA-256 binding.
- Added one positive fixture and six named negative fixture mutations.
- Added public-release manifest entries; no release or external state was changed.

## Check

- Focused build and VF-001 suite: 3/3 tests passed.
- Relevant full suite, first pass: 229/230 passed; the only failure was the expected unmanifested-new-source release guard.
- Final validation after manifest integration: checksum verification passed, TypeScript lint passed, supply-chain verification returned `PASS`, and the full suite passed 230/230 tests.
- Evidence is deterministic and synthetic; no production or external-runtime claim is made.

## Act

Keep V1 fail-closed. The next independent frontier is Update/Doctor contracts (#59), subject to a fresh checkpoint and writer lock. Rejected action: implementing profile-specific validators in this slice, because issue #40 explicitly excludes them and doing so would couple the vocabulary freeze to premature runtime behavior.
