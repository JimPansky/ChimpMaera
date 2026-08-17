# Builder configuration and defaults catalogue

Status: **RELEASED, LOCAL-SYNTHETIC CONTRACT SURFACE**. These defaults and the
bounded Builder M1 contracts are present in the current regular release. Their
evidence remains local and synthetic; they are not live-system or production
configuration guidance.

| Control | Default | Owner-selectable alternatives | Invariant |
| --- | --- | --- | --- |
| Authority profile | `SAFE_GUIDED` | Governed `CUSTOM`; dangerous `RAMPAGE_FULL_CONTROL_LAB` (`RAMPAGE` and `FULL_CONTROL_LAB` aliases) | Governed rights remain Host/System ceiling ∩ Owner profile ∩ assignments ∩ current constraints. The lab profile is separately risk-accepted and never exceeds the OS/host ceiling. |
| Read-only route | `AUTO_EXECUTE` in `SAFE_GUIDED` | Owner may narrow or deny | Exact admitted capability, tenant and use-time checks still apply. |
| Effectful route | `OWNER_APPROVAL` in `SAFE_GUIDED` | `CUSTOM` may select governed `AUTO_EXECUTE`; the lab profile may bypass PANSPHAIRA action/Approval gates | The lab bypass is outside SAFE_GUIDED/Canon security claims for bypassed layers; malformed or integrity-invalid Builder input still denies. |
| Unknown intent | `UNRESOLVED_INTENT`, inactive, non-executable | None until a compatible capability is admitted | Intent never creates authority or effect. |
| Scaffold | Generic `ADAPTER` or `SKILL` data contract | Owner selects kind | No target-specific privileged Builder core. |
| Data classification | `SYNTHETIC` | None in M1 evidence/contribution paths | Live/customer data is outside this contract. |
| Installation | Separately routed | `AUTO_EXECUTE`, `OWNER_APPROVAL`, `DENY` | Does not imply activation, mutation or publication. |
| Activation | Separately routed | `AUTO_EXECUTE`, `OWNER_APPROVAL`, `DENY` | Import or planning never activates. |
| Mutation | Separately routed | `AUTO_EXECUTE`, `OWNER_APPROVAL`, `DENY` | Readback and recovery evidence remain mandatory. |
| Contribution | `OPT_IN` | No automatic mode | Sanitizer accepts only the closed bundle schema. |
| Publication authorization | `ABSENT` | Granted only outside this M1 bundle by a separate authorized action | A bundle cannot carry or infer its own publication approval. |
| Evidence status | `LOCALLY_VALIDATED_SYNTHETIC` | None in v1 | Does not imply live-system or production fitness. |
| Byte status | `RELEASED` | None in v1 | Release of these contract bytes does not activate a system, credential, tenant, route or publication authority. |
| Failure posture | Deny/explicit non-success | None | Unknown field, kind, status or integrity drift fails closed. |

The contribution sanitizer allow-list accepts Issue/Claim/Evidence IDs,
synthetic scope and acceptance metadata, digest-only evidence references and
public relative source paths. It excludes credential/token material, private
or absolute paths, raw prompts/runtime receipts, customer/tenant data and all
unknown fields.

`RAMPAGE_FULL_CONTROL_LAB` is not the broadest governed Profile. Its selection
requires exact Owner risk acceptance, a disposable or explicitly bounded lab,
visible OS/host ceiling and bypass list, claim downgrade, and tested reset,
rollback and recovery. Restart, revoke or cleanup resets the published local
profile lifecycle to `SAFE_GUIDED`; audit and emergency-stop records are not a
security boundary against an actor able to alter them under the OS ceiling.
