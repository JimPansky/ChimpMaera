# AWI-INSIGHTS-1 Issue #57 completion PDCA

Status: current-main completion candidate. Publication, CI, protected merge,
Issue closure, and release state remain separate delivery gates until their
exact public readbacks succeed.

## Plan

Complete the six Issue #57 acceptance criteria without enabling production
telemetry or using real user data. Reuse the merged descriptor-safe event and
pseudonym contract, and add only the missing coherent local reference runtime:
transparent default-off consent, bounded persistence and lifecycle controls,
strict opt-in loopback transport, report/dashboard families, and offline plus
synthetic E2E evidence.

Success requires current evidence for:

1. fully functional offline default;
2. local preview/export/revoke/delete including managed shared-batch deletion;
3. no free text or disallowed identifiers at the actual outbound boundary;
4. rotating isolated pseudonyms with erase-before-expose and replay safety;
5. coverage/cohort labels plus all-or-nothing small-cell suppression; and
6. offline and explicit opt-in synthetic installation E2Es.

## Do

The completion package adds a dependency-free TypeScript API and CLI. Local
state is canonical, digest-bound, 0600, atomically replaced, symlink/permission
checked, and capped at 4 MiB. Consent is split from sharing: a closed profile
enables local recording; an additional explicit action enables one exact
IP-literal loopback receiver. Diagnostics consent is mandatory-TTL and expires
fail closed.

Outbound envelopes and events are descriptor-safe, exact-key, closed-schema,
digest-verified, and bounded. A pending batch is stored before transport so an
ambiguous acknowledgement retries identical bytes. Successful sharing erases
the old epoch before the next pseudonym is exposed. Independent deletion
tokens retain batch-level erasure without sending a tenant identifier or a
cross-epoch token list.

The local report implements install-to-first-success, bounded return retention,
errors, denials, rollbacks, and exact-version fragmentation. Any observed cell
under five distinct installations suppresses the whole report. Coverage and
cohort nonclaims are present in machine and rendered dashboard output.

## Check

Focused evidence must pass the positive and negative completion matrix against
an actual IP-loopback receiver, including replay after a lost acknowledgement,
shared deletion, tenant/store isolation, hostile inputs, TTL, default-off, and
SSRF policy. Repository evidence then requires build, lint, pretest/full tests,
docs, root checksums, release governance, supply chain, Verification Fabric
plan/shadow, stable integrity refresh, and reproducible public archives.

All six criteria remain `0/6` until focused execution evidence passes. Local
completion remains distinct from protected delivery. Protected merge remains
distinct from Issue closure and release.

## Act, risk, fallback, and nonclaims

Conservative transport assumption: this product slice permits only exact
loopback IP literals. A general Internet endpoint would add production/SSRF
surface without improving the required local/synthetic evidence, so it is
rejected. Fallback before publication is removal of only the fresh completion
package and additive integration entries. After publication, corrections are
additive; after merge, rollback uses a protected successor/revert.

The slice makes no claim about real usage, representative cohorts, production
deployment, an Internet collector, background telemetry, receiver identity,
automatic remote deletion, deletion of owner-created export copies, ambient
correlation resistance, or privacy certification.

Completion claim boundary:
`DEFAULT_OFF_LOCAL_ONLY_UNLESS_EXPLICIT_LOOPBACK_OPT_IN_SYNTHETIC_REFERENCE_NO_PRODUCTION`.
