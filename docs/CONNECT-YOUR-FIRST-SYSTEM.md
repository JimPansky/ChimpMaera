# Connect your first system

Treat each connection as a governed delivery slice: adopt or open one public
issue with scope, non-scope, dependencies, measurable acceptance criteria,
negative probes, evidence, recovery and non-claims. Link implementation pull
requests and evidence to that issue; keep unpatched security-sensitive details
in the private path defined by [SECURITY.md](../SECURITY.md). `Locally
validated` describes evidence maturity, while `released` describes published
bytes. Neither label proves live-system or production fitness.

This guide distinguishes the runnable current public release from released
local-synthetic contracts, locally validated work and product plans. The
historical `v0.1.0` tag is the initial public baseline, not the current release
or its direct predecessor. A roadmap or issue is not runtime evidence.

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
requirements, not executable arbitrary-system instructions in the current
release.

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

**RELEASED LOCAL-SYNTHETIC AUTHORING/VALIDATION CONTRACT:** Prepare a
vendor-neutral System Advisor Guide, machine-readable Machine Manifest and
explicit Capability Mapping. The published contracts and synthetic fixtures
can author and validate typed objects, dependencies, cause/effect/context,
supported operations, safe defaults, failure modes, setup/reset and required
evidence without granting Authority. JSON, YAML and Markdown are the knowledge
formats; MCP may be an access channel but is not the definition.

**PLANNED LIVE REALIZATION:** discovering those facts from an existing system,
proving them against a tenant/provider, and activating the resulting binding
are not implemented by this authoring surface.

### 4. Bind identity and boundaries

**PLANNED:** Assign a dedicated Workload Identity and tenant. Refer to
credentials through a secret handle or file-backed secret; never store
plaintext secrets in Guides, manifests, source control, logs or contribution
bundles. Declare outbound network destinations and deny direct database access
unless a separately reviewed design requires it.

The released local-synthetic Microsoft contract does not register an
application, acquire or validate a live token, request consent, store a
credential or activate a tenant. Its Entra profile and the five-operation Power
Platform read connector bind exactly `cm.discovery.read`.
`cm.operator.read` is reserved for a future separate administrative-read
Profile and is invalid on the released connector.

### 5. Select the owner profile

- **SAFE_GUIDED** is the required default for planning and initial use.
- **CUSTOM** content remains untrusted until provenance, compatibility and
  owner review are complete; importing content never activates authority.
- **FULL_CONTROL_LAB** is only for an isolated disposable lab with explicit
  owner risk acceptance. It may bypass PANSPHAIRA action and Approval gates up
  to the host process's OS/host ceiling, so bypassed layers are outside
  `SAFE_GUIDED`/Canon security claims. It is not a production shortcut and must
  bind reset/rollback/recovery and reset to `SAFE_GUIDED` on restart, revoke or
  cleanup.

The current public release contains setup-planning and Builder contract code,
tests and synthetic fixtures for these fail-closed rules. It does not ship a
user-facing arbitrary-system builder or automatic adapter generator. The
contract surface is **RELEASED WITH LOCAL-SYNTHETIC EVIDENCE**; live onboarding
and production fitness remain unproven.

### 6. Preflight effective rights

**PLANNED:** Run a dry-run/preflight before connectivity. Produce a Permission
X-ray of the effective identity, tenant, scopes, capabilities, network access,
policy constraints and requested effects. Missing, broader-than-declared or
cross-tenant rights must fail closed. The current release has no user-facing
command for this arbitrary-system preflight.

The released setup-planning and Builder contracts can validate closed
local-synthetic inputs and produce inactive plans. That is not credential
preflight, live tenant discovery or provider activation.

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
only after the read-only mappings and lineage are verified. The released
Builder contract can create a closed, synthetic, digest-only contribution
bundle, but it remains opt-in and carries no publication authorization.
The released HMI contribution preflight can prepare canonical, digest-bound
local-synthetic contribution bytes. Neither surface submits an issue, publishes
content, writes externally, uses credentials or carries publication authority.
Publication still requires a separate authorized Owner action outside these
contracts.
Shared or untrusted knowledge never grants authority, and private company data
is never published automatically.

## Maturity summary

| Maturity | Scope |
| --- | --- |
| **Released local PoC** | Pinned synthetic CRM/ERP installation, `SAFE_GUIDED` local default, generated file-backed demo secrets, governed synthetic effect, provider readback, receipt and ownership-scoped cleanup. |
| **Released local-synthetic contracts** | Setup-planning, System Advisor/Machine Manifest authoring and validation, Builder planning, generic inactive scaffolds, synthetic evidence, two-system fixture reuse, HMI contribution preflight and sanitized opt-in packaging. The Entra/Power Platform contracts fix five reads to `cm.discovery.read`. There is no user-facing onboarding UI or CLI for external systems, and no submission/publication/external-write effect. |
| **Planned** | Live-system discovery and profiles, credentials, registration/consent, Workload Identity/tenant/provider activation, `cm.operator.read` administrative profile, Permission X-ray UI, live external connectors, production reversible-write onboarding and BI packs. |

Keep planned work behind its own evidence gate. Promotion requires shipped
artifacts, reproducible tests and current readback evidence—not an issue,
design document or catalog entry alone.
