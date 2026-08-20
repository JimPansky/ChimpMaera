# HMI conformant entry points

PanSphaira exposes two repository-native, importable HMI entry points from one
verified immutable generation:

- `packages/hmi-adapters/src/openclaw.ts`
- `packages/hmi-adapters/src/codex.ts`

Both entry points are explicitly `DESCRIBED_INACTIVE`. Importing or mapping a
request does not install a harness extension, activate a route, grant a tool or
right, contact a network service, or write data. Each accepts only `discover`,
`explain`, and preparation-only `contribute-preflight` requests. Planning,
validation, handoff, execution, submission, and publication are denied at this
boundary.

## Contract

The caller supplies the exact HMI core/adapter/generation pin and the verified
generation bundle. OpenClaw and Codex presentation metadata stays outside the
canonical semantic request. Equivalent requests therefore have identical
canonical bytes and digests across both entry points.

The boundary enforces the generation ceilings for references, source bytes,
findings, and output bytes. Selectors must name a capability declared by the
pinned generation; contribution preflight accepts no capability selector and
requires a bounded selected input. Unknown fields, ambient credentials,
undeclared selectors, widened limits, stale pins, or generation drift fail
closed with a typed denial.

## Local use

Build the repository, then import one of the compiled entry points:

```js
import { mapOpenClawHmiEntrypointV1 } from "./dist/packages/hmi-adapters/src/openclaw.js";
import { mapCodexHmiEntrypointV1 } from "./dist/packages/hmi-adapters/src/codex.js";
```

Run the focused conformance pack by building and executing
`dist/tests/hmi-conformant-entrypoints.test.js` with Node's test runner.

## Disable and rollback

There is no activation state to migrate or disable: stop importing the entry
point and retain the existing `synthetic-v1` adapter contract as the accepted
last-known-good fallback. If this additive slice is later merged and needs to
be removed, revert only its successor commit; do not rewrite accepted
generation bundles or historical evidence.

## Claim boundary

This is local deterministic conformance evidence for importable, effect-free
transforms. It is not an OpenClaw skill/plugin install, a Codex plugin install,
live harness compatibility, runtime activation, a credential/tool/route grant,
host isolation, external write support, or production readiness.
