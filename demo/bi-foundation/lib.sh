#!/usr/bin/env bash
set -euo pipefail
cm_bi_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cm_bi_compose="$cm_bi_root/demo/bi-foundation/compose.yaml"
cm_bi_project="${CM_BI_PROJECT:-chimpmaera-bi001}"
cm_bi_config="${CM_BI_CONFIG:-$cm_bi_root/demo/bi-foundation/config.local.json}"
cm_bi_fail() { printf >&2 'BI-001 ERROR: %s\n' "$*"; exit 1; }
cm_bi_preflight() {
  command -v node >/dev/null || cm_bi_fail 'Node.js is required'
  node "$cm_bi_root/scripts/verify-bi-foundation.mjs" --config "$cm_bi_config" --host-os "$(uname -s)" --host-arch "$(uname -m)"
  CM_BI_PORT="$(node -e "const c=require(process.argv[1]); process.stdout.write(String(c.hostPort))" "$cm_bi_config")"
  export CM_BI_PORT
}
cm_bi_compose_cmd() {
  CM_BI_PROJECT="$cm_bi_project" CM_BI_PORT="$CM_BI_PORT" DOCKER_DEFAULT_PLATFORM=linux/amd64 \
    docker compose --profile bi001 --project-name "$cm_bi_project" --file "$cm_bi_compose" "$@"
}
