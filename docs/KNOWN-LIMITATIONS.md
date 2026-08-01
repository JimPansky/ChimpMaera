# Known limitations

These limits are part of the claim discipline required by
[The ChimpMaera Canon](CANON.md).

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
- The deterministic fixtures are fictional and must not be replaced with real
  personal or customer data without a separate privacy and security design.
- The Approval Workbench implements one readable business Diff and local
  Approve/Reject ceremony for the synthetic Dolibarr escalation only. It is not
  production IAM/MFA or a general approval service. The local API bearer stands
  in for the owner identity.
- Provider Revoke and provider Rollback are not implemented claims. Installer
  Cleanup is distinct. A burned or ambiguous one-use lease requires a new owner
  decision after provider reconciliation.
- Admin-AI is a deterministic local static-policy preview. It does not call a
  live LLM and does not create production authority.
- Policy activation uses an authenticated local HMAC fixture and local state,
  not an independent production signer, HSM, transparency log, rollback-proof
  store or distributed rollout protocol. A compromised host or runtime key can
  forge this local boundary.
- The Paperless-ngx zoo adapter is a disabled-by-default, read-only client
  boundary tested with synthetic HTTP fixtures. The stock demo does not install
  or contact Paperless. Real-service compatibility, ingest, document content,
  OCR, lifecycle, retention and backup/restore are not claimed.
- Catalog and template entries are descriptive; not every entry is executable,
  and admission or popularity never grants runtime authority.
- No DMS/compliance suitability or universal AI capability is claimed.
- Optional video assets are replaceable examples. Users remain responsible for
  their own output rights, configuration and safety.
- The German voice WAV and transcript are an explicit localized reproduction
  exception. Public repository prose remains English-first.
- Apache-2.0 grants no trademark rights or permission to imply endorsement.
