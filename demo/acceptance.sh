#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state="$root/.chimpmaera-demo"
evidence="$root/.chimpmaera-acceptance"
scenario="${1:-}"
attempt="${2:-}"
acceptance_project="${CM_ACCEPTANCE_PROJECT:-chimpmaera-v02-aw-acceptance}"
acceptance_chimp_port="${CM_ACCEPTANCE_CHIMP_PORT:-127.0.0.1:7790}"
acceptance_espo_port="${CM_ACCEPTANCE_ESPO_PORT:-127.0.0.1:7791}"
acceptance_doli_port="${CM_ACCEPTANCE_DOLI_PORT:-127.0.0.1:7792}"

usage() {
  printf >&2 'Usage: %s SCENARIO ATTEMPT\n' "$0"
  printf >&2 'Scenarios: SAFE_DEMO_COLD RAMPAGE_LAB_COLD MINIMAL_NO_SEED_COLD SAFE_DEMO_WARM_RERUN FULL_CLEANUP_REINSTALL\n'
  exit 2
}

[ -n "$scenario" ] && [[ "$attempt" =~ ^[0-9]+$ ]] || usage
case "$scenario" in
  SAFE_DEMO_COLD|RAMPAGE_LAB_COLD|MINIMAL_NO_SEED_COLD|SAFE_DEMO_WARM_RERUN|FULL_CLEANUP_REINSTALL) ;;
  *) usage ;;
esac

run_dir="$evidence/runs/$scenario-$(printf '%02d' "$attempt")"
[ ! -e "$run_dir" ] || {
  printf >&2 'Acceptance evidence already exists: %s\n' "$run_dir"
  exit 1
}
install -d -m 700 "$run_dir"
started_utc="$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
started_mono="$(awk '{printf "%d", $1 * 1000}' /proc/uptime)"
status=FAIL
error=''

finish() {
  local code="$?" ended_utc ended_mono elapsed
  trap - EXIT
  ended_utc="$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
  ended_mono="$(awk '{printf "%d", $1 * 1000}' /proc/uptime)"
  elapsed="$((ended_mono - started_mono))"
  if [ "$code" -ne 0 ]; then
    error="COMMAND_FAILED_EXIT_$code"
  fi
  jq -n \
    --arg scenario "$scenario" \
    --argjson attempt "$attempt" \
    --arg status "$status" \
    --arg error "$error" \
    --arg startedUtc "$started_utc" \
    --arg endedUtc "$ended_utc" \
    --argjson elapsedMs "$elapsed" \
    '{
      schemaVersion:"chimpmaera.demo/acceptance-run/v1",
      scenario:$scenario,
      attempt:$attempt,
      status:$status,
      error:(if $error == "" then null else $error end),
      startedUtc:$startedUtc,
      endedUtc:$endedUtc,
      elapsedMs:$elapsedMs
    }' >"$run_dir/acceptance.json"
  chmod 600 "$run_dir/acceptance.json"
  exit "$code"
}
trap finish EXIT

docker_inventory() {
  local owned_project="${1:-}"
  local owned_volumes=''
  if [ -n "$owned_project" ]; then
    owned_containers="$(
      docker ps -aq --filter "label=com.docker.compose.project=$owned_project"
    )"
    if [ -n "$owned_containers" ]; then
      owned_volumes="$(
        docker inspect $owned_containers |
          jq -r '.[].Mounts[]|select(.Type == "volume")|.Name'
      )"
    fi
  fi
  jq -n \
    --arg containers "$(
      while IFS= read -r id; do
        [ "$(docker inspect --format \
          '{{index .Config.Labels "com.docker.compose.project"}}' "$id")" \
          = "$owned_project" ] || printf '%s\n' "$id"
      done < <(docker ps -aq)
      )" \
    --arg volumes "$(
      while IFS= read -r name; do
        label="$(
          docker volume inspect --format \
            '{{index .Labels "com.docker.compose.project"}}' "$name"
        )"
        if [ "$label" != "$owned_project" ] &&
           [[ $'\n'"$owned_volumes"$'\n' != *$'\n'"$name"$'\n'* ]]; then
          printf '%s\n' "$name"
        fi
      done < <(docker volume ls -q)
      )" \
    --arg networks "$(
      while IFS= read -r id; do
        [ "$(docker network inspect --format \
          '{{index .Labels "com.docker.compose.project"}}' "$id")" \
          = "$owned_project" ] || printf '%s\n' "$id"
      done < <(docker network ls -q)
      )" \
    --arg images "$(
      while IFS= read -r id; do
        [ "$(docker image inspect --format \
          '{{index .Config.Labels "io.chimpmaera.demo.owner"}}' "$id")" \
          = chimpmaera-v01-playable-installer ] || printf '%s\n' "$id"
      done < <(docker image ls -aq | sort -u)
      )" \
    '{
      containers:($containers|split("\n")|map(select(length > 0))|sort),
      volumes:($volumes|split("\n")|map(select(length > 0))|sort),
      networks:($networks|split("\n")|map(select(length > 0))|sort),
      images:($images|split("\n")|map(select(length > 0))|sort)
    }'
}

archive_install() {
  local suffix="${1:-}"
  cp "$state/public/config.json" "$run_dir/config${suffix}.json"
  cp "$state/readback.json" "$run_dir/readback${suffix}.json"
  cp -L "$state/journal/latest-summary.json" "$run_dir/latest-summary${suffix}.json"
  events_path="$(jq -r '.eventsPath' "$run_dir/latest-summary${suffix}.json")"
  cp "$events_path" "$run_dir/events${suffix}.jsonl"
}

assert_readback() {
  local mode="$1" profile="$2" seed="$3" file="$4"
  jq -e \
    --arg mode "$mode" --arg profile "$profile" --arg seed "$seed" \
    '.status == "READY_VERIFIED"
     and .releaseStatus == "LOCAL_DEMO_ONLY_PUBLICATION_SEPARATE"
     and .selected == {
       mode:$mode,
       authorityProfile:$profile,
       seed:$seed,
       dms:"off",
       selectionSha256:.selected.selectionSha256
     }
     and .runningServices == ["chimpmaera","doli-db","dolibarr","espo-db","espocrm"]
     and .providerBootstrap.exactIdentityCounts == {
       companies:1,personas:3,rolesPerProvider:3,crossProviderMappings:3
     }
     and .providerBootstrap.catalog.exactCounts == {
       templates:3,useCases:6,metadataRecords:3
     }
     and .providerBootstrap.usersMapped == true
     and .providerBootstrap.metadataLoaded == true
     and .providerBootstrap.seedVerified == true
     and .chimpmaeraRuntime.health == "PASS"
     and .chimpmaeraRuntime.selectedAuthorityProfile == $profile
     and .chimpmaeraRuntime.isolation.verified == true
     and (if $profile == "RAMPAGE"
          then .chimpmaeraRuntime.enforcedChimpMaeraProfile == "FULL_CONTROL_LAB"
          else .chimpmaeraRuntime.enforcedChimpMaeraProfile == "SAFE_GUIDED"
          end)
     and (if $seed == "yes"
          then .providerBootstrap.authenticatedFixtureCounts == {
            crmAccounts:8,crmContacts:10,crmOpportunities:8,
            erpOwnCompanies:1,erpThirdParties:7,erpOrders:8,erpOrderLines:15,
            operationalObjects:57,proofScenarios:1,backgroundDemoOrders:7,
            governedFlows:1
          }
          and .providerBootstrap.governedCrmToErpFlow.status == "PASS"
          and .providerBootstrap.governedCrmToErpFlow.knownInstallerGovernanceBypass
            == false
          and .providerBootstrap.governedCrmToErpFlow.evidenceEligibility
            == "CURRENT_BYTE_GATE_ENFORCED"
          and .providerBootstrap.governedCrmToErpFlow.enforcementPoint
            == "CHIMPMAERA_RUNTIME_MUTATION_GATE_V1"
          and .providerBootstrap.governedCrmToErpFlow.effectReceipt.outcome
            == "PROVIDER_MUTATION_READBACK_VERIFIED"
          and (.providerBootstrap.governedCrmToErpFlow.effectReceipt.receiptDigest
            | test("^[a-f0-9]{64}$"))
          else .providerBootstrap.authenticatedFixtureCounts == {
            crmAccounts:1,crmContacts:0,crmOpportunities:0,
            erpOwnCompanies:1,erpThirdParties:0,erpOrders:0,erpOrderLines:0,
            operationalObjects:2,proofScenarios:0,backgroundDemoOrders:0,
            governedFlows:0
          }
          and .providerBootstrap.governedCrmToErpFlow.status
            == "NOT_APPLICABLE_SEED_DISABLED"
          end)' "$file" >/dev/null
}

run_install() {
  local mode="$1" profile="$2" seed="$3"
  if [ "$profile" = RAMPAGE ]; then
    CM_DEMO_MODE="$mode" \
    CM_AUTHORITY_PROFILE="$profile" \
    CM_DEMO_SEED="$seed" \
    CM_DEMO_PROJECT="$acceptance_project" \
    CM_CHIMP_PORT="$acceptance_chimp_port" \
    CM_ESPO_PORT="$acceptance_espo_port" \
    CM_DOLI_PORT="$acceptance_doli_port" \
    CM_RAMPAGE_CONFIRM=I_UNDERSTAND_LOCAL_DEMO_ONLY \
      "$root/demo/install.sh"
  else
    CM_DEMO_MODE="$mode" \
    CM_AUTHORITY_PROFILE="$profile" \
    CM_DEMO_SEED="$seed" \
    CM_DEMO_PROJECT="$acceptance_project" \
    CM_CHIMP_PORT="$acceptance_chimp_port" \
    CM_ESPO_PORT="$acceptance_espo_port" \
    CM_DOLI_PORT="$acceptance_doli_port" \
      "$root/demo/install.sh"
  fi
}

purge_owned() {
  if [ -f "$state/config.env" ]; then
    "$root/demo/uninstall.sh" --purge
  fi
}

assert_owned_residue_zero() {
  local project="$1"
  [ ! -e "$state" ]
  [ -z "$(docker ps -aq --filter "label=com.docker.compose.project=$project")" ]
  [ -z "$(docker volume ls -q --filter "label=com.docker.compose.project=$project")" ]
  [ -z "$(docker network ls -q --filter "label=com.docker.compose.project=$project")" ]
  [ -z "$(
    docker image ls -q --filter \
      label=io.chimpmaera.demo.owner=chimpmaera-v01-playable-installer
  )" ]
}

assert_inventory_preserved() {
  local before="$1" after="$2"
  jq -e \
    --argjson after "$(<"$after")" \
    'all(.containers[]; . as $id | ($after.containers|index($id)) != null)
     and all(.volumes[]; . as $id | ($after.volumes|index($id)) != null)
     and all(.networks[]; . as $id | ($after.networks|index($id)) != null)
     and all(.images[]; . as $id | ($after.images|index($id)) != null)' \
    "$before" >/dev/null
}

case "$scenario" in
  SAFE_DEMO_COLD)
    purge_owned
    run_install complete SAFE_GUIDED yes
    archive_install
    assert_readback complete SAFE_GUIDED yes "$run_dir/readback.json"
    "$root/demo/approval-workbench-smoke.sh" \
      "$run_dir/approval-workbench-smoke.json"
    ;;
  RAMPAGE_LAB_COLD)
    purge_owned
    run_install complete RAMPAGE yes
    archive_install
    assert_readback complete RAMPAGE yes "$run_dir/readback.json"
    ;;
  MINIMAL_NO_SEED_COLD)
    purge_owned
    run_install minimal SAFE_GUIDED no
    archive_install
    assert_readback minimal SAFE_GUIDED no "$run_dir/readback.json"
    ;;
  SAFE_DEMO_WARM_RERUN)
    if [ ! -f "$state/config.env" ] ||
       [ "$(sed -n 's/^CM_DEMO_MODE=//p' "$state/config.env")" != complete ] ||
       [ "$(sed -n 's/^CM_AUTHORITY_PROFILE=//p' "$state/config.env")" != SAFE_GUIDED ] ||
       [ "$(sed -n 's/^CM_DEMO_SEED=//p' "$state/config.env")" != yes ]; then
      purge_owned
      run_install complete SAFE_GUIDED yes
    fi
    cp "$state/readback.json" "$run_dir/readback-before.json"
    container_before="$(
      docker compose --env-file "$state/config.env" -f "$root/demo/compose.yaml" \
        ps -q chimpmaera
    )"
    run_install complete SAFE_GUIDED yes
    archive_install
    container_after="$(
      docker compose --env-file "$state/config.env" -f "$root/demo/compose.yaml" \
        ps -q chimpmaera
    )"
    [ "$container_before" = "$container_after" ]
    assert_readback complete SAFE_GUIDED yes "$run_dir/readback.json"
    jq -e --argjson after "$(<"$run_dir/readback.json")" '
      .selected == $after.selected
      and .providerBootstrap.exactIdentityCounts
        == $after.providerBootstrap.exactIdentityCounts
      and .providerBootstrap.roles == $after.providerBootstrap.roles
      and .providerBootstrap.crossProviderMappings
        == $after.providerBootstrap.crossProviderMappings
      and .providerBootstrap.authenticatedFixtureCounts
        == $after.providerBootstrap.authenticatedFixtureCounts
      and .providerBootstrap.governedCrmToErpFlow.source.id
        == $after.providerBootstrap.governedCrmToErpFlow.source.id
      and .providerBootstrap.governedCrmToErpFlow.target.id
        == $after.providerBootstrap.governedCrmToErpFlow.target.id
    ' "$run_dir/readback-before.json" >/dev/null
    ;;
  FULL_CLEANUP_REINSTALL)
    if [ ! -f "$state/config.env" ]; then
      run_install complete SAFE_GUIDED yes
    fi
    project="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' "$state/config.env")"
    owned_image_ref="$(sed -n 's/^CM_CHIMP_IMAGE=//p' "$state/config.env")"
    docker image inspect "$owned_image_ref" >/dev/null
    docker_inventory "$project" >"$run_dir/inventory-before-cleanup.json"
    archive_install -before-cleanup
    purge_owned
    assert_owned_residue_zero "$project"
    docker_inventory "$project" >"$run_dir/inventory-after-cleanup.json"
    assert_inventory_preserved \
      "$run_dir/inventory-before-cleanup.json" \
      "$run_dir/inventory-after-cleanup.json"
    run_install complete SAFE_GUIDED yes
    archive_install
    assert_readback complete SAFE_GUIDED yes "$run_dir/readback.json"
    ;;
esac

status=PASS
