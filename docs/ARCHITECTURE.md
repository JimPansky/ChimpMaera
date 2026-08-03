# Architecture

The cross-cutting knowledge lineage and promotion model is specified in [Governed Knowledge Harvest](KNOWLEDGE-HARVEST.md). Media production is its first explicit negative-evidence-to-governed-template example.

This architecture preserves the initial `v0.1.0` subset identified in
[The ChimpMaera Canon](CANON.md) and describes the current released local PoC,
including the Approval Workbench and later local-synthetic security surfaces.
The Canon's
mechanism-independent product abstraction is the Agent Runtime Isolation
Boundary / Untrusted Runtime Contract, detailed for engineering use in the
[Agent Runtime Isolation Contract](AGENT-RUNTIME-ISOLATION-CONTRACT.md).
[Known Limitations](KNOWN-LIMITATIONS.md) identifies boundaries that remain
outside this local snapshot.

The current ChimpMaera release includes a local reference stack with three
user-facing loopback
services:

- ChimpMaera coordinates the guided demo, enforces the local action boundary
  and records a digest-bound receipt.
- EspoCRM holds the synthetic customer and opportunity view.
- Dolibarr receives one approved synthetic order and supplies the authoritative
  provider readback.

The shipped demo uses Docker Compose as one Reference Adapter. MariaDB services
remain on internal Docker networks. ChimpMaera communicates with the provider
application networks but does not mount the Docker socket. The ChimpMaera
container is non-root, read-only, capability-dropped and configured with
`no-new-privileges`. This validates only the exact local adapter configuration;
Docker is not a product-wide requirement or a per-Agent architecture.

The installer creates random local secrets as Docker Compose file-backed
secrets. No credential is bundled in the release. The installer journal and
semantic readback live only in generated local state directories.

The optional `tools/video-production-reference/` component is independent of
the CRM/ERP runtime. Its default path validates versioned jobs and can perform
a synthetic CPU-only smoke without models, GPU activation or public side
effects.

The `SAFE_GUIDED` effect path follows the Canon's separation: the seed path forms typed
requests without provider credentials; the ChimpMaera runtime gate performs
use-time enforcement; the provider is read back before a bound success receipt
is recorded. The shipped local demo is not a general Agent Runtime Isolation
Adapter and does not claim complete mediation for arbitrary model, skill,
filesystem, durable-Mind, read, or process crossings. The following components
are current released local-synthetic surfaces where identified as shipped; they
are not retroactive `v0.1.0` claims or production evidence.

The released Wave 1 surface adds one complete readable business Diff and local
Approve/Reject ceremony for the existing synthetic Dolibarr escalation.
Production owner identity, a production approval service, provider Revoke and
provider Rollback remain outside the local PoC.

The Admin-AI PoC is a deterministic local preview wired through a static policy
and the same enforcement boundary. `AUTO_GRANT` may execute only its permitted
synthetic CRM effect. `OWNER_ESCALATION` creates a durable proposal with an
exact business Diff; an authenticated local Approve emits a profile-, policy-,
scope-, action- and Diff-bound short lease, while Reject emits no authority.
For the material synthetic order, the proposal first performs a bounded exact
provider query and derives its Diff from the resulting closed snapshot. The
snapshot binds requester, purpose, complete material fields, a digest-derived
local version, impacts, rollback and active Policy. It is re-read before the
owner decision and again at the use-time gate before lease reservation. The
gate then consumes the lease, performs semantic readback and records bound
decision/effect receipts. Missing, hidden, truncated, stale, rejected,
tampered, expired, replayed or scope-mismatched authority fails closed. The
owner signer key is created inside the runtime state volume and is not exposed
to browser or seed code. No real provider ETag/transaction, live LLM,
production IAM/MFA/quorum, revoke service, distributed authority or production
approval is claimed.

Wave 2 places the deterministic static policy behind a versioned,
provider-neutral `PolicyEvaluator` contract. The evaluator sees neutral intent
and trusted server-owned policy/profile context, returns decision data only and
cannot issue authority. A closed action-adapter ceiling and the Wave 1 gate
remain the executable trust boundary; malformed or overbroad evaluator output
fails closed.

The provider-neutral injection trust contract is an effect-free predecessor to
that evaluator. Provider, tool, document and memory content is carried in exact
envelopes whose origin-specific trust, tenant, data class and instruction
eligibility are explicit and always data-only. A model-shaped candidate can
name only a finite catalogue action, bounded symbolic arguments and the exact
evidence envelopes. Trusted code reconstructs method, path, scope and an opaque
credential handle from a server-owned catalogue. The result is digest-bound
but remains a candidate: it is neither a Policy decision, Approval, authority
nor provider call. No live model or retrieval path is enabled.

The Admin-AI Policy is activated through a local generation fence. An exact
candidate binds tenant, Policy ID, source bytes, semantic digest and a strictly
increasing generation to a purpose-separated local Owner authorization. The
authenticated activation record retains the preceding generation as an
explicit last-known-safe snapshot. Decisions and effect authorities carry the
active Policy ID, generation and source digest, and the gate reloads and checks
that record immediately before provider access. Generation divergence or an
explicit fallback freezes dispatch; fallback bytes are never silently treated
as a new generation.

A separate, default-off local management-plane contract completes the signed
Policy lifecycle around that fence. Ed25519-signed artifacts bind issuer/key,
tenant, Policy ID, generation, validity and a closed runtime compatibility
tuple. Draft, validation, deterministic semantic Diff, simulation, exact Owner
approval, staging, activation, supersede, rollout confirmation, retire and
revoke transitions produce an authenticated hash-chained receipt record.
Authority widening requires an approval that binds that exact Diff. Trust
drift, expiry, replay, unsupported runtime semantics, mixed worker generations
or post-activation persistence failure denies or freezes; only the existing
generation fence can activate or authorize use, and fallback is never implicit.
The synthetic signing and approval keys are test fixtures, not runtime or Agent
credentials.

The local permission X-ray is a separate informational path. A closed-schema
effective-rights compiler intersects synthetic profile, assignment, capability
and constraint ceilings across action, resource, field, purpose and effect
scope. Missing, unknown, stale, conflicting, explicitly denied or empty
intersections return DENY; capability presence alone cannot grant. The
read-only dashboard renders the compiler result directly, including every
contributing ceiling, reason fact and result digest. Its ALLOW outcome issues
no authority and does not replace Policy evaluation, approval or use-time
enforcement.

Wave 3 adds only a disabled-by-default Paperless-ngx read adapter seam. It can
construct fixed GET requests for synthetic zoo metadata, sanitize responses and
emit digest-only read receipts. It is not wired to the stock Compose stack and
cannot upload, download document content, mutate or delete. A real Paperless
service and its database, queue and converter supply chain remain uninstalled
and unclaimed.

Wave 4 unifies repository-declared OCI, npm and CI inputs in an offline
artifact lock and checks runtime-image and public-release byte closure. This is
a declaration-consistency control. It does not establish registry signatures,
provenance, SBOM completeness, vulnerability status, license clearance or
reproducible builds.

The default-off managed skill candidate adds a closed, versioned Skill
Admission IR and a broker-owned immutable store. An agent may request an exact
content-addressed package but cannot mutate the store, approve itself or grant
capabilities. Deterministic analysis covers provenance, licence declarations,
dependency locks, install scripts, secret/network/filesystem/process/
persistence access, path safety and transitive rights. SAFE_GUIDED, CUSTOM and
RAMPAGE return explainable routes under the same validity ceiling; even
RAMPAGE cannot admit malformed, tampered or cross-tenant input. Installation
stores zero granted capabilities and remains inactive. Activation is separate,
read back and receipt-bound; failure or rollback restores a prior immutable
generation. The isolated OpenClaw fixture receives the managed skill volume
read-only and has only an internal path to the manager. This is not arbitrary
skill-code safety, a production registry/trust root/store or universal agent
format compatibility.

## Capability contracts and provider bindings

Consumers should depend on a stable capability contract, not a provider's API
shape. A contract declares the semantic operation, closed inputs and outputs,
identity and tenant context, invariants, and expected evidence. A typed adapter
then binds that contract to provider-specific fields, routes and an opaque
credential handle. Reusable templates define the adapter, fixtures, validation
and recovery structure without granting activation or runtime authority.

The current release proves a finite local-synthetic subset: a typed capability
catalogue, the CRM/ERP reference path, and Builder contracts that produce
inactive target-neutral adapter or skill plans from synthetic manifests and
guide context. Those bytes demonstrate separation and synthetic reuse. They do
not prove live provider replacement, arbitrary-system onboarding or universal
compatibility.

The broader product direction lets AI assist with proposing mappings,
configuration and validation plans. Such output remains an untrusted proposal.
Trusted code must validate the closed schema, compatibility and mapping;
intersect the Host/System ceiling, Owner rights profile, assignments and
current constraints; and require the configured approval route before any
effect. Changing an adapter cannot inherit evidence or silently widen rights.

A binding becomes usable only through an explicit sequence: resolve the
capability and template, select an adapter, compute effective rights, validate
the binding, activate it through the governed route, perform any authorized
effect, read the provider back, and bind the result to a receipt. Recovery and
rollback semantics remain binding-specific and declared. This supports an
open-ended configuration space driven by user needs and many possible system,
tool and provider combinations, but each combination requires its own evidence
and applicability boundary.
