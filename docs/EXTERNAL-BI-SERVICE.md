---
title: External BI service contract
description: Configure ChimpMaera to read a separately deployed Superset_BI_Agent service without vendoring or starting it.
---

# External BI service contract

ChimpMaera treats BI as an optional external subsystem. The standalone BI
runtime lives in
[`JimPansky/Superset_BI_Agent`](https://github.com/JimPansky/Superset_BI_Agent)
and is deployed independently with Docker. ChimpMaera does not vendor that
source tree, create a submodule, own its volumes, start it implicitly or pass
database credentials to it.

Minimum supported external baseline: Superset_BI_Agent `v0.4.1`. CM binds that
as an operator-configured release expectation and verifies service health,
Superset health and catalog readiness by readback. The v0.4.1 runtime has no
separate network version endpoint, so actual version evidence is the release
asset or checkout used to start the BI service.

## Configuration

Set these values in the environment used by CM components that need BI:

```sh
BI_AGENT_BASE_URL=http://127.0.0.1:18790
SUPERSET_BASE_URL=http://127.0.0.1:18088
BI_AGENT_EXPECTED_PRODUCT_VERSION=v0.4.1
BI_AGENT_MIN_CONTRACT_VERSION=chimpmaera.bi/agent-result/v1
BI_AGENT_TIMEOUT_MS=5000
```

If the URLs are absent, CM remains usable and reports BI as not configured. If
the service is unavailable, incompatible or catalog readiness is missing, BI
calls fail closed with a typed denial or unavailable result.

CM uses only the external service API:

- Agent `GET /healthz`;
- Agent `POST /api/chat` with fixed status, catalog-question or catalog-search
  prompts;
- Superset `GET /health`.

CM does not call the external analyze, publish or internal materialization
routes and exposes no free SQL, credential, shell, Python or Superset mutation
surface.

## Local two-stack quickstart

Prepare the external BI service from its release source:

```sh
git clone --branch v0.4.1 https://github.com/JimPansky/Superset_BI_Agent.git
cd Superset_BI_Agent
cp .env.example .env
./bin/bi setup
./bin/bi up
./bin/bi status
```

Then point CM at the already running service:

```sh
export BI_AGENT_BASE_URL=http://127.0.0.1:18790
export SUPERSET_BASE_URL=http://127.0.0.1:18088
export BI_AGENT_EXPECTED_PRODUCT_VERSION=v0.4.1
export BI_AGENT_MIN_CONTRACT_VERSION=chimpmaera.bi/agent-result/v1
```

Use unique loopback ports if both stacks run beside other local services. Stop
or reset BI with `./bin/bi down` or `./bin/bi reset --yes-i-understand` from the
BI checkout, not from CM.

Rollback: unset the CM BI environment variables or revert to the previous CM
release. The external BI stack remains independently controlled by its own
checkout and release documentation.

Non-claims: no production BI deployment, live credential handling by CM,
database write-back, arbitrary SQL, dashboard authoring platform, Superset
administration, or proof of external runtime version beyond the configured
release asset/checkout binding.
