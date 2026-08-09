# Governed Integration Foundations V1 post-publication binding

Status: anonymously published and read back; local-synthetic release claims
only. This record does not authorize or perform any GitHub or infrastructure
mutation.

## Plan

Bind the regular Latest release `v0.2.0-poc.20260809.1` to exact public
metadata, asset bytes and the three bounded component slices delivered through
Issues #64/#56/#60, PRs #142/#143/#144 and release-preparation PR #145.

## Do

- Release ID: `367393050`.
- Title: `ChimpMaera — Governed Integration Foundations V1`.
- Direct commit tag and target: `a931a10a56039b51ac7120ee507c8dc9c7c045eb`.
- Published: `2026-08-09T06:07:58Z`, with `draft=false` and
  `prerelease=false`.
- Public URL:
  `https://github.com/JimPansky/ChimpMaera/releases/tag/v0.2.0-poc.20260809.1`.
- Archive: 1,517,951 bytes, SHA-256
  `b3286c71b90222d9e65adb47cf95b7fc19e94552c4836b8ba1c9e92d9ef7af7a`.
- Checksum sidecar: 142 bytes, SHA-256
  `2d454268bf2a2bd37aa496c4865938a8160db2cae2c28e52892a55a23c0a98e1`.

## Check

Anonymous API reads with no authorization header confirmed the release by ID,
the regular `/releases/latest` result, and the direct commit tag. The published
sidecar was anonymously downloaded and its archive declaration matched. The
protected delivery evidence is CI run `31296740339` for PR #142,
`31297173282` for PR #143, `31297613239` for PR #144 and `31298010196` for PR
#145. The release-preparation record reports release governance 29/29, root
checksums 520/520, authoritative repository 366/366 plus Secure Default 12/12
and Learning Routing 26/26, and a 467-file public staging build.

The post-publication binding must additionally pass focused component tests,
release-governance verification and negative probes, documentation gates,
supply-chain declaration verification, the authoritative repository suite,
root checksums, an isolated public build, and the repository anonymous public
readback against the updated public `main` surfaces.

## Act and rollback

This binding is documentation and verification metadata only. Roll back by
reverting its single local commit, which restores the prior truth snapshot;
do not move the tag, replace assets or mutate the published release. A failed
anonymous readback blocks the new public claim until the protected public
surfaces match the release record.

Evidence remains local and synthetic. No real tenant, provider, credential,
connector import, production deployment, runtime activation, external write,
media publication, monitoring, universal compatibility, registry signature,
provenance, SBOM, CVE status, license verification or reproducible build is
claimed.
