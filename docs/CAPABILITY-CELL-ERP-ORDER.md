---
title: Synthetic ERP order capability cell
description: Exercise erp.order.create v1 through exactly two semantically compatible local provider bindings with an exact profile switch, readback and rollback.
---

# Synthetic ERP order capability cell

CAP-CELL-ERP-01 is a bounded local proof for the existing
`erp.order.create` v1 catalogue action. It uses the existing inactive
Capability Cell catalogue entry as its action identity and follows the closed,
digest-bound replacement pattern established by Integration Profiles and the
ADD → REPLACE adaptability harness. It does not add a registry, activation
authority, policy chain or generic connector framework.

## Frozen bindings

Exactly two generated profiles are admitted:

| Profile | Synthetic provider request shape | Bound effective rights |
|---|---|---|
| `erp-order:synthetic-ledger-a` | `articleCode`, `units`, `clientRequest` | create, readback, compensating delete |
| `erp-order:synthetic-commerce-b` | `line.item`, `line.amount`, `idempotencyRef` | create, readback, compensating cancel |

Both profiles bind the exact catalogue action version and digest and freeze
the same meaning: discrete `EACH` units, one create, authoritative local
readback and one compensating rollback. Their request schemas, mappings and
provider rights differ; the consumer contract and target-neutral core do not.
The switch receipt records the exact old/new profile digests and a sorted
rights diff.

## Execution and failure boundary

The runtime is synchronous, in-memory and network-disabled. A successful
request creates one synthetic provider record, reads it back, binds the
readback into a deterministic receipt, and deletes/cancels it. The final
provider-state digest must equal the pre-effect digest. A consumed request ID
is replay-denied and cannot create a second record.

Unknown fields, catalogue drift, a changed semantic ID or unit meaning,
non-exact profile pointers, forged switch receipts and profile changes while
provider residue exists fail closed. Reset clears replay/receipt state and
restores the recorded LKG profile while returning only receipt digests as
detached evidence.

## Verify locally

```bash
npm run erp-order-cell:test
```

The suite proves schema/runtime agreement for exactly two synthetic profiles,
unchanged core/consumer source digests, exact switching and rights diff,
deterministic readback receipts, compensating rollback, replay denial,
double-run determinism and zero residue after reset.

## Claim boundary

Evidence class is `ADAPTED_LOCAL_SYNTHETIC` only. There is no live ERP or
provider, network, tenant, credential, customer record, deployment, migration,
production readiness, L4 proof or claim that arbitrary provider or accounting
semantics are equivalent.
