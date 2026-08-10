#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
command -v docker >/dev/null || cm_bd_fail 'Docker is required'
docker info >/dev/null 2>&1 || cm_bd_fail 'Docker daemon unavailable'
cm_bd_require_demo
mkdir -p "$cm_bd_state"
chmod 700 "$cm_bd_state"
if [ -e "$cm_bd_marker" ]; then
  cm_bd_assert_marker
elif find "$cm_bd_state" -mindepth 1 -maxdepth 1 ! -name .gitkeep | grep -q .; then
  cm_bd_fail 'unmarked non-empty state denied'
else
  printf 'chimpmaera-bi-discovery-s1-v1\n' > "$cm_bd_marker"
fi
if [ ! -s "$cm_bd_state/discovery-password" ]; then
  umask 077
  openssl rand -hex 24 > "$cm_bd_state/discovery-password.tmp"
  mv "$cm_bd_state/discovery-password.tmp" "$cm_bd_state/discovery-password"
fi
chmod 600 "$cm_bd_state/discovery-password"
CM_DISCOVERY_PASSWORD="$(cat "$cm_bd_state/discovery-password")"
export CM_DISCOVERY_PASSWORD
[[ "$CM_DISCOVERY_PASSWORD" =~ ^[a-f0-9]{48}$ ]] || cm_bd_fail 'discovery credential format invalid'
cm_bd_provision_principal
unset CM_DISCOVERY_PASSWORD
printf 'BI-DISCOVERY-S1 dedicated metadata-only principal is ready; no scan has run.\n'
