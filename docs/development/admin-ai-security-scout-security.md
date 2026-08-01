# ChimpMaera Admin-AI security-gap scout

Status: security backlog analysis at commit `47da5ac` on
`feat/admin-ai-security-analysis-backlog` (2026-08-01). This document is an
engineering scout, not a security certification or a production-authority
claim.

## Scope and ranking rule

This review covers the actual Canon, architecture and known-limit claims; the
Admin-AI request/decision path; Approval Workbench; `PolicyEvaluator`; the
effect boundary; setup/repair authority; provider and Paperless adapters;
runtime isolation; contracts; supply-chain checks; and focused tests.

Importance strictly determines rank. Complexity is only a delivery estimate
and never promotes a less important item above a more important item. Within
one importance band, current exploitability and prerequisite order break ties.

- **Importance:** Critical = a production blocker or a current route to
  authority/boundary compromise; High = required before broadening effects or
  handling real data; Medium = defense-in-depth after higher-impact boundaries.
- **Complexity:** S, M, L and XL are relative implementation sizes only.
- **Canon primitive:** directly required by an existing Canon principle.
- **Canon extension:** a new normative primitive is needed because the Canon
  does not say enough about the hazard.
- **Canon defect:** current executable behavior fails an already-applicable
  Canon primitive. A disclosed non-claim is not by itself a defect.

## Evidence-backed current baseline

The backlog should preserve these controls rather than replace them:

- The Canon separates capability from authority, requires closed inactive
  actions, binds effects to identity and semantics, and places use-time checks
  outside the Agent (`docs/CANON.md:53-74`, `docs/CANON.md:84-140`).
- Admin-AI has two exact, fixed mutations and maps all other request kinds to a
  deny-only intent (`demo/runtime/admin-ai-poc.mjs:43-66`,
  `demo/runtime/admin-ai-poc.mjs:106-177`). The enforcement gate reconstructs
  those exact actions and rejects drift (`demo/runtime/enforcement-gate.mjs:73-127`).
- `PolicyEvaluator` accepts an exact neutral input and trusted policy context,
  returns decision data with `CHIMPMAERA_GATE_ONLY`, and has no authority field
  (`demo/runtime/policy-evaluator.mjs:34-77`,
  `demo/runtime/policy-evaluator.mjs:110-175`). Its tests reject extra fields,
  forged authority and an evaluator that exceeds the action-adapter ceiling
  (`tests/demo-policy-evaluator.test.mjs:68-93`,
  `tests/demo-policy-evaluator.test.mjs:95-180`).
- An owner escalation binds the proposal, action, business Diff, policy and
  profile generations; the lease is short and one-use
  (`demo/runtime/approval-workbench.mjs:84-148`,
  `demo/runtime/enforcement-gate.mjs:427-540`). The gate durably consumes that
  lease before provider access and marks uncertain results ambiguous
  (`demo/runtime/enforcement-gate.mjs:604-627`,
  `demo/runtime/enforcement-gate.mjs:651-693`). Concurrency, restart, expiry,
  tamper and semantic-readback negatives exist
  (`tests/demo-approval-workbench.test.mjs:234-389`).
- Provider credentials are loaded only in the runtime and inserted at the
  provider boundary (`demo/runtime/server.mjs:124-164`,
  `demo/runtime/enforcement-gate.mjs:698-775`). The container is read-only,
  capability-dropped, non-root/no-new-privileges and has no Docker socket
  (`docs/ARCHITECTURE.md:17-24`, `demo/compose.yaml:20-26`).
- The Paperless seam fixes its origin, method and path family, caps response
  bytes/results, sanitizes fields and emits a redacted digest receipt; it is
  disabled in the stock runtime (`demo/runtime/paperless-ngx-zoo-adapter.mjs:9-10`,
  `demo/runtime/paperless-ngx-zoo-adapter.mjs:66-188`,
  `docs/ARCHITECTURE.md:58-63`).
- Claims correctly disclose that production IAM, hostile-host protection,
  revoke/rollback, live LLMs, real data, immutable audit and supply-chain
  provenance are absent (`docs/KNOWN-LIMITATIONS.md:6-33`, `SECURITY.md:3-7`).

## Coverage map

| Required area | Backlog controls |
| --- | --- |
| Identity, authority, approvals | SEC-02, SEC-05, SEC-08, SEC-16 |
| Capabilities, tools, actions, resources and fields | SEC-01, SEC-03, SEC-07 |
| Data, network, filesystem, process and runtime | SEC-01, SEC-03, SEC-07, SEC-11, SEC-13 |
| Prompt/tool injection | SEC-06 |
| Delegation | SEC-10 |
| Budgets | SEC-11 |
| Transaction, idempotency, reconciliation and rollback | SEC-04, SEC-14 |
| Memory, provenance and provider trust | SEC-12, SEC-13 |
| Supply chain and audit | SEC-15, SEC-17 |
| Emergency stop and policy lifecycle | SEC-05, SEC-09 |
| Multi-tenant isolation | SEC-07 |

## Ranked missing controls

### 1. SEC-01 — Close the setup-repair filesystem escape

**Importance: Critical. Complexity: M. Classification: Canon defect
(CM-CAN-03/04/05/08/11).**

**Evidence and threat.** Repair-plan verification accepts any target whose
string starts with the owned root, while the coordinator resolves that target
and writes it (`packages/contracts/src/poc-early-admin-ai-setup.ts:709-729`,
`packages/setup-coordinator/src/index.ts:147-174`). The plan digest is an
unkeyed digest, not authority. A caller holding the shared local bearer can
submit a modified plan with a recomputed digest and a target such as
`<owned-root>/../../owner-authority.key`; lexical prefix acceptance can escape
into sibling state. The same caller supplies `ownerConfirmed: true`
(`packages/setup-coordinator/src/index.ts:414-422`). This can overwrite files
within the runtime's writable state volume, including authority or evidence
state.

**Required control and acceptance.** Rebuild the executable repair action from
the observed issue and server-owned plan; do not execute caller-supplied target,
capability, materiality or rollback fields. Resolve the target under an opened,
server-owned root, reject `..`, absolute paths, separator variants, symlinks and
non-regular destinations, and verify containment with path components or
descriptor-relative operations. Approval must bind the server-reconstructed
plan. Exactly the declared config file may change.

**Negative tests.** Recomputed digests with `../`, sibling-prefix collisions,
absolute paths, Unicode/separator variants, symlink swaps and TOCTOU swaps all
fail before open/write; `ownerConfirmed: true` does not help; authority key,
effect store, audit log and out-of-root canaries remain byte-identical.

**Dependencies.** None. Fix before adding any new filesystem or repair action.

### 2. SEC-02 — Separate requester, Admin-AI, approver and operator identities

**Importance: Critical. Complexity: L. Classification: Canon primitive
(CM-CAN-02/04/05/07/14).**

**Evidence and threat.** One local API bearer authenticates Admin-AI request,
owner decision, effects and receipt access; the server then assigns the owner
actor constant itself (`demo/runtime/server.mjs:289-337`,
`demo/runtime/server.mjs:372-400`). The known limitations explicitly say that
the bearer stands in for owner identity (`docs/KNOWN-LIMITATIONS.md:21-24`). A
compromised browser, agent client or bearer can therefore approve its own
proposal; there is no workload identity, human session, MFA, role separation,
assurance level or tenant membership.

**Required control and acceptance.** Authenticate workload and humans through
separate credentials and trust paths. Derive immutable subject, organisation,
tenant, role, authentication method/level and session ID at the boundary. Enforce
deny-by-default RBAC/ABAC, separation of duties, recent step-up authentication
for material decisions, and an explicit rule that a requester/agent/delegate
cannot approve its own action. Bind all of those facts into proposal, lease and
receipt; support identity disable and session revocation.

**Negative tests.** Agent credentials, requester credentials, a different
tenant, expired/disabled sessions, downgraded authentication, forged headers,
confused-deputy calls and the same person in conflicting roles cannot approve
or execute. A valid approver cannot alter the bound requester or tenant.

**Dependencies.** Production IAM adapter, owner/account lifecycle and SEC-07.

### 3. SEC-03 — Put every powerful capability behind one closed effect broker

**Importance: Critical. Complexity: XL. Classification: Canon primitive
(CM-CAN-01/03/04/05/08/09).**

**Evidence and threat.** The provider-mutation path is closed, but the broader
authority-profile contract describes shell, filesystem, process/service,
package, network, module, configuration and control-plane rights, including a
`FULL_CONTROL_LAB` mode with no ChimpMaera gates
(`packages/contracts/src/poc-early-admin-ai-setup.ts:214-223`,
`packages/contracts/src/poc-early-admin-ai-setup.ts:467-523`). The generic
profile check returns true for every full-control action and otherwise checks
only caller-supplied `declared` and `material` booleans
(`packages/contracts/src/poc-early-admin-ai-setup.ts:555-565`). These contracts
are status/decision logic, not an OS-level broker. Adding an LLM or tool runner
behind them would create generic escape routes around the strong provider gate.

**Required control and acceptance.** Establish a versioned capability registry
and the sole credentialed dispatcher for tool, action, resource, field, data,
network, filesystem, process/service, package/module, configuration and
control-plane effects. Each adapter has a closed schema, semantic version and
digest, inactive-by-default activation, exact resource/field allowlists,
preconditions, maximum effects, timeout and readback contract. The effective
right is the intersection of owner profile, subject, tenant, policy generation,
capability activation, data classification, runtime sandbox and current stop
state. Remove or physically isolate generic shell/raw HTTP/arbitrary path and
dynamic module execution from production profiles.

**Negative tests.** Unknown adapter/action/field, schema extras, raw command,
path or URL, runtime-loaded plugin, policy output that invents a capability,
credential reference drift and direct provider/OS calls all produce zero
effects. Installing/cataloguing an adapter leaves it inactive.

**Dependencies.** SEC-02, SEC-05, SEC-07, SEC-09 and SEC-11.

### 4. SEC-04 — Make replay state crash-safe and add authoritative reconciliation

**Importance: Critical. Complexity: XL. Classification: Canon defect for the
AUTO_GRANT/current non-owner path; Canon primitive for all effects
(CM-CAN-10/11/12).**

**Evidence and threat.** Owner leases are reserved before mutation, but
`AUTO_GRANT` and installer effects call the provider before any durable replay
reservation and persist success only after mutation and readback
(`demo/runtime/enforcement-gate.mjs:604-649`,
`demo/runtime/enforcement-gate.mjs:651-680`). A crash after provider commit but
before local persistence permits a duplicate on retry. Owner failures become
`AMBIGUOUS`, but there is no reconciliation API or state transition; the known
limit tells the operator to obtain a new decision after provider reconciliation
without implementing that reconciliation (`docs/KNOWN-LIMITATIONS.md:25-27`).

**Required control and acceptance.** Use one durable state machine for every
effect: prepared, executing, provider-accepted, readback-verified, applied,
ambiguous, reconciled or compensated. Persist intent before access, pass a
provider idempotency key where supported, make state changes transactional with
fencing/locking, and reconcile by authoritative natural key/object ID before
any retry. A retry of identical content returns the original result; changed
content conflicts; ambiguous work cannot execute until reconciliation records
a bound conclusion.

**Negative tests.** Kill/restart at every persistence, network and provider
boundary; concurrent workers; lost response after commit; stale lock; readback
timeout; provider duplicate/mismatched natural key. Across all schedules there
is at most one effect and no false success receipt.

**Dependencies.** Provider-specific idempotency/readback contracts, durable
storage and SEC-13.

### 5. SEC-05 — Add independently enforced revoke and emergency stop

**Importance: Critical. Complexity: L. Classification: Canon primitive
(CM-CAN-04/07/13 and Administration).**

**Evidence and threat.** There is no provider revoke service. The network
manifest calls its kill switch only “prepared,” and the local stop is described
as removing network attachments (`demo/manifests/network/local-egress-policy-v1.json:36-46`).
The profile warning correctly notes that an Admin-AI with host rights could
damage audit and emergency controls (`packages/contracts/src/poc-early-admin-ai-setup.ts:214-223`).
Process-generation rotation invalidates short owner leases on restart, but
AUTO_GRANT authority has no expiry/generation binding
(`demo/runtime/enforcement-gate.mjs:361-425`).

**Required control and acceptance.** Provide an owner-controlled stop plane
outside Agent credentials and writable state. It atomically blocks new plans,
authority issuance and use-time execution; revokes subject, tenant, capability,
adapter, credential and policy generations; cuts egress/worker dispatch; and
records who stopped/resumed, why and when. Use-time enforcement reads a durable,
fresh stop epoch. Recovery requires stronger authorization than activation and
does not silently resume queued work.

**Negative tests.** Stop between approval and use, between reservation and
provider call, and during queued/delegated work; every not-yet-started effect is
denied. A compromised Agent or full-control worker cannot clear the stop,
rotate away the record or delete its evidence. Stale caches fail closed.

**Dependencies.** Independent control-plane identity/storage and SEC-02.

### 6. SEC-06 — Define a prompt/tool-injection trust boundary before enabling an LLM

**Importance: Critical. Complexity: L. Classification: Canon extension backed
by CM-CAN-01/03/05/08/09.**

**Evidence and threat.** The current Admin-AI is deterministic and has no live
LLM (`docs/KNOWN-LIMITATIONS.md:28-29`), so prompt injection is presently
non-applicable. Provider fields nevertheless already cross into runtime
readbacks, and Paperless titles are returned as strings
(`demo/runtime/paperless-ngx-zoo-adapter.mjs:18-43`). Once any model can read
CRM, document, web, memory or tool output, hostile content can impersonate
instructions, request secrets, alter tool arguments or induce approval fatigue.

**Required control and acceptance.** Mark every input with origin, trust,
tenant, data class and instruction eligibility. Provider/document/tool content
is data only and cannot modify system policy, trusted context, tool registry or
approval bindings. Models produce only typed candidate plans; deterministic
code reconstructs and authorizes actions. Secrets are represented by opaque
handles unavailable to the model. Isolate model/provider contexts, minimize
tool results, and require an injection-safe approval view that shows external
data separately from trusted instructions.

**Negative tests.** Malicious contact names, document titles/content, tool
errors, memory entries and model-provider responses containing override,
exfiltration, self-approval, URL/path, hidden Unicode and encoded instructions
cannot change outcomes, reveal secrets or add calls. The same attack is run
across indirect, multi-turn and tool-result channels.

**Dependencies.** SEC-03, SEC-08, SEC-12 and a threat-reviewed model gateway.

### 7. SEC-07 — Enforce tenant, row, field and data-purpose isolation

**Importance: Critical. Complexity: XL. Classification: Canon extension backed
by CM-CAN-04/05/09.**

**Evidence and threat.** Tenant is currently the fixed string
`panskys-zoo-demo` in intent and action checks
(`demo/runtime/admin-ai-poc.mjs:58-64`,
`demo/runtime/policy-evaluator.mjs:54-67`). Provider credentials are broad admin
credentials, and the generic provider-read endpoint accepts broad entity paths
and arbitrary query keys before returning raw values
(`demo/runtime/server.mjs:150-156`, `demo/runtime/server.mjs:339-369`). A tenant
label in a signed scope does not prove provider-side tenant ownership. Real
data or multiple organisations would allow cross-tenant reads/effects and
over-collection.

**Required control and acceptance.** Derive tenant from authenticated identity,
never from model/caller text. Partition credentials, provider accounts,
queues, replay keys, approval/effect stores, memory, encryption keys and audit
indexes by tenant. Resolve each resource through a server-owned tenant mapping
and verify ownership in authoritative readback. Add row predicates, field
allowlists/masks, data classifications, purpose/legal-basis tags, retention and
export/delete policy. Deny unknown classification or missing tenant mapping.

**Negative tests.** Cross-tenant IDs, replay keys, approvals, object references,
search queries, cached results, memory retrieval and receipt lookups fail with
indistinguishable errors and zero provider access. Sensitive/unknown fields
never reach model, logs or receipts; confused-deputy credentials cannot cross
tenant partitions.

**Dependencies.** SEC-02, provider tenancy model and privacy design.

### 8. SEC-08 — Make approval views authoritative, fresh and non-coercible

**Importance: High. Complexity: L. Classification: Canon defect for the current
material Diff (CM-CAN-06/07/11).**

**Evidence and threat.** The material order Diff says that no order “is
required to exist”; it is constructed from constants rather than an
authoritative pre-effect read (`demo/runtime/admin-ai-poc.mjs:88-103`). The
proposal binds that text, but not a prior-state readback version/ETag
(`demo/runtime/approval-workbench.mjs:84-148`). An approver can authorize a
stale or incomplete transition after provider state changes. There is also no
risk-tiered quorum, reason, comment, delegation display or approval-rate guard.

**Required control and acceptance.** Build the human Diff from a bounded,
authoritative prior-state snapshot with object version/ETag and captured time;
bind purpose, requester/delegation chain, exact fields, side effects, data
classes, budget impact, policy/version and rollback availability. Revalidate
snapshot/version and materiality immediately before use. Require reason,
step-up and optional quorum/separation according to risk; expire stale
proposals and rate-limit prompts.

**Negative tests.** State/ETag, material field, risk class, side effect,
requester, tenant, policy or approver changes after display deny execution and
require a fresh Diff. Hidden/truncated/ambiguous fields, clickjacking, rapid
repeat prompts and approve-after-reject cannot issue authority.

**Dependencies.** SEC-02, provider snapshot support, SEC-11 and SEC-14.

### 9. SEC-09 — Govern the complete policy lifecycle

**Importance: High. Complexity: L. Classification: Canon primitive
(CM-CAN-02/03/14/17).**

**Evidence and threat.** The runtime accepts one startup file whose bytes match
an environment digest, one semantic policy shape and generation `1`
(`demo/runtime/server.mjs:67-84`, `demo/runtime/server.mjs:166-192`). This proves
startup consistency, not who authored/approved the policy, whether it is
current, or how activation, revocation, migration and rollback occur. Anyone
who controls both bytes and expected environment digest controls policy.

**Required control and acceptance.** Add signed policy bundles with issuer,
owner approval, change request, semantic Diff, risk review, schema/action
compatibility, monotonically increasing generation, validity interval and
revocation. Separate draft, validate, simulate, approve, stage, activate,
supersede and retire. Use two-person control for authority widening, canary and
rollback gates, an explicit fallback policy, and receipts binding the active
bundle and trust roots. New fields/actions remain inactive after upgrade.

**Negative tests.** Unsigned, expired, rollbacked, duplicate-generation,
wrong-tenant, incompatible-schema, widened-without-approval and trust-root-drift
policies refuse activation and use. Partial rollout and stale worker caches
cannot mix generations.

**Dependencies.** SEC-02, SEC-03, signing/trust service and migration tooling.

### 10. SEC-10 — Bound delegation and sub-agent authority

**Importance: High. Complexity: M. Classification: Canon extension backed by
CM-CAN-02/04/05/14.**

**Evidence and threat.** The implementation has one constant Agent actor and no
delegation contract (`demo/runtime/admin-ai-poc.mjs:10-12`,
`demo/runtime/admin-ai-poc.mjs:26-40`). The Canon permits delegated
administration only within an owner envelope (`docs/CANON.md:196-204`) but does
not define chain depth, attenuation or accountability. Future sub-agents could
launder identity, amplify combined rights or evade per-agent limits.

**Required control and acceptance.** Represent delegation as an owner-rooted,
signed, acyclic chain binding delegator/delegate, tenant, exact capabilities,
resources/fields/data, purpose, depth, time, budget and redelegation flag. Every
hop must attenuate rights; effective authority is the intersection of all hops
and current policy. Bind the full chain digest to plans, approvals, effects and
audit, with cascade revocation and accountable human/workload subjects.

**Negative tests.** Cycles, missing hops, identity substitution, sibling-token
reuse, broader child scope, budget reset, cross-tenant delegation, excess depth,
expired/revoked ancestors and prohibited redelegation all fail at issuance and
use.

**Dependencies.** SEC-02, SEC-05, SEC-07 and SEC-11.

### 11. SEC-11 — Enforce cumulative budgets and runtime resource limits

**Importance: High. Complexity: M. Classification: Canon extension backed by
CM-CAN-04/07/11.**

**Evidence and threat.** A policy decision carries only `maximumEffects` 0/1
per decision (`demo/runtime/policy-evaluator.mjs:110-126`). Requests are capped
at 256 KiB, but provider fetches have no timeout, streamed-byte cap or
cancellation (`demo/runtime/server.mjs:194-207`,
`demo/runtime/enforcement-gate.mjs:716-724`). Compose sets a small `/tmp` but no
CPU, memory, PID or worker concurrency limits (`demo/compose.yaml:20-31`). An
Agent can generate many valid actions, consume approval attention, hang workers
or incur unbounded model/tool/provider cost.

**Required control and acceptance.** Atomically reserve and charge hierarchical
budgets per owner/tenant/subject/delegation/capability and time window: effects,
tool/model calls, tokens, money, rows/bytes, wall/CPU time, concurrency, retries,
approval prompts and storage. Bind budget ID/epoch and remaining ceiling to
authority and receipts. Add deadlines, cancellation, response streaming caps,
queue backpressure, circuit breakers and container CPU/memory/PID limits.

**Negative tests.** Parallel requests cannot overspend; restart/retry/delegation
cannot reset a budget; timeout and oversized/chunked responses abort without
success; retry storms and approval spam are throttled; stop/revoke cancels
reservations safely.

**Dependencies.** Durable accounting, SEC-04, SEC-05 and SEC-10.

### 12. SEC-12 — Treat memory and provenance as untrusted, privacy-bound data

**Importance: High. Complexity: L. Classification: Canon extension backed by
CM-CAN-05/11/16.**

**Evidence and threat.** The deterministic assistant does not yet have Agent
memory. It avoids persisting question text but stores a stable unsalted digest
of it (`packages/contracts/src/poc-early-admin-ai-setup.ts:838-878`) and effect
state stores raw provider result/readback next to receipts
(`demo/runtime/enforcement-gate.mjs:239-253`,
`demo/runtime/enforcement-gate.mjs:671-680`). Low-entropy questions can be
guessed from hashes; future retrieval memory can be poisoned, cross-tenant
leaked or mistaken for trusted instruction.

**Required control and acceptance.** Define memory types and prohibit memory
from granting authority. Every entry binds tenant, subject, source object and
version, capture method/time, trust/data class, purpose, retention, consent and
integrity/provenance evidence. Apply field minimization/redaction before model
or storage; encrypt and tenant-partition; make retrieval policy-aware and
injection-labelled; support correction, deletion and provenance invalidation.
Use keyed or randomized identifiers where correlation is needed, not raw
dictionary-attackable hashes.

**Negative tests.** Poisoned or instruction-like memories remain data; wrong
tenant/purpose/expired/revoked-source entries are not retrieved; secret and
sensitive fields never appear in model context, logs or receipts; deletion and
source correction invalidate derived entries and caches.

**Dependencies.** SEC-06, SEC-07, data inventory and key management.

### 13. SEC-13 — Authenticate providers and constrain network effects

**Importance: High. Complexity: M. Classification: Canon primitive plus
extension (CM-CAN-04/08/09/10/11).**

**Evidence and threat.** CRM/ERP calls use fixed internal HTTP names with broad
credentials and no deadline or response-size cap
(`demo/runtime/enforcement-gate.mjs:698-750`). The egress manifest is
declarative and its own receipt section requires live probes before a security
claim (`demo/manifests/network/local-egress-policy-v1.json:1-10`,
`demo/manifests/network/local-egress-policy-v1.json:40-46`); tests inspect the
manifest rather than enforcing live packets (`tests/demo-local-egress-policy.test.mjs:16-53`).
The Paperless seam denies redirects and caps bytes but has no deadline
(`demo/runtime/paperless-ngx-zoo-adapter.mjs:82-119`). DNS/service compromise,
credential confused-deputy use, malicious responses and hangs can corrupt
readback or availability.

**Required control and acceptance.** Enforce egress at the runtime/network
boundary with destination identity, port/protocol/method/path ceilings, DNS/IP
rebinding defense, redirect denial and no proxy/environment bypass. Use TLS or
authenticated service identity where the threat model requires it, least-
privilege per-adapter credentials, rotation and audience binding. Validate
response content type/schema/size/time, sanitize errors, and bind provider
instance/version/trust evidence to readbacks and receipts.

**Negative tests.** Loopback/link-local/metadata, alternate DNS answer,
userinfo/IPv6 encoding, redirect, proxy variables, wrong certificate/service
identity, undeclared port/method/path, slow/chunked/oversized/malformed response
and cross-adapter credential use all fail without data leakage or false success.

**Dependencies.** Network policy enforcement, service identity/PKI, SEC-03 and
SEC-11.

### 14. SEC-14 — Implement separately authorised compensation, rollback and cleanup

**Importance: High. Complexity: XL. Classification: Canon primitive
(CM-CAN-10/11/13).**

**Evidence and threat.** Provider revoke and rollback are explicitly absent
(`docs/ARCHITECTURE.md:31-37`, `docs/KNOWN-LIMITATIONS.md:25-27`). Setup repair
records a rollback description and can create a backup, but no executable,
authorized restore operation is exposed (`packages/setup-coordinator/src/index.ts:156-174`).
Cleanup recursively removes its owned root and then writes a receipt
(`packages/setup-coordinator/src/index.ts:197-210`); rollback, revoke and cleanup
therefore remain incomplete or separate local demonstrations.

**Required control and acceptance.** Give each reversible effect a typed,
provider-specific compensation action with its own current-state Diff, fresh
authorization, idempotency key, conflict policy, readback and receipt. Model
irreversible/partially reversible effects explicitly. Cleanup must prove
ownership per resource, preserve required audit and refuse foreign/drifted
objects. Reconciliation selects retry, accept-observed-state or compensation;
it never silently calls rollback.

**Negative tests.** Rollback without fresh authority, against changed state,
wrong tenant/owner, already compensated or irreversible effect fails closed.
Partial compensation becomes ambiguous and reconcilable. Cleanup skips foreign
or ownership-uncertain resources and cannot delete audit/emergency controls.

**Dependencies.** SEC-02, SEC-04, SEC-07, SEC-08 and provider contracts.

### 15. SEC-15 — Make audit independently tamper-evident and operationally useful

**Importance: High. Complexity: L. Classification: Canon extension backed by
CM-CAN-05/10/16 and Administration.**

**Evidence and threat.** Approval/effect stores validate canonical SHA-256
digests but are ordinary writable JSON files
(`demo/runtime/approval-workbench.mjs:189-225`,
`demo/runtime/approval-workbench.mjs:275-281`,
`demo/runtime/enforcement-gate.mjs:216-291`). A writer can modify content and
recompute unkeyed digests or delete whole records. Setup events are append-only
by convention but have neither a sequence nor signature/time
(`packages/setup-coordinator/src/index.ts:229-252`). Tests mutate one field
without recomputing its digest, so they do not prove resistance to a state
writer (`tests/demo-approval-workbench.test.mjs:391-420`).

**Required control and acceptance.** Emit a schema-versioned, ordered event for
authentication, plan, policy evaluation, approval, lease, budget, delegation,
effect, readback, ambiguity, reconciliation, revoke, stop, rollback and policy
change. Bind subject/tenant/correlation IDs and trusted time. Hash-chain and
sign events with a key unavailable to workers, replicate/anchor them to
append-only storage outside Agent authority, monitor sequence gaps and support
privacy retention/redaction without destroying integrity evidence.

**Negative tests.** Edit-and-rehash, deletion, truncation, reorder, duplicate,
fork, stale signer, clock rollback and worker-root compromise are detected by
an independent verifier/alert. Secret and disallowed personal fields never
enter audit.

**Dependencies.** Independent audit sink/signing service, SEC-02 and SEC-16.

### 16. SEC-16 — Add key, credential and authority-token lifecycle controls

**Importance: High. Complexity: M. Classification: Canon primitive
(CM-CAN-04/07/09/17).**

**Evidence and threat.** The owner HMAC key is generated as a file in the same
runtime state volume as authority/evidence state
(`demo/runtime/server.mjs:128-149`). The control token signs both legacy
installer approvals and Admin-AI auto-grants
(`demo/runtime/enforcement-gate.mjs:354-375`), and auto-grant authority has no
expiry, max-use, profile/policy generation or key ID
(`demo/runtime/enforcement-gate.mjs:361-425`). Key theft gives offline signing;
rotation cannot identify or revoke a specific generation cleanly.

**Required control and acceptance.** Separate authentication, approval,
AUTO_GRANT and owner-lease keys; store signing keys in a non-exportable or
independently protected service; include issuer, audience, key ID, algorithm,
issued/not-before/expiry, max uses and authority/policy/profile/stop generations
in every token. Implement rotation, overlap, revocation, compromise response,
backup/recovery and zeroization. Use narrow provider credentials per adapter and
tenant; never return reusable authority tokens from read APIs after use.

**Negative tests.** Wrong purpose/audience/key/generation, retired or compromised
key, algorithm substitution, future/expired token, copied authority across
restart/tenant/adapter and old token after stop/rotation all fail at use.

**Dependencies.** SEC-05, key management and identity infrastructure.

### 17. SEC-17 — Verify supply-chain provenance and runtime artifact trust

**Importance: High. Complexity: L. Classification: Canon extension backed by
CM-CAN-15/16/17.**

**Evidence and threat.** The verifier usefully checks pinned declarations,
lock integrity, CI SHAs and image/release closure
(`scripts/verify-supply-chain.mjs:76-183`,
`scripts/verify-supply-chain.mjs:185-246`). It explicitly does not verify
signatures, SLSA provenance, transitive SBOMs, vulnerabilities, licenses,
reproducibility or content safety (`docs/SUPPLY-CHAIN.md:15-21`). A compromised
registry/publisher or malicious-but-correctly-pinned artifact can enter the
trusted runtime and inherit credentials.

**Required control and acceptance.** Define trust policy per OCI, npm, CI,
model, prompt/template, policy and adapter artifact: approved source/maintainer,
signature/attestation identity, digest, provenance level, SBOM, license and
vulnerability threshold, review status and revocation. Verify before build,
installation, activation and restart; generate release attestations, scan the
actual resolved bytes, and quarantine unverified artifacts. Bind model/provider
and adapter versions to evidence and authority.

**Negative tests.** Valid digest with wrong signer/source, missing/forged
attestation, stale or revoked key, dependency confusion, malicious lifecycle
script, SBOM omission, disallowed CVE/license, mutable model/template and
provenance-to-byte mismatch all block activation. Offline/unavailable trust
services fail according to explicit cached-evidence expiry, never silently
allow.

**Dependencies.** Trust roots, artifact registry policy, SBOM/attestation and
vulnerability services.

### 18. SEC-18 — Expand adversarial assurance around boundary composition

**Importance: Medium. Complexity: M. Classification: Canon primitive
(CM-CAN-16/17).**

**Evidence and threat.** Current focused tests are strong for exact action,
lease tamper/expiry/replay and evaluator output, but network tests are static,
store tamper tests do not recompute digests, and there are no crash-point,
path-containment, production-identity, policy-lifecycle, multi-tenant,
injection, budget, revoke or rollback suites. Security properties can fail in
composition even while unit contracts pass.

**Required control and acceptance.** Maintain a machine-readable threat/control
matrix and invariant suite covering every effect adapter and transition. Add
property/fuzz tests for canonicalization and schemas; fault injection at every
transaction boundary; concurrent/restart tests; integration tests with real
sandbox providers/network policy/IAM; and release evidence tied to exact bytes,
configuration and claim scope. Critical/high regressions block release.

**Negative tests.** Mutation testing must demonstrate that removing a use-time
check, scope binding, stop check, reservation, tenant predicate, timeout,
signature or audit step causes a specific test failure. Evidence from old bytes
or a narrower configuration cannot satisfy a new claim.

**Dependencies.** Implement alongside SEC-01 through SEC-17; it does not delay
their rank.

## Top priorities and sequencing

1. **Fix SEC-01 immediately** and add exploit-shaped path/symlink negatives.
   This is the only identified current executable boundary defect, rather than
   a disclosed production non-claim.
2. **Before any real authority or data, land SEC-02, SEC-03, SEC-05 and SEC-07.**
   Identity separation, a complete effect broker, independent stop/revoke and
   tenant/data isolation form the minimum production authority perimeter.
3. **Before enabling a live LLM or untrusted retrieval, land SEC-06 and the
   relevant parts of SEC-12.** No model experiment should receive effect
   credentials or bypass typed planning while these controls are absent.
4. **Before broadening provider effects, land SEC-04, SEC-08, SEC-09, SEC-11,
   SEC-13 and SEC-16.** This closes crash replay, stale approval, lifecycle,
   exhaustion, provider/network and token-generation paths.
5. **Before claiming recoverability or accountable production operation, land
   SEC-14, SEC-15 and SEC-17**, with SEC-18 providing byte-bound adversarial
   evidence across the whole composition.

Complexity may change staffing or decomposition inside each step, but it must
not be used to ship a lower-importance control while leaving a higher-importance
production blocker accepted by default.
