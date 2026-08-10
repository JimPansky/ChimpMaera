#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
cm_ss_validate; cm_ss_assert_marker; cm_ss_assert_resources; cm_ss_compose down
if image_id="$(cm_ss_owned_image)"; then docker image rm "$image_id" >/dev/null || cm_ss_fail 'owned image removal failed'; fi
find "$cm_ss_state" -mindepth 1 -maxdepth 1 ! -name .gitkeep -delete
printf 'BI-SUPERSET-M0 marker-verified state and owned local image reset.\n'
