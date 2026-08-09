# BI-005 Issue #14 dashboard and drill-through PDCA

Plan: preserve all accepted BI-001 through BI-004 V1 contracts and add one
default-off dashboard-set V1 that reads BI-004 KPI fields verbatim. The safe L1
assumption is one synthetic tenant, EUR, and `MATCHED`; future slicing requires
an additive semantic contract rather than dashboard-side recomputation.

Do: add the typed contract/runtime, strict schema, fixed dashboard/request and
negative fixtures, semantic HTML/readback rendering, canonical-ID-only drill,
hashed lineage, explicit state artifacts, focused tests, operator guide,
evidence report, DAG node, public manifest entries, and checksum bindings. The
implementation contains no connector, mutation method, effect dispatch, or
source reference capable of write-back.

Check: `npm run bi-dashboard:test` covers the exact contract/model/formula
binding; direct KPI readback; formula, unit, freshness, trust, filter,
limitation, and lineage visibility; normal/empty/stale/conflict/denied/error
states; deterministic filters and drill-through; tenant swaps; hidden fields;
semantic keyboard structure and contrast; and the named unknown metric,
tenant mismatch/swap, stale model, missing lineage, role-hidden source ID,
missing data, divide-by-zero, conflicting filter, inaccessible interaction,
unavailable source, formula drift, and report-integrity probes. Six sanitized
rendered/readback artifacts are byte-compared. Evidence binds file digests and
the containing DCO-signed commit without claiming a future SHA.

Act: keep dashboard/model V1 disabled by default. Roll back by disabling V1,
discarding only derived readbacks, and returning to the last verified BI-004
read-only view. Never substitute an unverified metric, widen permissions or
filters, disclose hidden lineage, or mutate a source. Review markers are any
model/formula/KPI/filter/freshness/tenant/role/field/sanitizer/accessibility,
activation, or evidence-convention change.

Residual boundary: local deterministic synthetic evidence does not prove a
production service, live provider or tenant controls, real-time behavior,
financial assurance, accessibility certification, deployment, availability,
performance, or protection against a hostile process replacing validated
memory.
