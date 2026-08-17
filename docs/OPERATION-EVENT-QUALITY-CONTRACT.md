---
title: Operation event and quality evidence contract
description: Freeze PANSPHAIRA's synthetic CM-OBS operation/event/quality evidence semantics without enabling collection or runtime authority.
---

# Operation event and quality evidence contract

CM-OBS-001 defines a closed, digest-bound event record for joining AWI,
Verification Fabric, Development Worker, Learning Router and future BI or
Flight Recorder projections. It is a contract and fixture layer only: no
collector, dashboard authority, runtime activation, production telemetry,
provider call or customer/employee evidence lane is introduced.

## Frozen semantics

The record binds:

- operation, run, attempt, trace and optional correlation identities;
- event, observed and ingest times;
- producer sequence, replay window, previous-event digest and raw evidence
  digest/reference;
- explicit missingness status and reason codes;
- quality state, purpose-bound fitness and append-only assessment digest;
- public/owner-derived retention classification, minimization and rollback
  profile; and
- a canonical record digest plus an explicit no-runtime claim boundary.

Raw evidence is never stored in the public fixture. The retained public
surface is limited to digests, reason codes, fixed vocabulary and synthetic
references such as `obs-fixture:*`.

## Fail-closed rules

Unknown fields and seeded sensitive field names fail closed. Missing or
provisional records require explicit reason codes and expected time. Late
records outside the replay window require `PROVISIONAL`,
`LATE_OBSERVED_EVENT` and a non-pass quality state. Public synthetic retention
cannot point at owner-private raw evidence. `PASS` requires present evidence
and purpose fitness.

## Reproduce the local evidence

```bash
npm run build
node --test dist/tests/operation-event-quality.test.js
```

Rollback/fallback: disable any OBS projection/profile and fail closed to the
existing AWI, Verification Fabric, Development Worker and Learning Router
contracts. This contract is not proof of production readiness or active
authority.
