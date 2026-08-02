#!/usr/bin/env bash
set -euo pipefail

cm_bld001_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cm_bld001_compose="$cm_bld001_root/demo/builder-agent/compose.yaml"
cm_bld001_project="${CM_BLD001_PROJECT:-chimpmaera-bld001-builder}"
cm_bld001_profile=bld001
cm_bld001_label='io.chimpmaera.fixture=bld001-builder-agent-g6-v1'

cm_bld001_compose_cmd() {
  CM_BLD001_PROJECT="$cm_bld001_project" docker compose \
    --profile "$cm_bld001_profile" \
    --project-name "$cm_bld001_project" \
    --file "$cm_bld001_compose" "$@"
}

cm_bld001_fail() {
  printf >&2 'BLD-001 ERROR: %s\n' "$*"
  exit 1
}

cm_bld001_owned_ids() {
  local kind="$1"
  case "$kind" in
    containers) docker ps -aq --filter "label=$cm_bld001_label" ;;
    networks) docker network ls -q --filter "label=$cm_bld001_label" ;;
    volumes) docker volume ls -q --filter "label=$cm_bld001_label" ;;
    *) cm_bld001_fail "unknown owned resource kind: $kind" ;;
  esac
}
