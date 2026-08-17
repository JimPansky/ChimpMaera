# PANSPHAIRA Security Policy

## Supported scope

Published releases are bounded local, synthetic proofs of concept. Use the
[latest published release](https://github.com/JimPansky/ChimpMaera/releases/latest)
or [all releases](https://github.com/JimPansky/ChimpMaera/releases) to identify
the current published bytes and their release-specific evidence. Production
operation, hostile tenancy, external identity infrastructure, high
availability and independent immutable audit are unsupported.

Docker and loopback/internal-network controls are local Reference Adapter
guardrails, not a universal Agent isolation or hostile-host claim. The
normative product boundary is defined by
[The PANSPHAIRA Canon](docs/CANON.md); current release limitations remain in
[Known Limitations](docs/KNOWN-LIMITATIONS.md). Security claims cover only
defined, evidenced boundary crossings and observable inputs, outputs, actions
and receipts, not complete internal model thoughts, unknown side channels, or
compromised kernel/hypervisor/runtime components.

## Reporting

Do not place suspected vulnerabilities, credentials, personal data, private
prompts or exploit details in a public issue. Use the repository hosting
platform's private vulnerability-reporting feature when available. Otherwise,
use a private maintainer contact published alongside the distribution. If no
private route is available, withhold sensitive details until one is provided.

Include the affected version or archive hash, impact, minimal reproduction and
whether secrets or personal data may be involved. Use synthetic data whenever
possible.

## Handling

Critical and high-severity findings block release of affected bytes. Fixes
require regression tests and risk-appropriate negative, replay, concurrency
or tamper probes. Disclosure timing and acknowledgements require the
reporter's consent.

This policy is not a bug bounty, service-level agreement or warranty.
