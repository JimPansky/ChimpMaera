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

Post issue updates at material gates: started, locally validated, merged and released—not per commit. Use labels and checklists for current status. Maintainer work does not remove `help wanted` unless concurrent work would be unsafe.

An implementation issue closes when reviewed work is merged, or at release only when release is the explicit target. A private or local branch does not close an issue. Security-sensitive final integration, merge and release remain maintainer-controlled.

Contributors must have the right to submit their work under the repository license. No separate CLA, DCO sign-off, signed commit, assignment, bespoke tool or additional account setup is required by this guide.

## Security follow-ups

The following are prioritized repository-hardening follow-ups, not contributor prerequisites:

- **P0, low friction:** enable secret scanning, push protection and CodeQL/default scanning when available.
- **P0 before trusting external code:** add CODEOWNERS for high-risk paths and require one maintainer/code-owner approval for external pull requests while preserving an owner bypass. Until that can be configured safely—or a second maintainer exists—the maintainer-controlled merge gate remains the fallback.
