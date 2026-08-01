#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=demo/managed-skill-lifecycle/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
purge=false
[ "${1:-}" != --purge ] || purge=true
if [ "$#" -gt 0 ] && [ "${1:-}" != --purge ]; then cm_aas037_fail "only --purge is accepted"; fi
args=(down --remove-orphans)
[ "$purge" != true ] || args+=(--volumes)
cm_aas037_compose_cmd "${args[@]}"
if [ "$purge" = true ]; then
  for image in chimpmaera/aas037-openclaw-agent:local chimpmaera/aas037-skill-manager:local; do
    image_id="$(docker image inspect "$image" --format '{{.Id}}' 2>/dev/null || true)"
    [ -z "$image_id" ] || {
      [ "$(docker image inspect "$image_id" --format '{{index .Config.Labels "io.chimpmaera.fixture"}}')" = aas037-managed-skill-v1 ] || cm_aas037_fail "refusing to remove unowned image $image"
      docker image rm "$image" >/dev/null
    }
  done
  for kind in containers networks volumes; do [ -z "$(cm_aas037_owned_ids "$kind")" ] || cm_aas037_fail "owned $kind residue remains after purge"; done
fi
printf 'AAS-037 owned runtime resources removed%s.\n' "$([ "$purge" = true ] && printf ' including volumes and local derivative images' || true)"
