---
title: Declarative resource-plane profiles
description: Compile seven closed resource planes into an authority-free SAFE_GUIDED, CUSTOM, or FULL_CONTROL plan with an explicit effective-rights diff.
---

# Declarative resource-plane profiles

The M0 resource-plane compiler turns a closed set of requested resource rights
into a deterministic plan. Its machine claim is exactly:

`DECLARATIVE_RESOURCE_PLANE_PLAN_ONLY_NO_EXECUTION`

The result is data. It contains no command, callback, credential, lease,
provider binding, approval token, runtime activation, or authority grant. It
reuses the existing Builder authority intersection:

`Host/System ceiling ∩ Owner profile ∩ assignments ∩ current constraints`

## Seven closed planes

| Plane | Closed template | Examples |
| --- | --- | --- |
| Filesystem | `filesystem-closed/v1` | metadata/content read, owned write, delete |
| Network | `network-closed/v1` | resolve, HTTPS read/write, listen |
| Process | `process-closed/v1` | inspect, spawn, signal |
| Docker | `docker-closed/v1` | inspect, image pull, container run/remove |
| Secrets | `secrets-closed/v1` | metadata read, value read/write |
| Models/tools | `models-tools-closed/v1` | catalog read, model/tool invoke, tool install |
| Devices | `devices-closed/v1` | inspect, sensor read, actuate |

Every input must name all seven planes exactly once, use the exact template for
that plane, and request only rights in that template. Missing, duplicate,
unknown, cross-plane, or hidden input denies the entire compile.

Secret-value reads are intentionally effect-classified for Owner routing in
`SAFE_GUIDED`: disclosing a secret is not treated as harmless just because the
underlying store operation is read-only.

## Profiles and diff

- `SAFE_GUIDED` auto-routes ordinary reads and routes writes, activation, and
  irreversible effects to the Owner.
- `CUSTOM` admits only explicitly declared custom rules. It may narrow rights
  or change a route, but it cannot exceed the other three ceilings.
- `FULL_CONTROL` maps to the existing dangerous
  `RAMPAGE_FULL_CONTROL_LAB` Builder profile. It may auto-route effective
  rights, but still cannot exceed the OS/host, assignment, or current-constraint
  ceilings. The plan does not activate that profile.

The compiler evaluates both the `SAFE_GUIDED` baseline and the selected
profile through the same Builder authority logic. `effectiveRightsDiff`
records added, removed, route-changed, and unchanged rights with their plane,
effect class, effective state, and route on both sides. Both source result
digests and the complete plan digest are emitted for readback.

## Verify locally

```bash
npm run build --silent
node --test dist/tests/resource-plane-profiles.test.js
```

The focused suite validates the output schema, all three profiles, every
ceiling, canonical ordering, the fail-closed negative matrix, and absence of
authority-bearing output.

## Evidence boundary

This is a local deterministic contract and schema. It does not inspect or
change host permissions, start a process or container, read a secret, invoke a
model/tool, access a device, configure a network, activate a profile, or prove
production fitness. Runtime enforcement and real environment evidence remain
separate future work.

