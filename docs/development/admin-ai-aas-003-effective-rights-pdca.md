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

Pending implementation.

## Check

Metric: `aas_003_effective_rights_gates` **0/4 — in progress**.

## Act

Pending post-check frontier audit and reprioritization.
