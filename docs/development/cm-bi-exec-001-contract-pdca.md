# CM-BI-EXEC-001 governed BI execution spine PDCA

Status: local synthetic contract preparation. The narrow GitHub child issue is
still pending because the concrete connector write tool was not exposed in this
cron runtime. No runtime, dashboard, provider, live connector or production data
was activated.

## Plan

Prepare the typed BI execution spine that the planned CM-BI-EXEC-001 issue will
own: intent, source, semantic model, declarative query plan, execution receipt,
verification report, bounded claim and visualization contracts for three
synthetic PoC questions. Keep the work additive, public-safe and fail-closed.

Autonomous assumption: local additive contract work may proceed before the
external child issue exists because it is reversible and stays unpushed in the
dedicated worktree. Risk: traceability could weaken if this were published
without the issue. Fallback: keep the branch local, create/link the child issue
before PR publication, and remove the additive files if the issue dedupe later
finds an equivalent.

## Do

- Added a closed TypeScript verifier and digest helpers for
  `chimpmaera.cm-bi-exec/governed-bi-execution-spine/v1`.
- Added a strict Draft 2020-12 schema.
- Added one positive public-synthetic fixture with three PoC questions.
- Added an 11-case negative matrix covering arbitrary SQL capability, unknown
  source/field, stale and missing lineage, tenant boundary, formula drift,
  unsupported visualization, raw evidence leakage, empty receipts and authority
  claims.
- Added focused tests for schema acceptance, deterministic bindings, canonical
  digest stability, negative probes and seeded leakage denial.
- Added public contract documentation.

## Check

Focused local evidence is `node --test dist/tests/bi-execution-spine.test.js`
after `npm run build`. Full repository, supply-chain, release-governance and
exact PR CI gates remain pending for the next write-capable slice.

## Act

Before external publication, create or link the narrow CM-BI-EXEC-001 child
issue under #9, then bind the branch and PR to that issue. Do not start
Superset, SQL Lab, DuckDB, Arrow, Pandera, Vega-Lite, live CRM/ERP connectors,
provider calls or production/customer/employee evidence in this phase.
