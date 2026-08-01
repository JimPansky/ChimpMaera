# AAS-002 policy generation fence — PDCA record

Date: 2026-08-01
Branch: `feat/admin-ai-aas-002-policy-generation-fence`
Starting checkpoint: `1d526f2daab618c036b5239388c0d67a07df05a1`
Work item: `AAS-002` — Policy self-protection and generation fence
Initial metric: **0/4**

## Plan — maturity review before implementation

The current runtime pins one Policy file digest at startup and includes that
digest in decisions. It has no durable activation record, no authenticated
monotonic activation transition, and the AUTO_GRANT use-time authority omits
the Policy generation. A worker that retained a valid old generation could
therefore reach a gate configured only with the same Policy bytes. This slice
closes that local lifecycle and use-time gap without expanding Policy rights.

The four completion gates are:

1. **Authenticated activation:** an exact-schema candidate is bound to its
   source bytes, semantic digest, tenant, Policy ID and safe integer generation;
   only a local Owner-authorized activation may persist it, and generations are
   strictly monotonic.
2. **Durable safe state:** the activation record is atomically persisted and
   authenticated, survives restart, retains an explicit last-known-safe
   snapshot, and freezes rather than silently dispatching through a fallback.
3. **Decision/use fence:** Policy ID, generation and source digest are bound at
   evaluation, decision, AUTO_GRANT authority validation and provider use; an
   old worker is denied before provider access.
4. **Adversarial/regression evidence:** the exact negative matrix and relevant
   focused/full tests pass from frozen bytes with durable machine-readable
   evidence and an honest local-only verdict.

### Exact acceptance tests

- Activate generation 1 with a valid local Owner authorization, reload the
  record, and recover the identical active Policy/generation/digests.
- Activate a schema-compatible generation 2 and retain generation 1 as the
  explicit last-known-safe snapshot.
- Prove a failed candidate leaves the previous authenticated record byte-for-
  byte unchanged.
- Bind Policy ID/generation/source digest into decisions, AUTO_GRANT authority
  and receipts; a current generation executes once and remains idempotent.
- Freeze dispatch with an explicit last-known-safe target when convergence is
  lost; no provider access is possible while frozen.

### Exact negative probes

- Missing/Agent-authored or invalid Owner authorization.
- Candidate bytes mutated after authorization, including recomputed untrusted
  source and semantic digests.
- Unknown fields or incompatible Policy/candidate schema.
- Stale generation, duplicate generation, non-safe integer and numeric
  downgrade.
- Wrong tenant or Policy ID.
- Repackaging a previously superseded Policy under a higher generation.
- Activation-record edit, deletion/truncation substitute, or binding mismatch.
- Stale worker authority from generation 1 presented to a generation 2 gate;
  provider mutation and readback counters must both remain zero.
- Authority generation/digest tamper and frozen-dispatch use; provider counters
  must remain zero.

### Conservative local assumption

- **Purpose:** model the owner-only activation boundary without a live signer.
- **Assumption:** a purpose-separated local HMAC fixture represents Owner
  authorization; the Agent/runtime effect endpoint never receives that key or
  an activation API.
- **Risk:** a hostile host or same-process key disclosure can forge or replace
  local state.
- **Fallback:** retain the last authenticated generation and freeze dispatch;
  reverting this slice keeps the previous digest-pinned static Policy behavior.
- **Review marker:** replace the fixture with an independently managed trust
  root before any production activation claim (`AAS-017`/`AAS-011`).

### Rollback boundary

Revert the AAS-002 implementation commit, disable Policy activation, restore
the last verified manifest digest/generation, and leave dispatch frozen if
workers cannot converge. Never reinterpret an older or unverified Policy as a
new generation merely to recover availability.

### Honest non-claims

This can prove deterministic local schema, digest, HMAC, persistence and
generation fencing against synthetic fixtures. It is not a production signer,
HSM, hostile-host, rollback-resistant storage, distributed-consensus, live
tenant/IAM, provider compatibility, release or deployment claim.

## Do

Implemented an exact-schema Policy activation candidate and purpose-separated
local Owner-HMAC authorization. `PolicyGenerationFence` authenticates and
atomically persists the active and last-known-safe snapshots, rejects stale,
duplicate and retired-byte reuse, reloads the record at use time and persists
an explicit frozen dispatch state. The runtime bootstraps the pinned local
generation without exposing an Agent activation endpoint.

The Admin-AI decision schema and AUTO_GRANT/Owner authorities now bind Policy
ID, generation and source digest through decision, proposal, lease, effect gate
and receipt. The effect gate checks the durable activation record before any
provider call. Public architecture/non-claims, runtime closure, installer
generation input, supply-chain closure and checksums were updated.

## Check

The four AAS-002 tests cover valid activation/restart/upgrade, unsigned and
Agent-authored activation, exact-schema errors, mutated and recomputed bytes,
wrong tenant/Policy, stale/duplicate/non-safe generations, retired-byte
downgrade, record edit/deletion, stale workers, current effects and frozen
dispatch. All provider counters remain zero for use-time negative probes.

Related focused tests passed **22/22** and the complete suite passed **80/80**.
Video reference tests passed **15/15**, all **122/122** public checksums passed,
and the six-check supply-chain verifier passed. The single post-freeze
`SAFE_DEMO_COLD-01` run passed `READY_VERIFIED` in **72,840 ms**, including the
approval execute/reject/replay matrix; its dedicated containers, volumes,
networks, image and state were then purged with zero owned residue.

The public-tree probe exposed one new defect class: the release builder treated
the root `.git` control file of the mandated isolated worktree as publishable
source. Commit `8d58bed570038a4ba2068d6aa728a9190dffc763` ignores only that Git control
file and adds an executable worktree-build regression. The final deterministic
public archive built successfully with digest
`d5b64d7c0f2cd62ab0af57ed831a992cb99e03b50fb374729031cbd0d8d1e4f3`.
No second install smoke was run: that correction changes release staging and
its test only, not installer/runtime bytes exercised by the successful smoke.

Metric: `aas_002_policy_generation_fence_gates` **4/4 — complete**. Verdict:
`LOCAL_AAS_002_PASS_NOT_PRODUCTION_SIGNER_OR_DISTRIBUTED_ROLLOUT_CLAIM`.

## Act

Close AAS-002 without reopening AAS-001. The frontier audit found no new
standalone gap: production signing and management-plane separation remain in
AAS-017/AAS-011. Under importance-first ordering, select AAS-003 next (P0/I5,
M) to compile and render the effective-rights intersection and denial facts.
Push, PR, merge, tag, release, live-provider and production actions remain
Owner-gated.
