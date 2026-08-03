# HMI-003 progressive-disclosure safety contract PDCA

Status: implemented and verified locally with synthetic fixtures; not installed,
activated, released or production-ready.

## Plan

Implement one bounded follow-on slice for issue #42: a pure disclosure
projector bound to an already verified HMI adapter request. Freeze monotonic
`SUMMARY`, `DETAIL` and `EVIDENCE` tiers across the six existing HMI
operations. Keep operation-specific payload schemas, live harnesses, skills,
plugins, routes, credentials, authority and runtime activation outside this
slice.

Acceptance evidence was fixed before implementation:

- closed operation-by-tier projection matrix: 18/18;
- only items at or below the requested tier are disclosed;
- the result binds the exact request and generation digests;
- public synthetic classification and local-synthetic claim status are exact;
- evidence-tier items bind at least one source and one evidence digest;
- requested rights, routes and write targets remain empty;
- transport metadata is absent from canonical disclosure bytes; and
- credential, identity, private-path, host-inventory, job identifier,
  provenance, schema and size drift deny without reflecting supplied content.

## Do

- Added a closed v1 disclosure input and output contract with typed denial
  reasons and a fixed local-synthetic claim boundary.
- Added deterministic tier and item ordering, maximum-item projection,
  omitted-item counts, 1 KiB per-item and 16 KiB aggregate input ceilings.
- Bound operation, request digest and generation digest to the successful
  HMI-M2 adapter mapping.
- Added conservative public-safe text denials for credential assignments,
  private-key material, personal email addresses, private user paths,
  credential-bearing URLs, private IPv4 inventory and session/job identifiers.
- Declared the source and test in the public staging manifest; this development
  evidence remains repository-only.

## Check

| Gate | Result |
|---|---:|
| Focused HMI core + adapter + disclosure tests | 15/15 pass |
| Six operations x three disclosure tiers | 18/18 pass |
| Explicit new denial inputs | 15/15 deny with expected typed reason |
| Supplied disclosure mutation | 0 |
| Rights/routes/write targets in published output | 0/0/0 |
| Harness transport fields in canonical disclosure bytes | 0 |
| TypeScript lint | pass |
| Full repository tests | 264/264 pass |
| Supply-chain declaration verification | pass |
| Release-governance verification | pass |
| Isolated local public-stage build | 1/1 pass, 311 files |

The first complete repository run passed 263/264 and correctly failed closed
because the new negative test contained a literal private-path example that
the isolated public-stage scanner forbids. The probe now constructs the same
unsafe input only at test runtime. The unchanged safety behavior and staging
gate then passed in the repeated 264/264 run.

## Act

Accept this slice as `IMPLEMENTED_LOCAL_SYNTHETIC`. It proves deterministic,
monotonic progressive disclosure for the closed synthetic matrix and typed
fail-closed handling for the tested unsafe-content and contract-drift cases.

Conservative assumption: v1 accepts only `PUBLIC_SYNTHETIC` items carrying
`LOCAL_SYNTHETIC` claims, and evidence is disclosed only when it has both a
source identifier and digest. Risk: a reviewed operation may need a stricter
field-level allow-list or a different public identity representation. Fallback:
revert this additive module and retain HMI-M1/M2 unchanged. Review marker: the
first operation-specific payload schema, compatibility change, live harness
proposal, non-synthetic data class or runtime use.

Next frontier: define one closed operation-specific schema contract while
preserving this disclosure projection. A combined six-operation dispatcher was
consciously rejected because it would be a second source slice and would blur
schema evidence with disclosure evidence.

Claim boundary: local deterministic synthetic contract evidence only. It does
not prove complete secret detection, hostile-host isolation, live harness
compatibility, operational durability, release status or production readiness.
