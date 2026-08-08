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
