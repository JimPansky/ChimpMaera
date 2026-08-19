# PAN-LINK-01 owner, Pages and worker cutover audit

Issue: #235

## Decision

The canonical current repository is `JoFe2/PANSPHAIRA` and the canonical Pages
root is `https://jofe2.github.io/PANSPHAIRA/`. The stable `PANSPHAIRA` slug,
technical identifiers and historical objects do not change.

The fresh baseline contained 131 exact former-owner tokens on 123 tracked
lines. This slice classifies all of them before mutation:

- **FIX — 104 occurrences.** Current README/navigation/download/community
  URLs, root security links, issue-template routes, citation and package
  metadata, active docs and roadmap links, VitePress repository/site/social
  metadata, sitemap/robots, current generators and validators, docs tests, and
  the Development Worker trusted repository/project/origin/example bindings.
- **KEEP — 7 occurrences.** Three sponsorship-handle occurrences in
  `.github/FUNDING.yml` and the README support link; four deliberately foreign
  Development Worker negative-fixture occurrences on the two adjacent
  `PrivateDenied`/`OtherRepo` probe lines. These values are identities, not
  current project routes.
- **HISTORICAL — 20 occurrences.** Nineteen immutable or quoted ChimpMaera-era
  provenance occurrences under `archive/`, `docs/development/` and
  `examples/daily-poc/`; one version-bound external-video release URL fixture
  whose historical asset path is part of the test input.

After FIX application, 27 former-owner token occurrences remain on 25 lines:
exactly KEEP 7 plus HISTORICAL 20. The executable classifier in
`tests/public-product-spelling.test.mjs` scans every tracked text file and
fails on any unclassified occurrence.

## Preserved identity and compatibility

- `CITATION.cff` keeps author name `Jim Pansky`; only repository URLs change.
- Sponsorship handles remain byte-identical because account ownership was not
  independently re-decided by this repository-link cutover.
- Constant names, claim IDs, schema IDs, package name, service/runtime IDs,
  environment variables, headers, test IDs and historical issue/PR/tag/release
  numbers remain unchanged.
- `CHIMPMAERA_PUBLIC_REPOSITORY` and related constant names remain stable
  technical identifiers; only their external repository values move to the
  canonical owner. The former current-repository route is added as an explicit
  zero-provider-call denial probe.

## Risk, fallback and rollback

Risk is link or metadata drift across duplicate consumers. Tests assert exact
README, package, issue-template, VitePress, OpenGraph, SoftwareSourceCode,
sitemap, robots and worker bindings. If anonymous readback disagrees, restore
the last verified homepage setting and use a protected successor PR. Do not
rewrite historical evidence, authorship, funding handles, tags, releases or
assets.
