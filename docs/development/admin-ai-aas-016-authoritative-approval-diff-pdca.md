# AAS-016 authoritative approval Diff — PDCA record

Date: 2026-08-01  
Branch: `feat/admin-ai-aas-016-authoritative-diff`  
Starting checkpoint: `7f4a947d6c79a6b8712320e2378589fa810d6929`  
Work item: `AAS-016` — Authoritative approval Diff, routing and step-up  
Initial metric: **0/4**

## Plan — maturity review before implementation

The material Admin-AI order path currently displays a constant claim that no
matching order need exist. Approval and use-time enforcement bind that string,
but neither proves that it came from a bounded provider read nor that the state
remained unchanged. This slice replaces that correctness defect with a closed,
synthetic provider snapshot contract, a snapshot-derived Diff, and freshness
checks at proposal registration, owner decision and provider use.

The four locally reachable completion gates are:

1. **Bounded authoritative snapshot:** exact provider, tenant, entity,
   requester, purpose, query, material fields, version and digest are validated;
   incomplete, hidden, truncated or unbounded reads fail closed.
2. **Snapshot-derived display binding:** the proposal displays only a Diff
   derived from the validated snapshot and binds requester, purpose, impacts,
   rollback, Policy, snapshot version/digest and material fields into its digest.
3. **Approval and use-time freshness:** the same bounded read is repeated before
   approval and immediately before reservation/provider mutation; any snapshot,
   version, requester, tenant, Policy, profile or approver drift denies.
4. **Adversarial/regression evidence:** hidden-field, rapid-prompt, same-actor,
   approve-after-reject, replay and stale-state probes deny before mutation;
   focused and full local evidence pass from frozen bytes.

### Exact acceptance tests

- Build a golden bounded snapshot for the exact synthetic Dolibarr customer
  reference and assert its closed fields, stable version and digest.
- Derive the displayed prior state and changed fields from that snapshot; bind
  requester, purpose, data/budget/side-effect impact, rollback, Policy and the
  complete material-field list into the proposal and authority.
- Re-read an identical snapshot at owner approval and at effect use; exactly one
  mutation and semantic readback succeed, with snapshot evidence in receipts.
- Prove a material snapshot change changes the proposal/Diff digest and requires
  a new decision rather than silently refreshing an old proposal.

### Exact negative probes

- Missing/extra snapshot fields; wrong provider, tenant, entity, requester,
  purpose, query or schema; duplicate, unknown, missing, reordered-as-hidden or
  truncated material fields; invalid version/digest.
- State or version drift between display/approval and approval/use, including a
  rapid-prompt race immediately before reservation.
- Requester, tenant, Policy generation/digest, profile generation or approver
  change; the Agent/requester attempting to approve its own proposal.
- Hidden/truncated display fields, tampered snapshot/Diff/impact/rollback data,
  approve after reject, duplicate decision, expired authority and lease replay.

### Conservative local assumption

- **Purpose:** close local material-Diff freshness before production identity,
  provider routing or quorum infrastructure exists.
- **Assumption:** a bounded synthetic Dolibarr list read and a digest-derived
  local version stand in for a provider snapshot/ETag; `owner:local-demo` is a
  separate fixed local approver from `requester:local-demo` and the Agent.
- **Risk:** digest-derived versions and local actors do not establish provider
  transaction isolation, production IAM, MFA, quorum or anti-clickjacking.
- **Fallback:** refuse material approval/effect when any snapshot read or binding
  is unavailable or uncertain; never fall back to the constant Diff.
- **Review marker:** replace the fixture identities/version with authenticated
  production routing and provider ETags before external use (`AAS-007`).

### Rollback boundary

Revert the AAS-016 implementation and disable material approval/effects. Do not
restore the constant/stale Diff as an approval basis, relax the generation
fence, or bypass the existing one-use lease and provider readback checks.

### Honest non-claims

This can prove closed local snapshot parsing, snapshot-derived Diff binding and
two freshness rechecks against deterministic synthetic fixtures. It is not a
real provider ETag/transaction, production identity, MFA, quorum,
anti-clickjacking, multi-tenant, deployment or external-system claim.

