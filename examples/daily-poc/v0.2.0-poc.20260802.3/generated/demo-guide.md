# Daily POC demo guide

Version: `v0.2.0-poc.20260802.3`

## USE-CASE-GOVERNED-COMPANY-DATA — Validate a synthetic company-data import plan before mutation

Inputs:

- A versioned synthetic Canonical Company Data Pack
- Its digest-pinned 88-object catalog, 90-node dependency graph and source blueprint
- A synthetic append-oriented Mapping Registry with exact target readbacks

Steps:

1. Validate the closed pack schema, forbidden fields, canonical and semantic identities and every pinned source digest.
2. Resolve graph references and cardinality, validate lifecycle/time/money/quantity/customer rules, classify six cycles and emit a deterministic 270-operation staged DAG.
3. Validate one active canonical-to-target binding per target/type/tenant, append digest lineage, provenance, exact readback and explicit stale/orphan/superseded/compensated states.

Expected outcomes:

- The coherent synthetic pack passes before any mutation is possible.
- Missing prerequisites, illegal transitions, time travel, cross-customer assets and unclassified cycles fail closed.
- 404 targets, type or semantic-key drift, replay tampering, name-only reuse and second active mappings fail closed.

Demo utility: Lets an operator inspect deterministic data-integrity and lineage receipts before a separately authorized target adapter is considered.

Evidence: EVID-DATA-001, EVID-DATA-002, EVID-DATA-003

## Reproduction

- `git diff --name-status 990ce39d5e87ade8d0a7a9792672887d128f647e..38f88a0ba3fc3b46497905fc292ae8599db3e5af`
- `npm ci --ignore-scripts --no-audit --no-fund`
- `npm run lint`
- `npm run company-data:test`
- `npm test`
- `npm run daily-poc:test`
- `npm run supply-chain:verify`
- `node demo/company-data/validate-company-data-pack.mjs`
- `node demo/company-data/validate-company-data-graph.mjs`
- `node demo/company-data/validate-mapping-registry.mjs`
