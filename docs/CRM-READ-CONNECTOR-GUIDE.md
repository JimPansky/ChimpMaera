# BI-002 synthetic CRM read-only connector

This additive L2 slice is a typed, local synthetic connector for the BI-M1
account and opportunity facts. It is off by default. It does not contact a CRM,
accept a provider URL, store a credential, expose a service, or implement any
write/admin operation.

## Supported contract

`chimpmaera.connector/crm-read/v1` fixes one supported-export/API-shaped
adapter, tenant `tenant:synthetic-zoo`, principal `principal:bi-m1-reader`, and
scope `crm.synthetic.bi.read`. Documented operations are `LIST_ACCOUNTS`,
`LIST_OPPORTUNITIES`, and `READ_SOURCE_FACTS`. BI-M1 receives only:

- account: `accountId`, `accountName`, `industry`
- opportunity: `opportunityId`, `accountId`, `opportunityName`, `stage`,
  `amount`, `currency`, `expectedCloseDate`

Every successful page preserves synthetic trust, tenant, export/dataset/source
lineage, generated/expiry freshness, contributing batch IDs, record/page count,
cursor, and a digest over the exact returned facts plus metadata. Pages are
ordered exactly as the supported export. Cursors bind the source digest and
entity and are single-use within an adapter instance.

## Fail-closed boundary

Activation must be explicit in code; the BI-001 example config remains
`crmConnector.enabled: false`. Missing credentials, tenant/principal mismatch,
scope widening, undeclared fields, unknown or mutation-shaped operations,
mutation-shaped request keys, malformed/digest-drifted exports, incomplete
batches, stale data, replayed cursors and cursors from another source/entity are
denied without records. No permissive fallback exists.

Fixtures are synthetic and contain no raw secrets, people, customers,
production identifiers, private endpoints, or exploit instructions. The threat
boundary covers validation of checked-in adapter inputs and calls, not a hostile
process that can modify memory after validation or a real provider transport.

## Verify and roll back

Run `npm run crm-read:test`, `npm run bi-foundation:test`, and the repository
integrity/release gates required by the delivery. Evidence is bound to file
digests and the containing DCO-signed commit; it does not predeclare a future
SHA.

Rollback disables the connector (the default), removes only its scoped
synthetic in-memory cache/adapter instance, and reverts the BI-002 files. Never
widen permissions or switch to an arbitrary endpoint as fallback.

Non-claims: production CRM/vendor compatibility, live credentials, personal or
customer data, real-time freshness, provider onboarding, deployment, service
exposure, image publication, production activation, infrastructure mutation,
availability, performance, or write support.
