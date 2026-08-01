#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=demo/openclaw-agent/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

purge=false
[ "${1:-}" != --purge ] || purge=true
if [ "$#" -gt 0 ] && [ "${1:-}" != --purge ]; then
  cm_aas035_fail "only --purge is accepted"
fi

down_args=(down --remove-orphans)
[ "$purge" != true ] || down_args+=(--volumes)
cm_aas035_compose_cmd "${down_args[@]}"
if [ "$purge" = true ]; then
  for image in chimpmaera/aas035-openclaw-agent:local chimpmaera/aas035-capability-gateway:local; do
    image_id="$(docker image inspect "$image" --format '{{.Id}}' 2>/dev/null || true)"
    [ -z "$image_id" ] || {
      [ "$(docker image inspect "$image_id" --format '{{index .Config.Labels "io.chimpmaera.fixture"}}')" = aas035-openclaw-agent-v1 ] ||
        cm_aas035_fail "refusing to remove unowned image $image"
      docker image rm "$image" >/dev/null
    }
  done
  for kind in containers networks volumes; do
    [ -z "$(cm_aas035_owned_ids "$kind")" ] ||
      cm_aas035_fail "owned $kind residue remains after purge"
  done
fi
printf 'AAS-035 owned runtime resources removed%s.\n' "$([ "$purge" = true ] && printf ' including volumes and local derivative images' || true)"
