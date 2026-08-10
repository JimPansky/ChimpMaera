#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-s2.sh"
command -v docker >/dev/null || cm_bd_s2_fail 'Docker is required'
docker info >/dev/null 2>&1 || cm_bd_s2_fail 'Docker daemon unavailable'
cm_bd_assert_marker
cm_bd_require_demo
mkdir -p "$cm_bd_s2_state"
chmod 700 "$cm_bd_s2_state"
if [ -e "$cm_bd_s2_marker" ]; then
  cm_bd_s2_assert_marker
elif find "$cm_bd_s2_state" -mindepth 1 -maxdepth 1 ! -name .gitkeep | grep -q .; then
  cm_bd_s2_fail 'unmarked non-empty state denied'
else
  printf 'chimpmaera-bi-discovery-s2-v1\n' > "$cm_bd_s2_marker"
fi
if [ ! -s "$cm_bd_s2_state/discovery-s2-password" ]; then
  umask 077
  openssl rand -hex 24 > "$cm_bd_s2_state/discovery-s2-password.tmp"
  mv "$cm_bd_s2_state/discovery-s2-password.tmp" "$cm_bd_s2_state/discovery-s2-password"
fi
chmod 600 "$cm_bd_s2_state/discovery-s2-password"
CM_DISCOVERY_S2_PASSWORD="$(cat "$cm_bd_s2_state/discovery-s2-password")"
export CM_DISCOVERY_S2_PASSWORD
[[ "$CM_DISCOVERY_S2_PASSWORD" =~ ^[a-f0-9]{48}$ ]] || cm_bd_s2_fail 'discovery credential format invalid'
cm_bd_s2_provision_principal
unset CM_DISCOVERY_S2_PASSWORD
printf 'BI-DISCOVERY-S2 opt-in bounded profiling principal is ready; row samples remain disabled.\n'
