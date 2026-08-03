---
title: Known limitations
description: Review the explicit production, security, identity, integration, runtime, and evidence limits of ChimpMaera's current local synthetic release.
---

# Known limitations

These limits are part of the claim discipline required by
[The ChimpMaera Canon](CANON.md). They apply to the current regular release
`v0.2.0-poc.20260803.6` and its local synthetic evidence; a later documentation
change does not broaden the released asset claims.

- This is a local synthetic proof of concept, not a production deployment or
  security certification.
- The supported demo host is Linux x86_64 with Docker Engine and Docker Compose
  v2.
- First installation can require access to the registries for the pinned
  container images. No offline image bundle is included.
- The supply-chain verifier checks repository declarations offline. It does not
  verify registry signatures, provenance, transitive container SBOMs,
  vulnerabilities, licenses or reproducible builds.
- Availability, hostile-host isolation, multi-node operation, disaster
  recovery, upgrades and production identity integration are not claimed.
- Loopback and internal-network controls reduce accidental exposure but do not
  protect against a compromised host or Docker daemon.
- Docker is the shipped demo Reference Adapter, not a mandatory product
  mechanism or one-container-per-Agent requirement. The current release does
  not validate VM/MicroVM, WASM, remote-worker, or other OS-sandbox adapters.
- The current local demo does not establish complete mediation for arbitrary Agent
  model, tool, skill, network, file, process, durable-Mind, secret, read, or
  effect crossings. Gateway-only behavior without OS-enforced denial of
  alternate paths is not claimed as isolation.
- The deterministic fixtures are fictional and must not be replaced with real
  personal or customer data without a separate privacy and security design.
- The Approval Workbench implements one readable business Diff and local
  Approve/Reject ceremony for the synthetic Dolibarr escalation only. It is not
  production IAM/MFA or a general approval service. The local API bearer stands
  in for the owner identity.
- The material order Diff uses a bounded local Dolibarr query and a
  digest-derived snapshot version, with freshness checks at approval and use.
  This is not a provider transaction/ETag, production requester/approver
  identity, step-up authentication, quorum or anti-clickjacking claim.
- Provider Revoke and provider Rollback are not implemented claims. Installer
  Cleanup is distinct. A burned or ambiguous one-use lease requires a new owner
  decision after provider reconciliation.
- Admin-AI is a deterministic local static-policy preview. It does not call a
  live LLM and does not create production authority.
- The injection trust boundary is a pure local contract exercised with hostile
  synthetic provider, tool, document and memory fixtures. It does not prove a
  live model, tokenizer, retrieval stack, gateway or credential broker resists
  prompt injection, and it does not enable any model or retrieval path.
- Policy activation uses an authenticated local HMAC fixture and local state,
  not an independent production signer, HSM, transparency log, rollback-proof
  store or distributed rollout protocol. A compromised host or runtime key can
  forge this local boundary.
- The signed Policy lifecycle is a default-off local management-plane contract
  tested with synthetic Ed25519 and Owner-HMAC fixtures. It does not install a
  signer, trust service, HSM, production key ceremony, rollout quorum,
  transparency log or rollback-resistant store; the stock runtime exposes no
  lifecycle activation API. The supported static demo Policy still rejects
  broadened runtime semantics even when a lifecycle approval explicitly names
  a widening.
- The permission X-ray intersects exact synthetic local operands and is
  informational only. It does not prove production IAM/role-source freshness,
  tenant isolation or authorization completeness, and its ALLOW result is not
  executable authority.
- The Paperless-ngx zoo adapter is a disabled-by-default, read-only client
  boundary tested with synthetic HTTP fixtures. The stock demo does not install
  or contact Paperless. Real-service compatibility, ingest, document content,
  OCR, lifecycle, retention and backup/restore are not claimed.
- Observable inputs, outputs, decisions, actions and receipts do not expose or
  prove complete internal model thoughts. Unknown side channels, runtime
  vulnerabilities, kernel/hypervisor defects and untested production
  environments remain outside all current claims.
- Catalog and template entries are descriptive; not every entry is executable,
  and admission or popularity never grants runtime authority.
- Managed skill admission is a default-off local candidate with deterministic
  declaration and bounded-text analysis. It does not prove arbitrary code is
  safe, perform a legal licence opinion, verify a live registry/signature chain
  or provide a production sandbox/store/trust root. Only the pinned OpenClaw
  fixture format is locally materialised; Hermes and Claude Code formats and
  runtimes remain unproven. Installation, capability grant and activation are
  intentionally separate.
- No DMS/compliance suitability or universal AI capability is claimed.
- Optional video assets are replaceable examples. Users remain responsible for
  their own output rights, configuration and safety.
- The German voice WAV and transcript are an explicit localized reproduction
  exception. Public repository prose remains English-first.
- Apache-2.0 grants no trademark rights or permission to imply endorsement.
