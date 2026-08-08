# LR-001 learning-routing contract freeze

Status: local synthetic foundation only. No collector, router runtime, provider call, or policy activation is introduced by this slice.

## Contract boundary

LR-001 adds four closed Draft 2020-12 contracts and matching TypeScript types:

- `chimpmaera.dev/routing-context/v1`
- `chimpmaera.dev/routing-decision/v1`
- `chimpmaera.dev/routing-attempt/v1`
- `chimpmaera.dev/routing-outcome/v1`

Every record is canonical-digest-bound and carries the immutable claim boundary `LOCAL_SYNTHETIC_NO_ROUTING_ACTIVATION`. The contracts can describe a proposed route and observed evidence, but they cannot execute a route, create a lease, call a provider, modify broker policy, grant authority, publish, merge, release, or activate production behavior.

Complexity, confidence, risk, data class, and exploration permission are separate closed fields. A low complexity assessment therefore cannot lower risk or authorize exploration. Model identifiers remain CM aliases; provider and model names are outside the contract.

## Data minimization and retention non-claims

The schemas allow only coarse pre-decision cohorts, pseudonyms, finite enums, counters, timestamps, and digests. They deny unknown fields, including raw issue text, prompts, responses, code, file paths, command output, error stacks, credentials, host/network identifiers, and user/session/job identifiers.

Digests and pseudonyms remain linkable metadata; they are not claimed to be anonymous. LR-001 does not create storage, consent, deletion, tombstone, readback, telemetry, or training-ingestion behavior. A later ledger slice must define and test those lifecycle controls before any non-synthetic persistence is permitted.

## Evidence and lineage

The exported digest helpers exclude only their record's digest field and hash canonical JSON bytes. The pure lineage validator binds:

- every decision to the exact context digest and episode pseudonym;
- every attempt to an admitted decision digest and optional in-bundle parent attempt;
- the outcome to the exact context, decision set, attempt set, and acceptance snapshot.

Schema validity alone is intentionally not treated as semantic lineage validity. Likewise, an untrusted claim inside an outcome can never become authoritative merely because it is structurally valid. Verification semantics are implemented by LR-002, not this contract freeze.

## Rollback

Rollback is a normal revert of the additive TypeScript module, four schemas, tests, documentation, export, and package test entry. No migration, persisted state, provider action, routing decision, or runtime switch exists in LR-001.

## Promotion gate

This slice may advance only after focused tests, TypeScript build/lint, full repository tests, canonical reordering tests, digest/lineage negatives, unknown-field denials, and seeded-secret/prohibited-field probes are green. Passing LR-001 authorizes only the next local foundation slice; it does not authorize shadowing, advisory routing, or execution against real issues.

## LR-002 terminal outcome adapter

`adaptRoutingOutcomeV1` is a pure, deterministic Work Receipt plus Verification Fabric v2 Shadow adapter. It aggregates every attempt and bound receipt without executing work. `VERIFIED_RESOLVED` requires one digest-bound candidate, valid context/decision/attempt lineage, exact receipt digests and usage, successful cleanup/readback, all seven terminal hard gates, fresh authoritative subject- and acceptance-bound evidence, and at least one successful authoritative full-suite comparator report. Impacted and full-fallback Shadow plans are treated identically because the complete comparator remains authoritative; prototype attestations and model self-reports are never sufficient.

Missing, stale, tampered, mismatched, non-authoritative, or unrun evidence remains `INSUFFICIENT_EVIDENCE`. A failed gate remains `NOT_RESOLVED`; an entirely aborted attempt chain remains `ABORTED`; unknown transport remains `UNKNOWN` and is never inferred to be a retry or model failure. Multi-cause attribution uses a finite precedence with reduced confidence for integrity gaps and unknown transport. Rollback is removal of the additive adapter, export, tests, and this section; no state or migration exists.

## LR-003 falsification fixture pack

`buildLearningRoutingThreatPackV1` deterministically covers the 21 threat probes frozen by LR-003. Each fixture contains only a public synthetic mutation code, finite expected reason/state, and canonical digest. The retained replay manifest binds its sorted threat list, fixture digests, public-seed digest, and overall manifest digest. Promotion requires complete deterministic replay with zero missing threats, privacy findings, or unexpected successes; any unexpected success, privacy finding, nondeterminism, or unknown-transport coercion is an immediate stop condition.

Secret, absolute-path, raw-content, stable-ID, and retention candidates are inspected only by the in-memory privacy falsifier, which emits a finite denial code without echoing candidate data. The persisted pack contains no prompt, response, local path, credential, or real identifier. These fixtures falsify claims only; they do not train, collect telemetry, select routes, call providers, or activate runtime behavior. Rollback removes the additive pack, retained manifest, tests, export, and this section.

## LR-004 offline historical baseline

`computeLearningRoutingBaselineV1` accepts only a closed, sanitized historical-episode projection and computes VSR with a Wilson 95% interval, ECVR, ETVR, and calls/repairs/retries/scout/test/CI/review effort per verified success. Failed, aborted, denied, censored, unknown, and insufficient episodes remain in the denominator. An incomplete `VERIFIED_RESOLVED` claim is normalized to `INSUFFICIENT_EVIDENCE`. Actual receipt cost overrides price assumptions; when transport is unknown and actual cost is absent, the declared reserve is added rather than silently treated as zero.

The retained August fixture provides equal, explicitly separate `STATIC`, `CURRENT`, `CHEAP`, and `STRONG` sanitized cohorts and source classifications for the August canary plus public Issues 41 and 58. It is a deterministic foundation baseline, not a claim that synthetic values are production measurements. Cohort, version, episode, and full-baseline digests are stable under input reordering, missingness is explicit, and the offline CLI reads one supplied JSON file without collecting live data or making network calls. Rollback removes the additive module, CLI, fixtures, tests, export, package entries, and this section; no stored state or routing behavior changes.
