# AZX-003 Azure identity scope normalization PDCA

Status: implemented and verified locally with deterministic synthetic
contracts; not registered, consented, imported, deployed, activated or proven
against a Microsoft tenant.

## Plan

Apply the scope policy selected after the AZX-001 cross-contract assessment as
one coordinated migration. The issue #33 authority-free read connector has one
closed five-operation surface, so its identity profile, connector contract,
schemas, fixtures and canonical digests must all require exactly one delegated
scope: `cm.discovery.read`. `cm.operator.read` remains reserved for a future,
separate administrative-read profile and is not valid on this connector.

Acceptance evidence was fixed before implementation:

- profile, connector, both schemas and both positive fixtures agree on the
  exact one-scope tuple;
- all five operations use `cm.discovery.read`;
- regenerated profile and connector digests verify independently;
- explicit operator-scope drift at the profile, connector binding or operation
  layer denies with the expected typed reason;
- existing authority, lifecycle, tenancy and credential boundaries remain
  unchanged; and
- the full repository, lint, supply-chain and release-governance gates pass.

This metric is locally reachable because all affected values are finite,
versioned contract inputs to pure local verifiers. Tenant behavior is not
needed to establish internal scope consistency, but remains necessary before
any compatibility or production claim.

## Do

- Narrowed the Azure profile type and verifier to the exact tuple
  `["cm.discovery.read"]`.
- Narrowed the Power Platform identity binding and all five operation records
  to `cm.discovery.read`.
- Applied the same constants to both Draft 2020-12 schemas and positive
  fixtures.
- Regenerated and rebound the profile digest
  `e46d524fc32e550db3c94d848c78737bbcef1ca0ddc1ddfb3cc349ed2bc66fae`
  and connector digest
  `71805da9cf453748dbde0917bcf5477a90fa5aca828fe9d8c30d88de6c758830`.
- Added three operator-scope negative probes across the profile, connector
  identity binding and connector operation mapping.
- Advanced the package candidate to `0.2.0-poc.20260803.5` because the public
  contract bytes and meaningful behavior changed.

## Check

| Gate | Result |
|---|---:|
| Focused profile and connector tests | 8/8 pass |
| Canonical reorder trials | 200/200 pass |
| Azure negative matrix | 13/13 expected denials |
| Connector negative matrix | 13/13 expected denials |
| Positive delegated scope set | exactly `cm.discovery.read` |
| Positive canonical digests | 2/2 independently match |
| Full repository tests | 304/304 pass |
| TypeScript lint | pass |
| Supply-chain declaration verification | pass |
| Release-governance verification | pass |
| Repository release-tree checksums | 391/391 pass |
| Isolated public-stage build | pass |
| Requested rights / routes / write targets | 0/0/0 |

## Act

Accept the normalization metric at 1/1 as
`AZURE_IDENTITY_SCOPE_SEMANTICS_NORMALIZED_LOCAL`. The increment is coherent
and changes packaged contract bytes, so its next gate is normal PR-governed
delivery and a regular Latest release built from the exact merge commit.

Conservative assumption: the first read connector uses one delegated entry
scope for its exact five-operation surface, while administrative health,
compatibility and revocation views require a later distinct profile. Risk: a
sandbox may show that governed query or evidence readback requires a distinct
non-administrative scope. Fallback: revert this bounded migration or introduce
a separately reviewed versioned scope without granting authority. Review
marker: first tenant registration, consent, connector import, live-token
validation or operation-set change.

Starting the GitHub Pages visibility slice was consciously rejected because
the ordered frontier and WIP=1 require this normalization to complete first.
Tenant registration, consent and connector import were also rejected because
they are externally effective and unnecessary for local contract evidence.

Claim boundary: local deterministic synthetic contract evidence only. It does
not prove Microsoft Entra, Power Platform, tenant, consent, Conditional
Access, DLP, generated-client, network, runtime, operational durability,
security certification or production readiness.
