# VOICE-M0 issue 157 acceptance record

## Plan

Add a removable default-off local push-to-talk boundary with exact contracts,
bounded local adapters, ephemeral media handling, authority-free composition,
sanitized digest-bound receipts, deterministic negative proof, and honest
operator guidance.

## Do and check

The TypeScript module implements a dependency-free `execFile` runner and
replaceable whisper.cpp and llama.cpp/Qwen3-TTS argv adapters. Trusted controller
configuration owns normalized paths, artifact SHA-256 digests, adapter revisions,
limits and activation. Requests cannot supply paths, commands, tools, approval or
authority. Exact schemas cover configuration, STT/TTS request and result, composed
turn request and result, and receipts. Focused tests exercise positive German
flow plus configuration, artifact, timeout, overflow, malformed WAV, correlation,
digest and cleanup denials. The full suite, checksums, supply-chain and release
governance remain blocking gates.

## Act and rollback

Keep the profile disabled unless an operator has privately verified licensed
artifacts. Rollback disables/removes the optional profile, configuration and
adapter files; CM's text and governed action boundaries remain intact. No live
audio, binary, model or private evidence path is published.
