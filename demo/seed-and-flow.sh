#!/usr/bin/env bash
set -euo pipefail
step=initialization
trap 'code=$?; printf >&2 "Seed/flow failed at %s (line %s, exit %s).\\n" "$step" "$LINENO" "$code"; exit "$code"' ERR

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state="$root/.chimpmaera-demo"
config="$state/config.env"
manifest="$root/demo/manifests/fixtures/panskys-zoo-demo-v1.json"
identity_receipt="$state/public/identity-bootstrap.json"
output="${1:-$state/public/seed-and-flow.json}"

[ -f "$config" ] || { printf >&2 'Seed/flow requires an installed demo.\n'; exit 1; }
[ -s "$manifest" ] || { printf >&2 'Fixture manifest is missing.\n'; exit 1; }
[ -s "$identity_receipt" ] ||
  { printf >&2 'Seed/flow requires the identity bootstrap receipt.\n'; exit 1; }

set -a
# shellcheck disable=SC1090
source "$config"
set +a

api_token="$(<"$state/secrets/chimp-api-token")"
control_token="$(<"$state/secrets/chimp-control-token")"
gate_base="http://$CM_CHIMP_PORT"
gate_origin="$gate_base"
actor="installer:seed-and-flow"

gate_post() {
  local endpoint="$1" body="$2"
  curl -fsS \
    -H "authorization: Bearer $api_token" \
    -H "origin: $gate_origin" \
    -H 'x-cm-csrf: chimpmaera-local-v1' \
    -H 'content-type: application/json' \
    -X POST "$gate_base$endpoint" \
    -d "$body"
}

provider_read() {
  local provider="$1" path="$2" query="${3-}"
  [ -n "$query" ] || query='{}'
  gate_post /api/demo/provider-read "$(
    jq -cn \
      --arg provider "$provider" \
      --arg path "$path" \
      --argjson query "$query" \
      '{provider:$provider,path:$path,query:$query}'
  )" | jq -c '.value'
}

provider_mutate() {
  local provider="$1" entity="$2" path="$3" replay_key="$4" body="$5"
  local action action_digest scope_digest approval_binding envelope
  action="$(
    jq -Scn \
      --arg actor "$actor" \
      --arg provider "$provider" \
      --arg entity "$entity" \
      --arg path "$path" \
      --arg replayKey "$replay_key" \
      --argjson body "$body" \
      '{
        actionType:"PROVIDER_MUTATION",
        actor:$actor,
        payload:{body:$body,method:"POST",path:$path},
        replayKey:$replayKey,
        scope:{
          actor:$actor,
          entity:$entity,
          operation:"CREATE_IF_ABSENT",
          provider:$provider,
          tenant:"panskys-zoo-demo"
        }
      }'
  )"
  action_digest="$(printf '%s' "$action" | sha256sum | cut -d' ' -f1)"
  scope_digest="$(
    jq -Sc '.scope' <<<"$action" | tr -d '\n' | sha256sum | cut -d' ' -f1
  )"
  approval_binding="$(
    printf '%s\n%s\n%s\n%s' \
      "$action_digest" "$actor" "$scope_digest" "$replay_key" |
      openssl dgst -sha256 -hmac "$control_token" -hex |
      awk '{print $NF}'
  )"
  envelope="$(
    jq -cn \
      --argjson action "$action" \
      --arg actionDigest "$action_digest" \
      --arg binding "$approval_binding" \
      '{
        action:$action,
        actionDigest:$actionDigest,
        approval:{
          actionDigest:$actionDigest,
          approver:"owner:local-demo",
          binding:$binding,
          decision:"APPROVE"
        }
      }'
  )"
  gate_post /api/demo/effects "$envelope"
}

effect_receipt() {
  local replay_key="$1"
  curl -fsS \
    -H "authorization: Bearer $api_token" \
    -H "origin: $gate_origin" \
    -G "$gate_base/api/demo/effect-receipt" \
    --data-urlencode "replayKey=$replay_key" |
    jq -c '.receipt'
}

espo_get_exact() {
  local entity="$1" attribute="$2" value="$3"
  provider_read espocrm "/$entity" "$(
    jq -cn \
      --arg attribute "$attribute" \
      --arg value "$value" \
      '{
        maxSize:"100",
        "where[0][type]":"equals",
        "where[0][attribute]":$attribute,
        "where[0][value]":$value
      }'
  )"
}

espo_get_by_id() {
  local entity="$1" id="$2"
  provider_read espocrm "/$entity/$id"
}

espo_ensure() {
  local entity="$1" attribute="$2" value="$3" payload="$4" found count
  found="$(espo_get_exact "$entity" "$attribute" "$value")"
  count="$(jq -r '.total' <<<"$found")"
  [ "$count" = 0 ] || [ "$count" = 1 ] ||
    { printf >&2 'EspoCRM %s fixture %s is not unique.\n' "$entity" "$value"; exit 1; }
  if [ "$count" = 0 ]; then
    provider_mutate espocrm "$entity" "/$entity" \
      "seed:espocrm:$entity:$attribute:$(printf '%s' "$value" | sha256sum | cut -c1-24)" \
      "$payload" | jq -c '.readback'
  else
    jq -c '.list[0]' <<<"$found"
  fi
}

doli_list() {
  local endpoint="$1" filter="$2" body http_code
  provider_read dolibarr "/$endpoint" "$(
    jq -cn --arg filter "$filter" '{limit:"100",sqlfilters:$filter}'
  )"
}

manifest_sha256="$(sha256sum "$manifest" | cut -d' ' -f1)"
expected_key=seedDisabled
[ "$CM_DEMO_SEED" = yes ] && expected_key=seedEnabled
expected="$(jq -c --arg key "$expected_key" '.expectedCounts[$key]' "$manifest")"
inventory_policy="$(jq -c '.inventoryPolicy' "$manifest")"

step=canonical_company_readback
own_company_name="$(jq -r '.company.name' "$identity_receipt")"
own_espo_id="$(jq -r '.company.espocrmAccountId' "$identity_receipt")"
own_espo_account="$(espo_get_by_id Account "$own_espo_id")"
doli_own_company="$(
  provider_read dolibarr /setup/company
)"
jq -e --arg id "$own_espo_id" --arg name "$own_company_name" \
  '.id == $id and .name == $name' <<<"$own_espo_account" >/dev/null
jq -e --arg name "$own_company_name" '.name == $name' \
  <<<"$doli_own_company" >/dev/null

accounts='[]'
contacts='[]'
opportunities='[]'
doli_customers='[]'
doli_orders_readback='[]'

if [ "$CM_DEMO_SEED" = no ]; then
  step=seed_disabled_zero_readback
  crm_fixture_accounts=0
  while IFS= read -r name; do
    count="$(espo_get_exact Account name "$name" | jq -r '.total')"
    crm_fixture_accounts="$((crm_fixture_accounts + count))"
  done < <(jq -r '.crm.accounts[].name' "$manifest")
  crm_contacts=0
  while IFS= read -r last_name; do
    count="$(espo_get_exact Contact lastName "$last_name" | jq -r '.total')"
    crm_contacts="$((crm_contacts + count))"
  done < <(jq -r '.crm.contacts[].lastName' "$manifest")
  crm_opportunities=0
  while IFS= read -r name; do
    count="$(espo_get_exact Opportunity name "$name" | jq -r '.total')"
    crm_opportunities="$((crm_opportunities + count))"
  done < <(jq -r '.crm.opportunities[].name' "$manifest")
  erp_third_parties=0
  while IFS= read -r customer_code; do
    count="$(doli_list thirdparties "(t.code_client:=:'$customer_code')" | jq 'length')"
    erp_third_parties="$((erp_third_parties + count))"
  done < <(jq -r '.erp.thirdParties[].customerCode' "$manifest")
  erp_orders=0
  while IFS= read -r customer_reference; do
    count="$(doli_list orders "(t.ref_client:=:'$customer_reference')" | jq 'length')"
    erp_orders="$((erp_orders + count))"
  done < <(jq -r '.erp.orders[].customerReference' "$manifest")
  [ "$crm_fixture_accounts" = 0 ] ||
    { printf >&2 'Seed-disabled CRM account residue is non-zero.\n'; exit 1; }
  counts="$(
    jq -cn \
      --argjson crmAccounts 1 \
      --argjson crmContacts "$crm_contacts" \
      --argjson crmOpportunities "$crm_opportunities" \
      --argjson erpOwnCompanies 1 \
      --argjson erpThirdParties "$erp_third_parties" \
      --argjson erpOrders "$erp_orders" \
      --argjson erpOrderLines 0 \
      --argjson operationalObjects 2 \
      --argjson proofScenarios 0 \
      --argjson backgroundDemoOrders 0 \
      --argjson governedFlows 0 \
      '{crmAccounts:$crmAccounts,crmContacts:$crmContacts,
        crmOpportunities:$crmOpportunities,erpOwnCompanies:$erpOwnCompanies,
        erpThirdParties:$erpThirdParties,erpOrders:$erpOrders,
        erpOrderLines:$erpOrderLines,operationalObjects:$operationalObjects,
        proofScenarios:$proofScenarios,backgroundDemoOrders:$backgroundDemoOrders,
        governedFlows:$governedFlows}'
  )"
  [ "$counts" = "$expected" ] ||
    { printf >&2 'Seed-disabled fixture residue does not match exact counts.\n'; exit 1; }
  flow='{"status":"NOT_APPLICABLE_SEED_DISABLED","verified":true,"knownInstallerGovernanceBypass":false,"evidenceEligibility":"NOT_APPLICABLE"}'
else
  step=crm_account_materialization
  while IFS= read -r account; do
    fixture_id="$(jq -r '.fixtureId' <<<"$account")"
    name="$(jq -r '.name' <<<"$account")"
    email="$(jq -r '.emailLocalPart + "@" + .emailDomain' <<<"$account")"
    payload="$(
      jq -cn \
        --arg name "$name" \
        --arg emailAddress "$email" \
        --arg description "PANSPHAIRA synthetic demo fixture $fixture_id" \
        '{name:$name,emailAddress:$emailAddress,type:"Customer",description:$description}'
    )"
    record="$(espo_ensure Account name "$name" "$payload")"
    record="$(espo_get_by_id Account "$(jq -r '.id' <<<"$record")")"
    jq -e --arg name "$name" --arg email "$email" \
      '.name == $name and .emailAddress == $email' <<<"$record" >/dev/null
    accounts="$(
      jq -c --arg fixtureId "$fixture_id" --arg id "$(jq -r '.id' <<<"$record")" \
        '. + [{fixtureId:$fixtureId,id:$id}]' <<<"$accounts"
    )"
  done < <(jq -c '.crm.accounts[]' "$manifest")

  step=crm_contact_materialization
  while IFS= read -r contact; do
    fixture_id="$(jq -r '.fixtureId' <<<"$contact")"
    account_fixture_id="$(jq -r '.accountFixtureId' <<<"$contact")"
    account_id="$(jq -r --arg fixtureId "$account_fixture_id" \
      '.[]|select(.fixtureId == $fixtureId)|.id' <<<"$accounts")"
    last_name="$(jq -r '.lastName' <<<"$contact")"
    email="$(jq -r '.emailLocalPart + "@" + .emailDomain' <<<"$contact")"
    payload="$(
      jq -cn \
        --arg firstName "$(jq -r '.firstName' <<<"$contact")" \
        --arg lastName "$last_name" \
        --arg emailAddress "$email" \
        --arg accountId "$account_id" \
        --arg description "PANSPHAIRA synthetic demo fixture $fixture_id" \
        '{firstName:$firstName,lastName:$lastName,emailAddress:$emailAddress,
          accountId:$accountId,description:$description}'
    )"
    record="$(espo_ensure Contact lastName "$last_name" "$payload")"
    record="$(espo_get_by_id Contact "$(jq -r '.id' <<<"$record")")"
    jq -e --arg lastName "$last_name" --arg email "$email" \
      --arg accountId "$account_id" \
      '.lastName == $lastName and .emailAddress == $email
       and .accountId == $accountId' <<<"$record" >/dev/null
    contacts="$(
      jq -c \
        --arg fixtureId "$fixture_id" \
        --arg id "$(jq -r '.id' <<<"$record")" \
        --arg accountFixtureId "$account_fixture_id" \
        --arg accountId "$account_id" \
        '. + [{fixtureId:$fixtureId,id:$id,accountFixtureId:$accountFixtureId,
          accountId:$accountId}]' <<<"$contacts"
    )"
  done < <(jq -c '.crm.contacts[]' "$manifest")

  step=crm_opportunity_materialization
  while IFS= read -r opportunity; do
    fixture_id="$(jq -r '.fixtureId' <<<"$opportunity")"
    account_fixture_id="$(jq -r '.accountFixtureId' <<<"$opportunity")"
    account_id="$(jq -r --arg fixtureId "$account_fixture_id" \
      '.[]|select(.fixtureId == $fixtureId)|.id' <<<"$accounts")"
    name="$(jq -r '.name' <<<"$opportunity")"
    classification="$(jq -r '.demoClassification' <<<"$opportunity")"
    payload="$(
      jq -cn \
        --arg name "$name" \
        --arg accountId "$account_id" \
        --arg stage "$(jq -r '.stage' <<<"$opportunity")" \
        --arg closeDate "$(jq -r '.closeDate' <<<"$opportunity")" \
        --arg currency "$(jq -r '.currency' <<<"$opportunity")" \
        --arg description "PANSPHAIRA synthetic $classification fixture $fixture_id" \
        --argjson amount "$(jq '.amount' <<<"$opportunity")" \
        '{name:$name,accountId:$accountId,stage:$stage,closeDate:$closeDate,
          amount:$amount,amountCurrency:$currency,description:$description}'
    )"
    record="$(espo_ensure Opportunity name "$name" "$payload")"
    record="$(espo_get_by_id Opportunity "$(jq -r '.id' <<<"$record")")"
    jq -e --arg name "$name" --arg accountId "$account_id" \
      --argjson amount "$(jq '.amount' <<<"$opportunity")" \
      '.name == $name and .accountId == $accountId
       and (.amount|tonumber) == $amount' <<<"$record" >/dev/null
    opportunities="$(
      jq -c \
        --arg fixtureId "$fixture_id" \
        --arg id "$(jq -r '.id' <<<"$record")" \
        --arg accountFixtureId "$account_fixture_id" \
        --arg accountId "$account_id" \
        --arg classification "$classification" \
        '. + [{fixtureId:$fixtureId,id:$id,accountFixtureId:$accountFixtureId,
          accountId:$accountId,demoClassification:$classification}]' \
        <<<"$opportunities"
    )"
  done < <(jq -c '.crm.opportunities[]' "$manifest")

  step=erp_customer_materialization
  while IFS= read -r customer; do
    fixture_id="$(jq -r '.fixtureId' <<<"$customer")"
    customer_code="$(jq -r '.customerCode' <<<"$customer")"
    name="$(jq -r '.name' <<<"$customer")"
    email="$(jq -r '.emailLocalPart + "@" + .emailDomain' <<<"$customer")"
    found="$(doli_list thirdparties "(t.code_client:=:'$customer_code')")"
    [ "$(jq 'length' <<<"$found")" -le 1 ] ||
      { printf >&2 'Dolibarr customer %s is not unique.\n' "$customer_code"; exit 1; }
    if [ "$(jq 'length' <<<"$found")" = 0 ]; then
      customer_effect="$(
        provider_mutate dolibarr ThirdParty /thirdparties \
          "seed:dolibarr:thirdparty:$customer_code" "$(
          jq -cn \
            --arg name "$name" \
            --arg code_client "$customer_code" \
            --arg email "$email" \
            '{name:$name,client:1,code_client:$code_client,email:$email,
              note_public:"PANSPHAIRA synthetic demo customer"}'
        )"
      )"
      customer_id="$(
        jq -r 'if (.providerResult|type) == "object"
          then .providerResult.id else .providerResult end' <<<"$customer_effect"
      )"
    else
      customer_id="$(jq -r '.[0].id' <<<"$found")"
    fi
    record="$(provider_read dolibarr "/thirdparties/$customer_id")"
    jq -e --arg name "$name" --arg code "$customer_code" --arg email "$email" \
      '.name == $name and .client == "1" and .code_client == $code
       and .email == $email' <<<"$record" >/dev/null
    doli_customers="$(
      jq -c --arg fixtureId "$fixture_id" --arg id "$customer_id" \
        --arg customerCode "$customer_code" \
        '. + [{fixtureId:$fixtureId,id:$id,customerCode:$customerCode}]' \
        <<<"$doli_customers"
    )"
  done < <(jq -c '.erp.thirdParties[]' "$manifest")

  step=erp_order_materialization
  while IFS= read -r order; do
    fixture_id="$(jq -r '.fixtureId' <<<"$order")"
    customer_fixture_id="$(jq -r '.customerFixtureId' <<<"$order")"
    opportunity_fixture_id="$(jq -r '.crmOpportunityFixtureId' <<<"$order")"
    customer_reference="$(jq -r '.customerReference' <<<"$order")"
    classification="$(jq -r '.demoClassification' <<<"$order")"
    customer_id="$(jq -r --arg fixtureId "$customer_fixture_id" \
      '.[]|select(.fixtureId == $fixtureId)|.id' <<<"$doli_customers")"
    found="$(doli_list orders "(t.ref_client:=:'$customer_reference')")"
    [ "$(jq 'length' <<<"$found")" -le 1 ] ||
      { printf >&2 'Dolibarr order %s is not unique.\n' "$customer_reference"; exit 1; }
    if [ "$(jq 'length' <<<"$found")" = 0 ]; then
      order_effect="$(
        provider_mutate dolibarr Order /orders \
          "seed:dolibarr:order:$customer_reference" "$(
          jq -cn \
            --argjson socid "$customer_id" \
            --argjson date "$(jq '.orderDateEpoch' <<<"$order")" \
            --arg ref_client "$customer_reference" \
            --arg classification "$classification" \
            '{socid:$socid,date:$date,ref_client:$ref_client,
              note_public:("PANSPHAIRA synthetic " + $classification
                + " from CRM opportunity " + $ref_client)}'
        )"
      )"
      order_id="$(
        jq -r 'if (.providerResult|type) == "object"
          then .providerResult.id else .providerResult end' <<<"$order_effect"
      )"
    else
      order_id="$(jq -r '.[0].id' <<<"$found")"
    fi

    record="$(provider_read dolibarr "/orders/$order_id")"
    while IFS= read -r line; do
      description="$(jq -r '.description' <<<"$line")"
      match_count="$(
        jq --arg description "$description" \
          '[.lines[]|select(.desc == $description)]|length' <<<"$record"
      )"
      [ "$match_count" -le 1 ] ||
        { printf >&2 'Dolibarr order line %s is not unique.\n' "$description"; exit 1; }
      if [ "$match_count" = 0 ]; then
        provider_mutate dolibarr OrderLine "/orders/$order_id/lines" \
          "seed:dolibarr:order-line:$customer_reference:$(printf '%s' "$description" | sha256sum | cut -c1-24)" "$(
            jq -cn \
              --arg desc "$description" \
              --argjson qty "$(jq '.quantity' <<<"$line")" \
              --argjson subprice "$(jq '.unitPriceExcludingTax' <<<"$line")" \
              --argjson tva_tx "$(jq '.vatRate' <<<"$line")" \
              '{desc:$desc,qty:$qty,subprice:$subprice,tva_tx:$tva_tx,
                product_type:0}'
          )" >/dev/null
        record="$(provider_read dolibarr "/orders/$order_id")"
      fi
    done < <(jq -c '.lines[]' <<<"$order")

    expected_line_count="$(jq '.lines|length' <<<"$order")"
    [ "$(jq '.lines|length' <<<"$record")" = "$expected_line_count" ] ||
      { printf >&2 'Dolibarr order %s has unexpected extra or missing lines.\n' "$customer_reference"; exit 1; }
    jq -e --arg customerId "$customer_id" --arg reference "$customer_reference" \
      '(.socid|tostring) == $customerId and .ref_client == $reference' \
      <<<"$record" >/dev/null
    while IFS= read -r line; do
      jq -e \
        --arg description "$(jq -r '.description' <<<"$line")" \
        --argjson quantity "$(jq '.quantity' <<<"$line")" \
        --argjson unitPrice "$(jq '.unitPriceExcludingTax' <<<"$line")" \
        --argjson vatRate "$(jq '.vatRate' <<<"$line")" \
        '[.lines[]|select(.desc == $description
          and (.qty|tonumber) == $quantity
          and (.subprice|tonumber) == $unitPrice
          and (.tva_tx|tonumber) == $vatRate)]|length == 1' \
        <<<"$record" >/dev/null
    done < <(jq -c '.lines[]' <<<"$order")
    doli_orders_readback="$(
      jq -c \
        --arg fixtureId "$fixture_id" \
        --arg id "$order_id" \
        --arg customerFixtureId "$customer_fixture_id" \
        --arg customerId "$customer_id" \
        --arg opportunityFixtureId "$opportunity_fixture_id" \
        --arg classification "$classification" \
        --argjson lineCount "$expected_line_count" \
        '. + [{fixtureId:$fixtureId,id:$id,
          customerFixtureId:$customerFixtureId,customerId:$customerId,
          opportunityFixtureId:$opportunityFixtureId,
          demoClassification:$classification,lineCount:$lineCount}]' \
        <<<"$doli_orders_readback"
    )"
  done < <(jq -c '.erp.orders[]' "$manifest")

  step=authenticated_exact_readback
  proof_order_fixture_id="$(jq -r '.inventoryPolicy.proofScenarioFixtureId' "$manifest")"
  proof_order_manifest="$(jq -c --arg fixtureId "$proof_order_fixture_id" \
    '.erp.orders[]|select(.fixtureId == $fixtureId)' "$manifest")"
  proof_opportunity_fixture_id="$(
    jq -r '.crmOpportunityFixtureId' <<<"$proof_order_manifest"
  )"
  source_opportunity_id="$(jq -r --arg fixtureId "$proof_opportunity_fixture_id" \
    '.[]|select(.fixtureId == $fixtureId)|.id' <<<"$opportunities")"
  proof_order_id="$(jq -r --arg fixtureId "$proof_order_fixture_id" \
    '.[]|select(.fixtureId == $fixtureId)|.id' <<<"$doli_orders_readback")"
  proof_source="$(espo_get_by_id Opportunity "$source_opportunity_id")"
  proof_target="$(provider_read dolibarr "/orders/$proof_order_id")"
  jq -e --arg fixtureId "$proof_opportunity_fixture_id" \
    '.name | contains("[" + $fixtureId + "]")' <<<"$proof_source" >/dev/null
  jq -e \
    --arg reference "$(jq -r '.customerReference' <<<"$proof_order_manifest")" \
    --arg description "$(jq -r '.lines[0].description' <<<"$proof_order_manifest")" \
    '.ref_client == $reference
     and ([.lines[]|select(.desc == $description)]|length) == 1' \
    <<<"$proof_target" >/dev/null

  crm_accounts="$(( $(jq 'length' <<<"$accounts") + 1 ))"
  crm_contacts="$(jq 'length' <<<"$contacts")"
  crm_opportunities="$(jq 'length' <<<"$opportunities")"
  erp_third_parties="$(jq 'length' <<<"$doli_customers")"
  erp_orders="$(jq 'length' <<<"$doli_orders_readback")"
  erp_order_lines="$(jq '[.[].lineCount]|add' <<<"$doli_orders_readback")"
  proof_scenarios="$(jq '[.[]|select(.demoClassification
    == "GATE_ENFORCED_PROOF_SCENARIO")]|length' \
    <<<"$doli_orders_readback")"
  background_demo_orders="$(jq '[.[]|select(.demoClassification
    == "BACKGROUND_DEMO_DATA")]|length' <<<"$doli_orders_readback")"
  operational_objects="$((crm_accounts + crm_contacts + crm_opportunities + 1
    + erp_third_parties + erp_orders + erp_order_lines))"
  counts="$(
    jq -cn \
      --argjson crmAccounts "$crm_accounts" \
      --argjson crmContacts "$crm_contacts" \
      --argjson crmOpportunities "$crm_opportunities" \
      --argjson erpOwnCompanies 1 \
      --argjson erpThirdParties "$erp_third_parties" \
      --argjson erpOrders "$erp_orders" \
      --argjson erpOrderLines "$erp_order_lines" \
      --argjson operationalObjects "$operational_objects" \
      --argjson proofScenarios "$proof_scenarios" \
      --argjson backgroundDemoOrders "$background_demo_orders" \
      --argjson governedFlows 1 \
      '{crmAccounts:$crmAccounts,crmContacts:$crmContacts,
        crmOpportunities:$crmOpportunities,erpOwnCompanies:$erpOwnCompanies,
        erpThirdParties:$erpThirdParties,erpOrders:$erpOrders,
        erpOrderLines:$erpOrderLines,operationalObjects:$operationalObjects,
        proofScenarios:$proofScenarios,backgroundDemoOrders:$backgroundDemoOrders,
        governedFlows:$governedFlows}'
  )"
  [ "$counts" = "$expected" ] ||
    { printf >&2 'Seed-enabled inventory counts do not match the manifest.\n'; exit 1; }
  proof_effect_receipt="$(effect_receipt "seed:dolibarr:order:$(jq -r '.customerReference' <<<"$proof_order_manifest")")"
  flow="$(
    jq -cn \
      --arg sourceId "$source_opportunity_id" \
      --arg sourceFixtureId "$proof_opportunity_fixture_id" \
      --arg targetId "$proof_order_id" \
      --arg targetFixtureId "$proof_order_fixture_id" \
      --arg authorityProfile "$CM_AUTHORITY_PROFILE" \
      --argjson effectReceipt "$proof_effect_receipt" \
      '{
        status:"PASS",
        verified:true,
        source:{provider:"espocrm",entity:"Opportunity",id:$sourceId,
          fixtureId:$sourceFixtureId},
        target:{provider:"dolibarr",entity:"Order",id:$targetId,
          fixtureId:$targetFixtureId},
        authority:{
          selectedProfile:$authorityProfile,
          authorizationBasis:"AUTHENTICATED_DIGEST_BOUND_LOCAL_OWNER_APPROVAL",
          isolation:"OWNED_COMPOSE_PROJECT_ONLY"
        },
        enforcementPoint:"CHIMPMAERA_RUNTIME_MUTATION_GATE_V1",
        effectReceipt:$effectReceipt,
        knownInstallerGovernanceBypass:false,
        evidenceEligibility:"CURRENT_BYTE_GATE_ENFORCED"
      }'
  )"
fi

install -d -m 700 "$(dirname "$output")"
tmp="$(mktemp "$(dirname "$output")/.seed-and-flow.XXXXXX")"
jq -n \
  --arg manifestId "$(jq -r '.manifestId' "$manifest")" \
  --arg manifestSha256 "$manifest_sha256" \
  --arg selectedSeed "$CM_DEMO_SEED" \
  --argjson exactCounts "$counts" \
  --argjson governedFlow "$flow" \
  --argjson inventoryPolicy "$inventory_policy" \
  --argjson crmAccounts "$accounts" \
  --argjson crmContacts "$contacts" \
  --argjson crmOpportunities "$opportunities" \
  --argjson erpThirdParties "$doli_customers" \
  --argjson erpOrders "$doli_orders_readback" \
  '{
    schemaVersion:"chimpmaera.demo/seed-flow/v1",
    status:"PASS",
    authentication:{espocrm:"PASS",dolibarr:"PASS"},
    manifest:{id:$manifestId,sha256:$manifestSha256},
    selectedSeed:$selectedSeed,
    exactCounts:$exactCounts,
    inventoryPolicy:$inventoryPolicy,
    correlations:{
      crmAccounts:$crmAccounts,
      crmContacts:$crmContacts,
      crmOpportunities:$crmOpportunities,
      erpThirdParties:$erpThirdParties,
      erpOrders:$erpOrders
    },
    governedFlow:$governedFlow
  }' >"$tmp"
chmod 600 "$tmp"
mv -f "$tmp" "$output"
