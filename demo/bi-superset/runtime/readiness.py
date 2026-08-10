import json
import sqlite3
import urllib.request

try:
    with urllib.request.urlopen("http://127.0.0.1:8088/health", timeout=2) as response:
        assert response.status == 200 and response.read().strip() == b"OK"
    db = sqlite3.connect("file:/var/lib/chimpmaera-bi/semantic.db?mode=ro", uri=True)
    row = db.execute("SELECT COUNT(*), SUM(crm_amount_minor), SUM(erp_order_total_minor), SUM(delta_minor) FROM bi004_reconciled_fact").fetchone()
    assert row == (3, 8750000, 8750000, 0)
    marker = json.load(open("/var/lib/chimpmaera-bi/accepted.json", encoding="utf-8"))
    assert marker["status"] == "READY" and marker["baseDatasetCount"] == 1
    assert marker["datasetCount"] == 1 + marker["discoveryProjectionCount"]
    if marker["discoveryProjectionCount"]:
        assert marker["discoveryProjectionCount"] == 3 and len(marker["discoverySourceDigest"]) == 64
        for table in ("cm_discovery_inventory", "cm_discovery_relationships", "cm_discovery_coverage"):
            assert db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] > 0
    if marker.get("s2DiscoveryProjectionCount"):
        assert marker["s2DiscoveryProjectionCount"] == 1 and len(marker["s2DiscoveryProfileDigest"]) == 64
        assert db.execute("SELECT COUNT(*), SUM(total_ttc) FROM cm_discovery_s2_sales_profile").fetchone() == (2, 298201)
except Exception:
    raise SystemExit(1)
