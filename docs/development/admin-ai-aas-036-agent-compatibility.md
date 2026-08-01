# AAS-036 agent and protocol compatibility

Date: 2026-08-01
Contract: `chimpmaera.model/model-request/v1` and
`chimpmaera.model/model-response/v1`

| Agent/runtime | Runtime provenance | Protocol path | Text | Streaming | Structured output | Tool candidates | Attachments | Evidence / honest status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OpenClaw 2026.7.1 | Pinned index digest `sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c`; local provenance report retained | OpenAI-compatible Chat Completions through Capability Frontdoor and broker | Proven in isolated runtime | Proven through guarded frontdoor SSE | Contract/adapter proven | Contract, adapter and isolated negative candidate probe proven; candidates have no authority | Contract/adapter proven; real OpenClaw attachment transmission not exercised | Real isolated E2E `aas036-20260801T131032Z` PASS; Owner runtime untouched and fingerprint unchanged |
| OpenAI-compatible client fixture | Local deterministic test fixture | Chat Completions and Responses | Proven | Chat/SSE guard proven | Proven | Proven | Proven for PNG/JPEG/PDF references | Protocol conformance only; not a live OpenAI provider claim |
| Anthropic-compatible client fixture | Local deterministic test fixture | Messages and SSE | Proven | Canonical incremental SSE guard proven | Proven through canonical `output_config` mapping | Proven | Explicit adapter representation proven | Protocol conformance only; not a live Anthropic provider claim |
| Hermes | No pinned local runtime provenance/licence/artifact selected | Canonical/OpenAI-compatible path where exact runtime support is later proven | Protocol-shape preparation only | Protocol-shape preparation only | Protocol-shape preparation only | Protocol-shape preparation only | Protocol-shape preparation only | **Runtime execution unproven**; no universal compatibility claim |
| Claude Code | No pinned local runtime provenance/licence/artifact selected | Canonical/Anthropic-compatible path where exact runtime support is later proven | Protocol-shape preparation only | Protocol-shape preparation only | Protocol-shape preparation only | Protocol-shape preparation only | Protocol-shape preparation only | **Runtime execution unproven**; no universal compatibility claim |

Provider-specific optional fields are closed per route. Supported fields are
represented unchanged; unsupported fields return an explicit
`MODEL_OPTIONAL_FIELD_UNSUPPORTED:<field>` denial and are never silently
dropped. Attachments are digest/reference contracts only; no arbitrary URL or
agent filesystem fetch is admitted.

The compatibility claim is limited to the rows and evidence above. Live
provider behavior, production TLS/DNS, provider credential custody, full
provider feature surfaces and other agent runtimes remain unproven.
