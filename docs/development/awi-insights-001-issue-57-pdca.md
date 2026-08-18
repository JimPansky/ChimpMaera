# AWI-INSIGHTS-1 Issue #57 bounded repair PDCA

Status: uncommitted issue-bound repair candidate under repository and host gate
review. This document records a developer reference slice that **Refs #57**. It
does not close or complete Issue #57 and is not released, deployed, or
production-activated.

## Plan

Reconcile the historical 17-path source onto the current PANSPHAIRA
protected-main successor while preserving the later #18, repository-cutover,
test, contract, release, and Verification DAG semantics. Keep the bounded
17-path scope and make no dependency, lockfile, workflow, container,
deployment, credential, version-identity, or external-service change.

Repair goals:

- reject hostile JavaScript property structures before value access;
- accept only identifier-free, closed-vocabulary runtime submissions;
- mint opaque event and installation identifiers with secret CSPRNG entropy;
- erase the prior epoch before exposing a rotated pseudonym;
- validate snapshot state and time relationships independently of redigesting;
- separate exact local preview from side-channel-safe public aggregation; and
- describe seven-day erasure as lazy-on-access, not scheduled or automatic.

## Do

The repaired runtime inspects own keys and data descriptors recursively and
rejects accessors, symbols, non-enumerables, dangerous keys, aliases, cycles,
proxies, sparse arrays, exotic prototypes, and oversized structures without
invoking getters, proxy traps, coercion hooks, or iterators.

Runtime event inputs carry no identity. Event IDs and installation pseudonyms
are minted internally; exported APIs reject caller installation IDs, caller
rotation entropy, and deterministic random-source options. Rotation uses fresh
secret entropy and performs erase-before-expose.

Snapshot capture adds the timestamp needed to validate creation, opt-in,
rotation, event, revocation, expiry, deletion, capture, and restore ordering.
Inner digests, bindings, versions, duplicates, outer structure, and outer digest
remain independently checked. Digests are unkeyed consistency evidence, not
authenticity or provenance.

Public aggregation uses all-or-nothing suppression whenever any cell has fewer
than five distinct opaque installation IDs. Exact local counts remain only in
the local preview. Suppressed output exposes neither exact totals, cell count,
nor suppression multiplicity.

## Check

Semantic source, schema, fixtures, tests, and documentation freeze before DAG
hashes and root checksums are refreshed. Required evidence includes build,
lint, focused adversarial regressions, full tests, docs, release governance,
supply-chain checks, Verification Fabric plan/shadow as applicable, two stable
integrity refreshes, and two isolated identical public archives with verified
internal checksums.

Historical candidate gate totals and hashes are not acceptance evidence after
integration. Host policy failures must be reported as blocked rather than
relabelled as passes.

## Act and nonclaims

Promotion is limited to a default-off developer contract/reference primitive.
Consent UX/profiles, durable consent/events/stable IDs, persistence,
background/shared-data deletion, transport, collector, ambient telemetry,
dashboard, authorization for local-owner export, deployment, production
readiness, representative cohorts, and whole-Issue delivery remain explicitly
out of scope. The seven-day path is lazy-on-access and makes no deletion-SLA
claim.

Fallback is to withhold the executable reference if the repaired boundary or
verification closure fails. Rollback is removal or later bounded reversion of
only this issue slice; no durable migration or deployed state exists here.

Claim boundary:
`USAGE_INSIGHTS_DEFAULT_OFF_IN_MEMORY_REFERENCE_NO_UX_NO_PERSISTENCE_NO_BACKGROUND_DELETION_NO_TRANSPORT_NO_PRODUCTION`.
