#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state="$root/.chimpmaera-demo"
config="$state/config.env"
manifest="$root/demo/manifests/catalog/crm-erp-playable-v1.json"
output="${1:-$state/public/catalog-bootstrap.json}"

[ -f "$config" ] || { printf >&2 'Catalog bootstrap requires an installed demo.\n'; exit 1; }
[ -s "$manifest" ] || { printf >&2 'Catalog bundle is missing.\n'; exit 1; }
[ -s "$state/secrets/chimp-api-token" ] ||
  { printf >&2 'PANSPHAIRA API token is missing.\n'; exit 1; }

set -a
# shellcheck disable=SC1090
source "$config"
set +a

api_token="$(<"$state/secrets/chimp-api-token")"
catalog="$(
  curl -fsS --retry 2 --retry-connrefused \
    -H "Authorization: Bearer $api_token" \
    "http://$CM_CHIMP_PORT/api/demo/catalog"
)"
expected="$(jq -c '.expectedCounts' "$manifest")"

jq -e \
  --arg id "$CM_CATALOG_MANIFEST_ID" \
  --arg sha256 "$CM_CATALOG_MANIFEST_SHA256" \
  --argjson expected "$expected" \
  '.status == "PASS"
   and .bundle.bundleId == $id
   and .bundle.sha256 == $sha256
   and .bundle.catalogVersion == "1.0.0"
   and .exactCounts == $expected
   and (.templates|length) == $expected.templates
   and (.useCases|length) == $expected.useCases
   and (.metadata|length) == $expected.metadataRecords
   and ([.templates[].templateId]|unique|length) == $expected.templates
   and ([.useCases[].useCaseId]|unique|length) == $expected.useCases
   and ([.metadata[].metadataId]|unique|length) == $expected.metadataRecords
   and any(.useCases[]; .demoEffect == "governed_crm_to_erp_order")' \
  <<<"$catalog" >/dev/null

install -d -m 700 "$(dirname "$output")"
tmp="$(mktemp "$(dirname "$output")/.catalog-bootstrap.XXXXXX")"
jq -n \
  --arg manifestId "$CM_CATALOG_MANIFEST_ID" \
  --arg manifestSha256 "$CM_CATALOG_MANIFEST_SHA256" \
  --arg catalogVersion "$(jq -r '.bundle.catalogVersion' <<<"$catalog")" \
  --argjson counts "$(jq -c '.exactCounts' <<<"$catalog")" \
  '{
    schemaVersion:"chimpmaera.demo/catalog-bootstrap/v1",
    status:"PASS",
    authentication:"PASS",
    manifest:{id:$manifestId,sha256:$manifestSha256,catalogVersion:$catalogVersion},
    exactCounts:$counts
  }' >"$tmp"
chmod 600 "$tmp"
mv -f "$tmp" "$output"
