# AAS-017 signed Policy lifecycle — PDCA record

Date: 2026-08-01  
Branch: `feat/admin-ai-aas-017-signed-policy-lifecycle`  
Starting checkpoint: `3f157c768d5769487a1e5feb1d97b239b3121d0f`  
Work item: `AAS-017` — Complete signed Policy lifecycle  
Initial metric: **0/4**

## Plan — maturity review before implementation

AAS-002 proves a local Owner-HMAC activation fence, monotonic generation and
decision/use binding. It deliberately does not prove an independently signed
Policy artifact, explicit pre-activation review stages, validity windows,
issuer/trust snapshots, compatibility, widening approval, revocation receipts
or a complete supersede/retire lifecycle. AAS-017 closes that finite local
management-plane contract without adding an Agent activation endpoint or
changing effect authority.

The metric is locally reachable: Node's pinned runtime provides Ed25519, all
Policy/provider inputs are synthetic, and the existing AAS-002 fence provides
the activation/use boundary. No live signer, HSM, production trust root,
distributed rollout or external account is required.

The four completion gates are:

1. **Signed contract and trust gate:** an exact-schema, byte/digest-bound
   Ed25519 Policy artifact binds issuer, key ID, tenant, Policy ID, monotonic
   generation, validity window and closed compatibility tuple; unknown schema,
   issuer, key, signature, tenant or compatibility fails closed.
2. **Reviewable lifecycle gate:** the durable transition sequence is
   draft→validate→simulate→approve→stage→activate→supersede→retire/revoke;
   semantic Diff and simulation digests bind exact Owner approval, and any
   authority widening requires explicit widening approval.
3. **Use, fallback and recovery gate:** activation delegates only to the
   AAS-002 fence; receipts are hash-chained and authenticated; trust drift,
   expired approval, replay, mixed worker/cache generation or partial rollout
   freezes dispatch with an explicit last-safe generation and no implicit
   fallback execution.
4. **Adversarial and regression gate:** focused lifecycle/generation tests,
   the complete suite, supply-chain/public-staging validation, durable evidence,
   PDCA and a clean local commit pass from frozen relevant bytes. This contract
   changes no install/demo runtime path, so the already completed AAS-035 full
   smoke must not be repeated.

### Exact acceptance tests

- Sign generation 1 with a local Ed25519 issuer, complete every review stage,
  activate through the generation fence, reload both records, and verify the
  active Policy and receipt chain.
- Sign and activate generation 2; generation 1 becomes explicit last-safe and
  `SUPERSEDED`, then can be explicitly retired with a receipt.
- Produce a deterministic semantic Diff and simulation digest; exact Owner
  approval binds artifact, Diff, simulation, tenant, generation, validity and
  the widening decision.
- Revoke an active generation or report partial/mixed rollout and prove frozen
  dispatch plus the named fallback generation; never auto-execute the fallback.
- Verify a current lifecycle/fence use binding succeeds and a mixed generation
  fails before any provider path.

### Exact negative probes

- Unsigned, malformed or signature-mutated artifact; unknown issuer/key and
  issuer/key mismatch.
- Expired/not-yet-valid artifact or approval, replayed operation ID, stale or
  duplicate generation, wrong tenant and incompatible runtime/policy contract.
- Semantic or source bytes changed after validation; skipped/reordered stages;
  simulation/Diff/approval digest substitution.
- Valid authority widening without explicit widening approval.
- Trust-store drift between validation and staging/activation.
- Mixed cache/worker generations and partial rollout; active revocation.
- Lifecycle state/receipt edit, hash-chain break or binding mismatch on reload.
- Every denial preserves the prior durable state and performs zero provider or
  effect calls.

### Conservative local assumption

- **Purpose:** prove separation between Policy issuer signature, Owner review
  approval and use-time effect enforcement using deterministic local fixtures.
- **Assumption:** local Ed25519 keys model an issuer/trust root; a separate
  purpose-bound Owner HMAC models approval and authenticated local state.
- **Risk:** a hostile host or same-process key disclosure can forge artifacts,
  approvals or local state; local rename is not distributed consensus.
- **Fallback:** freeze dispatch, retain the last authenticated safe generation,
  disable lifecycle management and revert this slice. Never reinterpret or
  auto-activate fallback bytes.
- **Review marker:** replace fixtures with independently managed trust roots,
  production signer ceremony, rollback-resistant storage and rollout quorum
  before any production claim (`AAS-011` and external deployment evidence).

### Rollback boundary

Revert the AAS-017 implementation commit and remove only its lifecycle state.
Retain the AAS-002 activation record and leave dispatch frozen until an Owner
selects a previously verified generation. No Agent, provider or lifecycle
component may self-approve, mint authority, bypass the fence or activate a
fallback.

### Honest non-claims

This slice can prove local Ed25519 verification, exact-schema contracts,
deterministic Diff/simulation, purpose-bound approval, lifecycle ordering,
authenticated persistence, receipts, replay denial and freeze behavior. It is
not evidence of an HSM, production PKI/IAM/tenant source, hostile-host
resistance, distributed rollout/consensus, transparency log, live provider,
release, deployment or external publication.

## Do

Pending implementation.

## Check

Pending frozen-byte validation.

## Act

Pending closure and frontier audit. Owner direction makes `AAS-036` the next
architecture/security frontier after AAS-017 reaches 4/4; it must precede
lower-priority ERP/CRM/BI/DMS breadth.
