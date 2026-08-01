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

Implementation commit `72a489263dcd477dba394282a55d498ac2762318`
closes all four gates. Repair verification reconstructs the exact expected plan
and rejects any redigested mutation. The coordinator requires its server-issued
pending plan, verifies a frozen plan clone, walks fixed owned-root components
without following symlinks, detects an injected root swap, rejects non-regular
targets, and persists both material config repairs and non-material retry
evidence through a held directory descriptor with exclusive temporary files,
flushes, and atomic renames.

Focused AAS-001 plus setup regressions passed 13/13. The complete project suite
passed 75/75. `git diff --check`, all 120 repository checksums, TypeScript build
and the six-check supply-chain verifier passed. The first frozen smoke passed,
then review found a real adjacent defect: non-material retry receipts still
used path-based persistence. After that correcting byte change, a justified
rerun passed. A final integrity audit then found the three changed public files
still had old `SHA256SUMS` entries and activated the earlier source-hygiene
review marker: eight deferred public EOF findings were normalized on this real
public-byte change and all checksums refreshed in `bdfb7373d331e17903982afd6eb145ffa1879142`.
The final refrozen run passed `READY_VERIFIED` in 69,560 ms. Every dedicated
acceptance stack was purged with zero owned residue. Digest-only evidence is in
`docs/development/evidence/admin-ai-aas-001-20260801.json`.

Metric: `aas_001_containment_gates` **4/4 — complete**. Verdict:
`LOCAL_AAS_001_PASS_NOT_HOST_SANDBOX_OR_RELEASE_CLAIM`.

Frontier review found no reason to reopen a done or superseded item and no new
standalone backlog gap: the retry-evidence escape was the same AAS-001 boundary
and was corrected before closure. Under importance-first ordering, AAS-002 is
the next internally ready item (P0/I5, no external activation needed for the
local contract). AAS-001 becomes a regression boundary, not a recurring
one-shot backlog item.
