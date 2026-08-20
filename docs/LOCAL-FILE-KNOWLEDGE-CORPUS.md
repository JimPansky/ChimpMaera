---
title: Local file knowledge corpus
description: Inspect the bounded read-only Markdown and text corpus adapter, exact citations, edition lifecycle, query receipts, conflicts, and non-claims.
---

# Local file knowledge corpus

LKC-FILES-01 is a default-off, read-only adapter for one explicitly declared
directory of UTF-8 Markdown and plain-text files. A closed profile pins every
relative path, content digest, licence, permitted use and shared-source ID.
Missing, extra, symlinked, non-regular, non-UTF-8 or digest-drifted files fail
before an edition is exposed.

## Deterministic edition and query

Materialization records the raw file digest and a digest-bound chunk for each
non-empty source line. Citations are exact `path#Lx` selectors. The root and
manifest digests bind the complete sorted edition. Lexical queries normalize a
closed ASCII token set, sort matches deterministically and return a receipt
bound to the exact edition, chunks, licence, permitted use, shared sources and
visible contradiction/source-dependency links.

The two checked-in synthetic editions demonstrate an immutable successor. An
accepted edition may change only when its `priorEditionId` names the exact
current edition. Injected failures after validation or staging return the exact
accepted/LKG pair and an empty residue list.

## Authority and limits

The fixed boundary is
`READ_ONLY_LOCAL_UTF8_TEXT_NO_NETWORK_DOWNLOAD_WRITE_EXECUTION_OR_TRUTH_AUTHORITY`.
The adapter performs local reads only. It has no network, download, write,
execution, credential, policy, capability, publication or truth authority.

This slice does not support PDF/OCR, Kiwix/ZIM, Wikimedia/MediaWiki, downloads,
LLM retrieval, embeddings or general semantic ranking. It does not establish
global truth, corpus quality, production capacity, representative performance,
customer-data fitness or production readiness.
