# HMI-009 post-explain frontier assessment PDCA

Status: assessed locally from public issue scope, synthetic generation data and
golden adapter fixtures; no contribution, route, submission or runtime behavior
was added, activated, released or proven production-ready.

## Plan

Assess exactly one next operation-specific contract after the accepted explain
payload and consistency audit. Compare the four operations without a specific
payload, require direct issue-scope support plus honest local inputs, and select
only a contract that can remain read-only, authority-free and free of external
effects. Keep issue submission, publication, routes, credentials, plugins,
runtime activation and a generic multi-operation dispatcher outside the slice.

Acceptance evidence was fixed before the assessment:

- inspect all remaining `plan`, `validate`, `handoff` and `contribute` golden
  requests;
- require a matching generation capability, validator or route when the
  operation would claim one;
- require requested rights, route IDs and write targets to remain empty;
- select at most one next operation and freeze a bounded contract outline; and
- keep focused HMI and complete repository gates green.

## Do

The fresh public issue readback makes the local boundary explicit: cited
read-only contribute behavior is in scope, while issue submission is non-scope.
The current fixture set contains two contribution-intent requests and an
immutable generation with no rights, routes, write targets or external
dependencies. This supports a preparation-only contribution preflight without
claiming a publication capability.

| Candidate | Local evidence | Decision |
|---|---|---|
| `plan` | Three golden requests, but no `PLAN_ONLY` capability exists | Defer |
| `validate` | Three golden requests, but `validatorIds` is empty and no validation capability exists | Defer |
| `handoff` | Two golden requests, but routes are empty and the fixtures describe unavailability | Defer |
| `contribute` | Two golden requests; public issue scope requires read-only contribute behavior and excludes issue submission | Select preparation-only preflight |

Freeze the next source slice as one closed `contribute` preflight payload with:

- exact `contribute` operation, request-digest, input-digest and immutable
  generation-digest binding;
- a closed preparation-only status and typed reasons for absent contribution
  capability and publication route;
- subject selectors equal to the mapped request, without invented capability;
- only generation-declared public-synthetic provenance references;
- empty requested-rights, route-ID and write-target arrays;
- explicit false submission/publication effects and deterministic canonical
  bytes; and
- fail-closed denial for capability, citation, binding, authority or effect
  widening.

## Check

The selected slice is locally reachable: issue scope, two mapped contribution
fixtures, immutable generation identity, public-synthetic provenance and the
zero-authority boundary are already available. A real publisher, issue API,
tenant, credential, route or runtime is not required to define or verify the
preflight contract.

| Gate | Result |
|---|---:|
| Remaining operation classes assessed | 4/4 |
| Contribution golden requests inspected | 2/2 |
| Current generation rights/routes/write targets | 0/0/0 |
| Focused HMI contract set | 31/31 pass |
| Full repository tests | 280/280 pass |
| TypeScript lint | pass |
| Supply-chain declaration verification | pass |
| Release-governance verification | pass |

## Act

Accept `contribute` preparation-only preflight as the next meaningful issue-42
source frontier after verification. This assessment adds no executable behavior
and makes no release or production claim.

Conservative assumption: read-only contribute behavior may report a bounded,
digest-bound preparation state even when contribution capability and publication
route are absent. Risk: reviewed UX may require a different name or split
preflight from contribution entirely. Fallback: omit the additive preflight
contract while retaining HMI-001 through HMI-008 unchanged. Review marker: the
first reviewed publisher, issue-submission workflow, contribution capability,
publication route, non-synthetic source class or live harness proposal.

A real issue submission was consciously rejected because it is externally
effective and explicitly outside issue scope. A generic four-operation payload
was also rejected because three operations still lack honest local capability,
validator or route evidence.

Claim boundary: local deterministic synthetic assessment only. It does not
prove live harness compatibility, source truth, publication safety, operational
durability, release status or production readiness.
