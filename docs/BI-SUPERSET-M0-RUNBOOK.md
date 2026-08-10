# BI-SUPERSET-M0 local Apache Superset slice

This opt-in slice runs real Apache Superset 5.0.0 on localhost and visualizes
one generated, read-only SQLite projection produced by invoking the existing
BI-004 reconciler over its accepted synthetic fixture
report. Superset is not a source of truth: formulas, joins, tenant semantics,
freshness, lineage, and acceptance remain in the versioned BI-002 through
BI-004 assets. Everything displayed is visibly local-synthetic,
non-production, read-only, and non-authoritative.

## Start and acceptance readback

The image is bound to the Linux/amd64 manifest digest. No service or port is
created unless `start.sh` selects the opt-in Compose profile.

```sh
npm ci --ignore-scripts --no-audit --no-fund
./demo/bi-superset/setup.sh       # verifies and creates local secrets; stays off
./demo/bi-superset/start.sh
curl --fail http://127.0.0.1:8088/health
```

Log in as `analyst`; read `CM_BI_ANALYST_PASSWORD` from the mode-0600
`demo/bi-superset/state/runtime.env`. Open the printed dashboard URL. It
contains three KPI visualizations (8,750,000; 8,750,000; 0) and one table
detail/drill-through path with exactly three BI-004 canonical rows. Dataset and
dashboard UUIDs are stable across reimport and restart. Initialization replaces
the semantic projection atomically, then upserts the same database, single
dataset, charts, dashboard, user, and role.

The ordinary analyst role has no SQL Lab, arbitrary SQL, upload, plugin install,
database/dataset/datasource creation or admin, saved-query, CSS-template, or
unsafe template-processing permission. Anonymous/public access is disabled.
The only dataset is fixed to `tenant:synthetic-zoo` and every chart carries the
same tenant and `MATCHED` filters. There is no provider credential or fallback,
and its data network is internal. A second bridge exists only to make the
localhost port work and explicitly disables IP masquerading, so outbound NAT
and silent egress have no route.

## Six hard runbook gates

1. **Fresh/default-off:** `docker compose -f demo/bi-superset/compose.yaml config
   --services` prints nothing. Only `start.sh` enables the profile.
2. **Health/readiness:** `/health` is Superset's real health endpoint. Compose
   readiness additionally reads the projection read-only and proves count 3 and
   exact KPI sums before accepting the marker.
3. **Reimport/restart:** rerun `start.sh`, then stop/start. `accepted.json` must
   retain dataset count 1, the two UUIDs, row count 3, and exact KPI values.
4. **Backup/restore:** while accepted, run `backup.sh`; then `stop.sh`,
   `reset.sh`, `setup.sh`, and `restore.sh`; start again. Restore accepts exactly
   five allowlisted marker/metastore/projection/identity files and rejects extra
   archive residue.
5. **Negative probes:** foreign project labels deny lifecycle mutation; missing
   or changed state markers deny reset/restore; model/config/image drift denies
   verification; a foreign tenant is absent and chart filters cannot fall back;
   the internal network denies egress.
6. **Rollback:** run `stop.sh` and then `reset.sh`. Reset first verifies every
   project resource label and the exact state marker, deletes only immediate
   entries in this slice's state directory, never requests Docker volume or
   orphan deletion. It removes the local image only after its immutable ID and
   ownership label are verified.

Run the focused L2 contract checks with `npm run bi-superset-m0:test`. Live
Docker validation is optional evidence and must use only this project name.

Non-claims: no production readiness, public bind, SSO, full role matrix,
Kubernetes, plugin/SDK/registry, BI-MODULE-REGISTRY-M1, M1 code, live CRM/ERP,
live credentials, financial/audit opinion, multi-tenancy platform, generalized
semantic layer, reporting service, or source-system write-back.
