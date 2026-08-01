#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=demo/managed-skill-lifecycle/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

run_id="aas037-$(date -u +%Y%m%dT%H%M%SZ)"
run_dir="$cm_aas037_root/.chimpmaera-aas037/runs/$run_id"
mkdir -p "$run_dir"
cleanup_needed=true
owner_account_home="$(getent passwd "$(id -un)" | cut -d: -f6)"
owner_config_path="$owner_account_home/.openclaw/openclaw.json"
owner_fingerprint() {
  {
    ps -eo pid=,lstart=,args= | awk '/\/usr\/lib\/node_modules\/openclaw\/dist\/index.js gateway --port 18789|[v]llm/ {if ($0 !~ /awk/) print}'
    if [ -e "$owner_config_path" ]; then stat --printf='%n %s %Y %i\n' "$owner_config_path"; fi
  } | sha256sum | cut -d' ' -f1
}
capture_logs() { cm_aas037_compose_cmd logs --no-color > "$run_dir/compose.log" 2>&1 || true; }
on_exit() {
  status=$?
  if [ "$status" -ne 0 ]; then capture_logs; fi
  if [ "$cleanup_needed" = true ]; then "$cm_aas037_root/demo/managed-skill-lifecycle/reset.sh" --purge >> "$run_dir/cleanup.log" 2>&1 || true; fi
  exit "$status"
}
trap on_exit EXIT

owner_before="$(owner_fingerprint)"
started_ms="$(date +%s%3N)"
"$cm_aas037_root/demo/managed-skill-lifecycle/setup.sh" > "$run_dir/setup-first.log"
first_agent="$(cm_aas037_compose_cmd ps --quiet openclaw-agent)"
first_manager="$(cm_aas037_compose_cmd ps --quiet skill-manager)"
"$cm_aas037_root/demo/managed-skill-lifecycle/setup.sh" > "$run_dir/setup-idempotent.log"
[ "$first_agent" = "$(cm_aas037_compose_cmd ps --quiet openclaw-agent)" ] || cm_aas037_fail "idempotent setup recreated agent"
[ "$first_manager" = "$(cm_aas037_compose_cmd ps --quiet skill-manager)" ] || cm_aas037_fail "idempotent setup recreated manager"

cm_aas037_compose_cmd ps --format json | jq -sc 'sort_by(.Service)' > "$run_dir/services.json"
docker inspect "$first_agent" > "$run_dir/agent-inspect.json"
docker inspect "$first_manager" > "$run_dir/manager-inspect.json"
jq -e '.[0] as $c | $c.Config.User == "1000:1000" and $c.HostConfig.ReadonlyRootfs and ($c.HostConfig.CapDrop == ["ALL"]) and ($c.HostConfig.SecurityOpt | index("no-new-privileges:true") != null) and ($c.HostConfig.Privileged | not) and (($c.Mounts | map(select(.Type == "bind"))) | length == 0) and (($c.Mounts | map(select(.Destination == "/var/run/docker.sock"))) | length == 0) and (($c.Mounts | map(select(.Destination == "/opt/chimpmaera/workspace/skills" and (.RW | not)))) | length == 1) and (($c.NetworkSettings.Networks | keys) | length == 1)' "$run_dir/agent-inspect.json" >/dev/null
jq -e '.[0] as $c | $c.Config.User == "10001:10001" and $c.HostConfig.ReadonlyRootfs and ($c.HostConfig.CapDrop == ["ALL"]) and ($c.HostConfig.SecurityOpt | index("no-new-privileges:true") != null) and ($c.HostConfig.Privileged | not) and (($c.Mounts | map(select(.Type == "bind"))) | length == 0) and (($c.NetworkSettings.Networks | keys) | length == 1)' "$run_dir/manager-inspect.json" >/dev/null

for probe in mutable-source digest-swap self-approval cross-tenant dependency-confusion unknown-field wrong-identity; do
  cm_aas037_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs "$probe" > "$run_dir/$probe.json"
done
cm_aas037_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs concurrent > "$run_dir/concurrent.json"
cm_aas037_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs replay > "$run_dir/replay.json"
cm_aas037_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs activation-failure > "$run_dir/activation-failure.json"
cm_aas037_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs readback > "$run_dir/readback-before-e2e.json"
jq -e '.installed and (.active | not) and (.materialized | not) and (.grantedCapabilities == [])' "$run_dir/readback-before-e2e.json" >/dev/null

cm_aas037_compose_cmd exec -T openclaw-agent node openclaw.mjs agent \
  --agent main --session-key aas037-e2e \
  --message 'Request, install, separately activate and use the exact Zoo Greeter skill through ChimpMaera. Return both receipts.' \
  --thinking off --timeout 90 --json > "$run_dir/agent-e2e.json"
jq -e '[.. | strings | select(test("skillGreeting=Hello from the Zoo installReceipt=[a-f0-9]{64} activationReceipt=[a-f0-9]{64} authority=NONE"))] | length > 0' "$run_dir/agent-e2e.json" >/dev/null

cm_aas037_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs readback > "$run_dir/readback-active.json"
jq -e '.installed and .active and .materialized and (.grantedCapabilities == []) and (.receipts | length >= 3)' "$run_dir/readback-active.json" >/dev/null
cm_aas037_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs filesystem > "$run_dir/filesystem.json"
cm_aas037_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs egress > "$run_dir/egress.json"
cm_aas037_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs evidence > "$run_dir/evidence.json"
jq -e '.status == "PASS" and .installs == 1 and .activations == 1 and .rollbacks >= 1 and .denials >= 8 and .modelCalls >= 3 and (.receiptDigests | length >= 3) and .active' "$run_dir/evidence.json" >/dev/null

cm_aas037_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs rollback > "$run_dir/rollback.json"
cm_aas037_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs readback > "$run_dir/readback-rolled-back.json"
jq -e '.installed and (.active | not) and (.materialized | not) and (.grantedCapabilities == [])' "$run_dir/readback-rolled-back.json" >/dev/null
cm_aas037_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs reset > "$run_dir/reset-first.json"
cm_aas037_compose_cmd exec -T openclaw-agent node /opt/chimpmaera/fixture-probe.mjs reset > "$run_dir/reset-idempotent.json"

capture_logs
owner_during="$(owner_fingerprint)"
[ "$owner_before" = "$owner_during" ] || cm_aas037_fail "Owner process/config fingerprint changed during fixture"
"$cm_aas037_root/demo/managed-skill-lifecycle/reset.sh" --purge > "$run_dir/cleanup-first.log"
"$cm_aas037_root/demo/managed-skill-lifecycle/reset.sh" --purge > "$run_dir/cleanup-idempotent.log"
cleanup_needed=false
owner_after="$(owner_fingerprint)"
[ "$owner_before" = "$owner_after" ] || cm_aas037_fail "Owner process/config fingerprint changed after rollback"
ended_ms="$(date +%s%3N)"
jq -n --arg schemaVersion chimpmaera.aas037/full-smoke/v1 --arg runId "$run_id" --arg status PASS \
  --arg ownerBefore "$owner_before" --arg ownerDuring "$owner_during" --arg ownerAfter "$owner_after" \
  --argjson elapsedMs "$((ended_ms - started_ms))" --slurpfile services "$run_dir/services.json" --slurpfile evidence "$run_dir/evidence.json" \
  '{schemaVersion:$schemaVersion,runId:$runId,status:$status,elapsedMs:$elapsedMs,ownerFingerprint:{before:$ownerBefore,during:$ownerDuring,after:$ownerAfter},services:$services[0],evidence:$evidence[0],rollback:{ownedRuntimeResidue:0,managedSkillActive:false,receiptsRetainedInRunEvidence:true}}' > "$run_dir/summary.json"
printf 'AAS-037 FULL_SMOKE_PASS run=%s elapsedMs=%s evidence=%s\n' "$run_id" "$((ended_ms - started_ms))" "$run_dir/summary.json"
