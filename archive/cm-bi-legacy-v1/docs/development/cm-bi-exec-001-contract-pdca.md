# CM-BI-EXEC-001 governed BI execution spine PDCA

Status: Draft PR #141 local-synthetic contract candidate, integrated with the
protected-main baseline and locally reviewed. No runtime, dashboard, provider,
live connector or production data was activated. Authenticated public readback
confirmed that PR #141 declares `Closes #140`; issue #140 is the linked owning
issue for this slice.

## Plan

Prepare the typed BI execution spine owned by issue #140: intent, source,
semantic model, declarative query plan, execution receipt,
verification report, bounded claim and visualization contracts for three
synthetic PoC questions. Keep the work additive, public-safe and fail-closed.

The slice remains additive and reversible. Traceability is issue #140 → Draft
PR #141. Fallback: keep the PR in Draft until scope and evidence review is
complete, and remove the additive files if review finds an equivalent contract.

## Do

- Added a closed TypeScript verifier and digest helpers for
  `chimpmaera.cm-bi-exec/governed-bi-execution-spine/v1`.
- Added a strict Draft 2020-12 schema.
- Added one positive public-synthetic fixture with three PoC questions.
- Added a 12-case negative matrix covering arbitrary SQL capability, unknown
  source/field, stale and missing lineage, tenant boundary, formula drift,
  unsupported visualization, raw evidence leakage, empty receipts and authority
  claims.
- Added focused tests for schema acceptance, deterministic bindings, canonical
  digest stability, negative probes and seeded leakage denial.
- Bound nested plan, simulated receipt, bounded claim and visualization digests
  to their local content, and checked the committed outer fixture digests.
- Bound each question id to its exact source, entity, metric, unit, grain and
  allowed-field semantics; added allowed-field sensitive-value and
  contradictory-authority probes.
- Added public contract documentation.

## Check

Focused local evidence is `npm run bi-execution-spine:test`. Protected-CI,
documentation, release-integrity and negative-probe results for the reviewed
merge are reported with the delivery commit; local validation is not a release
claim.

## Act

Issue #140 owns this narrow CM-BI-EXEC-001 slice and Draft PR #141 declares
`Closes #140`. Do not start Superset, SQL Lab, DuckDB, Arrow, Pandera,
Vega-Lite, live CRM/ERP connectors, provider calls or
production/customer/employee evidence in this phase.

The source, operation-quality, formula and result digests remain declared
opaque references because their referenced bytes are outside this fixture.
The verifier therefore does not prove formula or answer correctness, provider
readback, or runtime execution.
