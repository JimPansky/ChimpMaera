# Daily POC demo guide

Version: `v0.2.0-poc.20260802.2`

## USE-CASE-BLD-001-GOVERNED-INTEGRATION — Build a governed integration for a synthetic system

Inputs:

- An owner-selected SAFE_GUIDED, CUSTOM or RAMPAGE_FULL_CONTROL_LAB profile
- A synthetic system manifest, System Advisor Guide and bounded goal
- A typed capability registry and current constraints

Steps:

1. Discover the system and its relevant cause, effect and context records.
2. Reuse an exact registered capability or emit an inactive UNRESOLVED_INTENT proposal for a genuine gap.
3. Create a digest-bound integration plan, manifests, dependency graph, reviewable Diff, contracts, fixtures and rollback plan.
4. Run independent tests, negative probes, readback, reconciliation and receipt checks before any separately routed effect.

Expected outcomes:

- Effective rights equal the intersection of the host and system ceiling, owner profile, assignments and current constraints.
- One target-neutral core is reused byte-identically across two synthetic system types.
- The isolated default-off OpenClaw proof completes one read and one reversible write, records denials and receipts, resets exactly and leaves zero owned residue.
- The contribution bundle remains sanitized, opt-in and unable to promote local validation to release status.

Demo utility: Shows how an operator can inspect and adapt a reusable governed integration without granting new authority or connecting a real system.

Evidence: EVID-BLD-001-G8, EVID-BLD-001-CORE, EVID-BLD-001-CONTRIBUTION

## Reproduction

- `git diff --name-status fbc659257b3d2a39e0c5c7a65fac8d01d4a98b85..990ce39d5e87ade8d0a7a9792672887d128f647e`
- `npm ci --ignore-scripts --no-audit --no-fund`
- `npm run lint`
- `npm test`
- `npm run daily-poc:test`
- `npm run supply-chain:verify`
- `npm run video:test`
- `sha256sum --check SHA256SUMS`
- `./demo/builder-agent/smoke.sh`
