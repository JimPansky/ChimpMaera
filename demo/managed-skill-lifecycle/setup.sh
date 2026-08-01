#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=demo/managed-skill-lifecycle/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

command -v docker >/dev/null || cm_aas037_fail "Docker is required"
docker info >/dev/null 2>&1 || cm_aas037_fail "Docker daemon is unavailable"
[ "$(uname -s)" = Linux ] || cm_aas037_fail "Linux is required"
[ "$(uname -m)" = x86_64 ] || cm_aas037_fail "linux/amd64 is required"
[ -z "$(docker compose --project-name "$cm_aas037_project" --file "$cm_aas037_compose" config --services)" ] || cm_aas037_fail "services must remain absent without profile"

source_sha256="$({
  find "$cm_aas037_root/demo/managed-skill-lifecycle" -type f \
    ! -name 'smoke.sh' ! -name 'setup.sh' ! -name 'reset.sh' ! -name 'lib.sh' -print0 | sort -z | xargs -0 sha256sum
} | sha256sum | cut -d' ' -f1)"
build_image() {
  local image="$1" dockerfile="$2" current_owner='' current_source=''
  if docker image inspect "$image" >/dev/null 2>&1; then
    current_owner="$(docker image inspect "$image" --format '{{index .Config.Labels "io.chimpmaera.fixture"}}')"
    [ "$current_owner" = aas037-managed-skill-v1 ] || cm_aas037_fail "refusing to replace unowned image $image"
    current_source="$(docker image inspect "$image" --format '{{index .Config.Labels "io.chimpmaera.fixture.source-sha256"}}')"
  fi
  if [ "$current_source" != "$source_sha256" ]; then
    docker build --provenance=false --build-arg "CM_AAS037_SOURCE_SHA256=$source_sha256" \
      --file "$dockerfile" --tag "$image" "$cm_aas037_root"
  fi
}
build_image chimpmaera/aas037-skill-manager:local "$cm_aas037_root/demo/managed-skill-lifecycle/manager.Dockerfile"
build_image chimpmaera/aas037-openclaw-agent:local "$cm_aas037_root/demo/managed-skill-lifecycle/openclaw.Dockerfile"
cm_aas037_compose_cmd up --detach --wait --remove-orphans
[ "$(docker image inspect chimpmaera/aas037-openclaw-agent:local --format '{{index .Config.Labels "io.chimpmaera.upstream.index-digest"}}')" = sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c ] || cm_aas037_fail "upstream digest mismatch"
printf 'AAS-037 isolated managed skill fixture READY (project=%s).\n' "$cm_aas037_project"
