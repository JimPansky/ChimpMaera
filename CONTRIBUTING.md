# Contributing to ChimpMaera

Contributions should be narrow, reviewable and covered by appropriate tests.
Ordinary use, adaptation and improvement are welcome when they respect the
project's authority, safety, license, media and trademark boundaries.

## Contribution flow

1. Describe the problem and intended behavior.
2. Preserve fail-closed authorization, strict schemas, loopback defaults,
   minimal audit data and ownership-scoped cleanup.
3. Add positive tests and risk-appropriate negative tests.
4. Run:

   ```sh
   npm ci --ignore-scripts --no-audit --no-fund
   npm run lint
   npm test
   npm run video:test
   python3 -m unittest discover -s tools/video-production-reference/tests
   ```

5. Add a Developer Certificate of Origin sign-off:
   `Signed-off-by: Name <email>`.

The sign-off certifies [DCO](DCO) version 1.1. Contributors must have the right
to submit the work under the repository license. ChimpMaera uses DCO and does
not require a separate Contributor License Agreement.

## Security and privacy

Never commit credentials, personal data, private prompts, host inventories,
local paths or non-public run artifacts. Use fictional fixtures in tests.
Changes that add network targets, host access, executable capabilities or new
data classes require explicit threat analysis and focused negative tests.
Installer, Docker, workflow, credential, publication and runtime-authority
changes receive the same stricter review.

Report suspected vulnerabilities through the private process described in
[SECURITY.md](SECURITY.md), not in a public issue.
