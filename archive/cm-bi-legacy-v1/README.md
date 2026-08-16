# Archived ChimpMaera BI ownership evidence

This repository-only archive preserves the historical ChimpMaera BI discovery,
semantic, dashboard, execution and database-analyzer evidence that was removed
from the active product and public release surface by the SBA ownership migration
v2. The source tree is the protected public base
`e04210d7ea123afc51a6023ed6cf0a2e37389d01`; Git moves preserve the original
bytes and `SHA256SUMS` binds every archived file at migration time.

The archive is non-executable and is excluded from release staging. It is not a
supported CM BI runtime, contract, query pack, database adapter, discovery,
KPI/graph/dashboard implementation or Superset route. The supported boundary is
the optional, default-off SBA v0.8.0 / external-contract 2.0.0 client documented
in `docs/EXTERNAL-BI-SERVICE.md`.

Rollback before publication is the isolated branch base above. After a protected
merge, restoration requires a separately reviewed successor PR; never rewrite
main, retag, or replace release assets.
