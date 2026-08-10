# BI-006 local-synthetic E2E and evidence gate

Status: default-off, L2 local-synthetic verification only. This gate composes the accepted BI-002 CRM fixture, BI-003 ERP fixture, BI-004 zero-tolerance reconciliation, and BI-005 dashboard readback. It does not start or expose a service and has no live provider, credential, write, deployment, or infrastructure path.

## Reproduce

From protected base `28de5f9a3b914865b6e03ff197f6efc24906588c` with this containing DCO-signed change applied:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run bi-e2e:test
```

The gate reports `HEALTHY / READY`, reads three CRM opportunities and three ERP orders, reconciles three rows, and displays CRM `8750000 EUR_MINOR`, ERP `8750000 EUR_MINOR`, and delta `0` at tolerance `0`. Every source fixture is SHA-256 bound before and after run/reset.

State is written atomically beneath a caller-supplied temporary directory. Reset requires `.chimpmaera-bi006-synthetic-state`, removes only `run.json` and its pending file, preserves unrelated files, and is safe to retry. Interrupted runs leave no accepted result; rerun produces the same digest and three rows.

Named probes cover write, tenant, schema, lineage, freshness, replay, unsupported metric, formula drift, duplicate, timeout, interrupted run, interrupted reset, tampered evidence, unavailable source, and identity/version drift. Missing/stale/tampered evidence fails closed.

The sanitized index at `verification/bi-006-e2e-evidence-index-v1.json` binds 9 tests, 44 runtime assertions, 15 named probes, tested commit, model and fixture versions/digests, exact readbacks, claims, non-claims, limitations, artifact digests, and a deterministic secret/privacy scan.

Non-claims: production readiness; live-system compatibility; DMS coverage; audit/compliance assurance; real-time, load, availability, or SLA certification; release; deployment; and infrastructure behavior.

Rollback: disable BI services/connectors, remove only marker-verified synthetic BI-006 state, restore the last verified default-off baseline, and retain failed probe readbacks as negative evidence. Review markers are any source/model/fixture/commit identity, tolerance, claim, probe, reset scope, or evidence digest change.
