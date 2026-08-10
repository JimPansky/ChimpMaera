#!/usr/bin/env bash
set -euo pipefail
umask 077
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
cm_ss_validate; cm_ss_assert_marker
[ -f "$cm_ss_state/accepted.json" ] && [ -f "$cm_ss_state/superset.db" ] && [ -f "$cm_ss_state/semantic.db" ] || cm_ss_fail 'accepted state unavailable'
destination="${1:-$cm_ss_here/backups/bi-superset-m0.tar}"
mkdir -p "$(dirname "$destination")"
tar --create --file "$destination.tmp" --directory "$cm_ss_state" .chimpmaera-bi-superset-m0-owned runtime.env accepted.json superset.db semantic.db
chmod 0600 "$destination.tmp"
mv "$destination.tmp" "$destination"
chmod 0600 "$destination"
printf 'BI-SUPERSET-M0 backup written to %s.\n' "$destination"
