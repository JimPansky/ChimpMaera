# Intent and evidence content set — PDCA

## Plan

- **Metric:** `intent_evidence_content_completion`, target `1/1`.
- **Locally reachable:** the current Pages foundation, canonical evidence,
  runnable local fixtures, and deterministic docs/release tests already exist.
  The missing work is a bounded static content and navigation set; it requires
  no tenant, live provider, customer record, or production claim.
- **Locally implementable:** one CRM-to-ERP approval/readback intent route, an
  honest alternatives route, a curated Now/Next/Later route, integration with
  the existing capability/examples/use-case set, and drift/sitemap/navigation
  gates.
- **Preparable:** a later recurring public-truth audit can sample route health,
  issue drift, Latest, and anonymous readback after this content is delivered.
- **Externally effective:** PR delivery, Pages deployment, and anonymous route
  readback remain governed by required CI and the normal GitHub delivery path.
- **Rejected action:** additional CodeMeta, `llms.txt`, social artwork, and
  broad keyword pages were not bundled. They add drift surface without the
  integrated user value of the missing intent, choice, and roadmap routes.

## Do

- Added a CRM-to-ERP page that follows proposal, policy, bound approval,
  one-use execution authority, authoritative readback, and receipt while
  linking the scoped `CM-SEC-007` proof and explicit non-claims.
- Added an alternatives page that distinguishes workflow, policy, Agent,
  isolation, observability, and conventional application-service problem
  classes without competitor or superiority claims.
- Added a curated Now/Next/Later route. Live GitHub issues and labels remain
  authoritative; the page does not become a second backlog or release source.
- Integrated all six intent/evidence routes into site navigation, the docs
  hub, home-page actions, sitemap, and cross-links.
- Added an exact authority-free fixture command to the examples gallery and
  executed the same four compiled test files locally.
- Added the three public files to both the release manifest and
  `activePublicFiles`, binding them to package inclusion and public-truth drift
  coverage.
- Extended the generated-site test to require canonical metadata, curated
  sitemap inclusion, direct Run/Evidence/Limitations/Q&A/Contribute reachability,
  issue links, alternatives categories, evidence/non-claim wording, claim
  hygiene, public manifest inclusion, and governance coverage.

## Check

- Generated site, metadata, sitemap, route reachability, public-truth coverage,
  claim hygiene, and Pages workflow checks: **5/5 PASS**.
- Documented authority-free contract fixtures: **19/19 PASS**.
- SAFE_GUIDED proof and negative probes: **12/12 PASS**.
- Release governance and negative mutations: **20/20 PASS**.
- Authoritative repository suite after the final source changes:
  **304/304 PASS**.
- TypeScript build/lint: **PASS**.
- Supply-chain declaration families: **6/6 PASS**.
- npm audit including documentation build tooling: **0 vulnerabilities**.
- `git diff --check`: **PASS**.
- Repository-tree `SHA256SUMS` after deterministic regeneration: **PASS**.

The first authoritative run correctly failed **303/304** with
`UNMANIFESTED_SOURCE_FILE:docs/roadmap.md`. The release manifest was corrected,
the isolated staging regression passed **1/1**, and the complete authoritative
suite then passed **304/304** twice, including after adding active public-truth
coverage.

The first PR CI run then correctly rejected the source commit at the
repository-tree checksum step. The content, governance, manifest, and test
bytes had changed while `SHA256SUMS` still described the prior
checksum-governed tree. The hashes for changed bound files were refreshed and
the three new public routes were added without widening the established
closure to repository-only development evidence. The complete local checksum
check passed before the CI fix was pushed.

## Act

- **Decision:** accept the content set as one coherent, release-worthy public
  increment. It closes the ordered intent/evidence frontier instead of adding
  another assessment-only artifact.
- **Conservative assumption:** a small curated Now/Next/Later selection is
  safer than mirroring every issue. GitHub issue state remains authoritative.
- **Risk:** selected roadmap links can become stale when issue state changes.
- **Fallback:** revert this single bounded content commit. Existing Pages home,
  capability matrix, examples, Quickstart, evidence, and limitations remain
  valid public routes.
- **Review marker:** verify issue links and maturity wording during the next
  recurring public-truth audit or whenever a linked issue/release transitions.
- **Claim boundary:** these pages improve public navigation and explain the
  released local synthetic proof. They do not establish live-provider
  compatibility, production fitness, adoption, search rank, customer use, or
  universal security.

## Delivery completion

- Content PR **#86** passed required CI and was squash-merged as
  `67a4d44d69a686826afca0a8e47106ddd99db5b5`.
- Release-identity PR **#87** passed required CI and was squash-merged as
  `c82438953b8ab8d9f8d3b72157d09d9c4c61f844`.
- Main CI and the main-only Pages deployment passed on the exact release
  target.
- Two isolated public-package builds from that commit were byte-identical.
- Regular Latest `v0.2.0-poc.20260803.8` was published with exactly one archive
  and one SHA-256 sidecar. Archive SHA-256 is
  `83e9a3b1d814d64a261afaccb8a9afd87f060a1f00e1a9a443aa6157324ed070`;
  sidecar SHA-256 is
  `da5ca501ad9dfb5f05836ca229dc2047656c8025649b80efe92ccadcd90fbbf0`.
- Anonymous, unauthenticated readback proved the Latest redirect, lightweight
  tag target, byte-identical asset downloads, outer sidecar, internal package
  checksums, package version, Atom entry, and twelve primary Pages/community
  routes.
- The anonymous REST endpoint was rate-limited with HTTP 403 during readback;
  no authenticated substitute was counted as anonymous evidence. Direct
  public GitHub/release/git/Pages surfaces supplied the successful fallback.
- This post-publication binding updates canonical release truth to the
  immutable tag, target, asset names, sizes, and hashes; it does not replace or
  retarget the published release.
