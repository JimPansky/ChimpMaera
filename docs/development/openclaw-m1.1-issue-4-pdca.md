# OPENCLAW-M1.1 issue #4 — completion PDCA

Date: 2026-08-09

Stable ID: `OPENCLAW-M1.1`

Public issue: `#4` — Pinned default-off agent container and provenance

Baseline: `0d2d990ebf9130b193704ad05a2064ba61060540`

Commit binding: this record and `security/openclaw-m1.1-evidence-v1.json` bind
to the Git commit that contains them. This containing-commit rule avoids a
self-referential commit hash; reviewers can resolve it with
`git log -1 --format=%H -- docs/development/openclaw-m1.1-issue-4-pdca.md`.

## Plan

Reuse the protected-merged AAS-035 Reference Adapter and close only the issue
#4 provenance/lifecycle traceability gap. Preserve AAS-012 and all V1 formats.
No networking, authority, credentials, mounts, sockets, devices, privileges,
effect paths, Owner runtime, publication, or production capability are added.

Acceptance is mapped in `docs/SUPPLY-CHAIN.md`. The critical ordering rule is:
selected identity, platform, lock, and every local container build/runtime
input must verify offline before any Docker or Compose action.

## Do

- Extended the existing immutable lock with the supported Linux/x86_64 host,
  digest-pinned Gateway base, exact OpenClaw base and peer version, and hashes
  for all 17 local container build/runtime inputs.
- Extended the existing offline verifier with exact tested-identity binding,
  local artifact hashing, stable missing/parse/platform denial codes, and a
  deterministic JSON provenance result.
- Moved that verifier to the start of `setup.sh`, before Docker availability or
  daemon checks.
- Added synthetic command-spy probes for mutable tag, missing digest/lock,
  provenance mismatch, unsupported architecture, and interrupted-setup reset.
- Added public operator assumptions, lifecycle, limitations, rollback, exact
  commands, evidence paths, and honest non-claims.

## Check

The issue-focused gate is `npm run openclaw-m1.1:test`; the standalone offline
identity gate is `npm run openclaw-runtime-lock:verify`. The containing commit
is accepted only after the authoritative repository tests, lint, build, docs,
supply-chain, release-governance, secure-default, public-staging/hygiene, and
`sha256sum -c SHA256SUMS` gates pass. Exact final counts and commands are bound
in `security/openclaw-m1.1-evidence-v1.json`.

No real runtime smoke is needed because the runtime bytes and AAS-035 smoke
evidence are preserved; the changed setup/preflight behavior is completely
proved with static configuration and synthetic Docker command spies.

## Act

Close issue #4 only when the containing commit is DCO-signed and every recorded
gate is green. Rollback stops/purges only the labelled fixture, then reverts the
containing commit. Re-open review if the OpenClaw version/digest, Gateway base,
any locked local input, supported platform, lifecycle script, or public claim
changes.

Supported claim: deterministic offline lock/input/platform verification and a
default-off, explicit, ownership-scoped local lifecycle for this exact
linux/amd64 Reference Adapter. Non-claims remain registry signatures, current
CVE status, complete SBOM/licence clearance, upstream rebuild reproducibility,
image publication, other architectures, production fitness, and hostile-host
isolation.
