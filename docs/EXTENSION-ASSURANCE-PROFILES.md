---
title: Extension assurance profiles
description: Evaluate extensions and connectors against a closed local-synthetic assurance contract without creating a trust badge, acceptance decision, or runtime authority.
---

# Extension assurance profiles

ETL-01 defines one deterministic contract for comparing extension and
connector evidence. It records risk class, exact subject digest, check
run/not-run decisions, evidence expiry, retest triggers, false-result counts,
public claim vocabulary, and private security routing.

The result is an assessment record only. It does not scan third-party code,
accept an extension, issue a trust badge, install or activate anything, grant
authority, or prove production safety.

## Universal hard-fail gates

Every profile must run all eight gates:

1. malware signal;
2. credential access;
3. authority expansion;
4. unbounded network egress;
5. unverified executable material;
6. prohibited data disclosure;
7. signature or digest mismatch; and
8. evidence tampering.

A missing gate, a required gate marked `NOT_RUN`, or any `FAIL` denies the
assessment. Optional checks may be `NOT_RUN` only with the closed reason
`NOT_APPLICABLE` or `PRIVATE_LAB_REQUIRED` and with no invented evidence.

## Expiry, retest, and false results

Evidence is bound to the exact subject digest and has a finite expiry. Subject,
profile, policy, or evidence-age changes, a confirmed false negative, and a
manual request are all explicit retest triggers. Stale or subject-mismatched
evidence returns `RETEST_REQUIRED`; it is never silently reused.

False positives, false negatives, and open reviews are count-only in the
public contract. Their referenced evidence remains content-addressed. A
confirmed false negative requires retest before another conformant result.

## Security-shaped evidence

`SECURITY_SENSITIVE` findings must route to `SECURITY_POLICY_PRIVATE` with
public detail set to `NONE`. Public rendering accepts no arbitrary finding,
error, path, identity, credential, host, tenant, or payload field. Invalid or
security-shaped input can therefore emit only the fixed result vocabulary and
claim boundary. Suspected vulnerabilities belong in the repository's
[private security route](../SECURITY.md), never in a public issue or fixture.

## Verify locally

```bash
npm run build --silent
node --test dist/tests/extension-assurance-profile.test.js
```

The focused suite checks the schema, 100 canonical reorderings, all eight
hard-fail rules, required-run denial, stale and changed-subject retest,
false-negative retest, routing mismatch, missing triggers, unknown fields,
digest drift, and seeded disclosure values.

## Claim boundary

`LOCAL_SYNTHETIC_PROFILE_ONLY_NO_TRUST_BADGE_NO_ACCEPTANCE_NO_ACTIVATION_NO_EXECUTION`

This is comparable local-synthetic contract evidence. Third-party scanning,
extension acceptance, badges, installation, activation, marketplace release,
live-provider behavior, certification, and production fitness remain outside
the slice.
