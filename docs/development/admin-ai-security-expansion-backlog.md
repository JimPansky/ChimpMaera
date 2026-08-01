# Admin-AI security expansion backlog

**Backlog version:** 1

**Baseline:** `47da5ac4f70221b485b4a2a1989dd1ffe9666d06`

**Branch:** `feat/admin-ai-security-analysis-backlog`

**Last reviewed:** 2026-08-01

**Owner authorization:** reversible local implementation and evidence only;
external push/PR/merge/tag/release/publication, credentials, live-provider
claims, production and infrastructure remain gated

## Operating contract

Stable IDs never change meaning. Allowed statuses are `candidate`, `ready`,
`in_progress`, `blocked_external`, `done` and `superseded`.

Selection is lexicographic: current exploitable Canon defect first, then
importance (`I5` > `I4` > `I3` > `I2`), then internal readiness and risk
reduction/prerequisite value, then lower complexity and fewer dependencies.
Importance strictly dominates complexity. A blocked-external item keeps its
priority but yields execution to the next internally ready item.

WIP is one writer per artifact and one `in_progress` backlog item. A completion
must include a clean commit, acceptance evidence, negative probes, rollback and
honest non-claims. It triggers PDCA: recheck the threat model and Canon mapping,
discover newly exposed gaps, update dependencies, and reprioritize the ready
frontier. `done` never reopens without new evidence; new recurring verification
is a separate guard item and regressions get a new stable ID linked to the
completed control. `superseded` requires a replacement ID and evidence that no
acceptance boundary disappeared.

An empty backlog is not proof of safety. It requires a frontier audit across
capabilities, adapters, identities, tenants/data, tools/models/memory,
providers/network/runtime, Policy/Canon, recovery/audit and claims, plus
negative evidence that no uncovered internally actionable gap remains.

## Counts and selected ready frontier

| Priority | candidate | ready | in_progress | blocked_external | done | superseded | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| P0 | 5 | 0 | 0 | 2 | 7 | 0 | 14 |
| P1 | 11 | 1 | 1 | 0 | 3 | 0 | 16 |
| P2 | 3 | 1 | 0 | 0 | 0 | 0 | 4 |
| P3 | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| **Total** | **22** | **2** | **1** | **2** | **10** | **0** | **37** |

Selected work and ready order after AAS-037 closure and frontier audit:

| Rank | ID | Priority | Importance | Complexity | Why ready now |
| ---: | --- | --- | --- | --- | --- |
| WIP=1 | AAS-023 | P1 | I4 | L | Selected; protected local timeline implementation is in progress |
| 1 | AAS-025 | P1 | I4 | L | Local artifact trust policy/negative fixtures extend the existing verifier honestly |
| 2 | AAS-030 | P2 | I3 recurring guard | M | Adds assurance without claiming that absent external systems were tested |

The authorized implementation loop completed `AAS-001`, `AAS-002`, `AAS-003`,
`AAS-009`, `AAS-016`, `AAS-012`, owner-priority `AAS-035`, `AAS-017`,
`AAS-036` and `AAS-037`.
Owner directions at 2026-08-01 14:17 and 14:26 CEST made `AAS-036` the model
security prerequisite and `AAS-037` its dependent next frontier before lower-
priority ERP/CRM/BI/DMS breadth. AAS-036 is complete; closed items do not reopen
without new evidence.

The AAS-002 frontier audit rechecked Policy lifecycle, tenant binding,
decision/use convergence, fallback, management/effect separation, audit and
claim boundaries. The live-signer and independently managed trust-root gaps
remain represented by AAS-011/AAS-017; no new standalone item was discovered.
The worktree-control-file release-builder defect found during closure was fixed
and regression-tested as a local evidence-path correction, not promoted into a
duplicate recurring backlog item.

The AAS-003 frontier audit rechecked operand authenticity/freshness, tenant
binding, scope/catalog coherence, view parity, authority issuance and simulator
dependencies. Production identity/tenant inputs remain AAS-007/AAS-010/AAS-017,
catalogue coherence remains AAS-012 and effect-free preview remains AAS-013;
no new standalone item was discovered. AAS-009 is the remaining internally
ready P0/I5 item and therefore remains ahead of every I4 item.

The AAS-009 frontier audit rechecked live effect mediation, tenant/data-purpose
isolation, catalogue activation, untrusted memory/privacy, model gateway
evidence, audit causality, artifact intake and hard end-to-end assurance. Those
boundaries remain represented by AAS-008/AAS-010/AAS-012/AAS-020/AAS-023/
AAS-025/AAS-030; no distinct new control was discovered. AAS-016 now leads the
ready frontier because its current material-Diff correctness defect outranks
other I4 catalogue and lifecycle breadth.

The AAS-016 frontier audit rechecked transactional effect mediation,
requester/approver identity, tenant/data-purpose isolation, Policy lifecycle,
audit causality, compensation and external claim boundaries. These remain
represented by AAS-007/AAS-008/AAS-010/AAS-017/AAS-023/AAS-022; no distinct
new internal item was discovered. AAS-012 now leads the ready I4 frontier
because a finite inactive-by-default vocabulary is a prerequisite for several
later controls and adds no runtime authority.

The AAS-012 frontier audit rechecked effect brokerage, runtime budgets,
untrusted memory, network enforcement, artifact trust and composed assurance.
Their reusable primitives remain AAS-008/AAS-019/AAS-020/AAS-021/AAS-025/
AAS-030. Owner direction at 2026-08-01 12:46 CEST proves one distinct product
integration gap rather than a duplicate framework primitive: a real OpenClaw
agent runtime has not been confined as a default-off, Gateway-only ChimpMaera
Docker workload. AAS-035 captures that measurable integration and now leads the
frontier; data/ERP/CRM/BI/DMS breadth remains behind it absent a proven security
prerequisite.

The AAS-035 frontier audit rechecked runtime containment, workload identity,
managed memory, Policy/Authority/effect separation, audit causality, artifact
trust and external supply-chain boundaries. The remaining internally ready
gaps are already represented by AAS-017/AAS-023/AAS-025/AAS-030; registry
signature/SBOM/current-CVE/complete-licence and production isolation evidence
remain external/preparable, not new local controls. AAS-017 now leads the equal
I4 ready frontier because its signed lifecycle is a dependency for later
management-plane, delegation, schedule and credential controls.

The AAS-017 frontier audit rechecked model credentials/routing, request and
response trust, streaming, tool smuggling, budgets, tenant isolation, audit
privacy, failure recovery and real-agent conformance. Owner direction proves a
distinct I5 security prerequisite rather than protocol/framework breadth:
agents need a closed, agent-agnostic Model Access Broker with deterministic
bidirectional guards. AAS-036 captures the finite 8/8 contract and precedes
all lower-importance breadth.

The AAS-036 frontier audit rechecked feature preservation, extension
provenance, separate installation/capability decisions, mutable dependencies,
staged activation, rollback and agent-format compatibility. Owner direction
proves a distinct I5 gap: agents may request skills, but no canonical managed
admission lifecycle prevents direct store mutation or self-granted transitive
rights. AAS-037 captures the finite 6/6 contract and now precedes application
breadth and every lower-importance ready item.

The AAS-037 frontier audit rechecked capability-grant separation, immutable
package bytes, runtime materialisation, tenant isolation, audit causality,
rollback and external claims. The two isolated permission defects found by the
smoke were corrected and regression-tested within AAS-037; they do not create
duplicate backlog cases. Live registry/signature/legal-licence and production
store/sandbox proof remains external or preparable, while Hermes and Claude
Code remain honestly unproven. Cross-control audit and artifact trust remain
AAS-023/AAS-025. AAS-023 leads the equal I4/L ready frontier under the existing
ordered tie-break; recurring I3 AAS-030 cannot displace it.

## P0 — critical authority and containment

### AAS-001 — Contain setup-repair filesystem effects

- **Status / priority:** `done` / P0. **Importance / complexity:** I5 current
  executable defect / M. **Risk reduction:** critical. **User value:** prevents
  repair from overwriting Owner authority/evidence or sibling state. **Demo
  value:** high, exploit-shaped and deterministic.
- **Canon:** **defect**, CM-CAN-03/04/05/08/11. **Source:** security scout
  SEC-01. **Dependencies:** none. **Selected phase:** Phase 0, selected first.
- **Acceptance evidence:** reconstruct executable repair action from the
  observed issue and server-owned Plan; descriptor/component-safe containment;
  approval binds that reconstruction; exactly the declared owned config file
  changes; focused and relevant regression tests pass from a clean commit.
- **Negative probes:** recomputed digest plus `..`, absolute path,
  sibling-prefix, separator/Unicode variants, symlink and TOCTOU swaps all fail
  before open/write; caller `ownerConfirmed` does not help; out-of-root,
  authority, effect and audit canaries remain byte-identical.
- **Rollback boundary / fallback:** revert the slice and disable repair; never
  restore caller-supplied target execution. **External gates:** none for local
  closure; hostile-host/kernel sandbox claims remain gated.
- **Completion commit/evidence:** implementation
  `72a489263dcd477dba394282a55d498ac2762318`, public integrity closure
  `bdfb7373d331e17903982afd6eb145ffa1879142`;
  `docs/development/evidence/admin-ai-aas-001-20260801.json` and
  `docs/development/admin-ai-aas-001-setup-repair-containment-pdca.md`.
  **Last reviewed:** 2026-08-01.

### AAS-002 — Policy self-protection and generation fence

- **Status / priority:** `done` / P0. **Importance / complexity:** I5 / S.
  **Risk reduction:** critical. **User value:** stale or self-expanded Policy
  cannot silently authorize effects. **Demo value:** high.
- **Canon:** primitive, CM-CAN-02/03/08/14/17. **Source:** SEC-CTL-001.
  **Dependencies:** versioned local activation record. **Selected phase:** 1.
- **Acceptance evidence:** only Owner-authorized, schema-compatible,
  monotonic-generation Policy activates; active generation/digest is bound at
  decision and use; last-known-safe fallback is explicit.
- **Negative probes:** Agent-authored/unsigned activation, mutated bytes, stale
  or duplicate generation, wrong-tenant bundle, downgrade and stale worker all
  deny before provider access.
- **Rollback boundary / fallback:** return to the last verified generation and
  freeze dispatch if generations cannot converge. **External gates:** real
  trust roots and production signers remain gated.
- **Completion commit/evidence:** implementation
  `8d58bed570038a4ba2068d6aa728a9190dffc763`;
  `docs/development/evidence/admin-ai-aas-002-20260801.json` and
  `docs/development/admin-ai-aas-002-policy-generation-fence-pdca.md`.
  **Last reviewed:** 2026-08-01.

### AAS-003 — Effective-rights compiler and permission X-ray

- **Status / priority:** `done` / P0. **Importance / complexity:** I5 / M.
  **Risk reduction:** critical observability/prerequisite. **User value:** Owner
  can see the actual envelope and denial reasons. **Demo value:** very high.
- **Canon:** primitive, CM-CAN-04/11/14. **Source:** SEC-CTL-002.
  **Dependencies:** typed local profile/assignment/constraint inputs.
  **Selected phase:** 1.
- **Acceptance evidence:** canonical intersection returns allow/escalate/deny,
  contributing ceilings, reason codes and digest; rendered facts match the
  machine decision for golden cases.
- **Retrospective scope (RET-001):** named versioned profiles include explicit
  `FULL_CONTROL_LAB` truth: the view binds the actual OS ceiling, shows that no
  hidden ChimpMaera action limits remain, requires an Owner warning, and states
  that host-level authority can degrade audit and emergency controls rather
  than presenting them as independent tamper-proof boundaries.
- **Negative probes:** missing, unknown, stale or conflicting operand denies;
  capability alone never implies authority; UI cannot omit a restrictive
  operand or disagree with evaluated facts.
- **Rollback boundary / fallback:** keep decision enforcement and disable the
  explanatory view if fact parity fails. **External gates:** production
  identity/tenant inputs remain labelled synthetic.
- **Completion commit/evidence:** implementation commit
  `7c85a065da6bdd200cacc02ccfac8ddbd7484199`; evidence
  `docs/development/evidence/admin-ai-aas-003-20260801.json` and
  `docs/development/admin-ai-aas-003-effective-rights-pdca.md`.
  **Last reviewed:** 2026-08-01.

### AAS-004 — Independent revoke and emergency freeze

- **Status / priority:** `candidate` / P0. **Importance / complexity:** I5 / L.
  **Risk reduction:** critical. **User value:** immediate stop independent of a
  compromised Agent. **Demo value:** very high.
- **Canon:** extension clarifying CM-CAN-04/07/08/13 and Administration.
  **Source:** SEC-05 and SEC-CTL-003. **Dependencies:** durable stop epoch,
  effect-gate check, protected control identity/storage. **Selected phase:** 2.
- **Acceptance evidence:** freeze blocks plan/authority/use-time dispatch,
  survives restart, invalidates relevant generations, preserves queued/uncertain
  work, and requires stronger authorized recovery.
- **Retrospective scope (RET-005):** frozen, queued, ambiguous and recovery
  states remain visible with linked receipts; full-control mode never turns the
  same-process stop or audit path into an independent security claim.
- **Negative probes:** stop between approval/reservation/provider call; stale
  cache/worker/lease; Agent unfreeze/delete/rotate attempts; recovery never
  silently resumes queued effects.
- **Rollback boundary / fallback:** fail frozen; remove feature code only while
  dispatch remains disabled. **External gates:** independent availability and
  production control identity/infrastructure.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-005 — Atomic cumulative authority budgets

- **Status / priority:** `candidate` / P0. **Importance / complexity:** I5 / L.
  **Risk reduction:** critical against low-and-slow campaigns. **User value:**
  bounded aggregate impact. **Demo value:** high.
- **Canon:** extension to CM-CAN-04/08/11/12. **Source:** SEC-CTL-004 and
  authority portion of SEC-11. **Dependencies:** durable reservation store,
  clock/reset model and AAS-006 ambiguity state. **Selected phase:** 2.
- **Acceptance evidence:** atomic owner/tenant/subject/capability/window
  reservation before dispatch; receipts bind budget epoch and remaining
  ceiling; ambiguity retains reservation until reconciliation.
- **Retrospective scope (RET-006):** action, rate, cost and attention totals are
  enforced atomically at use time through the existing authority/runtime budget
  split; no parallel quota subsystem or non-causal reporting-only counter earns
  closure credit.
- **Negative probes:** concurrent final unit, restart/retry/delegation reset,
  stale/unknown counter, boundary-time race and ambiguous provider result never
  overspend or free authority early.
- **Rollback boundary / fallback:** freeze dispatch and preserve all uncertain
  reservations during migration/revert. **External gates:** distributed-store
  and production rate-accuracy claims.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-006 — Crash-safe effect state and authoritative reconciliation

- **Status / priority:** `candidate` / P0. **Importance / complexity:** I5 / XL.
  **Risk reduction:** critical duplicate/false-success prevention. **User
  value:** safe recovery from “may have happened.” **Demo value:** high.
- **Canon:** defect for current AUTO_GRANT ordering and otherwise primitive,
  CM-CAN-10/11/12. **Source:** SEC-04 and SEC-CTL-006. **Dependencies:** durable
  storage and provider-specific idempotency/readback contracts. **Selected
  phase:** 2.
- **Acceptance evidence:** every effect uses prepared→executing→accepted→
  verified→applied/ambiguous→reconciled/compensated with durable pre-effect
  reservation, fencing and bound authoritative reconciliation.
- **Retrospective scope (RET-008, RET-010):** one machine-readable ownership
  ledger names the authoritative writer and fencing state; split-brain or
  ambiguous ownership never becomes retry authority. Compensation remains a
  separate fresh-state, Diff, authority and Receipt-bound action after
  reconciliation, while distributed-store guarantees remain an external
  non-claim.
- **Negative probes:** kill/restart at each transaction/network boundary,
  concurrent workers, lost response after commit, stale lock, mismatch and
  retry of changed content yield at most one effect and no false success.
- **Rollback boundary / fallback:** disable dispatch; retain ambiguous records
  and reservations until an old/new reader verifies migration. **External
  gates:** universal/live-provider idempotency remains provider-specific.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-007 — Separate requester, Agent, approver and operator identities

- **Status / priority:** `blocked_external` / P0. **Importance / complexity:**
  I5 / L. **Risk reduction:** critical. **User value:** prevents self-approval
  and confused-deputy authority. **Demo value:** medium with synthetic actors.
- **Canon:** primitive, CM-CAN-02/04/05/07/14. **Source:** SEC-02.
  **Dependencies:** production IAM and owner/account lifecycle; local contract
  work may be split into a new ready child. **Selected phase:** 3.
- **Acceptance evidence:** boundary-derived immutable subject/org/tenant/role/
  assurance/session; distinct workload/human credentials; separation of duties,
  step-up, disable and session revoke bound through receipt.
- **Retrospective scope (RET-013):** local evidence uses synthetic
  trust-domain/workload identity fixtures shaped for later SPIFFE/SPIRE
  integration without claiming production IAM, workload attestation or a live
  SPIRE deployment.
- **Negative probes:** Agent/requester/different tenant/disabled/expired/
  downgraded identity, forged headers and same conflicting human roles cannot
  approve or execute.
- **Rollback boundary / fallback:** powerful effects remain synthetic/inactive;
  never fall back to the shared bearer for production authority. **External
  gates:** IAM, MFA and identity operations.
- **Completion commit/evidence:** blocked; no production IAM evidence.
  **Last reviewed:** 2026-08-01.

### AAS-008 — One closed effect broker for powerful capabilities

- **Status / priority:** `candidate` / P0. **Importance / complexity:** I5 / XL.
  **Risk reduction:** critical. **User value:** one understandable enforcement
  boundary. **Demo value:** high for closed tools.
- **Canon:** primitive, CM-CAN-01/03/04/05/08/09. **Source:** SEC-03 and
  SEC-CTL-005. **Dependencies:** AAS-004, AAS-007, AAS-010, AAS-011, AAS-019.
  **Selected phase:** 3.
- **Acceptance evidence:** sole credentialed dispatcher with versioned closed
  schemas, inactive activation, exact resource/field ceilings, timeout,
  maximum effects and authoritative readback for every effect class.
- **Retrospective scope (RET-007):** named composition evidence must prove that
  authentication, effective authority, budgets, idempotency/reconciliation and
  audit causally gate the actual provider call at use time; preflight-only or
  reporting-only checks do not close this control.
- **Negative probes:** raw shell/path/URL, dynamic plugin, schema extras,
  invented capability, credential drift and direct provider/OS call produce
  zero effects; catalogue/install never activates.
- **Rollback boundary / fallback:** isolate/remove generic powerful tools and
  retain only current closed synthetic adapters. **External gates:** OS/network
  broker and deployment isolation claims.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-009 — Prompt/tool-injection trust boundary

- **Status / priority:** `done` / P0. **Importance / complexity:** I5 before
  any live LLM / L. **Risk reduction:** critical future-boundary prerequisite.
  **User value:** untrusted content cannot impersonate Owner instruction.
  **Demo value:** very high.
- **Canon:** extension backed by CM-CAN-01/03/05/08/09. **Source:** SEC-06.
  **Dependencies:** local hostile fixtures and typed action reconstruction;
  live enablement later depends on AAS-008/AAS-020. **Selected phase:** 3.
- **Acceptance evidence:** origin/trust/tenant/data-class/instruction-eligibility
  labels; provider/tool/document/memory content is data only; model emits typed
  candidates; trusted code reconstructs; secrets are opaque handles.
- **Retrospective scope (RET-009):** the same trust boundary covers prompt,
  tool, document and memory injection; it does not introduce a second hijack
  framework or let any content channel acquire instruction eligibility.
- **Negative probes:** override/exfiltrate/self-approve/URL/path instructions in
  fields, tool errors, memory and encoded/Unicode/multi-turn channels cannot
  change calls, decisions or secret exposure.
- **Rollback boundary / fallback:** no live model, retrieval or credentials;
  disable model path on label/schema uncertainty. **External gates:** reviewed
  model gateway and live-model evidence.
- **Completion commit/evidence:** implementation
  `f7641d2dc81ca2008da4c30b4d697d60569427fb`;
  `docs/development/evidence/admin-ai-aas-009-20260801.json` and
  `docs/development/admin-ai-aas-009-injection-trust-boundary-pdca.md`.
  **Last reviewed:** 2026-08-01.

### AAS-010 — Tenant, row, field and data-purpose isolation

- **Status / priority:** `blocked_external` / P0. **Importance / complexity:**
  I5 / XL. **Risk reduction:** critical. **User value:** prevents cross-tenant
  access and over-collection. **Demo value:** medium locally.
- **Canon:** extension backed by CM-CAN-04/05/09. **Source:** SEC-07.
  **Dependencies:** production identity, provider tenancy/privacy model,
  tenant-partitioned credentials/storage/queues/keys. **Selected phase:** 3.
- **Acceptance evidence:** tenant derived at boundary; authoritative ownership
  mapping/readback; row predicates, field masks/classification, purpose,
  retention/export/delete policy and partitioned state.
- **Negative probes:** cross-tenant IDs/replay/approval/memory/cache/receipt,
  unknown classification and confused-deputy credentials fail indistinguishably
  with zero unauthorized provider access.
- **Rollback boundary / fallback:** keep one synthetic tenant and real data
  inactive; never infer isolation from a signed tenant string. **External
  gates:** provider/identity/privacy production design and evidence.
- **Completion commit/evidence:** blocked; external tenancy evidence absent.
  **Last reviewed:** 2026-08-01.

### AAS-011 — Management-plane/effect-plane separation

- **Status / priority:** `candidate` / P0. **Importance / complexity:** I5 / L.
  **Risk reduction:** critical. **User value:** Agent cannot expand its ceiling,
  erase evidence or clear stop state. **Demo value:** high with adversarial
  worker fixture.
- **Canon:** extension clarifying CM-CAN-02/08/14/17 and Administration.
  **Source:** SEC-CTL-005. **Dependencies:** AAS-004, AAS-007, AAS-023, AAS-024.
  **Selected phase:** 3.
- **Acceptance evidence:** distinct propose/review/activate/revoke/rollback/
  audit duties and credentials; worker has no write path to Policy, keys, stop
  or protected evidence.
- **Negative probes:** compromised/full-control worker cannot activate/rollback
  Policy, mint credentials, approve itself, clear freeze or edit/delete audit.
- **Rollback boundary / fallback:** disable effect workers until management
  state is independently readable. **External gates:** deployment/identity/key/
  storage independence claim.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-035 — OpenClaw Agent Docker, closed Gateway-only runtime

- **Status / priority:** `done` / P0. **Importance / complexity:** I5 explicit
  Owner-priority containment frontier / XL. **Risk reduction:** critical before
  exposing a real autonomous agent runtime. **User value:** a real agent can use
  ChimpMaera's typed surface without becoming the Decision, Policy, Authority or
  Effect control plane. **Demo value:** very high and end-to-end.
- **Canon:** composition plus extension, CM-CAN-01/03/04/05/07/08/09/10/11/15/
  16/17. **Source / dependencies / phase:** Owner direction 2026-08-01 12:46
  CEST; completed AAS-012 plus runtime-specific boundaries shared with AAS-008,
  AAS-019, AAS-020, AAS-021, AAS-025 and AAS-030; immediate product frontier.
- **Acceptance evidence:** prove actual upstream Docker support, licence/
  redistribution compatibility and exact version/image digest before image
  selection; pinned default-off service; non-root read-only filesystem; no host
  or Docker socket/mount; Gateway-only network; bounded scratch; workload
  identity; zero embedded provider/system credentials; managed durable mind
  store; health/readiness/reset; typed request succeeds only through Gateway/
  Broker with receipt/readback; load/health evidence and zero owned residue
  after deterministic teardown.
- **Negative probes:** direct provider/ERP/CRM/Internet egress, filesystem/
  process/host/Docker access, credential discovery, raw effect, unknown action,
  incompatible catalogue/image, Gateway bypass, cross-tenant/mind-store access,
  reset/replay/restart and resource-exhaustion paths fail closed without touching
  the owner's running OpenClaw, Gateway, vLLM or model infrastructure.
- **Rollback boundary / fallback:** service remains default-off; detach the
  isolated Gateway network, stop only the ChimpMaera-owned fixture, purge its
  bounded owned state and retain receipts. Unknown provenance/licence/upstream
  support or any unavoidable ambient authority means no image selection and a
  deny-only fixture, not a weaker runtime.
- **Honest non-claims / external gates:** isolated local fixture evidence is not
  production sandbox, host-kernel, registry signature, live-provider,
  multi-tenant deployment or security-completeness proof. No current owner
  OpenClaw/Gateway/vLLM/model change; no push, PR, merge, tag, release,
  publication, live credential or external-system mutation.
- **Completion commit/evidence:** prerequisite provenance/maturity 4/4 at
  `6742ea5e16c3855160a0ca7d59e1f4d583d23671` with
  `docs/development/evidence/admin-ai-aas-035-openclaw-provenance-20260801.json`;
  runtime implementation `2ddfd1e5ec70e6f6fc233aebc68339c1f709bf2d` and
  `docs/development/evidence/admin-ai-aas-035-20260801.json`; runtime gates
  **12/12**, complete tests **102/102**, video **15/15**, checksums **154/154**,
  supply chain **6/6** and final isolated smoke `aas035-20260801T115932Z` PASS
  in 25,811 ms with zero owned residue. Verdict
  `LOCAL_AAS_035_OPENCLAW_GATEWAY_ONLY_PASS_NOT_PRODUCTION_SANDBOX_REGISTRY_OR_RELEASE_CLAIM`.
  **Last reviewed:** 2026-08-01.

### AAS-036 — Model Access Broker and bidirectional traffic guards

- **Status / priority:** `done` / P0. **Importance / complexity:** I5 explicit
  Owner-priority architecture/security frontier / XL. **Risk reduction:**
  critical before agents can use models without ambient provider authority.
  **User value:** real agents receive guarded model results while provider
  credentials, routing, deterministic decisions and effects remain outside the
  agent. **Demo value:** very high and agent-agnostic.
- **Canon:** composition plus extension, CM-CAN-01/02/03/04/05/07/08/09/10/11/
  14/15/16/17. **Source / dependencies / phase:** Owner direction 2026-08-01
  14:17 CEST; completed AAS-017 plus AAS-009/AAS-012/AAS-035 primitives;
  immediate model-access security frontier before application breadth.
- **Evidence metric — 8/8:** (1) versioned canonical request/response/stream
  contracts; (2) request guard for workload/user/tenant/purpose/delegation,
  allowlists, data/trust class, size/token/cost/rate/time budgets, redaction and
  correlation/operation IDs; (3) broker-only credential handles, TLS and closed
  routing; (4) response/stream guard for size/schema/MIME/SSE, redaction,
  provenance and `UNTRUSTED_MODEL_OUTPUT`; (5) closed OpenAI-compatible Chat
  Completions/Responses and Anthropic-compatible Messages/SSE conformance;
  (6) real isolated OpenClaw E2E plus an honest agent compatibility matrix;
  (7) complete direct-path/injection/tool-smuggling/budget/tenant/failure
  negative matrix; (8) focused/full/supply-chain/public-staging validation,
  PDCA, clean commit and zero owned residue.
- **Required architecture:** Agent → Capability Frontdoor → Decision/Policy →
  Model Access Broker → Provider; Provider → Response Guard → Agent. Decision/
  Policy, model credentials/routing, response inspection and Effect Broker stay
  logically separate. The broker is not an arbitrary HTTP proxy. Outcomes are
  `ALLOW`, `DENY`, `OWNER_ESCALATION`, `THROTTLE` or `QUARANTINE`.
  Deterministic guards are authoritative; any optional AI/JIT inspector has a
  never-grant ceiling and can only tighten, redact, pause, quarantine or request
  review. Tool calls remain untrusted typed candidates and cannot execute or
  mint authority.
- **Negative probes:** direct provider/DNS/Internet route, embedded or disclosed
  credentials, unknown protocol/model/route/version, replay/idempotency,
  concurrent final budget unit, provider timeout/partial stream, malformed SSE,
  oversized/MIME/schema response, prompt/response injection, secret
  exfiltration, incomplete/changed/hidden streaming tool calls, cross-tenant
  cache and broker unavailable all fail closed without duplicate provider or
  effect calls.
- **Audit/privacy and compatibility:** mandatory audit stores metadata, digests,
  decisions, usage and receipts rather than raw content. Content capture is a
  bounded explicit evidence window only. OpenClaw requires a real isolated E2E;
  Hermes and Claude Code require pinned provenance/licence/local runtime and a
  safe adapter, otherwise only adversarial protocol fixtures count and runtime
  compatibility remains explicitly unproven.
- **Rollback boundary / fallback:** disable the default-off broker/frontdoor,
  remove only its isolated synthetic provider fixtures and bounded state, revoke
  broker credential handles, retain audit receipts and leave all agents without
  model access. Unknown provenance, routing or protocol fails closed; never add
  direct agent egress or credentials as a fallback.
- **Honest non-claims / external gates:** synthetic local providers and isolated
  containers do not prove live-provider compatibility, production TLS/DNS/
  network isolation, universal agent compatibility, hostile-host containment or
  security completeness. The Owner OpenClaw, Gateway, vLLM, models and live
  credentials remain untouched. No push, PR, merge, tag, release, publication,
  production/live-provider action or external-account mutation.
- **Completion commit/evidence:** implementation
  `9a95eb869eff00f30afb8c66f3fc2d9f12d74023` and
  `docs/development/evidence/admin-ai-aas-036-20260801.json`; gates **8/8**,
  complete tests **116/116**, video **15/15**, supply chain **6/6**, public
  staging PASS, and isolated real-OpenClaw smoke `aas036-20260801T131032Z`
  PASS in 63,525 ms with zero owned residue. Verdict
  `LOCAL_AAS_036_PASS_NOT_LIVE_PROVIDER_PRODUCTION_TLS_VAULT_UNIVERSAL_AGENT_OR_RELEASE_CLAIM`.
  **Last reviewed:** 2026-08-01.

### AAS-037 — Managed Skill Lifecycle and Quality Gate

- **Status / priority:** `done` / P0. **Importance / complexity:** I5 explicit
  Owner-priority dependent agent-security frontier / XL. **Risk reduction:**
  critical against unreviewed code, dependency and transitive-rights admission.
  **User value:** agents can easily discover and request skills while the Owner
  retains explainable control over installation, activation and capabilities.
- **Canon:** composition plus extension, CM-CAN-01/02/03/04/05/07/08/09/10/
  11/14/15/16/17. **Source / dependencies:** Owner direction 2026-08-01 14:26
  CEST; completed AAS-036 plus AAS-012/AAS-017/AAS-025 primitives; immediately
  follows AAS-036 before application breadth.
- **Evidence metric — 6/6:** (1) canonical Skill Admission IR and closed
  manifest contract; (2) deterministic provenance/licence/dependency/secret/
  network/filesystem/process/persistence and quality/risk report; (3)
  explainable SAFE_GUIDED/CUSTOM/RAMPAGE decision matrix with recommendation,
  rationale, impacts and routing; (4) brokered atomic immutable versioned
  install, separate activation and rollback store; (5) real isolated OpenClaw
  request/install/use E2E plus honest Hermes/Claude compatibility matrix; (6)
  adversarial negative matrix, focused/full/supply-chain/public validation,
  PDCA, clean commit and zero owned residue.
- **Required flow:** request -> resolve immutable source/version/digest ->
  stage/quarantine -> parse manifest/SKILL.md/tool declarations -> provenance,
  licence, dependency and authority analysis -> transitive-rights simulation ->
  sandbox tests -> profile decision -> brokered atomic install -> separate
  activation -> readback/receipt -> rollback. Installation never grants the
  requested capabilities. Updates require a new digest, Diff and evaluation;
  mutable references and silent dependency drift deny.
- **Negative probes:** mutable source, digest swap, malicious install script,
  hidden network/credential access, path escape/symlink, dependency confusion,
  transitive escalation, post-approval byte change, cross-tenant reuse, replay/
  concurrent install, failed activation and rollback all fail before authority
  or effect.
- **Profiles and friction:** SAFE_GUIDED is restrictive/default; CUSTOM is
  individually configurable; RAMPAGE may admit every registered capability and
  explicitly admitted extension when Owner policy allows, but malformed,
  tampered, cross-tenant or self-approved input remains invalid. Low-risk trusted
  read-only skills may auto-approve only when the Owner matrix enables it.
- **Rollback / non-claims / external gates:** deactivate and atomically restore
  the prior immutable skill-store generation while retaining receipts. OpenClaw
  packages are first; Hermes/Claude materializers remain unproven until exact
  formats and runtimes are pinned. No push, PR, merge, release, publication,
  live registry, production store, credential or external-account action.
- **Completion commit/evidence:** implementation
  `94cc5f24436b274a252dae3ff9b0326fcf1b2c30`; evidence
  `docs/development/evidence/admin-ai-aas-037-20260801.json`; focused canonical/
  runtime **12/12**, full **128/128**, video **15/15**, supply chain **6/6**,
  deterministic public staging PASS and final isolated real-OpenClaw smoke
  `aas037-20260801T151252Z` PASS in 31,238 ms with zero owned residue. Verdict
  `LOCAL_AAS_037_PASS_NOT_ARBITRARY_CODE_LIVE_REGISTRY_PRODUCTION_STORE_UNIVERSAL_AGENT_OR_RELEASE_CLAIM`.
  **Last reviewed:** 2026-08-01.

## P1 — high-value control product and hardened boundaries

### AAS-012 — Capability/action catalogue, inactive by default

- **Status / priority:** `done` / P1. **Importance / complexity:** I4 / S.
  **Risk reduction:** high. **User value:** finite understandable vocabulary.
  **Demo value:** high. **Canon:** primitive, CM-CAN-01/03/15/17.
- **Source / dependencies / phase:** SEC-CTL-008; typed adapter descriptors;
  Phase 1.
- **Acceptance evidence:** version/digest/evidence/non-claims shown per action;
  install/admit/catalogue do not activate; exact fields/resources are closed.
  **Negative probes:** unknown adapter/action/field/path and inactive or
  incompatible version deny.
- **Rollback boundary / external gates:** remove catalogue version while all
  affected actions remain inactive; live adapter provenance is gated.
- **Completion commit/evidence:** implementation
  `4e3a5952fc6c748b3fe4ac648c82968a18d3f39f`;
  `docs/development/evidence/admin-ai-aas-012-20260801.json` and
  `docs/development/admin-ai-aas-012-inactive-capability-catalogue-pdca.md`;
  focused 4/4, full 95/95, video 15/15, checksums 129/129, supply-chain 6/6,
  deterministic archive
  `8a8f093804aa5d4e663a7648cbedb2125ec8072adbc5b69a1467d193a25435d8`;
  verdict `LOCAL_AAS_012_PASS_INACTIVE_DESCRIPTION_NOT_PROVENANCE_ACTIVATION_OR_AUTHORITY_CLAIM`.
  **Last reviewed:** 2026-08-01.

### AAS-013 — Effect-free Policy simulator

- **Status / priority:** `candidate` / P1. **Importance / complexity:** I4 / S.
  **Risk reduction:** high through preview. **User value:** safe “what would be
  allowed?” answer. **Demo value:** very high. **Canon:** extension,
  CM-CAN-01/06/08/11/16.
- **Source / dependencies / phase:** SEC-CTL-007; AAS-003 and AAS-012; Phase 1.
- **Acceptance evidence:** frozen inputs match live evaluator decision facts;
  no authority, lease, credential or provider access. **Negative probes:**
  stale/unknown inputs deny; instrumentation proves zero effect paths.
- **Rollback boundary / external gates:** disable simulator only; never use it
  as provider prediction. Live-state/provider outcome claims are gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-014 — Typed intent and deterministic Policy compiler

- **Status / priority:** `candidate` / P1. **Importance / complexity:** I4 / M.
  **Risk reduction:** high against ambiguous free-form authority. **User value:**
  Owner configures purpose/outcomes, not raw switches. **Demo value:** high.
  **Canon:** extension, CM-CAN-01/02/05/06.
- **Source / dependencies / phase:** SEC-CTL-009; AAS-003/AAS-012; Phase 4.
- **Acceptance evidence:** same canonical intent/compiler version yields same
  Policy digest and explanation; ambiguity asks or denies. **Negative probes:**
  unsupported text, hidden defaults, template change and compiler drift never
  broaden Policy silently.
- **Retrospective scope (RET-002, RET-011):** compact Owner goals, rules and
  exceptions compile to typed deterministic Plan/Policy/Diff output; free text
  and every deterministic or model provider emit untrusted candidates only.
  Provider substitution cannot change authority or mint Control-Plane rights.
- **Rollback boundary / external gates:** retain typed intent and last safe
  compiled Policy; free text remains non-authoritative. None for local proof.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-015 — Narrow bounded exception overlays

- **Status / priority:** `candidate` / P1. **Importance / complexity:** I4 / M.
  **Risk reduction:** high against permanent broad elevation. **User value:**
  solve exceptional work safely. **Demo value:** high. **Canon:** extension,
  CM-CAN-04/07/14/17.
- **Source / dependencies / phase:** SEC-CTL-010; AAS-003, AAS-014 and relevant
  schedule/budget checks; Phase 4.
- **Acceptance evidence:** actor/action/resource/data/time/use/budget/reason
  overlay is a provable subset and base Policy stays byte-identical. **Negative
  probes:** changed scope/tenant/time/use/replay/reason or root-ceiling excess
  denies.
- **Rollback boundary / external gates:** revoke overlay generation; do not
  modify base Policy. Production approver identity remains gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-016 — Authoritative approval Diff, routing and step-up

- **Status / priority:** `done` / P1. **Importance / complexity:** I4 current
  material-Diff defect / L. **Risk reduction:** high. **User value:** decision
  reflects real fresh state and accountable approvers. **Demo value:** high.
- **Canon:** defect for current material Diff, then primitive/identity
  extension, CM-CAN-02/06/07/08/11. **Source:** SEC-08 and SEC-CTL-011.
  **Dependencies:** local provider snapshot/ETag fixture; production routing
  later AAS-007. **Selected phase:** 3.
- **Acceptance evidence:** authoritative bounded prior-state snapshot, version,
  purpose, requester/delegation, fields, side effects, data/budget impact,
  rollback and Policy bound to display and revalidated at use.
- **Negative probes:** state/version/materiality/requester/tenant/Policy/
  approver change, hidden/truncated fields, rapid prompts, approve-after-reject
  and prohibited same actor deny.
- **Rollback boundary / fallback:** revert to escalation refusal for material
  actions rather than display a constant/stale Diff. **External gates:** real
  MFA/quorum/anti-clickjacking UI evidence.
- **Completion commit/evidence:** implementation
  `27221ad638addf150017542e81187f3fd3c54f09`; PDCA
  `docs/development/admin-ai-aas-016-authoritative-approval-diff-pdca.md`;
  evidence `docs/development/evidence/admin-ai-aas-016-20260801.json`;
  local verdict
  `LOCAL_AAS_016_PASS_NOT_PROVIDER_TRANSACTION_OR_PRODUCTION_APPROVAL_CLAIM`.
  **Last reviewed:** 2026-08-01.

### AAS-017 — Complete signed Policy lifecycle

- **Status / priority:** `done` / P1. **Importance / complexity:** I4 / L.
  **Risk reduction:** high. **User value:** reviewable activation, migration and
  rollback. **Demo value:** high. **Canon:** primitive, CM-CAN-02/03/14/17.
- **Source / dependencies / phase:** SEC-09; local signer/trust fixtures and
  AAS-002; Phase 3.
- **Acceptance evidence:** draft→validate→simulate→approve→stage→activate→
  supersede→retire with issuer, semantic Diff, monotonic generation, validity,
  compatibility, revoke and fallback receipts.
- **Negative probes:** unsigned/expired/replayed/wrong-tenant/incompatible/
  widened-without-approval/trust-drift and mixed-cache generations deny.
- **Rollback boundary / external gates:** explicit last-safe fallback; partial
  rollout freezes. Production signer/trust-root operations remain gated.
- **Completion commit/evidence:** implementation
  `8b257dc5d50aece375cbf32f89dfed7d280ca984` and
  `docs/development/evidence/admin-ai-aas-017-20260801.json`; signed contract,
  lifecycle, recovery and adversarial gates **4/4**, complete tests **108/108**,
  video **15/15**, checksums **156/156**, supply chain **6/6**, deterministic
  public staging PASS with zero residue. Verdict
  `LOCAL_AAS_017_PASS_NOT_PRODUCTION_SIGNER_TRUST_ROOT_OR_DISTRIBUTED_ROLLOUT_CLAIM`.
  PDCA frontier change: select Owner-priority `AAS-036` at **0/8**. **Last
  reviewed:** 2026-08-01.

### AAS-018 — Attenuating delegation lineage

- **Status / priority:** `candidate` / P1. **Importance / complexity:** I4 / M.
  **Risk reduction:** high. **User value:** safe specialist/sub-agent use.
  **Demo value:** medium. **Canon:** extension, CM-CAN-02/04/05/14.
- **Source / dependencies / phase:** SEC-10 and SEC-CTL-017; AAS-004, AAS-007,
  AAS-010 and AAS-019; Phase 4.
- **Acceptance evidence:** signed acyclic owner-rooted chain, exact attenuated
  rights, purpose/depth/time/budget/redelegation and cascade revoke bound to
  Plan/effect/audit.
- **Negative probes:** cycle/missing hop/substitution/sibling reuse/broader
  child/budget reset/cross-tenant/excess depth/revoked ancestor deny.
- **Rollback boundary / external gates:** revoke child lineage and disable
  delegation; production identity and tenant lifecycle are gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-019 — Runtime resource, rate and attention budgets

- **Status / priority:** `candidate` / P1. **Importance / complexity:** I4 / M.
  **Risk reduction:** high availability/cost protection. **User value:** bounded
  tool/model/provider cost and approval load. **Demo value:** high.
  **Canon:** extension, CM-CAN-04/07/11.
- **Source / dependencies / phase:** remaining SEC-11; AAS-004/AAS-005/AAS-006;
  Phase 2.
- **Acceptance evidence:** deadlines/cancellation, bytes/rows/tokens/money/CPU/
  wall/concurrency/retry/prompt/storage budgets, backpressure/circuit breakers
  and container limits with receipts.
- **Negative probes:** parallel overspend, restart reset, slow/chunked/oversize
  response, retry storm and approval spam fail without false success.
- **Rollback boundary / external gates:** reduce concurrency to zero and retain
  accounting; production distributed/container enforcement claims are gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-020 — Privacy-bound untrusted memory and provenance

- **Status / priority:** `candidate` / P1. **Importance / complexity:** I4 / L.
  **Risk reduction:** high before retrieval. **User value:** correctable,
  purpose-bound memory without authority. **Demo value:** medium.
  **Canon:** extension, CM-CAN-05/11/16.
- **Source / dependencies / phase:** SEC-12; AAS-009/AAS-010 and data/key
  inventory; Phase 4.
- **Acceptance evidence:** each entry binds source/version/time/trust/data class/
  purpose/retention/consent/provenance; minimization before model/storage;
  correction/deletion invalidates derivatives.
- **Negative probes:** poisoned instruction, wrong tenant/purpose, expired/
  revoked source, secret field and dictionary-attackable identifiers never
  become trusted context or leak.
- **Rollback boundary / external gates:** disable retrieval and purge by typed
  retention procedure; production privacy/key-management evidence is gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-021 — Provider authentication and network enforcement

- **Status / priority:** `candidate` / P1. **Importance / complexity:** I4 / M.
  **Risk reduction:** high. **User value:** provider calls reach only intended
  services with bounded responses. **Demo value:** high with sandbox probes.
  **Canon:** primitive plus extension, CM-CAN-04/08/09/10/11.
- **Source / dependencies / phase:** SEC-13; AAS-008/AAS-019 and network/service
  identity enforcement; Phase 3.
- **Acceptance evidence:** enforced destination identity, protocol/method/path,
  rebinding/redirect/proxy defense, least-privilege audience-bound credentials,
  response type/schema/size/time and provider evidence in receipts.
- **Negative probes:** loopback/link-local/metadata, alternate DNS, encoded host,
  redirect/proxy, wrong certificate/service, port/path/method, slow/oversize/
  malformed response and cross-adapter credential fail.
- **Rollback boundary / external gates:** detach egress/disable adapter;
  production packet/service-identity proof is gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-022 — Separately authorised compensation, rollback and cleanup

- **Status / priority:** `candidate` / P1. **Importance / complexity:** I4 / XL.
  **Risk reduction:** high incident containment. **User value:** honest safe
  recovery. **Demo value:** high. **Canon:** primitive, CM-CAN-10/11/13.
- **Source / dependencies / phase:** SEC-14; AAS-006/AAS-007/AAS-010/AAS-016 and
  provider contracts; Phase 4.
- **Acceptance evidence:** typed provider compensation with fresh current-state
  Diff/authority/idempotency/readback/receipt; reversibility class explicit;
  cleanup proves ownership and preserves audit.
- **Negative probes:** stale/wrong-tenant/already-compensated/irreversible/
  changed-state and partial compensation quarantine; foreign/uncertain cleanup
  objects are skipped.
- **Rollback boundary / external gates:** no automatic rollback; freeze and
  reconcile. Live provider compensation is gated per adapter.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-023 — Protected audit timeline and deterministic explanation

- **Status / priority:** `in_progress` / P1. **Importance / complexity:** I4 / L.
  **Risk reduction:** high detection/accountability. **User value:** reconstruct
  what happened and why. **Demo value:** very high. **Canon:** extension,
  CM-CAN-05/10/14/16/17 and Administration.
- **Source / dependencies / phase:** SEC-15 and SEC-CTL-013; local event schema
  and signer fixture, later independent sink; Phase 4.
- **Acceptance evidence:** ordered schema events join identity→intent→Plan→
  Policy→approval→budget→effect→readback/reconcile/stop by digests; explanation
  derives only from verified facts; gaps are visible.
- **Negative probes:** edit-and-rehash, delete/truncate/reorder/duplicate/fork,
  stale signer/clock rollback and missing link never render verified success;
  secrets are excluded.
- **Rollback boundary / external gates:** preserve old records/readers and mark
  unverifiable migration; independent append-only storage/attestation is gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-024 — Key, credential and authority-token lifecycle

- **Status / priority:** `candidate` / P1. **Importance / complexity:** I4 / M.
  **Risk reduction:** high. **User value:** compromise and rotation have narrow
  blast radius. **Demo value:** high with synthetic keys. **Canon:** primitive,
  CM-CAN-04/07/09/17.
- **Source / dependencies / phase:** SEC-16; AAS-004 and key/identity services;
  Phase 3.
- **Acceptance evidence:** purpose-separated keys; issuer/audience/key ID/
  algorithm/iat/nbf/exp/max-use and authority/Policy/profile/stop generations;
  rotation, revoke, recovery and narrow adapter/tenant credentials.
- **Negative probes:** wrong purpose/audience/key/generation, algorithm switch,
  future/expired/retired/compromised token and cross-restart/tenant/adapter copy
  deny at use.
- **Rollback boundary / external gates:** stop dispatch and retain overlap only
  for explicit verified window; production HSM/KMS/custody remains gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-025 — Supply-chain provenance and runtime artifact trust

- **Status / priority:** `ready` / P1. **Importance / complexity:** I4 / L.
  **Risk reduction:** high. **User value:** untrusted code/model/template stays
  inactive. **Demo value:** medium. **Canon:** extension, CM-CAN-15/16/17.
- **Source / dependencies / phase:** SEC-17; existing local verifier and trust
  fixtures; Phase 4.
- **Acceptance evidence:** artifact-type trust policy for source/signer/digest/
  provenance/SBOM/license/vulnerability/review/revoke, verified before build,
  install, activation and restart, bound to evidence.
- **Retrospective scope (RET-012):** include format-aware model-artifact
  fixtures, including Safetensors-oriented positive and negative cases, while
  explicitly rejecting the claim that a safe serialization format alone proves
  provenance, review, compatibility or runtime safety.
- **Negative probes:** correct digest/wrong signer, forged/missing attestation,
  revoked key, confusion/lifecycle script, SBOM/CVE/license failure and mutable
  model/template block activation.
- **Rollback boundary / external gates:** quarantine/disable artifact and use
  last verified bytes; live transparency/registry/vulnerability claims gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-026 — Schedule and maintenance-window control

- **Status / priority:** `candidate` / P1. **Importance / complexity:** I4 / M.
  **Risk reduction:** high. **User value:** unattended work stays within intended
  time. **Demo value:** high. **Canon:** extension, CM-CAN-03/04/07/11/17.
- **Source / dependencies / phase:** SEC-CTL-012; trusted clock, generations and
  AAS-004; Phase 2.
- **Acceptance evidence:** activation/blackout/timezone/expiry/restart semantics
  checked at issue and use; work arriving after close requires new decision.
  **Negative probes:** DST, clock uncertainty, restart, queued work, boundary
  race and stale lease deny.
- **Rollback boundary / external gates:** fail window closed; time-source and
  distributed-scheduler production claims gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-027 — Data/egress envelope at adapter boundary

- **Status / priority:** `candidate` / P1. **Importance / complexity:** I4 / L.
  **Risk reduction:** high exfiltration prevention. **User value:** readable and
  writable data flows are explicit. **Demo value:** high. **Canon:** primitive
  plus adapter extension, CM-CAN-04/05/08/09.
- **Source / dependencies / phase:** SEC-CTL-014 and data-flow portions of
  SEC-03/07/13; AAS-008/AAS-010/AAS-021; Phase 3.
- **Acceptance evidence:** bound read/write fields/classes, tenant/resources,
  destination/protocol/method/payload and opaque secret references enforced at
  adapter/egress boundary.
- **Negative probes:** injected URL, undeclared/sensitive field, oversized
  payload, secret read, cross-tenant reference and alternate destination deny
  outside Agent.
- **Rollback boundary / external gates:** disable adapter/egress; production
  DLP/classification/egress proxy evidence gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

## P2 — usability, migration and recurring assurance

### AAS-028 — Guided onboarding and safety templates

- **Status / priority:** `candidate` / P2. **Importance / complexity:** I3 / M.
  **Risk reduction:** medium through safe defaults. **User value:** high.
  **Demo value:** very high. **Canon:** extension,
  CM-CAN-02/03/14/15/16/17.
- **Source / dependencies / phase:** SEC-CTL-015; AAS-003/AAS-013/AAS-014;
  Phase 4.
- **Acceptance evidence:** deterministic risk interview and recommendation;
  effective-rights preview, negative examples and simulation precede explicit
  versioned activation. **Negative probes:** catalogue/template/update cannot
  grant or silently expand rights.
- **Retrospective scope (RET-003, RET-004):** onboarding starts in a separate
  diagnosis/status/typed-repair bootstrap envelope and promotes authority only
  through explicit health and Owner gates. It asks only material unknowns and
  shows Plan, stage, health, warning, Receipt, resume and cleanup state without
  silently expanding authority or outranking the active I5 frontier.
- **Rollback boundary / external gates:** deactivate template Policy and retain
  prior envelope. Production fitness/certification remains a non-claim.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-029 — Profile/Policy version Diff and migration

- **Status / priority:** `candidate` / P2. **Importance / complexity:** I3 / M.
  **Risk reduction:** medium. **User value:** safe reviewable evolution.
  **Demo value:** high. **Canon:** primitive, CM-CAN-03/14/16/17.
- **Source / dependencies / phase:** SEC-CTL-016; AAS-002/AAS-017; Phase 4.
- **Acceptance evidence:** semantic expansion highlighted; compatibility and
  evidence bound; rollback/fallback explicit; unchanged semantics stable.
  **Negative probes:** lossy/unknown migration, stale activation, hidden new
  default and mixed generations deny.
- **Rollback boundary / external gates:** dual-read verified versions then last
  safe generation; production rollout infrastructure gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-030 — Boundary-composition adversarial assurance

- **Status / priority:** `ready` / P2. **Importance / complexity:** I3 / M.
  **Risk reduction:** medium/high recurring regression detection. **User value:**
  trustworthy claims. **Demo value:** medium. **Canon:** primitive recurring
  guard, CM-CAN-16/17.
- **Source / dependencies / phase:** SEC-18; grows alongside AAS-001..034;
  Phase 5.
- **Acceptance evidence:** machine-readable threat/control/invariant matrix;
  schema fuzz/property, crash/concurrency/restart and configuration/byte-bound
  evidence; critical/high regressions gate completion.
- **Retrospective scope (RET-015):** each applicable hard-E2E composition case
  traces intent→Plan→Policy→approval→effect→Receipt→revoke/rollback/cleanup and
  names its fail-closed probes; documentation-only linkage earns no closure
  credit.
- **Negative probes:** mutation removal of use-time scope/stop/reservation/
  tenant/timeout/signature/audit checks causes named failures; old-byte evidence
  cannot satisfy new claims.
- **Rollback boundary / external gates:** revert only the faulty feature, never
  suppress the guard; real sandbox/IAM/network integrations gated separately.
- **Completion commit/evidence:** pending recurring guard. **Last reviewed:**
  2026-08-01.

### AAS-031 — Audit export, retention and independent attestation

- **Status / priority:** `candidate` / P2. **Importance / complexity:** I3 / L.
  **Risk reduction:** medium. **User value:** operations/compliance evidence.
  **Demo value:** medium. **Canon:** extension, CM-CAN-10/16/17.
- **Source / dependencies / phase:** SEC-CTL-018 and export portion SEC-15;
  AAS-023 plus protected sink/retention policy; Phase 4.
- **Acceptance evidence:** complete bounded export, access control, retention/
  deletion behavior, source/time provenance, tamper verification and privacy-
  preserving integrity tombstones.
- **Retrospective scope (RET-014):** provide a digest/link/source/time-only
  export profile and negative evidence that payloads, PII and secrets are not
  included; this remains an export/privacy profile, not independent attestation.
- **Negative probes:** missing sequence, unauthorized export, deletion/fork,
  clock/source drift and prohibited personal/secret fields are detected/denied.
- **Rollback boundary / external gates:** preserve canonical local events and
  disable export; independent storage/attestation/compliance claims gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

## P3 — deliberately later advisory capabilities

### AAS-032 — Natural-language Policy drafting only

- **Status / priority:** `candidate` / P3. **Importance / complexity:** I2 / XL.
  **Risk reduction:** low; may add ambiguity risk. **User value:** convenience.
  **Demo value:** medium. **Canon:** constrained extension,
  CM-CAN-01/02/05. **Source:** SEC-CTL-019. **Dependencies:** AAS-003/AAS-014/
  AAS-017/AAS-030. **Selected phase:** 5.
- **Acceptance evidence:** model output is an untrusted typed-intent draft;
  deterministic compile/simulate/Diff/Owner activation remains mandatory.
  **Negative probes:** prompt injection/ambiguity/unsupported request cannot
  activate or widen Policy.
- **Rollback boundary / external gates:** disable drafting with no Policy
  change; live model/provider and safety evaluation gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-033 — Cross-organisation Policy federation

- **Status / priority:** `candidate` / P3. **Importance / complexity:** I2 / XL.
  **Risk reduction:** low for local scope. **User value:** future scale.
  **Demo value:** low. **Canon:** extension, CM-CAN-02/04/14/17.
  **Source:** SEC-CTL-020. **Dependencies:** AAS-007/AAS-010/AAS-017/AAS-018/
  AAS-023/AAS-024. **Selected phase:** 5.
- **Acceptance evidence:** explicit trust roots, namespace/tenant mapping,
  attenuation, conflict/expiry/revoke and accountable cross-org receipts.
  **Negative probes:** unknown/compromised org, cyclic trust, namespace
  collision, broader imported rights and stale revoke deny.
- **Rollback boundary / external gates:** sever federation and retain local
  envelope; external org identity/legal/operational trust gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-034 — Advisory autonomous Policy optimisation

- **Status / priority:** `candidate` / P3. **Importance / complexity:** I2 / XL.
  **Risk reduction:** none unless strictly advisory; material self-expansion
  risk. **User value:** possible future tuning. **Demo value:** low.
  **Canon:** constrained extension, CM-CAN-01/02/14/17. **Source:** SEC-CTL-021.
  **Dependencies:** evidenced higher-priority backlog and long-horizon audit.
  **Selected phase:** 5.
- **Acceptance evidence:** optimiser proposes a typed, evidence-cited Diff only;
  cannot activate, approve, alter evidence or weaken constraints; Owner decision
  and normal lifecycle remain required.
- **Negative probes:** reward hacking, metric gaming, evidence deletion,
  self-approval, incremental scope creep and rollback suppression cannot change
  effective authority.
- **Rollback boundary / external gates:** remove adviser with zero Policy
  effect; live optimisation/model/provider/production work gated.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

## Completion record template

When an item moves to `done`, replace its pending completion line with:

```text
Completion commit/evidence: <commit>; <tests/receipts/paths>; positive=<result>;
negative=<result>; rollback=<verified result>; non-claims=<remaining boundary>.
PDCA: <new evidence/gaps>; frontier change=<IDs/reason>.
```

If new evidence invalidates a completed control, do not reopen it. Create a new
ID, link the old completion commit and the new evidence, and rank the regression
by current importance.
