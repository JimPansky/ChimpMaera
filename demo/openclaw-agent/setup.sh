#!/usr/bin/env bash
set -euo pipefail

cm_aas035_setup_source="${BASH_SOURCE[0]}"
case "$cm_aas035_setup_source" in
  /*) ;;
  *)
    cm_aas035_invocation_dir="$(pwd)" || {
      printf >&2 'AAS-035 ERROR: invocation path resolution failed\n'
      exit 1
    }
    cm_aas035_setup_source="$cm_aas035_invocation_dir/$cm_aas035_setup_source"
    ;;
esac
cm_aas035_setup_dir="$(cd -- "${cm_aas035_setup_source%/*}" && pwd)" || {
  printf >&2 'AAS-035 ERROR: setup path resolution failed\n'
  exit 1
}
cm_aas035_verified_root="$(cd -- "$cm_aas035_setup_dir/../.." && pwd)" || {
  printf >&2 'AAS-035 ERROR: repository root resolution failed\n'
  exit 1
}

command -v node >/dev/null || {
  printf >&2 'AAS-035 ERROR: Node.js is required for offline provenance verification\n'
  exit 1
}
host_os="$(uname -s)"
host_arch="$(uname -m)"
node "$cm_aas035_verified_root/scripts/verify-openclaw-agent-runtime-lock.mjs" \
  --host-os "$host_os" --host-arch "$host_arch"
cm_aas035_verified_platform=linux/amd64
case "${DOCKER_DEFAULT_PLATFORM:-}" in
  ""|"$cm_aas035_verified_platform") ;;
  *)
    printf >&2 'AAS-035 ERROR: conflicting DOCKER_DEFAULT_PLATFORM denied (required=%s)\n' \
      "$cm_aas035_verified_platform"
    exit 1
    ;;
esac

# shellcheck source=demo/openclaw-agent/lib.sh
source "$cm_aas035_setup_dir/lib.sh"
[ "$cm_aas035_root" = "$cm_aas035_verified_root" ] ||
  cm_aas035_fail "verified repository root changed while loading fixture helper"
[ "$cm_aas035_platform" = "$cm_aas035_verified_platform" ] ||
  cm_aas035_fail "verified platform changed while loading fixture helper"

command -v docker >/dev/null || cm_aas035_fail "Docker is required"
docker info >/dev/null 2>&1 || cm_aas035_fail "Docker daemon is unavailable"
docker compose version >/dev/null 2>&1 || cm_aas035_fail "Docker Compose v2 is required"

ordinary="$(docker compose --project-name "$cm_aas035_project" --file "$cm_aas035_compose" config --services)"
[ -z "$ordinary" ] || cm_aas035_fail "AAS-035 services must remain absent without the explicit profile"

source_sha256="$({
  sha256sum \
    "$cm_aas035_root/demo/openclaw-agent/gateway.Dockerfile" \
    "$cm_aas035_root/demo/openclaw-agent/openclaw.Dockerfile" \
    "$cm_aas035_root/packages/contracts/src/canonical-json.js" \
    "$cm_aas035_root/packages/contracts/src/capability-catalogue.ts" \
    "$cm_aas035_root/demo/openclaw-agent/capability-m1-4-adapter.mjs" \
    "$cm_aas035_root/demo/openclaw-agent/gateway.mjs" \
    "$cm_aas035_root/demo/openclaw-agent/gateway-state.mjs" \
    "$cm_aas035_root/demo/openclaw-agent/mind-store.mjs" \
    "$cm_aas035_root/demo/openclaw-agent/fixture-probe.mjs" \
    "$cm_aas035_root/demo/openclaw-agent/gateway-workload-contract-v2.json" \
    "$cm_aas035_root/demo/openclaw-agent/openclaw.json" \
    "$cm_aas035_root/demo/openclaw-agent/runtime-contract-v1.json"
  find \
    "$cm_aas035_root/demo/openclaw-agent/plugin" \
    "$cm_aas035_root/demo/openclaw-agent/workspace" \
    -type f -print0 | sort -z | xargs -0 sha256sum
} | sha256sum | cut -d' ' -f1)"

build_fixture_image() {
  local image="$1" dockerfile="$2" current_owner='' current_source=''
  if docker image inspect "$image" >/dev/null 2>&1; then
    current_owner="$(docker image inspect "$image" --format '{{index .Config.Labels "io.chimpmaera.fixture"}}')"
    [ "$current_owner" = aas035-openclaw-agent-v1 ] ||
      cm_aas035_fail "refusing to replace unowned image tag $image"
    current_source="$(docker image inspect "$image" --format '{{index .Config.Labels "io.chimpmaera.fixture.source-sha256"}}')"
  fi
  if [ "$current_source" != "$source_sha256" ]; then
    docker build \
      --platform "$cm_aas035_platform" \
      --provenance=false \
      --build-arg "CM_AAS035_SOURCE_SHA256=$source_sha256" \
      --file "$dockerfile" \
      --tag "$image" \
      "$cm_aas035_root"
  fi
}

build_fixture_image \
  chimpmaera/aas035-capability-gateway:local \
  "$cm_aas035_root/demo/openclaw-agent/gateway.Dockerfile"
build_fixture_image \
  chimpmaera/aas035-openclaw-agent:local \
  "$cm_aas035_root/demo/openclaw-agent/openclaw.Dockerfile"
cm_aas035_compose_cmd up --detach --wait --remove-orphans

agent_id="$(cm_aas035_compose_cmd images --quiet openclaw-agent)"
[ -n "$agent_id" ] || cm_aas035_fail "OpenClaw fixture image was not materialized"
[ "$(docker image inspect "$agent_id" --format '{{index .Config.Labels "io.chimpmaera.fixture"}}')" = aas035-openclaw-agent-v1 ] ||
  cm_aas035_fail "OpenClaw fixture ownership label mismatch"
[ "$(docker image inspect "$agent_id" --format '{{index .Config.Labels "io.chimpmaera.upstream.index-digest"}}')" = sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c ] ||
  cm_aas035_fail "OpenClaw upstream digest binding mismatch"

printf 'AAS-035 isolated OpenClaw fixture READY (project=%s).\n' "$cm_aas035_project"
