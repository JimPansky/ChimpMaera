#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=demo/builder-agent/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

run_id="bld001-g6-$(date -u +%Y%m%dT%H%M%SZ)"
run_dir="$cm_bld001_root/.chimpmaera-bld001/runs/$run_id"
mkdir -p "$run_dir"
cleanup_needed=true
owner_account_home="$(getent passwd "$(id -un)" | cut -d: -f6)"
owner_config_path="$owner_account_home/.openclaw/openclaw.json"

owner_fingerprint() {
  {
    ps -eo pid=,lstart=,args= | awk '
      /\/usr\/lib\/node_modules\/openclaw\/dist\/index.js gateway --port 18789|[v]llm/ {
        if ($0 !~ /awk/) print
      }'
    if [ -e "$owner_config_path" ]; then
      stat --printf='%n %s %Y %i\n' "$owner_config_path"
    fi
  } | sha256sum | cut -d' ' -f1
}

capture_logs() {
  cm_bld001_compose_cmd logs --no-color > "$run_dir/compose.log" 2>&1 || true
}

on_exit() {
  status=$?
  if [ "$status" -ne 0 ]; then capture_logs; fi
  if [ "$cleanup_needed" = true ]; then
    "$cm_bld001_root/demo/builder-agent/reset.sh" --purge >> "$run_dir/cleanup.log" 2>&1 || true
  fi
  exit "$status"
}
trap on_exit EXIT

owner_before="$(owner_fingerprint)"
started_ms="$(date +%s%3N)"
"$cm_bld001_root/demo/builder-agent/setup.sh" > "$run_dir/setup-first.log"
first_agent_container="$(cm_bld001_compose_cmd ps --quiet builder-agent)"
first_gateway_container="$(cm_bld001_compose_cmd ps --quiet builder-gateway)"
"$cm_bld001_root/demo/builder-agent/setup.sh" > "$run_dir/setup-idempotent.log"
second_agent_container="$(cm_bld001_compose_cmd ps --quiet builder-agent)"
second_gateway_container="$(cm_bld001_compose_cmd ps --quiet builder-gateway)"
[ "$first_agent_container" = "$second_agent_container" ] || cm_bld001_fail "idempotent setup recreated the Builder Agent container"
[ "$first_gateway_container" = "$second_gateway_container" ] || cm_bld001_fail "idempotent setup recreated the Builder Gateway container"

cm_bld001_compose_cmd ps --format json | jq -sc 'sort_by(.Service)' > "$run_dir/services.json"
agent_container="$(cm_bld001_compose_cmd ps --quiet builder-agent)"
gateway_container="$(cm_bld001_compose_cmd ps --quiet builder-gateway)"
docker inspect "$agent_container" > "$run_dir/agent-inspect.json"
docker inspect "$gateway_container" > "$run_dir/gateway-inspect.json"

jq -e '
  .[0] as $c
  | $c.Config.User == "1000:1000"
  and $c.HostConfig.ReadonlyRootfs
  and ($c.HostConfig.CapDrop == ["ALL"])
  and ($c.HostConfig.SecurityOpt | index("no-new-privileges:true") != null)
  and ($c.HostConfig.Privileged | not)
  and $c.HostConfig.PidsLimit == 128
  and $c.HostConfig.Memory == 805306368
  and (($c.Mounts | map(select(.Type == "bind"))) | length == 0)
  and (($c.Mounts | map(select(.Destination == "/var/run/docker.sock"))) | length == 0)
  and (($c.NetworkSettings.Networks | keys) | length == 1)
' "$run_dir/agent-inspect.json" >/dev/null
jq -e '
  .[0] as $c
  | $c.Config.User == "10001:10001"
  and $c.HostConfig.ReadonlyRootfs
  and ($c.HostConfig.CapDrop == ["ALL"])
  and ($c.HostConfig.SecurityOpt | index("no-new-privileges:true") != null)
  and ($c.HostConfig.Privileged | not)
  and (($c.Mounts | map(select(.Type == "bind"))) | length == 0)
  and (($c.NetworkSettings.Networks | keys) | length == 1)
' "$run_dir/gateway-inspect.json" >/dev/null

cm_bld001_compose_cmd exec -T builder-agent node /opt/chimpmaera/fixture-probe.mjs filesystem > "$run_dir/filesystem.json"
cm_bld001_compose_cmd exec -T builder-agent node /opt/chimpmaera/fixture-probe.mjs egress > "$run_dir/egress.json"
cm_bld001_compose_cmd exec -T builder-agent node /opt/chimpmaera/fixture-probe.mjs evidence > "$run_dir/evidence-initial.json"
jq -e '.status == "PASS" and .selectedProfile == "SAFE_GUIDED" and .ownedTargetDrift == 0 and (.receiptDigests | length == 0)' "$run_dir/evidence-initial.json" >/dev/null

for probe in wrong-identity cross-tenant unknown-capability binding-tamper approval-missing post-approval-mutation route-bypass; do
  cm_bld001_compose_cmd exec -T builder-agent node /opt/chimpmaera/fixture-probe.mjs "$probe" > "$run_dir/$probe.json"
done

cm_bld001_compose_cmd exec -T builder-agent node openclaw.mjs agent \
  --agent main --session-key bld001-g6-read \
  --message 'Read the current synthetic habitat temperature through the admitted Builder path and report the verified receipt.' \
  --thinking off --timeout 90 --json > "$run_dir/agent-read-e2e.json"
jq -e '[.. | strings | select(test("operationId=habitat.temperature.read outcome=SYNTHETIC_READ_NO_CHANGE_VERIFIED receiptDigest=[a-f0-9]{64}"))] | length > 0' "$run_dir/agent-read-e2e.json" >/dev/null

cm_bld001_compose_cmd exec -T builder-agent node openclaw.mjs agent \
  --agent main --session-key bld001-g6-write \
  --message 'Execute the one pre-authorized reversible synthetic habitat setpoint change to 23C through the Builder Gateway, prove readback and rollback, and report the verified receipt.' \
  --thinking off --timeout 90 --json > "$run_dir/agent-write-e2e.json"
jq -e '[.. | strings | select(test("operationId=habitat.setpoint.update outcome=SYNTHETIC_REVERSIBLE_WRITE_ROLLBACK_VERIFIED receiptDigest=[a-f0-9]{64}"))] | length > 0' "$run_dir/agent-write-e2e.json" >/dev/null

cm_bld001_compose_cmd exec -T builder-agent node /opt/chimpmaera/fixture-probe.mjs replay > "$run_dir/replay.json"
cm_bld001_compose_cmd exec -T builder-agent node /opt/chimpmaera/fixture-probe.mjs evidence > "$run_dir/evidence-before-restart.json"
jq -e '
  .status == "PASS"
  and .selectedProfile == "SAFE_GUIDED"
  and (.effectiveRights == ["habitat.setpoint.update", "habitat.temperature.read"])
  and .counters.reads == 1
  and .counters.writes == 1
  and .counters.denials >= 7
  and .counters.modelCalls >= 4
  and .ownedTargetDrift == 0
  and .initialTargetDigest == .currentTargetDigest
  and (.receiptDigests | length == 2)
  and (.outcomes | index("SYNTHETIC_READ_NO_CHANGE_VERIFIED") != null)
  and (.outcomes | index("SYNTHETIC_REVERSIBLE_WRITE_ROLLBACK_VERIFIED") != null)
' "$run_dir/evidence-before-restart.json" >/dev/null

cm_bld001_compose_cmd restart builder-gateway > "$run_dir/gateway-restart.log"
cm_bld001_compose_cmd up --detach --wait builder-gateway >> "$run_dir/gateway-restart.log"
cm_bld001_compose_cmd exec -T builder-agent node /opt/chimpmaera/fixture-probe.mjs evidence > "$run_dir/evidence-after-restart.json"
jq -e '.status == "PASS" and .ownedTargetDrift == 0 and (.receiptDigests | length == 2) and .counters.reads == 1 and .counters.writes == 1' "$run_dir/evidence-after-restart.json" >/dev/null

cm_bld001_compose_cmd exec -T builder-agent node /opt/chimpmaera/fixture-probe.mjs reset > "$run_dir/semantic-reset-first.json"
cm_bld001_compose_cmd exec -T builder-agent node /opt/chimpmaera/fixture-probe.mjs reset > "$run_dir/semantic-reset-idempotent.json"
cm_bld001_compose_cmd exec -T builder-agent node /opt/chimpmaera/fixture-probe.mjs evidence > "$run_dir/evidence-after-reset.json"
jq -e '.status == "PASS" and .ownedTargetDrift == 0 and (.receiptDigests | length == 0) and .counters.reads == 0 and .counters.writes == 0' "$run_dir/evidence-after-reset.json" >/dev/null

capture_logs
owner_during="$(owner_fingerprint)"
[ "$owner_before" = "$owner_during" ] || cm_bld001_fail "Owner process/config fingerprint changed during fixture run"
"$cm_bld001_root/demo/builder-agent/reset.sh" --purge > "$run_dir/cleanup-first.log"
"$cm_bld001_root/demo/builder-agent/reset.sh" --purge > "$run_dir/cleanup-idempotent.log"
cleanup_needed=false
owner_after="$(owner_fingerprint)"
[ "$owner_before" = "$owner_after" ] || cm_bld001_fail "Owner process/config fingerprint changed after fixture rollback"

ended_ms="$(date +%s%3N)"
jq -n \
  --arg schemaVersion chimpmaera.builder/g6-full-smoke/v1 \
  --arg runId "$run_id" \
  --arg status PASS \
  --arg ownerBefore "$owner_before" \
  --arg ownerDuring "$owner_during" \
  --arg ownerAfter "$owner_after" \
  --argjson elapsedMs "$((ended_ms - started_ms))" \
  --slurpfile services "$run_dir/services.json" \
  --slurpfile evidence "$run_dir/evidence-before-restart.json" \
  --slurpfile resetEvidence "$run_dir/evidence-after-reset.json" \
  '{schemaVersion:$schemaVersion,runId:$runId,status:$status,elapsedMs:$elapsedMs,ownerFingerprint:{before:$ownerBefore,during:$ownerDuring,after:$ownerAfter},services:$services[0],gatewayEvidence:$evidence[0],resetEvidence:$resetEvidence[0],rollback:{ownedRuntimeResidue:0,receiptsRetainedInRunEvidence:true}}' \
  > "$run_dir/summary.json"
printf 'BLD-001 G6 FULL_SMOKE_PASS run=%s elapsedMs=%s evidence=%s\n' "$run_id" "$((ended_ms - started_ms))" "$run_dir/summary.json"
