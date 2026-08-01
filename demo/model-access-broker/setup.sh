#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
command -v docker >/dev/null || cm_aas036_fail "Docker is required"
docker info >/dev/null 2>&1 || cm_aas036_fail "Docker daemon unavailable"
ordinary="$(docker compose --project-name "$cm_aas036_project" --file "$cm_aas036_compose" config --services)"
[ -z "$ordinary" ] || cm_aas036_fail "services must remain default-off"
source_sha256="$(find "$cm_aas036_root/demo/model-access-broker" -maxdepth 1 -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)"
CM_AAS036_SOURCE_SHA256="$source_sha256" cm_aas036_compose_cmd build --provenance=false
cm_aas036_compose_cmd up --detach --wait --remove-orphans
printf 'AAS-036 isolated model broker READY (project=%s source=%s).\n' "$cm_aas036_project" "$source_sha256"
