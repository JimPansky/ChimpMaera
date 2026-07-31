#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state="$root/.chimpmaera-demo"
config="$state/config.env"
output="${1:-$state/public/provider-bootstrap.json}"

[ -f "$config" ] || { printf >&2 'Provider bootstrap requires an installed demo.\n'; exit 1; }
[ -s "$state/secrets/espo-admin" ] || { printf >&2 'EspoCRM admin secret is missing.\n'; exit 1; }
[ -s "$state/secrets/doli-api-key" ] || { printf >&2 'Dolibarr API-key secret is missing.\n'; exit 1; }

set -a
# shellcheck disable=SC1090
source "$config"
set +a

compose=(docker compose --env-file "$config" -f "$root/demo/compose.yaml")
espo_password="$(<"$state/secrets/espo-admin")"
doli_api_key="$(<"$state/secrets/doli-api-key")"

# EspoCRM owns and executes its schema migration. This is idempotent and is
# intentionally serialized before any provider-local identities are created.
"${compose[@]}" exec -T espocrm php bin/command migrate >/dev/null
espo_version="$("${compose[@]}" exec -T espocrm php bin/command version | tr -d '\r\n')"
espo_auth="$(
  curl -fsS --retry 2 --retry-connrefused \
    -u "admin:$espo_password" "http://$CM_ESPO_PORT/api/v1/App/user"
)"
jq -e '
  .user.id != null
  and .user.userName == "admin"
  and .user.type == "admin"
' <<<"$espo_auth" >/dev/null

# Dolibarr enables REST during its image-owned initialization. Bootstrap the
# random local API credential through the owned database, then prove it by an
# authenticated semantic request. No credential is emitted to the receipt.
"${compose[@]}" exec -T -e CM_DOLI_API_KEY="$doli_api_key" doli-db sh -eu -c '
  mariadb -uroot -p"$(cat /run/secrets/root)" dolidb -e "
    UPDATE llx_user
       SET api_key = \"${CM_DOLI_API_KEY}\"
     WHERE login = \"admin\"
       AND (api_key IS NULL OR api_key <> \"${CM_DOLI_API_KEY}\");
  "
' >/dev/null
doli_status="$(
  curl -fsS --retry 2 --retry-connrefused \
    -H "DOLAPIKEY: $doli_api_key" "http://$CM_DOLI_PORT/api/index.php/status"
)"
doli_admin="$(
  curl -fsS --retry 2 --retry-connrefused \
    -H "DOLAPIKEY: $doli_api_key" \
    "http://$CM_DOLI_PORT/api/index.php/users?sqlfilters=(t.login:=:%27admin%27)"
)"
jq -e '
  .success.code == 200
  and .success.access_locked == "0"
  and (.success.dolibarr_version | type == "string")
' <<<"$doli_status" >/dev/null
jq -e '
  length == 1
  and .[0].login == "admin"
  and .[0].admin == "1"
  and .[0].status == "1"
' <<<"$doli_admin" >/dev/null

install -d -m 700 "$(dirname "$output")"
tmp="$(mktemp "$(dirname "$output")/.provider-bootstrap.XXXXXX")"
jq -n \
  --arg espoVersion "$espo_version" \
  --argjson espoAuth "$espo_auth" \
  --argjson doliStatus "$doli_status" \
  --argjson doliAdmin "$doli_admin" \
  '{
    schemaVersion:"chimpmaera.demo/provider-bootstrap/v1",
    status:"PASS",
    espocrm:{
      version:$espoVersion,
      migration:"COMPLETE",
      authentication:"PASS",
      admin:{
        id:$espoAuth.user.id,
        userName:$espoAuth.user.userName,
        type:$espoAuth.user.type
      }
    },
    dolibarr:{
      version:$doliStatus.success.dolibarr_version,
      migration:"COMPLETE",
      apiModule:"ENABLED",
      authentication:"PASS",
      admin:{
        id:$doliAdmin[0].id,
        login:$doliAdmin[0].login,
        isAdmin:($doliAdmin[0].admin == "1"),
        active:($doliAdmin[0].status == "1")
      }
    }
  }' >"$tmp"
chmod 600 "$tmp"
mv -f "$tmp" "$output"
