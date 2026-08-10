#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-s2.sh"
cm_bd_s2_assert_marker
foreign="$(find "$cm_bd_s2_state" -mindepth 1 -maxdepth 1 ! -name .gitkeep ! -name .chimpmaera-bi-discovery-s2-owned ! -name discovery-s2-password ! -name latest -print -quit)"
[ -z "$foreign" ] || cm_bd_s2_fail 'foreign discovery state denied'
cm_bd_require_demo
cm_bd_root_sql "DROP USER IF EXISTS 'cm_discovery_s2'@'%'; FLUSH PRIVILEGES;"
rm -rf -- "$cm_bd_s2_state/latest"
rm -- "$cm_bd_s2_state/discovery-s2-password" "$cm_bd_s2_marker"
printf 'BI-DISCOVERY-S2 marker-owned profiling principal and artifacts removed; ERP and Superset state preserved.\n'
