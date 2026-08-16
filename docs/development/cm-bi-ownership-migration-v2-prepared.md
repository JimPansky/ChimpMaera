# CM → SBA ownership migration v2 — recovered G5 ownership slice

State: `RECOVERY_ADMITTED_FROM_UNCHECKPOINTED_G5` (2026-08-16). The original
five-file reference was expanded into the ownership-pruning slice by the prior
worker, then recovered byte-for-byte after that worker stopped on an expected
non-zero required-file probe. The recovered surface is validated before any
delivery; its admission SHA-256 is recorded in the task checkpoint and report.

## Conservative implementation boundary

- CM is default-off and addresses only the SBA base URL.
- `SUPERSET_BASE_URL` is explicitly denied; CM receives no Superset or source
  database credentials and performs no SQL, discovery, analysis, KPI,
  dashboard, or publication work in the v2 client.
- Readiness is derived only after CM verifies the server-attested product
  `v0.8.0`, external contract `2.0.0`, six required external capabilities,
  accepted graph incumbent `adaptive-v1`, declared authority boundaries,
  canonical attestation digest, status-envelope digest, and attestation binding.
- Failures are typed `DENIED`, `UNAVAILABLE`, or `DISABLED`; no mismatch falls
  through to a legacy or direct integration.

## Pruning matrix

Every directory entry below denotes the complete tracked subtree. The recovered
slice applies the classifications below; delivery still requires all G5/G6
gates to pass.

| Decision | Exact tracked path(s) | Reason |
|---|---|---|
| REMOVE_ACTIVE | `demo/bi-discovery/` | CM-owned MariaDB/Dolibarr discovery runtime and setup surface. |
| REMOVE_ACTIVE | `query-packs/db-analyzer/v1/` | MSSQL/Oracle SQL packs belong exclusively to SBA. |
| REMOVE_ACTIVE | `scripts/collect-bi-discovery-s1.mjs`; `scripts/lib/bi-discovery-s2/`; `scripts/lib/db-analyzer/`; `scripts/publish-bi-discovery-s2-superset.mjs`; `scripts/publish-bi-discovery-superset.mjs`; `scripts/render-bi-discovery-s2-pack.mjs` | Direct discovery, SQL/analyzer, and Superset fachlogic/runtime. |
| REMOVE_ACTIVE | `packages/contracts/src/bi-dashboard.ts`; `packages/contracts/src/bi-execution-spine.ts`; `packages/contracts/src/bi-semantic-reconciliation.ts` | BI-domain contracts duplicated from the SBA owner. |
| REMOVE_ACTIVE | `schemas/contracts/bi-dashboard-v1.schema.json`; `schemas/contracts/bi-execution-spine-v1.schema.json`; `schemas/contracts/bi-semantic-model-v1.schema.json` | Schemas for the duplicated CM BI-domain contracts. |
| REMOVE_ACTIVE | `scripts/bi-e2e-gate.mjs`; `scripts/render-bi-dashboard-evidence.mjs`; `scripts/render-bi-e2e-evidence.mjs` | CM-local BI execution/dashboard pipeline superseded by cross-repo client E2E. |
| REMOVE_ACTIVE | `tests/bi-dashboard.test.ts`; `tests/bi-discovery-s1.test.mjs`; `tests/bi-discovery-s2-core.test.mjs`; `tests/bi-discovery-s2-mariadb-dolibarr.test.mjs`; `tests/bi-discovery-s2.test.mjs`; `tests/bi-e2e-gate.test.mjs`; `tests/bi-execution-spine.test.ts`; `tests/bi-semantic-reconciliation.test.ts`; `tests/db-analyzer-query-pack.test.mjs`; `tests/fixtures/bi-dashboard/`; `tests/fixtures/bi-discovery-s1/`; `tests/fixtures/bi-discovery-s2/`; `tests/fixtures/bi-execution-spine/`; `tests/fixtures/bi-semantic/`; `tests/fixtures/db-analyzer/` | Tests/fixtures tied to logic that must no longer execute in CM. Preserve them through history/evidence before removal. |
| REMOVE_ACTIVE | `package.json` entries `bi-execution-spine:*`, `bi-semantic:*`, `bi-dashboard:*`, `bi-e2e:*`, `bi-discovery-s1:*`, `bi-discovery-s2:*`, `db-analyzer:*`; dependency `mssql` | Active package conveyor still invokes/ships displaced BI and DB runtime ownership. Edit the entries only after green gates. |
| REMOVE_ACTIVE | `packages/contracts/src/index.ts` exports for `bi-dashboard`, `bi-execution-spine`, and `bi-semantic-reconciliation` | Prevent removed BI-domain contracts from remaining public through the barrel. Keep `external-bi-service`. |
| ARCHIVE_EVIDENCE | `knowledge/bi-discovery/`; `verification/bi-004-semantic-reconciliation-evidence-v1.json`; `verification/bi-005-dashboard-evidence-v1.json`; `verification/bi-005-dashboard-readbacks/`; `verification/bi-006-e2e-evidence-index-v1.json`; `verification/db-analyzer/` | Historical BI evidence remains recoverable under `archive/cm-bi-legacy-v1/`; the archive manifest binds every moved byte. |
| ARCHIVE_EVIDENCE | `docs/development/bi-001-docker-foundation-issue-10-pdca.md`; `docs/development/bi-001-read-only-analytics-projection-pdca.md`; `docs/development/bi-002-crm-read-connector-pdca.md`; `docs/development/bi-003-erp-read-connector-pdca.md`; `docs/development/bi-004-semantic-reconciliation-pdca.md`; `docs/development/bi-005-dashboard-readback-pdca.md`; `docs/development/bi-006-e2e-evidence-gate-pdca.md`; `docs/development/bi-discovery-s2-generic-profiling-pdca.md`; `docs/development/cm-bi-exec-001-contract-pdca.md` | Decision/evolution evidence, not active CM contract guidance. |
| KEEP_GENERIC | `packages/contracts/src/canonical-json.ts`; `packages/contracts/src/external-bi-service.ts`; `tests/external-bi-service.test.ts`; `tests/fixtures/external-bi-service-v2-clean-room.json`; `scripts/verify-external-bi-service-v2-clean-room.mjs`; `packages/contracts/src/index.ts` (v2 client export only) | Generic cryptographic envelope/client boundary and its fail-closed tests. |
| KEEP_GENERIC | `docs/EXTERNAL-BI-SERVICE.md` (rewrite to v2 only); `docs/SUPPLY-CHAIN.md`; `release/public-files.manifest`; `SHA256SUMS` | Generic integration/release governance remains; manifest/checksum surfaces were refreshed after the pruning set froze and pass their final gates. |
| KEEP_GENERIC | `packages/contracts/src/crm-read-connector.ts`; `packages/contracts/src/erp-read-connector.ts`; their schemas, fixtures, tests, guides, and `verification/bi-002-crm-read-connector-evidence-v1.json` / `verification/bi-003-erp-read-connector-evidence-v1.json` | Consumer/import and authority review confirmed these are governed generic business-system read connectors, not embedded BI analysis or Superset execution. |
| KEEP_GENERIC | Builder authority, approval workbench, HMI contracts/schemas/tests, generic orchestration, capability catalogue, effective-rights and policy boundaries | These authority-free or explicitly approval-bound contracts remain outside BI fachlogic and are retained unchanged. |
| ARCHIVE_EVIDENCE | `docs/BI-DASHBOARD-READBACK-GUIDE.md`; `docs/BI-E2E-EVIDENCE-GATE.md`; `docs/BI-EXECUTION-SPINE-CONTRACT.md`; `docs/BI-SEMANTIC-RECONCILIATION-GUIDE.md` | External-link and docs-navigation review completed; the active site now points only to the SBA v2 boundary and the historical guides moved to the hash-bound archive. |
| KEEP_GENERIC | `demo/manifests/supply-chain/artifact-lock-v1.json`; `release/public-files.manifest`; `SHA256SUMS`; verification DAG and integrity refresh tooling | Integrity surfaces are retained and refreshed after the final tested pruning set. |

Recovery classification evidence records 41 `ARCHIVE_EVIDENCE` moves, 138
`REMOVE_ACTIVE` deletes and zero unclassified staged paths. The archive
`SHA256SUMS` covers exactly all 41 moved payload files and verifies 41/41.

## G6 executable clean-room specification

Prerequisite: the RTX 5090 benchmark job is terminal and the two isolated
clones remain the sole writers. The recovery run captures each command,
stdout/stderr and exit code in durable evidence.

```bash
CM=/home/jo/.openclaw/workspace/.isolated-writers/bi-ownership-migration-v2-20260816.n97Xoj/ChimpMaera
SBA=/home/jo/.openclaw/workspace/.isolated-writers/bi-ownership-migration-v2-20260816.n97Xoj/Superset_BI_Agent
cd "$CM"
npm ci
npm run external-bi-service:test
npm test
cd "$SBA"
npm test
test -s .runtime/secrets/superset_secret_key
test -s .runtime/secrets/superset_admin_password
test -s .runtime/secrets/superset_analyst_password
test -s .runtime/secrets/control_token
test -s .secrets/mssql_password
test -s .secrets/oracle_password
test -s .secrets/llm_api_key
COMPOSE_PROJECT_NAME=sba-v08-cm-g6 AGENT_PORT=28790 SUPERSET_PORT=28088 docker compose up --build --wait
node scripts/run-external-api-v2-clean-room.mjs http://127.0.0.1:28790
cd "$CM"
node scripts/verify-external-bi-service-v2-clean-room.mjs http://127.0.0.1:28790
cd "$SBA"
COMPOSE_PROJECT_NAME=sba-v08-cm-g6 AGENT_PORT=28790 SUPERSET_PORT=28088 docker compose down -v --remove-orphans
cd "$CM"
git status --short --branch
git diff --check
```

Acceptance: all tests and both live runners pass; wrong product version,
missing capability, digest tamper, and unreachable service remain typed and
fail closed; no CM request targets Superset or carries credentials; only the
named Compose project is created and removed. If any gate fails, retain this
prepared patch, perform no pruning, and return to the pre-G5 CM baseline.
