#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
cm_bd_assert_marker
foreign="$(find "$cm_bd_state" -mindepth 1 -maxdepth 1 ! -name .gitkeep ! -name .chimpmaera-bi-discovery-s1-owned ! -name discovery-password ! -name latest -print -quit)"
[ -z "$foreign" ] || cm_bd_fail 'foreign discovery state denied'
cm_bd_require_demo
cm_bd_root_sql "DROP USER IF EXISTS 'cm_discovery_s1'@'%'; FLUSH PRIVILEGES;"
rm -rf -- "$cm_bd_state/latest"
rm -- "$cm_bd_state/discovery-password" "$cm_bd_marker"
printf 'BI-DISCOVERY-S1 marker-owned principal and artifacts removed; ERP and external BI state preserved.\n'
