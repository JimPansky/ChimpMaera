#!/usr/bin/env bash
set -euo pipefail
cm_bi_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cm_bi_compose="$cm_bi_root/demo/bi-foundation/compose.yaml"
cm_bi_project="${CM_BI_PROJECT:-chimpmaera-bi001}"
cm_bi_config="${CM_BI_CONFIG:-$cm_bi_root/demo/bi-foundation/config.local.json}"
cm_bi_fail() { printf >&2 'BI-001 ERROR: %s\n' "$*"; exit 1; }
cm_bi_source_sha256() {
  local source_dir="$1"
  sha256sum "$source_dir/service.mjs" "$source_dir/service.Dockerfile" |
    awk '{print $1}' | sha256sum | cut -d' ' -f1
}
cm_bi_preflight() {
  command -v node >/dev/null || cm_bi_fail 'Node.js is required'
  [[ "$cm_bi_project" =~ ^[a-z0-9][a-z0-9_-]{0,62}$ ]] || cm_bi_fail 'unsupported project identifier'
  node "$cm_bi_root/scripts/verify-bi-foundation.mjs" --config "$cm_bi_config" --host-os "$(uname -s)" --host-arch "$(uname -m)"
  CM_BI_PORT="$(node -e "const c=require(process.argv[1]); process.stdout.write(String(c.hostPort))" "$cm_bi_config")"
  export CM_BI_PORT
}
cm_bi_assert_owned_resources() {
  local kind ids resource owner
  for kind in container network volume; do
    case "$kind" in
      container) ids="$(docker ps -aq --filter "label=com.docker.compose.project=$cm_bi_project")" ;;
      network) ids="$(docker network ls -q --filter "label=com.docker.compose.project=$cm_bi_project")" ;;
      volume) ids="$(docker volume ls -q --filter "label=com.docker.compose.project=$cm_bi_project")" ;;
    esac
    while IFS= read -r resource; do
      [ -z "$resource" ] && continue
      case "$kind" in
        container) owner="$(docker container inspect "$resource" --format '{{index .Config.Labels "io.chimpmaera.fixture"}}' 2>/dev/null)" || cm_bi_fail 'resource ownership is ambiguous' ;;
        network|volume) owner="$(docker "$kind" inspect "$resource" --format '{{index .Labels "io.chimpmaera.fixture"}}' 2>/dev/null)" || cm_bi_fail 'resource ownership is ambiguous' ;;
      esac
      [ "$owner" = bi001-foundation-v1 ] || cm_bi_fail 'unowned project resource denied'
    done <<< "$ids"
  done
  if docker image inspect chimpmaera/bi001-foundation:local >/dev/null 2>&1; then
    owner="$(docker image inspect chimpmaera/bi001-foundation:local --format '{{index .Config.Labels "io.chimpmaera.fixture"}}' 2>/dev/null)" ||
      cm_bi_fail 'image ownership is ambiguous'
    [ "$owner" = bi001-foundation-v1 ] || cm_bi_fail 'unowned local image denied'
  fi
}
cm_bi_compose_cmd() {
  CM_BI_PROJECT="$cm_bi_project" CM_BI_PORT="$CM_BI_PORT" DOCKER_DEFAULT_PLATFORM=linux/amd64 \
    docker compose --profile bi001 --project-name "$cm_bi_project" --file "$cm_bi_compose" "$@"
}
