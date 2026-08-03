# HMI-007 authority-free explain payload contract PDCA

Status: implemented and verified locally with synthetic fixtures; not installed,
activated, released or production-ready.

## Plan

Implement exactly the bounded `explain` payload selected by HMI-006. Bind an
explanation to one mapped request and one verified immutable generation, require
subjects to equal the mapped selector set, and restrict citations to provenance
declared by that generation. Keep the generic six-operation dispatcher, the
other four unsupported operation payloads, live harnesses, routes, credentials,
tenant access and runtime activation outside this slice.

Acceptance evidence was fixed before implementation:

- one closed Draft 2020-12 schema accepts the exact synthetic fixture;
- only an already mapped `explain` request can be accepted;
- request and generation digests must match the verified bundle;
- subject capability IDs must equal mapped selectors and exist in the bundle;
- at least one cited source is required, all sources must be declared
  provenance, and mapped reference limits remain authoritative;
- `CITATIONS_REQUIRED` and `LOCAL_SYNTHETIC` are explicit closed markers;
- requested rights, routes and write targets remain empty; and
- schema, binding, subject, citation and authority drift deny with typed reasons.

## Do

- Added `chimpmaera.hmi/explain-payload/v1` as a closed TypeScript and JSON
  Schema contract.
- Added a pure validator that re-verifies the supplied generation, binds both
  digests, normalizes subject and citation sets, and emits deterministic
  canonical bytes plus a SHA-256 payload digest.
- Required every subject to exist in the exact generation capability set and
  every citation to exist in its reviewed local-synthetic provenance set.
- Added positive and typed negative tests plus the source, schema, fixture and
  tests to the explicit public staging manifest.

## Check

| Gate | Result |
|---|---:|
| TypeScript lint and build | pass |
| Explain contract tests | 6/6 pass |
| Focused HMI contract set including post-explain audit | 31/31 pass |
| Full repository tests | 280/280 pass |
| Rights, routes and write targets | 0/0/0 |

## Act

Accept the metric at 1/1 as `IMPLEMENTED_LOCAL_SYNTHETIC`. The explain payload
can no longer cite a merely well-formed but undeclared source, widen its mapped
subject, substitute a generation or introduce ambient authority.

Conservative assumption: every explanation needs at least one citation from
the exact accepted generation and may cite no more than the mapped reference
ceiling. Risk: a reviewed UX may later need a multi-generation evidence graph.
Fallback: revert this additive contract/schema/fixture/test set and keep
HMI-001 through HMI-006 unchanged. Review marker: the first reviewed
multi-generation explanation, non-synthetic source class or live harness.

Claim boundary: local deterministic synthetic contract evidence only. It does
not prove source truth, live harness compatibility, live Azure or OBO behavior,
customer-data fitness, hostile-host isolation or production readiness.
