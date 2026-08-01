#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
cm_aas036_compose_cmd down --volumes --remove-orphans --rmi local
owned="$(docker ps -a --filter label=io.chimpmaera.aas036.fixture=model-broker-v1 --format '{{.ID}}' | wc -l)"
[ "$owned" -eq 0 ] || cm_aas036_fail "owned container residue remains"
printf 'AAS-036 isolated model broker RESET (project=%s).\n' "$cm_aas036_project"
