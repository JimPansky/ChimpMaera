# PPREAD-001 authority-free Power Platform read connector PDCA

Status: implemented and verified locally with synthetic contracts; not
imported, registered, consented, deployed, activated, certified or
production-ready.

## Plan

Implement the first bounded read-only connector slice for issue #33: one
closed Power Platform custom-connector contract exposing exactly
`ListCapabilities`, `SubmitGovernedQuery`, `GetOperationStatus`,
`GetReadback` and `GetReceipt`. Bind the surface to the existing delegated
Azure identity profile and Verification Fabric tuple without granting rights,
write targets, proposal, approval, execution or cancellation authority.

Acceptance evidence was fixed before implementation:

- canonical contract digest across 100 object-key reorderings: 100/100;
- exactly five named operations and no generic invocation, target, URL,
  command, method or schema escape;
- exact delegated scope parity with the verified Azure identity profile and
  zero application roles;
- operation acceptance remains distinct from business success;
- authoritative readback and a bound receipt remain mandatory;
- zero requested rights, write targets and write operations; and
- embedded, ambient, stored and dynamically selected credentials denied.

## Do

- Added a closed TypeScript contract, canonical digest and pure verifier.
- Added a Draft 2020-12 JSON Schema and one public-safe synthetic fixture.
- Added eleven table-driven negative cases for open server selection, broad
  scope, mutation/method escape, generic invocation, write targets, false
  success, optional readback, Verification Fabric drift and credentials.
- Added identity substitution, digest-forgery and compatibility probes.
- Added the source, schema, fixtures and test to the public staging manifest.

## Check

| Gate | Result |
|---|---:|
| Focused connector tests | 4/4 pass |
| Canonical reorder trials | 100/100 pass |
| Declared adversarial matrix | 11/11 deny with expected typed reason |
| Identity, digest and compatibility probes | 3/3 deny |
| Closed operation surface | 5 allowed, 0 write operations |
| Requested rights / write targets | 0/0 |
| Full repository tests | 254/254 pass |
| TypeScript lint | pass |
| Supply-chain declaration verification | pass |
| Release-governance verification | pass |
| Isolated local public-stage build | 1/1 pass |

## Act

This slice freezes the locally reachable read-only connector boundary. The
conservative assumption is that `SubmitGovernedQuery` is a logically read-only
POST which requires an idempotency key and returns only an operation reference;
it does not count as a business write or success. Risk: an authorized sandbox
import may require a reviewed connector-specific representation change.
Fallback: remove this additive module/schema/fixture set; no tenant, route,
credential or authority was activated. Review marker: first tenant sandbox
import, OpenAPI export parity, OAuth consent, DLP behavior, live Gateway
compatibility, scope change or operation-set change.

Next source frontier: inspect the planned harness multi-tool adapter parity
slice and select its smallest closed local contract gate. Tenant import,
connector activation and issue mutation were consciously rejected because
they are externally effective and unnecessary for local contract evidence.

Claim boundary: local deterministic contract evidence only. It does not prove
Power Platform import behavior, tenant compatibility, Microsoft Entra consent,
DLP, generated client behavior, Gateway integration, operational durability,
security certification or production compatibility.
