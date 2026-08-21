# Adaptive Evidence Gates

PanSphaira adaptive evidence gates are an additive, Shadow-only successor to
Verification Fabric v1/v2. They select proportional checks without weakening
root truth. The existing `npm test` comparator remains authoritative; this
slice does not activate reduced CI depth, a global hook, deployment, or an
external writer.

## Contract

A closed v1 specification declares one root goal, an exact digest-bound scope,
one known slice type, known additive risk attributes, release and product
evidence requirements, a bounded freshness window, and registered executable
gates. Each executable gate has a named `checkId`, exact exit/stdout
expectation, and explicit dependencies. Unknown fields, profiles, risks,
dependencies, paths, transitions, or evaluator inputs deny.

Profiles select minimum registered checks:

| Profile | Minimum checks |
|---|---|
| `docs-minimal` | docs build and spelling |
| `code-runtime` | build, lint and focused tests |
| `ui-presentation` | accessibility and interaction |
| `security-trust-boundary` | threat negative, unsafe input, authority/secret |
| `external-integration` | remote readback, timeout recovery, idempotency |
| `release-required` | delivery readback |

The CLI accepts only a safe repository-relative JSON path and resolves checks
through a frozen registry. It executes argv arrays with `shell:false`, bounded
timeouts and output buffers. It never evaluates claimant-provided shell or
arguments. Each check runs twice; unequal results are `FLAKY_RESULT`.

## Evidence and status truth

Receipts bind the subject, entire spec, exact expectation, closed check ID,
verifier version, exact result, observation time and expiry through canonical
JSON and SHA-256. Delegated executable evidence is never accepted by report:
the parent validates the child receipt and reruns the same registered check.

Completion is projected across three independent dimensions:

- `localState`: local executable evidence and honest external waits;
- `deliveryState`: `PR_READY -> PR_OPEN -> CI_GREEN -> MERGED ->
  RELEASE_DECISION -> RELEASED|CLOSED_NO_RELEASE`;
- `productEvidenceState`: separately required product evidence.

The root is complete only when all required dimensions are terminal. Open PR,
green CI, merge, or release decision are nonterminal. A stale active phase is
`STALE_ATTENTION`, never success. `WAITING_EXTERNAL` remains waiting while the
controller may continue unrelated safe internal work. A complete root returns
`ADVANCE_PHASE` rather than reoptimizing the completed metric.

The conveyor adapter is read-only and accepts only a versioned projection. It
does not mutate GitHub, releases, a ledger, runtime state, or OpenClaw.

## Operation

Build first, then inspect the closed registry or evaluate a safe spec:

```sh
npm run build
node scripts/adaptive-evidence-gates.mjs --registry
node scripts/adaptive-evidence-gates.mjs path/to/spec.json
node scripts/adaptive-delivery-status.mjs path/to/readback.json
```

Rollout remains `SHADOW`. Roll back by reverting the bounded adaptive-gates
commit; retain existing v1/v2 evidence and full-suite behavior.

## Design provenance

The gates-before-work, `CHECK`/`EXPECT`, and parent re-verification concepts
were evaluated against `Leonxlnx/unlazy@ed9e8d2b5919698cf2c54bda270d507e10b69617`
(MIT). No unlazy source or template was copied. PanSphaira deliberately uses a
closed registry, exact exit/output semantics, immutable receipts and an honest
delivery root instead of upstream free-shell or prose-evidence behavior.
