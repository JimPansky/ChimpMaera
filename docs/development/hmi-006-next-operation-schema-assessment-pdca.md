# HMI-006 next operation schema assessment PDCA

Status: assessed and verified locally against synthetic contracts and fixtures;
no operation contract was added, activated, released or proven production-ready.

## Plan

Assess exactly one next operation-specific contract for issue #42 after the
cross-contract consistency audit. Select only an operation whose gap is
explicit in the issue, whose positive inputs already exist locally, and whose
effect boundary can remain authority-free. Keep implementation, combined
dispatch, live harnesses, plugins, routes, credentials and runtime activation
outside this assessment slice.

Acceptance evidence was fixed before assessment:

- compare all five operations that still lack a specific payload contract;
- require direct issue-scope support and at least one existing golden fixture;
- reject an operation when the current generation lacks the capability,
  validator or route needed to express it honestly;
- identify a gap not already closed by the generic adapter or disclosure
  contracts;
- freeze a bounded next-contract outline, risk, fallback and review marker;
- keep all existing focused and repository gates green.

## Do

The assessment selected `explain` as the only evidence-backed next operation.

| Candidate | Local evidence | Decision |
|---|---|---|
| `explain` | Five golden requests; issue #42 explicitly requires cited read-only explain behavior; the generation contains `cm:describe-system` and one reviewed synthetic provenance source | Select |
| `plan` | Three golden requests, but the generation contains no `PLAN_ONLY` capability | Defer |
| `validate` | Three golden requests, but `validatorIds` is empty | Defer |
| `handoff` | Two golden requests, but routes are empty and the fixtures describe unavailability | Defer |
| `contribute` | Two golden requests, but contribution/publication is explicitly outside the local authority boundary | Defer |

The generic adapter already binds `explain` to the request and immutable
generation. The generic disclosure projector constrains tiers, public-safe
content, limits and source-ID grammar, but it does not prove that a cited
source belongs to the accepted generation. This is a meaningful local gap:
an `explain` payload can currently cite a syntactically valid but undeclared
source identifier.

Freeze the next source slice as one closed explain payload contract with:

- exact `explain` operation, request-digest and generation-digest binding;
- subject capability IDs equal to the mapped selector set;
- cited source IDs limited to the verified generation provenance set;
- explicit `CITATIONS_REQUIRED` and `LOCAL_SYNTHETIC` markers;
- empty requested-rights, route-ID and write-target arrays;
- deterministic canonical bytes and typed fail-closed negatives; and
- no transport metadata, raw source content, selected-input expansion,
  dispatcher, route or execution behavior.

## Check

The selection is locally reachable because the accepted generation, adapter
mapping, disclosure projector, five explain fixtures and public issue scope are
all present in the repository or public issue record. No tenant, cloud,
runtime or private evidence is required to define and test this contract.

| Gate | Result |
|---|---:|
| TypeScript lint and build | pass |
| Focused HMI core, adapter, disclosure and discover tests | 22/22 pass |
| Existing explain golden requests inspected | 5/5 |
| Complete repository tests | 271/271 pass |
| Supply-chain declaration verification | pass |
| Release-governance verification | pass |

The assessment changes no executable contract and therefore introduces no new
production or release claim.

## Act

Accept the assessment metric at 1/1 as `ASSESSED_LOCAL_SYNTHETIC` and advance
to one `explain` payload contract slice.

Conservative assumption: an explanation may cite only provenance declared by
the exact verified generation, and its subject capability set must equal the
mapped selectors. Risk: a reviewed UX may later require a cited subset spanning
multiple accepted generations. Fallback: omit or revert the additive explain
contract while retaining HMI-001 through HMI-005 unchanged. Review marker: the
first multi-generation explanation, reviewed subset semantics, non-synthetic
source class or live harness proposal.

A generic six-operation payload dispatcher was consciously rejected because
the other operations lack honest local capability, validator, route or
publication evidence and would widen WIP beyond one operation.

Claim boundary: local deterministic synthetic assessment only. It does not
prove live harness compatibility, source truth, hostile-host isolation,
operational durability, release status or production readiness.
