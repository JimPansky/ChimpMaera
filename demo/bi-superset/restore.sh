#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
archive="${1:-$cm_ss_here/backups/bi-superset-m0.tar}"
cm_ss_validate; [ -f "$archive" ] || cm_ss_fail 'backup missing'; cm_ss_assert_marker; cm_ss_assert_resources
[ -z "$(docker ps -q --filter "label=com.docker.compose.project=$cm_ss_project")" ] || cm_ss_fail 'stop Superset before restore'
entries="$(tar -tf "$archive" | sort)"
[ "$entries" = $'.chimpmaera-bi-superset-m0-owned\naccepted.json\nruntime.env\nsemantic.db\nsuperset.db' ] || cm_ss_fail 'backup contains unexpected residue'
[ "$(tar -xOf "$archive" .chimpmaera-bi-superset-m0-owned)" = 'chimpmaera-bi-superset-m0-v1' ] || cm_ss_fail 'backup marker invalid'
find "$cm_ss_state" -mindepth 1 -maxdepth 1 ! -name .gitkeep -delete
tar -xf "$archive" -C "$cm_ss_state" --no-same-owner --no-same-permissions
chmod 700 "$cm_ss_state"; chmod 600 "$cm_ss_state"/* "$cm_ss_marker"
printf 'BI-SUPERSET-M0 marker-verified backup restored without extra entries.\n'
