---
title: Reproducible local examples
description: Reproduce ChimpMaera's deterministic SAFE_GUIDED checks and fictional CRM-to-ERP demo with explicit prerequisites, results, cleanup, and evidence limits.
---

# Reproducible local examples

Use a tagged [regular Latest release](https://github.com/JimPansky/ChimpMaera/releases/latest)
or record the exact commit before running an example. All bundled business
records are fictional. Do not substitute personal or customer data.

## SAFE_GUIDED closed proof

**Prerequisites:** Node.js 24, npm 11, and dependencies installed with
`npm ci --ignore-scripts --no-audit --no-fund`.

```sh
npm run proof:secure-default
```

**Expected result:** all human claims and verifier-negative probes pass. The
exact checked surfaces and non-claims are documented in the
[proof report](SECURE-DEFAULT-PROOF.md). This deterministic repository proof
does not test a hostile host or production environment.

## Fictional CRM → ERP flow

**Prerequisites:** Linux x86_64, Docker Engine with Docker Compose v2, `jq`,
`curl`, OpenSSL, and `sha256sum`. First installation can download pinned images.

```sh
./demo/install.sh
```

**Expected result:** the installer prints `READY_VERIFIED` and loopback URLs.
The local flow creates fictional fixtures, evaluates a governed effect, and
requires authoritative readback plus a bound receipt.

Clean up only the state owned by this demo:

```sh
./demo/uninstall.sh --purge
```

Cleanup is not provider Rollback or authority Revoke. The [Quickstart](QUICKSTART.md)
and [known limitations](KNOWN-LIMITATIONS.md) define the complete boundary.

## Lightweight video-reference smoke

**Prerequisites:** Python 3 and the checked-in repository. This command does
not build a GPU image or download a model.

```sh
npm run video:smoke
```

**Expected result:** the synthetic reference validates publication-copy and
scene/audio parity gates. It does not upload, publish, activate a watcher, or
prove production video behavior. See the
[video reference](../tools/video-production-reference/README.md) for scope.
