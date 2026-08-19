---
title: SAFE_GUIDED secure-default proof
description: Verify PanSphaira's closed local SAFE_GUIDED claim manifest, deterministic positive checks, and fail-closed negative probes.
---

# SAFE_GUIDED secure-default proof

`npm run proof:secure-default` is the one repository command for the bounded
security proof described here. It validates a closed, digest-bound claim
manifest, checks the checked-in evidence receipt, runs focused positive and
adversarial probes, and then runs the complete `npm test` suite as the
authoritative comparator. It does not select tests away.

## Scope

The proof applies only to the checked-in local, synthetic `SAFE_GUIDED`
reference path. “Secure by default” means that this path begins with an
untrusted proposer and requires typed mediation, external authorization,
bounded broker execution, authoritative readback and a bound receipt before a
state-changing result is reported as success. It does not mean production
readiness, universal security or resistance to a compromised host.

`FULL_CONTROL_LAB` and `RAMPAGE` are explicitly outside this proof. They do not
inherit any claim in this matrix.

## Claim/evidence matrix

| Claim ID | What is proved on these bytes | Primary implementation and probes | Verdict / uncertainty |
| --- | --- | --- | --- |
| `CM-SD-001` | The isolated Agent/model fixtures receive no ambient reusable provider, host or tenant credential. | `demo/openclaw-agent/compose.yaml`; `demo/model-access-broker/compose.yaml`; runtime tests | **PROVEN — local synthetic fixture.** No production vault/IAM or hostile-host claim. |
| `CM-SD-002` | Agent/model input cannot approve itself; a client `ownerConfirmed` field is not authority. | `demo/runtime/enforcement-gate.mjs`; enforcement and approval-workbench tests | **PROVEN — governed demo path.** No production MFA/quorum claim. |
| `CM-SD-003` | The proposer has no direct provider-effect route; the seed flow uses the coordinator API and the isolated fixture exposes one Gateway route. | seed script, OpenClaw fixture and enforcement tests | **PROVEN — declared path.** Unknown host-level bypasses are not excluded. |
| `CM-SD-004` | Capabilities and action payloads are finite, closed, typed and digest-bound; catalogue inspection remains inactive. | capability catalogue contract/tests; enforcement gate | **PROVEN — two synthetic actions and declared fixtures.** Not a universal capability catalogue. |
| `CM-SD-005` | Unknown action, wrong scope/tenant and widened or malformed payloads deny before provider access. | enforcement, catalogue and runtime negative probes | **PROVEN — enumerated probes.** This is not proof that every future parser is safe. |
| `CM-SD-006` | Material effects require external Policy/Owner authority bound to action, scope, policy/profile generation and use-time state. | policy, approval workbench and effect gate | **PROVEN — local HMAC fixture.** No production identity or approval service claim. |
| `CM-SD-007` | The model sees an opaque credential reference; only the model-access broker resolves the fixture credential and raw values are not returned. | broker runtime contract/code/tests | **PROVEN — synthetic broker.** No real vault or live provider validation. |
| `CM-SD-008` | The adapter/provider route is a fixed broker-owned route, not a model-selected URL or generic invocation surface. | broker runtime contract and direct-path/unknown-route probes | **PROVEN — one closed fixture route.** No universal adapter safety claim. |
| `CM-SD-009` | Transport acceptance is not success; provider readback is mandatory and semantic drift produces no success receipt. | enforcement and approval-workbench tests | **PROVEN — synthetic providers.** No transaction/ETag or independent witness claim. |
| `CM-SD-010` | The receipt is bound to the canonical action, authority/policy where applicable, provider object and readback digest. | enforcement gate and positive/tamper tests | **PROVEN — local digest/HMAC evidence.** Host compromise can forge local evidence. |
| `CM-SD-011` | Replay, tamper, direct-path, cross-tenant, unknown-route/action and payload-widening probes deny or remain idempotent. | focused adversarial suites listed by the manifest | **PROVEN — enumerated probes only.** Absence of unknown attacks is not claimed. |
| `CM-SD-012` | The local runtime adds non-root/read-only containers, dropped capabilities, no-new-privileges, internal networks, no host socket and no published fixture ports. | Compose declarations, runtime and supply-chain tests | **PROVEN — defense in depth.** Not a hostile-kernel/Docker-daemon boundary. |
| `CM-SD-NC-001` | Production readiness, universal/absolute security, security certification, hostile-host resistance, live tenant/provider compatibility and inheritance by broader profiles are not claimed. | this document; Security Assurance; manifest verifier | **EXPLICITLY NOT CLAIMED.** External, independently operated evidence would be required. |

## Machine-readable proof

- Manifest: `security/secure-default-proof-v1.json`
- Closed schema: `schemas/security/secure-default-proof-v1.schema.json`
- Checked evidence receipt: `security/secure-default-proof-evidence-v1.json`
- Fail-closed verifier: `scripts/verify-secure-default-proof.mjs`
- Verifier probes: `tests/secure-default-proof.test.mjs`

Every claim references exact implementation, test and evidence paths. The
manifest binds each referenced path by SHA-256. The checked receipt binds the
manifest, schema, verifier and complete input set; its own digest covers the
canonical receipt body. Missing, stale, tampered or contradictory evidence,
unknown claims, path escape/private-path leakage, digest drift and broadened
universal-security language are denials.

To preserve deterministic public evidence, the command emits only normalized
command outcomes and canonical digests—no timestamps, usernames, absolute
paths, environment inventory or raw test logs. Detailed TAP stays local to the
child process unless a probe fails.
