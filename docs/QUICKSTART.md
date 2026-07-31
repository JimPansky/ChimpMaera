# Quickstart

Before running the demo, read [The ChimpMaera Canon](CANON.md),
[The Zoo Field Guide](ZOO-FIELD-GUIDE.md),
[Architecture](ARCHITECTURE.md) and [Known Limitations](KNOWN-LIMITATIONS.md).

## Requirements

Install Docker Engine with Docker Compose v2 and the local command-line tools
`jq`, `curl`, OpenSSL and `sha256sum`. The demo targets Linux x86_64 and uses
only loopback service bindings.

## Verify the source candidate

With Node.js 24 and npm 11, dependencies can be prepared from a populated
local cache:

```sh
npm ci --offline --ignore-scripts --no-audit --no-fund
npm run lint
npm test
```

The video reference has a lightweight synthetic smoke that does not build a
GPU image or download a model:

```sh
npm run video:smoke
```

## Run the playable demo

```sh
./demo/install.sh
```

The installer creates random local demo credentials, builds the ChimpMaera
runtime image, starts the pinned CRM/ERP stack, loads fictional fixtures and
performs semantic readback. Initial installation can download the pinned
container images.

Success prints `READY_VERIFIED` and three loopback URLs. Keep the generated
credentials local. The guided demo also exercises the deterministic Admin-AI
preview path for permitted, denied and escalation outcomes.

## Stop and remove owned state

```sh
./demo/uninstall.sh --purge
```

The cleanup command is ownership-scoped. Never substitute broad Docker prune
or filesystem deletion commands.

Cleanup is not provider Rollback or authority Revoke. The distinction is
defined by
[CM-CAN-13](CANON.md#cm-can-13--revocation-rollback-and-cleanup-are-distinct).
