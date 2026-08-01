# AAS-023 Protected Audit Timeline PDCA

Date: 2026-08-01  
Phase: Admin-AI security expansion / protected audit timeline  
Starting checkpoint: `386c7274f7c82791ca59609ac212de8e15289bd6`  
Branch: `feat/admin-ai-aas-023-protected-audit-timeline`  
Starting metric: **0/4**

## Plan and maturity gate

AAS-037 is complete at 6/6 and is not reopened. AAS-023 is locally reachable:
canonical JSON, Ed25519 synthetic signer fixtures, digest-linked local facts,
strict clocks and a signed head/count checkpoint need no production audit sink,
credential or external system. The worker may write event envelopes but cannot
turn edited bytes into a verified explanation without the signing fixture.

### Exact 4/4 acceptance

1. A versioned, closed protected-event and checkpoint contract binds timeline,
   tenant, sequence, identity, intent, operation/correlation, event kind,
   occurred/observed/signed time, outcome/reasons/evidence digests, all causal
   references, signer key/generation and the previous envelope digest. Unknown
   fields, raw detail/content and invalid identifiers, digests or times deny.
2. A local reference writer signs every canonical envelope and an exact
   event-count/head checkpoint. Verification checks event and envelope bytes,
   signature/key generation/window, strict sequence and clock monotonicity,
   previous-envelope chaining, required kind-specific causal links and the
   checkpoint commitment before returning verified facts.
3. A deterministic explanation is constructed only from a successful verifier
   result. It joins identity -> intent -> Plan -> Policy -> approval -> budget
   -> effect -> readback, with reconcile/stop/rollback branches when present;
   a gap or unverifiable input yields `UNVERIFIABLE`, explicit issue codes and
   no verified-success rendering. Payload fields cannot carry secrets.
4. Focused tests prove the positive timeline and edit-and-rehash, delete,
   truncate, reorder, duplicate, fork, stale/unknown signer, signature change,
   clock rollback, missing causal link, wrong tenant/checkpoint, raw secret
   field, conflicting replay and checkpoint-head/count failures. Full, video,
   supply-chain and public-staging validation pass; a clean local commit,
   evidence index, PDCA and zero owned residue close the metric.

### Conservative assumptions, risks, fallbacks and review markers

- **Signer fixture:** Ed25519 keys and trust windows model a separated signer.
  Risk: the test private key is process-local, not HSM/KMS custody. Fallback:
  absent/unknown/stale keys deny. Review when Owner selects production custody.
- **Checkpoint:** a signed exact head/count commitment detects local tail loss
  and divergent forks relative to that checkpoint. Risk: independently hiding
  both records and checkpoint is outside this store's claim. Fallback: without
  the expected checkpoint the timeline is unverifiable. Review with AAS-031's
  independently operated append-only sink/attestation.
- **Clock:** integer millisecond fixture time and monotonic signed/observed
  ordering are authoritative only for local tests. Fallback: rollback,
  uncertainty or signer-window drift denies. Review with trusted production
  time and schedule controls.
- **Privacy:** the closed fact schema permits identifiers, finite outcomes,
  reason codes and digests, never arbitrary content. Risk: identifiers can
  still be operational metadata. Fallback: reject unknown/raw fields and keep
  content capture out of this contract. Review against Owner retention policy.

### Rollback boundary

Revert the AAS-023 implementation commit, keep old records byte-for-byte, and
mark them `UNVERIFIABLE_MIGRATION` rather than synthesising links or verified
success. Disable the new explanation reader if checkpoint/trust evidence is
missing. No rollback deletes audit records or weakens existing receipt checks.

### Honest non-claims

This work does not claim tamper-proof or append-only storage against a hostile
host, independent witness/attestation, production signer/KMS/HSM or trusted
time, legal retention/compliance, complete privacy classification, distributed
consensus, production tenancy or release readiness. It does not touch the
Owner OpenClaw, Gateway, vLLM, models, credentials, production systems or
external accounts.

## Do

Pending implementation after this maturity contract.

## Check

Pending focused and integrated evidence after relevant bytes freeze.

## Act

Pending 4/4 evidence and frontier audit.
