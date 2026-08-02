# Connect your first system

Treat each connection as a governed delivery slice: adopt or open one public
issue with scope, non-scope, dependencies, measurable acceptance criteria,
negative probes, evidence, recovery and non-claims. Link implementation pull
requests and evidence to that issue; keep unpatched security-sensitive details
in the private path defined by [SECURITY.md](../SECURITY.md). `Locally
validated` does not mean `released`.

This guide distinguishes the runnable ChimpMaera v0.1 public snapshot from
onboarding contracts that exist only as local validation or product plans. A
roadmap or issue is not runtime evidence.

## What you can run in the public snapshot

The released connection path is the bundled, synthetic EspoCRM-to-Dolibarr
demo. It does not connect an existing company system.

1. Read the [Quickstart](QUICKSTART.md), [Architecture](ARCHITECTURE.md) and
   [Known Limitations](KNOWN-LIMITATIONS.md).
2. On a supported disposable or development host, run from the release root:

   ```sh
   ./demo/install.sh
   ```

3. Confirm that the installer reports `READY_VERIFIED`. The installer selects
   the safe local profile, creates file-backed random demo secrets, loads only
   fictional fixtures, performs the governed synthetic flow and verifies the
   provider result through readback.
4. Inspect the shipped connection inputs rather than replacing them with real
   credentials or data:

   - `demo/manifests/catalog/crm-erp-playable-v1.json` — bundled capability and
     template catalog;
   - `demo/manifests/identity/panskys-zoo-v1.json` — fictional identity and
     provider-role mapping;
   - `demo/manifests/authority/SAFE_GUIDED-v1.json` — safe authority default;
   - `demo/manifests/network/local-egress-policy-v1.json` — local network
     boundary;
   - `demo/readback.sh` — semantic provider-readback implementation.

5. Reset installer-owned state with:

   ```sh
   ./demo/uninstall.sh --purge
   ```

This proves only the pinned local demo path. It does not prove production
identity, arbitrary adapters, tenant isolation, provider rollback or safe use
of real data.

## Governed onboarding blueprint

Use this sequence to design a future connection. Steps marked **PLANNED** are
requirements, not executable v0.1 instructions.

### 1. Choose the outcome and source

**PLANNED:** Name one bounded use case, its authoritative source system, the
objects and fields required, freshness needs, expected evidence and an owner.
Start with the smallest useful read-only slice. A direct database write is not
a safe default.

### 2. Check profile, adapter and prerequisites

**PLANNED:** Select only a versioned, supported system profile or adapter and
verify its API/export version, scopes, network route, rate limits, tenant model,
reset behavior and readback support. If no compatible profile exists, stop at
design; do not treat a roadmap issue or catalog name as implementation proof.

### 3. Formalize the knowledge contract

**PLANNED:** Prepare a vendor-neutral System Advisor Guide, machine-readable
Machine Manifest and explicit Capability Mapping. Together they should define
objects, dependencies, cause/effect/context, supported operations, safe
defaults, failure modes, setup/reset and required evidence. JSON, YAML and
Markdown are the knowledge formats; MCP may be an access channel but is not the
definition.

### 4. Bind identity and boundaries

**PLANNED:** Assign a dedicated Workload Identity and tenant. Refer to
credentials through a secret handle or file-backed secret; never store
plaintext secrets in Guides, manifests, source control, logs or contribution
bundles. Declare outbound network destinations and deny direct database access
unless a separately reviewed design requires it.

### 5. Select the owner profile

- **SAFE_GUIDED** is the required default for planning and initial use.
- **CUSTOM** content remains untrusted until provenance, compatibility and
  owner review are complete; importing content never activates authority.
- **FULL_CONTROL_LAB** is only for an isolated disposable lab with explicit
  owner acknowledgement. It is not a production shortcut and must reset to
  `SAFE_GUIDED`.

The public snapshot contains setup-planning contract code and tests for these
fail-closed rules, but it does not ship a user-facing arbitrary-system builder
or automatic adapter generator. That onboarding workflow is **LOCALLY
VALIDATED, NOT RELEASED** at the contract-test level only.

### 6. Preflight effective rights

**PLANNED:** Run a dry-run/preflight before connectivity. Produce a Permission
X-ray of the effective identity, tenant, scopes, capabilities, network access,
policy constraints and requested effects. Missing, broader-than-declared or
cross-tenant rights must fail closed. ChimpMaera v0.1 has no released command
for this arbitrary-system preflight.

### 7. Connect read-only first

**PLANNED:** Establish a typed, schema-checked, least-privilege read-only
connection through a supported application API or export. Prove tenant and
field boundaries, deterministic mapping, pagination, error handling and source
readback before considering writes.

Only then may an owner separately approve a narrow, controlled and reversible
write capability. Each write needs a typed request, policy/use-time check,
readable diff or equivalent preview, explicit authority, idempotency strategy,
provider readback and a tested reversal or recovery path.

### 8. Reconcile, receipt and recover

**PLANNED:** Compare the result with the authoritative source, reconcile
canonical identifiers and record a digest-bound receipt with provenance,
tenant, policy, input and readback references. Define Reset, provider Rollback,
authority Revoke and installer Cleanup separately; they are not synonyms.

### 9. Add BI and share deliberately

**PLANNED, OPTIONAL:** Add a versioned BI Semantic Contract and Dashboard Pack
only after the read-only mappings and lineage are verified. A locally validated
Builder contract can create a closed, synthetic, digest-only contribution
bundle, but it remains opt-in, `NOT_RELEASED` and carries no publication
authorization. Publication still requires a separate authorized Owner action.
Shared or untrusted knowledge never grants authority, and private company data
is never published automatically.

## Maturity summary

| Maturity | Scope |
| --- | --- |
| **Works in public snapshot** | Pinned synthetic CRM/ERP installation, `SAFE_GUIDED` local default, generated file-backed demo secrets, governed synthetic effect, provider readback, receipt and ownership-scoped cleanup. |
| **Locally validated, not released** | Setup-planning and Builder contracts model Owner profiles, guided discovery, System Advisor Guides, generic inactive scaffolds, synthetic evidence, isolated read/reversible-write fixtures, second-system reuse and sanitized opt-in contribution packaging. There is no released onboarding UI or CLI for external systems. |
| **Planned** | Live-system profiles, Workload Identity/tenant integrations, Permission X-ray UI, typed external connectors, production reversible-write onboarding and BI packs. |

Keep planned work behind its own evidence gate. Promotion requires shipped
artifacts, reproducible tests and current readback evidence—not an issue,
design document or catalog entry alone.
