---
title: External BI service contract v2
description: Connect PanSphaira to independently released KaleidoSphere through the stable, fail-closed SBA v2 compatibility boundary.
---

# External BI service contract v2

KaleidoSphere is the sole owner of BI discovery, database adapters, analysis,
semantic/KPI/graph logic, previews and Superset execution. PanSphaira (CM)
retains only a thin generic client plus its existing generic orchestration,
approval and UI boundaries. CM does not vendor or start KaleidoSphere, own its
containers or volumes, receive database or Superset credentials, forward
SQL/raw rows, or apply/publish a BI result.

`SBA` remains the compatibility abbreviation for this boundary. Stable
`superset-bi-agent.*` schema and product IDs, `BI_AGENT_*` environment
variables, `/v2` routes and the `bi-agent` runtime component name are unchanged.

The supported pair is SBA product `v0.8.0` and external contract `2.0.0`. CM
first verifies `GET /v2/capabilities`, including the canonical SHA-256 digest,
the six required external capabilities, the accepted Adaptive Graph incumbent
`adaptive-v1`, and the declared non-credential/non-SQL/non-mutation boundaries.
It then sends closed requests to `POST /v2/intents` and verifies product,
contract, attestation binding and response digest on every result.

## Configuration

BI is optional and default-off. Configure only the SBA root URL:

```sh
BI_AGENT_BASE_URL=http://127.0.0.1:18790
BI_AGENT_EXPECTED_PRODUCT_VERSION=v0.8.0
BI_AGENT_EXPECTED_CONTRACT_VERSION=2.0.0
BI_AGENT_TIMEOUT_MS=5000
```

No BI variables means `DISABLED`. A wrong version/contract/capability/digest,
malformed payload, unsafe request or unavailable/timeout condition fails closed
as `DENIED` or `UNAVAILABLE`. `SUPERSET_BASE_URL` is explicitly rejected.

## Allowed intent boundary

CM may request only `status`, `discovery`, `analyze`, `plan`, `preview`, and
`readback`. Runtime guards reject unknown actions, arbitrary routes, credential,
secret/token, URL/host/port, raw-row and SQL-shaped inputs before any fetch.
Persistent Superset work remains inside SBA's trusted
preview→approval→apply→readback→rollback workflow and is not an external intent.

The cross-repository clean-room runner is:

```sh
npm run external-bi-service:test
node scripts/verify-external-bi-service-v2-clean-room.mjs http://127.0.0.1:28790
```

It proves the full status→analyze→discovery→plan→preview→readback chain,
`NOT_APPLIED` readback, the complete fail-closed negative matrix, and absence of
direct Superset access, credentials, raw rows, SQL forwarding and mutation.

Rollback before merge is the exact pre-migration CM base. After a protected
merge, use a protected successor PR; do not rewrite main, retag or replace
assets. Disabling BI only requires removing the CM BI environment variables;
KaleidoSphere lifecycle remains independently controlled by its own release
checkout.

Non-claims: no deployment, runtime activation, production/customer access,
credential onboarding, database write-back, Superset administration, Casuvia
access, or proof beyond the exact released SBA v0.8.0/contract 2.0.0 pair.
