---
title: Default-off local usage insights
description: Run PanSphaira's consent-based local Usage Insights reference offline, or explicitly share minimal closed-schema signals with a loopback synthetic receiver.
---

# Default-off local usage insights

AWI-INSIGHTS-1 is PanSphaira's repository-local completion reference for Issue
#57. It combines the hardened in-memory event contract with a bounded local
store, transparent CLI consent, lifecycle controls, an explicitly enabled
loopback transport, and a small-cell-safe report. The reference uses only local
or synthetic data. It does not activate telemetry in a PanSphaira runtime.

Constructing the service or running `consent show`, `status`, `preview`,
`export`, or `report` does not create a state file or make a network request.
A fresh installation is `DISABLED`; network mode is always `OFF` until two
separate decisions have occurred:

**Default is OFF.** No import, constructor, read-only command, or local report
implicitly grants consent or enables transport.

1. the local owner grants one closed consent profile; and
2. the local owner explicitly enables one IP-literal loopback endpoint.

## Transparent consent profiles

The CLI reports the retained and prohibited data classes before consent. The
closed profiles are:

- `basic`: install, upgrade, and uninstall adoption outcomes;
- `capability`: basic signals plus first success and bounded running/stopped
  capability outcomes; and
- `diagnostics`: capability signals plus closed `ERROR`, `DENIED`, and rollback
  outcomes. Diagnostics requires an explicit TTL no longer than 24 hours.

Diagnostics expiry is evaluated on local access and fails closed: recording and
sharing stop, the endpoint is removed, and the underlying runtime is revoked.
There is no timer, daemon, background worker, or silent renewal.

```bash
npm run build
node dist/packages/usage-insights/src/cli.js consent show --store ./usage-insights-state.json
node dist/packages/usage-insights/src/cli.js consent grant \
  --profile capability --store ./usage-insights-state.json
node dist/packages/usage-insights/src/cli.js record \
  --capability capability.gateway --outcome INSTALL_STARTED \
  --store ./usage-insights-state.json
node dist/packages/usage-insights/src/cli.js preview --store ./usage-insights-state.json
```

## Bounded local lifecycle

The local state is one canonical JSON file, atomically replaced with mode
`0600`. The reference rejects symlinks, non-regular files, group/other access,
invalid digests, impossible runtime timelines, unsafe parent traversal, and
files larger than 4 MiB. The state contains only consent policy, the current
runtime epoch, at most one retry-stable pending batch, and at most 128 managed
share receipts.

Event, envelope, report, export, and state digests are **unkeyed** consistency
checks. They detect drift but are not an authenticity control and do not prove
origin authorization or provenance against coherent re-authoring by an actor
who can recompute the digests.

- `preview` shows exact local closed-vocabulary distinctions and sharing counts.
- `export` returns a defensive local-owner bundle without the configured
  endpoint. Copies created by the owner are outside subsequent managed erasure.
- `revoke` immediately denies recording and sharing, removes the active
  endpoint, and retains deletion receipts so previously shared synthetic data
  can still be erased deliberately.
- `delete` removes local state only when no managed shared batch remains.
- `delete --shared` first deletes every managed batch from its original
  loopback receiver using an independent opaque deletion token, then removes
  local state. Any receiver failure preserves the local receipts fail closed.

## Closed outbound boundary

Application callers submit only `capabilityId` and `lifecycleOutcome`; the
service supplies the fixed product ID, exact product version, input schema, and
policy timestamp. The in-memory contract rejects unknown keys, free text,
caller IDs, accessors, symbols, non-enumerables, dangerous keys, aliases,
cycles, proxies, sparse arrays, exotic prototypes, oversized structures, and
coercion hooks before reading values.

Outbound envelopes have exactly seven fields: fixed schema, closed profile,
one opaque deletion token, share timestamp, verified events, fixed claim
boundary, and canonical digest. Events have a closed schema containing only
runtime-minted opaque event/install pseudonyms, stable product/capability IDs,
the exact version, a closed lifecycle outcome, a policy timestamp, and a
digest. Prompts, chats, payloads, paths, file names, domains, customer data,
secrets, tenant IDs, user IDs, and other free-form identifiers have no outbound
field.

## Rotation, isolation, and replay

Each local store mints its installation pseudonym from secret CSPRNG entropy.
Separate synthetic tenant/installation stores do not share an identifier or
key. A successful share erases the old epoch before a fresh pseudonym becomes
observable. Rotation never carries old events into the new epoch.

Before transport, the exact envelope and deletion token are atomically stored
as the single pending batch. A lost acknowledgement therefore retries the same
bytes rather than minting a second correlatable batch. The synthetic receiver
is idempotent by deletion token. A deletion request contains one token only;
the client never sends tenant identity or a list linking rotated pseudonyms.

This is a computational unlinkability boundary under a correctly operating
CSPRNG and the stated hash assumptions. Timing, host, receiver, or other
ambient observations outside the reference can still correlate activity.

## Explicit loopback transport policy

Sharing supports only an exact `http://127.0.0.1:PORT/v1/usage-insights` or
`http://[::1]:PORT/v1/usage-insights` endpoint with an explicit non-privileged
port. HTTPS, DNS names, credentials, redirects, queries, fragments, alternate
paths, metadata addresses, ambiguous numeric hosts, and non-loopback addresses
are denied. The client follows no redirects, uses no environment proxy, and
caps/time-bounds receiver responses.

This narrow policy is intentional completion evidence for offline and opt-in
synthetic installations. It is not a production collector configuration.

## Local report and dashboard reference

`buildUsageInsightsReportV1()` produces these six metric families from verified
opt-in envelopes:

1. install-to-first-success;
2. bounded return/retention;
3. errors;
4. denials;
5. rollbacks; and
6. exact-version fragmentation.

Every report says `EXPLICIT_OPT_IN_ONLY` and
`PARTIAL_NON_REPRESENTATIVE_COHORT`, and carries the fixed nonclaims
`DOES_NOT_REPRESENT_ALL_INSTALLATIONS` and
`NO_PRODUCTION_OR_ADOPTION_CLAIM`. If the overall cohort, an eligible metric
cohort, a capability cell, or a version cell has fewer than five distinct
installation pseudonyms, the entire report is `SUPPRESSED`: installation count
and all metrics are `null`, with one fixed reason. This prevents cell labels,
multiplicity, or totals becoming a small-cell side channel.

`renderUsageInsightsDashboardV1()` renders only a validated report and retains
the cohort, coverage, and nonclaim labels. The CLI `report` command works
offline; a single-installation local report is correctly suppressed.

## Verification and nonclaims

```bash
npm run usage-insights:test
```

The focused matrix covers fresh network-off operation, all consent profiles,
TTL expiry, preview/export/revoke/delete, atomic reload and tamper rejection,
permissions/symlink/capacity controls, hostile descriptors and prohibited
fields, SSRF/endpoint denial, retry/replay, erase-before-expose rotation,
cross-store isolation, managed shared-data deletion, four-install suppression,
five-install publication, all six metric families, deterministic reports, and
real IP-loopback synthetic receiver E2E.

The evidence does not claim real users, representative adoption, an Internet
collector, production deployment, background telemetry, automatic remote
deletion, deletion of owner-created export copies, receiver authenticity,
privacy certification, or protection against ambient host/transport
correlation.

Completion claim boundary:
`DEFAULT_OFF_LOCAL_ONLY_UNLESS_EXPLICIT_LOOPBACK_OPT_IN_SYNTHETIC_REFERENCE_NO_PRODUCTION`.
