---
title: Default-off in-memory usage-insights reference
description: Review PANSPHAIRA's developer-facing, descriptor-safe usage-insights contract primitive without enabling collection, persistence, transport, or background work.
---

# Default-off in-memory usage-insights reference

AWI-INSIGHTS-1 is a bounded developer-facing contract and in-memory reference
primitive. It is one incomplete slice that **Refs #57**; Issue #57 remains open.
It does not deliver the issue's user-facing telemetry or insights feature.

Importing or constructing the module does not collect anything. A new runtime
is `DISABLED`, has no installation pseudonym, stores no events, and denies
recording and export until an in-process caller invokes `optIn()`.

## Closed input and descriptor-safe boundary

`record()` accepts an identifier-free input with exactly six fields: the fixed
input schema, fixed product and exact product version, one closed capability,
one closed lifecycle outcome, and a bounded integer occurrence time. It rejects
caller event IDs, installation IDs, digests, free text, and unknown fields.
Each identity epoch is capped at 4,096 stored records; further inputs fail
closed with `CAPACITY_DENIED` until rotation or deletion clears the epoch.

Before values are used, the unknown-input boundary recursively inspects
`Reflect.ownKeys` and every own property descriptor. It rejects accessors,
symbols, non-enumerables, dangerous keys, aliases, cycles, proxies, sparse
arrays, exotic prototypes, excessive depth or size, and unexpected fields.
Getters, proxy traps, coercion hooks, and caller iterators are not invoked.

Only the runtime mints `event:v1:<64 lowercase hex>` event IDs and
`sha256:<64 lowercase hex>` installation pseudonyms from `node:crypto`
randomness. Caller text cannot become either identity or a public label. Stored
records carry a canonical SHA-256 digest; the JSON Schema covers the
JSON-visible stored-record shape while runtime checks cover JavaScript property
semantics that JSON Schema cannot express.

## Local preview versus publishable aggregation

`preview()` is an exact process-local owner view. It reports exact local counts
and closed-vocabulary distinctions, but it implements no authorization decision
about who is an owner or who may export that view.

`aggregateUsageInsightsV1()` is the separate publishable projection. It
deduplicates exact opaque event IDs, rejects conflicting duplicates, and groups
only fully verified records. A cell is publishable only with five distinct
opaque installation IDs. If **any** cell is below that threshold, the complete
public projection is `SUPPRESSED`: exact event and installation totals are
`null`, cells are empty, and one fixed suppression reason is emitted. Thus it
does not reveal suppressed-label multiplicity, cell count, or a count-equivalent
side channel. An empty verified input is explicitly `EMPTY`.

The threshold does not authenticate installations. Aggregate labels say
`UNAUTHENTICATED_OPTED_IN_REFERENCE` and
`PARTIAL_OPT_IN_NON_REPRESENTATIVE`; forged pseudonyms remain possible because
this slice has no enrollment authority or collector.

## Rotation and current-epoch state

Opt-in and every rotation use fresh secret cryptographic randomness. Production
APIs reject caller-chosen installation IDs, rotation entropy, and deterministic
random-source options. On rotation the old epoch's events are erased before the
new pseudonym is assigned or returned. Export and snapshot contain only the
current pseudonym and current-epoch records.

This supports only a bounded **computational unlinkability** claim: given a
correctly operating CSPRNG whose output remains secret, and the assumed
preimage/collision resistance of SHA-256, the new pseudonym does not expose a
designed old/new link. It is not mathematical anonymity, and process, timing,
host, transport, or other ambient observations outside this module could still
link activity.

## Restore integrity and its limit

A snapshot records creation, opt-in, last rotation, revocation, deletion, event,
and capture times. Restore rejects time travel, impossible state/flag
combinations, events outside the current epoch, restore before capture,
cross-installation or version records, duplicates, invalid inner digests,
unexpected structures, and an invalid outer digest. Expired revoked state is
erased when restore accesses it.

The event and state digests are **unkeyed**. They can detect inconsistent or
accidental drift, but they are not an authenticity control and provide no
origin authorization or provenance against coherent re-authoring by someone
who can recompute all digests.

## Revocation and deletion

`revoke()` denies new recording immediately. It records a seven-day expiry for
the process-local state. There is no timer or scheduler: expiry is
**lazy-on-access**, and erasure happens only when a later runtime operation
observes that the expiry is due. This is not automatic or background deletion
and is not a wall-clock deletion SLA.

`deleteState()` immediately clears this runtime object's in-memory events and
pseudonym. Neither path can erase copies, snapshots, exports, or shared data
held elsewhere.

## Explicit nonclaims

This reference primitive provides none of the following:

- consent UX, user-visible controls, consent profiles, or profile management;
- durable consent, durable events, persistence, or a stable ID across restart;
- automatic/background deletion, a deletion SLA, or shared-data deletion;
- collector, transport, network submission, or ambient telemetry;
- dashboard, reporting product, or representative installation cohorts;
- authorization of local-owner preview or export;
- deployment, external-service integration, production readiness, or production
  security/capacity evidence; or
- complete telemetry/insights delivery or completion of Issue #57.

## Local verification

```bash
npm run build
node --test dist/tests/usage-insights.test.js
```

The focused regressions cover descriptor non-invocation, proxies, symbols,
non-enumerables, cycles, aliases, exotic and sparse structures, covert IDs,
suppression side channels, deterministic-seam misuse, rotation erasure,
redigested impossible snapshots, restore timing, immediate revocation, lazy
expiry, explicit deletion, and absence of a network surface.

Claim boundary:
`USAGE_INSIGHTS_DEFAULT_OFF_IN_MEMORY_REFERENCE_NO_UX_NO_PERSISTENCE_NO_BACKGROUND_DELETION_NO_TRANSPORT_NO_PRODUCTION`.
