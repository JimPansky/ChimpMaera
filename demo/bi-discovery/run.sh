#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
start_fixture=false
case "${1:-}" in
  '') ;;
  --start-fixture) start_fixture=true ;;
  *) cm_bd_fail 'usage: run.sh [--start-fixture]' ;;
esac
if [ "$start_fixture" = true ] && [ ! -f "$cm_bd_demo_config" ]; then
  CM_DEMO_MODE=complete CM_AUTHORITY_PROFILE=SAFE_GUIDED CM_DEMO_SEED=yes "$cm_bd_root/demo/install.sh"
fi
"$cm_bd_here/setup.sh"
cm_bd_assert_marker
output="$cm_bd_state/latest"
node "$cm_bd_root/scripts/collect-bi-discovery-s1.mjs" \
  --demo-root "$cm_bd_root" \
  --ground-truth "$cm_bd_root/tests/fixtures/bi-discovery-s1/ground-truth-v1.json" \
  --output "$output"
node "$cm_bd_root/scripts/publish-bi-discovery-superset.mjs" --pack "$output"
printf 'BI-DISCOVERY-S1 evidence and knowledge pack: %s\n' "$output"
