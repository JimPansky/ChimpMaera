#!/usr/bin/env bash
set -euo pipefail
cm_ss_here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cm_ss_root="$(cd "$cm_ss_here/../.." && pwd)"
cm_ss_state="${CM_BI_SUPERSET_STATE:-$cm_ss_here/state}"
cm_ss_marker="$cm_ss_state/.chimpmaera-bi-superset-m0-owned"
cm_ss_project="${CM_BI_SUPERSET_PROJECT:-chimpmaera-bi-superset-m0}"
cm_ss_port="${CM_BI_SUPERSET_PORT:-8088}"
cm_ss_fail() { printf >&2 'BI-SUPERSET-M0 ERROR: %s\n' "$*"; exit 1; }
cm_ss_validate() {
  [[ "$cm_ss_project" =~ ^[a-z0-9][a-z0-9_-]{0,62}$ ]] || cm_ss_fail 'invalid project name'
  [[ "$cm_ss_port" =~ ^[0-9]+$ ]] && [ "$cm_ss_port" -ge 1024 ] && [ "$cm_ss_port" -le 65535 ] || cm_ss_fail 'invalid port'
  node "$cm_ss_root/scripts/verify-bi-superset-m0.mjs"
}
cm_ss_assert_marker() {
  [ -f "$cm_ss_marker" ] || cm_ss_fail 'state ownership marker missing'
  [ "$(cat "$cm_ss_marker")" = 'chimpmaera-bi-superset-m0-v1' ] || cm_ss_fail 'state ownership marker invalid'
}
cm_ss_assert_resources() {
  local kind resource owner ids
  for kind in container network volume; do
    case "$kind" in
      container) ids="$(docker ps -aq --filter "label=com.docker.compose.project=$cm_ss_project")" ;;
      network) ids="$(docker network ls -q --filter "label=com.docker.compose.project=$cm_ss_project")" ;;
      volume) ids="$(docker volume ls -q --filter "label=com.docker.compose.project=$cm_ss_project")" ;;
    esac
    while IFS= read -r resource; do
      [ -z "$resource" ] && continue
      case "$kind" in
        container) owner="$(docker container inspect "$resource" --format '{{index .Config.Labels "io.chimpmaera.fixture"}}' 2>/dev/null)" || cm_ss_fail 'ambiguous resource ownership' ;;
        *) owner="$(docker "$kind" inspect "$resource" --format '{{index .Labels "io.chimpmaera.fixture"}}' 2>/dev/null)" || cm_ss_fail 'ambiguous resource ownership' ;;
      esac
      [ "$owner" = 'bi-superset-m0-v1' ] || cm_ss_fail 'foreign project resource denied'
    done <<< "$ids"
  done
}
cm_ss_owned_image() {
  local ids owner inspected
  ids="$(docker image ls --quiet --no-trunc --filter 'reference=chimpmaera/bi-superset-m0:local')" || cm_ss_fail 'image inventory unavailable'
  [ -z "$ids" ] && return 1
  [[ "$ids" != *$'\n'* && "$ids" =~ ^sha256:[a-f0-9]{64}$ ]] || cm_ss_fail 'image inventory ambiguous'
  inspected="$(docker image inspect "$ids" --format '{{.Id}}')" || cm_ss_fail 'image metadata unavailable'
  owner="$(docker image inspect "$ids" --format '{{index .Config.Labels "io.chimpmaera.fixture"}}')" || cm_ss_fail 'image metadata unavailable'
  [ "$inspected" = "$ids" ] && [ "$owner" = 'bi-superset-m0-v1' ] || cm_ss_fail 'unowned image denied'
  printf '%s' "$ids"
}
cm_ss_compose() {
  CM_BI_SUPERSET_PROJECT="$cm_ss_project" CM_BI_SUPERSET_PORT="$cm_ss_port" docker compose --project-name "$cm_ss_project" --file "$cm_ss_here/compose.yaml" --profile bi-superset-m0 "$@"
}
