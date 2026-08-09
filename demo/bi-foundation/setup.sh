#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
cm_bi_preflight
command -v docker >/dev/null || cm_bi_fail 'Docker is required'
docker info >/dev/null 2>&1 || cm_bi_fail 'Docker daemon is unavailable'
docker compose version >/dev/null 2>&1 || cm_bi_fail 'Docker Compose v2 is required'
ordinary="$(CM_BI_PORT="$CM_BI_PORT" docker compose --project-name "$cm_bi_project" --file "$cm_bi_compose" config --services)"
[ -z "$ordinary" ] || cm_bi_fail 'services must remain default-off'
printf 'BI-001 setup verified; service remains OFF (project=%s).\n' "$cm_bi_project"
