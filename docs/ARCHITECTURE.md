# Architecture

This architecture preserves the v0.1 subset identified in
[The ChimpMaera Canon](CANON.md) and adds the isolated v0.2 Wave 1 Approval
Workbench candidate. [Known Limitations](KNOWN-LIMITATIONS.md) identifies
boundaries that remain intentionally outside the local candidate.

ChimpMaera v0.1 is a local reference stack with three user-facing loopback
services:

- ChimpMaera coordinates the guided demo, enforces the local action boundary
  and records a digest-bound receipt.
- EspoCRM holds the synthetic customer and opportunity view.
- Dolibarr receives one approved synthetic order and supplies the authoritative
  provider readback.

MariaDB services remain on internal Docker networks. ChimpMaera communicates
with the provider application networks but does not mount the Docker socket.
The ChimpMaera container is non-root, read-only, capability-dropped and
configured with `no-new-privileges`.

The installer creates random local secrets as Docker Compose file-backed
secrets. No credential is bundled in the release. The installer journal and
semantic readback live only in generated local state directories.

The optional `tools/video-production-reference/` component is independent of
the CRM/ERP runtime. Its default path validates versioned jobs and can perform
a synthetic CPU-only smoke without models, GPU activation or public side
effects.

The effect path follows the Canon's separation: the seed path forms typed
requests without provider credentials; the ChimpMaera runtime gate performs
use-time enforcement; the provider is read back before a bound success receipt
is recorded. Wave 1 adds one complete readable business Diff and local
Approve/Reject ceremony for the existing synthetic Dolibarr escalation.
Production owner identity, a production approval service, provider Revoke and
provider Rollback remain outside the candidate.

The Admin-AI PoC is a deterministic local preview wired through a static policy
and the same enforcement boundary. `AUTO_GRANT` may execute only its permitted
synthetic CRM effect. `OWNER_ESCALATION` creates a durable proposal with an
exact business Diff; an authenticated local Approve emits a profile-, policy-,
scope-, action- and Diff-bound short lease, while Reject emits no authority.
The gate consumes an owner lease before provider access, performs semantic
readback and records owner-decision and effect receipts. Missing, rejected,
tampered, expired, replayed or scope-mismatched authority fails closed. The
owner signer key is created inside the runtime state volume and is not exposed
to browser or seed code. No live LLM, production IAM, revoke service,
distributed authority or production approval is claimed.

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
