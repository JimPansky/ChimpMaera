# PANSPHAIRA terminology and identity guardrails

This document is the current naming contract for the PANSPHAIRA cutover. It
defines display and architecture vocabulary; it does not change the product's
security model, runtime behavior, wire contracts, schemas, or stable technical
identities.

## Terminology contract

- **PANSPHAIRA** is the official product name in current human-facing
  material.
- **pansphaira** is a technical slug only when a genuinely new branded slug is
  needed. Its availability does not authorize migration of an existing
  identifier.
- **Sphere** is architecture and visualization vocabulary only. It is not a
  protocol, schema, API, service, runtime abstraction, or technical namespace.
- **Agent Sphere** is the Agent or untrusted-runtime side of a governed
  boundary.
- **Gateway Sphere** is the mediated-capability side of that boundary.
- A **Connection** is a permitted information or action link.
- A **Crossing** is governed traversal across a boundary. It describes an
  architectural event, not a wire contract, message format, endpoint, schema,
  API, header, or protocol.
- **PSAI** is an informal nickname only. It must not be used as a package,
  schema, environment-variable, header, protocol, service, or other technical
  prefix.

The following established architecture terms retain their existing meanings:
**Agent**, **Untrusted Runtime**, **Runtime Isolation Boundary**, **Gateway**,
**Broker**, **Policy**, **Approval**, **Capability**, **Authority**,
**Readback**, **Receipt**, **Evidence**, **Owner**, **Adapter**, and
**Provider Binding**. Sphere wording may make their relationships easier to
visualize; it does not replace or redefine them.

## Decision contract

Every naming occurrence must be classified before it is edited:

| Classification | Required treatment |
| --- | --- |
| **CHANGE NOW** | Update active, human-facing product branding and approved display or visualization labels. |
| **KEEP** | Preserve stable technical identities, historical material, and any ambiguous identifier. This is the default. |
| **MIGRATE CAREFULLY** | Change only as a complete, separately reviewed dependency cluster with all producers, consumers, compatibility boundaries, cleanup, rollback, assertions, and derived-data refresh identified. |
| **DECISION REQUIRED** | Keep unchanged until an explicit decision exists; do not infer one from the product rename. |

Display terminology never by itself changes runtime meaning or authorizes a
machine-identity migration.

## Stable technical identities: default KEEP

Existing machine-consumed identities remain unchanged unless a later,
versioned exception is explicitly approved. The KEEP boundary includes, but
is not limited to:

- `chimpmaera.*`, `chimpmaera://`, and `io.chimpmaera.*` identities;
- `cm.*`, `CM_*`, `CM-*`, `cm_*`, `cm-*`, and `x-cm-*` identifiers;
- package names, image tags, service and volume names, state paths, plugin IDs,
  Docker labels, environment variables, headers, and URI schemes;
- schema `$id` values and `schemaVersion` constants;
- claim, denial, receipt, evidence, policy, capability, and fixture IDs;
- negative-test sentinels, golden fixtures, and compatibility values.

Cosmetic similarity to the previous product name is not evidence that an
identifier is safe to change. A proposed exception must enumerate every
definition, producer, consumer, persisted value, compatibility boundary,
test, migration step, cleanup step, and rollback action. Partial sweeps and
unversioned aliases are not approved.

## Historical boundary: KEEP

History remains an accurate record of the name and state that existed when it
was created. Do not rewrite or regenerate historical tags, releases, issues,
pull requests, commits, snapshots, archives, changelogs, published artifacts,
proofs, manifests, checksums, or evidence solely to apply current branding.
Preserving history also prohibits history rewrites and force-pushes for this
cutover.

## Stable-ID exception register

There are **no approved stable-ID exceptions** at publication of this
contract. The register is intentionally empty, so the default for every
existing or ambiguous machine identifier is **KEEP**.

Any future entry must be separately approved, versioned, consumer-complete,
reversible, and linked to its migration and verification evidence. Adding
PANSPHAIRA or Sphere display vocabulary to a current surface is not such an
exception.
