# ADB-001 ADD → REPLACE adaptability benchmark M0 PDCA

Status: locally measured and release integration pending. The AI-blind bundle
is prepared but has not been run.

## Plan

Add one thin, target-neutral benchmark around the existing Builder core. The
acceptance metric is one closed M0 result with:

- one ADD scenario from one to two synthetic providers;
- one Provider A → B replacement using an unchanged core and consumer;
- measured cold/warm, edit, LOC, retry, reuse, readback and residue fields;
- verified reversible-write rollback and zero target drift;
- a cross-provider negative probe that fails closed; and
- an AI-blind participant/evaluator split prepared without inventing a result.

Runtime activation, a live provider, tenant, credential, network or customer
record is outside the slice. Local process timing must remain an observation,
not a speed or comparative-performance claim.

## Do

- Added `benchmarks/adaptability-m0/run.mjs` over the unchanged
  `demo/builder-agent/builder-core.mjs` interface.
- Reused the existing habitat-controller and warehouse-lighting synthetic
  runtime contracts as Provider A and Provider B.
- Added a closed Draft 2020-12 result schema and a checked-in 100-sample local
  evidence record.
- Added ADD, REPLACE, same-receipt retry, rollback, readback, reset/residue and
  provider-binding mismatch observations.
- Added an AI-blind participant input plus a retained evaluator. No participant
  was started and the status remains `PREPARED_NOT_RUN`.

## Check

| Gate | Result |
| --- | ---: |
| Focused benchmark tests | 5/5 pass |
| ADD providers | 1 → 2 pass |
| REPLACE unchanged core / consumer | 2/2 pass |
| Readbacks | 4/4 pass |
| Reversible-write rollback | 2/2 pass |
| Same-receipt retries | 4/4 pass |
| Target drift after execution/reset | 0 |
| Receipt/external residue after reset | 0 / 0 |
| Cross-provider negative probes | 1/1 deny as expected |
| Provider-specific core LOC | 0 |
| AI-blind result | not run; no result claimed |

The exact local record contains 100 cold and 100 warm samples per provider.
Provider A observed cold median `0.062959 ms` and warm median `0.015489 ms`;
Provider B observed cold median `0.061816 ms` and warm median `0.014487 ms`.
These numbers describe one local in-process synthetic run only. They are not a
speed claim and are not evidence about integration engineering time or a live
provider.

## Act

Assumption: effect-class selection through the already validated Builder core
is the smallest honest consumer seam for ADD/REPLACE M0. Risk: in-process
contract timings can be mistaken for end-to-end adaptation speed, and the
public AI-blind evaluator could be shown to a future participant. Fallback:
retain the exact synthetic measurement boundary, publish no comparative
conclusion, and run any future blind probe in a clean partition that exposes
only `participant-input.json` plus its named baselines. Review marker: first
isolated AI-blind run, new adapter kind, live-provider attempt, or any change to
the frozen core/consumer digests.

The AI-blind execution was consciously rejected for this run: no clean
participant/evaluator isolation lane was established, while the prepared
bundle is sufficient and explicitly required to remain result-free. The next
action is protected PR integration, required CI and—because this is a coherent
user-visible measured benchmark—normal release governance and anonymous asset
readback.

Claim boundary:
`LOCAL_SYNTHETIC_MEASURED_NO_SPEED_OR_PRODUCTION_CLAIM`.
