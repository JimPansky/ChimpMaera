# README, Public Truth and discoverability release handoff

Status: **local release candidate** for the planned 2026-08-03 release window.
This document does not authorize a merge, release, package publication or
GitHub settings change.

## Candidate commits

Source commits, in dependency order:

1. `985ff02` — establish the public discoverability baseline and docs hub.
2. `cd9c981` — synchronize citation and private package metadata.
3. `97c6a9b` — complete P0 Public Truth.
4. `dc7fa08` — complete P1 README UX and information architecture.

Prepared from verified public `origin/main` commit
`cebfe1139797f5ed6cba7f30aeed73d4c27dc44b`. Commit `b4abc2c` contains the
earlier handoff state and is superseded by this document. A later WIP=1
integration lane must review drift, create the governing pull request and rerun
all gates. No pull request or issue was created here.

## P0 result

- Scoped the strict no-ambient-authority claim to the governed `SAFE_GUIDED`
  reference path; documented that `FULL_CONTROL_LAB` / `RAMPAGE` can bypass
  ChimpMaera action and approval gates and is not a security boundary.
- Described `v0.1.0` as the historical initial public baseline, not a direct
  predecessor.
- Restored three anonymously verified public videos and the local Ko-fi / Buy
  Me a Coffee image buttons with accessible text.
- Corrected stale Builder, connection, Supply Chain, demo, architecture and
  Canon status wording while preserving local-synthetic and external-evidence
  limits.

## P1 result

- Replaced the dominant 420 px single-theme hero with a 260 px GitHub
  `<picture>` using the manifested master and negative SVG assets.
- Reduced the root README to six H2 sections and prioritized `Run POC`,
  `Latest release` and `How it works`.
- Added four grouped current-capability statements and a task-oriented docs hub
  organized as Start, Understand, Verify, Extend, and Limitations/Status.
- Added exactly one local process diagram: a 720×560, mobile-safe,
  light/dark-aware `SAFE_GUIDED` SVG with six nodes, connector-under-node
  ordering, no remote dependencies and an equivalent alt description.
- Added a discreet releases Atom link, synchronized maintainable metadata and
  recorded discoverability measurement plus channel decisions. No profile/
  resource-plane diagram, screenshot, website, `llms.txt` or roadmap wallpaper
  was added.

Root README comparison: 126 lines, about 576 Markdown words, 6 H2 headings,
31 Markdown link occurrences, 25 unique Markdown targets and 4 local images,
versus the audit baseline of 151 / 796 / 9 / 32 / 26 / 1. The lower density is
an orientation improvement, not a numeric target.

## Candidate files

Public and validation surfaces:

- `README.md`, `docs/README.md`, `assets/diagrams/safe-guided-flow.svg`
- `docs/ARCHITECTURE.md`, `docs/BUILDER-AGENT-OPERATOR-GUIDE.md`,
  `docs/CANON.md`, `docs/CONNECT-YOUR-FIRST-SYSTEM.md`,
  `docs/SUPPLY-CHAIN.md`, `demo/README.md`
- `docs/DISCOVERABILITY-BASELINE.md`,
  `docs/VISIBILITY-CHANNEL-MATRIX.md`
- `CITATION.cff`, `package.json`, `package-lock.json`
- `release/governance.json`, `release/public-files.manifest`, `SHA256SUMS`
- `scripts/verify-release-governance.mjs`,
  `tests/release-governance.test.mjs`

This handoff remains repository-only development evidence under the existing
public-staging policy.

## Draft component claimEvidence

- **Component:** README Public Truth, UX and discoverability.
- **Claim:** the first public screen identifies today's proved product as an
  open-source local PoC/control plane for governed, verifiable AI-agent actions
  across business systems and identifies the Knowledge Operating System only
  as broader direction. It routes readers to current capabilities, evidence,
  limitations and release identity through a theme-safe, accessible layout.
- **User value:** a human or machine reader can understand the current product,
  follow the `SAFE_GUIDED` effect path and locate evidence without interpreting
  planned direction as shipped maturity.
- **Functional proof:** local links pass; the SVG parses and renders; citation
  and private package metadata agree with `v0.2.0-poc.20260803.1`; lint/build,
  full tests 280/280, Release Governance 15/15, Supply Chain, 375/375 root
  checksums and 323/323 staged checksums pass.
- **Safety proof:** Knowledge-OS promotion, stale release identity, withdrawn
  video and private-path negative probes fail closed; the public-stage scanner
  and privacy/secret diff scan pass; no external mutation occurred.
- **Evidence paths:** this document, `docs/README.md`,
  `docs/SECURITY-ASSURANCE.md`, `docs/KNOWN-LIMITATIONS.md`,
  `release/governance.json`, `tests/release-governance.test.mjs`.

### Non-claims

- No production readiness, security certification, hosted service, live-tenant
  integration, generic write path or external authority is claimed.
- No search ranking, Retrieval@10, recommendation, adoption, benchmark or
  backlink improvement is claimed.
- Knowledge Operating System remains direction, not shipped maturity.
- Release of contract bytes does not prove live-system or production fitness.
- Package metadata does not authorize npm publication.
- Videos, the Atom feed and support links are not release evidence.

## PDCA and integration gate

- **Plan:** close P0 truth before the P1 visual/IA layer on the verified base;
  keep external settings and release actions out of scope.
- **Do:** implemented P0 and P1 in separate commits, using only local,
  manifested media and conservative maturity labels.
- **Check:** all existing required gates passed; the only public URL returning
  a bot response was the unchanged Ko-fi destination (`403`), while Latest,
  both release tags, the Atom feed, Buy Me a Coffee and all three YouTube links
  returned anonymous success. The diagram's text contrast is at least 4.5:1 in
  both declared themes.
- **Act:** retain the accessible defaults. Review/rollback marker: if GitHub's
  renderer regresses `<picture>` or SVG media queries, fall back to the master
  logo and the same SVG light palette without changing product claims.

Rejected action: any external GitHub mutation or release. Before later merge or
publication, bind an issue or document a bounded no-issue rationale, create the
PR, refresh the base, rerun all gates and bind the merged SHA, assets and
anonymous readback.

## GitHub settings to apply separately

- **About description:** `Open-source local proof of concept for governed AI-agent actions across business systems, with policy, approval, brokered execution, authoritative readback, and receipts.`
- **Topics:** `ai-agents`, `agent-governance`, `ai-governance`,
  `policy-enforcement`, `human-in-the-loop`, `auditability`, `docker`, `crm`,
  `erp`, `openclaw`.
- **Homepage:** leave unset until a stable owned canonical docs/project URL
  exists.

## Separate product candidates

HMI-009 `499f04c99fe4edbe896c778eeffab3d47204ab81` and HMI-010
`f7a66ce7a449f122bfbacc986d4c9ac6f99bd35a` were not integrated. They remain
separate possible release components for a later WIP=1 integration decision.
