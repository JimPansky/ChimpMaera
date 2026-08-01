# AAS-012 inactive capability/action catalogue — PDCA record

Date: 2026-08-01  
Branch: `feat/admin-ai-aas-012-inactive-catalogue`  
Starting checkpoint: `501122f855e4d0987896b649d0f93f3e2a6bd64c`  
Work item: `AAS-012` — Capability/action catalogue, inactive by default  
Initial metric: **0/4**

## Plan — maturity review before implementation

The repository has typed synthetic actions and trusted reconstruction, but its
finite vocabulary is embedded in separate contracts. It has no standalone,
digest-bound admission record that exposes an action's adapter version,
provenance evidence, honest non-claims, closed resource/field/path surface and
inactive state. This slice adds that pure local contract. Admission and lookup
remain descriptive only and cannot issue authority, credentials or effects.

The four locally reachable completion gates are:

1. **Finite digest-bound catalogue:** a closed schema validates catalogue and
   adapter identities/versions/digests plus exact action IDs, resources, fields,
   effects and provider paths; normalized content has a stable digest.
2. **Per-action evidence and non-claims:** every admitted action exposes its
   adapter version/digest, local evidence references, compatibility requirements
   and explicit provenance/live-provider non-claims.
3. **Inactive-by-default semantics:** install, admission and exact lookup all
   return inactive descriptive results only; no Policy decision, approval,
   authority, credential handle, provider call or effect path is emitted.
4. **Adversarial/regression evidence:** unknown adapter/action/field/resource/
   path, incompatible version, digest/evidence drift, duplicate entries and any
   active-state claim fail closed; focused and complete local tests pass from
   frozen bytes.

### Exact acceptance tests

- Admit a two-adapter, two-action synthetic catalogue and assert deterministic
  normalization and digest under safe input reordering.
- Show version, digest, evidence, compatibility, closed resources/fields/path,
  inactive state and non-claims for each action.
- Inspect each exact action request and receive only `DESCRIBED_INACTIVE`; prove
  admission and inspection contain no executable authority or secret material.
- Verify the admission/result digest and preserve the existing trusted-action
  and effective-rights behavior in the complete local suite.

### Exact negative probes

- Unknown or duplicate adapter/action; unknown/extra/missing field or resource;
  wrong provider path, method, effect or catalogue/action schema version.
- Adapter version outside the exact compatibility set; malformed or changed
  image/content digest; empty, duplicate or traversal-shaped evidence reference;
  missing or altered honest non-claims.
- Any catalogue/adapter/action state other than `INACTIVE`; injected `enabled`,
  authority, approval, Policy decision, credential, URL, headers or callback.
- Tampered admission/catalogue/result digests and lookups not bound to the
  admitted catalogue fail closed before returning a descriptor.

### Conservative local assumption

- **Purpose:** create the closed Gateway vocabulary prerequisite without
  accidentally granting the future OpenClaw agent runtime ambient authority.
- **Assumption:** exact local fixture versions and SHA-256 digests establish
  deterministic contract behavior, not upstream provenance or availability.
- **Risk:** a syntactically valid catalogue may describe an adapter that is not
  redistributable, reachable, safe or compatible in production.
- **Fallback:** retain no admitted catalogue version and deny every action;
  never infer activation from installation, admission, discovery or lookup.
- **Review marker:** require independently verified image provenance, licence,
  compatibility and an explicit use-time Policy/Authority/Effect path before a
  future activation slice; the OpenClaw Docker frontier consumes only this
  inactive vocabulary.

### Rollback boundary

Revert the additive catalogue module, tests and documentation. All affected
actions remain inactive and the existing embedded synthetic action paths retain
their prior behavior. Do not replace the closed catalogue with dynamic tool
discovery or treat rollback as permission to broaden an existing action.

### Honest non-claims

This can prove deterministic local validation, finite descriptive vocabulary
and inactive fail-closed lookup against synthetic fixtures. It does not prove
live adapter provenance, licence/redistribution compatibility, registry image
integrity, production version support, activation safety, Gateway enforcement,
provider behavior, deployment isolation or executable authority.

## Do

Added a pure contracts module for one catalogue version containing exactly two
synthetic adapters and actions. It validates a closed catalogue, adapter,
action, compatibility, evidence and non-claim schema; canonicalizes unordered
sets; binds the normalized catalogue and every action to SHA-256 digests; and
returns only inactive descriptors. Admission and inspection carry an explicit
`DENY` decision and cannot return executable authority or secret material.

The focused four-gate test was registered in the complete suite and the two new
public contract/test files were added to the bounded public manifest and
repository checksum closure. No demo runtime, provider adapter, installer,
Compose or install-path byte changed.

## Check

All four dedicated AAS-012 gates passed **4/4**. Safe reordering retained one
catalogue digest. Both action descriptors exposed exact versions, digests,
evidence, compatibility, fields/resources/paths and non-claims. Installation-
shaped state injection and every unknown, duplicate, incompatible, open-surface
or tampered probe denied with no descriptor or executable material.

Complete validation passed: focused AAS-012 **4/4**, full suite **95/95**, video
reference **15/15**, checksums **129/129** and supply-chain checks **6/6**. Two
independent public builds were byte-identical at
`8a8f093804aa5d4e663a7648cbedb2125ec8072adbc5b69a1467d193a25435d8`.
The first checksum rewrite accidentally included the worktree `.git` pointer
and then generated Python cache files; the corrected closure excludes control,
dependency, build, development-evidence and generated-cache paths and passed
the affected checks. This changed evidence bytes only and did not justify a
second full suite or an unrelated Docker smoke.

Metric: `aas_012_inactive_catalogue_gates` **4/4 — complete**. Verdict:
`LOCAL_AAS_012_PASS_INACTIVE_DESCRIPTION_NOT_PROVENANCE_ACTIVATION_OR_AUTHORITY_CLAIM`.

## Act

Close AAS-012 without reopening completed controls. The frontier audit rechecked
effect brokerage, runtime limits, untrusted memory, network enforcement,
artifact provenance and boundary-composition assurance. Their reusable control
primitives remain AAS-008/AAS-019/AAS-020/AAS-021/AAS-025/AAS-030.

Owner evidence at 2026-08-01 12:46 CEST establishes a distinct next product
integration gap: no existing item proves that a real pinned OpenClaw agent can
run default-off as an untrusted, zero-ambient-authority, Gateway-only Docker
workload with managed mind state and typed E2E/negative evidence. This is not a
duplicate primitive, so AAS-035 is added and selected ahead of framework/data
breadth. Its provenance/licence/upstream-Docker proof precedes image selection;
unknown provenance fails closed. The currently running owner OpenClaw, Gateway,
vLLM and model infrastructure remain outside scope and untouched.
