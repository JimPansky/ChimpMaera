# HMI-010 authority-free contribute preflight contract PDCA

Status: implemented and verified locally against deterministic synthetic data;
no contribution, issue submission, publication, route, runtime behavior or
external effect was added, executed, released or proven production-ready.

## Plan

Implement exactly the preparation-only `contribute` preflight selected by
HMI-009. Bind the payload to one mapped request, its selected input and one
verified immutable generation. Require an explicit unavailable-capability and
unavailable-route explanation, generation-declared public-synthetic citations,
zero authority and false submission/publication effects.

Acceptance evidence was fixed before implementation:

- accept the exact closed JSON Schema and one checked-in synthetic fixture;
- bind operation, request digest, input digest and generation digest;
- require contribution selectors to remain empty because the generation
  declares no contribution capability;
- require cited source IDs to exist in the verified generation and remain
  within the mapped reference ceiling;
- deny schema, preparation-state, reason, capability, citation, authority and
  effect widening with typed reasons;
- emit deterministic transport-free canonical bytes; and
- keep focused HMI, full repository and governance gates green.

## Do

Added `chimpmaera.hmi/contribute-preflight/v1` as a closed TypeScript and JSON
Schema contract. The accepted payload has `PREPARATION_ONLY` state and exactly
two reasons: `CONTRIBUTION_CAPABILITY_ABSENT` and
`PUBLICATION_ROUTE_ABSENT`. It binds the mapped selected-input digest in
addition to the request and immutable generation digests.

The validator accepts no subject capability because both contribution fixtures
have empty selectors and the verified generation declares no contribution
capability. It accepts only generation-declared citations, three empty authority
arrays and explicit `false` submission/publication effects. Canonical output
contains no harness transport envelope.

The source, schema, fixture and test were added to the explicit public staging
manifest. The first full run correctly failed closed at 286/287 because the new
test source was not yet declared. Adding all four new public artifacts to the
manifest corrected the closure; no verifier was weakened.

## Check

| Gate | Result |
|---|---:|
| HMI-010 contract tests | 7/7 pass |
| Focused HMI contract set | 38/38 pass |
| Full repository tests after manifest correction | 287/287 pass |
| TypeScript lint | pass |
| Supply-chain declaration verification | pass |
| Public-release isolated staging probe | pass |
| Release-governance verification | pass |
| Changed-artifact public-safety scan | pass |
| Rights/routes/write targets | 0/0/0 |
| Submission/publication effects | false/false |

The full-suite correction is evidence that the public closure gate remained
fail-closed. Local tests prove only deterministic contract behavior over the
checked-in synthetic generation and adapter fixtures.

## Act

Accept the issue-42 contribute-preflight metric at 1/1 as
`IMPLEMENTED_LOCAL_SYNTHETIC_NOT_RELEASED`. The next meaningful frontier is one
bounded post-contribute cross-contract consistency assessment; it should verify
binding, citation, selector, authority and effect semantics without expanding
`plan`, `validate`, `handoff`, submission or publication behavior.

Conservative assumption: a preparation-only result belongs to the contribute
surface even when no contribution capability or route exists. Risk: reviewed
UX may rename the surface or separate preflight from contribution. Fallback:
remove the additive HMI-010 source/schema/fixture/test/exports and manifest
entries while retaining HMI-001 through HMI-009 unchanged. Review marker: the
first reviewed publisher, issue-submission workflow, contribution capability,
publication route, non-synthetic source class or live harness proposal.

A real issue submission was consciously rejected because it is externally
effective and outside the local authority boundary. Adding a fake contribution
capability or route was rejected because it would turn absence evidence into an
unsupported product claim.

Claim boundary: local deterministic synthetic contract evidence only. It does
not prove live harness compatibility, source truth, contribution or publication
safety, operational durability, release status or production readiness.
