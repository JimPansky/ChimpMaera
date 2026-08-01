# Contributing to ChimpMaera

Focused code, tests, documentation, fixtures, and design improvements are
welcome when they preserve ChimpMaera's authority, safety, evidence, license,
media, and trademark boundaries.

## Find and claim work

Use the public issues and milestones as the project roadmap. Before starting:

1. Choose a focused issue whose dependencies are clear.
2. Comment with the exact acceptance-criteria unit you want to own, a short
   implementation and test approach, and the evidence you intend to provide.
3. Wait for a maintainer to confirm the unit and dependency state. This avoids
   unsafe overlap; it is not employment, assignment of authority, or a promise
   that a pull request will merge.

Status labels have precise meanings:

- status:planned — defined for a later sequence; do not claim yet.
- status:ready — dependency-clear and available for a claim.
- status:blocked — an explicit dependency or maintainer gate is unmet.
- status:in-progress — a maintainer confirmed the claimed unit and work began.

Security-critical issues may be marked help wanted but are never beginner
tasks. A good first issue label is used only for independent, low-risk work
whose dependencies are already satisfied.

## Make a focused change

- Create a branch and keep the change limited to the confirmed unit.
- Link the issue in the pull request and describe which acceptance criteria it
  addresses. Use closing keywords only when the merged change would complete
  the whole issue.
- Preserve fail-closed authorization, strict schemas, loopback and default-off
  behavior, minimal audit data, and ownership-scoped cleanup.
- Use fictional or synthetic fixtures. Never add credentials, personal data,
  private prompts, host inventories, local filesystem paths, private evidence,
  or non-public run artifacts.
- State the supported result and non-claims honestly. A local branch or passing
  test is not merged, released, deployed, or production-ready.

Maintainers retain the gates for threat-model acceptance, sensitive
integration, merge and release decisions, production credentials and
infrastructure, and vulnerability disclosure. Contributors must not expand
authority or bypass a dependency to make a test pass.

## Test and provide evidence

Run checks proportional to the changed surface. Documentation-only changes
still require checksum and repository-contract validation. Code changes should
normally run:

    npm ci --ignore-scripts --no-audit --no-fund
    npm run lint
    npm test
    npm run video:test
    python3 -m unittest discover -s tools/video-production-reference/tests
    sha256sum --check SHA256SUMS

Add positive tests and risk-appropriate negative probes for changed behavior.
Changes involving authority, networking, runtime isolation, credentials, data
boundaries, schemas, effects, reset, or recovery require focused denial and
failure-path coverage.

Evidence should identify the exact tested commit and relevant versions or
digests, include deterministic counts or readback, and be sufficient to check
the supported claim. Sanitize logs and receipts. Do not publish raw exploit
details or security-sensitive fixtures.

## Open the pull request

Summarize the smallest useful result, link its issue, list relevant validation
and negative probes, and describe authority, safety, compatibility, rollback,
and known limitations. Keep unrelated cleanup out of the pull request.

Add a Developer Certificate of Origin sign-off to every commit:

    Signed-off-by: Name <email>

The sign-off certifies [DCO](DCO) version 1.1. Contributors must have the right
to submit the work under the repository license. ChimpMaera uses DCO and does
not require a separate Contributor License Agreement.

CI is required but does not replace review. An issue progresses only when its
evidence supports the transition: planned, in progress, locally validated,
merged, and released are distinct states.

## Security reporting

Report suspected vulnerabilities through the private process in
[SECURITY.md](SECURITY.md), never in a public issue or pull request. Do not
publish credentials, exploit details, affected private infrastructure, or
other sensitive evidence while seeking scope confirmation.
