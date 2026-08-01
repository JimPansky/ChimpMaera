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

Implemented an agent-neutral TypeScript contract and deterministic broker with
closed OpenAI Chat Completions/Responses and Anthropic Messages adapters,
request/response/stream guards, atomic budget reservation, idempotent replay,
metadata-only audits and untrusted non-executable tool candidates. Added a
default-off isolated four-service fixture with three internal networks:
OpenClaw can reach only the Capability Frontdoor; the frontdoor can reach only
the broker; only the broker can reach the synthetic provider. Images are pinned
or locally built from pinned bases, non-root, read-only, capability-dropped and
socket/host-mount free.

## Check

- Focused AAS-036 contract/runtime tests: **8/8 PASS**.
- Complete repository tests: **116/116 PASS**.
- Video reference tests: **15/15 PASS**.
- Supply-chain checks: **6/6 PASS**, lock digest
  `a9d02e5bd6aced8e831b9c91fdc7afae35cc835b79b79c9af08e186fcb02cfc1`.
- Deterministic public staging: PASS, archive digest
  `59c320f7a78edfb4ba2d798bf1fa8693bae26d6dcfb2752472b8a0734e11070f`;
  temporary staging residue zero.
- Exactly one isolated full smoke ran after runtime bytes froze:
  `aas036-20260801T131032Z` PASS in 63,525 ms. The real pinned OpenClaw agent
  completed model E2E; 11 provider calls, 7 denials, 7 metadata-only audits and
  7 receipts were observed. Direct broker/provider/Internet paths, cross-tenant,
  unknown-route, injection, secret disclosure, tool smuggling, malformed/
  oversized response, replay conflict and timeout probes passed. Owner process/
  config fingerprints were identical before/during/after; owned residue was
  zero. No repeat smoke was run.
- Implementation commit:
  `9a95eb869eff00f30afb8c66f3fc2d9f12d74023`.

## Act

Close AAS-036 at **8/8** with verdict
`LOCAL_AAS_036_PASS_NOT_LIVE_PROVIDER_PRODUCTION_TLS_VAULT_UNIVERSAL_AGENT_OR_RELEASE_CLAIM`.
Do not optimize or rerun it absent a real regression or correcting byte change.

Frontier review rechecked agent functionality, extension provenance, capability
grant separation, mutable dependencies, staged activation and rollback. Owner
direction proves one distinct dependent I5 frontier: managed skill lifecycle is
not covered by model mediation. Persist AAS-037 at **0/6** and select it ahead
of ERP/CRM/BI/DMS breadth and lower-importance controls. Its implementation
must remain serial and use the same canonical Skill Admission IR across proven
runtime formats.
