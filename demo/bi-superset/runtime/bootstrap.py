import hashlib
import json
import os
import sqlite3
import tempfile
from pathlib import Path

from superset.app import create_app

STATE = Path("/var/lib/chimpmaera-bi")
TENANT = "tenant:synthetic-zoo"
DATASET_UUID = "24021830-0040-4000-8000-000000000004"
DASHBOARD_UUID = "24021830-0050-4000-8000-000000000005"

def accepted_rows():
    projection = json.loads((STATE / "projection.json").read_text())
    assert projection["schemaVersion"] == "chimpmaera.bi/superset-projection/v1"
    assert projection["modelDigest"] == "11c9a4c89b8fcee1a528fb6dbf339aa0460d4d8c02412d6330200e03c154913f"
    assert projection["kpis"]["crmAmountMinor"] == 8750000 and projection["kpis"]["erpOrderTotalMinor"] == 8750000 and projection["kpis"]["reconciliationDeltaMinor"] == 0
    rows = projection["rows"]
    assert len(rows) == 3 and all(row["tenantId"] == TENANT and row["outcome"] == "MATCHED" for row in rows)
    return [(row["canonicalId"], row["tenantId"], row["values"]["currency"], row["outcome"], row["values"]["crmAmountMinor"], row["values"]["erpTotalMinor"], row["values"]["deltaMinor"], row["crmOpportunityId"], row["erpOrderId"], row["lineage"]["erp"]["sourceRecordId"]) for row in rows]

def atomic_projection():
    rows = accepted_rows()
    fd, name = tempfile.mkstemp(prefix="semantic-", suffix=".db", dir=STATE)
    os.close(fd)
    conn = sqlite3.connect(name)
    conn.execute("CREATE TABLE bi004_reconciled_fact (canonical_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL CHECK(tenant_id='tenant:synthetic-zoo'), currency TEXT NOT NULL CHECK(currency='EUR'), outcome TEXT NOT NULL CHECK(outcome='MATCHED'), crm_amount_minor INTEGER NOT NULL, erp_order_total_minor INTEGER NOT NULL, delta_minor INTEGER NOT NULL, crm_opportunity_id TEXT NOT NULL, erp_order_id TEXT NOT NULL, erp_source_record_id TEXT NOT NULL, freshness_state TEXT NOT NULL DEFAULT 'ACCEPTED_AT_2026-08-10T08:30:00Z', trust_marking TEXT NOT NULL DEFAULT 'LOCAL_SYNTHETIC_NON_PRODUCTION_READ_ONLY_NON_AUTHORITY', lineage_model_digest TEXT NOT NULL DEFAULT '11c9a4c89b8fcee1a528fb6dbf339aa0460d4d8c02412d6330200e03c154913f')")
    conn.executemany("INSERT INTO bi004_reconciled_fact (canonical_id,tenant_id,currency,outcome,crm_amount_minor,erp_order_total_minor,delta_minor,crm_opportunity_id,erp_order_id,erp_source_record_id) VALUES (?,?,?,?,?,?,?,?,?,?)", rows)
    conn.execute("CREATE TABLE bi004_foreign_tenant_probe (canonical_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL)")
    conn.execute("INSERT INTO bi004_foreign_tenant_probe VALUES ('canonical:foreign-denied', 'tenant:foreign-probe')")
    conn.commit(); conn.close(); os.chmod(name, 0o600); os.replace(name, STATE / "semantic.db")

def deny_permissions(role):
    forbidden = ("sql lab", "sql query", "database", "dataset", "datasource", "upload", "plugin", "css template", "saved query")
    for permission in list(role.permissions):
        key = f"{permission.permission.name} {permission.view_menu.name}".lower()
        if permission.permission.name in {"can_add", "can_edit", "can_write", "can_delete", "can_upload"} or any(value in key for value in forbidden):
            role.permissions.remove(permission)

app = create_app()
with app.app_context():
    from superset import db
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    atomic_projection()
    sm = app.appbuilder.sm
    admin = sm.find_user(username="cm_admin")
    if not admin:
        admin = sm.add_user("cm_admin", "Synthetic", "Administrator", "admin@localhost.invalid", sm.find_role("Admin"), os.environ["CM_BI_ADMIN_PASSWORD"])
    analyst_role = sm.find_role("ChimpMaera Synthetic Analyst") or sm.add_role("ChimpMaera Synthetic Analyst")
    gamma = sm.find_role("Gamma")
    for permission in gamma.permissions:
        if permission not in analyst_role.permissions:
            analyst_role.permissions.append(permission)
    deny_permissions(analyst_role)
    analyst = sm.find_user(username="analyst")
    if not analyst:
        sm.add_user("analyst", "Synthetic", "Analyst", "analyst@localhost.invalid", analyst_role, os.environ["CM_BI_ANALYST_PASSWORD"])
    database = db.session.query(Database).filter_by(database_name="ChimpMaera BI-004 read-only projection").one_or_none()
    if not database:
        database = Database(database_name="ChimpMaera BI-004 read-only projection", sqlalchemy_uri="sqlite:////var/lib/chimpmaera-bi/semantic.db", allow_dml=False, expose_in_sqllab=False)
        db.session.add(database); db.session.flush()
    dataset = db.session.query(SqlaTable).filter_by(uuid=DATASET_UUID).one_or_none()
    dataset_created = dataset is None
    if not dataset:
        dataset = SqlaTable(uuid=DATASET_UUID, table_name="bi004_reconciled_fact", database=database, is_sqllab_view=False, description="LOCAL SYNTHETIC / NON-PRODUCTION / READ-ONLY / NON-AUTHORITY. Exact accepted BI-004 projection; formulas, lineage, freshness and truth remain in versioned ChimpMaera assets.")
        db.session.add(dataset); db.session.flush()
    if dataset_created:
        dataset.columns = [TableColumn(column_name=name, type=typ, filterable=name in {"canonical_id","tenant_id","currency","outcome"}, groupby=name in {"canonical_id","tenant_id","currency","outcome"}) for name, typ in [("canonical_id","TEXT"),("tenant_id","TEXT"),("currency","TEXT"),("outcome","TEXT"),("crm_amount_minor","INTEGER"),("erp_order_total_minor","INTEGER"),("delta_minor","INTEGER"),("crm_opportunity_id","TEXT"),("erp_order_id","TEXT"),("erp_source_record_id","TEXT"),("freshness_state","TEXT"),("trust_marking","TEXT"),("lineage_model_digest","TEXT")]]
        dataset.metrics = [SqlMetric(metric_name=name, expression=expression, verbose_name=label, description="Canonical BI-004 formula readback; Superset visualization only") for name, expression, label in [("measure:crm-amount-minor","SUM(crm_amount_minor)","CRM amount minor — 8,750,000"),("measure:erp-order-total-minor","SUM(erp_order_total_minor)","ERP order total minor — 8,750,000"),("measure:reconciliation-delta-minor","SUM(delta_minor)","Exact reconciliation delta minor — 0")]]
    db.session.flush()
    datasource_permission = sm.add_permission_view_menu("datasource access", dataset.perm)
    if datasource_permission and datasource_permission not in analyst_role.permissions:
        sm.add_permission_role(analyst_role, datasource_permission)
    charts = []
    chart_specs = [
        ("BI-004 CRM amount minor", "big_number_total", {"metric":"measure:crm-amount-minor","subheader":"EUR minor · accepted synthetic BI-004"}),
        ("BI-004 ERP order total minor", "big_number_total", {"metric":"measure:erp-order-total-minor","subheader":"EUR minor · accepted synthetic BI-004"}),
        ("BI-004 exact delta minor", "big_number_total", {"metric":"measure:reconciliation-delta-minor","subheader":"tolerance 0 · exact"}),
        ("BI-004 reconciled fact detail / drill-through", "table", {"all_columns":["canonical_id","crm_amount_minor","erp_order_total_minor","delta_minor","currency","outcome","freshness_state","trust_marking","lineage_model_digest"],"order_by_cols":[],"row_limit":100,"server_pagination":False}),
    ]
    for index, (title, viz, params) in enumerate(chart_specs, 1):
        chart = db.session.query(Slice).filter_by(slice_name=title).one_or_none()
        payload = {"adhoc_filters":[{"clause":"WHERE","comparator":TENANT,"expressionType":"SIMPLE","operator":"==","sqlExpression":None,"subject":"tenant_id"},{"clause":"WHERE","comparator":"MATCHED","expressionType":"SIMPLE","operator":"==","sqlExpression":None,"subject":"outcome"}],"datasource":f"{dataset.id}__table","viz_type":viz,**params}
        if not chart:
            chart = Slice(slice_name=title, viz_type=viz, datasource_type="table", datasource_id=dataset.id)
            db.session.add(chart)
        chart.params = json.dumps(payload, sort_keys=True); charts.append(chart)
    db.session.flush()
    dashboard = db.session.query(Dashboard).filter_by(uuid=DASHBOARD_UUID).one_or_none()
    if not dashboard:
        dashboard = Dashboard(uuid=DASHBOARD_UUID, dashboard_title="ChimpMaera BI-004 exact synthetic reconciliation", slug="chimpmaera-bi004-exact-synthetic", published=True)
        db.session.add(dashboard)
    dashboard.description = "LOCAL SYNTHETIC · NON-PRODUCTION · READ-ONLY · NON-AUTHORITY · freshness accepted at 2026-08-10T08:30:00Z · lineage model 11c9a4c89b8fcee1a528fb6dbf339aa0460d4d8c02412d6330200e03c154913f"
    dashboard.slices = charts
    db.session.commit()
    marker = {"schemaVersion":"chimpmaera.bi/superset-m0-state/v1","status":"READY","datasetCount":db.session.query(SqlaTable).count(),"dashboardUuid":DASHBOARD_UUID,"datasetUuid":DATASET_UUID,"rowCount":len(accepted_rows()),"kpis":{"crmAmountMinor":8750000,"erpOrderTotalMinor":8750000,"reconciliationDeltaMinor":0},"modelDigest":"11c9a4c89b8fcee1a528fb6dbf339aa0460d4d8c02412d6330200e03c154913f","markings":["LOCAL_SYNTHETIC","NON_PRODUCTION","READ_ONLY","NON_AUTHORITY"]}
    marker["semanticSha256"] = hashlib.sha256((STATE / "semantic.db").read_bytes()).hexdigest()
    temp = STATE / "accepted.json.tmp"; temp.write_text(json.dumps(marker, sort_keys=True)+"\n"); os.chmod(temp,0o600); os.replace(temp, STATE / "accepted.json")
