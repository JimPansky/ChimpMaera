# BI-005 cross-system dashboard and drill-through

Status: default-off, local-synthetic L1 read-only slice. BI-005 adds two small
rendered pages—KPI overview and reconciled-fact detail—over the accepted BI-004
V1 model. It does not alter BI-002, BI-003, or BI-004 and exposes no service,
provider transport, credential, action, or write path.

## Exact metric contract

The dashboard copies values from the BI-004 report. It never aggregates source
rows or evaluates formulas. A contract check binds all three displayed metrics
to model digest
`11c9a4c89b8fcee1a528fb6dbf339aa0460d4d8c02412d6330200e03c154913f`:

| KPI | Visible formula | Unit | Formula readback | Value readback |
| --- | --- | --- | --- | --- |
| `measure:crm-amount-minor` | `SUM(MATCHED.crm.amount_major * 100)` | `EUR_MINOR` | `/measures/0/formula` | `/kpis/crmAmountMinor` |
| `measure:erp-order-total-minor` | `SUM(MATCHED.erp.total_minor)` | `EUR_MINOR` | `/measures/1/formula` | `/kpis/erpOrderTotalMinor` |
| `measure:reconciliation-delta-minor` | `measure:crm-amount-minor - measure:erp-order-total-minor` | `EUR_MINOR` | `/measures/2/formula` | `/kpis/reconciliationDeltaMinor` |

Every displayed KPI card also renders its freshness state and timestamps,
local-synthetic trust, active filters, all known limitations, and exact BI-004
row lineage readback paths such as `/rows/0/lineage/crm`. Dataset, export,
batch, source-record, and digest values are converted to deterministic
12-hex-character references before display. Raw CRM opportunity IDs, ERP order
IDs, source record IDs, source digests, batches, datasets, and exports are
role-hidden.

## Filters and drill-through

The only accepted active filter tuple is:

```text
tenant=tenant:synthetic-zoo; currency=EUR; outcome=MATCHED
```

These values are the accepted BI-004 dimensions and KPI inclusion rule. Empty,
multi-value, foreign-tenant, other-currency, or other-outcome combinations are
`CONFLICTING_FILTERS`; no KPI or row is rendered. This intentionally narrow L1
filter is deterministic and does not imply generic slicing.

Drill-through accepts only a canonical ID already present among this report's
`MATCHED` rows. A selected row exposes the BI-004 CRM amount, ERP amount, delta,
currency, freshness, trust, and sanitized lineage. A foreign/absent canonical
ID is denied. A raw source-ID selector is `ROLE_HIDDEN_SOURCE_ID`, and any
dashboard/report/row tenant mismatch is `TENANT_MISMATCH`. There is no lookup
fallback, inferred join, role-hidden field, or cross-tenant result.

## Explicit states

| Rendered state | Deterministic cause | Display behavior |
| --- | --- | --- |
| `NORMAL / DASHBOARD_READY` | valid model/report/request with matched facts | KPI cards and available canonical drill controls |
| `EMPTY / NO_MATCHED_FACTS` | valid BI-004 zero KPI report with no matched rows | accepted zero KPI values; freshness, trust, and lineage explicitly unavailable |
| `STALE / STALE_MODEL` or `SOURCE_STALE` | model validation older than 3,600 seconds or BI-004 stale rows | status only; no KPI or drill row |
| `CONFLICT / CONFLICTING_FILTERS` | filter tuple differs from the frozen dimensions | status only; no fallback filter |
| `DENIED` | disabled, unauthorized, unknown metric, tenant/model mismatch, hidden-ID request, or inaccessible interaction | status only; no data |
| `ERROR` | unavailable source, missing data/lineage, report-integrity failure, or divide-by-zero attempt | status only; no derived substitute |

The rejection-only divide probe exists to prove that an attempted ratio with a
zero denominator cannot create a dashboard-side metric. No ratio is supported,
even with a nonzero denominator.

## Accessibility checks

The deterministic renderer uses a `main` landmark, ordered headings, labelled
sections and KPI articles, definition lists, status live regions, a captioned
table with scoped headers, native `button` drill controls, and meaningful
per-fact labels. The readback records keyboard order. Pointer-only interaction
is denied.

Color checks use the WCAG relative-luminance formula deterministically for the
frozen background/text, secondary text, link, and focus tokens. Normal text is
checked at 4.5:1 and the focus indicator at 3:1. These tests document bounded
contract properties only; they are not an accessibility audit or certification
and do not replace assistive-technology and user testing.

## Reproduce the rendered/readback evidence

Literal bitmap screenshots would add a browser, fonts, rasterizer, and
platform-sensitive pixels to this otherwise dependency-free contract slice.
BI-005 therefore uses the repository's conservative deterministic
rendered/readback convention: structured JSON containing the exact semantic
HTML, state, values, accessible structure, contrast results, mutation proof,
and digest.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run bi-dashboard:test
```

The focused command compiles, runs 10 tests, and verifies six checked-in
readbacks under `verification/bi-005-dashboard-readbacks/`: `normal`, `empty`,
`stale`, `conflict`, `denied`, and `error`. Regenerate intentionally with
`npm run build --silent && node scripts/render-bi-dashboard-evidence.mjs`, then
review the complete diff. The generator contains no network or source-system
call.

## Threat boundary, claims, and limitations

The implementation validates checked-in local-synthetic BI-004 model/report
bytes and a read request within one process. It detects report digest drift but
does not provide a signature or defend against a hostile process replacing
memory after validation. It does not model provider transport or production
tenant enforcement.

Supported claims are limited to a default-off typed dashboard contract, exact
BI-004 formula/value readback, visible KPI context, fixed deterministic filters,
tenant-safe canonical drill-through, sanitized lineage, six explicit states,
bounded semantic/keyboard/contrast checks, fail-closed local probes, and no
mutation operation.

Non-claims: no write-back or operational command surface, DMS dashboard,
executive forecast guarantee, production analytics service/SLA, real-time
guarantee, decision automation, financial assurance, accessibility
certification, live credential, personal or real financial data, provider
onboarding, service exposure, deployment, image publication, production
activation, or infrastructure mutation.

## Rollback and fallback

Keep/restore dashboard set `1.0.0` and semantic model `1.0.0` to disabled,
discard only derived dashboard readbacks, and return to the last verified
read-only BI-004 view. Never substitute an unverified metric, widen filters or
permissions, expose hidden lineage, or write a reconciliation decision to a
source. Review is required for any model digest, formula, KPI, filter,
freshness, role, visible/hidden field, sanitizer, interaction, contrast token,
or activation change.
