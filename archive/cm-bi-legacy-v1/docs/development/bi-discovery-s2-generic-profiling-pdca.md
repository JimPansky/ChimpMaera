# BI Discovery Stage 2 bounded profiling PDCA

Issue: #188  
Stage 1 prerequisite: #187 / `v0.2.0-poc.20260810.6`

## Plan

Deliver the smallest bounded database-analysis slice for Issue #188: a small internal normalized observation contract keeps validation deterministic, MariaDB is the only engine adapter, and Dolibarr 22.0.3 sales orders/invoices selection, identifiers, recomputation, fixture knowledge, and demonstration labels remain outside that validator. Superset receives only one approved aggregate profile projection.

Assumption: a minimal normalized observation contract is sufficient to keep this one MariaDB/Dolibarr implementation testable without introducing a profiling platform. Risk: engine or application vocabulary could leak through the validator or the design could read as a generic product claim. Fallback: move leaked concepts to the MariaDB adapter or Dolibarr fixture layer and keep all release claims scoped to Issue #188 only.

## Do

- `core.mjs` defines the bounded request, observation validation, deterministic facts, candidate classifications, immutable review, approval, and curated projection.
- `mariadb-adapter.mjs` is the sole location for engine-specific SQL and raw-result normalization.
- `dolibarr-fixture.mjs` owns the pinned application allowlist/bindings, domain mapping, recomputation-derived knowledge, and demonstration projection specification.
- `superset-consumer.mjs` rejects anything except an approved profile plus its bound curated projection and declares `directSourceRoute: false`.
- Synthetic validator tests do not use application or engine fixtures. MariaDB/Dolibarr integration tests cover the one real adapter/application pair.

## Check

Focused Stage 2 tests: 9/9 pass. Stage 1 regression tests: 11/11 pass. Static boundary acceptance reads the core validator source and rejects Dolibarr identifiers, MariaDB/SQL, and engine metadata vocabulary; normalized integration output is separately checked for the same leaks. Denials cover foreign/stale scope binding, excessive selection, row samples, timeout, incomplete/schema-drifted observations, sensitive projection, and approval/projection tampering.

The TypeScript build was not executed at this checkpoint because dependencies are not installed in the isolated worktree (`tsc: not found`). This does not weaken the focused JavaScript contract results; dependency installation and the authoritative final suite remain an architecture-integration gate.

## Act

Keep this as a material architecture checkpoint for owner review. Do not commit, push, open a PR, merge, release, or begin #189/#184 until the main-agent architecture gate accepts the split. Rollback before publication is deletion of this dedicated branch/worktree; after publication, correction requires the protected PR path.

Non-claims: no second engine, universal connector framework, plugin SDK, generic profiling/data-quality platform, direct Superset source access, row samples, automatic business semantics, write-back, production readiness, DataHub, or OpenMetadata.
