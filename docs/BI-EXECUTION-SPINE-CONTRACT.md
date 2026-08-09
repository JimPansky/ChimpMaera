---
title: Governed BI execution spine contract
description: Freeze ChimpMaera's synthetic BI intent, query, receipt, verification, claim and visualization contract without enabling BI runtime authority.
---

# Governed BI execution spine contract

CM-BI-EXEC-001 defines a closed, digest-bound contract for answering bounded
synthetic BI questions from minimized CRM, ERP and CM-OBS fixtures. It is a
contract and fixture layer only: no Superset, SQL Lab, DuckDB, Arrow, Pandera,
Vega-Lite, live connector, dashboard authority, provider call, production data
or customer/employee telemetry is introduced.

Delivery traceability: Draft PR
[#141](https://github.com/JimPansky/ChimpMaera/pull/141) declares `Closes #140`
for owning issue [#140](https://github.com/JimPansky/ChimpMaera/issues/140).

## Frozen semantics

The bundle binds exactly three synthetic PoC questions:

- CRM risk exposure by synthetic customer segment;
- ERP margin drift by synthetic product family; and
- CM-OBS operation quality exception rate.

Each question carries the same authority-free spine:

- typed agent intent and public-synthetic tenant boundary;
- explicit source digests, operation-quality digests, freshness and
  missingness reasons;
- semantic model id, version, entities, metric, unit, grain and formula
  digest;
- declarative aggregate query plan with arbitrary SQL, Python, shell, network,
  credential, live connector and dashboard authority denied;
- simulated execution receipt, verification report, bounded claim and
  non-authoritative visualization;
- deterministic question and bundle digests; and
- an explicit claim boundary saying this is not a runtime, dashboard or system
  of record.

## Fail-closed rules

Unknown fields and seeded sensitive field names fail closed. All questions must
be public synthetic, fresh, declaration-complete, privacy-verified and
receipt-bound. The verifier rejects stale nested artifact digests, a changed
question-to-source/metric/field mapping, sensitive values in otherwise allowed
text fields, and authority claims that contradict the explicit non-authority
enum. Missing lineage, stale sources, unsafe query capabilities, empty
receipts, unsupported visualization and authority claims are denied.

The source, operation-quality, formula and result digests are opaque references
in this contract fixture. Because their referenced source bytes, formula bytes
and result rows are intentionally absent, this verifier does not independently
recompute them or prove the declared formula, result or answer. It verifies the
closed contract shape, internally computable artifact/envelope digests and
declared synthetic boundary only.

## Reproduce the local evidence

```bash
npm run bi-execution-spine:test
```

Rollback/fallback: remove the additive BI execution spine files and fail closed
to the existing BI-M1 planning issues, the read-only analytics projection and
the CM-OBS evidence substrate. This pre-release contract candidate is not part
of the current regular release and is not proof of formula correctness, answer
correctness, production readiness, runtime performance, dashboard correctness
or active authority.
