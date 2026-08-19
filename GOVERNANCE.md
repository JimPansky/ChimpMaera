# PanSphaira Governance

PanSphaira is maintained as an open-source, provider-neutral local agent
control-plane project.

## Roles

- Contributors propose bounded changes, tests and provenance.
- Maintainers review product fit, compatibility and contributor experience.
- Security reviewers assess authority, isolation, data and effect safety.
- Rights reviewers assess citation, media provenance, dependency notices,
  trademark boundaries and right-to-submit evidence.
- Release approvers bind decisions to exact candidate bytes.

One person may hold multiple roles, but a security- or rights-sensitive change
must not rely solely on self-review. Conflicts are disclosed and the affected
reviewer recuses.

## Decisions and releases

Normal changes require review and green tests. Security boundaries, public
contracts, compatibility promises, licensing and governance changes require
an explicit recorded decision and an additional applicable review.

Release records must identify the exact archive, manifest, checksums, SBOM,
CITATION metadata, NOTICE, third-party notices and media/provenance review
state used for the candidate.

Only exact, digest-bound candidates may be released. Popularity, ratings,
maintainer status or community trust never grant runtime capabilities.
Deprecation and removal decisions must describe compatibility, migration,
rollback and security impact.
