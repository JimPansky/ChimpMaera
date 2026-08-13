# BI-003 synthetic ERP read-only connector

This L2 slice adds a typed local-synthetic ERP reader to BI-001 and remains off
by default. It is complementary to BI-002; the CRM v1 contract is unchanged.
It contacts no vendor, accepts no endpoint, stores no credential, exposes no
service, and has no posting, approval, write, admin, or database-query path.

## Supported claims and contract

`chimpmaera.connector/erp-read/v1` freezes one supported-export/API-shaped
adapter, tenant `tenant:synthetic-zoo`, principal `principal:bi-m1-reader`, and
the exact scope `erp.synthetic.bi.read`. The only operations are
`LIST_CUSTOMERS`, `LIST_ORDERS`, `LIST_INVOICES`, and entity-explicit
`READ_SOURCE_FACTS`. BI-M1 receives only:

- customer: `customerId`, `customerStatus`
- order: `orderId`, `customerId`, `orderStatus`, `orderDate`, `totalMinor`,
  `currency`
- invoice: `invoiceId`, `orderId`, `customerId`, `invoiceStatus`, `issueDate`,
  `dueDate`, `totalMinor`, `currency`

Amounts are non-negative integer minor units in synthetic EUR facts. This is a
representation rule, not a claim of accounting, tax, payment, reconciliation,
or financial correctness. Every read page preserves tenant, local-synthetic
trust, principal/scope, export and dataset lineage, generation/expiry times,
contributing batch IDs, source record ID/update time/sequence, page metadata,
and a digest over the exact returned facts and metadata. Export order is stable;
cursors bind the source digest and entity and are single-use per adapter.

## Threat boundary and fail-closed behavior

Activation and credential presence must both be explicit. Exact tenant,
principal, scope, operation, entity and ordered field declarations are required.
Create, post, approve, write, update, delete, admin, mutation-shaped keys,
database/SQL/table/dump shapes, field widening, scope widening, malformed or
digest-drifted exports, incomplete batches, stale data, replayed cursors, and
foreign source/entity cursors return only a denial code. There is no broad query
or permissive fallback.

The boundary validates checked-in inputs and calls within one local process. It
does not defend against a process that can replace memory after validation and
does not model provider transport. Fixtures contain synthetic identifiers only:
no secrets, people, real customers, real financial records, production IDs,
private infrastructure, or exploit detail.

## Verification, fallback, and rollback

Run focused verification with:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run erp-read:test
npm run crm-read:test
npm run external-bi-service:test
npm run lint
npm run release-governance:verify
npm run supply-chain:verify
sha256sum -c SHA256SUMS
```

Evidence uses artifact digests and `CONTAINING_DCO_SIGNED_COMMIT`; it does not
claim a future commit SHA. Rollback is to keep/restore `erpConnector.enabled` to
`false`, discard only the ERP adapter instance and its scoped synthetic cache,
and revert BI-003. Never widen fields, scope, operations, database access, or
permissions as fallback. A future field need requires separately reviewed,
versioned additive work.

Non-claims: production ERP/vendor compatibility, live credentials, personal or
customer data, real financial records, posting/write/approval support, financial
correctness, real-time freshness, provider onboarding, service exposure,
deployment, image publication, production activation, infrastructure mutation,
availability, or performance.
