# HMI-001 authority-free core and immutable generation PDCA

Status: implemented and verified locally with synthetic fixtures; not released,
installed, activated or production-ready.

## Plan

Implement the first bounded source slice for issue #42: one closed HMI v1
generation schema, a pure in-memory manifest/file verifier, and deterministic
semantic normalization. Keep adapters, lifecycle mutation, skills, tools,
network access, credentials, policy, approval and runtime activation outside
the slice.

Acceptance evidence was fixed before implementation:

- canonical generation digest across 100 object-key reorderings: 100/100;
- manifest and every declared file digest verified;
- unknown, undeclared, mutable, executable, symlink and unsafe-path cases deny;
- capability descriptors bind exact declared capability-file digests;
- requested rights, routes and write targets: 0; and
- supplied fixture mutation: 0.

## Do

- Added `hmi-core.ts` with closed v1 types, NFC semantic normalization,
  canonical response digests, generation digest construction and pure bundle
  verification.
- Added a Draft 2020-12 JSON Schema and one immutable, public-safe synthetic
  generation containing three digest-bound files.
- Added ten table-driven adversarial cases plus forged-manifest, missing-file,
  unbound-capability and Unicode-key-collision probes.
- Added the source, schema, fixtures and tests to the public staging manifest.

## Check

| Gate | Result |
|---|---:|
| Focused HMI tests | 5/5 pass |
| Canonical reorder trials | 100/100 pass |
| Declared adversarial matrix | 10/10 deny with expected typed reason |
| Additional digest/set/capability/Unicode probes | 4/4 deny |
| Rights/routes/write targets in verified result | 0/0/0 |
| Full repository tests | 246/246 pass |
| TypeScript lint | pass |
| Supply-chain declaration verification | pass |
| Release-governance verification | pass |
| Isolated local public-stage build | 1/1 pass |

The first full run correctly failed closed at 245/246 because the new test was
not yet listed in the public staging manifest. After declaring the complete
new file set, the same repository suite passed 246/246, including isolated
public staging.

## Act

This slice completes the locally reachable HMI-M1 core/generation contract.
The conservative assumption is that Wave 0 supports only exact core and
contract version `1.0.0` with local synthetic evidence. Risk: future reviewed
contracts may require a compatible additive field or different generation
layout. Fallback: remove this additive module/schema/fixture set and retain no
assignment or activation. Review marker: any schema change, first harness
adapter, capability-bearing handoff, or live runtime use.

Next source frontier under the product-loop ordering: freeze the shared
authority-free Azure/identity reference contracts consumed by issues #32, #33,
#42, #58 and #60. HMI-M2 adapter parity remains the following local HMI step.
A real OpenClaw/Codex skill installation was consciously rejected because it
would cross the local authority-free evidence boundary.

Claim boundary: local deterministic contract evidence only. It does not prove
live harness compatibility, security certification, operational durability or
production readiness.
