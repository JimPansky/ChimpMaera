# Public product spelling audit

Issue [#232](https://github.com/JoFe2/PANSPHAIRA/issues/232) changes the
current human-facing product name to **PanSphaira**. It does not rename or
migrate a machine identity. This record is the evidence-backed classification
contract for every retained legacy all-caps token.

## CHANGE result

Current product titles, prose, alt text, diagrams, community documents, issue
templates, demo labels and messages, site metadata, generated release-candidate
display strings, citation metadata, tests and snapshots use **PanSphaira**.
The repository description and new release prose are updated during protected
delivery and verified anonymously after publication.

## KEEP categories

| Category | Retained scope | Reason |
| --- | --- | --- |
| Repository slug and working URLs | GitHub repository, raw/content/release links, Pages base/canonical/sitemap URLs and repository IDs | Renaming would break stable public addresses and consumers. |
| Stable filename | `docs/PANSPHAIRA-TERMINOLOGY.md` plus manifest, checksum and test references | The filename is an established public path; only its current title and content change. |
| Technical identifiers | Dev-worker repository/project IDs and the versioned local-egress fixture scope | These values are machine-consumed compatibility contracts, not display branding. |
| Schemas | Versioned schema titles and schema documents | The bounded issue explicitly preserves schemas and protocol-facing contracts. |
| Historical release truth | Previously published release metadata, release-governance truth and the exact prior release title | Historical releases, tags and assets are immutable; the successor release uses the new display spelling. |
| Historical evidence and quoted facts | Archive, development PDCA/evidence, frozen Daily artifacts and fixtures, and dated PAN-08 verdicts | These record what existed at that time and must not be rewritten. |

## Executable classification gate

Run:

```sh
npm run public-spelling:test
```

The test scans every tracked text file, classifies each retained legacy token,
and fails on any occurrence outside the KEEP categories above. It separately
asserts the README title, terminology contract, VitePress display metadata,
citation title and current generator display spelling while proving the stable
Pages base and repository identity remain unchanged.

## Risk, fallback and review marker

The conservative assumption is that current display strings are safe to
change when they do not act as identifiers. Ambiguous or machine-consumed
values remain unchanged and are covered by the executable allowlist. A missed
display string fails the audit or a focused snapshot. Rollback is a protected
successor revert PR; repository URLs, historical tags and assets are never
rewritten or replaced.
