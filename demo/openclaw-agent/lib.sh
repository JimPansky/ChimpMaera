#!/usr/bin/env bash
set -euo pipefail

cm_aas035_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cm_aas035_compose="$cm_aas035_root/demo/openclaw-agent/compose.yaml"
cm_aas035_project="${CM_AAS035_PROJECT:-chimpmaera-aas035-openclaw}"
cm_aas035_profile=aas035
cm_aas035_label='io.chimpmaera.fixture=aas035-openclaw-agent-v1'

cm_aas035_compose_cmd() {
  CM_AAS035_PROJECT="$cm_aas035_project" docker compose \
    --profile "$cm_aas035_profile" \
    --project-name "$cm_aas035_project" \
    --file "$cm_aas035_compose" "$@"
}

cm_aas035_fail() {
  printf >&2 'AAS-035 ERROR: %s\n' "$*"
  exit 1
}

cm_aas035_owned_ids() {
  local kind="$1"
  case "$kind" in
    containers) docker ps -aq --filter "label=$cm_aas035_label" ;;
    networks) docker network ls -q --filter "label=$cm_aas035_label" ;;
    volumes) docker volume ls -q --filter "label=$cm_aas035_label" ;;
    *) cm_aas035_fail "unknown owned resource kind: $kind" ;;
  esac
}
