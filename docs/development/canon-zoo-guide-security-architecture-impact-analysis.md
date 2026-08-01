# Canon and Zoo Guide security-architecture impact analysis

Status: local documentation revision candidate

Date: 2026-08-01

Baseline: origin/main at f00a4890f7fecb68f82e692f09cf1e46728fb88d

Branch: docs/canon-zoo-runtime-security-final-20260801

External effects: none

## Executive decision

ChimpMaera's normative product boundary is the **Agent Runtime Isolation
Boundary / Untrusted Runtime Contract**. Agents are untrusted workloads with no
ambient authority. Meaningful model, tool, network, filesystem/durable-Mind,
secret, sensitive-read, process/device, tenant, skill-lifecycle, and effect
crossings are mediated by typed Gateway/Broker/Policy/Approval/Receipt paths.

The isolation mechanism is an adapter choice. Containers, VMs/MicroVMs, WASM
sandboxes, remote workers, or equivalently evidenced OS sandboxes are allowed.
Docker remains the real validated AAS-035 OpenClaw Reference Adapter and E2E
proof. It is not a Canon law and not a required Docker project per Agent.

Gateway-only routing is insufficient if alternate network, filesystem,
credential, process, device, or namespace routes are not denied by a kernel,
hypervisor, OS sandbox, or equivalent remote enforcement boundary.

## Evidence Gate 1 — source inventory

### Public canonical and claim sources

The public baseline was fetched read-only before work began. The checksums are
the values recorded in that baseline's SHA256SUMS.

| Source | Baseline version/hash | Role before revision | Finding |
| --- | --- | --- | --- |
| docs/CANON.md | v0.1; f0558862d7f5308668ffde74fbbae95f21c5372d435f41473c9ebcc2d129457a | normative principles | Strong action/authority/effect laws; no explicit complete mediation or mechanism-independent runtime contract |
| docs/ZOO-FIELD-GUIDE.md | ea967ea2177dfaa57c132835401bea9508a29add130287aa4f03763278e8bca3 | practical guidance | Concise action guidance; no deployment-adapter, TCB, model/Mind/skill, maturity, or recovery procedure |
| docs/ARCHITECTURE.md | 5eb1de343c5b9016324ba22367d9c4dc8a8f019ff57f2eff6f9c8c63921afdb9 | shipped v0.1 mapping | Docker-specific local truth is honest but not identified as a Reference Adapter |
| docs/KNOWN-LIMITATIONS.md | 8b39cb77d00339e14ad83456f3c67f828cf67b2aa5e76236ecf8491590691c86 | claim ceiling | Correctly denies hostile-host/production claims; lacked complete-mediation and thought/side-channel ceiling |
| README.md | 17e9883b6e727c4a783df23710afa055990f1fe453f7fe916d80f4d10077a20d | public entry claim | Docker guardrails are scoped to PoC but could be mistaken for product architecture |
| SECURITY.md | 1a92564c31cafee7a8d96797e35c928fec450af8f51a359bbf67e2f8ba55ca07 | vulnerability process/supported scope | Correct reporting scope; not a runtime architecture specification |
| CONTRIBUTING.md | 39155501b84fa8323bc48aaa99a32a4e27e79b94930f0646568b18f2eff01b0e | contributor gates | Already requires runtime-isolation/credential/data negative evidence; compatible with revision |
| GitHub issues #2–#8 | read-only observation 2026-08-01 13:12 UTC | public Agent Runtime roadmap | Honest OpenClaw M1 decomposition but product and Reference Adapter language are mixed |
| GitHub issue #17 | closed | deferred Agent compatibility roadmap | Hermes-first shared-contract approach; closed for lean scope, not architectural redundancy |

### Local security-architecture sources

| Source | Exact state | Supported use in this revision |
| --- | --- | --- |
| AAS-035 final checkpoint 3f157c768d5769487a1e5feb1d97b239b3121d0f | 12/12 local OpenClaw 2026.7.1 Docker fixture proof; implementation commit 2ddfd1e5ec70e6f6fc233aebc68339c1f709bf2d | Docker/OpenClaw Reference Adapter evidence, negative-probe seed, known TCB/host limitations |
| AAS-036 final checkpoint da76543e12390c3f3d899e178eac17bc4f513759 | 8/8 agent-neutral Model Access Broker with closed local OpenAI/Anthropic-compatible fixtures and real isolated OpenClaw E2E | bidirectional model mediation, broker-plane separation, untrusted tool-candidate and compatibility-claim rules |
| AAS-037 backlog section | 0/6 design only | skill lifecycle target norm and procedure; no implementation claim |
| AAS-038 | no file, branch, commit, or implementation evidence found in the inventoried source set | no claim; listed as unavailable evidence rather than inferred |
| Owner runtime decision dated 2026-08-01 | explicit normative direction | authoritative target abstraction, complete-mediation scope, Docker role, claim ceiling |

### Proven contradictions and gaps

1. CM-CAN-08 speaks primarily about the effect boundary, while the updated
   threat model requires mediation of reads, model traffic, state, skills,
   secrets, and network/process crossings.
2. Public architecture truthfully describes Docker v0.1, but did not explicitly
   separate the shipped adapter from the product abstraction.
3. “Gateway-only” appeared as a topology goal without an explicit Canon rule
   that alternate OS/network paths must be mechanically denied.
4. CM-CAN-09 kept credentials outside planning but did not define separate
   model, read, state, skill, and effect broker custody.
5. CM-CAN-03/15 separated admission and activation but did not define a full
   skill lifecycle or JIT quarantine ceiling.
6. Fail-closed and Replay laws did not fully state availability, partition,
   degraded-mode, reset, and recovery duties.
7. Evidence rules did not explicitly reject claims of complete inner-thought or
   side-channel transparency.

## Evidence Gate 2 — normative delta

The machine-readable
[normative delta matrix](canon-zoo-guide-normative-delta-matrix.json) records 14
deltas with existing rule, target principle, keep/amend/add/deprecate decision,
rationale, evidence, and non-claim.

Summary:

- **Keep and strengthen:** capability/authority separation, Owner root,
  default-off activation, exact Approval, effect enforcement, secret custody,
  Readback/Receipt, Replay, claim discipline, and reviewable evolution.
- **Amend:** effect-only mediation, Profile/full-control semantics, plane
  separation, fail-closed recovery, privacy-minimising Evidence, and maturity.
- **Add:** no ambient authority, complete mediation, agent/mechanism-independent
  isolation, ephemeral-compute exception, bidirectional model guards, managed
  Mind, skill lifecycle/JIT quarantine, availability duties, explicit TCB and
  claim ceiling.
- **Deprecate as a product claim:** “gateway-only” by convention and
  Docker/container as the normative per-Agent mechanism.

## Evidence Gate 3 — target norms

The target norms are now defined in Canon CM-CAN-18 through CM-CAN-28 and the
[Agent Runtime Isolation Contract](agent-runtime-isolation-contract.md):

1. No Ambient Authority / Zero Standing Privilege.
2. Complete Mediation of Meaningful Boundary Crossings.
3. Agent-agnostic Runtime Isolation Contract.
4. Gateway, Decision, Broker, Effect, Evidence, management and stop separation.
5. Bidirectional model traffic mediation.
6. Managed durable state/Mind boundaries.
7. Typed default-off Profiles, including explicit Owner-selected full control.
8. Governed skill discovery/admission/install/activation/update/quarantine,
   with JIT hooks that may only tighten.
9. Evidence-bound reproducibility and scoped maturity.
10. Availability, fail-closed, degraded-mode, reset and recovery duties.
11. Privacy/data-minimising observable transparency.

## Evidence Gate 4 — Canon and Zoo Guide changes

### Canon laws

- Core terms now define meaningful crossings, Untrusted Runtime Contract,
  Gateway/Broker plane, and managed Mind.
- CM-CAN-02 clarifies that Owner-selected full control remains typed, mediated,
  revocable, isolated, and evidenced.
- CM-CAN-03/04/09/11/16 are broadened to cover new runtime surfaces.
- CM-CAN-18 through CM-CAN-28 add the security invariants listed above.
- Docker and other mechanisms are explicitly adapter-specific evidence, not
  immutable product law.
- Transparency covers observable boundary inputs/outputs/actions, not complete
  internal thoughts or unknown side channels.

### Zoo Guide procedures

- adds a boundary/TCB inventory before mechanism selection;
- provides container, VM/MicroVM, WASM, remote-worker and OS-sandbox choices;
- defines Observe, Guided, Delegated, and Owner-selected full-control Profiles;
- supplies a crossing-to-control operator matrix;
- separates Gateway/Policy/Model/Read/State/Skill/Effect/Evidence planes;
- defines model, Mind and skill procedures;
- adds failure/degraded-mode/recovery duties;
- adds privacy-minimising evidence and M0–M3 scoped maturity language; and
- preserves AAS-035/AAS-036 as local Reference Adapter evidence without
  promoting it to public release behavior.

## Evidence Gate 5 — GitHub roadmap audit

The complete read-only audit is in
[github-agent-runtime-issue-audit.md](github-agent-runtime-issue-audit.md).

Verdict:

- No open issue is truly redundant on present evidence.
- #2 should become the runtime-contract umbrella with OpenClaw as Reference
  proof.
- #4 should remain Docker/OpenClaw-specific because it is the actual provenance
  and adapter proof.
- #5, #6, and #8 should be generalised but kept separate.
- #7 should remain an OpenClaw-specific E2E proof.
- #3 remains agent-neutral and unchanged in substance.
- #17 is closed historical/deferred scope, not proof of redundancy. If resumed,
  it should hold one Hermes/Claude Code compatibility matrix and shared adapter
  contract, not per-Agent Docker projects.
- No GitHub mutation occurred.

## Evidence Gate 6 — validation

Final validation result: **PASS with one proven pre-existing release-builder
limitation**.

- normative delta JSON parse and 14/14 required-field/disposition checks: PASS;
- relative Markdown link/anchor scan across 8 changed Markdown files: PASS;
- Canon ID, target-term, secret/private-path and absolute-claim scans: PASS;
- repository checksums, including four new manifested documents: PASS;
- TypeScript lint: PASS;
- complete repository tests: 50/50 PASS;
- video reference tests: 15/15 PASS;
- git diff --check: PASS;
- local commit and clean-worktree proof: recorded at final checkpoint.

The public-staging builder was run on an exact temporary source copy because a
Git worktree uses a .git file. It then stopped at
`UNMANIFESTED_SOURCE_FILE:.github/PULL_REQUEST_TEMPLATE.md`. An origin/main
archive reproduced the same failure before these changes. This is therefore a
pre-existing release-tooling limitation, not a regression introduced by this
revision. The four new documents are explicitly present in
release/public-files.manifest and their direct SHA-256 checks pass.

## Explicit answers

### A. What does “as completely isolated as technically evidenced” mean?

It means that, for one exact Agent/runtime/adapter/configuration/environment,
the meaningful crossing inventory is declared, alternate paths are denied by
controls outside the Agent, all permitted crossings are typed and mediated,
applicable isolation surfaces are OS/kernel/hypervisor/equivalent enforced, and
positive plus bypass/failure/recovery probes reproduce the claim. It is scoped,
not absolute.

### B. Which crossings are always mediated, and what compute may stay local?

Always mediate model traffic in both directions; tool/effect requests; external
or sensitive reads; network; filesystem outside immutable base/bounded scratch;
durable Mind; secret use; process/device/socket/namespace operations; skill
lifecycle; and cross-tenant/shared-resource access.

Pure compute may remain ephemeral when it only transforms already admitted
in-memory inputs within bounded resources, touches no new external/sensitive
read, model, tool, secret, durable/shared state, tenant, process/device, or
effect surface. Mediate the transition, not every CPU instruction.

### C. Which Trusted Computing Base remains?

Owner identity/approval root; workload identity, clock, revoke/stop services;
Gateway/frontdoor; schema and Policy/decision components; model/read/state/
skill/effect brokers and response guards; secret/key custody; Replay,
reconciliation, Readback and Evidence stores; the chosen isolation adapter and
control plane; and the enforcing OS/kernel/container daemon/hypervisor/WASM
runtime or remote-worker host/network boundary. The Agent and model/tool/
retrieval outputs remain untrusted.

### D. Which limits prevent absolute claims?

Bypass/configuration drift, unavailable or co-compromised TCB components,
unknown side/covert channels, kernel/hypervisor/daemon/sandbox/firmware flaws,
undiscovered Agent or dependency vulnerabilities, incomplete crossing
inventories, live-provider differences, and untested production identity,
network, state, availability, tenancy and recovery prevent absolute claims.
Observable boundary data also does not reveal complete internal model thoughts.

### E. Is one Docker required per Agent?

No as a product requirement. Use one shared agent-neutral runtime contract and
choose a conforming adapter. Docker is optional and currently valuable as the
validated OpenClaw Reference Adapter/E2E proof. A Docker-specific issue is
appropriate only for that concrete adapter, not for every speculative Agent.

### F. Which Canon laws and Zoo Guide procedures change?

Canon CM-CAN-02/03/04/09/11/16 are amended and CM-CAN-18 through CM-CAN-28 are
added. The Zoo Guide gains boundary/TCB inventory, adapter choice, Profile
recipes, crossing mediation, plane separation, model/Mind/skill procedures,
failure/recovery, privacy-minimising evidence, maturity levels, and honest
OpenClaw Reference Adapter mapping.

### G. Which GitHub issues are truly redundant?

None among the currently open issues. #2 is an epic and #4–#8 are distinct
child gates. Their semantics need renaming/generalisation, not closure. #17 is
already closed for roadmap scope; if future compatibility work resumes, it
should be the single shared Hermes/Claude Code matrix/adapter epic rather than
spawn per-Agent Docker issues.

## Autonomous decision record

- **Assumption:** the explicit Owner runtime decision may amend the local Canon
  candidate even though AAS-037 is only planned and AAS-038 is unavailable.
- **Why safe:** changes are local documentation on a separate branch/worktree;
  no runtime, issue, release, or external state is touched.
- **Risk:** terminology may require maintainer review, and local AAS evidence is
  not merged/default-branch behavior.
- **Fallback:** revert this single local documentation commit or retain Canon
  v0.1 while preserving the analysis artifacts.
- **Review marker:** maintainer review; any new AAS-037/038 evidence; a new
  Agent/version or isolation adapter; default-branch integration; live-provider
  or production-environment selection.

## PDCA

- **Plan:** inventory every authoritative source and contradiction, then
  separate invariant product law from adapter/operator procedure.
- **Do:** revise Canon/Zoo/Architecture/limitations, create the runtime contract,
  delta matrix and issue audit, and preserve OpenClaw Docker evidence as a
  Reference Adapter.
- **Check:** all targeted documentation, JSON, link, checksum, lint, 50 project
  and 15 video tests passed. The staging failure is baseline-reproducible and
  explicitly bounded above.
- **Act:** freeze the verified documentation in one local signed-off commit.
  Keep issue changes as recommendations only. No push, PR, issue write, merge,
  release, deployment, Owner OpenClaw/Gateway/vLLM/model, or container action.
