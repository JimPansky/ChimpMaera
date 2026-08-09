# BI-001 Issue #10 Docker foundation PDCA

Status: local synthetic candidate; not deployed, published, released or production-ready.

Plan/Do: add a default-off two-process BI foundation with digest-bound build
input, locked repository bytes, explicit lifecycle, separated health/readiness,
and least-privilege Compose bounds. It intentionally implements no dashboard or
external connector.

Check: `npm run bi-foundation:test` covers positive provenance/config, fresh
default-off rendering, process-up versus dependency-ready behavior, and negative
mutable input, egress, bind, filesystem, resources, interrupted reset,
missing/unsupported config and host probes. The tested commit is the containing
signed-off issue commit; reproduce it exactly using the operator guide and the
commit SHA in the delivery report. Evidence is synthetic and sanitized.

Act: fallback is to leave the profile absent. Rollback runs the ownership-scoped
reset and reverts the containing commit. Review triggers are any image/version,
network, bind, identity, resource, config-schema or lifecycle change. No live
runtime is required for acceptance; unavailable Docker evidence is reported.
