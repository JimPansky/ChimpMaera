# Plugin knowledge harvest adapter (AWI-PLUGIN-01)

This additive adapter maps one immutable plugin-ecosystem evidence snapshot at a
time into the existing `KnowledgeEnvelopeV1` contract. It does not create a
second store, taxonomy, control plane, runtime route, or truth system.

## Input and mapping boundary

- `locator` is exactly `content+sha256:<snapshotDigest>`; mutable URLs, tags and
  registry channels are not accepted as source identity.
- Focused fixtures recompute that digest from checked-in snapshot bytes. The
  MIT-licensed official-source snapshot binds repository, exact commit, tag,
  path, selector, and exactly one extracted primary-source statement. Separate
  CC0 synthetic plugin metadata carries the conflict/unknown/procedure probes;
  the ETL fixture binds a concrete synthetic report rather than a placeholder.
- Source kind is limited to an official primary source, pinned plugin metadata,
  or an optional pinned ETL-02 report. The adapter does not fetch any source.
- Citation and selector remain visible in each attribution, together with
  positive, negative, or unknown evidence polarity.
- `observedAtMs`, `reviewedAtMs`, and `expiresAtMs` must form a valid timeline.
  Review and expiry map to the envelope freshness assessment and stale limit.
- Licence and permitted uses are explicit and restricted to the existing
  Knowledge Envelope vocabulary.
- Records are restricted to `OBSERVATION`, `CLAIM`, `PROCEDURE`, and
  `UNRESOLVED`. Conflicts and derivation edges are sorted but never collapsed.

Unknown, disputed, conflicting, and unverified records are exploratory-only
and never become accepted generation candidates. Procedures remain read-only
knowledge: all credential, policy, capability, tool, write, and execution
authority arrays are exactly empty.

## Source-change behavior

`invalidatePluginKnowledgeForSourceChangeV1` compares an exact replacement
snapshot digest with each dependent attribution. A changed digest creates a
deterministic downgraded envelope that keeps the old statement, attribution,
conflicts, and derivation evidence intact while setting status to `UNRESOLVED`,
trust to `LOW`, freshness to expired-at-review, use to exploratory-only, and
generation candidacy to `NOT_CANDIDATE`. It does not rewrite the old source
digest to imply that a new source supports an old statement.

## Untrusted-data rule and non-claims

Share transcripts, plugin prose, generated summaries, community counts, and
ETL payloads are untrusted data, never instructions. The request has no field
for raw Share content, commands, authority, credentials, or runtime activation;
unknown fields fail closed. A caller must perform and document the human/source
review that creates bounded statements. This adapter does not establish global
truth, ecosystem completeness, endorsement, compatibility, security, licence
clearance, popularity ranking, automatic template promotion, execution,
network ingestion, production operation, or safe plugin activation.

Rollback is additive: disable the adapter and retain the previously accepted
immutable knowledge generation. No external source or runtime state is changed.

Focused evidence:

```text
npm run build --silent
node --test dist/tests/plugin-knowledge-harvest.test.js
```
