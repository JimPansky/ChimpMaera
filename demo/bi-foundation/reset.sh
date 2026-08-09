#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
cm_bi_preflight
cm_bi_assert_owned_resources
cm_bi_compose_cmd down
cm_bi_inventory_image
if [ "$cm_bi_image_state" = present ]; then
  if ! docker image rm "$cm_bi_image_id" >/dev/null 2>&1; then
    cm_bi_fail 'validated local image removal failed'
  fi
fi
printf 'BI-001 owned resources reset.\n'
