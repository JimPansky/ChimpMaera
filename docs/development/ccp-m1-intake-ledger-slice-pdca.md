# CCP-M1 contribution-intake ledger sub-slice PDCA

Status: bounded local repair candidate in the isolated Issue #52 worktree. It
is not committed, published, merged, released, deployed, production-operated
or proven by CI. Evidence recorded here is from this repaired worktree only;
historical Flash lane results are not carried forward as current proof.

## Plan

Close one missing CCP-M1 trust boundary: deterministic in-memory
classification of a single contribution's deliveries under an explicit,
caller-prevalidated tenant, repository, contribution, actor and authority
context. Preserve INTAKE-001, Verification Fabric, all current-main Issue #53
bytes and their bindings. Do not add transport, persistence or execution
effects.

An unkeyed SHA-256 chain proves deterministic consistency only. It does not
authenticate an identity, resist rollback, establish trusted time, prove Git
ancestry or GitHub delivery, or grant production authority. In particular, a
wholly replaced submitted-evidence record and entirely recomputed coherent
history is not authenticated provenance; detecting that requires separately
trusted external evidence outside this slice.

## Do

The contract now uses field-specific identity namespaces, canonical
domain-separated digests and an opaque verified-ledger boundary. Creation,
verification, ingest, classification and queries require an explicit branded
trust context. Serialized ledgers are accepted only after exact descriptor
validation, clone/freeze normalization and semantic replay of every transition
from genesis. Replay re-derives delivery-ID reuse, context/authority decisions,
disposition, ordered reasons, quarantine, replacement, timestamp and head
state. Ledger entries and receipts always retain the prevalidated context's
canonical identities, including for rejected deliveries. Each entry also
retains a closed `authoritative: false` submitted-identity evidence record for
the original ledger, tenant, repository, contribution, actor,
authority-evidence and authority-scope tuple. The evidence is cloned, frozen,
schema-closed and bound into its own digest plus the delivery, entry and ledger
chain; receipts carry the same evidence and digest binding. Replay reconstructs
the submitted delivery identity from that non-authoritative evidence and
re-derives its delivery digest, identity binding, disposition, ordered reasons,
quarantine and head effect. Receipt verification reconstructs the expected
receipt from its matched verified entry and evidence. Submitted evidence never
becomes ledger identity or establishes authority.

The JavaScript boundary rejects accessors, symbols, dangerous or
non-enumerable keys, non-ordinary/sparse/custom arrays, cycles and unsafe
aliases. Normalized contexts, ledgers, entries, reason arrays, receipts,
results and exported arrays are immutable. Invalid inputs are not mutated;
only a semantically quarantined distinct delivery intentionally returns an
appended ledger value.

Final path accounting is exactly eleven paths: the selected eight paths
(`docs/development/ccp-m1-intake-ledger-slice-pdca.md`,
`packages/contracts/src/contribution-intake-ledger.ts`,
`packages/contracts/src/index.ts`, `release/public-files.manifest`,
`schemas/contracts/contribution-intake-ledger-v1.schema.json`,
`scripts/build-public-release.sh`, `tests/contribution-intake-ledger.test.ts`,
and `tests/release-governance.test.mjs`) plus the three mandatory repository
integrations (`package.json`, `verification/verification-dag-v2.json`, and
`SHA256SUMS`). The three new public artifacts are contract, schema and focused
test. This private development PDCA remains outside the public manifest.

## Check

The focused suite contains 27 tests. It includes deterministic 10/50/100-value
fixtures, independent golden canonical-byte/SHA-256 vectors, correctly ordered
independent attack rehashing, semantically impossible but correctly rehashed
histories, safe-integer/schema parity, context substitution, forged ledger and
receipt claims, immutable constants, descriptor/array/cycle/alias attacks and
invalid helper calls. The integrity regression begins with a real foreign-tenant
rejection, retains its foreign submitted evidence, retags it as context-match
and accepted, recomputes every public digest, and proves both ledger and receipt
verification still deny it while exact foreign-delivery redelivery remains a
transport duplicate. The 10/50/100 fixtures prove only deterministic
in-process array processing; they are not load or capacity evidence.

Final deterministic gate outcomes in this worktree:

- `npm run build` and `npm run lint`: PASS;
- focused source execution: 27/27 PASS; authoritative npm wrapper: 1/1 file
  PASS;
- canonical runtime parity: 2/2 PASS; Verification Fabric v1: 3/3 PASS; v2:
  20/20 PASS with the 14-node graph at version 8 after integrity refresh;
- release governance: 35/35 PASS and verifier PASS; public manifest count:
  exactly 511; supply-chain verifier: PASS;
- root integrity: 605/605 PASS; deterministic public-release builder: two
  isolated builds PASS with matching archive SHA-256; and
- `git diff --check`: PASS for the resolved working-tree bytes.

The authoritative `npm test` was attempted without weakening it. Its pretest
was sandbox-blocked by unchanged loopback access (`fetch failed`, `connect
EPERM 127.0.0.1:8080`). Running the main command without lifecycle hooks
produced 61/68 passing test-file wrappers; the seven failed wrappers were
unchanged listener or child-operation cases (`listen EPERM 127.0.0.1`,
`spawnSync docker EPERM`, and sandbox-denied child Node invocations that
returned empty stdout). The tests and scanners were not changed to mask those
environmental failures. A fresh unrestricted host gate and Finalization 3
remain mandatory.

## Act and nonclaims

Rollback is a single orchestrator-owned revert of these eleven paths before
publication; there is no runtime state, migration, external effect or cleanup
to reverse.

The orchestrator resolved both files. The current worktree and index have zero
unmerged paths, and the resolved 511-count bytes remain present.

No claim is made about events/hour, persistence, crash recovery, concurrency,
throughput, memory, cost, fairness, queue age, recovery SLOs, real CI slots,
Git ancestry, GitHub delivery, webhooks, runners, queues, caches, merge trains,
promotion, LKG fallback, automatic merge, deployment, production operation or
production capacity. The unkeyed chain does not detect a complete coherent
rewrite in which the submitted evidence itself is wholly replaced; separately
trusted external evidence is outside this slice and remains required for
authenticated provenance. This does not complete Issue #52.
