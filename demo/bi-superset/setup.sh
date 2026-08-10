#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
cm_ss_validate
command -v docker >/dev/null || cm_ss_fail 'Docker is required'
docker info >/dev/null 2>&1 || cm_ss_fail 'Docker daemon unavailable'
mkdir -p "$cm_ss_state"
if [ -e "$cm_ss_marker" ]; then cm_ss_assert_marker; elif find "$cm_ss_state" -mindepth 1 -maxdepth 1 ! -name .gitkeep | grep -q .; then cm_ss_fail 'unmarked non-empty state denied'; else printf 'chimpmaera-bi-superset-m0-v1\n' > "$cm_ss_marker"; fi
chmod 700 "$cm_ss_state"
if [ ! -f "$cm_ss_state/runtime.env" ]; then
  umask 077
  secret="$(openssl rand -hex 32)"; admin="$(openssl rand -base64 24 | tr -d '\n')"; analyst="$(openssl rand -base64 24 | tr -d '\n')"
  printf 'SUPERSET_SECRET_KEY=%s\nCM_BI_ADMIN_PASSWORD=%s\nCM_BI_ANALYST_PASSWORD=%s\n' "$secret" "$admin" "$analyst" > "$cm_ss_state/runtime.env.tmp"
  mv "$cm_ss_state/runtime.env.tmp" "$cm_ss_state/runtime.env"
fi
chmod 600 "$cm_ss_state/runtime.env"
npm run build --silent
node "$cm_ss_root/scripts/render-bi-superset-projection.mjs"
ordinary="$(CM_BI_SUPERSET_PORT="$cm_ss_port" docker compose --project-name "$cm_ss_project" --file "$cm_ss_here/compose.yaml" config --services)"
[ -z "$ordinary" ] || cm_ss_fail 'Superset must remain default-off'
printf 'BI-SUPERSET-M0 setup verified; Superset remains OFF. Analyst password is in %s/runtime.env.\n' "$cm_ss_state"
