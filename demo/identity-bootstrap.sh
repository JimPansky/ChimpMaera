#!/usr/bin/env bash
set -euo pipefail
step=initialization
trap 'code=$?; printf >&2 "Identity bootstrap failed at %s (line %s, exit %s).\\n" "$step" "$LINENO" "$code"; exit "$code"' ERR

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state="$root/.chimpmaera-demo"
config="$state/config.env"
manifest="$root/demo/manifests/identity/panskys-zoo-v1.json"
output="${1:-$state/public/identity-bootstrap.json}"

[ -f "$config" ] || { printf >&2 'Identity bootstrap requires an installed demo.\n'; exit 1; }
[ -s "$manifest" ] || { printf >&2 'Identity manifest is missing.\n'; exit 1; }

set -a
# shellcheck disable=SC1090
source "$config"
set +a

compose=(docker compose --env-file "$config" -f "$root/demo/compose.yaml")
espo_password="$(<"$state/secrets/espo-admin")"
doli_api_key="$(<"$state/secrets/doli-api-key")"
espo_base="http://$CM_ESPO_PORT/api/v1"
doli_base="http://$CM_DOLI_PORT/api/index.php"

espo_get_exact() {
  local entity="$1" attribute="$2" value="$3"
  curl -fsS -u "admin:$espo_password" --get "$espo_base/$entity" \
    --data-urlencode 'maxSize=20' \
    --data-urlencode 'where[0][type]=equals' \
    --data-urlencode "where[0][attribute]=$attribute" \
    --data-urlencode "where[0][value]=$value"
}

espo_ensure() {
  local entity="$1" attribute="$2" value="$3" payload="$4" found count
  found="$(espo_get_exact "$entity" "$attribute" "$value")"
  count="$(jq -r '.total' <<<"$found")"
  [ "$count" = 0 ] || [ "$count" = 1 ] ||
    { printf >&2 'EspoCRM %s %s is not unique.\n' "$entity" "$value"; exit 1; }
  if [ "$count" = 0 ]; then
    curl -fsS -u "admin:$espo_password" \
      -H 'content-type: application/json' \
      -X POST "$espo_base/$entity" -d "$payload"
  else
    jq -c '.list[0]' <<<"$found"
  fi
}

doli_get_user() {
  local login="$1"
  curl -fsS -H "DOLAPIKEY: $doli_api_key" \
    "$doli_base/users/login/$login"
}

manifest_sha256="$(sha256sum "$manifest" | cut -d' ' -f1)"
company_name="$(jq -r '.company.name' "$manifest")"
company_email="$(
  jq -r '.company.emailLocalPart + "@" + .company.emailDomain' "$manifest"
)"
company_website="$(jq -r '.company.website' "$manifest")"

# The canonical organization is an EspoCRM Account and the owned Dolibarr
# installation company. The exact name is readable through both providers.
espo_company_payload="$(
  jq -cn \
    --arg name "$company_name" \
    --arg emailAddress "$company_email" \
    --arg website "$company_website" \
    '{name:$name,emailAddress:$emailAddress,website:$website,type:"Customer"}'
)"
step=company_materialization
espo_company="$(espo_ensure Account name "$company_name" "$espo_company_payload")"

"${compose[@]}" exec -T doli-db sh -eu -c '
  mariadb -uroot -p"$(cat /run/secrets/root)" dolidb -e "
    UPDATE llx_const
       SET value = \"Panskys Zoo Enterprises\"
     WHERE name = \"MAIN_INFO_SOCIETE_NOM\" AND entity = 1;
    INSERT INTO llx_const(name, value, type, visible, note, entity)
      SELECT \"MAIN_INFO_SOCIETE_NOM\", \"Panskys Zoo Enterprises\", \"chaine\", 0,
             \"ChimpMaera v0.1 deterministic demo company\", 1
       WHERE NOT EXISTS (
         SELECT 1 FROM llx_const
          WHERE name = \"MAIN_INFO_SOCIETE_NOM\" AND entity = 1
       );
  "
' >/dev/null

roles='[]'
while IFS= read -r role; do
  role_id="$(jq -r '.roleId' <<<"$role")"
  espo_name="$(jq -r '.espocrmName' <<<"$role")"
  doli_group="$(jq -r '.dolibarrGroup' <<<"$role")"
  step="role_materialization:$role_id"
  espo_payload="$(
    jq -cn \
      --arg name "$espo_name" \
      --argjson data "$(jq -c '.espocrmAcl' <<<"$role")" \
      '{name:$name,assignmentPermission:"team",userPermission:"no",portalPermission:"no",groupEmailAccountPermission:"no",data:$data}'
  )"
  espo_role="$(espo_ensure Role name "$espo_name" "$espo_payload")"
  espo_role_id="$(jq -r '.id' <<<"$espo_role")"

  "${compose[@]}" exec -T doli-db sh -eu -c "
    mariadb -uroot -p\"\$(cat /run/secrets/root)\" dolidb -e \"
      INSERT INTO llx_usergroup(nom, entity, datec, note)
        SELECT '$doli_group', 1, UTC_TIMESTAMP(),
               'ChimpMaera v0.1 role $role_id'
         WHERE NOT EXISTS (
           SELECT 1 FROM llx_usergroup
            WHERE nom = '$doli_group' AND entity = 1
         );
    \"
  " </dev/null >/dev/null
  doli_group_json="$(
    curl -fsS -H "DOLAPIKEY: $doli_api_key" --get "$doli_base/users/groups" \
      --data-urlencode 'limit=20' \
      --data-urlencode "sqlfilters=(t.nom:=:'$doli_group')"
  )"
  [ "$(jq 'length' <<<"$doli_group_json")" = 1 ] ||
    { printf >&2 'Dolibarr group %s is not unique.\n' "$doli_group"; exit 1; }
  doli_group_id="$(jq -r '.[0].id' <<<"$doli_group_json")"

  while IFS= read -r permission_id; do
    "${compose[@]}" exec -T doli-db sh -eu -c "
      mariadb -uroot -p\"\$(cat /run/secrets/root)\" dolidb -e \"
        INSERT INTO llx_usergroup_rights(entity, fk_usergroup, fk_id)
          SELECT 1, $doli_group_id, $permission_id
           WHERE EXISTS (SELECT 1 FROM llx_rights_def WHERE id = $permission_id)
             AND NOT EXISTS (
               SELECT 1 FROM llx_usergroup_rights
                WHERE entity = 1 AND fk_usergroup = $doli_group_id
                  AND fk_id = $permission_id
             );
      \"
    " </dev/null >/dev/null
  done < <(jq -r '.dolibarrPermissionIds[]' <<<"$role")

  roles="$(
    jq -c \
      --arg roleId "$role_id" \
      --arg espoId "$espo_role_id" \
      --arg espoName "$espo_name" \
      --arg doliId "$doli_group_id" \
      --arg doliName "$doli_group" \
      '. + [{roleId:$roleId,espocrm:{id:$espoId,name:$espoName},dolibarr:{id:$doliId,name:$doliName}}]' \
      <<<"$roles"
  )"
done < <(jq -c '.roles[]' "$manifest")

mappings='[]'
while IFS= read -r persona; do
  mapping_id="$(jq -r '.mappingId' <<<"$persona")"
  first_name="$(jq -r '.firstName' <<<"$persona")"
  last_name="$(jq -r '.lastName' <<<"$persona")"
  email="$(
    jq -r '.emailLocalPart + "@" + .emailDomain' <<<"$persona"
  )"
  login="$(jq -r '.login' <<<"$persona")"
  role_id="$(jq -r '.roleId' <<<"$persona")"
  step="persona_materialization:$mapping_id"
  role_mapping="$(jq -c --arg roleId "$role_id" '.[]|select(.roleId == $roleId)' <<<"$roles")"
  espo_role_id="$(jq -r '.espocrm.id' <<<"$role_mapping")"
  doli_group_id="$(jq -r '.dolibarr.id' <<<"$role_mapping")"

  espo_persona_password="$(<"$state/secrets/espo-$login")"
  espo_user_payload="$(
    jq -cn \
      --arg userName "$login" \
      --arg firstName "$first_name" \
      --arg lastName "$last_name" \
      --arg emailAddress "$email" \
      --arg password "$espo_persona_password" \
      '{userName:$userName,type:"regular",isActive:true,firstName:$firstName,lastName:$lastName,emailAddress:$emailAddress,password:$password}'
  )"
  espo_user="$(espo_ensure User userName "$login" "$espo_user_payload")"
  espo_user_id="$(jq -r '.id' <<<"$espo_user")"
  curl -fsS -u "admin:$espo_password" \
    -H 'content-type: application/json' \
    -X PUT "$espo_base/User/$espo_user_id" \
    -d "$(jq -cn --arg password "$espo_persona_password" '{isActive:true,password:$password}')" \
    >/dev/null
  # EspoCRM relation writes use a toggle-style link endpoint; rolesIds in an
  # entity PUT is presentation data and is intentionally ignored. Read before
  # writing so a warm rerun cannot remove an already-present role.
  espo_user="$(curl -fsS -u "admin:$espo_password" "$espo_base/User/$espo_user_id")"
  while IFS= read -r stale_role_id; do
    curl -fsS -u "admin:$espo_password" \
      -H 'content-type: application/json' \
      -X DELETE "$espo_base/User/$espo_user_id/roles" \
      -d "$(jq -cn --arg roleId "$stale_role_id" '{ids:[$roleId]}')" \
      >/dev/null
  done < <(
    jq -r --arg roleId "$espo_role_id" \
      '(.rolesIds // [])[]|select(. != $roleId)' <<<"$espo_user"
  )
  if ! jq -e --arg roleId "$espo_role_id" \
    'any((.rolesIds // [])[]; . == $roleId)' <<<"$espo_user" >/dev/null; then
    curl -fsS -u "admin:$espo_password" \
      -H 'content-type: application/json' \
      -X POST "$espo_base/User/$espo_user_id/roles" \
      -d "$(jq -cn --arg roleId "$espo_role_id" '{ids:[$roleId]}')" \
      >/dev/null
  fi
  espo_user="$(curl -fsS -u "admin:$espo_password" "$espo_base/User/$espo_user_id")"

  if doli_user="$(doli_get_user "$login" 2>/dev/null)"; then
    :
  else
    doli_user_id="$(
      curl -fsS -H "DOLAPIKEY: $doli_api_key" \
        -H 'content-type: application/json' \
        -X POST "$doli_base/users" \
        -d "$(
          jq -cn \
            --arg login "$login" \
            --arg firstname "$first_name" \
            --arg lastname "$last_name" \
            --arg email "$email" \
            --arg pass "$(<"$state/secrets/doli-$login")" \
            '{login:$login,firstname:$firstname,lastname:$lastname,email:$email,pass:$pass,statut:1,entity:1}'
        )"
    )"
    doli_user="$(curl -fsS -H "DOLAPIKEY: $doli_api_key" "$doli_base/users/$doli_user_id")"
  fi
  doli_user_id="$(jq -r '.id' <<<"$doli_user")"
  doli_groups="$(
    curl -fsS -H "DOLAPIKEY: $doli_api_key" "$doli_base/users/$doli_user_id/groups"
  )"
  if ! jq -e --arg id "$doli_group_id" \
    'any((.id|tostring) == $id)' <<<"$doli_groups" >/dev/null; then
    curl -fsS -H "DOLAPIKEY: $doli_api_key" \
      "$doli_base/users/$doli_user_id/setGroup/$doli_group_id" >/dev/null
  fi
  doli_user="$(doli_get_user "$login")"
  doli_groups="$(
    curl -fsS -H "DOLAPIKEY: $doli_api_key" "$doli_base/users/$doli_user_id/groups"
  )"

  jq -e \
    --arg login "$login" --arg roleId "$espo_role_id" \
    '.userName == $login and .isActive == true and any(.rolesIds[]; . == $roleId)' \
    <<<"$espo_user" >/dev/null
  jq -e \
    --arg login "$login" \
    '.login == $login and .status == "1" and .admin == "0"' \
    <<<"$doli_user" >/dev/null
  jq -e --arg groupId "$doli_group_id" \
    'any((.id|tostring) == $groupId)' \
    <<<"$doli_groups" >/dev/null

  mappings="$(
    jq -c \
      --arg mappingId "$mapping_id" \
      --arg login "$login" \
      --arg roleId "$role_id" \
      --arg espoUserId "$espo_user_id" \
      --arg espoRoleId "$espo_role_id" \
      --arg doliUserId "$doli_user_id" \
      --arg doliGroupId "$doli_group_id" \
      '. + [{mappingId:$mappingId,login:$login,roleId:$roleId,espocrm:{userId:$espoUserId,roleId:$espoRoleId},dolibarr:{userId:$doliUserId,groupId:$doliGroupId}}]' \
      <<<"$mappings"
  )"
done < <(jq -c '.personas[]' "$manifest")

doli_company="$(
  curl -fsS -H "DOLAPIKEY: $doli_api_key" "$doli_base/setup/company"
)"
step=exact_count_reconciliation
expected="$(jq -c '.expectedCounts' "$manifest")"
jq -e --arg name "$company_name" '.name == $name' <<<"$doli_company" >/dev/null
jq -e \
  --argjson expected "$expected" \
  --argjson roles "$roles" \
  --argjson mappings "$mappings" \
  '($roles|length) == $expected.rolesPerProvider
   and ($mappings|length) == $expected.crossProviderMappings
   and ([ $mappings[].espocrm.userId ]|unique|length) == $expected.personas
   and ([ $mappings[].dolibarr.userId ]|unique|length) == $expected.personas' \
  <<<"null" >/dev/null

install -d -m 700 "$(dirname "$output")"
tmp="$(mktemp "$(dirname "$output")/.identity-bootstrap.XXXXXX")"
jq -n \
  --arg manifestId "$(jq -r '.manifestId' "$manifest")" \
  --arg manifestSha256 "$manifest_sha256" \
  --arg companyName "$company_name" \
  --arg espoCompanyId "$(jq -r '.id' <<<"$espo_company")" \
  --argjson roles "$roles" \
  --argjson mappings "$mappings" \
  --argjson expected "$expected" \
  '{
    schemaVersion:"chimpmaera.demo/identity-bootstrap/v1",
    status:"PASS",
    manifest:{id:$manifestId,sha256:$manifestSha256},
    company:{name:$companyName,espocrmAccountId:$espoCompanyId,dolibarrEntity:1},
    roles:$roles,
    mappings:$mappings,
    exactCounts:$expected
  }' >"$tmp"
chmod 600 "$tmp"
mv -f "$tmp" "$output"
