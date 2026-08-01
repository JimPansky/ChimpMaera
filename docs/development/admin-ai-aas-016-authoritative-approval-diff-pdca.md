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

## Do

Removed the constant business Diff from the Admin-AI decision contract. The
Approval Workbench now obtains an exact bounded Dolibarr snapshot, validates a
closed schema and derives the displayed Diff from it. The proposal binds the
snapshot digest/version, requester, purpose, complete material fields,
data/budget/side-effect impacts, rollback boundary and active Policy. A target
that already exists is refused instead of being presented as absent.

The Workbench re-reads the snapshot before either Approve or Reject and blocks
parallel decisions for one proposal. The enforcement gate verifies all new
lease bindings, rejects a consumed lease before another provider read, re-reads
fresh state, repeats durable replay checks after that asynchronous read, then
reserves the one-use lease before mutation. Decision and effect receipts retain
the snapshot evidence. Runtime-image/public closure, installer cache identity,
the live smoke and public documentation were updated.

## Check

The four dedicated AAS-016 gates passed **4/4**. Closed-schema probes rejected
hidden, truncated, unknown and overbroad snapshots. The golden flow proved the
snapshot-derived display and every declared binding. State drift at approval
and use denied before mutation or reservation. Rapid decisions, actor/Policy
drift, approve-after-reject, lease replay, tampered snapshot bindings and the
existing expiry/readback/restart matrix all failed closed.

The first cold smoke installed successfully but exposed a distinct live-path
defect: after the successful effect changed provider state, the replay request
performed freshness before the durable consumed-lease check and returned the
wrong denial. Moving the replay check ahead of provider access then exposed an
asynchronous race in which two callers could pass before the snapshot read
yielded. The correcting bytes now check replay both before and after that read;
the regression proves a concurrent caller denies while one mutation proceeds.
This real correction justified the second and final cold run.

Final validation passed: focused AAS-016 **4/4**, complete suite **91/91**,
video reference tests **15/15**, public checksums **127/127** and supply-chain
checks **6/6**. The deterministic public archive digest is
`f6697eb5dfc735921bdd92431f435e4b4c544067741c89a9ce66c18e330a8fbe`.
`SAFE_DEMO_COLD-02` passed `READY_VERIFIED` in **66,430 ms**; its Approval
Workbench smoke approved/read back exactly one order, denied Reject and denied
replay with `AUTHORITY_LEASE_REPLAY_DENIED`. Owned containers, volumes,
networks, image and generated state were then purged with zero owned residue.

Metric: `aas_016_authoritative_approval_diff_gates` **4/4 — complete**.
Verdict:
`LOCAL_AAS_016_PASS_NOT_PROVIDER_TRANSACTION_OR_PRODUCTION_APPROVAL_CLAIM`.

## Act

Close AAS-016 without reopening completed AAS-001/AAS-002/AAS-003/AAS-009.
The frontier audit rechecked transactional effect mediation, requester and
approver identity, tenant/data-purpose isolation, Policy lifecycle, audit
causality, compensation and external claim boundaries. No distinct uncovered
internal item was found: production identity/routing remains AAS-007,
transactional effect mediation AAS-008, tenant isolation AAS-010, Policy
lifecycle AAS-017, audit AAS-023 and compensation AAS-022. Real provider
ETag/transaction, MFA/quorum and anti-clickjacking evidence remain explicit
external limits of this completed local slice.

Importance-first ordering now selects AAS-012, the highest-ranked internally
ready I4 item after the current material-Diff defect is closed. It can define a
finite inactive-by-default capability/action catalogue without activating any
new runtime authority. Push, PR, merge, tag, release, publication, production,
infrastructure and external-system actions remain Owner-gated.
