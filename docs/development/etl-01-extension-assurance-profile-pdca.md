# ETL-01 Extension Assurance Profile contract PDCA

Status: released as regular Latest `v0.2.0-poc.20260804.3`; no scanner,
acceptance, activation or runtime authority was added.

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

Final delivery evidence:

- authoritative suite: 322/322 pass;
- documentation site: 5/5 pass;
- release governance: 26/26 pass before the new component binding;
- supply-chain declarations: 6/6 pass;
- root SHA-256 closure and isolated public staging: pass;
- npm audit: zero known vulnerabilities;
- feature PR #104 merged as `79d2120fab0128d966f3c868133b0151663c947e`;
- release-identity PR #105 merged as
  `f285c7350922682817e4400ad6d86720458b53f0` after the complete lock tuple
  was rebound in the Verification DAG;
- exact release-target Main CI, including Docker/video smoke: pass;
- two exact-source archive builds: byte-identical; and
- regular Latest `v0.2.0-poc.20260804.3`: non-draft/non-prerelease, with an
  archive of 1,387,595 bytes at
  `62228f60a875fe6e010789c926365d43a1436a2c7077b3fb191a5e45bf8be3ee`
  and a 137-byte checksum manifest at
  `74a8a2407712e077104cae79e6b9e5c0ee2e289ef4d5d367ba4f9d0f8bf46d46`.

Anonymous Latest metadata and both public asset bytes matched before the
release-truth integration PR. Canonical raw-Main readback is rerun after that
PR merges.

## Act

Keep the evaluator authority-free and fail closed. Rejected actions: running
third-party scans, publishing vulnerability material, issuing trust badges,
accepting/installing/activating extensions, or claiming production assurance.
Those actions are outside issue #45 and unnecessary for contract evidence.

The materially different feature Main change is eligible for exactly one later
Verification Fabric Shadow calibration sample. The release-identity/truth
maintenance commits are not manufactured additional product samples.

Claim boundary:
`LOCAL_SYNTHETIC_PROFILE_ONLY_NO_TRUST_BADGE_NO_ACCEPTANCE_NO_ACTIVATION_NO_EXECUTION`.
