# External plugin execution-free preflight

ETL-02 accepts only caller-supplied, immutable, content-addressed bytes. The
contract function does not read the filesystem, invoke a package manager, import
subject code, start a process, connect to a network endpoint or activate a
plugin. Inputs are untrusted data, never instructions.

The v1 scanner covers format-neutral file identity plus bounded static signals
for DSH bundles/profiles, skills, MCP server definitions and generic packages.
It checks file/source digests, relative paths, symlinks, duplicate paths, package
licence agreement, lockfile presence, exact package-manager pins, install hooks,
mutable dependency ranges and declared network, credential,
process, filesystem and persistence effects. DSH compatibility is pinned to the
reviewed Developer Preview snapshot `0.1.0-rc.8`, tag `dsh-v0.1.0-rc.8`, commit
`141eb6fef83422698aef7a981029e843e8161534`, with an independently supplied
artifact digest. Unknown versions fail closed.

Reports contain only fixed reason codes, digests, format and gate state. Subject
prose, secret values and host/private paths are never copied. Every dynamic,
adversarial, egress, process, residue and rollback gate is explicitly `NOT_RUN`.
Therefore even `STATIC_CLEAR` remains
`STATIC_ONLY_NOT_PROFILE_CONFORMANT`; it cannot grant admission, installation,
activation, compatibility, certification or a trust badge.

Rollback is additive: disable or protected-revert the new contract/export,
schema, fixtures, tests and documentation. Existing ETL/VF generations remain
unchanged and there is no external runtime state to unwind.
