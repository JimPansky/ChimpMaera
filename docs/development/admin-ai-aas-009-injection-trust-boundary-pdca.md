# AAS-009 prompt/tool-injection trust boundary — PDCA record

Date: 2026-08-01  
Branch: `feat/admin-ai-aas-009-trust-boundary`  
Starting checkpoint: `da5fff1fd5d1b03c98e7ad6c2026e99a9cd907b0`  
Work item: `AAS-009` — Prompt/tool-injection trust boundary  
Initial metric: **0/4**

## Plan — maturity review before implementation

The repository has closed typed actions, policy decisions and use-time gates,
but it has no provider-neutral contract that keeps model, tool, document and
memory content in a data-only trust domain. Before any live model or retrieval
path, this slice defines a pure, network-free boundary: closed content labels,
a narrow typed candidate, and trusted reconstruction from a server-owned
action catalogue. Content can describe data but cannot supply authority,
approval, call targets, raw credentials or instruction eligibility.

The four locally reachable completion gates are:

1. **Closed content envelopes:** exact origin, trust, tenant, data-class and
   instruction-eligibility labels are validated; every provider/tool/document/
   memory source is forced to `DATA_ONLY`, and uncertainty fails closed.
2. **Typed candidate reconstruction:** a model-shaped candidate contains only
   a catalogue action ID, bounded symbolic arguments and evidence-envelope
   references; trusted code reconstructs the exact method/path/scope from a
   server-owned catalogue and returns a deterministic digest-bound result.
3. **Opaque secret and authority boundary:** reconstructed actions may carry
   only an allowlisted opaque secret handle; candidates/content cannot inject
   URLs, paths, headers, credentials, authority, approvals or decision fields.
4. **Hostile-channel/regression evidence:** encoded, Unicode, multi-turn,
   override, exfiltration, self-approval, URL and path payloads across all four
   content origins cannot change the reconstructed call, policy input,
   decision placeholder or exposed secret representation; focused and full
   local tests pass from frozen bytes with machine-readable evidence.

### Exact acceptance tests

- Validate one envelope for each of `PROVIDER`, `TOOL`, `DOCUMENT` and
  `MEMORY`; prove normalized order and content-byte changes affect evidence
  digests but never add instruction eligibility.
- Reconstruct golden contact-create and order-create candidates from a finite
  trusted catalogue; assert exact action type, method, path, tenant, operation,
  bounded body, scope and opaque secret handle.
- Prove candidate/evidence reordering is canonical and stable, while a material
  symbolic-argument or catalogue-version change changes the result digest.
- Prove the boundary output contains no raw credential, bearer value,
  executable callback, approval, authority, policy outcome or content-derived
  URL/path/header field.

### Exact negative probes

- Missing/unknown envelope fields, origin, trust, tenant, data class or
  instruction eligibility; non-`DATA_ONLY` content; wrong-tenant and duplicate
  envelope references; unknown or unreferenced evidence.
- Unknown action ID, schema extras, prototype-bearing objects, excessive or
  unknown arguments, wrong argument type/shape and unallowlisted values.
- Candidate-supplied method, path, URL, headers, secret, secret handle,
  authority, approval, outcome, replay key, tenant, provider or scope.
- Override, exfiltrate, self-approve and fabricated-system-message strings;
  URL/path/tool-call fragments; base64/percent encoding; Unicode confusables,
  bidi controls, zero-width text and multi-turn/tool-error/memory payloads.
- Unknown catalogue version/action reconstruction or any ambiguity must deny
  without returning a partial action or secret representation.

### Conservative local assumption

- **Purpose:** establish the provider-neutral trust and reconstruction contract
  before connecting a live model, retriever, tool host or credential store.
- **Assumption:** synthetic labelled envelopes and a finite in-process catalogue
  represent future gateway inputs; opaque handles are non-secret identifiers.
- **Risk:** fixtures cannot establish resistance of a live model, tokenizer,
  retrieval stack, gateway, credential broker or production tenant boundary.
- **Fallback:** disable the model/retrieval path on any label, schema, catalogue
  or reconstruction uncertainty; retain existing deterministic Admin-AI flows.
- **Review marker:** require reviewed gateway and live adversarial evidence
  before enabling model/retrieval traffic (`AAS-008`, `AAS-020`).

### Rollback boundary

Revert the AAS-009 implementation commit and leave all model/retrieval paths
disabled. Do not weaken the existing Policy evaluator, approval leases,
generation fence or enforcement gate. Failure at this boundary returns a typed
denial and no reconstructed action; it never falls back to executing model or
content-supplied text.

### Honest non-claims

This slice can prove deterministic local schema enforcement, data-only labels,
trusted finite reconstruction, opaque-handle non-disclosure and hostile-fixture
non-interference. It is not a live-model, prompt-injection-elimination,
production gateway, tokenizer, retrieval, credential-store, tenant-isolation,
provider or external-system claim. A reconstructed action candidate is not a
Policy decision, approval, executable authority or provider call.

## Do

Pending implementation.

## Check

Pending frozen-byte validation.

## Act

Pending frontier review after the metric reaches 4/4.
