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

## Independent L3 repair

Review found that the first completion commit sourced executable `lib.sh`
before offline verification and omitted it from the locked input set. The
repair resolves the worktree root with shell built-ins, verifies the lock,
platform, helper, and all other inputs before sourcing any fixture helper, and
then requires the helper-derived root to equal the independently verified root.
The helper is the eighteenth locked artifact. A synthetic replacement helper
would write a marker and invoke the Docker spy if sourced; setup instead denies
its digest mismatch with neither marker nor Docker log created. This closes the
pre-verification helper execution gap without changing runtime authority or
starting the fixture.

## Independent platform-binding repair

Review found that amd64 provenance was verified without forcing Docker build
and Compose resolution to amd64. The repair adds `platform: linux/amd64` to
both services, `--platform linux/amd64` to both direct derivative builds, and a
fixed linux/amd64 environment to every shared Compose lifecycle command. Setup
rejects a conflicting ambient `DOCKER_DEFAULT_PLATFORM` before Docker access.
Synthetic execution proves the conflict produces zero Docker calls, the
accepted path issues two amd64-only build requests, and Compose rendering stays
amd64 even under a hostile arm64 ambient default. No image was pulled, built,
or started while collecting this evidence.

## Independent lifecycle-integrity repair

Review found that `setup.sh` and `reset.sh` controlled Docker while remaining
outside the 18-artifact lock. The complete fixture audit found 21 checked-in
files under `demo/openclaw-agent`; the lock now covers every one, including
`setup.sh`, `reset.sh`, and `smoke.sh`, and separately covers the offline
verifier for 22 artifacts total. Deterministic normal-drift probes alter each
lifecycle entry point and the verifier in isolated copies: both direct offline
verification and canonical setup preflight deny, with no Docker-spy output.
An additional probe adds an unlisted plugin file and proves the complete
fixture-tree comparison denies that material build-context expansion too.

The self-verifier digest detects ordinary repository drift but is not an
independent cryptographic root of trust. A malicious checkout able to rewrite
the verifier, lock, lifecycle scripts, and bindings together is not claimed to
be resisted; review of the containing Git commit plus the repository checksum
and supply-chain closures remains the external trust boundary.
