# OPENCLAW-M1.5 issue #8 — adversarial evidence closure

Date: 2026-08-09

Baseline: `3eb78a1ca74420923abfd8a705c40c3ba15732c8`

This L3 slice adds no runtime authority. It binds the existing default-off
OPENCLAW-M1.1–M1.4 containment, identity, state, reset, recovery and canonical
broker controls into one sanitized deterministic adversarial matrix.

## Evidence architecture

`tests/fixtures/openclaw-m1.5/adversarial-matrix-v1.json` contains 17 synthetic
probe identifiers and exact structured outcomes. The runner executes production
identity, broker, effect-state and mind-state APIs plus declared runtime posture;
it does not search source text. The evidence index
maps supported claims to those identifiers, records limitations and enumerates
the required non-claims. Its verifier rejects missing or inconsistent data,
incomplete coverage, false commit binding, broad security language and common
private-path or credential material.

The tracked index is deliberately `PRE_COMMIT_NON_FINAL` and has no tested
commit. `npm run openclaw-m1.5:evidence` executes the authoritative runner and
derives its 17/17 pre-commit result. After the final commit, the
owner runs `npm run openclaw-m1.5:evidence -- --finalize` on a clean worktree.
That command re-executes and parses the closed machine result, requires every
observation to equal its matrix expectation, binds the output object, byte
length and digest, resolves the real Git `HEAD`, and refuses dirty, failed,
malformed or mismatched execution. Never edit its PR_READY output to invent a commit.

## Acceptance map

- Containment: `NET-01`, `RUNTIME-01`, `FX-01` and `ID-01` cover direct network,
  declared filesystem/credential/device/socket posture, unmanaged effects and malformed input.
- Tenant isolation: `TEN-01`–`TEN-04` execute mind read/write/reset, receipt
  read/retry and reserved/committed recovery swaps. Own and foreign effect,
  receipt, reservation or committed/readback records are embedded in the same
  narrow durable partition store traversed by the harness. Both partitions are
  byte-compared, and deliberate foreign-record mutation proves the comparator fails.
- Determinism: identity/schema, stale policy/state, replay, duplicates, timeout,
  restart, quota and partial failure are bound by `STALE-01`, `REPLAY-01`,
  `TIME-01` and `FAIL-01`–`FAIL-03`. Those failure probes traverse embedded
  effect/reservation/commit partitions or the actual broker receipt map, assert
  expected own-partition mutation, preserve the foreign record bytes, and prove
  a deliberate foreign mutation is detected.
- Reset/recovery: `RESET-01` binds interrupted prepare, recovery-once, replay and
  embedded foreign mind-canary byte preservation, including a mutation-sensitive comparator.
- Evidence honesty: `EVD-01` rejects missing evidence, altered claims/non-claims,
  duplicates, unknown fields and changed expected receipt/readback; `NC-01`
  binds the exact nine-item non-claim set.

## Boundaries and rollback

This is local synthetic and static/deterministic evidence. It is not an
independent audit, universal sandbox, hostile-host or production multi-tenant
proof, availability guarantee, certification, live credential/provider or
infrastructure claim, activation claim, current image/CVE/SBOM claim, or raw
vulnerability disclosure. No Docker smoke is run or claimed.

Rollback is deletion or reversion of this slice. Runtime and synthetic state
contracts are unchanged; the existing ownership-scoped reset remains the only
runtime cleanup mechanism.
