# OPENCLAW-M1.2 issue #5 — completion PDCA

Date: 2026-08-09

Stable ID: `OPENCLAW-M1.2`

Public issue: `#5` — Gateway-only networking and workload identity

Baseline: `259d7e5c7a9d2953165dd05eeee84ec78443ce66`

Commit binding: this record and `security/openclaw-m1.2-evidence-v2.json` bind
to the Git commit that contains them. This is the repository's
non-self-referential containing-commit convention. Resolve the exact tested
commit with
`git log -1 --format=%H -- docs/development/openclaw-m1.2-issue-5-pdca.md`.

## Plan

Extend the pinned, default-off AAS-035 OpenClaw fixture with the smallest local
synthetic proof of a short-lived workload identity and one finite Gateway
broker path. Preserve every V1 signature and wire format; add only explicitly
versioned V2 identity, authorization, denial, broker-response, and workload
network contracts. Do not activate infrastructure or use external services,
tenants, providers, credentials, or network identity systems.

## Do

- Added a 60-second identity envelope bound to the exact workload, Gateway
  audience/path, synthetic tenant, least-privilege action scope, correlation,
  issue/expiry time, and one-time identifier.
- Bounded retained replay identifiers to 64 entries and deny when full, so the
  synthetic anti-replay store cannot grow without a finite ceiling.
- Added deterministic anti-replay state and sanitized stable-code denial. The
  public synthetic proof contains no secret and therefore demonstrates
  contract behavior, not production identity assurance.
- Added one exact HTTP POST allow to `capability-gateway:8080` and retained the
  internal-only Compose network, no published ports, no host/socket mounts,
  read-only roots, dropped capabilities, and default-off profile.
- Removed the ambient `NO_PROXY` variable. The workload environment contains
  only local OpenClaw path/state settings; no application, provider, host,
  tenant, proxy, or credential environment is introduced.
- Bound the versioned fixture contracts and all modified runtime/lifecycle
  bytes into the official offline runtime lock, covering 24 artifacts.
- Closed the independently reviewed legacy execution bypass: the old V1
  capability route now returns its stable V1 denial shape before parsing or
  effect dispatch, even when the public static V1 workload marker is present.
- Separated identity replay from effect idempotency. Each plugin invocation
  uses a fresh UUID-derived synthetic JTI/correlation binding; `requestId`
  remains unchanged, so a response-loss retry with a fresh identity returns
  the exact established receipt while identical-assertion reuse still denies.
- Rebound the existing wrong-identity and unknown-action lifecycle probes to
  the sole V2 broker route. Their definitions live in the V2 workload contract
  and are executed unchanged by both fixture smoke and an in-process Gateway
  test, proving their expected denial boundaries remain route-compatible.

## Check

| Criterion | Deterministic evidence |
| --- | --- |
| 1. Short-lived least-privilege workload identity | V2 contract readback and positive behavioral test prove exact subject, audience, tenant, one action scope, route, correlation, fixed clock, and 60-second TTL. |
| 2. No long-lived or ambient credentials | Compose/runtime inspection, credential-environment and credential-shaped-byte probes, empty live-credential policy, and public non-secret assurance marker. |
| 3. Expected Gateway request and correlation | Positive V2 authorization/broker probe returns `PASS`, preserves each validated invocation correlation ID, and produces the existing V1 synthetic effect receipt inside the V2 wrapper. A fresh-identity retry of the same `requestId` returns that exact receipt with one effect. |
| 4. Direct paths denied | Internal Compose network readback plus behavioral destination/protocol/DNS/port/method/route matrix covers internet, provider, metadata, control-plane, peer, unexpected targets, and the legacy V1 capability bypass. Gateway-state readback proves the legacy probe creates zero effect attempts/effects. The unknown-action smoke definition uses the only V2 route and otherwise-valid identity to reach typed-request denial without an effect. |
| 5. Identity failures close | Missing, expired, wrong-subject, wrong-audience, wrong-tenant, wrong-scope, wrong-route, correlation mismatch, malformed proof, and identical-assertion second-use probes return stable denial codes. The exact wrong-identity smoke definition reaches V2 subject denial. Fresh assertion identity is distinct from request-level effect idempotency. |

The focused commands are `npm run openclaw-runtime-lock:verify` and
`npm run openclaw-m1.2:test`. The authoritative repository gates, exact results,
allow/deny matrix, checksums, and credential-proof result are recorded in
`security/openclaw-m1.2-evidence-v2.json`. Negative evidence records only
categories and stable sanitized outcomes, never assertions, proofs, secret
material, or raw exploit payloads.

## Act

Accept only the DCO-signed containing commit after the focused gate, full test
suite, lint, build, documentation, supply-chain, release-governance,
secure-default, and repository checksum gates pass. Rollback stops and purges
only resources carrying `io.chimpmaera.fixture=aas035-openclaw-agent-v1`, then
reverts the containing commit. It does not revoke production identity or undo
provider effects because neither exists in this slice.

Supported claim: deterministic local synthetic enforcement of the exact V2
identity and single Gateway path in the pinned, default-off fixture, with
correlation preservation, bounded TTL, replay denial, internal-network
readback, legacy execution denial, exact-receipt retry idempotency, sanitized
outcomes, and zero live/ambient credential fixtures.

Honest non-claims:

- no hostile-network certification;
- no production identity assurance;
- no production IdP, tenant, or credential distribution;
- no service-mesh rollout;
- no live provider or application-database access;
- no infrastructure activation;
- no claim about untested container or runtime escapes.
