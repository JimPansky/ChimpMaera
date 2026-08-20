# HMI-013 conformant entry points M0 PDCA

Status: local candidate; no install, activation, external mutation, release, or
live-harness claim.

## Plan

Close the bounded issue-36 conformance-preparation gap with two importable but
inactive entry points from the same exact HMI generation. Limit the surface to
`discover`, `explain`, and preparation-only `contribute-preflight`; require
cross-harness canonical parity, exact pins, bounded context, zero authority,
typed negative probes, deterministic replay, and a disable/rollback path.

## Do

- Added separate OpenClaw and Codex import paths backed by one shared pure
  mapper and the existing verified generation contract.
- Added immutable descriptors with no rights, routes, write targets, network
  routes, external dependencies, installation, activation, or write effect.
- Kept harness-specific transport and presentation outside canonical semantic
  bytes; mapped `contribute-preflight` only to the existing preparation-only
  `contribute` contract.
- Enforced generation-declared selectors, empty selectors plus selected input
  for contribution preflight, and actual canonical source/output byte ceilings.
- Added fail-closed tests for unsupported operations, ambient fields,
  undeclared selectors, missing input, limit widening, oversized context,
  oversized output, generation drift, determinism, and descriptor immutability.

## Check

The focused and repository gates are recorded in the restart-safe task-run
manifest. Evidence may claim only local deterministic conformance of these
inactive transforms; it cannot claim installation or live harness behavior.

## Act

Conservative assumption: repository-native compiled import paths are the
smallest honest consumable adapter artifact before an authorized harness
installation probe. Risk: future OpenClaw or Codex packaging APIs may require a
different thin wrapper. Fallback: remove only these additive entry points and
retain the accepted `synthetic-v1` parity contract. Review marker: first
authorized install/runtime probe or a reviewed harness packaging/API change.

Rejected: installing a skill/plugin, activating a route, adding credentials or
tools, claiming live compatibility, enabling `plan`/`validate`/`handoff`, or
submitting an issue. Those actions exceed this local preparation slice.
