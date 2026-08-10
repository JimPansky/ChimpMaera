#!/usr/bin/env bash
set -euo pipefail

cm_bd_here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cm_bd_root="$(cd "$cm_bd_here/../.." && pwd)"
cm_bd_state="${CM_BI_DISCOVERY_STATE:-$cm_bd_here/state}"
cm_bd_marker="$cm_bd_state/.chimpmaera-bi-discovery-s1-owned"
cm_bd_demo_state="${CM_DEMO_STATE:-$cm_bd_root/.chimpmaera-demo}"
cm_bd_demo_config="$cm_bd_demo_state/config.env"
cm_bd_fail() { printf >&2 'BI-DISCOVERY-S1 ERROR: %s\n' "$*"; exit 1; }
cm_bd_assert_marker() {
  [ -f "$cm_bd_marker" ] || cm_bd_fail 'state ownership marker missing'
  [ "$(cat "$cm_bd_marker")" = chimpmaera-bi-discovery-s1-v1 ] || cm_bd_fail 'state ownership marker invalid'
}
cm_bd_require_demo() {
  [ -f "$cm_bd_demo_config" ] || cm_bd_fail 'owned CM demo fixture is unavailable; run ./demo/install.sh first or use run.sh --start-fixture'
  docker compose --env-file "$cm_bd_demo_config" --file "$cm_bd_root/demo/compose.yaml" ps --status running --services | grep -Fxq doli-db || cm_bd_fail 'Dolibarr MariaDB source is unavailable'
}
cm_bd_compose() {
  docker compose --env-file "$cm_bd_demo_config" --file "$cm_bd_root/demo/compose.yaml" "$@"
}
cm_bd_root_sql() {
  cm_bd_compose exec -T doli-db sh -eu -c 'mariadb --user=root --password="$(cat /run/secrets/root)" --database=dolidb --execute "$1"' sh "$1"
}
cm_bd_provision_principal() {
  cm_bd_compose exec -T -e CM_DISCOVERY_PASSWORD doli-db sh -eu -c '
    mariadb --user=root --password="$(cat /run/secrets/root)" --database=dolidb --execute "
      CREATE USER IF NOT EXISTS '\''cm_discovery_s1'\''@'\''%'\'' IDENTIFIED BY \"${CM_DISCOVERY_PASSWORD}\";
      ALTER USER '\''cm_discovery_s1'\''@'\''%'\'' IDENTIFIED BY \"${CM_DISCOVERY_PASSWORD}\";
      REVOKE ALL PRIVILEGES, GRANT OPTION FROM '\''cm_discovery_s1'\''@'\''%'\'';
      GRANT EVENT, REFERENCES, SHOW VIEW, TRIGGER ON dolidb.* TO '\''cm_discovery_s1'\''@'\''%'\'';
      FLUSH PRIVILEGES;"
  '
}
