# Admin-AI security control analysis

**Assessment:** 5/5 complete for the local deterministic ChimpMaera demo at
baseline `47da5ac4f70221b485b4a2a1989dd1ffe9666d06`

**Branch:** `feat/admin-ai-security-analysis-backlog`

**Evidence date:** 2026-08-01

**Claim boundary:** engineering analysis and a local implementation backlog;
not a production-security certification

## 1. Decision summary

ChimpMaera has a sound core trust shape: an Agent proposes a closed action,
trusted code evaluates Policy without minting authority, an exact Owner
decision can issue narrow authority, and a gate outside the Agent rechecks the
action at use time. The current Admin-AI and Approval Workbench demonstrate
that shape for a very small synthetic surface. They do not yet safely confine
a general administrative AI, a live model, real tenants, or production data.

The most urgent finding is narrower and more concrete: the setup-repair path
accepts a caller-influenced target by lexical prefix and then resolves and
writes it. A recomputed unkeyed plan digest plus traversal/symlink behavior can
escape the intended owned root. `AAS-001` is therefore the first internally
ready P0 item. It is a current Canon defect, not merely a missing production
feature.

After that defect, the critical frontier is to protect Policy generations,
make effective rights inspectable, define the model/tool injection boundary,
add an independently enforced stop, reserve every effect before provider
access, account for aggregate authority, separate identities and management
authority, and enforce tenant/data/tool/runtime envelopes.

**Adversarial Canon verdict:** the Canon makes a correct implementation simpler
and more sustainable than an agent-specific switchboard because typed actions,
authority intersections, immutable Plans, exact approvals, use-time gates and
evidence-bound claims compose. It does **not** make implementation easy by
itself. The Canon is insufficiently explicit about aggregate/concurrent
budgets, emergency-control independence and availability, management-plane
separation, prompt/tool-content trust labels, tenant/data-purpose isolation,
and crash-safe effect reconciliation. One current implementation also violates
already-applicable containment primitives (`AAS-001`). Sustainable growth is
credible only if those gaps become shared contracts and effect-bound checks,
not UI promises or per-Agent exceptions.

## 2. Evidence and method

This integration reconciles, without modifying, the two read-only scouts:

- `docs/development/admin-ai-security-scout-canon-ux.md`
- `docs/development/admin-ai-security-scout-security.md`

The scouts ground their findings in `docs/CANON.md`,
`docs/ARCHITECTURE.md`, `docs/KNOWN-LIMITATIONS.md`, `SECURITY.md`, the
Admin-AI runtime under `demo/runtime/`, setup contracts and coordinator code
under `packages/`, authority/network manifests under `demo/manifests/`, and
focused tests under `tests/`. This report preserves the higher importance when
the scouts differ and merges overlaps only where one control and one evidence
boundary can close both findings.

Evidence terms used here:

- **Current defect:** executable behavior fails an applicable Canon invariant.
- **Missing control:** required for broader authority or a broader claim, but
  the current narrow demo truthfully does not claim it.
- **External gate:** identity, provider, network, key-management, production,
  credential or infrastructure evidence unavailable in this local worktree.
- **Local proof:** deterministic contracts, fixtures, tests and docs that make
  no live-provider or production claim.

## 3. Grounded threat and abuse model

### 3.1 Protected assets

The protected assets are Owner authority; active Policy/profile/stop
generations; approval and authority-signing keys; provider and infrastructure
credentials; tenant resources and classified data; filesystem/process/network
boundaries; effect/replay/budget state; audit and recovery evidence; operator
attention; and the integrity/availability of emergency controls.

### 3.2 Actors and trust boundaries

| Actor or component | Trusted for | Never trusted for |
| --- | --- | --- |
| Owner/approver identity | Decisions only at an evidenced assurance level | Supplying executable action facts or bypassing current-state checks |
| Admin AI / model / planner | Proposing typed candidate intent and Plans | Authority, Policy activation, credentials, self-approval, stop control, evidence administration |
| Requester and delegated workers | Authenticated requests within an assigned envelope | Tenant, role, purpose or delegation facts supplied in request text |
| PolicyEvaluator | Deterministic allow/escalate/deny data | Minting authority or expanding an adapter ceiling |
| Approval Workbench | Displaying and binding an authoritative Diff and decision | Treating stale/model-authored prose as the authoritative state transition |
| Effect broker/gate | Final use-time validation, credential use and readback | Trusting caller-provided paths, URLs, fields, provider state or success claims |
| Provider/tool/document/memory output | Untrusted data with provenance | Instructions, Policy, tool activation or approval content |
| Management/stop/audit planes | Independent activation, revoke and evidence duties | Agent-writable state or credentials shared with the effect worker |
| Host, Docker daemon, kernel, identity and provider services | External assumptions only when evidenced | Being silently included in the current local-demo security claim |

### 3.3 Abuse cases and required fail-safe outcome

| Abuse case | Present exposure or future trigger | Required outcome | Backlog controls |
| --- | --- | --- | --- |
| Caller changes repair target and recomputes digest | Current lexical-prefix repair verification | Reject before open/write; all out-of-root canaries unchanged | AAS-001 |
| Stale or Agent-authored Policy expands rights | Policy bytes/generation lifecycle grows | Refuse activation and use; retain last-known-safe generation | AAS-002, AAS-011, AAS-017 |
| One bearer requests and approves its own effect | Current local bearer widened to real authority | Distinct derived subjects, step-up and separation of duties | AAS-007, AAS-016, AAS-024 |
| Generic shell/path/URL/plugin bypasses typed actions | Future tool/LLM runner or broad profile | Unknown/inactive capability yields zero effects | AAS-008, AAS-012, AAS-027 |
| Crash after provider commit causes duplicate | Current AUTO_GRANT/installer ordering | Durable pre-effect reservation; identical retry returns bound result; ambiguity quarantines | AAS-006 |
| Many individually valid actions exhaust money/data/attention | Repeated auto-grants, tools or approval prompts | Atomic hierarchical budget denies before overspend | AAS-005, AAS-019 |
| Valid approval survives emergency or schedule change | Missing independent stop/schedule checks | Fresh use-time epoch/window check denies; queued work does not resume silently | AAS-004, AAS-026 |
| Hostile document/tool output becomes instruction | Any live model or retrieval enablement | Content remains labelled data; typed trusted code reconstructs action; no secret reaches model | AAS-009, AAS-020 |
| Tenant label masks cross-tenant provider access | Real tenants/data or broad read endpoint | Boundary-derived tenant and provider-side ownership check; indistinguishable deny | AAS-010 |
| Provider/DNS/redirect/proxy behavior escapes egress scope | Any broadened network effect | Destination/service identity, request and response ceilings enforced outside Agent | AAS-021, AAS-027 |
| Approval is stale, incomplete or coercive | Constant rather than authoritative prior-state Diff | Fresh bound snapshot/ETag, material fields, reason/quorum and revalidation | AAS-016 |
| Worker edits and rehashes local evidence | Ordinary writable JSON stores | Independent signing/ordering detects edit, deletion, reordering and forks | AAS-023, AAS-031 |
| Stolen multipurpose key mints reusable authority | Current shared local key/token scope | Purpose-separated keys, issuer/audience/generation/expiry/max-use and revocation | AAS-024 |
| Rollback or cleanup worsens incident | Missing provider compensation and broad cleanup | Fresh separately authorised typed compensation; uncertain ownership refuses deletion | AAS-022 |
| Correctly pinned but malicious artifact runs with credentials | Current checks lack signer/provenance/content trust | Unverified/revoked artifact remains inactive or quarantined | AAS-025 |
| Safety unit tests pass while composition fails | Boundary transitions, concurrency and restarts | Byte/config-bound invariant, fault, fuzz and mutation evidence | AAS-030 |

### 3.4 Conservative assumptions

Admin AI is treated as a compromised-capable delegated planner, not a trusted
principal. Provider and document content is hostile data. Unknown scope,
classification, identity, time, budget, generation, reconciliation or stop
state denies. Local deterministic evidence can authorize only a local
deterministic claim. These assumptions are reversible at contract boundaries;
review them when production identity, multi-tenancy, a live model, or a live
provider becomes an authorized workstream.

## 4. Exhaustive integrated gap inventory

The durable backlog contains 34 controls. This table maps every validated scout
gap to a stable control and classifies its Canon relationship.

| ID | Integrated control | Source coverage | Canon mapping | Type | Priority / importance |
| --- | --- | --- | --- | --- | --- |
| AAS-001 | Contain setup-repair filesystem effects | SEC-01 | CM-CAN-03/04/05/08/11 | **Canon defect** | P0 / I5 current defect |
| AAS-002 | Policy self-protection and generation fence | SEC-CTL-001 | CM-CAN-02/03/08/14/17 | Primitive | P0 / I5 |
| AAS-003 | Effective-rights compiler and permission X-ray | SEC-CTL-002 | CM-CAN-04/11/14 | Primitive | P0 / I5 |
| AAS-004 | Independent revoke and emergency freeze | SEC-05, SEC-CTL-003 | CM-CAN-04/07/08/13; Administration | **Canon extension** | P0 / I5 |
| AAS-005 | Atomic cumulative authority budgets | SEC-CTL-004, budget portion SEC-11 | CM-CAN-04/08/11/12 | **Canon extension** | P0 / I5 |
| AAS-006 | Crash-safe effect state and reconciliation | SEC-04, SEC-CTL-006 | CM-CAN-10/11/12 | **Canon defect** for current AUTO_GRANT; primitive otherwise | P0 / I5 |
| AAS-007 | Separate requester/Agent/approver/operator identities | SEC-02 | CM-CAN-02/04/05/07/14 | Primitive | P0 / I5 |
| AAS-008 | One closed effect broker for powerful capabilities | SEC-03, part SEC-CTL-005 | CM-CAN-01/03/04/05/08/09 | Primitive | P0 / I5 |
| AAS-009 | Prompt/tool-injection trust boundary | SEC-06 | CM-CAN-01/03/05/08/09 | **Canon extension** | P0 / I5 |
| AAS-010 | Tenant, row, field and data-purpose isolation | SEC-07 | CM-CAN-04/05/09 | **Canon extension** | P0 / I5 |
| AAS-011 | Management-plane/effect-plane separation | SEC-CTL-005 | CM-CAN-02/08/14/17; Administration | **Canon extension** | P0 / I5 |
| AAS-012 | Capability/action catalogue, inactive by default | SEC-CTL-008 | CM-CAN-01/03/15/17 | Primitive | P1 / I4 |
| AAS-013 | Effect-free Policy simulator | SEC-CTL-007 | CM-CAN-01/06/08/11/16 | Extension | P1 / I4 |
| AAS-014 | Typed intent and deterministic Policy compiler | SEC-CTL-009 | CM-CAN-01/02/05/06 | Extension | P1 / I4 |
| AAS-015 | Narrow bounded exception overlays | SEC-CTL-010 | CM-CAN-04/07/14/17 | Extension | P1 / I4 |
| AAS-016 | Authoritative approval Diff, routing and step-up | SEC-08, SEC-CTL-011 | CM-CAN-02/06/07/08/11 | **Canon defect** for current material Diff; primitive/identity extension otherwise | P1 / I4 |
| AAS-017 | Complete signed Policy lifecycle | SEC-09 | CM-CAN-02/03/14/17 | Primitive | P1 / I4 |
| AAS-018 | Attenuating delegation lineage | SEC-10, SEC-CTL-017 | CM-CAN-02/04/05/14 | Extension | P1 / I4 |
| AAS-019 | Runtime resource, rate and attention budgets | remaining SEC-11 | CM-CAN-04/07/11 | Extension | P1 / I4 |
| AAS-020 | Privacy-bound untrusted memory and provenance | SEC-12 | CM-CAN-05/11/16 | Extension | P1 / I4 |
| AAS-021 | Provider authentication and network enforcement | SEC-13 | CM-CAN-04/08/09/10/11 | Primitive plus extension | P1 / I4 |
| AAS-022 | Separately authorised compensation/rollback/cleanup | SEC-14 | CM-CAN-10/11/13 | Primitive | P1 / I4 |
| AAS-023 | Protected audit timeline and deterministic explanation | SEC-15, SEC-CTL-013 | CM-CAN-05/10/14/16/17; Administration | Extension | P1 / I4 |
| AAS-024 | Key, credential and authority-token lifecycle | SEC-16 | CM-CAN-04/07/09/17 | Primitive | P1 / I4 |
| AAS-025 | Supply-chain provenance and runtime artifact trust | SEC-17 | CM-CAN-15/16/17 | Extension | P1 / I4 |
| AAS-026 | Schedule and maintenance-window control | SEC-CTL-012 | CM-CAN-03/04/07/11/17 | Extension | P1 / I4 |
| AAS-027 | Data/egress envelope at adapter boundary | SEC-CTL-014, data-flow part SEC-03/07/13 | CM-CAN-04/05/08/09 | Primitive plus adapter extension | P1 / I4 |
| AAS-028 | Guided onboarding and safety templates | SEC-CTL-015 | CM-CAN-02/03/14/15/16/17 | Extension | P2 / I3 |
| AAS-029 | Profile/Policy version Diff and migration | SEC-CTL-016 | CM-CAN-03/14/16/17 | Primitive | P2 / I3 |
| AAS-030 | Boundary-composition adversarial assurance | SEC-18 | CM-CAN-16/17 | Primitive; recurring guard | P2 / I3 |
| AAS-031 | Audit export, retention and independent attestation | SEC-CTL-018, export portion SEC-15 | CM-CAN-10/16/17 | Extension | P2 / I3 |
| AAS-032 | Natural-language Policy drafting only | SEC-CTL-019 | CM-CAN-01/02/05 | Extension constrained to non-authoritative drafts | P3 / I2 |
| AAS-033 | Cross-organisation Policy federation | SEC-CTL-020 | CM-CAN-02/04/14/17 | Extension | P3 / I2 |
| AAS-034 | Advisory autonomous Policy optimisation | SEC-CTL-021 | CM-CAN-01/02/14/17 | Extension; self-activation prohibited | P3 / I2 |

Coverage is complete: security scout `SEC-01` through `SEC-18` and Canon/UX
scout `SEC-CTL-001` through `SEC-CTL-021` each appear at least once. Overlaps
remain visible in the source-coverage column so a merge cannot erase a threat
or acceptance boundary.

## 5. Importance-first complexity matrix

Priority is a delivery band, not a formula that trades safety for convenience.
Ordering is lexicographic:

1. current exploitable Canon defect;
2. importance (`I5` before `I4` before `I3` before `I2`);
3. internally ready before externally blocked at equal importance, without
   lowering the blocked item's priority;
4. risk reduction and prerequisite value;
5. lower complexity and fewer dependencies only as final tie-breakers.

| Importance | S | M | L | XL |
| --- | --- | --- | --- | --- |
| I5 critical | AAS-002 | AAS-001, AAS-003 | AAS-004, AAS-005, AAS-007, AAS-009, AAS-011 | AAS-006, AAS-008, AAS-010 |
| I4 high | AAS-012, AAS-013 | AAS-014, AAS-015, AAS-018, AAS-019, AAS-021, AAS-024, AAS-026 | AAS-016, AAS-017, AAS-020, AAS-023, AAS-025, AAS-027 | AAS-022 |
| I3 medium | — | AAS-028, AAS-029, AAS-030 | AAS-031 | — |
| I2 low | — | — | — | AAS-032, AAS-033, AAS-034 |

`AAS-001` stays first even though `AAS-002` is smaller: it is a validated
current write-boundary defect. Likewise no I4 onboarding or simulator work may
displace an internally actionable I5 control merely because it demos faster.

## 6. Evidence-gated implementation and demo roadmap

### Phase 0 — close the present boundary defect

Implement `AAS-001` alone under WIP=1. Reconstruct repair actions from
server-owned observations and plans, use component-safe/descriptor-relative
containment, and bind approval to the reconstructed plan. Required evidence is
an exploit-shaped traversal/sibling-prefix/separator/symlink/TOCTOU matrix,
proof that only the declared config changes, focused tests, full relevant
regression tests and a clean commit.

Rollback boundary: revert the implementation commit and keep repair disabled;
never restore acceptance of caller-supplied executable paths. Demo claim:
“these local fixtures cannot escape the owned setup root.” It is not a
host/kernel or arbitrary-filesystem sandbox claim.

### Phase 1 — visible safety truth

Implement `AAS-002`, `AAS-003`, `AAS-012` and `AAS-013` as separate WIP=1
slices: generation-fenced activation, effective-rights facts/reason codes, a
finite inactive catalogue and an effect-free simulator. Frozen simulator and
live evaluator inputs must produce the same decision facts. Simulation must
issue no lease, load no credential and touch no provider.

Rollback boundary: retain the last-known-safe Policy/catalogue version and
disable the new read-only surfaces. Negative probes cover unknown/conflicting
operands, stale generations, schema extras, inactive adapters and simulated
authority/effects. Demo claim remains a deterministic local decision preview,
not provider-outcome prediction.

### Phase 2 — stop and bound campaigns

Implement locally provable portions of `AAS-004`, `AAS-005`, `AAS-006`,
`AAS-019` and `AAS-026`: stop epochs at the gate, atomic reservations, a
crash-safe state machine, ambiguity quarantine, deadlines and schedules.
Concurrency barriers and kill/restart fault points must prove at-most-one
effect and no budget overspend. A valid lease must fail after freeze or window
close; restart must preserve the fail-safe state.

Rollback boundary: disable effect dispatch and migrate back only from an
explicitly verified state snapshot. Unknown/ambiguous reservations stay
quarantined rather than being freed. No claim of distributed budget accuracy,
independent stop availability or universal provider idempotency is allowed
without the corresponding external services and provider evidence.

### Phase 3 — authority, data and management perimeter

Develop contracts/fixtures for `AAS-007` through `AAS-011`, `AAS-016`,
`AAS-017`, `AAS-021`, `AAS-024` and `AAS-027`; move externally dependent items
to `blocked_external` when local evidence is exhausted. Required negative
evidence includes self-approval, forged/downgraded identity, cross-tenant
references, direct provider/OS calls, injected URL/path/field, stale Policy or
stop caches, wrong token purpose/audience/generation, redirect/rebinding/proxy
bypass and malicious tool output.

Rollback boundary: keep powerful adapters, live models, real data and broad
network paths inactive. Fall back to the current closed synthetic actions, not
to an unbrokered tool runner. Production IAM, multi-tenant isolation, network
enforcement, key custody and management-plane independence remain external
gates until independently evidenced.

### Phase 4 — sustainable Owner policy and recovery

Implement `AAS-014`, `AAS-015`, `AAS-018`, `AAS-020`, `AAS-022`, `AAS-023`,
`AAS-025`, `AAS-028`, `AAS-029` and `AAS-031`. Intent compiles
deterministically or asks/denies; exceptions only attenuate the Owner ceiling;
delegation chains only narrow; memory remains labelled data; compensation
requires fresh authority and current-state Diff; audit explanations derive
from protected facts; template updates cannot silently expand rights.

Rollback boundary: version every contract, keep prior safe readers during
migration, refuse irreversible downgrade, and disable affected features if
provenance/audit/compensation evidence is missing. Demos must visibly label
irreversible and ambiguous states. Do not claim tamper-proof audit, universal
rollback, safe live memory, or supply-chain assurance beyond the exact bytes
and trust evidence tested.

### Phase 5 — recurring assurance and low-priority frontier

`AAS-030` is a recurring guard, not a reason to reopen completed feature
items. Add a control/invariant manifest, schema fuzzing, transaction fault
injection, concurrency/restart suites, and mutation checks proving that removal
of each use-time protection fails a named test. Consider `AAS-032` through
`AAS-034` only after the higher-importance boundary is evidenced. Natural
language may draft typed intent but never become authority; federation and
optimisation remain inactive/advisory until separately authorised.

An empty candidate frontier is not completion. It triggers a frontier audit of
new capabilities, adapters, data, identities, threats, Canon changes and claim
expansion plus negative evidence that no uncovered internally actionable gap
exists.

## 7. Demo evidence pack

Every completed slice must attach: exact baseline/head; changed contracts and
effect boundary; positive acceptance evidence; exploit-shaped negative probes;
focused and regression command results; rollback/fallback; remaining external
gates; and an honest claim/non-claim statement.

The first demonstrable sequence is:

1. repair traversal and symlink attempts leave canaries byte-identical;
2. permission X-ray explains allow/escalate/deny from the same frozen facts as
   the live evaluator;
3. simulation produces no authority or provider access;
4. a concurrent final budget unit yields at most one dispatch;
5. emergency freeze beats an already valid approval and survives restart;
6. timeout-after-apply quarantines retry until bound reconciliation;
7. a hostile document/title/tool error cannot add an action or reveal a secret;
8. a missing/tampered audit link renders the result unverified, never success.

## 8. Honest non-claims and go/no-go verdict

This 5/5 analysis authorizes local backlog implementation only. It does not
establish a live or safely sandboxed generative model; production IAM/MFA or
separation of duties; real multi-tenant/data-purpose isolation; hostile-host,
kernel, Docker-daemon or hypervisor containment; a production secret broker,
egress proxy or DLP service; distributed atomic budgets; an independently
available stop service; universal provider idempotency/reconciliation/rollback;
tamper-proof external audit; signed supply-chain provenance; regulatory
compliance; or production fitness.

**Go:** local, reversible, evidence-gated implementation of the highest-ranked
internally ready P0, one writer/artifact at a time.

**No-go without new authorization/evidence:** external push, PR, merge, tag,
release or publication; credentials; live-provider claims; production or
infrastructure changes; widening the current runtime to live models, real data
or unbrokered tools.

## 9. PDCA decision record

- **Plan:** confine an Admin AI with shared typed controls and a small Owner
  mental model, ordered by importance before complexity.
- **Do:** integrate both scouts into 34 stable controls and evidence gates.
- **Check:** the Canon's composition is strong, but six normative areas need
  clarification and two current paths need defect treatment (`AAS-001` and the
  AUTO_GRANT portion of `AAS-006`; the material Diff portion of `AAS-016` is a
  further correctness defect before real material approval).
- **Act:** start `AAS-001`; after every completion rerun the relevant threat
  model, discover gaps, reprioritize the ready frontier, and record the exact
  evidence/non-claims. Keep recurring guards separate from finished feature
  items.

Review marker: revisit this verdict whenever a capability, adapter, identity
source, data class, provider, deployment boundary, model/memory source, Policy
schema or public claim changes.
