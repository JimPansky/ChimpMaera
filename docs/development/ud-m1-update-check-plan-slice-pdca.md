# UD-M1 update check/plan and read-only Doctor slice — local PDCA evidence

## Claim boundary

This record supports the pure, local contract slice authorized for issue #53:
independent-context verification of a `CHECK_ONLY` update plan, deterministic
fixture construction for a read-only Doctor health/readiness report, and a
fixed public report projection. It proves behavior against synthetic in-memory
fixtures only.

This does not complete Issue #53.

It does not prove or provide package installation, registry access, migration
execution, A/B activation, promotion, atomic switching, observation of a live
runtime, rollback execution, safe-mode enforcement, CLI distribution,
production operation, HA/DR, or any filesystem, process, worker, package, or
network capability.

## Plan

The repair must not trust candidate-authored digests, tuple declarations,
authority identities, freshness, revocation, completeness, or health status.
Acceptance therefore requires an independently supplied expected candidate,
target tuple and authority profile, LKG tuple and authority profile, three
distinct trusted gate identities, caller evaluation time and freshness limit,
and evaluation-time-bound revocation state. Doctor verification must derive
tuple completeness and enforce exact profile-specific critical-check coverage.

Canonicalization must reject non-JSON structures before hashing. Fixture
outputs and verification results must be deeply immutable, and public health
bytes must come from a context-specific projection rather than a flat nested
allowlist.

## Do

- Added `packages/contracts/src/update-check-plan.ts` with mandatory
  independent verification contexts for plan and health verification.
- Bound the candidate to an exact complete six-axis target tuple and authority
  profile, bound the plan separately to the expected candidate and LKG, and
  required candidate/LKG authority-profile equality for this no-transition
  slice.
- Required distinct, role-specific trusted attestation, promotion, and
  compatibility identities; normalized actor aliases and candidate
  self-resolution deny.
- Derived LKG freshness from caller time and a caller limit, required plan
  issuance no earlier than the observed LKG evidence, and required an
  independent revocation record bound to the same LKG and evaluation time.
  Stale, pre-observation, revoked, mismatched, or missing trust context denies.
- Derived health tuple completeness, enforced the exact HEALTH/READINESS check
  order and canonical safe-mode reason order, enforced status/reason pairs,
  and mapped observed failures and missing observations to typed read-only safe
  mode. Reordered, missing, unknown, duplicate, or contradictory critical
  checks deny.
- Rejected sparse arrays, custom array properties, accessors, dangerous object
  keys, cycles, unsupported values, unsafe integers, duplicate reasons, and
  duplicate or wrong-axis component identifiers before canonical digesting.
- Deep-cloned fixture input and deeply froze returned reports and verification
  results. Verified plan rendering snapshots caller data once and emits the
  identical immutable snapshot. Renamed test fixture builders from `signed*`
  to `digested*`; content digests are explicitly documented as non-signatures.
- Replaced the health export allowlist with a fixed public projection. Public
  IDs use closed namespaces, and no generic arbitrary-object redactor is part
  of the public contract boundary.
- Aligned both closed JSON Schemas with safe integer bounds, safe identifier
  namespaces, unique reason codes, exact health coverage, and valid
  status/reason combinations. Added an explicit schema/runtime parity corpus.
- Kept the change additive and dependency-free, exported it through the
  contracts barrel, wired the focused test into `npm test`, and registered the
  four new public files in the deterministic release manifest.

## Check

- `npm run build` and `npm run lint` pass.
- The three existing update/Doctor suites pass 11/11.
- The focused UD-M1 suite passes 21/21, including every reproduced blocker:
  failed/unobserved/missing/unknown/duplicate/contradictory health checks,
  noncanonical check/reason order, false completeness, sparse-array digest
  collision, mutable aliases, identity/path/session/credential export field
  injection, allowlist collision, dangerous keys, cyclic arrays, authority
  profile mismatch/alias/self-resolution, a phase-changing render input,
  pre-observation issuance, missing or mismatched independent context,
  freshness/evaluation-time and revocation mismatch, duplicate reasons, and
  unsafe integers.
- Canonical plan digests remain stable across 100 deterministic object-key
  reorderings. These checks establish local fixture behavior only.

## Act

Keep this slice pure, read-only, and unreferenced by a live executable path.
Any update controller, migration engine, activation/rollback mechanism, live
Doctor integration, or operational safe-mode enforcement remains a separate
design and evidence boundary.
