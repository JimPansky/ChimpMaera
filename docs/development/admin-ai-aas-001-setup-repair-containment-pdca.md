# AAS-001 setup-repair containment PDCA

Date: 2026-08-01  
Phase: Admin-AI security expansion Phase 0  
Metric: `aas_001_containment_gates` 0/4 before implementation  
Selection: AAS-001 is the highest-importance internally ready item (P0, I5,
current executable defect); no external dependency blocks local closure.

## Plan — maturity and defect review

The existing repair contract binds a caller-provided plan to a digest, but it
does not reconstruct the executable action from the observed issue and
server-owned status. A caller can change `action.target`, recompute the digest,
retain the string-prefix `boundedToOwnedState` assertion, and cause the setup
coordinator to resolve and write the supplied target. Its path-based
check-then-write also does not establish a symlink or component-swap boundary.

The slice is mature enough for local implementation because the only material
repair action has one deterministic server-owned destination (`config.json`),
the plan and status are already digest-bound, and all effects are exercised in
temporary local fixtures. WIP is one: AAS-001 only.

The four acceptance gates are:

1. `RECONSTRUCT_AND_BIND`: verification rebuilds the expected action from the
   verified status and observed issue; the received plan must match that exact
   plan and approval must bind its digest.
2. `DESCRIPTOR_CONTAINMENT`: repair opens the verified owned directory without
   following a final symlink and addresses only fixed component names relative
   to that descriptor; caller target text is never an execution input.
3. `RACE_SAFE_WRITE`: existing input is opened without following symlinks,
   temporary output is exclusively created, flushed, and atomically renamed
   through the held directory descriptor; injected component/final symlink and
   pre-write directory swaps fail closed or remain confined to the originally
   opened owned directory.
4. `CANARIES_AND_REGRESSION`: the owned config alone changes as declared;
   sibling, authority, effect, audit, and out-of-root canaries remain
   byte-identical; focused contract/coordinator regressions pass.

Exact negative probes recompute the digest after mutations containing `..`, an
absolute path, a sibling-prefix path, backslash or Unicode slash lookalikes;
all must fail before filesystem mutation even when `ownerConfirmed` is true.
Additional fixtures place symlinks at the owned root, target, and backup, and
swap the owned-root pathname immediately before write; no outside canary may
change and no receipt may report a denied effect as applied.

## Rollback and honest claims

Rollback boundary: revert the AAS-001 slice and disable setup repair. The
fallback is diagnosis plus cleanup/re-run; caller-supplied target execution
must never be restored.

This slice claims deterministic local containment on the tested Node/Linux
descriptor path. It does not claim a hostile kernel, compromised parent
process, arbitrary host filesystem sandbox, Windows portability, production
identity, live provider, or external-system protection. Those claims remain
externally gated. Push, PR, merge, tag, release, and publication are outside
this authorization.

## Do / Check / Act

Implementation and evidence are pending. Completion requires all four gates,
a clean focused test run, backlog evidence, and a post-change frontier review.
