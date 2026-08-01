#!/usr/bin/env bash
set -euo pipefail

cm_aas037_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cm_aas037_compose="$cm_aas037_root/demo/managed-skill-lifecycle/compose.yaml"
cm_aas037_project="${CM_AAS037_PROJECT:-chimpmaera-aas037-skill}"
cm_aas037_profile=aas037
cm_aas037_label='io.chimpmaera.fixture=aas037-managed-skill-v1'

cm_aas037_compose_cmd() {
  CM_AAS037_PROJECT="$cm_aas037_project" docker compose --profile "$cm_aas037_profile" \
    --project-name "$cm_aas037_project" --file "$cm_aas037_compose" "$@"
}
cm_aas037_fail() { printf >&2 'AAS-037 ERROR: %s\n' "$*"; exit 1; }
cm_aas037_owned_ids() {
  case "$1" in
    containers) docker ps -aq --filter "label=$cm_aas037_label" ;;
    networks) docker network ls -q --filter "label=$cm_aas037_label" ;;
    volumes) docker volume ls -q --filter "label=$cm_aas037_label" ;;
    *) cm_aas037_fail "unknown owned resource kind: $1" ;;
  esac
}
