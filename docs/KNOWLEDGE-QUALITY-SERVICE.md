# Knowledge Quality Service M0

The LKC-QUAL-01 M0 slice turns a bounded contribution into immutable, reviewable qualification proposals. It extends the existing Knowledge Envelope and taxonomy lifecycle; it is not a second knowledge store or authority plane.

## Contract flow

1. A `chimpmaera.knowledge/contribution-envelope/v1` preserves the exact raw input, its SHA-256 submission digest, and every atomic claim's exact UTF-16/JavaScript code-unit selector.
2. Fifteen closed applicability dimensions distinguish `UNKNOWN`, `NOT_PROVIDED`, `NOT_APPLICABLE`, and `EXPLICITLY_UNRESTRICTED`. Values are separately marked `DECLARED`, `EVIDENCE_DERIVED`, or `INFERRED`; inference never changes a declaration.
3. Deterministic qualification emits a content-addressed receipt containing contribution-bound atomic claims, typed relation proposals, targeted context questions, or quarantine reasons. Common-core proposals retain the exact shared sentence and both contextual deltas; subsumption proposals retain their explicit direction without broadening either immutable claim. Receipt validation requires the bound Contribution Envelope, configuration, and accepted context because selector correctness cannot be proven from a receipt alone. Receipt timestamps are deliberately absent.
4. Retrieval filters applicability before any ranking. Missing material context returns `NEEDS_CONTEXT`; applicable overlapping conflicts return `CONFLICT` with no selected default.
5. Activation accepts a complete immutable edition only when its taxonomy, envelope digests, prior edition, generation, and exact external LKG pointer all bind. Candidate failure with a validated LKG returns that exact edition and pointer; invalid current/LKG input returns `DENIED_NO_VALID_LKG` with no reconstructed state, preventing false rollback claims and mixed-generation residue.

All outputs carry the existing read-only Knowledge Envelope authority boundary. They grant no credential, approval, policy, capability, tool, write, execution, acceptance, publication, or activation authority.

## Offline guided demo

The demo is default-off. Its container joins an internal-only Docker network, publishes only to host loopback, and has no external egress route or silent network fallback. It uses the repository's pinned Node runtime image pattern:

```sh
docker compose -f demo/knowledge-quality/compose.yaml --profile lkc-qual up --build
curl http://127.0.0.1:18080/v1/review
curl -X POST http://127.0.0.1:18080/v1/qualify \
  -H 'content-type: application/json' \
  --data '{"rawInput":"Fictional request requires approval.","licence":"CC0-1.0"}'
```

`GET /v1/review` and `/v1/export` are read-only deterministic fixture views. `POST /v1/qualify` is a guided offline preflight that preserves the raw string, returns its digest, asks for missing scope, and never activates knowledge. There are no credentials, providers, remote calls, persistence volumes, or silent network fallback. Stop with `docker compose -f demo/knowledge-quality/compose.yaml --profile lkc-qual down`.

## Developer verification

Run `npm run knowledge-quality:test`; use `npm run knowledge-quality:schema-parity` as the narrow state-algebra parity gate. The focused suite covers contributor and reviewer paths, digest-preserving tamper probes, schema/runtime validation, determinism, provenance separation, executable relation cases, material context, quarantine classes, untrusted model/config/context input, conflict visibility, exact LKG activation/rollback/denial, the fictional purchasing fixture, and loopback API behavior. `docker compose -f demo/knowledge-quality/compose.yaml config` checks the isolated default-off profile.

This M0 does not download or ingest a corpus, use a live model/provider/network, contain customer or personal data, deploy, publish, autonomously accept truth, operate at production scale, or complete parent epics #54, #37, or #34.
