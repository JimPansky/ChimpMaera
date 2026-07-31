# Architecture

This architecture implements only the v0.1 subset identified in
[The ChimpMaera Canon](CANON.md). [Known Limitations](KNOWN-LIMITATIONS.md)
identifies boundaries that are intentionally outside the local candidate.

ChimpMaera v0.1 is a local reference stack with three user-facing loopback
services:

- ChimpMaera coordinates the guided demo, enforces the local action boundary
  and records a digest-bound receipt.
- EspoCRM holds the synthetic customer and opportunity view.
- Dolibarr receives one approved synthetic order and supplies the authoritative
  provider readback.

MariaDB services remain on internal Docker networks. ChimpMaera communicates
with the provider application networks but does not mount the Docker socket.
The ChimpMaera container is non-root, read-only, capability-dropped and
configured with `no-new-privileges`.

The installer creates random local secrets as Docker Compose file-backed
secrets. No credential is bundled in the release. The installer journal and
semantic readback live only in generated local state directories.

The optional `tools/video-production-reference/` component is independent of
the CRM/ERP runtime. Its default path validates versioned jobs and can perform
a synthetic CPU-only smoke without models, GPU activation or public side
effects.

The effect path follows the Canon's separation: the seed path forms typed
requests without provider credentials; the ChimpMaera runtime gate performs
use-time enforcement; the provider is read back before a bound success receipt
is recorded. A complete readable business Diff, production approval service,
provider Revoke and provider Rollback remain outside v0.1.

The Admin-AI PoC is a deterministic local preview wired through a static policy
and the same enforcement boundary. `AUTO_GRANT` may execute only its permitted
synthetic CRM effect with a bound receipt. `OWNER_ESCALATION`, `DENY`, missing
authority and tampered authority or digest cases fail closed before provider
execution. No live LLM, owner-confirmation service or production authority is
claimed.
