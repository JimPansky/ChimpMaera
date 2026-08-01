#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
state="$root/.chimpmaera-demo"
config="$state/config.env"
if [ "$#" -ge 1 ]; then
  output="$1"
else
  output="$state/public/approval-workbench-smoke.json"
fi

[ -f "$config" ] || {
  printf >&2 'Approval Workbench smoke requires an installed demo.\n'
  exit 1
}
set -a
# shellcheck disable=SC1090
source "$config"
set +a
[ "$CM_AUTHORITY_PROFILE" = SAFE_GUIDED ] || {
  printf >&2 'Approval Workbench smoke requires SAFE_GUIDED.\n'
  exit 1
}

api_token="$(<"$state/secrets/chimp-api-token")"
gate_base="http://$CM_CHIMP_PORT"
gate_origin="$gate_base"
tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "$tmp_dir"' EXIT

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

gate_post_capture() {
  local endpoint="$1" body="$2" response_file="$3"
  curl -sS \
    -o "$response_file" \
    -w '%{http_code}' \
    -H "authorization: Bearer $api_token" \
    -H "origin: $gate_origin" \
    -H 'x-cm-csrf: chimpmaera-local-v1' \
    -H 'content-type: application/json' \
    -X POST "$gate_base$endpoint" \
    -d "$body"
}

gate_get() {
  local endpoint="$1" key="$2" value="$3"
  curl -fsS \
    -H "authorization: Bearer $api_token" \
    -H "origin: $gate_origin" \
    -G "$gate_base$endpoint" \
    --data-urlencode "$key=$value"
}

admin_request() {
  local replay_key="$1"
  gate_post /api/demo/admin-ai/request "$(
    jq -cn \
      --arg replayKey "$replay_key" \
      '{
        schemaVersion:"chimpmaera.demo/admin-ai-request/v1",
        actor:"agent:admin-ai-poc",
        requestKind:"SYNTHETIC_DOLIBARR_ORDER_CREATE",
        replayKey:$replayKey
      }'
  )"
}

approved_request="$(admin_request admin-ai:poc:acceptance-order-approved-001)"
approved_decision_digest="$(jq -r '.decision.decisionDigest' <<<"$approved_request")"
approved_owner="$(
  gate_post /api/demo/admin-ai/owner-decision "$(
    jq -cn \
      --arg decisionDigest "$approved_decision_digest" \
      '{decisionDigest:$decisionDigest,ownerDecision:"APPROVE"}'
  )"
)"
approved_envelope="$(
  jq -cn \
    --argjson request "$approved_request" \
    --argjson owner "$approved_owner" \
    '{
      action:$request.decision.action,
      actionDigest:$request.decision.actionDigest,
      businessDiff:$request.decision.businessDiff,
      businessDiffDigest:$request.decision.businessDiffDigest,
      authority:$owner.authority
    }'
)"
approved_effect="$(gate_post /api/demo/effects "$approved_envelope")"
decision_readback="$(
  gate_get \
    /api/demo/admin-ai/owner-decision-receipt \
    decisionDigest \
    "$approved_decision_digest"
)"
effect_readback="$(
  gate_get \
    /api/demo/effect-receipt \
    replayKey \
    admin-ai:poc:acceptance-order-approved-001
)"

rejected_request="$(admin_request admin-ai:poc:acceptance-order-rejected-001)"
rejected_decision_digest="$(jq -r '.decision.decisionDigest' <<<"$rejected_request")"
rejected_owner="$(
  gate_post /api/demo/admin-ai/owner-decision "$(
    jq -cn \
      --arg decisionDigest "$rejected_decision_digest" \
      '{decisionDigest:$decisionDigest,ownerDecision:"REJECT"}'
  )"
)"
rejected_envelope="$(
  jq -cn \
    --argjson request "$rejected_request" \
    '{
      action:$request.decision.action,
      actionDigest:$request.decision.actionDigest,
      businessDiff:$request.decision.businessDiff,
      businessDiffDigest:$request.decision.businessDiffDigest,
      authority:null
    }'
)"
rejected_file="$tmp_dir/rejected.json"
rejected_status="$(
  gate_post_capture /api/demo/effects "$rejected_envelope" "$rejected_file"
)"
rejected_error="$(jq -r '.error' "$rejected_file")"

replay_file="$tmp_dir/replay.json"
replay_status="$(
  gate_post_capture /api/demo/effects "$approved_envelope" "$replay_file"
)"
replay_error="$(jq -r '.error' "$replay_file")"

jq -e '
  .decision.outcome == "OWNER_ESCALATION"
  and .proposal.businessDiff.summary
    == "Create one synthetic Dolibarr sales order if absent."
  and .proposal.businessDiffDigest == .decision.businessDiffDigest
' <<<"$approved_request" >/dev/null
jq -e '
  .decisionReceipt.outcome == "OWNER_APPROVED_AUTHORITY_ISSUED"
  and .authority.kind == "OWNER_ESCALATION_LEASE_HMAC_V1"
  and .authority.maxUses == 1
  and .authority.profileId == "SAFE_GUIDED"
  and .authority.ownerDecisionReceiptDigest
    == .decisionReceipt.receiptDigest
' <<<"$approved_owner" >/dev/null
jq -e '
  .status == "PASS"
  and .replayed == false
  and .readback.ref_client == "CM-ADMIN-AI-ESCALATION-001"
  and .receipt.schemaVersion == "chimpmaera.demo/effect-receipt/v3"
  and .receipt.outcome == "PROVIDER_MUTATION_READBACK_VERIFIED"
  and .receipt.authority.maxUses == 1
' <<<"$approved_effect" >/dev/null
jq -e \
  --arg digest "$(jq -r '.decisionReceipt.receiptDigest' <<<"$approved_owner")" \
  '.receipt.receiptDigest == $digest' \
  <<<"$decision_readback" >/dev/null
jq -e \
  --arg digest "$(jq -r '.receipt.receiptDigest' <<<"$approved_effect")" \
  '.receipt.receiptDigest == $digest' \
  <<<"$effect_readback" >/dev/null
jq -e '
  .decisionReceipt.outcome == "OWNER_REJECTED_NO_AUTHORITY"
  and .authority == null
' <<<"$rejected_owner" >/dev/null
[ "$rejected_status" = 403 ]
[ "$rejected_error" = AGENT_ACTION_SCOPE_DENIED ]
[ "$replay_status" = 403 ]
[ "$replay_error" = AUTHORITY_LEASE_REPLAY_DENIED ]

install -d -m 700 "$(dirname "$output")"
tmp_output="$(mktemp "$(dirname "$output")/.approval-workbench.XXXXXX")"
jq -n \
  --arg approvedDecisionDigest "$approved_decision_digest" \
  --arg approvedDecisionReceiptDigest \
    "$(jq -r '.decisionReceipt.receiptDigest' <<<"$approved_owner")" \
  --arg approvedEffectReceiptDigest \
    "$(jq -r '.receipt.receiptDigest' <<<"$approved_effect")" \
  --arg approvedProviderReference \
    "$(jq -r '.receipt.provider.objectReference' <<<"$approved_effect")" \
  --arg rejectedDecisionReceiptDigest \
    "$(jq -r '.decisionReceipt.receiptDigest' <<<"$rejected_owner")" \
  --arg rejectedError "$rejected_error" \
  --arg replayError "$replay_error" \
  '{
    schemaVersion:"chimpmaera.demo/approval-workbench-smoke/v1",
    status:"PASS",
    claim:"DETERMINISTIC_LOCAL_STATIC_POLICY_NO_LIVE_LLM",
    approved:{
      decisionDigest:$approvedDecisionDigest,
      decisionReceiptDigest:$approvedDecisionReceiptDigest,
      effectReceiptDigest:$approvedEffectReceiptDigest,
      providerReference:$approvedProviderReference,
      readback:"VERIFIED"
    },
    rejected:{
      decisionReceiptDigest:$rejectedDecisionReceiptDigest,
      providerEffect:"DENIED",
      error:$rejectedError
    },
    replay:{
      providerEffect:"DENIED",
      error:$replayError
    }
  }' >"$tmp_output"
chmod 600 "$tmp_output"
mv -f "$tmp_output" "$output"
jq -e '.status == "PASS"' "$output" >/dev/null
