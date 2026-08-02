# BLD-001 Builder Agent / Zoo Builder M1 PDCA

Date: 2026-08-01
Stable issue ID: `BLD-001`
Delivery status: `in_progress`
Claim status: `NOT_PROVEN`
Branch: `feat/bld-001-zoo-builder-m1`
Starting metric: **0/8**
Current metric: **6/8**

## Local issue contract

### Scope

Build one reusable, privacy-first reference Builder Agent that discovers an
unknown synthetic system, produces typed plans and generic adapter/skill
scaffolds, routes owner-selected authority, validates effects and evidence,
proves one isolated OpenClaw read and reversible write, reuses the same core for
a second system and emits a sanitized opt-in contribution bundle.

### Non-scope

No customer-specific privileged script, live data, credential, Owner OpenClaw,
Gateway, vLLM/model, production/customer mutation, public issue, push, pull
request, merge, tag, release, upload or publication is in scope. The Builder is
an ordinary untrusted agent and never becomes a control-plane authority.

### Dependencies and reconciled base

- Completed local dependencies: AAS-012 4/4, AAS-035 12/12, AAS-036 8/8,
  AAS-037 6/6 and AAS-023 4/4.
- Current public `main`: `bdaa4ccc55aacecdfc1200da3385dfd2b3ee4a8d`.
- Historical clean validated checkpoint:
  `253c26cc2f75a48f179c3d38c3e5b6ed33fa82d4`.
- Fresh reconciliation merge:
  `633f6987d1cefec50bcf40fa10e02097e09c08c9`; public bytes won all
  overlapping conflicts while the local dependency lineage was retained.

### Measurable acceptance — exact 8/8

1. `BLD-001-G1`: SAFE_GUIDED default, CUSTOM and RAMPAGE/FULL_CONTROL_LAB
   resolve deterministically. Effective rights equal Host/System ceiling ∩
   Owner profile ∩ assignments ∩ current constraints; every default, override
   and exclusion is explainable and no hidden product ceiling prevents an Owner
   from selecting automatic execution.
2. `BLD-001-G2`: typed guided intake and System Advisor discovery read bounded
   machine manifests, Guides and cause/effect context for a previously unknown
   synthetic system and goal.
3. `BLD-001-G3`: registered capabilities are reused; genuine gaps produce only
   versioned inactive `UNRESOLVED_INTENT` proposals with risk, dependencies and
   recommendation. Unknown intent never creates authority or an effect.
4. `BLD-001-G4`: one deterministic planner and generic templates emit a system
   manifest, object/dependency graph, adapter or skill contract, profile diff,
   fixtures and rollback plan without a bespoke privileged script.
5. `BLD-001-G5`: focused quality/security tests, negative probes,
   readback/reconciliation and an evidence package pass; installation,
   activation, mutation and publication remain separately configurable.
6. `BLD-001-G6`: a fresh default-off isolated OpenClaw Builder profile performs
   one synthetic read and one reversible write through Gateway/Broker with
   receipts, reset and zero owned residue.
7. `BLD-001-G7`: a second synthetic system reuses the unchanged Builder core;
   bypass, leak, cross-tenant, activation, self-approval, replay,
   post-approval mutation and failed rollback probes behave according to the
   Owner profile while malformed/integrity-invalid input always fails closed.
8. `BLD-001-G8`: a sanitized opt-in contribution bundle links Issue, Claim and
   Evidence IDs and includes scope, non-scope, dependencies, acceptance,
   negative probes, evidence, recovery, non-claims and honest delivery status.
   Operator/System Advisor docs, focused/full/supply-chain validation, clean
   local commit and resumable evidence close the case. `LOCALLY_VALIDATED` is
   never presented as `RELEASED`.

### Negative probes

Unknown/duplicate rights, malformed profiles, hidden fields, host ceiling
escape, assignment/constraint omission, custom-rule smuggling, intent-to-effect
bypass, secret/raw-data capture, cross-tenant access, direct provider bypass,
unauthorized skill activation, self-approval, replay, post-approval mutation,
readback mismatch, rollback failure and unsanitized contribution content must
deny or become explicit non-success evidence.

### Evidence plan

Each gate gets focused positive and negative tests plus a machine-readable
evidence record. Changed public bytes remain in the explicit public manifest and
checksum closure. G6 must retain the isolated runtime report and zero-residue
proof. G8 runs focused, full, supply-chain and deterministic public-staging
validation before a clean local checkpoint.

### Rollback and recovery

The Builder stays default-off. Revert the bounded implementation commit,
deactivate the isolated Builder profile, restore the previous immutable
adapter/skill generation, reconcile or reverse only fixture-owned writes and
retain receipts/negative evidence. Missing provenance, reset, readback or
rollback evidence yields no success claim and no activation fallback.

### Honest non-claims

Local synthetic evidence is not production authorization, hostile-host
containment, universal OpenClaw/agent compatibility, live-provider validation,
security certification, customer-data fitness, public availability or release
evidence. The decision matrix is not an executable authority token.

## Autonomy gate

- **Exact phase/metric:** BLD-001 Builder Agent M1, **6/8 → 8/8**; G1 through
  G6 are complete and the next bounded slice targets G7 only.
- **Autonomously reachable:** contracts, synthetic fixtures, tests, docs,
  isolated later runtime fixtures and local evidence require no external data
  or mutation.
- **Preparable only:** public issue/PR/release text and live-system integration
  plans may be drafted but not published or activated.
- **External/publication dependent:** push, PR, merge, tag, release, upload,
  outreach, production/customer evidence and mutation.
- **Completed metric rule:** all prerequisite video/architecture gates and
  AAS dependencies plus BLD-001-G1/G2/G3/G4/G5/G6 are complete and are not
  repeated without regression evidence.

## Reversible decisions

- **Assumption:** `RAMPAGE` and `FULL_CONTROL_LAB` are aliases of one canonical
  `RAMPAGE_FULL_CONTROL_LAB` profile. **Risk:** older consumers may retain either
  label. **Fallback:** accept both aliases and emit the canonical profile.
  **Review:** G6 isolated OpenClaw profile binding.
- **Assumption:** SAFE_GUIDED auto-routes read-only rights and owner-routes every
  effectful right; CUSTOM can auto-route any effective registered right.
  **Risk:** a future effect class may need a distinct default. **Fallback:**
  unknown classes fail validation. **Review:** G4 planner/schema versioning.
- **Assumption:** publication is a normal registered effect class, not a hidden
  product ceiling. **Risk:** an unsafe CUSTOM/RAMPAGE profile can auto-route it.
  **Fallback:** Host/System, assignment and current-constraint ceilings still
  bind; SAFE_GUIDED requires Owner approval. **Review:** G5 publication routing
  tests and G8 contribution-bundle boundary.
- **Assumption:** an unknown system is discoverable through one closed generic
  manifest, operation-scoped System Advisor Guides and synthetic context; no
  system-type allow-list belongs in the Builder core. **Risk:** a Guide may be
  broad enough to pull irrelevant context into a record. **Fallback:** select
  context only from requested operations and require Guide coverage for every
  selected operation/context pair. **Review:** G7 second-system reuse and
  adversarial conformance.
- **Assumption:** capability reuse requires an exact registered capability ID,
  matching system type, operation ID and effect class; unmatched hints become
  versioned inactive proposals. **Risk:** fuzzy matching or an incompatible ID
  collision could bind the wrong adapter semantics. **Fallback:** fuzzy names
  remain unresolved, exact incompatible collisions deny the entire resolution,
  and every reused descriptor remains inactive/non-executable. **Review:** G4
  planner/schema versioning and G7 adversarial second-system reuse.
- **Assumption:** G4 emits only generic data contracts over recomputed G1/G2/G3
  records; each contract binds the exact capability descriptor or unresolved
  proposal digest and every effectful operation carries a pre-activation
  recovery strategy. **Risk:** an extracted scaffold could lose provenance or
  be mistaken for executable target code. **Fallback:** generic template IDs,
  closed schemas, inactive/non-executable constants and source-digest mismatch
  denial remain mandatory; revert `6babee7` if G5/G7 cannot validate them
  without privileged specialization. **Review:** G5 evidence/readback workflow
  and G7 second-system conformance.
- **Assumption:** G5 quality evidence may pass while a capability remains
  `UNRESOLVED_INTENT`, but only as `PASS_PREPARATION_REQUIRED`; that operation
  must remain explicit non-success with no readback or receipt. **Risk:** a
  workflow-level pass could be mistaken for adapter readiness. **Fallback:**
  bind every observation to the exact Plan, contract and capability digests,
  keep unresolved and Owner-route-only operations unexecuted, and preserve the
  `NOT_RELEASED` evidence boundary. **Review:** G6 must use a fresh default-off
  isolated runtime with an actually admitted reversible-write capability.
- **Assumption:** G6 may bind the same generic Builder request tool to a fresh
  fixture-only admitted reversible-write descriptor and a digest-bound
  synthetic Owner approval while keeping the Agent untrusted. **Risk:** a
  fixture contract could drift from the effective-rights intersection, hide a
  durable target mutation or be mistaken for live compatibility evidence.
  **Fallback:** validate the rights intersection, admission and approval
  digests at Gateway startup; restore the persisted prior value in `finally`,
  require matching final/before digests, semantic reset and ownership-scoped
  purge; revert `4a50303` on any mismatch. **Review:** G7 must reuse the same
  generic tool/core for a second system and exercise the full adversarial
  conformance matrix.

## PDCA status

### Plan

Keep the full 8/8 contract frozen and G1 through G5 closed. Build one fresh,
default-off and ownership-scoped OpenClaw fixture that consumes generic Builder
contracts, admits exactly one read and one reversible write for an unknown
synthetic target, and proves Gateway/Broker receipts, persisted readback,
rollback, semantic reset and zero owned residue.

### Do

G1 through G5 remain closed. Added one pinned OpenClaw 2026.7.1 Builder profile,
one closed internal network, one generic Builder tool and one Gateway/Broker
with a synthetic habitat target. The Gateway recomputes the Owner-sovereignty
intersection, fixture admission and Owner-approval digests at startup. The
OpenClaw Agent completed the admitted no-change temperature read and the
Owner-routed set-point write. The write was persisted, read back and restored
to the exact prior digest in a `finally` recovery boundary. Reset and purge are
idempotent and limited to resources carrying the G6 ownership label.

### Check

- Focused BLD-001-G6 tests: **6/6 PASS**.
- Complete repository tests: **189/189 PASS in split source-boundary runs**.
  The 184 non-source-boundary tests ran with the matching existing dependency
  tree; after removing that temporary untracked symlink, all five clean
  source-tree/supply-chain/public-staging tests passed separately.
- Repository checksums: **269/269 PASS**.
- Supply-chain declaration checks: **6/6 PASS**; deterministic public staging
  PASS.
- Real isolated OpenClaw smoke:
  `bld001-g6-20260802T071108Z` **PASS in 30,972 ms**. It recorded four model
  calls, one read, one reversible write, seven denials, two bound receipts,
  unchanged Owner process/config fingerprint, exact target rollback, reset to
  zero counters/receipts and zero owned runtime residue.
- Implementation commit:
  `4a50303b4d65df7c046834135884fed45b25af7a`.
- Evidence: `docs/development/evidence/bld-001-g6-20260802.json`.

### Act

Close G6 at **6/8** with verdict
`LOCAL_BLD_001_G6_PASS_REAL_ISOLATED_OPENCLAW_SYNTHETIC_READ_REVERSIBLE_WRITE_ROLLBACK_ZERO_OWNED_RESIDUE_NOT_PRODUCTION_OR_RELEASED`.
Do not reopen G1 through G6 without regression evidence. Keep WIP at one and
advance the same worktree to G7 second-system reuse and adversarial conformance
without changing the generic Builder core.
