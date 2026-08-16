# BI-004 deterministic semantic reconciliation

Status: local-synthetic L2 contract slice. BI-004 adds a default-off semantic
model and reconciliation function over selected BI-002 CRM opportunity and
BI-003 ERP order facts. It does not change either public V1 connector contract.

## Frozen model V1

`chimpmaera.bi/semantic-model/v1`, model version `1.0.0`, defines CRM
opportunity, ERP order, and canonical revenue-fact entities. The only join is an
explicit declared source-ID pair with zero-or-one cardinality on both sides.
Canonical IDs are SHA-256-derived from tenant plus both declared source IDs.
There is no name, fuzzy, probabilistic, or inferred merge.

Dimensions are tenant, EUR currency, and reconciliation outcome. Measures are:

| Measure | Unit | Exact formula |
| --- | --- | --- |
| `measure:crm-amount-minor` | EUR minor | `SUM(MATCHED.crm.amount_major * 100)` |
| `measure:erp-order-total-minor` | EUR minor | `SUM(MATCHED.erp.total_minor)` |
| `measure:reconciliation-delta-minor` | EUR minor | `measure:crm-amount-minor - measure:erp-order-total-minor` |

Tolerance is exactly zero minor units. Only `MATCHED` rows contribute. The
model digest binds every entity, relationship, dimension, formula, and policy.
Formula drift or an unknown model/input/source schema fails closed.

## Reconciliation outcome matrix

| Outcome | Deterministic condition | KPI treatment | Mutation |
| --- | --- | --- | --- |
| `MATCHED` | exactly one declared pair, unique IDs, equal EUR minor values | included | none |
| `UNMATCHED` | source fact has no complete declared pair | excluded | none |
| `AMBIGUOUS` | a source ID has multiple declared candidates | excluded | none |
| `DUPLICATE` | a source ID occurs more than once | excluded | none |
| `STALE` | either export exceeds expiry or 3,600-second age | excluded | none |
| `CONFLICTING` | unique pair has unequal amount/unit/currency | excluded | none; conflict remains explicit |

Tenant mismatch, missing lineage, nulls, unsupported fields, invalid units,
unknown versions, and malformed source metadata are denied at the gate. A
currency outside frozen EUR is `CURRENCY_UNIT_MISMATCH`; it is never converted.

## KPI recomputation and lineage readback

The positive synthetic fixture binds the CRM batch/dataset/digest and ERP
batch/source-record/dataset/digest for every row. It recomputes:

| KPI | CRM source readback | ERP source readback | Result |
| --- | --- | --- | --- |
| CRM amount minor | opportunities `habitat-001`, `water-002`, `care-003` | paired orders 001–003 | 8,750,000 |
| ERP order total minor | the same three opportunity IDs | ERP source records `order-001`–`order-003` | 8,750,000 |
| reconciliation delta minor | all nine emitted source/readback IDs | both digest-bound exports | 0 (exact, tolerance 0) |

Every output row retains tenant, both primary source IDs, ERP source-record ID,
batch IDs, source timestamps, export IDs, dataset IDs, source digests, and trust.
The report records an empty attempted-operation list, both write policies as
false, and equal before/after input digests. The pipeline exposes no source
adapter or write operation, so BI cannot write reconciliation decisions back.

Run `npm run bi-semantic:test`. Evidence is deterministic, sanitized, and bound
to the containing DCO-signed commit through
`verification/bi-004-semantic-reconciliation-evidence-v1.json`.

## Rollback and boundaries

Disable candidate model version `1.0.0` (the default), discard only derived
reports, and restore the last verified CRM/ERP V1 contracts. Unresolved rows
remain explicit; rollback does not edit either source.

Non-claims: no probabilistic auto-merge, master-data/source write-back, DMS
data, compliance assertion, accounting/financial/audit opinion, silent conflict
resolution, production CRM/ERP data or compatibility, live credentials,
universal schema compatibility, provider onboarding, deployment, service
exposure, or infrastructure mutation.
