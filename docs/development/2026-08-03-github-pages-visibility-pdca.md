# GitHub Pages visibility slice — PDCA

## Plan

- **Metric:** `github_pages_visibility`, target `1/1`.
- **Locally reachable:** the repository already has a public documentation
  corpus, a pinned Node/npm toolchain, release-governance checks, and a public
  GitHub Pages URL namespace. No tenant, customer, or production evidence is
  required to build and validate a curated static site.
- **Locally implementable:** site source, intent page, capability/evidence
  matrix, examples gallery, canonical/OG/JSON-LD metadata, sitemap, robots,
  workflow, and fail-closed tests.
- **Externally effective:** branch delivery, Pages activation/deployment, and
  anonymous HTTP readback. These remain subject to the normal PR/CI/release
  delivery gates.
- **Rejected action:** CodeMeta, `llms.txt`, Discussions, About-homepage edits,
  custom social artwork, and broad content expansion were not bundled. They do
  not improve this bounded site's minimum integrated user value enough to
  justify the added drift and review surface.

## Do

- Added a VitePress site at the stable `/ChimpMaera/` base with a curated home,
  one governed-agent-action intent route, capability/evidence matrix, and
  reproducible examples gallery.
- Generated curated sitemap output and a permissive project robots policy.
- Added per-page canonical, OpenGraph, Twitter-card, and
  `SoftwareSourceCode` JSON-LD metadata. The version is derived from release
  governance rather than manually duplicated.
- Excluded `docs/development/**` from generated output and rewrote links that
  intentionally leave the docs root to public GitHub source URLs.
- Added a pinned, least-privilege Pages workflow and deterministic output tests.
- Added every released source byte to the public manifest and source-tree
  checksum closure; the package candidate version advances to `.7`.

## Check

- Site build/metadata/sitemap/robots/development-exclusion and immutable,
  least-privilege workflow checks: **4/4 PASS**.
- SAFE_GUIDED proof and negative probes after documentation digest refresh:
  **12/12 PASS**.
- Release governance and negative mutations: **19/19 PASS**.
- Authoritative repository suite: **304/304 PASS**.
- Video reference unit tests: **43/43 PASS**; Docker smoke: **PASS**.
- TypeScript lint/build: **PASS**.
- Supply-chain declaration families: **6/6 PASS**.
- npm audit, including development build tooling: **0 vulnerabilities**.
- Public release staging and privacy/secret/path hygiene: **PASS**.

The first dependency check rejected the newest stable VitePress dependency
closure because npm reported one high and two moderate Vite/esbuild
advisories. The accepted conservative assumption pins VitePress `1.6.4` and
overrides its build-only Vite dependency to patched `6.4.3`. The complete site
build and metadata suite pass on that closure and npm audit reports zero known
vulnerabilities.

## Act

- **Decision:** accept the bounded source candidate for PR-governed delivery.
- **Risk:** Vite `6.4.3` is a tested build-only compatibility override outside
  VitePress 1.x's declared Vite 5 range.
- **Fallback:** revert the Pages workflow/site commit; this leaves the existing
  README and repository docs authoritative and does not mutate prior tags or
  release assets.
- **Review marker:** replace the override when VitePress publishes a stable
  dependency closure that passes audit, or re-run the full docs gate before
  changing either pinned version.
- **Claim boundary:** successful build and repository evidence establish a
  curated local-PoC documentation surface. They do not establish search rank,
  adoption, production readiness, live-system compatibility, or universal
  security.
