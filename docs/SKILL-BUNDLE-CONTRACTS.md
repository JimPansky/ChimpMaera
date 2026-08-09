# Skill Bundle Canonical Contracts

Status: **LOCALLY VALIDATED CONTRACT CANDIDATE; NOT INSTALLATION OR ACTIVATION AUTHORITY**

Issue #41 / ASF-01 defines the canonical Skill Bundle manifest, immutable lock
tuple and compatibility fence used by generation, analysis, installation and
rollback consumers. The contract is intentionally narrower than the managed
skill lifecycle runtime: it names exact content identities and verification
rules only. It does not install, activate, publish, auto-update, grant
capabilities or contact a registry.

## Contract Surface

The public schemas are:

- [`schemas/contracts/skill-bundle-manifest-v1.schema.json`](../schemas/contracts/skill-bundle-manifest-v1.schema.json)
- [`schemas/contracts/skill-bundle-lock-v1.schema.json`](../schemas/contracts/skill-bundle-lock-v1.schema.json)

The implementation is
[`packages/contracts/src/skill-bundle.ts`](../packages/contracts/src/skill-bundle.ts).
The manifest schema version is `chimpmaera.skill-bundle/manifest/v1`; the lock
schema version is `chimpmaera.skill-bundle/lock/v1`. Unknown fields, unknown
versions, unresolved placeholders, mutable locators, unsafe paths, duplicate
or case/Unicode-aliased paths, active capability declarations and digest drift
deny fail closed.

Manifest identity is the SHA-256 of canonical JSON after repository-consistent
normalization. Lock identity is derived from the manifest digest, exact file-set
digest, bundle ID/version and lock contract version. Material file digests are
SHA-256 over raw bytes, not over decoded or discovered metadata.

## Acceptance Mapping

| Gate | Implemented behavior |
| --- | --- |
| Strict manifest and lock schemas | Closed JSON schemas plus TypeScript exact-key validation reject unknown fields and unknown versions. |
| Canonical ordering | Manifest arrays are sorted by stable keys and object keys use canonical JSON. The focused test proves 100 reorder variants produce identical canonical bytes, manifest digest, file-set digest and lock identity. |
| Exact-file verification | `verifySkillBundleExactFilesV1` walks a declared root, rejects symlinks and escapes, denies missing/extra files and recomputes every material byte digest and size. |
| Compatibility matrix | Only exact v1 manifest, v1 lock, `OPENCLAW` runtime and the four finite consumers are supported. Runtime, version, minor-widening and matrix ambiguity negatives deny to LKG. |
| Unresolved or mutable input | Mutable source, `latest`/placeholder-shaped text, digest drift, active capability declarations and unsafe paths deny before a lock or evidence claim is emitted. |
| Sanitized evidence | Evidence contains only bundle ID/version, digests, fixed command, counts and non-claims. It excludes local absolute paths, file contents, credentials, tenants, sessions and runtime receipts. |

## Operator Boundaries

Local validation means the repository tests passed for the exact source bytes.
Merge means maintainers accepted source history. Release means public release
governance includes those bytes. Installation means a separate lifecycle broker
commits immutable bytes into a managed store. Activation means a separate
authorization enables use. None of these states is inferred from discovery,
presence, schema validation, analysis or lock creation.

Generation and analysis may consume the manifest and lock identity to compare
content. Installation and rollback may use the same lock identity to stage or
restore exact bytes through their own authority boundary. If a consumer cannot
prove the exact supported matrix cell, it must deny to the last known good
contract or no contract. It must not silently widen to another runtime, major,
minor, capability or source locator.

## Risk, Fallback And Rollback

Risk: this local contract does not prove live registry custody, signature
chains, legal licence clearance, arbitrary code safety, runtime sandboxing,
production fitness or universal agent compatibility.

Fallback: reject mutable or unresolved sources; accept only exact v1/OpenClaw
matrix cells; retain the last accepted lock identity or deny all consumers.

Rollback: restore the previous exact lock identity and file-set digest through
the managed lifecycle's rollback path, or remove the candidate contract bytes.
Rollback must not activate a skill, grant capabilities, select a wider version
or treat release/merge/discovery as authority.

## Local Validation

Focused contract validation:

```sh
npm run build --silent && node --test dist/tests/skill-bundle.test.js
```

Authoritative repository validation remains `npm test`. Supply-chain,
release-governance, docs/video and checksum checks retain their existing
repository commands and do not imply installation or activation.
