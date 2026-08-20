# LKC-FILES-01 Issue #54 slice — PDCA / autonomous decision record

Status: implementation in an isolated unpublished worktree from protected main
`4f6d35c5ea95a00c3015c4d02e5d52a77384f004`.

## Plan

Deliver the bounded 80% vertical slice selected by the legacy milestone PDCA:
one closed read-only UTF-8 Markdown/Text directory profile, two immutable
synthetic editions, raw content and per-line chunk digests, exact file/line
citations, licence/permitted-use fields, deterministic lexical query receipts,
visible contradictions/shared-source dependence and exact Accepted/LKG
rollback with zero residue.

## Autonomous assumptions and controls

| Decision | Conservative assumption | Risk | Fallback | Review marker |
| --- | --- | --- | --- | --- |
| Format | Only LF-terminated UTF-8 `.md` and `.txt` regular files are admitted. | Real corpora use more formats or encodings. | Deny unsupported bytes; keep the adapter disabled. | PDF/OCR, HTML, ZIM, MediaWiki or encoding expansion. |
| Search | Exact normalized lexical token overlap is sufficient for this proof. | Ranking may be mistaken for semantic quality. | Expose score and citations; make no semantic-quality claim. | Embeddings, LLM retrieval or production relevance work. |
| Conflict input | A closed profile declares contradiction and shared-source edges. | Human declarations can be wrong or incomplete. | Keep edges visible and attributable; never infer truth. | Automated contradiction inference or external corpus use. |
| Lifecycle | A successor names the exact Accepted edition and retains the prior LKG. | Persistent/crash behavior is not proven. | Injected in-memory rollback returns exact LKG and zero staged residue. | Durable storage, concurrency, crash recovery or service activation. |

## Do

- Added a real read-only directory reader with closed-set, symlink, regular-file,
  UTF-8, LF and content-digest gates.
- Added deterministic edition, line-chunk, conflict/dependency and query-receipt
  contracts plus exact activation/LKG rollback.
- Added two synthetic editions and focused positive/negative/failure tests.

## Check

The completed local gate proves:

- focused corpus contract/schema/lifecycle/negative probes: 6/6;
- Knowledge Envelope, Plugin Harvest and Knowledge Quality regressions: 23/23;
- Verification Fabric v2, including graph-version 14 and the new critical
  owner: 22/22;
- documentation surface: 5/5; release governance: 44/44;
- lint, supply-chain verification, release-governance verification, root and
  nested checksum closure: pass;
- authoritative repository suite: 498/498 after the complete pretest chain;
- two isolated public-release builds with the same basename are byte-identical
  at SHA-256
  `0236a6667a72b86d602c6b1da729716d868bcdb77ca69ad3091d0cdceee88a47`.

Negative evidence was retained during the gate: the first uncommitted
Verification Fabric CLI attempt correctly fell back because the selector
compares commits, an initially omitted downstream owner expectation failed,
and graph expansion without advancing its version failed the existing
governance test. The inputs, expectation and graph version were corrected and
the complete gates rerun. Archive names must also match when comparing build
bytes because the top-level directory is part of the archive.

## Act

Rollback before publication is deletion of this additive module, schema, docs,
fixtures, tests and integration entries. Existing Knowledge Envelope, Knowledge
Quality and Plugin Harvest generations remain the LKG.

Non-claims: no PDF/OCR, Kiwix/Wikipedia, download, MediaWiki, LLM, embeddings,
global truth, semantic-quality, production-capacity, customer-data, deployment
or runtime-activation claim.
