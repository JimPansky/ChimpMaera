# INT-PROFILE-001 local synthetic contract slice PDCA / ADR

Status: implemented for local review; no publication, tenant, connector,
provider, credential, external write or runtime activation is authorized.

## Plan

Freeze the smallest reusable `cm.integration-profile/v1` manifest that covers
the five variants and nine negative probes in Issue #60. Reuse existing CM
contracts instead of adding authority, verification or update layers.

The repository root contains no `AGENTS.md`. Three files with that name are
fixtures inside isolated demo workspaces and were not applied to this root
change. Risk: a missing worker-specific root instruction could affect review.
Fallback: this additive slice follows adjacent BI, extension-assurance and
CM-OBS conventions and remains locally reversible. Review should confirm that
no out-of-band root instruction was expected.

## Do

- Added a closed Draft 2020-12 schema and TypeScript profile/evaluator.
- Added five digest-bound public-safe synthetic fixture variants.
- Added exactly nine table-driven fail-closed probes.
- Referenced Power Platform Read, Analytics, AWI, HMI Contribute,
  Verification Fabric, Extension Trust Lab and Update Doctor schema identities.
- Added a public contract guide and public manifest bindings.

No external source code or sample was copied. `Apache-2.0`, exact local CM
schema references and synthetic content digests provide the bounded upstream
identity; no provider compatibility is inferred.

## Check

Evidence on the final pre-commit tree:

- focused INT-PROFILE suite: 6/6 PASS, including 500 object-key reorderings,
  malformed primitive denial and variant/class crossover denial;
- authoritative repository suite after merging `origin/main` at
  `9e5f9ec6d83448b196e45443ae88e08c90c910b7`: 366/366 PASS;
- Secure Default manifest probes: 12/12 PASS;
- Learning Routing pretest: 26/26 PASS;
- Signal Release Intake focused suite: 4/4 PASS;
- Verification Fabric v2 focused suite: 16/16 PASS;
- video reference suite: 75/75 PASS;
- documentation site: 5/5 PASS;
- TypeScript lint, supply-chain verification, release-governance verification
  and Secure Default proof: PASS;
- root `SHA256SUMS`: 520/520 PASS;
- isolated public-release build and its public-safety scan: PASS with 467
  staged files; and
- `git diff --check`: PASS.

## Act

The change is additive. Revert the slice and its index, package, documentation,
manifest, Evidence-DAG and checksum bindings to roll back. If a future version
cannot pass replacement readback, preserve the old compatible read-only LKG;
if no compatible LKG exists, disable the route.

Review triggers: any new action, write behavior, real tenant/identity mode,
provider data, override name, host/path/proxy value, schema version, route
contract, freshness rule or rollback semantics. Such changes require a new
digest and fresh existing Verification Fabric evidence; this profile does not
itself grant acceptance or activation.
