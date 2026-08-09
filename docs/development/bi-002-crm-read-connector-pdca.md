# BI-002 typed CRM read-only connector PDCA

Status: local synthetic L2 candidate; not deployed, published, activated, or
production-compatible.

Plan/Do: extend BI-001 additively with a frozen v1 TypeScript contract, strict
JSON Schema, deterministic supported-export/API-shaped source, in-memory
adapter, and explicit default-off config. Conservative assumption: BI-M1 needs
only the declared account/opportunity business facts. Risk: future BI needs may
require more fields; fallback is a separately reviewed additive contract
version, never field or permission widening in v1. Review marker: any field,
operation, tenant, scope, freshness, pagination, credential, or source adapter
change.

Check: focused tests cover schema/digest closure, exact source readback,
metadata, pagination, terminal/empty pages, stale and partial exports, malformed
responses, missing credentials, cursor replay/staleness, and denial of writes,
admin/mutation shapes, tenant mismatch, scope widening, undeclared fields and
contract/source drift. Evidence is sanitized and commit-bindable through its
recorded file digests plus the containing DCO commit; no future commit SHA is
claimed inside the artifact.

Act: disable the connector, discard only its scoped synthetic adapter/cache,
and revert the containing change. No external cleanup or data migration exists.
The local fixture proves deterministic connector behavior only; vendor, tenant,
transport, credential, freshness SLA, performance, deployment and production
claims remain unsupported.
