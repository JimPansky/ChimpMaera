#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
cm_bi_preflight
cm_bi_assert_owned_resources
cm_bi_compose_cmd down
printf 'BI-001 foundation stopped.\n'
