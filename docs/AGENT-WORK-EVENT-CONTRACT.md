---
title: Minimized agent-work event contract
description: Verify PANSPHAIRA's consented, digest-bound and deletion-aware synthetic agent-work record without enabling collection or telemetry.
---

# Minimized agent-work event contract

AWI-01 defines one closed, authority-free record for future process and
knowledge analysis. It classifies every retained field, binds source and
evidence digests, requires a finite consent purpose and retention window, and
models deletion as a payload-free tombstone.

This increment does **not** collect an event. It adds no collector, telemetry,
network route, background worker, training input, dashboard, production
ingestion or runtime activation.

## Minimized record

The record retains only:

- a pseudonymous record, actor and harness identity;
- a closed source kind, public/private classification and SHA-256 digest;
- a closed event kind, outcome, fixed reason codes and evidence digests;
- consent basis, status, finite purposes, grant/expiry and proof digest;
- owner-only or public-synthetic readback classification;
- finite retention policy plus deletion request, deadline and completion; and
- the exact claim boundary and canonical record digest.

Raw prompts, responses, messages, commands, content, paths, host/network
identifiers, tenant/user/session/job identifiers, credentials, secrets and
tokens are prohibited. Unknown fields fail closed as well.

## Consent, retention and deletion

`PUBLIC_SYNTHETIC` requires a `SYNTHETIC_FIXTURE` source, synthetic-fixture
consent, the `PUBLIC_REPRODUCIBILITY` purpose and `PUBLIC_SYNTHETIC` readback.
All other combinations deny public readback.

Retention is capped at 24 hours, 30 days or 90 days by the selected policy and
cannot extend beyond consent expiry. A withdrawn consent, expired retention or
explicit deletion request produces `DELETE_REQUIRED`; it does not perform the
deletion. A completed deletion has `payload: null` and a bounded tombstone.
Readback of that deleted record is denied.

## Reproduce the local evidence

```bash
npm run build
node --test dist/tests/agent-work-event.test.js
```

The focused suite proves the closed schema, 29 field classifications, 100
canonical object-key reorderings, all 16 prohibited-field denials, 11 named
cross-contract negatives, seven retention/deletion/readback cases and zero
seeded disclosure bytes in the public decision projection.

Claim boundary:
`DECLARATIVE_AGENT_WORK_EVENT_CONTRACT_ONLY_NO_COLLECTION_NO_TELEMETRY_NO_TRAINING_NO_PRODUCTION_INGESTION`.
