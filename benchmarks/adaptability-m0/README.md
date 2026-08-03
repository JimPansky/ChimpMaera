# ADD → REPLACE adaptability benchmark M0

Status: **locally measured synthetic harness; AI-blind bundle prepared, not
run**.

This benchmark reuses the existing byte-identical target-neutral Builder core
to measure two bounded scenarios:

1. **ADD:** keep synthetic Provider A and add synthetic Provider B;
2. **REPLACE:** switch Provider A → B while the consumer and core source
   digests remain unchanged.

The harness performs read, reversible write, authoritative in-memory readback,
same-receipt retry, rollback, semantic reset and a cross-provider negative
probe. It reports observed cold/warm process timings, recursive contract edit
paths, non-blank LOC, retry, reuse, readback, rollback and residue counts.
Timing values are measurements from one local process, not a speed claim or a
comparison with another product.

The checked-in [100-sample local record](records/adb-001-m0-local-20260804.json)
is bound to the exact core and consumer source digests. Re-running the command
creates a new observation; it does not retroactively change that record.

Run it from the repository root:

```bash
node benchmarks/adaptability-m0/run.mjs --samples 30
```

To retain a new evidence record, provide a path that does not already exist:

```bash
node benchmarks/adaptability-m0/run.mjs --samples 100 --output /tmp/adb-result.json
```

## AI-blind preparation boundary

`ai-blind/participant-input.json` is the participant-visible task. In a later
clean isolated probe, the participant receives only that input and the named
baseline files, and may write only the declared candidate path. The evaluator
is retained outside the participant context and checks the frozen core and
consumer digests plus readback, retry, rollback, zero drift and zero residue.

No isolated participant was started for M0, so there is deliberately no
AI-blind score, completion time, retry count or model comparison. A future run
must record its environment and result separately; it must not overwrite the
prepared-input status.

Claim boundary:
`LOCAL_SYNTHETIC_MEASURED_NO_SPEED_OR_PRODUCTION_CLAIM`. No live provider,
tenant, credential, network, customer data, runtime activation, universal
adaptability, production fitness or comparative speed is evidenced.
