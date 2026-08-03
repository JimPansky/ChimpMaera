# RPP-001 Resource-Plane Profiles & Templates M0 PDCA

Status: released as regular Latest `v0.2.0-poc.20260804.1`; no runtime
activation or host authority change.

## Plan

Compile exactly seven closed planes—filesystem, network, process, Docker,
secrets, models/tools, and devices—through the existing Builder authority
intersection. Support `SAFE_GUIDED`, `CUSTOM`, and the explicit dangerous
`FULL_CONTROL` planning view, emit an Effective-Rights-Diff, and preserve the
claim `DECLARATIVE_RESOURCE_PLANE_PLAN_ONLY_NO_EXECUTION`.

Acceptance evidence was fixed before delivery:

- seven planes present exactly once with closed templates and rights;
- all profiles reuse the same Host/System, assignment, and current-constraint
  ceilings;
- `SAFE_GUIDED` baseline and selected result are digest-bound;
- output schema passes and canonical reordering has zero digest drift;
- missing/duplicate/unknown/cross-plane/hidden inputs fail closed; and
- output contains no executable callback, credential, lease, provider binding,
  authority grant, or runtime activation.

## Do

- Added one pure TypeScript compiler over `resolveBuilderAuthorityV1`.
- Added seven immutable template catalogues and three planning profiles.
- Added per-plane selected decisions and an explicit Effective-Rights-Diff.
- Added a Draft 2020-12 output schema and seven focused tests, including the
  declared negative matrix.
- Added the source, schema, guide, test, and public manifest entries without
  adding a runtime adapter.

## Check

| Gate | Result |
| --- | ---: |
| Focused resource-plane tests | 7/7 pass |
| Seven closed planes | 7/7 exact |
| Profile variants | 3/3 pass |
| Declared negative cases | 11/11 deny |
| Runtime activation / executable authority | 0/0 |
| TypeScript build | pass |
| Full repository tests | 311/311 pass |
| Documentation build/site tests | 5/5 pass |
| Secure-default proof | 12/12 plus verifier pass |
| Supply-chain verification | 6/6 pass |
| Release-governance tests | 25/25 pass |
| Public stage | pass; isolated manifest closure and deterministic archive |

## Act

The conservative assumption is that M0 needs one closed template per plane and
models `FULL_CONTROL` through the existing `FULL_CONTROL_LAB` alias while
remaining purely declarative. Risk: future runtime consumers may require finer
resource selectors or a disclosure-specific effect class. Fallback: remove the
additive module/schema/test/guide set; it has no runtime hook. Review marker:
first runtime-enforcement proposal, new plane/right/effect class, profile
semantic change, or external environment probe.

Runtime activation was consciously rejected: it is unnecessary for contract
evidence and would exceed this slice's authority. The next planned frontier is
the target-neutral ADD→REPLACE benchmark after this source slice completes its
protected integration gate.

Claim boundary: deterministic local plan evidence only; no host, container,
secret, model/tool, device, tenant, provider, security-certification, or
production behavior is proven.

## Delivery evidence

- Feature PR #94 merged as `8d5425b260fce6bcf04078643346e8e65000f7f4`
  after required CI.
- Release-identity PR #96 and security-closure PR #97 merged normally; exact
  release target is `1f98310d4e1a3541adf2619fda5d0cd0efa2dded`.
- The `fast-uri` transitive dependency was updated to 3.1.5 before publication;
  `npm audit` reported zero known vulnerabilities.
- Regular Latest `v0.2.0-poc.20260804.1` is non-draft/non-prerelease with two
  assets. Archive: 1,373,817 bytes,
  `87497985ace1ef7f17760be7e851c10d1065cc1fb2c33fcc6fbfd021b8c507f1`.
  Manifest: 133 bytes,
  `17da3b709f5679a38b96296e9c9627073d3f55aee7967b95cea55c4246d4b765`.
- Two exact-source local archive builds were byte-identical. Anonymous Latest,
  archive, manifest, checksum, and required-content readback all passed.
