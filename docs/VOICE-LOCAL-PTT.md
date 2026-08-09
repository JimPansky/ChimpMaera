# VOICE_LOCAL_PTT operator guide

Status: **default-off optional local adapter; deterministic synthetic proof only**.

`VOICE_LOCAL_PTT` adds push-to-talk transcription and speech rendering without changing ChimpMaera's governed action path. Omitting it, removing its export, or leaving `enabled` unequal to `true` leaves CM fully functional and loads no audio dependency. Voice output is never an Approval, credential, capability, tool call, effect, or authorization. A transcript becomes only an `authority: NONE`, `UNTRUSTED_VOICE_TRANSCRIPT` proposal at `CM_GOVERNED_INPUT`; the existing Gateway/broker still decides what may proceed.

## Setup and substitution

The operator separately obtains and verifies a whisper.cpp executable/model and a llama.cpp-compatible Qwen3-TTS executable/model. Supply fixed absolute normalized non-root paths, independently verified SHA-256 binary/model artifact digests, adapter revision identifiers, conservative byte/duration/text/output limits, and `enabled: true` in trusted controller configuration. The dependency-free default runner uses Node `execFile` with `shell: false`, timeout termination, bounded stdout/stderr, and deterministic sanitized failures. The runtime creates a private temporary directory per operation, accepts only `wav`/`pcm_s16le`, `de`/`en`, and removes the directory on success or failure. It never downloads, discovers, or selects binaries/models or argv from requests.

Adapters are replaceable behind `BoundedProcessRunnerV1`. A substitute must preserve the exact v1 schemas, fixed trusted executable/model selection, argv-only execution, timeout/output caps, isolated temporary storage, correlation checks, WAV validation, cleanup, and authority-free boundary. Do not pass user-provided paths or extra argv.

## Privacy, receipts, and retention

Raw input/output audio and intermediate transcripts are ephemeral by default. `OPERATOR_POLICY` is an explicit caller retention label, not storage performed by this module. Sanitized receipts contain correlation identifiers, language, trust/retention, outcome, and SHA-256 model/config digests. They exclude transcript text, audio, secrets, command output, and filesystem paths. Correlation mismatch, unknown fields, authority/approval/tool/effect fields, malformed output, unavailable process/model, timeout, unsupported codec/language, and exceeded limits fail closed.

## Supply chain, release, and rollback

Pin independently acquired executable/model revisions and hashes in private operator inventory; verify upstream provenance and licenses before activation. Neither binaries nor models are distributed or checksummed by this repository. Release review must run the focused voice tests, TypeScript build, public-manifest governance, and root `SHA256SUMS` verification. Roll back by disabling the profile and removing its trusted configuration; CM text inputs and all governed boundaries remain available.

## Optional live German probe and honest non-claims

Live audio is excluded from CI. An operator separately verified a local German roundtrip evidence bundle in an operator-supplied private evidence directory on 2026-08-09. That single controlled probe recorded WER **7.69%**, CER **1.15%**, STT real-time factor **0.238**, and one substitution (`lies` → `liest`); the safety clause remained preserved. German STT and TTS completed, identifiers correlated, WAV output was non-empty, and raw media remained outside public artifacts. These are metrics from that one already-verified local probe—not a reproducible CI result, general benchmark, production readiness claim, accuracy/latency guarantee, speaker-consent system, biometric protection, sandbox, vendor endorsement, or proof for other hardware, languages, codecs, models, or revisions.
