#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$here/lib.sh"
"$here/setup.sh"
cm_bi_assert_owned_resources
source_sha256="$(cm_bi_source_sha256 "$here")"
if [ "$cm_bi_image_state" = absent ] || [ "$cm_bi_image_source" != "$source_sha256" ]; then
  docker build --platform linux/amd64 --provenance=false --build-arg "CM_BI_SOURCE_SHA256=$source_sha256" --file "$here/service.Dockerfile" --tag chimpmaera/bi001-foundation:local "$cm_bi_root"
  cm_bi_inventory_image
  [ "$cm_bi_image_state" = present ] && [ "$cm_bi_image_source" = "$source_sha256" ] ||
    cm_bi_fail 'local image build verification failed'
fi
cm_bi_compose_cmd up --detach --wait
printf 'BI-001 foundation READY on http://127.0.0.1:%s (project=%s).\n' "$CM_BI_PORT" "$cm_bi_project"
