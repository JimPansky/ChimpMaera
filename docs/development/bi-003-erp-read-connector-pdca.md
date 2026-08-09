# BI-003 typed ERP read-only connector PDCA

Status: local-synthetic L2 candidate; not deployed, published, activated, or
production-compatible.

Plan/Do: add a frozen ERP v1 contract, strict schema, deterministic supported
export, in-memory adapter, and explicit default-off BI-001 declaration without
changing CRM v1. Conservative assumption: BI-M1 needs only synthetic identity,
status/date, and integer EUR minor-unit customer/order/invoice facts. Risk:
future BI work may need additional fields. Fallback is a separately reviewed
additive contract version, never widening v1. Review/rollback marker: any field,
operation, identity, tenant, scope, freshness, cursor, credential, source shape,
or activation change.

Check: deterministic tests cover schema/digest closure, exact facts and metadata,
all entities, explicit source readback, pagination, terminal/empty pages, stale,
partial and malformed exports, cursor replay/staleness, missing credential,
tenant/identity/scope/field widening, mutation-shaped requests, every named
create/post/approve/write/update/delete/admin probe, and broad database access.
Evidence is sanitized, file-digest bound, and bound truthfully to its containing
DCO commit without predeclaring a future SHA.

Act: disable the connector, remove only its synthetic adapter/cache, and revert
BI-003. No external cleanup exists. Vendor compatibility, live transport,
credentials, real records, accounting correctness, freshness SLA, deployment,
production activation, and all mutations remain unsupported.
