# Dev Worker Receipt Review Checklist

Operator-facing human review checklist for `chimpmaera.dev/work-receipt/v1`.

## Success definition

`SUCCEEDED` means only that the bounded worker run completed its contract. It is **not** evidence of correctness, merge, release, deployment, security, or production readiness.

## Review steps

### 1. Binding

- [ ] `workOrderDigest` matches the issued work order.
- [ ] `baseCommit` matches the bound base commit.
- [ ] `candidateCommit` is `null` (no commit was created).

### 2. Changed paths and patch digest

- [ ] `changedPaths` contains exactly the allowed paths and no denied paths.
- [ ] `changedPathsDigest` matches the normalized path list.
- [ ] `patchDigest` matches an independent recomputation from the normalized patch evidence.

### 3. Tests and omissions

- [ ] Each entry in `tests` has an outcome of `PASS` or `FAIL` and an `outputDigest`.
- [ ] The tests cover the changed behavior adequately for this bounded change.
- [ ] Note what was **not** tested (e.g., integration, security, performance).

### 4. Model and capability budgets

- [ ] `modelUsage` shows the expected alias and `providerPolicyDigest`.
- [ ] `requests`, `inputTokens`, `outputTokens`, and `costMicros` are within the work-order budget.
- [ ] `capabilityUsage` contains only capabilities granted in the lease.

### 5. Publication absence

- [ ] `publication.performed` is `false`.
- [ ] `publication.identifiers` is empty.

### 6. Readback and cleanup

- [ ] `readback.synthetic` is `true` and `readback.digest` matches an independent recomputation from the bound readback evidence.
- [ ] `cleanup.outcome` is `PASS` and `cleanup.writableStateRemaining` is `false`.

### 7. Non-claims and uncertainty

- [ ] `nonClaims` explicitly lists what this receipt does **not** claim (e.g., no production readiness, no security guarantee).
- [ ] Document any remaining uncertainty or missing context.

### 8. Disposition

Choose exactly one:

- [ ] **ACCEPT_AS_IS** — independent review found the evidence and change acceptable without edits.
- [ ] **ACCEPT_WITH_MECHANICAL_FIXES** — evidence is sound; only mechanical repairs are needed.
- [ ] **USEFUL_DRAFT_NEEDS_STRONGER_FINALIZER** — useful draft; requires stronger-model finalization.
- [ ] **REJECT** — evidence is insufficient, out of scope, or violates the contract.

## Evidence vs. judgment

- **Deterministic evidence**: digests, outcomes, counts, and booleans from the receipt.
- **Reviewer judgment**: scope adequacy, test coverage sufficiency, and disposition choice.

## Constraints

- No credential, raw prompt, raw model output, private repository information, or local environment detail.
- This checklist does not grant merge, release, deployment, or production authority.
