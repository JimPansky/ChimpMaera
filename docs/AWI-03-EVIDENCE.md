# AWI-03 Universal Knowledge Envelope — PDCA evidence

## Decision

Implement one strict repository-native contract using the existing canonical JSON and SHA-256 primitives. Keep epistemic status, trust, freshness, sensitivity, use, candidate state and authority independent. Risk: a knowledge record could be confused with permission or truth. Fallback: exact empty authority fields, curated fail-closure, explicit exploratory policy, immutable taxonomy generations and LKG rollback.

## Objective evidence

- 7 focused tests; 7 pass is required.
- 4 attributable apple-tree envelopes: one verified procedure, one safe unverified claim and two mutually conflicting claims.
- 6 immutable adversarial envelope fixtures retained as negative evidence.
- 4 selection-policy denials for stale evidence, sensitivity, licence and cross-scope leakage.
- 100 taxonomy digest replays and 100 input-order selection replays.
- 1 safe additive migration and 1 unsafe migration with exact prior-generation LKG retention.
- 0 authority entries across 6 authority classes in envelopes and HMI explanation.

The [public evidence record](../verification/awi-03-knowledge-envelope-evidence-v1.json) binds exact fixture/taxonomy digests and the focused command. Verification Fabric owns this high-risk node while `npm test` remains the only authoritative full-suite comparator.

## Review and rollback marker

Review rejects any change that flattens conflict, infers truth from trust, permits curated unresolved knowledge, accepts missing/stale evidence, widens licence/sensitivity/scope, weakens digest or derivation checks, or adds a non-empty authority/effect field. Roll back using [the operator procedure](KNOWLEDGE-ENVELOPE.md#taxonomy-governance-and-rollback).

Non-claims are the contract-guide boundaries; open parent epics and reused HMI/ASF/Verification Fabric primitives are not claimed complete by this slice.
