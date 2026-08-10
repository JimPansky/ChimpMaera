#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$here/lib.sh"
"$here/setup.sh"
cm_ss_assert_marker; cm_ss_assert_resources
if cm_ss_owned_image >/dev/null; then :; fi
cm_ss_compose up --detach --build --wait
printf 'BI-SUPERSET-M0 READY at http://127.0.0.1:%s/superset/dashboard/chimpmaera-bi004-exact-synthetic/ (user analyst).\n' "$cm_ss_port"
