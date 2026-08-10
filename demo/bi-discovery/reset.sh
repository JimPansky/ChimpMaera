#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
cm_bd_assert_marker
superset_state="$cm_bd_root/demo/bi-superset/state"
projection="$superset_state/discovery-projections.json"
projection_marker="$superset_state/.chimpmaera-bi-discovery-s1-projection-owned.json"
foreign="$(find "$cm_bd_state" -mindepth 1 -maxdepth 1 ! -name .gitkeep ! -name .chimpmaera-bi-discovery-s1-owned ! -name discovery-password ! -name latest -print -quit)"
[ -z "$foreign" ] || cm_bd_fail 'foreign discovery state denied'
if [ -e "$projection" ] || [ -e "$projection_marker" ]; then
  [ -f "$projection" ] && [ -f "$projection_marker" ] || cm_bd_fail 'ambiguous Superset projection ownership'
  expected="$(jq -r .sha256 "$projection_marker")"
  [[ "$expected" =~ ^[a-f0-9]{64}$ ]] || cm_bd_fail 'Superset projection marker invalid'
  [ "$(sha256sum "$projection" | cut -d' ' -f1)" = "$expected" ] || cm_bd_fail 'tampered Superset projection denied'
fi
cm_bd_require_demo
superset_was_running=false
if [ -f "$superset_state/.chimpmaera-bi-superset-m0-owned" ] && docker ps -q --filter 'label=com.docker.compose.project=chimpmaera-bi-superset-m0' --filter 'label=com.docker.compose.service=superset' | grep -q .; then
  superset_was_running=true
  trap '"$cm_bd_root/demo/bi-superset/start.sh" >/dev/null 2>&1 || true' EXIT
  "$cm_bd_root/demo/bi-superset/stop.sh"
fi
if [ -e "$projection" ] || [ -e "$projection_marker" ]; then
  rm -- "$projection" "$projection_marker"
fi
cm_bd_root_sql "DROP USER IF EXISTS 'cm_discovery_s1'@'%'; FLUSH PRIVILEGES;"
rm -rf -- "$cm_bd_state/latest"
rm -- "$cm_bd_state/discovery-password" "$cm_bd_marker"
if [ "$superset_was_running" = true ]; then
  "$cm_bd_root/demo/bi-superset/start.sh"
  trap - EXIT
fi
printf 'BI-DISCOVERY-S1 marker-owned principal, artifacts and Superset projection removed; ERP and Superset state preserved.\n'
