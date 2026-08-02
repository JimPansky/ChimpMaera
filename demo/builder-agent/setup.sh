#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=demo/builder-agent/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

command -v docker >/dev/null || cm_bld001_fail "Docker is required"
docker info >/dev/null 2>&1 || cm_bld001_fail "Docker daemon is unavailable"
docker compose version >/dev/null 2>&1 || cm_bld001_fail "Docker Compose v2 is required"
[ "$(uname -s)" = Linux ] || cm_bld001_fail "Linux is required"
[ "$(uname -m)" = x86_64 ] || cm_bld001_fail "linux/amd64 is required"

ordinary="$(docker compose --project-name "$cm_bld001_project" --file "$cm_bld001_compose" config --services)"
[ -z "$ordinary" ] || cm_bld001_fail "BLD-001 services must remain absent without the explicit profile"

source_sha256="$({
  sha256sum \
    "$cm_bld001_root/demo/builder-agent/gateway.Dockerfile" \
    "$cm_bld001_root/demo/builder-agent/openclaw.Dockerfile" \
    "$cm_bld001_root/demo/builder-agent/gateway.mjs" \
    "$cm_bld001_root/demo/builder-agent/fixture-probe.mjs" \
    "$cm_bld001_root/demo/builder-agent/openclaw.json" \
    "$cm_bld001_root/demo/builder-agent/runtime-contract-v1.json"
  find \
    "$cm_bld001_root/demo/builder-agent/plugin" \
    "$cm_bld001_root/demo/builder-agent/workspace" \
    -type f -print0 | sort -z | xargs -0 sha256sum
} | sha256sum | cut -d' ' -f1)"

build_fixture_image() {
  local image="$1" dockerfile="$2" current_owner='' current_source=''
  if docker image inspect "$image" >/dev/null 2>&1; then
    current_owner="$(docker image inspect "$image" --format '{{index .Config.Labels "io.chimpmaera.fixture"}}')"
    [ "$current_owner" = bld001-builder-agent-g6-v1 ] ||
      cm_bld001_fail "refusing to replace unowned image tag $image"
    current_source="$(docker image inspect "$image" --format '{{index .Config.Labels "io.chimpmaera.fixture.source-sha256"}}')"
  fi
  if [ "$current_source" != "$source_sha256" ]; then
    docker build \
      --provenance=false \
      --build-arg "CM_BLD001_SOURCE_SHA256=$source_sha256" \
      --file "$dockerfile" \
      --tag "$image" \
      "$cm_bld001_root"
  fi
}

build_fixture_image \
  chimpmaera/bld001-builder-gateway:local \
  "$cm_bld001_root/demo/builder-agent/gateway.Dockerfile"
build_fixture_image \
  chimpmaera/bld001-builder-agent:local \
  "$cm_bld001_root/demo/builder-agent/openclaw.Dockerfile"
cm_bld001_compose_cmd up --detach --wait --remove-orphans

agent_id="$(cm_bld001_compose_cmd images --quiet builder-agent)"
[ -n "$agent_id" ] || cm_bld001_fail "OpenClaw Builder fixture image was not materialized"
[ "$(docker image inspect "$agent_id" --format '{{index .Config.Labels "io.chimpmaera.fixture"}}')" = bld001-builder-agent-g6-v1 ] ||
  cm_bld001_fail "OpenClaw Builder fixture ownership label mismatch"
[ "$(docker image inspect "$agent_id" --format '{{index .Config.Labels "io.chimpmaera.upstream.index-digest"}}')" = sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c ] ||
  cm_bld001_fail "OpenClaw upstream digest binding mismatch"

printf 'BLD-001 isolated Builder fixture READY (project=%s).\n' "$cm_bld001_project"
