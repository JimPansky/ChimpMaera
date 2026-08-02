# Builder configuration and defaults catalogue

Status: **LOCALLY VALIDATED, NOT RELEASED**. These defaults define the bounded
Builder M1 contracts and synthetic reference fixture; they are not production
configuration guidance.

| Control | Default | Owner-selectable alternatives | Invariant |
| --- | --- | --- | --- |
| Authority profile | `SAFE_GUIDED` | `CUSTOM`, `RAMPAGE_FULL_CONTROL_LAB` (`RAMPAGE` and `FULL_CONTROL_LAB` aliases) | Effective rights remain Host/System ceiling ∩ Owner profile ∩ assignments ∩ current constraints. |
| Read-only route | `AUTO_EXECUTE` in `SAFE_GUIDED` | Owner may narrow or deny | Exact admitted capability, tenant and use-time checks still apply. |
| Effectful route | `OWNER_APPROVAL` in `SAFE_GUIDED` | `CUSTOM`/lab profile may select `AUTO_EXECUTE` within effective rights | Agent self-approval and post-approval mutation deny. |
| Unknown intent | `UNRESOLVED_INTENT`, inactive, non-executable | None until a compatible capability is admitted | Intent never creates authority or effect. |
| Scaffold | Generic `ADAPTER` or `SKILL` data contract | Owner selects kind | No target-specific privileged Builder core. |
| Data classification | `SYNTHETIC` | None in M1 evidence/contribution paths | Live/customer data is outside this contract. |
| Installation | Separately routed | `AUTO_EXECUTE`, `OWNER_APPROVAL`, `DENY` | Does not imply activation, mutation or publication. |
| Activation | Separately routed | `AUTO_EXECUTE`, `OWNER_APPROVAL`, `DENY` | Import or planning never activates. |
| Mutation | Separately routed | `AUTO_EXECUTE`, `OWNER_APPROVAL`, `DENY` | Readback and recovery evidence remain mandatory. |
| Contribution | `OPT_IN` | No automatic mode | Sanitizer accepts only the closed bundle schema. |
| Publication authorization | `ABSENT` | Granted only outside this M1 bundle by a separate authorized action | A bundle cannot carry or infer its own publication approval. |
| Delivery status | `LOCALLY_VALIDATED` | None in v1 | Never mapped to release status. |
| Release status | `NOT_RELEASED` | None in v1 | Local tests, staging or a commit are not a release. |
| Failure posture | Deny/explicit non-success | None | Unknown field, kind, status or integrity drift fails closed. |

The contribution sanitizer allow-list accepts Issue/Claim/Evidence IDs,
synthetic scope and acceptance metadata, digest-only evidence references and
public relative source paths. It excludes credential/token material, private
or absolute paths, raw prompts/runtime receipts, customer/tenant data and all
unknown fields.
