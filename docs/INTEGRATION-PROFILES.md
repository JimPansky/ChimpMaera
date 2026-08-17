---
title: Integration profiles
description: Describe five narrow local-synthetic integration variants without granting authority, activating a connector, or contacting an external system.
---

# Integration profiles

INT-PROFILE-001 freezes `cm.integration-profile/v1` as a closed description
contract. It binds adapter and upstream identity, data/tenant boundaries,
existing PANSPHAIRA route contracts, lifecycle fallback, Verification Fabric
evidence and typed override denial. Evaluation is pure and local; profile
admission never activates an integration.

## Supported local-synthetic variants

| Variant | Frozen capability | Existing primary contract |
|---|---|---|
| Power Apps | record and metadata read only | `chimpmaera.connector/power-platform-read/v1` |
| Power BI | read-only projection | `chimpmaera.analytics/v1` |
| mailbox-style adapter | list and metadata read only | `chimpmaera.agent-work-intelligence/event-record/v1` |
| local knowledge corpus | local read and search | `chimpmaera.agent-work-intelligence/event-record/v1` |
| issue candidate | export candidate only, never public posting | `chimpmaera.hmi/contribute-preflight/v1` |

Every variant also references the existing Verification Fabric, Extension
Trust Lab and Update Doctor contracts. Those references reuse their semantics;
the integration profile does not duplicate their verdicts, authority or
update behavior.

## Fail-closed boundary

The evaluator denies unknown actions, hidden writes, private paths, unpinned
upstreams, cross-tenant references, stale evidence, incompatible versions,
missing rollback targets and generic proxy overrides. Unknown fields are
rejected by both the Draft 2020-12 schema and TypeScript evaluator. Canonical
SHA-256 digests exclude only `profileDigest` and remain stable when object keys
are reordered.

Defaults are synthetic, single-tenant, least-privilege and free of ambient
credentials. The only named override vocabulary is `displayName` and
`refreshCadenceMs`; this slice intentionally carries no environment values.
Generic host, path and proxy values remain `null`.

## Migration and fallback

| Condition | Result | Fallback |
|---|---|---|
| compatible profile and fresh local evidence | local contract is conformant | no activation follows |
| semantic or version expansion | deny and require a new digest/evidence generation | keep the old compatible reader |
| replacement readback fails | freeze promotion | serve the recorded read-only LKG profile |
| LKG is absent or incompatible | disable the integration route | `cm-lkg:integration-disabled-v1` |

Rollback removes this additive contract slice or disables its profile route;
no tenant, cloud resource, credential, provider record or runtime state needs
reversal.

## Verify locally

```bash
npm run integration-profile:test
```

The evidence supports only strict local schema/type conformance,
deterministic digests, the five synthetic variants and the nine exact denial
probes. It does not support connector import, real mailbox or Power Platform
compatibility, tenant isolation, credential handling, external writes,
automatic issue creation, generic proxying, certification, deployment,
production readiness or runtime activation.
