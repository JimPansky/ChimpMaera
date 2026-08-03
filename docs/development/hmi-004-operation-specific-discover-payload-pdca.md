# HMI-004 operation-specific discover payload contract PDCA

Status: implemented and verified locally with synthetic fixtures; not installed,
activated, released or production-ready.

## Plan

Implement one bounded follow-on slice for issue #42: close the generic HMI
adapter's first operation-specific payload gap for `discover`. Bind the payload
to an already mapped request and immutable generation, constrain discovery to
finite inactive capability descriptions, and preserve zero authority. Keep the
other five operation schemas, a combined dispatcher, live harnesses, plugins,
routes, credentials and runtime activation outside this slice.

Acceptance evidence was fixed before implementation:

- one public Draft 2020-12 schema accepts the exact synthetic fixture;
- only an already mapped `discover` request can be accepted;
- request and generation digests must match the adapter mapping;
- capability filters must exactly match the mapped selectors;
- effect classes, lifecycle and evidence status remain finite;
- requested rights, route IDs and write targets remain empty;
- canonical bytes exclude transport metadata and remain deterministic; and
- schema, binding, operation, filter and authority drift deny with typed reasons.

## Do

- Added a closed `chimpmaera.hmi/discover-payload/v1` TypeScript and JSON
  Schema contract.
- Added a pure validator that digest-binds the payload to the mapped request
  and generation, canonicalizes finite filter arrays and returns a payload
  digest.
- Required `DESCRIBED_INACTIVE` lifecycle and `LOCAL_SYNTHETIC` evidence;
  allowed only the three existing authority-free effect classes.
- Bound capability filters exactly to adapter selectors so payload input cannot
  silently widen discovery scope after request mapping.
- Added the source, schema, fixture and test to the public staging manifest and
  the test to the complete repository test command.

## Check

| Gate | Result |
|---|---:|
| TypeScript lint | pass |
| Focused HMI core, adapter, disclosure and discover tests | 20/20 pass |
| New HMI-004 contract tests | 5/5 pass |
| Full repository tests after manifest correction | 269/269 pass |
| Supply-chain declaration verification | pass |
| Release-governance verification | pass |
| Isolated local public-stage build | 1/1 pass, 315 files |

The first complete repository run passed 268/269 and correctly failed closed
because the new positive fixture was not yet declared in the explicit public
manifest. Adding that single allow-list entry made the repeated run pass
269/269. An extra manual staging probe first used a basename outside the
release naming contract and produced no stage; repeating it with a conforming
basename produced the 315-file isolated stage above.

## Act

Accept this slice as `IMPLEMENTED_LOCAL_SYNTHETIC`. The checkpointed metric is
complete at 1/1: `discover` now has one operation-specific, adapter-bound,
authority-free payload schema with positive and negative local evidence.

Conservative assumption: discover payload capability IDs must equal the mapped
selectors exactly, including an empty set, and discovery remains limited to
inactive locally described capabilities. Risk: a reviewed UX may later need a
distinct subset or catalogue-query representation. Fallback: revert this
additive module/schema/fixture/test set and retain HMI-M1 through HMI-M3
unchanged. Review marker: the first reviewed selector semantics, another
operation schema, compatibility change, non-synthetic evidence class or live
harness proposal.

Next frontier: perform the bounded issue-42 HMI consistency audit across the
four local contracts before extending any other operation schema. A combined
six-operation dispatcher was consciously rejected because it would widen this
single-source slice and could hide operation-specific binding gaps behind one
generic abstraction.

Claim boundary: local deterministic synthetic contract evidence only. It does
not prove live harness compatibility, complete catalogue semantics,
hostile-host isolation, operational durability, release status or production
readiness.
