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

Follow-up review closure: reset now validates all project-labelled container,
network and volume resources plus the local image before any removal, omits
volume deletion because no volume is declared, and remains retry-safe after an
interrupted `compose down`. Lifecycle health uses `/readyz`; `/healthz` remains a
separate process-up endpoint. Deterministic tests prove both READY and NOT_READY,
and prove that image source identity depends only on ordered content digests,
not checkout paths.

Second closure follow-up: local image discovery is a strict absent/present/error
inventory. Only clean absence or one ID with readable owned fixture and source
labels proceeds. Inventory, transport, multiplicity, ID or label ambiguity denies
with generic output. Start verifies a built image before `up`; reset inventories
again after `down` and cannot silently report success after a recheck failure.

Final TOCTOU closure: reset passes the post-down validated immutable image ID to
non-forced removal, never the mutable local tag. A concurrent tag remap therefore
cannot redirect the removal target; changed/remaining references cause a generic
failure with no reset-success claim. Docker offers no atomic inventory/remove
primitive here, so residual local concurrency is bounded by immutable targeting
and fail-closed non-forced removal rather than claimed absent.
