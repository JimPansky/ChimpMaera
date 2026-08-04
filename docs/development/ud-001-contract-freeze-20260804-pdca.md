# UD-001 additive contract freeze — protected-delivery PDCA

Status: released as regular Latest `v0.2.0-poc.20260804.5`; no discovery,
apply, migration, repair or owner-state authority was added.

## Claim boundary

This record supports an authority-free, local-synthetic update, migration and
Doctor contract freeze for issue #59. It proves no discovery, network or
Docker access, apply, migration, repair, pointer write, service mutation,
production readiness, or support commitment.

## Plan

Preserve the already released legacy Update/Doctor v1 bytes and add a new
namespace that closes the acceptance gap in issue #59: explicit Core, Pack,
Adapter, Policy, Schema and Generation axes; immutable compatibility, plan,
receipt and Doctor contracts; deterministic parsing/rendering; exact digest
binding; negative denial and public-safe readback.

Conservative assumption: an additive namespace is the safest way to freeze
the missing semantics without silently revising a released v1 contract. Risk:
a later implementer could treat a validated preview as execution authority.
Fallback: remove the additive files and retain the released check-only v1.
Review marker: require a separate least-privilege and rollback review before
any privileged observer, pointer write, discovery, apply, migration, repair or
runtime activation.

## Do

- Added four closed Draft 2020-12 schemas for the installation lock,
  compatibility profile, immutable plan/receipt and public-safe Doctor report.
- Added a pure deterministic parser, normalizing canonical renderer, exact
  SHA-256 binding and finite reason/exit-code registry.
- Added one positive v1 golden bundle and ten named negative cases spanning
  v2, unknown fields, mutable targets, digest drift, hidden authority,
  unresolved compatibility, execution/mutation claims and disclosure.
- Added a public guide and release-governance byte/evidence mapping.

## Check

- Focused UD-001 suite: **5/5 PASS**, including 100/100 canonical reorderings
  and 10/10 fail-closed negative cases.
- Authoritative suite: **333/333 PASS**, in addition to the secure-default
  pretest at **12/12 PASS**.
- Documentation/Pages suite: **5/5 PASS**; release-governance suite: **28/28
  PASS**; Supply Chain: **6/6 PASS**; root checksums: **PASS**; npm audit:
  **zero vulnerabilities**.
- Protected CI, release assets/hashes and anonymous readback are recorded in
  the autonomous checkpoint after delivery.
- Product PR #112 merged as `6278650170661f1518fbe5fefa94dfe0f4364632`;
  release-identity PR #113 merged as release target
  `cbc81c8da4cf2d995f386854e8def29dbad61c77`.
- Exact release-target Main CI `30880506776`, including Docker/video smoke:
  **PASS**.
- Two exact-source archive builds were byte-identical.
- Regular Latest `v0.2.0-poc.20260804.5`: non-draft/non-prerelease, with a
  1,407,067-byte archive at
  `98151b4bf50533d7de2cecdb05f9119c25705151ec6c32890524ec86b7cd880e`
  and a 137-byte checksum manifest at
  `54f750d6a6aee8cdeede1ceae067df481fa7ad23970226d1ddc41253525ddf27`.
- Anonymous Latest redirect and both asset bytes/hashes: **PASS**.

Issue closure, canonical raw-Main release binding and the single organic
Shadow sample comment remain pending until this release-truth integration
merges. The local sample itself already passed with `FULL_FALLBACK`,
`GRAPH_CHANGED`, authoritative 333/333 and plan digest
`faa023de552802d1fc67b6f70e7a7238dc814b1f710cd94a84c4f99778c6d9d5`.
- The fixture is synthetic and the implementation contains no executor,
  collector, network call, Docker operation or owner-state writer.

## Act

Stop this metric when the protected delivery and issue-truth gates reach
10/10. Record exactly one organic Verification Fabric Shadow sample for the
materially different product merge, not for release-identity or release-truth
maintenance commits. Rejected: mutating the released legacy v1 or adding any
runtime maintenance behavior to this contract-freeze slice.
