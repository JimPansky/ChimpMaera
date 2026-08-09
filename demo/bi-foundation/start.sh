#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$here/lib.sh"
"$here/setup.sh"
cm_bi_assert_owned_resources
source_sha256="$(cm_bi_source_sha256 "$here")"
current_source=''
if docker image inspect chimpmaera/bi001-foundation:local >/dev/null 2>&1; then
  owner="$(docker image inspect chimpmaera/bi001-foundation:local --format '{{index .Config.Labels "io.chimpmaera.fixture"}}')"
  [ "$owner" = bi001-foundation-v1 ] || cm_bi_fail 'refusing to replace unowned image'
  current_source="$(docker image inspect chimpmaera/bi001-foundation:local --format '{{index .Config.Labels "io.chimpmaera.fixture.source-sha256"}}')"
fi
if [ "$current_source" != "$source_sha256" ]; then
  docker build --platform linux/amd64 --provenance=false --build-arg "CM_BI_SOURCE_SHA256=$source_sha256" --file "$here/service.Dockerfile" --tag chimpmaera/bi001-foundation:local "$cm_bi_root"
fi
cm_bi_compose_cmd up --detach --wait
printf 'BI-001 foundation READY on http://127.0.0.1:%s (project=%s).\n' "$CM_BI_PORT" "$cm_bi_project"
