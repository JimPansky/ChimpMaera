# OPENCLAW-M1.4 issue #7 PDCA

Work item: `OPENCLAW-M1.4` / GitHub issue #7.

## Plan

Implement one schema-validated OpenClaw request through the existing Gateway
route and the canonical AAS-012 broker semantics for only
`crm.contact.create`. Keep the runtime default-off and synthetic. Preserve the
M1.1/M1.2/M1.3 identity, network and bounded-state contracts, and deny direct
provider/effect bypass.

## Do

- Added a narrow runtime adapter at
  `demo/openclaw-agent/capability-m1-4-adapter.mjs` that imports and executes
  the canonical AAS-012 gateway admission and broker implementations directly.
  The pinned Node 24 fixture consumes the same TypeScript contract module at
  runtime; `packages/contracts/src/canonical-json.js` supplies its existing
  `.js` import target without introducing another authorization model. A
  deterministic parity test compares it with the compiled TypeScript source.
- Routed versioned
  `chimpmaera.security/capability-execution-request/v1` requests through the
  existing `/v2/broker/capabilities/execute` route after workload identity
  authorization.
- Extended Gateway state to V3 with durable M1.4 effect and reservation stores,
  preserving valid M1.2/V2 state during migration. The gateway persists
  `RESERVED` before provider commit and `COMMITTED` with authoritative fixture
  readback inside commit. A restart leaves unresolved `RESERVED` consumed and
  fail-closed; `COMMITTED` is reconciled without a second provider effect.
- Persisted a closed authorization binding in both M1.4 record phases and
  validate it on restart against the workload contract. The validator pins the
  authoritative response/readback to the one deterministic fixture result and
  rejects coordinated redigested authorization, correlation, validity-window
  and response substitutions. M1.4 correlation is derived canonically from the
  request ID; invocation-specific JTIs remain distinct for identity replay
  enforcement.
- Bound the request workload identity to the M1.2 runtime subject and the
  authorized identity subject, audience, tenant, route, correlation and
  validity window before canonical AAS-012 admission.
- Updated the OpenClaw plugin, workspace instructions and smoke probe to use
  the M1.4 CRM request while keeping the single tool allow-list.
- Added a shipped pure plugin response validator for the complete closed public
  response contract; consumer-boundary tests recompute envelope digests around
  malicious exact-key responses and require denial. The validator reconstructs
  the canonical admission decision and fixture broker receipt and requires both
  exact digests.
- Added focused coverage for positive readback, canonical malformed/stale
  contracts, identity/network mismatches, retry/concurrency, durable crash
  recovery, transport schema classification, exact public projection, shipped
  fault-control absence, plugin-consumer denial, and coordinated tamper-on-disk
  restart denial for both reserved and committed records.

## Check

Focused local checks run in this worktree:

```sh
npm run openclaw-m1.4:test
```

Result: PASS.

The M1.4 evidence artifact is
`security/openclaw-m1.4-evidence-v1.json`. It is synthetic, sanitized and bound
by containing commit identity rather than an embedded circular commit hash.

## Act

Review again if the canonical AAS-012 catalogue digests, OpenClaw workload
identity contract, state migration, duplicate key, evidence sink, response
schema, smoke route, or public claim boundary changes.

Rollback is source and fixture scoped: revert the issue commit(s), then run
`demo/openclaw-agent/reset.sh --purge` only for labelled local fixture
resources. Do not switch to a live provider, external credential, broad
catalogue, general tool execution, production identity, or infrastructure
mutation as rollback.

## Non-claims

This is local deterministic synthetic evidence only. It is not production
readiness, a live CRM integration, external identity assurance, hostile-host
containment, distributed replay protection, security certification, or proof
that arbitrary future capabilities are safe.
