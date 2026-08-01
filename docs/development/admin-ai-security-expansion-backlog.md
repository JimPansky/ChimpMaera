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
| P0 | 5 | 2 | 0 | 2 | 2 | 0 | 11 |
| P1 | 11 | 5 | 0 | 0 | 0 | 0 | 16 |
| P2 | 3 | 1 | 0 | 0 | 0 | 0 | 4 |
| P3 | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| **Total** | **22** | **8** | **0** | **2** | **2** | **0** | **34** |

Internally ready items, in selection order after AAS-002 closure:

| Rank | ID | Priority | Importance | Complexity | Why ready now |
| ---: | --- | --- | --- | --- | --- |
| 1 | AAS-003 | P0 | I5 | M | Local deterministic effective-rights facts and view |
| 2 | AAS-009 | P0 | I5 before live LLM | L | Trust-label and typed-planning contracts can be proven with hostile fixtures |
| 3 | AAS-016 | P1 | I4 current material-Diff defect | L | Synthetic provider snapshot/ETag fixtures can close the local correctness gap |
| 4 | AAS-012 | P1 | I4 | S | Finite local catalogue can remain inactive by default |
| 5 | AAS-017 | P1 | I4 | L | Signed lifecycle contracts and local trust fixtures need no production signer |
| 6 | AAS-023 | P1 | I4 | L | Event schema, chaining and deterministic explanation can start locally |
| 7 | AAS-025 | P1 | I4 | L | Local artifact trust policy/negative fixtures extend the existing verifier honestly |
| 8 | AAS-030 | P2 | I3 recurring guard | M | Adds assurance without claiming that absent external systems were tested |

The authorized implementation loop completed `AAS-001` and `AAS-002` and must
select `AAS-003` next. Closed items do not reopen without new evidence.

The AAS-002 frontier audit rechecked Policy lifecycle, tenant binding,
decision/use convergence, fallback, management/effect separation, audit and
claim boundaries. The live-signer and independently managed trust-root gaps
remain represented by AAS-011/AAS-017; no new standalone item was discovered.
The worktree-control-file release-builder defect found during closure was fixed
and regression-tested as a local evidence-path correction, not promoted into a
duplicate recurring backlog item.

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

- **Status / priority:** `ready` / P0. **Importance / complexity:** I5 / M.
  **Risk reduction:** critical observability/prerequisite. **User value:** Owner
  can see the actual envelope and denial reasons. **Demo value:** very high.
- **Canon:** primitive, CM-CAN-04/11/14. **Source:** SEC-CTL-002.
  **Dependencies:** typed local profile/assignment/constraint inputs.
  **Selected phase:** 1.
- **Acceptance evidence:** canonical intersection returns allow/escalate/deny,
  contributing ceilings, reason codes and digest; rendered facts match the
  machine decision for golden cases.
- **Negative probes:** missing, unknown, stale or conflicting operand denies;
  capability alone never implies authority; UI cannot omit a restrictive
  operand or disagree with evaluated facts.
- **Rollback boundary / fallback:** keep decision enforcement and disable the
  explanatory view if fact parity fails. **External gates:** production
  identity/tenant inputs remain labelled synthetic.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

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
- **Negative probes:** raw shell/path/URL, dynamic plugin, schema extras,
  invented capability, credential drift and direct provider/OS call produce
  zero effects; catalogue/install never activates.
- **Rollback boundary / fallback:** isolate/remove generic powerful tools and
  retain only current closed synthetic adapters. **External gates:** OS/network
  broker and deployment isolation claims.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-009 — Prompt/tool-injection trust boundary

- **Status / priority:** `ready` / P0. **Importance / complexity:** I5 before
  any live LLM / L. **Risk reduction:** critical future-boundary prerequisite.
  **User value:** untrusted content cannot impersonate Owner instruction.
  **Demo value:** very high.
- **Canon:** extension backed by CM-CAN-01/03/05/08/09. **Source:** SEC-06.
  **Dependencies:** local hostile fixtures and typed action reconstruction;
  live enablement later depends on AAS-008/AAS-020. **Selected phase:** 3.
- **Acceptance evidence:** origin/trust/tenant/data-class/instruction-eligibility
  labels; provider/tool/document/memory content is data only; model emits typed
  candidates; trusted code reconstructs; secrets are opaque handles.
- **Negative probes:** override/exfiltrate/self-approve/URL/path instructions in
  fields, tool errors, memory and encoded/Unicode/multi-turn channels cannot
  change calls, decisions or secret exposure.
- **Rollback boundary / fallback:** no live model, retrieval or credentials;
  disable model path on label/schema uncertainty. **External gates:** reviewed
  model gateway and live-model evidence.
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

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

## P1 — high-value control product and hardened boundaries

### AAS-012 — Capability/action catalogue, inactive by default

- **Status / priority:** `ready` / P1. **Importance / complexity:** I4 / S.
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
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

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

- **Status / priority:** `ready` / P1. **Importance / complexity:** I4 current
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
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

### AAS-017 — Complete signed Policy lifecycle

- **Status / priority:** `ready` / P1. **Importance / complexity:** I4 / L.
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
- **Completion commit/evidence:** pending. **Last reviewed:** 2026-08-01.

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

- **Status / priority:** `ready` / P1. **Importance / complexity:** I4 / L.
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
