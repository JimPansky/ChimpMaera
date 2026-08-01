# AAS-036 Model Access Broker PDCA

Date: 2026-08-01  
Phase: Admin-AI security expansion / model access  
Starting checkpoint: `29d61bfaaf3d640ed952367fc4c68da80d21cc7b`  
Branch: `feat/admin-ai-aas-036-model-access-broker`  
Starting metric: **0/8**

## Plan and maturity gate

AAS-017 is complete at 4/4 and is not reopened. AAS-036 is locally reachable:
canonical contracts, deterministic guards, closed synthetic routing, adapter
fixtures, isolated OpenClaw execution and adversarial probes require neither a
live provider nor external credentials. The architecture is agent-neutral:

`Agent -> Capability Frontdoor -> Decision/Policy -> Model Access Broker -> Provider`

`Provider -> Response Guard -> Agent`

Decision/Policy, credential/routing custody, response inspection and Effect
Broker authority remain logically separate. Model tool calls are untrusted
typed candidates and have no execution path.

### Exact 8/8 acceptance

1. Versioned, closed canonical request/response/stream contracts preserve text,
   streaming, structured output, typed tool-call candidates, supported
   attachments and explicitly diagnosed optional fields.
2. The request guard binds workload, user, tenant, purpose, delegation,
   classification, trust, model/provider/route, IDs and budgets; it redacts
   bounded secrets before provider access.
3. The broker alone resolves opaque credential handles and fixed routes; no
   credential enters an agent-visible response and unknown route/protocol/model
   fails closed.
4. Response and incremental stream guards enforce byte/schema/MIME/SSE limits,
   redaction, provenance and `UNTRUSTED_MODEL_OUTPUT`; changed, hidden or
   incomplete tool calls quarantine before any effect.
5. Closed OpenAI-compatible Chat Completions/Responses and Anthropic-compatible
   Messages/SSE adapters pass feature-parity and adversarial conformance tests.
6. The pinned isolated OpenClaw runtime completes one typed model/tool-candidate
   E2E through the broker; an honest compatibility matrix records other runtime
   execution as proven or unproven.
7. The negative matrix proves direct egress, injection, tool smuggling, budget,
   replay, concurrent final unit, cross-tenant/cache, timeout/partial stream,
   malformed SSE, oversize, credential disclosure and broker failure fail
   closed without duplicate provider/effect calls.
8. Focused/full/supply-chain/public-staging validation, PDCA, clean commits and
   zero owned runtime residue pass. Exactly one isolated full smoke runs after
   relevant bytes freeze; a repeat requires a recorded correcting byte change.

### Conservative assumptions and review markers

- **Synthetic transport:** local fixture HTTP stands in for broker-owned
  provider TLS. Risk: it cannot evidence production TLS/DNS. Fallback: the
  default-off route remains unavailable outside the isolated internal network.
  Review when a pinned live-provider staging contract is owner-authorized.
- **Credential fixture:** an opaque synthetic handle resolves only inside the
  broker; no provider secret is embedded. Risk: it does not exercise a real
  vault. Fallback: unknown/missing handles deny. Review when a production secret
  custodian is selected.
- **Compatibility:** OpenAI and Anthropic protocol shapes are proven with closed
  local fixtures. Hermes and Claude Code runtime execution is marked unproven
  without pinned local runtime provenance/licence/artifacts. Review only when
  those prerequisites exist.
- **Inspector ceiling:** deterministic guards are authoritative. Any future JIT
  inspector may only tighten, redact, pause, quarantine or request review; it
  can never grant.

### Rollback boundary

Disable the default-off AAS-036 profile, purge only its labelled containers,
networks, images and bounded volumes, revoke broker handles, and retain digest-
only receipts. Agents then have no model route. Direct agent egress or embedded
credentials are never fallback paths.

### Honest non-claims

This work does not claim live-provider compatibility, production TLS/DNS or
network isolation, real vault custody, hostile-host containment, universal
agent/runtime compatibility, injection elimination, statistical content safety,
or release readiness. It does not touch the Owner OpenClaw, Gateway, vLLM,
models, credentials or external accounts.

## Do

Pending.

## Check

Pending.

## Act

Pending.
