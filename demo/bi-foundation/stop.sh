#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
cm_bi_preflight
cm_bi_compose_cmd down --remove-orphans
printf 'BI-001 foundation stopped.\n'
