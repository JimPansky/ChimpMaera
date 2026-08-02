# Governed canonical company data validation

ChimpMaera includes a local, synthetic Canonical Company Data Pack and a fail-closed validator. It validates the JSON Schema, forbidden field names, canonical and semantic identity uniqueness, and digest-pinned catalog, dependency-graph and source-blueprint bytes before any mutation can be considered.

```bash
node demo/company-data/validate-company-data-pack.mjs
node demo/company-data/validate-company-data-graph.mjs
```

The graph validator verifies all 90 graph nodes, 88/88 source-catalog coverage, references and cardinality, six classified cycles, lifecycle/time/money/quantity/customer rules and emits a deterministic staged DAG. Both receipts always declare `authority: NONE`, `claim: VALIDATION_ONLY`, `mutationAllowed: false` and `mutationCount: 0`. A denial is evidence that input was rejected; it is not an authority or target-system result.

This slice is not a generic ETL, MDM or workflow platform. It performs no direct business-database writes, proves no production-provider compatibility and makes no statutory accounting, tax, banking, certified-EDI or production-DMS claim.
