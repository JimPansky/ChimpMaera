#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
cm_bi_preflight
cm_bi_compose_cmd down --remove-orphans --volumes
image_id="$(docker image inspect chimpmaera/bi001-foundation:local --format '{{.Id}}' 2>/dev/null || true)"
if [ -n "$image_id" ]; then
  owner="$(docker image inspect "$image_id" --format '{{index .Config.Labels "io.chimpmaera.fixture"}}')"
  [ "$owner" = bi001-foundation-v1 ] || cm_bi_fail 'refusing to remove unowned image'
  docker image rm chimpmaera/bi001-foundation:local >/dev/null
fi
printf 'BI-001 owned resources reset.\n'
