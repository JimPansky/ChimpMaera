# HMI-008 post-explain cross-contract consistency audit PDCA

Status: audited and verified locally with synthetic fixtures; no dispatcher,
unsupported operation, route, authority or runtime behavior was added.

## Plan

Run one bounded post-explain audit across the generation, adapter, discover and
explain payload contracts. Verify that selector set semantics, immutable
generation binding, mapped reference ceilings and zero-authority invariants
remain consistent. Do not extend `plan`, `validate`, `handoff` or `contribute`.

## Do

The audit added three executable cross-contract probes:

- discover and explain accept the same declared selector set without ordering
  or widening differences;
- both operation payloads bind one immutable generation and emit the same empty
  requested-right, route and write-target boundary; and
- explain rejects a citation set that is within generic syntax but outside the
  exact generated provenance or mapped reference boundary.

No new source behavior was required after these probes. The explain validator's
generation and mapped-limit checks already closed the assessed drift paths.

## Check

| Gate | Result |
|---|---:|
| Post-explain consistency probes | 3/3 pass |
| Focused HMI contract set | 31/31 pass |
| Full repository tests | 280/280 pass |
| Generic dispatcher or unsupported operation additions | 0 |

## Act

Accept the audit metric at 1/1 as `CONSISTENT_LOCAL_SYNTHETIC`. Explain and
discover now share selector-set, generation-binding and zero-authority
semantics, while explain additionally enforces exact generated provenance and
the mapped citation ceiling.

Conservative assumption: capability selectors are unordered contract IDs for
both payloads. Risk: a later reviewed operation could define ordered subjects.
Fallback: retain the explain contract and remove only this additive audit test
if future versioned semantics diverge. Review marker: a contract-version change,
ordered selector semantics, multi-generation evidence or non-synthetic proof.

The generic six-operation dispatcher was rejected because four operation
payloads still lack honest local capability, validator, route or publication
evidence. Claim boundary remains local synthetic proof-of-concept evidence;
there is no production, tenant, OBO, customer or runtime claim.
