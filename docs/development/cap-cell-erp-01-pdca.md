# CAP-CELL-ERP-01 Issue #63 slice — PDCA / autonomous decision record

Status: implemented for isolated local review. No external effect, provider,
tenant, credential, activation, release, issue or pull-request mutation is
authorized by this slice.

## Plan

Implement only the legacy Issue #63 80% slice: `erp.order.create` v1 across
exactly two synthetic semantically compatible bindings, with the same
consumer/core, exact profile replacement, effective-rights diff, fail-closed
semantic mismatch and replay, readback, receipt, rollback, deterministic
double-run evidence and zero residue.

Reuse decisions:

- bind the existing `erp.order.create` entry and digest from the inactive
  Capability Cell catalogue;
- use digest-bound exact replacement and LKG rollback semantics from
  INT-PROFILE-001, without widening its intentionally read-only v1 variants;
- retain the ADB pattern of one target-neutral core and consumer across two
  data-bound provider contracts;
- keep all effects in scoped synthetic memory with network disabled.

## Autonomous assumptions and controls

| Decision | Conservative assumption | Risk | Fallback | Review marker |
|---|---|---|---|---|
| Semantic equivalence | Both fixtures mean a discrete `EACH` quantity and create/readback/compensate lifecycle only. | A real ERP may interpret order, quantity, cancellation or accounting state differently. | Deny any semantic/profile drift; remove the additive slice while the catalogue remains unchanged. | Any real provider, base-unit conversion, tax, price, ledger posting or fulfillment behavior. |
| Rollback proof | Compensating deletion/cancellation is sufficient only for an ephemeral synthetic order proof. | It could be mistaken for a generally reversible posted order. | Preserve the explicit synthetic claim boundary and require zero provider-state drift. | Any durable, posted or externally visible order. |
| Profile lifecycle | The first generated profile is the local LKG and replacement requires exact old/new digests. | Future profile majors may not be compatible. | Reject the switch and retain the LKG; reset restores it. | Contract major, action digest or semantic ID changes. |
| Replay | A consumed request ID is denied, even after successful compensation, until scoped reset. | A caller expecting idempotent same-receipt replay will be rejected. | Caller supplies a new exact request ID; do not weaken duplicate prevention silently. | Requirement changes from denial to idempotent readback. |
| Evidence | Deterministic receipts and detached receipt digests are sufficient for this local test slice. | In-memory state is not crash-durable evidence. | Make no durability/production claim; a durable store requires a separate approved slice. | Persistence, concurrency, process crash or recovery scope. |

All choices are reversible additions in this isolated worktree. The root has
no applicable `AGENTS.md`; the three such files are demo-workspace fixtures.
No gateway, vLLM or OpenClaw infrastructure is read or changed.

## Do

- Added a closed ERP profile schema and a catalogue-bound runtime evaluator.
- Added two generated, byte-different provider schemas/mappings with one
  frozen semantic contract.
- Added a target-neutral in-memory core and one consumer function.
- Added exact switch/rollback receipts, sorted rights diff, deterministic
  effect/readback receipts, consumed replay denial and scoped reset.
- Added focused positive, negative, double-run and leak tests plus public
  bounded documentation.

## Check

Final command evidence is recorded in the task handoff. Required local checks
include the focused test, TypeScript build/lint, relevant pre-existing
catalogue/integration-profile/ADB tests, repository test suite where practical,
`git diff --check`, and secret/private-path/external-call scans over changed
files.

## Act

Rollback is deletion of this additive source, schema, tests and documentation,
plus its export/package test entry. The pre-existing catalogue, integration
profiles, ADB harness and authority behavior remain untouched.

Non-claims: no live ERP/provider, migration, arbitrary provider/accounting
equivalence, L4, external calls, production support, crash durability,
concurrency proof, tenant isolation, credential handling or deployment.
