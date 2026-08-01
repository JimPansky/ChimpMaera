#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=demo/openclaw-agent/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

run_id="aas035-$(date -u +%Y%m%dT%H%M%SZ)"
run_dir="$cm_aas035_root/.chimpmaera-aas035/runs/$run_id"
mkdir -p "$run_dir/load"
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
  cm_aas035_compose_cmd logs --no-color > "$run_dir/compose.log" 2>&1 || true
}

on_exit() {
  status=$?
  if [ "$status" -ne 0 ]; then capture_logs; fi
  if [ "$cleanup_needed" = true ]; then
    "$cm_aas035_root/demo/openclaw-agent/reset.sh" --purge >> "$run_dir/cleanup.log" 2>&1 || true
  fi
  exit "$status"
}
trap on_exit EXIT

owner_before="$(owner_fingerprint)"
started_ms="$(date +%s%3N)"
"$cm_aas035_root/demo/openclaw-agent/setup.sh" > "$run_dir/setup-first.log"
first_agent_container="$(cm_aas035_compose_cmd ps --quiet openclaw-agent)"
first_gateway_container="$(cm_aas035_compose_cmd ps --quiet capability-gateway)"
"$cm_aas035_root/demo/openclaw-agent/setup.sh" > "$run_dir/setup-idempotent.log"
second_agent_container="$(cm_aas035_compose_cmd ps --quiet openclaw-agent)"
second_gateway_container="$(cm_aas035_compose_cmd ps --quiet capability-gateway)"
[ "$first_agent_container" = "$second_agent_container" ] || cm_aas035_fail "idempotent setup recreated the OpenClaw container"
[ "$first_gateway_container" = "$second_gateway_container" ] || cm_aas035_fail "idempotent setup recreated the Gateway container"

cm_aas035_compose_cmd ps --format json | jq -sc 'sort_by(.Service)' > "$run_dir/services.json"
agent_container="$(cm_aas035_compose_cmd ps --quiet openclaw-agent)"
gateway_container="$(cm_aas035_compose_cmd ps --quiet capability-gateway)"
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

cm_aas035_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs filesystem > "$run_dir/filesystem.json"
cm_aas035_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs egress > "$run_dir/egress.json"
for probe in wrong-identity unknown-action route-bypass cross-tenant oversize; do
  cm_aas035_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs "$probe" > "$run_dir/$probe.json"
done

cm_aas035_compose_cmd exec -T openclaw-agent node openclaw.mjs agent \
  --agent main --session-key aas035-e2e \
  --message 'Create the one authorized synthetic AAS-035 contact through ChimpMaera and report its receipt digest.' \
  --thinking off --timeout 90 --json > "$run_dir/agent-e2e.json"
jq -e '
  (.payloads // .result.payloads // []) as $p
  | ((.. | strings | select(test("receiptDigest=[a-f0-9]{64}"))) | length > 0)
' "$run_dir/agent-e2e.json" >/dev/null

cm_aas035_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs replay > "$run_dir/replay.json"
cm_aas035_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs mind-write > "$run_dir/mind-write.json"
cm_aas035_compose_cmd restart capability-gateway > "$run_dir/gateway-restart.log"
cm_aas035_compose_cmd up --detach --wait capability-gateway >> "$run_dir/gateway-restart.log"
cm_aas035_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs mind-read > "$run_dir/mind-read-after-restart.json"

for index in 1 2 3 4; do
  (
    cm_aas035_compose_cmd exec -T openclaw-agent \
      node /opt/chimpmaera/fixture-probe.mjs replay \
      > "$run_dir/load/$index.json" 2> "$run_dir/load/$index.stderr"
  ) &
done
wait
for result in "$run_dir"/load/*.json; do
  jq -e '.status == "PASS" and .replayState == "REPLAY_SAME_RECEIPT" and (.receiptDigest | test("^[a-f0-9]{64}$"))' "$result" >/dev/null
done

cm_aas035_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs evidence > "$run_dir/evidence-before-reset.json"
jq -e '.status == "PASS" and .counters.effects == 1 and .counters.effectAttempts >= 10 and .counters.modelCalls >= 2 and (.effectReceiptDigests | length == 1)' "$run_dir/evidence-before-reset.json" >/dev/null
cm_aas035_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs reset > "$run_dir/semantic-reset-first.json"
cm_aas035_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs reset > "$run_dir/semantic-reset-idempotent.json"

capture_logs
owner_during="$(owner_fingerprint)"
[ "$owner_before" = "$owner_during" ] || cm_aas035_fail "Owner process/config fingerprint changed during fixture run"
"$cm_aas035_root/demo/openclaw-agent/reset.sh" --purge > "$run_dir/cleanup-first.log"
"$cm_aas035_root/demo/openclaw-agent/reset.sh" --purge > "$run_dir/cleanup-idempotent.log"
cleanup_needed=false
owner_after="$(owner_fingerprint)"
[ "$owner_before" = "$owner_after" ] || cm_aas035_fail "Owner process/config fingerprint changed after fixture rollback"

ended_ms="$(date +%s%3N)"
jq -n \
  --arg schemaVersion chimpmaera.aas035/full-smoke/v1 \
  --arg runId "$run_id" \
  --arg status PASS \
  --arg ownerBefore "$owner_before" \
  --arg ownerDuring "$owner_during" \
  --arg ownerAfter "$owner_after" \
  --argjson elapsedMs "$((ended_ms - started_ms))" \
  --slurpfile services "$run_dir/services.json" \
  --slurpfile evidence "$run_dir/evidence-before-reset.json" \
  '{schemaVersion:$schemaVersion,runId:$runId,status:$status,elapsedMs:$elapsedMs,ownerFingerprint:{before:$ownerBefore,during:$ownerDuring,after:$ownerAfter},services:$services[0],gatewayEvidence:$evidence[0],rollback:{ownedRuntimeResidue:0,receiptsRetainedInRunEvidence:true}}' \
  > "$run_dir/summary.json"
printf 'AAS-035 FULL_SMOKE_PASS run=%s elapsedMs=%s evidence=%s\n' "$run_id" "$((ended_ms - started_ms))" "$run_dir/summary.json"
