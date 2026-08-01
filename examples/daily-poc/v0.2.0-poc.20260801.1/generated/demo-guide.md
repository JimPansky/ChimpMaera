# Daily POC demo guide

Version: `v0.2.0-poc.20260801.1`

## USE-CASE-DAILY-CANDIDATE — Prepare and verify one deterministic Daily POC candidate

Inputs:

- This canonical manifest
- The clean detached frozen source commit

Steps:

1. Compile the candidate into a new owned output directory.
2. Verify the generated artifact manifest and checksums.
3. Build the public archive twice and compare digests.

Expected outcomes:

- The candidate is byte-reproducible from the frozen source and manifest.
- No merge, tag, upload, release, or deployment action occurs.

Demo utility: Turns a cumulative local tree into a reviewable evidence packet without adding publication authority.

Evidence: EVID-DAILY-PIPELINE

## USE-CASE-EFFECT-AUDIT — Verify an effect through readback, receipts, and audit facts

Inputs:

- An exact approved synthetic action
- The authoritative provider readback

Steps:

1. Bind capability, policy, scope, approval, and use-time checks.
2. Execute only at the effect boundary.
3. Require authoritative readback and a bound receipt.
4. Render the explanation only from signed ordered audit facts and the exact checkpoint.

Expected outcomes:

- Transport acceptance alone never becomes success.
- Tampering, drift, ambiguity, replay, or missing facts fail closed.

Demo utility: Connects the user-visible result to the exact evidence chain rather than to model narration.

Evidence: EVID-EFFECT-GATE, EVID-AAS-023-AUDIT

## USE-CASE-GATEWAY-OPENCLAW — Run an OpenClaw agent without ambient authority

Inputs:

- The isolated local OpenClaw reference fixture
- A closed typed action request

Steps:

1. Start only the isolated ChimpMaera-owned fixture.
2. Submit the action through the Gateway-mediated path.
3. Verify that direct provider, host, peer, socket, and unmanaged-effect paths remain denied.

Expected outcomes:

- The agent receives no ambient provider, host, or tenant credential.
- The governed effect path remains outside the agent runtime.

Demo utility: Shows the core product boundary with a real OpenClaw agent fixture while keeping the Owner environment out of scope.

Evidence: EVID-AAS-035-RUNTIME

## USE-CASE-MODEL-BROKER — Mediate model requests and responses in both directions

Inputs:

- An opaque model route
- A typed request and untrusted model response

Steps:

1. Guard the outbound request before provider access.
2. Resolve credentials only inside the broker boundary.
3. Guard the inbound response before it returns to the agent or tool path.

Expected outcomes:

- Model traffic is mediated in both directions.
- Model output remains data and cannot become effect authority.

Demo utility: Makes the model access boundary concrete without claiming live-provider or production coverage.

Evidence: EVID-AAS-036-BROKER

## Reproduction

- `git diff --name-status f00a4890f7fecb68f82e692f09cf1e46728fb88d..89f51a9a421c934045f8cbcdf235f591ba29acbb`
- `npm ci --ignore-scripts --no-audit --no-fund`
- `npm run lint`
- `npm test`
- `npm run daily-poc:test`
- `npm run video:test`
- `npm run supply-chain:verify`
- `sha256sum --check SHA256SUMS`
