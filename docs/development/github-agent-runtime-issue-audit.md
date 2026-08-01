# GitHub agent-runtime issue audit

Status: read-only audit; no issue, label, milestone, comment, PR, or repository
mutation

Repository: JimPansky/ChimpMaera

Observed at: 2026-08-01 13:12 UTC

Public open-issue count observed: 15

## Decision

No open issue is proven redundant enough to close automatically. The OpenClaw
M1 epic and its five children cover distinct layers: reference-runtime
provenance, network/identity, runtime/state isolation, typed E2E, and adversarial
evidence. Their current wording does, however, mix the product contract with a
Docker/OpenClaw Reference Adapter.

Recommended future maintenance is to generalise the product-level wording while
preserving OpenClaw and Docker where they identify an actual reference proof.
Do not create a Docker project for every Agent. Additional Agents should enter
one compatibility matrix and shared adapter contract, then receive a concrete
implementation issue only when a pinned proof target is selected.

## Exact issue audit

| Issue | Current claim | Recommendation | Reason |
| --- | --- | --- | --- |
| #2 — [OPENCLAW-M1] Gateway-only OpenClaw agent runtime | OpenClaw-specific umbrella; uses “runtime/container contract” and Docker-shaped criteria | **Keep, rename/generalise umbrella.** Suggested title: “[RUNTIME-M1] Agent Runtime Isolation Contract and OpenClaw reference proof.” Preserve OpenClaw as the first E2E adapter. | The epic is not redundant with its children; it holds the integration and evidence gate. Product abstraction should not be OpenClaw- or container-bound. |
| #3 — [AAS-012] Finite inactive capability/action catalogue | Agent-neutral finite, default-inactive capability vocabulary | **Keep unchanged except terminology cross-link.** | This is a real prerequisite for every runtime and does not impose Docker. Discovery/admission/activation separation is Canon-aligned. |
| #4 — [OPENCLAW-M1.1] Pinned default-off agent container and provenance | Exact OpenClaw container/image provenance and lifecycle | **Keep as Reference Adapter issue.** Suggested title: “[OPENCLAW-ADAPTER-M1.1] Pinned default-off Docker reference adapter and provenance.” | This is the one place where Docker specificity is honest and useful because AAS-035 actually validated that adapter. It must not become the product principle. |
| #5 — [OPENCLAW-M1.2] Gateway-only networking and workload identity | Workload identity and enforced single Gateway route | **Keep and generalise to runtime contract.** Suggested title: “[RUNTIME-M1.2] Enforced gateway-only network and workload identity.” | Distinct security boundary. It should require OS/hypervisor/remote-boundary enforcement and state that topology alone is insufficient. |
| #6 — [OPENCLAW-M1.3] Hardened runtime, bounded scratch, and managed mind-store contract | Container-hardening plus ephemeral/durable state | **Keep; amend mechanism-specific criteria.** Suggested title can stay runtime-neutral. Replace “container runs” with “selected adapter enforces,” retaining Docker checks in the OpenClaw evidence profile. | Runtime/state isolation is distinct from #5 and #8. Non-root/read-only/capability flags are Docker adapter evidence, not universal mechanism vocabulary. |
| #7 — [OPENCLAW-M1.4] Typed gateway/broker E2E request with receipts and readback | One real OpenClaw request through governed effect path | **Keep as OpenClaw reference E2E.** Suggested title: “[OPENCLAW-REFERENCE-M1.4] Typed Gateway/Broker E2E with receipts and readback.” | Agent specificity is appropriate for a concrete proof. It verifies contract composition and does not create a separate control plane. |
| #8 — [OPENCLAW-M1.5] Adversarial containment, cross-tenant, reset, recovery, and evidence | Cross-boundary negative/evidence suite | **Keep and generalise as shared conformance suite**, with an OpenClaw/Docker result profile. | This is not redundant with #5 or #6: it integrates bypass, failure, reset, recovery and claim evidence across them. The suite should be reusable by every adapter. |
| #10 — [BI-001] Default-off Docker foundation | BI service foundation, not an Agent runtime | **Keep; optionally rename to “Default-off BI runtime foundation.”** | It is not an agent-specific Docker requirement and is outside the Agent Runtime issue family. Docker may remain the current BI adapter if that is what is tested. |
| #17 — [AGENT-M2] Additional gateway-only agent runtimes (Hermes first), **closed** | Shared adapter/compatibility plan; Hermes first; no per-runtime issue fan-out | **Preserve closed audit history. Later reopen or supersede with one compatibility epic only after #2 contract acceptance. Add Claude Code beside Hermes as an unproven candidate.** | It was closed to keep the public M1 roadmap lean, not because its architecture is redundant or wrong. Its one-matrix approach now matches the agent-agnostic decision. |

## Docker-duty scan

Among the open Agent Runtime issues:

- #4 intentionally and correctly requires a container because it should become
  the Docker/OpenClaw Reference Adapter proof.
- #2 and #6 currently use container language where the normative product layer
  should say isolation adapter.
- #5 and #8 are substantively mechanism-independent despite OpenClaw titles.
- #7 is correctly Agent-specific as an E2E proof, but not inherently
  Docker-specific.
- #3 does not require a runtime mechanism.

No open issue asks for a Hermes or Claude Code Docker. There is therefore no
proven duplicate Agent-Docker issue to close.

## Later issue operations

These are recommendations only; exact wording should be reviewed before any
GitHub write:

1. Edit #2 to define the Agent Runtime Isolation Boundary and classify
   OpenClaw/Docker as the M1 Reference Adapter.
2. Keep #4 Docker-specific and link its acceptance Evidence to the shared
   contract.
3. Generalise #5, #6 and #8; keep their separate responsibilities.
4. Keep #7 OpenClaw-specific as the concrete E2E.
5. Correct the current dependency/status facts only when merged default-branch
   evidence exists; local AAS completion is not merge completion.
6. When M1 is ready, use #17 or a superseding single compatibility epic for
   Hermes and Claude Code. Record each runtime/version as compatible,
   adapter-needed, unsupported, or unknown. Do not open implementation issues
   until provenance and a concrete proof target exist.

## Redundancy answer

**Truly redundant open issues: none on current evidence.** The overlap between
#2 and #4–#8 is normal epic/child decomposition. Combining #5, #6, or #8 would
erase distinct acceptance and rollback boundaries. Closing any of them now
would be a roadmap mutation unsupported by merged implementation facts.

## Claim boundary

This audit proves only the issue titles, bodies, states, labels, milestones, and
relationships observed through read-only GitHub access. It does not prove that
local AAS-035/AAS-036 commits are merged, released, or represented in the
default branch. No issue mutation was performed.
