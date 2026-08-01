#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
run_id="aas036-$(date -u +%Y%m%dT%H%M%SZ)"
run_dir="$cm_aas036_root/.chimpmaera-aas036/runs/$run_id"
mkdir -p "$run_dir"
cleanup=true
owner_home="$(getent passwd "$(id -un)" | cut -d: -f6)"
owner_config="$owner_home/.openclaw/openclaw.json"
fingerprint() {
  { ps -eo pid=,lstart=,args= | awk '/\/usr\/lib\/node_modules\/openclaw\/dist\/index.js gateway --port 18789|[v]llm/ { if ($0 !~ /awk/) print }'; [ ! -e "$owner_config" ] || stat --printf='%n %s %Y %i\n' "$owner_config"; } | sha256sum | cut -d' ' -f1
}
on_exit() { status=$?; if [ "$cleanup" = true ]; then "$cm_aas036_root/demo/model-access-broker/reset.sh" > "$run_dir/cleanup-on-exit.log" 2>&1 || true; fi; exit "$status"; }
trap on_exit EXIT
before="$(fingerprint)"
started="$(date +%s%3N)"
"$cm_aas036_root/demo/model-access-broker/setup.sh" > "$run_dir/setup.log"
cm_aas036_compose_cmd ps --format json | jq -sc 'sort_by(.Service)' > "$run_dir/services.json"
for service in openclaw-agent capability-gateway model-access-broker synthetic-provider; do
  id="$(cm_aas036_compose_cmd ps --quiet "$service")"
  docker inspect "$id" > "$run_dir/$service-inspect.json"
  jq -e '.[0] | .HostConfig.ReadonlyRootfs and (.HostConfig.CapDrop == ["ALL"]) and (.HostConfig.SecurityOpt | index("no-new-privileges:true") != null) and (.HostConfig.Privileged | not) and ((.Mounts | map(select(.Type == "bind"))) | length == 0) and ((.Mounts | map(select(.Destination == "/var/run/docker.sock"))) | length == 0)' "$run_dir/$service-inspect.json" >/dev/null
done
jq -e '.[0].NetworkSettings.Networks | keys | length == 1' "$run_dir/openclaw-agent-inspect.json" >/dev/null
for probe in direct-paths text tool-candidate secret-leak injection tool-smuggle malformed oversized replay replay-conflict cross-tenant unknown-route timeout; do
  cm_aas036_compose_cmd exec -T capability-gateway node fixture-probe.mjs "$probe" > "$run_dir/$probe.json"
done
cm_aas036_compose_cmd exec -T openclaw-agent node -e 'Promise.all(["http://model-access-broker:8081/healthz","http://synthetic-provider:8082/healthz","https://example.com"].map(async u=>{try{await fetch(u,{signal:AbortSignal.timeout(1000)});throw Error("REACHABLE_"+u)}catch(e){if(String(e).includes("REACHABLE_"))throw e}})).then(()=>console.log(JSON.stringify({status:"PASS"})))' > "$run_dir/agent-direct-egress.json"
cm_aas036_compose_cmd exec -T openclaw-agent node openclaw.mjs agent --agent main --session-key aas036-real-openclaw --message 'Answer with the broker-mediated synthetic model sentence. Do not call tools.' --thinking off --timeout 90 --json > "$run_dir/openclaw-e2e.json"
jq -e '((.. | strings | select(test("broker-mediated synthetic model response";"i"))) | length > 0)' "$run_dir/openclaw-e2e.json" >/dev/null
cm_aas036_compose_cmd exec -T capability-gateway node fixture-probe.mjs evidence > "$run_dir/evidence.json"
jq -e '.status == "PASS" and .broker.rawContentStored == false and .broker.providerCalls >= 10 and .broker.auditCount >= 5 and .broker.receiptCount >= 5 and ([.broker.audits[] | has("text") or has("messages") or has("content")] | any | not)' "$run_dir/evidence.json" >/dev/null
during="$(fingerprint)"
[ "$before" = "$during" ] || cm_aas036_fail "Owner stack fingerprint changed during smoke"
"$cm_aas036_root/demo/model-access-broker/reset.sh" > "$run_dir/reset.log"
cleanup=false
after="$(fingerprint)"
[ "$before" = "$after" ] || cm_aas036_fail "Owner stack fingerprint changed after rollback"
ended="$(date +%s%3N)"
jq -n --arg schemaVersion chimpmaera.aas036/full-smoke/v1 --arg runId "$run_id" --arg status PASS --arg ownerBefore "$before" --arg ownerDuring "$during" --arg ownerAfter "$after" --argjson elapsedMs "$((ended-started))" --slurpfile services "$run_dir/services.json" --slurpfile evidence "$run_dir/evidence.json" '{schemaVersion:$schemaVersion,runId:$runId,status:$status,elapsedMs:$elapsedMs,ownerFingerprint:{before:$ownerBefore,during:$ownerDuring,after:$ownerAfter},services:$services[0],evidence:$evidence[0],rollback:{ownedRuntimeResidue:0}}' > "$run_dir/summary.json"
printf 'AAS-036 FULL_SMOKE_PASS run=%s elapsedMs=%s evidence=%s\n' "$run_id" "$((ended-started))" "$run_dir/summary.json"
