# HMI-005 cross-contract consistency audit PDCA

Status: implemented and verified locally with synthetic fixtures; not installed,
activated, released or production-ready.

## Plan

Audit the four issue-42 HMI contracts as one bounded follow-on slice: immutable
generation, harness mapping, progressive disclosure and the operation-specific
`discover` payload. Check that identifiers, set semantics and request ceilings
remain consistent across contract boundaries. Keep another operation schema,
combined dispatch, live harnesses, plugins, routes, credentials and runtime
activation outside this slice.

Acceptance evidence was fixed before implementation:

- selector identifiers use the same closed grammar across adapter and payload;
- selector order cannot alter canonical request bytes or the request digest;
- disclosure cannot exceed mapped findings, references or output-byte limits;
- every new drift probe denies with an existing typed reason;
- the original HMI positive and negative matrices remain green; and
- complete repository, supply-chain and release-governance gates remain green.

## Do

The audit found and closed two locally reachable consistency gaps:

- the adapter accepted a broader selector grammar and preserved caller order,
  although the discover payload treated selectors as canonical capability IDs;
- the disclosure projector used only absolute local ceilings and did not apply
  the stricter limits already bound into the mapped request.

The adapter now accepts the same authority-free identifier grammar used by the
generation and discover contracts and sorts the selector set before hashing.
The disclosure projector now fails closed when supplied findings, unique source
references or exact canonical output bytes exceed the mapped request limits.
No new authority, route, write, transport or execution field was introduced.

## Check

| Gate | Result |
|---|---:|
| TypeScript lint and build | pass |
| Focused HMI core, adapter, disclosure and discover tests | 22/22 pass |
| New selector order/grammar probes | 3/3 pass |
| New mapped findings/references/output-limit probes | 3/3 deny as expected |
| Full repository tests | 271/271 pass |
| Supply-chain declaration verification | pass |
| Release-governance verification | pass |

The focused selector comparison used the same selector set in opposite order
through both synthetic harness envelopes and obtained byte-identical canonical
requests and digests. The disclosure probes independently tightened findings,
reference and output-byte ceilings and received only
`HMI_DISCLOSURE_LIMIT_DENIED`.

## Act

Accept the consistency-audit metric at 1/1 as
`IMPLEMENTED_LOCAL_SYNTHETIC`. The locally implemented HMI contracts now share
one selector grammar and set normalization, and progressive disclosure respects
the exact request limits already admitted by the adapter.

Conservative assumption: selector order is semantically irrelevant and
`maxReferences` bounds unique source identifiers across the complete supplied
disclosure. Risk: a reviewed operation may later define ordered selectors or a
different reference accounting unit. Fallback: revert this commit and retain
the preceding HMI-004 contract set. Review marker: the first reviewed
operation-specific selector semantics, compatibility-version change,
non-synthetic evidence profile or live harness proposal.

Next frontier: assess the next issue-42 operation-specific schema and select
only one bounded contract if local evidence shows a meaningful gap. A generic
six-operation dispatcher was consciously rejected because it would mix the
completed audit with a new source frontier and obscure operation-specific
binding evidence.

Claim boundary: local deterministic synthetic contract evidence only. It does
not prove live harness compatibility, hostile-host isolation, operational
durability, release status or production readiness.
