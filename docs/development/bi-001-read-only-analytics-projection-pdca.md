# BI-001 read-only Power BI analytics projection PDCA / ADR

Status: implemented and verified locally with a synthetic contract; not
imported, deployed, refreshed, published, certified or production-ready.

## Plan

Freeze a local, synthetic, strictly read-only `chimpmaera.analytics/v1`
projection contract that selects a default Power BI analytics lane with
explicit trade-offs and a bounded fallback. The projection must be
reviewable as a single unified diff against the pinned base commit
`2a880dd041e204187edcb8d8ae0f30d12b9d6b95` and must not mutate runtime,
cloud, tenant, release, deployment, publication, or external-system
state.

### Decision

Select **Import-mode SQL/ADLS/Fabric** as the default analytics lane and
**Dataverse Import** as the bounded fallback. REST/Power Query remains
deferred; a fixed-resource Power Query M connector is not implemented in
this slice because REST is not the selected default. **DirectQuery is
denied** until separately measured M1 evidence justifies it.

### Comparison matrix

| Criterion | Dataverse | SQL/ADLS/Fabric (selected default) | REST/Power Query (deferred) |
|---|---|---|---|
| Volume | Low–moderate; bounded by table row limits | Moderate–high; warehouse/lakehouse scales with Fabric capacity | Variable; throttled by endpoint |
| Latency | Near-real-time via DirectQuery (denied without proof) | Scheduled import; minutes-to-hours refresh cadence | Depends on endpoint response time |
| Data class | Structured business tables from Power Platform | Transformed semantic model curated by data engineering | API-shaped reads; schema negotiated by connector |
| Residency | Power Platform tenant region | Lakehouse/warehouse tenant region; ADLS geo may differ | Caller-managed; depends on REST host |
| Refresh | Automatic for Dataverse-linked tables | Scheduled import; on-demand refresh supported | Manual or scheduled; connector-dependent |
| Gateway | Not required for cloud Dataverse | Required for on-premises SQL; optional for cloud SQL | Required for on-premises REST endpoints |
| Cost | Included in Power Platform licensing | Fabric capacity or dedicated SQL compute | Connector development plus API call costs |
| Ownership | Power Platform admin owns schema and access | Data engineering owns semantic model; BI owns reports | BI developer / connector owner owns transform logic |

### Rationale for default selection

SQL/ADLS/Fabric Import is selected as the default because it provides the
best balance of moderate-to-high volume capacity, scheduled refresh
cadence suitable for analytics, clear data-engineering ownership, and
predictable cost within existing Fabric capacity. Import mode avoids
live-query latency and throttling risks that would require separately
measured evidence. Dataverse Import is a bounded fallback for
low-volume, near-real-time scenarios where the Dataverse-linked table
refresh is sufficient and no gateway is required.

### Fallback

**Dataverse Import** is the bounded fallback lane. It applies when the
default lane is unavailable (for example, Fabric capacity is not
provisioned) and the data volume is low enough that Dataverse table row
limits are not exceeded. DirectQuery to Dataverse remains denied until
M1 evidence demonstrates acceptable latency and throttling behaviour.

### DirectQuery constraint

DirectQuery is denied in the frozen contract
(`directQueryAllowed: false`, `directQueryJustificationRequired: true`,
`directQueryEvidenceMeasurements: []`). Enabling DirectQuery requires
separately measured M1 evidence covering latency, throttling, gateway
impact, cost, and tenant compatibility. Until that evidence exists and
is recorded, the verifier rejects any projection that sets
`directQueryAllowed` to `true`.

## Do

### Files added

- `packages/contracts/src/analytics-projection.ts` — frozen contract
  types, digest function, and verifier.
- `schemas/contracts/chimpmaera-analytics-v1.schema.json` — strict JSON
  Schema (Draft 2020-12) with `const` values for every frozen field.
- `tests/fixtures/analytics/positive-projection-v1.json` — synthetic,
  public-safe, read-only, lineage-complete, versioned, redacted,
  receipt-bound, non-authoritative positive fixture.
- `tests/fixtures/analytics/negative-matrix-v1.json` — table-driven
  negative fixtures covering 34 denial cases.
- `tests/analytics-projection.test.ts` — focused tests for positive
  acceptance, canonical digest stability across 100 reorderings,
  negative matrix, digest forgery, and schema drift.
- `docs/development/bi-001-read-only-analytics-projection-pdca.md` —
  this document.

### Files modified

- `packages/contracts/src/index.ts` — re-exports the analytics projection
  module.
- `release/public-files.manifest` — registers every added public source,
  schema, fixture, and test. The ADR itself is repository development
  evidence and is intentionally not registered as a public-release
  manifest source because the supply-chain verifier forbids every
  public source beginning `docs/development/`.

### Non-authoritative boundary

The projection is explicitly incapable of policy, approval, action,
system-of-record, credential, secret, raw-evidence, or mutable-policy
semantics. The `authorityBoundary` object freezes every authority plane
to `false`, including `arbitraryHostAllowed`, `arbitraryPathAllowed`,
and `writeSemanticsAllowed`. The verifier rejects any projection that
claims authority in any of these dimensions.

### Compatibility claims boundary

Desktop, gateway, service, tenant, performance, cost, and compatibility
claims are explicitly unproven until isolated M1 evidence exists. The
`compatibilityClaims` object freezes every claim to `false`. The verifier
rejects any projection that asserts a proven compatibility or
performance claim.

### External source reuse

This slice reuses no external source code, samples, or tooling.
Therefore no upstream SHA/license binding is applicable to the
candidate. No upstream commits or factual product guarantees are
invented or claimed.

## Check

### Schema and verifier

The JSON Schema uses `additionalProperties: false` at the top level and
`const` for every frozen field. The verifier checks exact top-level
keys, exact nested-object content via canonical-JSON comparison, and a
canonical digest that excludes the `projectionDigest` field. Unknown
fields and semantic expansion are rejected.

### Canonical digest stability

The canonical digest is computed over the canonical JSON of the
projection content excluding `projectionDigest`. Because `canonicalJson`
recursively sorts object keys, the digest is stable across at least 100
object-key reorderings. This is verified in the focused test suite.

### Negative matrix coverage

The negative matrix covers 34 cases spanning authority denial, write
semantics, generic host/path override, raw evidence, secrets and
credentials, mutable policy, missing lineage, missing stable keys,
missing receipt binding, invalid classification, invalid timestamps,
invalid redaction, schema drift, false compatibility claims, and
DirectQuery without measured proof.

### Positive fixture

The positive fixture is synthetic (all digests are placeholder hex
strings), public-safe (no real credentials or secrets), read-only (no
write semantics), lineage-complete (source contract schema version and
digest bound to the verification fabric), versioned (`chimpmaera.analytics/v1`,
`1.0.0`), redacted (`rawEvidenceIncluded: false`, excluded and hashed
fields enumerated), receipt-bound (receipt schema version, operation
key, and digest recorded), and non-authoritative (every authority plane
is `false`).

## Act

### Migration and rollback

The change is purely additive: new files are created and two existing
files are extended with non-breaking re-exports and manifest entries.
Rollback is performed by removing the added files and reverting the
`index.ts` and `release/public-files.manifest` changes. No data
migration, no configuration change, and no external-system action is
required.

### Review triggers

- First tenant sandbox deployment (requires M1 evidence).
- DirectQuery justification submission (requires measured latency,
  throttling, gateway, cost, and tenant compatibility data).
- Schema version bump from `chimpmaera.analytics/v1` (requires a new
  ADR and a frozen successor contract).
- Any change to the authority boundary or compatibility claims (requires
  M1 evidence and ADR update).

### Risk and claim boundary

The contract is local and synthetic. No Desktop, gateway, service,
tenant, performance, cost, or compatibility claim is proven. No
dependency is added or changed. No symlink is introduced. No
external-system mutation occurs. All changed paths are within the
allowed set.

### Conditional REST / Power Query M-connector constraints

A Power Query M connector implementation is deferred because REST is
not the selected default in this bounded slice. If REST is selected in
a future slice, the connector must: (1) bind to the frozen
`chimpmaera.analytics/v1` schema, (2) enforce the non-authoritative
boundary, (3) deny arbitrary host/path override, (4) exclude raw
evidence and secrets, and (5) remain read-only with no write methods.
These constraints are recorded in the frozen contract and will be
enforced by the verifier when the connector is implemented.
