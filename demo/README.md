# ChimpMaera v0.1 local demo installer

The demo is the bounded implementation example for
[The ChimpMaera Canon](../docs/CANON.md). Use
[Architecture](../docs/ARCHITECTURE.md) and
[Known Limitations](../docs/KNOWN-LIMITATIONS.md) to distinguish shipped local
behavior from non-claims.

The installer starts a local synthetic CRM/ERP stack and verifies
authenticated provider readiness, mapped fictional identities, a
digest-bound catalog, one governed CRM-to-ERP order flow and the deterministic
Admin-AI preview boundary.

## Requirements

- Linux x86_64;
- Docker Engine with Docker Compose v2;
- `jq`, `curl`, OpenSSL and `sha256sum`;
- permission to build the local demo image and create installer-owned Docker
  containers, volumes and networks;
- free loopback ports `7780`, `7781` and `7782`, unless overridden with unique
  `CM_*_PORT` loopback bindings.

Do not use production credentials or real customer data. Initial installation
may download the pinned container images declared in `compose.yaml`.

## Install

From the release root:

```sh
./demo/install.sh
```

The guided defaults select the complete synthetic demo with safe local
authority. The optional `RAMPAGE` profile is a test-lab mode and requires the
explicit `CM_RAMPAGE_CONFIRM=I_UNDERSTAND_LOCAL_DEMO_ONLY` opt-in. It does not
grant host privileges.

Success prints `READY_VERIFIED` and loopback URLs for ChimpMaera, EspoCRM and
Dolibarr. An unchanged rerun is idempotent. The Admin-AI PoC uses a
deterministic local policy, not a live LLM or production delegation service.

## Local runtime state

The installer generates random local demo secrets and state under
`.chimpmaera-demo/`. Per-run diagnostic receipts are written under
`.chimpmaera-acceptance/`. Neither directory belongs in a source or release
archive.

## Cleanup

Remove only installer-owned resources:

```sh
./demo/uninstall.sh --purge
```

`--purge` removes the locally built demo image only after verifying its
ownership label. Do not replace this command with Docker pruning or broad
filesystem deletion.

`READY_VERIFIED` applies only to the selected local run. It is not a
publication, production, support, performance or security-certification
claim.
