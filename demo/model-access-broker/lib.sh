#!/usr/bin/env bash
set -euo pipefail
cm_aas036_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cm_aas036_project="${CM_AAS036_PROJECT:-chimpmaera-aas036-model-broker}"
cm_aas036_compose="$cm_aas036_root/demo/model-access-broker/compose.yaml"
cm_aas036_compose_cmd() {
  docker compose --project-name "$cm_aas036_project" --profile aas036 --file "$cm_aas036_compose" "$@"
}
cm_aas036_fail() { printf 'AAS-036 FAIL: %s\n' "$*" >&2; exit 1; }
