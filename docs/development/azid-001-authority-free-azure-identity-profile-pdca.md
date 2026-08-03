# AZID-001 authority-free Azure identity profile PDCA

Status: implemented and verified locally with synthetic configuration; not
registered, consented, imported, deployed, activated or production-ready.

## Plan

Implement the first bounded identity-contract slice for issue #32 and its
shared consumers: one immutable Wave 0 Microsoft Entra profile that describes
single-tenant delegated authentication without granting ChimpMaera authority.
Keep tenant resources, real identifiers, tokens, consent, Conditional Access,
DLP, connectors, routes, provider credentials and runtime activation outside
the slice.

Acceptance evidence was fixed before implementation:

- canonical profile digest across 100 object-key reorderings: 100/100;
- exact Authorization Code + PKCE S256, redirect, state and nonce contract;
- exact single-tenant issuer template and denial of shared authorities,
  request-selected tenants and cross-tenant use;
- issuer, audience, tenant, subject, time and delegated-scope claims required;
- delegated read scopes only, with zero application roles;
- authentication grants no authority, approval or execution and exposes zero
  requested rights, routes or write targets; and
- ambient, embedded and dynamically selected credentials denied.

## Do

- Added a closed TypeScript contract, canonical digest and pure verifier.
- Added a Draft 2020-12 JSON Schema and one public-safe synthetic profile.
- Added twelve table-driven negative cases covering schema, flow, tenancy,
  token validation, broad/application permissions, authority and credentials.
- Added the source, schema, fixtures and test to the public staging manifest.

## Check

| Gate | Result |
|---|---:|
| Focused Azure identity tests | 4/4 pass |
| Canonical reorder trials | 100/100 pass |
| Declared adversarial matrix | 12/12 deny with expected typed reason |
| Digest and compatibility probes | 2/2 deny |
| Requested rights/routes/write targets | 0/0/0 |
| Full repository tests | 250/250 pass |
| TypeScript lint | pass |
| Supply-chain declaration verification | pass |
| Release-governance verification | pass |
| Isolated local public-stage build | 1/1 pass |

## Act

This slice freezes the locally reachable delegated Wave 0 identity boundary.
The conservative assumption is that the first profile supports only a fixed
single-tenant Entra issuer template, Authorization Code + PKCE S256 and the two
declared read scopes. Risk: an authorized sandbox may require a reviewed
issuer/audience variation or a separate workload-identity profile. Fallback:
remove this additive module/schema/fixture set; no identity, route or authority
was activated. Review marker: first tenant sandbox, connector import, workload
identity, scope expansion, OBO flow, live token validation or schema change.

Next source frontier: freeze issue #33's closed read-only connector surface and
bind it to this profile plus the existing Verification Fabric tuple. A tenant
registration or consent flow was consciously rejected because it is externally
effective and unnecessary for local contract evidence.

Claim boundary: local deterministic contract evidence only. It does not prove
Microsoft Entra, tenant, connector, Conditional Access, DLP, network, security
certification, operational durability or production compatibility.
