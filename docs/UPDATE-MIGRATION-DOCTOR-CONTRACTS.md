---
title: Update, migration, and Doctor contract freeze
description: Inspect the immutable, authority-free contracts shared by later maintenance workflows.
---

# Update, migration, and Doctor contract freeze

ChimpMaera provides a closed, local-synthetic contract surface for inspecting
maintenance inputs before any state-changing workflow is considered. The
contract freeze is additive to the released check-only Update/Doctor v1
surface; it does not change those earlier bytes.

## What is frozen

The installation lock identifies six explicit version axes:

1. Core
2. Packs
3. Adapters
4. Policies
5. Schemas
6. Generations

Every axis contains exact semantic versions and SHA-256 component digests.
The lock also binds the authority profile digest. Mutable targets such as
`latest` and version ranges are rejected.

The compatibility profile binds the exact lock and one version requirement
for every axis. Unresolved or mutable inputs and any added or removed
authority deny validation. The immutable operation plan can only describe
`CHECK_UPDATE`, `PREVIEW_MIGRATION`, or `DOCTOR`; its
`executionAuthorized` value is always `false`.

The receipt proves only that the contract set was validated. Before and after
lock digests must be identical and `mutationObserved` is always `false`.
The Doctor report is read-only and exposes only fixed status and reason-code
vocabularies in its public projection.

## Verification

The pure parser accepts JSON text, validates closed object boundaries, binds
every artifact digest, checks all cross-contract references, and renders one
canonical JSON representation. One hundred object-key reorderings must
produce identical bytes and a single bundle digest.

The negative matrix denies unsupported v2 input, unknown fields, mutable or
ranged versions, digest drift, hidden authority, unresolved compatibility,
execution claims, mutation claims, and a seeded disclosure channel. Fixture
content is parsed as data and is never executed.

## Boundary

This is a declarative contract freeze only. It performs no discovery, network
access, Docker operation, package installation, update apply, migration,
repair, pointer write, service change, or owner-state mutation. Schema
conformance is not execution authority, production readiness, or a support
commitment.

Later executable maintenance work requires its own least-privilege design,
independent evidence, rollback proof, and review gate.
