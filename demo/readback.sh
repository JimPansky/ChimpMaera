#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state="$root/.chimpmaera-demo"
config="$state/config.env"
set -a; source "$config"; set +a
provider_bootstrap="$(<"$state/public/provider-bootstrap.json")"
identity_bootstrap="$(<"$state/public/identity-bootstrap.json")"
catalog_bootstrap="$(<"$state/public/catalog-bootstrap.json")"
seed_flow="$(<"$state/public/seed-and-flow.json")"
fixture_manifest="$(
  jq -c . "$root/demo/manifests/fixtures/panskys-zoo-demo-v1.json"
)"
jq -e '
  .status == "PASS"
  and .espocrm.migration == "COMPLETE"
  and .espocrm.authentication == "PASS"
  and .dolibarr.migration == "COMPLETE"
  and .dolibarr.apiModule == "ENABLED"
  and .dolibarr.authentication == "PASS"
' <<<"$provider_bootstrap" >/dev/null
jq -e '
  .status == "PASS"
  and .company.name == "Panskys Zoo Enterprises"
  and .exactCounts.personas == 3
  and .exactCounts.rolesPerProvider == 3
  and .exactCounts.crossProviderMappings == 3
  and (.roles|length) == 3
  and (.mappings|length) == 3
' <<<"$identity_bootstrap" >/dev/null
jq -e '
  .status == "PASS"
  and .authentication == "PASS"
  and .manifest.id == "crm-erp-playable-v1"
  and .exactCounts.templates == 3
  and .exactCounts.useCases == 6
  and .exactCounts.metadataRecords == 3
' <<<"$catalog_bootstrap" >/dev/null
jq -e \
  --arg seed "$CM_DEMO_SEED" \
  --arg fixtureId "$CM_FIXTURE_MANIFEST_ID" \
  --arg fixtureSha256 "$CM_FIXTURE_MANIFEST_SHA256" \
  --argjson seedEnabledExpected "$(jq -c '.expectedCounts.seedEnabled' <<<"$fixture_manifest")" \
  --argjson seedDisabledExpected "$(jq -c '.expectedCounts.seedDisabled' <<<"$fixture_manifest")" \
  '.status == "PASS"
   and .authentication.espocrm == "PASS"
   and .authentication.dolibarr == "PASS"
   and .selectedSeed == $seed
   and .manifest.id == $fixtureId
   and .manifest.sha256 == $fixtureSha256
   and .governedFlow.verified == true
   and .inventoryPolicy.knownInstallerGovernanceBypass == false
   and .inventoryPolicy.backgroundOrdersAreChimpMaeraGovernedEvidence == false
   and (if $seed == "yes"
        then .exactCounts == $seedEnabledExpected
          and .governedFlow.status == "PASS"
          and .governedFlow.knownInstallerGovernanceBypass == false
          and .governedFlow.evidenceEligibility
            == "CURRENT_BYTE_GATE_ENFORCED"
          and .governedFlow.enforcementPoint
            == "CHIMPMAERA_RUNTIME_MUTATION_GATE_V1"
          and .governedFlow.effectReceipt.outcome
            == "PROVIDER_MUTATION_READBACK_VERIFIED"
          and .governedFlow.effectReceipt.replayState == "FIRST_EXECUTION"
          and (.governedFlow.effectReceipt.receiptDigest
            | test("^[a-f0-9]{64}$"))
          and ([.correlations.erpOrders[]
            | select(.demoClassification == "BACKGROUND_DEMO_DATA")]
            | length) == 7
        else .exactCounts == $seedDisabledExpected
          and .governedFlow.status == "NOT_APPLICABLE_SEED_DISABLED"
        end)' <<<"$seed_flow" >/dev/null
services="$(docker compose --env-file "$config" -f "$root/demo/compose.yaml" ps --status running --format json | jq -s 'map(.Service)|sort')"
chimp_status="$(curl -fsS "http://$CM_CHIMP_PORT/api/status")"
chimp_container="$(
  docker compose --env-file "$config" -f "$root/demo/compose.yaml" ps -q chimpmaera
)"
chimp_image="$(docker inspect --format '{{.Config.Image}}' "$chimp_container")"
authority_manifest="$(
  jq -c . "$root/demo/manifests/authority/$CM_AUTHORITY_MANIFEST_ID.json"
)"
authority_manifest_sha256="$(
  sha256sum "$root/demo/manifests/authority/$CM_AUTHORITY_MANIFEST_ID.json" |
    cut -d' ' -f1
)"
[ "$authority_manifest_sha256" = "$CM_AUTHORITY_MANIFEST_SHA256" ] ||
  { printf >&2 'Authority manifest digest readback mismatch.\n'; exit 1; }
jq -e \
  --arg manifestId "$CM_AUTHORITY_MANIFEST_ID" \
  --arg profile "$CM_AUTHORITY_PROFILE" \
  '.manifestId == $manifestId
   and .selectedProfile == $profile
   and .isolation == {
     composeProjectOnly:true,
     loopbackOnly:true,
     dockerSocketMounted:false,
     hostPrivilegeGranted:false,
     foreignResourceAccess:"DENIED"
   }' <<<"$authority_manifest" >/dev/null
chimp_isolation="$(
  docker inspect "$chimp_container" | jq -c '
    .[0] as $container
    | {
        privileged:$container.HostConfig.Privileged,
        readOnlyRootfs:$container.HostConfig.ReadonlyRootfs,
        capDrop:($container.HostConfig.CapDrop // []),
        securityOpt:($container.HostConfig.SecurityOpt // []),
        dockerSocketMounted:any(
          $container.Mounts[];
          .Source == "/var/run/docker.sock" or .Destination == "/var/run/docker.sock"
        ),
        publishedBindings:(
          $container.NetworkSettings.Ports
          | to_entries
          | map(.value // [])
          | flatten
          | map({hostIp:.HostIp,hostPort:.HostPort})
        )
      }'
)"
jq -e '
  .privileged == false
  and .readOnlyRootfs == true
  and (.capDrop | index("ALL")) != null
  and (.securityOpt | index("no-new-privileges:true")) != null
  and .dockerSocketMounted == false
  and (.publishedBindings | length) == 1
  and (.publishedBindings | all(.hostIp == "127.0.0.1"))
' <<<"$chimp_isolation" >/dev/null
jq -e \
  --arg profile "$CM_AUTHORITY_PROFILE" \
  --arg runtimeProfile "$(
    if [ "$CM_AUTHORITY_PROFILE" = RAMPAGE ]; then
      printf FULL_CONTROL_LAB
    else
      printf SAFE_GUIDED
    fi
  )" \
  '(.authority.stage == "STAGE_A_BOOTSTRAP_SUPERVISOR")
   and (.authority.profile.profileId == $runtimeProfile)
   and (.health.status == "PASS")
   and (.template.templateId == "quick-tour")' \
  <<<"$chimp_status" >/dev/null
[ "$chimp_image" = "$CM_CHIMP_IMAGE" ] ||
  { printf >&2 'PANSPHAIRA image digest readback mismatch.\n'; exit 1; }
jq -n \
  --arg mode "$CM_DEMO_MODE" --arg profile "$CM_AUTHORITY_PROFILE" \
  --arg seed "$CM_DEMO_SEED" --arg dms "$CM_DMS" --arg selection "$CM_SELECTION_SHA256" \
  --arg authorityManifestId "$CM_AUTHORITY_MANIFEST_ID" \
  --arg authorityManifestSha256 "$CM_AUTHORITY_MANIFEST_SHA256" \
  --arg catalogManifestId "$CM_CATALOG_MANIFEST_ID" \
  --arg catalogManifestSha256 "$CM_CATALOG_MANIFEST_SHA256" \
  --arg fixtureManifestId "$CM_FIXTURE_MANIFEST_ID" \
  --arg fixtureManifestSha256 "$CM_FIXTURE_MANIFEST_SHA256" \
  --arg image "$chimp_image" --argjson services "$services" \
  --argjson authorityManifest "$authority_manifest" \
  --argjson chimpIsolation "$chimp_isolation" \
  --argjson chimpStatus "$chimp_status" --argjson providerBootstrap "$provider_bootstrap" \
  --argjson identityBootstrap "$identity_bootstrap" --argjson catalogBootstrap "$catalog_bootstrap" \
  --argjson seedFlow "$seed_flow" \
  '{schemaVersion:"chimpmaera.demo/readback/v1",
    selected:{mode:$mode,authorityProfile:$profile,seed:$seed,dms:$dms,selectionSha256:$selection},
    runningServices:$services,
    chimpmaeraRuntime:{
      image:$image,
      stage:$chimpStatus.authority.stage,
      selectedAuthorityProfile:$profile,
      authorityManifestId:$authorityManifestId,
      authorityManifestSha256:$authorityManifestSha256,
      enforcedChimpMaeraProfile:$chimpStatus.authority.profile.profileId,
      runtimeActionRights:$chimpStatus.authority.hostRights,
      isolation:{
        manifest:$authorityManifest.isolation,
        observedContainer:$chimpIsolation,
        verified:true
      },
      templateId:$chimpStatus.template.templateId,
      health:$chimpStatus.health.status
    },
    providerBootstrap:{
      status:$providerBootstrap.status,
      espocrm:$providerBootstrap.espocrm,
      dolibarr:$providerBootstrap.dolibarr,
      usersMapped:true,
      identityManifest:$identityBootstrap.manifest,
      company:$identityBootstrap.company,
      roles:$identityBootstrap.roles,
      crossProviderMappings:$identityBootstrap.mappings,
      exactIdentityCounts:$identityBootstrap.exactCounts,
      catalog:{
        id:$catalogManifestId,
        sha256:$catalogManifestSha256,
        authentication:$catalogBootstrap.authentication,
        exactCounts:$catalogBootstrap.exactCounts
      },
      metadataLoaded:true,
      fixtureManifest:{id:$fixtureManifestId,sha256:$fixtureManifestSha256},
      authenticatedFixtureCounts:$seedFlow.exactCounts,
      governedCrmToErpFlow:$seedFlow.governedFlow,
      seedVerified:true
    },
    status:"READY_VERIFIED",
    releaseStatus:"LOCAL_DEMO_ONLY_PUBLICATION_SEPARATE"}'
