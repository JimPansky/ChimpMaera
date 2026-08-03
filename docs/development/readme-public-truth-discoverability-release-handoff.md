# README/Public-Truth/Discoverability release handoff

Status: candidate for the planned 2026-08-03 18:00 release window. This handoff
does not authorize merge, release publication or GitHub settings changes.

## Release-ready commits

Apply in order onto the release integration lane:

1. `985ff02` — `docs: establish public discoverability baseline`
2. `cd9c981` — `chore: synchronize private release metadata`

Base inspected when prepared: `cebfe1139797f5ed6cba7f30aeed73d4c27dc44b`
(`origin/main`, after PR #62). The later WIP=1 integration lane must rebase or
cherry-pick, resolve drift, rerun all gates and create the governing pull
request. No pull request or issue was created by this lane.

## Candidate files

Public release files:

- `README.md`
- `CITATION.cff`
- `package.json` (remains `private: true`)
- `package-lock.json`
- `docs/README.md`
- `docs/DISCOVERABILITY-BASELINE.md`
- `docs/VISIBILITY-CHANNEL-MATRIX.md`
- `release/public-files.manifest`
- `SHA256SUMS`

Repository validation files:

- `scripts/verify-release-governance.mjs`
- `tests/release-governance.test.mjs`

This handoff file is development evidence and must remain excluded from the
public release manifest/archive by the existing supply-chain policy.

## Draft component claimEvidence

- **Component:** Public Truth and Discoverability
- **Claim:** ChimpMaera's first public screen identifies today's proved product
  as an open-source local proof of concept/control plane for governed,
  verifiable AI-agent actions across business systems; it identifies the
  vendor-neutral Knowledge Operating System only as broader direction. The
  documentation hub, citation/private-package metadata, release feed and fixed
  discoverability panel provide consistent paths to current evidence,
  limitations and release identity.
- **User value:** a human or machine reader can distinguish what works today,
  locate evidence and limitations, and follow regular releases without
  interpreting roadmap direction as shipped maturity.
- **Included bytes:** `README.md`, `docs/README.md`,
  `docs/DISCOVERABILITY-BASELINE.md`, `docs/VISIBILITY-CHANNEL-MATRIX.md`,
  `CITATION.cff`, `package.json`, `package-lock.json`,
  `scripts/verify-release-governance.mjs`,
  `tests/release-governance.test.mjs`, `release/public-files.manifest`,
  `SHA256SUMS`.
- **Functional proof:** changed-file Markdown links pass; citation YAML parses;
  private package and lock versions agree at `0.2.0-poc.20260803.1`; full test
  suite passes 280/280; release governance passes 15/15; lint, supply-chain
  verification and 374/374 checksum verification pass.
- **Safety proof:** the governance negative probe rejects promotion of
  Knowledge OS to current maturity; privacy/secret diff scan passes; external
  settings, registration, publishing, directory submission and posting remain
  unperformed.
- **Evidence paths:** `docs/README.md`,
  `docs/DISCOVERABILITY-BASELINE.md`, `docs/VISIBILITY-CHANNEL-MATRIX.md`,
  `tests/release-governance.test.mjs`.
- **Traceability:** source commits `985ff02` and `cd9c981`; governing PR is
  pending; no dedicated issue currently binds this bounded slice. The release
  lane must link its eventual PR and any chosen issue before claiming merged
  traceability.

### Non-claims

- No search ranking, Retrieval@10, recommendation rate, adoption or backlink
  improvement is claimed.
- Knowledge Operating System is direction, not current shipped maturity.
- No production readiness, security certification, hosted service, real-tenant
  integration or external write authority is claimed.
- Package metadata does not authorize or imply npm publication.
- GitHub About, topics and homepage recommendations have not been applied.
- The Atom link is a follow channel, not release or adoption evidence.
- The query panel is a measurement design, not an authorized recurring job.

## Issue and PR traceability

- Existing base release/status traceability: PR #61 produced the current
  `v0.2.0-poc.20260803.1` functional increment; PR #62 synchronized public-main
  release status.
- This visibility slice: no issue and no PR yet. The integration lane must
  assign the appropriate Public-Truth issue (or explicitly document a bounded
  no-issue rationale), open the PR, and bind the final merged SHA in release
  evidence.
- HMI issue #42/#36 is related to product capability, not ownership of this
  visibility slice.

## GitHub settings to apply separately

These values require separate external authorization, mutation and anonymous
readback:

- **About description:** `Open-source local proof of concept for governed AI-agent actions across business systems, with policy, approval, brokered execution, authoritative readback, and receipts.`
- **Topics:** `ai-agents`, `agent-governance`, `ai-governance`,
  `policy-enforcement`, `human-in-the-loop`, `auditability`, `docker`, `crm`,
  `erp`, `openclaw`
- **Homepage:** leave the GitHub About homepage field unset until a stable,
  owned canonical project/docs URL exists. The private package metadata may
  continue to use `https://github.com/JimPansky/ChimpMaera#readme`; that is not
  a recommendation to populate GitHub's separate homepage field.

## Separate product-loop candidates — do not integrate here

The following commits were neither cherry-picked nor merged into this branch:

- HMI-009 `499f04c99fe4edbe896c778eeffab3d47204ab81`
- HMI-010 `f7a66ce7a449f122bfbacc986d4c9ac6f99bd35a`

They are separate possible product components for the same release window.
Only the later WIP=1 integration lane may decide whether and in which order to
include them, after independent diff review, conflict analysis, claim evidence
and full validation. Their mention here grants no integration or publication
authority.

## Integration gate

Before merge/release: refresh from the actual integration head; confirm Public
Truth remains a blocker while broad UX/SEO findings remain warning/review
gates; resolve the existing unrelated `docs/AGENT-RUNTIME-ISOLATION-CONTRACT.md`
link defect if that file enters changed scope; rerun links, lint, full tests,
release governance, manifest/checksums, supply chain and privacy; then bind the
eventual issue, PR, merged SHA, release assets and anonymous readback.
