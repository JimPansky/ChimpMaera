# Contributing to ChimpMaera

Focused code, tests, documentation, fixtures and design proposals are welcome.

## Fast path

1. Choose an issue, or open a short one describing the problem and proposed result.
2. Fork the repository and create a branch.
3. Make one focused change.
4. Run the relevant checks.
5. Open a pull request linked to the issue. Draft and independently useful partial pull requests are welcome.

Commenting before implementation is optional and only helps avoid duplicate work. It is not a claim, assignment or pre-approval gate. Maintainers can clarify scope quickly and may suggest splitting large work. Maintainers may also start work before an issue is published; a backfilled issue is valid when it states the baseline and prior progress honestly.

## Validation

Use evidence proportional to the changed surface:

- L0/L1 documentation, fixtures and low-risk changes need only their relevant focused checks.
- Changed L2/L3 authority, network, runtime, credential, data or security surfaces need applicable positive and negative/security tests.
- Routine checks run in CI where available; do not recreate CI as manual ceremony.

The repository CI uses least-privilege, GitHub-hosted pull-request workflows. Fork pull requests receive no production credentials. Never add secrets, personal data, private prompts, host inventories, local paths or non-public artifacts. Use fictional fixtures.

Never use `pull_request_target`, owner/self-hosted infrastructure or secrets to execute untrusted contributor code. Preserve fail-closed authorization, strict schemas, loopback defaults, minimal audit data and ownership-scoped cleanup.

Report suspected vulnerabilities privately through [SECURITY.md](SECURITY.md), not in an issue or pull request.

## Progress and review

Use one public issue for each clear, adoptable delivery slice or epic; do not
mirror every internal microtask. A contributor may adopt an existing issue or
open one. Each issue records scope, non-scope, dependencies, measurable
acceptance criteria, negative probes, required evidence, rollback or recovery,
and explicit non-claims.

Track the status chain as `planned` → `ready` → `in progress` →
`locally validated` → `merged` → `released`. Record implementation steps and
PDCA milestones as an issue checklist or material status comment—not per
commit. A pull request links its issue and applicable evidence; draft and
independently useful partial pull requests remain welcome. Maintainer work does
not remove `help wanted` unless concurrent work would be unsafe.

An implementation issue stays open until reviewed work is merged. A private or
local branch does not close it. Release notes close the public delivery loop
only when the change is actually published. Never present `locally validated`
as `released`, or `planned` as `proven`. Security-sensitive final integration,
merge and release remain maintainer-controlled.

Each published snapshot's release notes use `Added`, `Changed`, `Security`,
`Evidence`, `Known limitations` and `Planned next`, with applicable issue, pull
request and claim IDs in each section. The planned Daily Manifest contract will
likewise require issue, pull-request and claim references when those references
exist; until that manifest is implemented, issues and pull requests are the
authoritative public links.

Do not disclose unpatched security-sensitive details in public issues. Follow
[SECURITY.md](SECURITY.md) and use a private advisory instead.

Contributors must have the right to submit their work under the repository license. No separate CLA, DCO sign-off, signed commit, assignment, bespoke tool or additional account setup is required by this guide.

## Security follow-ups

The following are prioritized repository-hardening follow-ups, not contributor prerequisites:

- **P0, low friction:** enable secret scanning, push protection and CodeQL/default scanning when available.
- **P0 before trusting external code:** add CODEOWNERS for high-risk paths and require one maintainer/code-owner approval for external pull requests while preserving an owner bypass. Until that can be configured safely—or a second maintainer exists—the maintainer-controlled merge gate remains the fallback.
