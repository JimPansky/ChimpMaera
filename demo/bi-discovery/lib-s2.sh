#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

cm_bd_s2_state="${CM_BI_DISCOVERY_S2_STATE:-$cm_bd_here/state-s2}"
cm_bd_s2_marker="$cm_bd_s2_state/.chimpmaera-bi-discovery-s2-owned"
cm_bd_s2_fail() { printf >&2 'BI-DISCOVERY-S2 ERROR: %s\n' "$*"; exit 1; }
cm_bd_s2_assert_marker() {
  [ -f "$cm_bd_s2_marker" ] || cm_bd_s2_fail 'state ownership marker missing'
  [ "$(cat "$cm_bd_s2_marker")" = chimpmaera-bi-discovery-s2-v1 ] || cm_bd_s2_fail 'state ownership marker invalid'
}
cm_bd_s2_provision_principal() {
  cm_bd_compose exec -T -e CM_DISCOVERY_S2_PASSWORD doli-db sh -eu -c '
    mariadb --user=root --password="$(cat /run/secrets/root)" --database=dolidb --execute "
      CREATE USER IF NOT EXISTS '\''cm_discovery_s2'\''@'\''%'\'' IDENTIFIED BY \"${CM_DISCOVERY_S2_PASSWORD}\";
      ALTER USER '\''cm_discovery_s2'\''@'\''%'\'' IDENTIFIED BY \"${CM_DISCOVERY_S2_PASSWORD}\";
      REVOKE ALL PRIVILEGES, GRANT OPTION FROM '\''cm_discovery_s2'\''@'\''%'\'';
      GRANT SELECT(rowid, ref, fk_soc, date_commande, fk_statut, total_ht, total_tva, total_ttc, fk_currency, multicurrency_code, tms) ON dolidb.llx_commande TO '\''cm_discovery_s2'\''@'\''%'\'';
      GRANT SELECT(rowid, fk_commande, qty, total_ht, total_tva, total_ttc, product_type) ON dolidb.llx_commandedet TO '\''cm_discovery_s2'\''@'\''%'\'';
      GRANT SELECT(rowid, ref, fk_soc, datef, fk_statut, paye, total_ht, total_tva, total_ttc, fk_currency, multicurrency_code, tms) ON dolidb.llx_facture TO '\''cm_discovery_s2'\''@'\''%'\'';
      GRANT SELECT(rowid, fk_facture, qty, total_ht, total_tva, total_ttc, product_type) ON dolidb.llx_facturedet TO '\''cm_discovery_s2'\''@'\''%'\'';
      GRANT SELECT(rowid, nom, client, fournisseur, status, fk_currency, tms) ON dolidb.llx_societe TO '\''cm_discovery_s2'\''@'\''%'\'';
      FLUSH PRIVILEGES;"
  '
}
