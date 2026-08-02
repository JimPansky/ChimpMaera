#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=demo/builder-agent/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

purge=false
[ "${1:-}" != --purge ] || purge=true
if [ "$#" -gt 0 ] && [ "${1:-}" != --purge ]; then
  cm_bld001_fail "only --purge is accepted"
fi

down_args=(down --remove-orphans)
[ "$purge" != true ] || down_args+=(--volumes)
cm_bld001_compose_cmd "${down_args[@]}"
if [ "$purge" = true ]; then
  for image in chimpmaera/bld001-builder-agent:local chimpmaera/bld001-builder-gateway:local; do
    image_id="$(docker image inspect "$image" --format '{{.Id}}' 2>/dev/null || true)"
    [ -z "$image_id" ] || {
      [ "$(docker image inspect "$image_id" --format '{{index .Config.Labels "io.chimpmaera.fixture"}}')" = bld001-builder-agent-g6-v1 ] ||
        cm_bld001_fail "refusing to remove unowned image $image"
      docker image rm "$image" >/dev/null
    }
  done
  for kind in containers networks volumes; do
    [ -z "$(cm_bld001_owned_ids "$kind")" ] ||
      cm_bld001_fail "owned $kind residue remains after purge"
  done
fi
printf 'BLD-001 owned runtime resources removed%s.\n' "$([ "$purge" = true ] && printf ' including volumes and local derivative images' || true)"
