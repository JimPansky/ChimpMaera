# ETL-01 Extension Assurance Profile contract PDCA

Status: locally validated; release pending.

## Plan

Deliver issue #45 as the smallest authority-free Extension Trust Lab slice.
The SMART metric is 10 gates: dependency truth, closed schema, deterministic
evaluator, fixtures, hard-fail/expiry tests, zero seeded public disclosure,
public manifest/governance, focused/full tests, protected integration, and
regular Latest release/readback/issue truth.

Assumption: an evidence-only local-synthetic assessment can be released
without running a third-party scan or conferring trust. Risk: readers could
mistake a conformant profile for a badge or acceptance decision. Fallback:
fixed `DENIED`/`RETEST_REQUIRED` outcomes, private security routing, and an
explicit no-badge/no-acceptance/no-authority claim boundary. Review marker:
before PR, after required CI, at release readback, and before issue closure.

## Do

- Added one closed Draft 2020-12 assurance-profile schema.
- Added one pure TypeScript evaluator with canonical SHA-256 binding.
- Required all eight universal hard-fail gates to run and pass.
- Added finite evidence expiry, subject binding, six retest triggers, and
  false-positive/false-negative/open-review counters.
- Added closed public claim vocabulary and private security routing.
- Added one positive fixture and fourteen named negative mutations.
- Added a public guide and release-manifest entries; no scanner, installer,
  runtime hook, external write, credential, or activation was added.

## Check

Initial focused evidence:

- Extension assurance suite: 5/5 pass.
- Canonical object-key reorderings: 100/100 stable.
- Universal hard-fail cases: 8/8 deny.
- Required gate `NOT_RUN`: deny.
- Stale, changed-subject, and confirmed-false-negative cases: retest required.
- Security-shaped seeded disclosure values in public result bytes: 0.

Full repository, release-governance, supply-chain, public-stage, PR/CI, release,
and anonymous readback evidence is appended only after each gate actually
passes.

## Act

Keep the evaluator authority-free and fail closed. Rejected actions: running
third-party scans, publishing vulnerability material, issuing trust badges,
accepting/installing/activating extensions, or claiming production assurance.
Those actions are outside issue #45 and unnecessary for contract evidence.

After protected integration, this materially different Main change becomes
exactly one later Verification Fabric Shadow calibration sample; it is not
counted before merge.

Claim boundary:
`LOCAL_SYNTHETIC_PROFILE_ONLY_NO_TRUST_BADGE_NO_ACCEPTANCE_NO_ACTIVATION_NO_EXECUTION`.
