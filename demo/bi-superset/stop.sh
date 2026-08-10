#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
cm_ss_validate; cm_ss_assert_marker; cm_ss_assert_resources; cm_ss_compose down
printf 'BI-SUPERSET-M0 stopped; marker-owned state retained.\n'

