# BI-004 Issue #13 semantic reconciliation PDCA

Plan: preserve BI-002/BI-003 V1 and add one default-off, versioned semantic
contract for selected synthetic opportunity/order facts with deterministic IDs,
explicit formulas, complete lineage, fail-closed validation, and no write path.

Do: implement the frozen contract/runtime, JSON Schema, positive fixture,
classification and negative probes, operator guide, evidence binding, DAG node,
public manifest entries, and checksums.

Check: `npm run bi-semantic:test` covers exact KPI source recomputation;
matched, unmatched, ambiguous, duplicate, stale, and conflicting outcomes;
tenant/version/schema/lineage/formula/currency/unit/null/field failures; stable
IDs/report; metadata preservation; and equal before/after input digests with no
attempted write operations. The tested commit is the containing DCO-signed
commit; no future commit is claimed.

Act/rollback: keep V1 default-off. Disable candidate model `1.0.0`, discard only
derived reconciliation reports, and restore the last verified connector
contracts. Never write unresolved decisions to CRM/ERP; conflicts remain
explicit.

Scope is local synthetic contract evidence only. It is not production/vendor
compatibility, accounting correctness, an audit opinion, certification,
deployment, provider onboarding, or infrastructure mutation.
