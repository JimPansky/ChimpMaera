# AAS-003 effective rights and permission X-ray — PDCA record

Date: 2026-08-01
Branch: `feat/admin-ai-aas-003-effective-rights`
Starting checkpoint: `a0b7a08999a8d7bfe7e654c05b41c04fa06dd78f`
Work item: `AAS-003` — Effective-rights compiler and permission X-ray
Initial metric: **0/4**

## Plan — maturity review before implementation

The runtime has typed Policy decisions and generation-fenced executable
authority, but no canonical way to intersect the profile, assignment,
capability and runtime-constraint ceilings that explain the actual envelope.
Operators therefore cannot inspect one stable set of machine facts showing why
an action is allowed, escalated or denied. This slice adds a pure local
compiler and a read-only rendering of its exact output. It issues no authority
and does not replace the Policy evaluator or enforcement gate.

The four completion gates are:

1. **Exact typed operands:** profile, assignment, capability and constraint
   inputs have closed schemas, tenant/profile/generation bindings and explicit
   ceilings; missing, unknown, stale or conflicting inputs fail closed.
2. **Canonical intersection:** a deterministic least-permissive compiler
   returns `ALLOW`, `ESCALATE` or `DENY`, all contributing ceilings, stable
   reason facts and a digest; a capability declaration alone never grants.
3. **Permission X-ray parity:** the read-only view renders the canonical
   machine result without recomputing, filtering or weakening it, and parity
   tests prove every restrictive operand and reason is visible.
4. **Adversarial/regression evidence:** the exact negative matrix and relevant
   focused/full tests pass from frozen bytes with machine-readable evidence and
   an honest local-only verdict.

### Exact acceptance tests

- Compile golden synthetic cases for `ALLOW`, `ESCALATE` and `DENY`; assert the
  exact outcome, effective scope, contributing ceilings and ordered reasons.
- Intersect action, resource, field, purpose and effect ceilings rather than
  treating any one operand as sufficient authority.
- Prove semantically identical operand ordering yields identical canonical
  facts and digest, while a material restrictive change changes the digest.
- Render only the compiler result and prove the rendered outcome, digest,
  scope, ceilings and reason facts equal the machine facts exactly.
- Prove compilation and rendering expose no executable authority, credential,
  lease or provider/effect callback.

### Exact negative probes

- Missing profile, assignment, capability or constraint operand.
- Unknown schema fields, operand kinds, actions, resources, fields, purposes,
  effects, decisions or reason shapes.
- Wrong tenant/profile binding; stale or non-safe generations.
- Conflicting duplicate operands or mutually incompatible ceilings.
- Capability present without a matching profile and assignment grant.
- A restrictive operand omitted, reordered to alter meaning, or hidden by the
  view; machine/view disagreement must fail parity validation.
- Empty intersections and explicit deny constraints; neither may escalate into
  implied authority.

### Conservative local assumption

- **Purpose:** prove the intersection and explanation contract before live
  identity or tenant sources exist.
- **Assumption:** exact-schema synthetic fixtures stand in for authenticated
  profile, assignment, capability and constraint snapshots.
- **Risk:** fixture authenticity, freshness and completeness do not establish
  production IAM correctness or authorization completeness.
- **Fallback:** keep the existing Policy evaluator and enforcement gate as the
  only authority path and disable the new compiler/view if parity fails.
- **Review marker:** bind operands to authenticated identity/tenant lifecycle
  sources before production use (`AAS-007`, `AAS-010`, `AAS-017`).

### Rollback boundary

Revert the AAS-003 implementation commit and remove/disable the permission
X-ray surface. Do not relax or reinterpret existing Policy decisions,
generation fences, approval leases or use-time enforcement. A failed or
unavailable X-ray must never authorize an effect.

### Honest non-claims

This can prove deterministic local intersection, fail-closed parsing, digest
stability and machine/view parity against synthetic fixtures. It is not a
production IAM, role-source, tenant-isolation, authorization-completeness,
credential, provider, deployment or external-system claim. `ALLOW` is an
informational effective-rights result, not executable authority.

## Do

Implemented a pure closed-schema effective-rights compiler for exactly one
profile, assignment, capability and constraint operand. It validates tenant,
actor, profile and generation bindings, normalizes input order, intersects
action/resource/field/purpose/effect ceilings, records every contributing
ceiling and reason fact, and digest-binds the informational result. Any schema,
binding, generation, scope, duplicate, explicit-deny or empty-intersection
problem returns DENY. Capability presence alone cannot grant.

Added a permission X-ray renderer with exact result-parity validation and a
GET-only synthetic dashboard endpoint. The browser displays the returned
machine facts without recomputing them. The compiler and view contain no
authority, credential, lease, provider or effect callback. Public architecture,
limitations, demo guidance, release closure and checksums were updated.

## Check

The four AAS-003 tests cover the exact typed negative matrix, golden ALLOW /
ESCALATE / DENY intersections, order-invariant and material-change digests,
machine/view parity, omitted-ceiling and weakened-outcome tamper, capability
alone and disjoint scope. All passed 4/4. The dashboard E2E confirmed the
GET-only X-ray and absence of an authority field.

Related focused tests passed 30/30 and the complete suite passed 84/84. Video
reference tests passed 15/15, all 124/124 public checksums passed, and the
six-check supply-chain verifier passed. The deterministic public archive built
with digest 7f247d1b0f0175f37dab2e4728cc5daa856791214eee2af6cbc26554ee16ed10.

Exactly one post-freeze SAFE_DEMO_COLD-01 run passed READY_VERIFIED in 69,310
ms. Its live X-ray returned informational-only ALLOW with all four operand
ceilings, five reason facts, no issues and result digest
d1e5ac08d38ecd66172e55d64d0a8ad0076dd57b8401dd517493ee38ed071000.
The approval execute/reject/replay matrix also passed. Dedicated containers,
volumes, networks, image and runtime state were purged with zero owned residue.

Metric: aas_003_effective_rights_gates **4/4 — complete**. Verdict:
LOCAL_AAS_003_PASS_NOT_PRODUCTION_IAM_OR_AUTHORIZATION_COMPLETENESS_CLAIM.

## Act

Close AAS-003 without reopening AAS-001 or AAS-002. The frontier audit
rechecked operand authenticity/freshness, tenant binding, scope/catalog
coherence, view parity, authority issuance and simulator dependencies. No new
standalone gap was found: production identity and tenant sources remain
AAS-007/AAS-010/AAS-017, catalogue coherence remains AAS-012 and effect-free
preview remains AAS-013.

Importance-first ordering now selects AAS-009, the next internally ready P0/I5
item, to define trust labels and typed reconstruction against hostile local
content before any live LLM or retrieval path. Push, PR, merge, tag, release,
live-model, production IAM and external-system actions remain Owner-gated.
