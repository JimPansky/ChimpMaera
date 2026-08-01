<p align="center">
  <img src="assets/brand/chimpmaera-negative.png" width="560" alt="ChimpMaera hybrid chimp and cyborg chimera with wings, tail, and one red claw">
</p>

# ChimpMaera v0.1

**No ambient authority (`CM-SEC-006`). No master key (`CM-SEC-003`). No
unmediated effect path inside the declared governed boundary (`CM-SEC-001`,
`CM-SEC-007`).**

ChimpMaera treats models and agents as untrusted proposers, never as authority.
In the defined local security paths, every meaningful boundary crossing is
mediated (`CM-SEC-001`): capabilities are typed and default-off
(`CM-SEC-002`); model traffic is guarded before and after the provider
(`CM-SEC-005`); effects are broker/gate-executed, authoritatively read back and
receipted (`CM-SEC-007`); and provider, tool, document and memory content stays
data—it cannot become authority (`CM-SEC-003`). Owners select visible authority
profiles (`CM-SEC-004`), including an explicit `FULL_CONTROL_LAB` escape hatch
that deliberately removes ChimpMaera gates inside the isolated lab and is
therefore **not** a security boundary.

Public v0.1 is a local, synthetic CRM-to-ERP proof of concept. Its installer
starts a loopback-only demo with ChimpMaera, EspoCRM and Dolibarr, seeds
fictional data, performs one governed business action and verifies the result
through provider readback. The stronger security slices below exist in the
identified cumulative local checkpoint; they are not on the unchanged v0.1.0
tag and are not claimed released.

## Security claims: evidence before adjectives

**Evidence snapshot.** This README candidate is based on clean cumulative
checkpoint `253c26cc2f75a48f179c3d38c3e5b6ed33fa82d4` (through AAS-023).
Public `main` was observed read-only at
[`f00a489`](https://github.com/JimPansky/ChimpMaera/commit/f00a4890f7fecb68f82e692f09cf1e46728fb88d)
on 2026-08-01. The checkpoint branches from an earlier public-main ancestor
and contains local, unmerged security work. A local result is not a release.

Maturity terms are strict:

- **PROVEN IN THIS SNAPSHOT** — executable contract/test evidence is present
  in this checkpoint and the stated command passes on these bytes.
- **LOCALLY VALIDATED — NOT RELEASED** — a checked-in, commit-bound local
  runtime smoke exists; it is neither public-main nor release evidence.
- **PLANNED / IN PROGRESS** — roadmap only. An issue is never evidence.
- **NOT CLAIMED — EXTERNAL GATES** — the claim requires evidence this local
  snapshot cannot provide.

### PROVEN IN THIS SNAPSHOT

| Claim ID | Exact claim | Evidence / reproduce | Result | Boundary |
| --- | --- | --- | --- | --- |
| `CM-SEC-001` | Every **defined meaningful crossing in the declared governed paths** is mediated by typed trusted code; the Agent is not the enforcement point. | [Canon](docs/CANON.md) CM-CAN-01/03/08/09/10; [architecture](docs/ARCHITECTURE.md); `npm test` | **132/132 PASS** | Local synthetic paths represented by this repository. This does not prove that unknown bypasses, a compromised host or a future integration cannot escape the model. `FULL_CONTROL_LAB` intentionally exits the governed-profile claim. |
| `CM-SEC-002` | Capability/catalogue entries are finite, typed, digest-bound and inactive by default; admission or inspection grants no authority. | [catalogue tests](tests/capability-catalogue.test.ts); `npm run build && node --test dist/tests/capability-catalogue.test.js` | **4/4 PASS**; AAS-012 evidence records full-suite **95/95 PASS** | Two synthetic actions. No live adapter provenance, activation service, Gateway or production tenant claim. |
| `CM-SEC-003` | Untrusted provider, tool, document and memory content cannot select call targets, credentials, approval or authority; hostile content changes evidence digests only. | [trust-boundary tests](tests/injection-trust-boundary.test.ts); `npm run build && node --test dist/tests/injection-trust-boundary.test.js` | **4/4 PASS** across four hostile synthetic origins | Closed local contract, not proof that prompt injection is eliminated in a live model, tokenizer, retrieval stack or gateway. |
| `CM-SEC-004` | The Owner can select visible, context-bound authority profiles, including `FULL_CONTROL_LAB`; full control requires exact risk acceptance and resets to `SAFE_GUIDED` on restart, revoke or cleanup. | [authority-profile tests](tests/poc-early-admin-ai-setup.test.ts); [RAMPAGE manifest](demo/manifests/authority/RAMPAGE-v1.json); `npm run build && node --test dist/tests/poc-early-admin-ai-setup.test.js` | **13/13 PASS**, including the two profile lifecycle tests | Local setup contract. Full control inherits the host process's OS ceiling, bypasses ChimpMaera action/approval gates and can destroy local controls if separately given root. Audit and emergency stop are transparency/recovery features, not protection from that actor. |
| `CM-SEC-008` | Verified audit explanations are built only from signed, ordered, digest-linked facts and an exact head/count checkpoint; tampered, missing, reordered or forked facts do not render verified success. | [audit tests](tests/protected-audit-timeline.test.ts); `npm run build && node --test dist/tests/protected-audit-timeline.test.js` | **4/4 PASS**; AAS-023 full suite **132/132 PASS** | Synthetic Ed25519/local checkpoint. Not hostile-host tamper-proof storage, an independent witness, trusted time, production key custody or retention compliance. |
| `CM-SEC-009` | The stock demo publishes only loopback ports, keeps databases on internal networks, mounts no Docker socket, and runs ChimpMaera non-root with a read-only root, dropped capabilities and no-new-privileges. | [Compose contract](demo/compose.yaml); [supply-chain verifier tests](tests/supply-chain-verifier.test.mjs); `npm run supply-chain:verify` | **6/6 PASS** declaration/runtime-posture checks | Repository and local Compose posture only. It does not resist a compromised host kernel or Docker daemon and does not establish production network isolation. |

### LOCALLY VALIDATED — NOT RELEASED

| Claim ID | Exact claim | Commit-bound evidence / reproduce | Recorded result | Boundary |
| --- | --- | --- | --- | --- |
| `CM-SEC-005` | Model requests are guarded before provider access; responses and streams are guarded before Agent/tool use. The broker alone resolves opaque credentials and routes; model tool calls remain untrusted candidates with no effect path. | `docs/development/evidence/admin-ai-aas-036-20260801.json`; [broker tests](tests/model-access-broker.test.ts); `./demo/model-access-broker/smoke.sh` | AAS-036 **8/8 PASS**; isolated OpenClaw smoke: **11** provider calls, **7** denials, **7** metadata-only audits/receipts, no raw content stored, zero owned residue | Closed local OpenAI/Anthropic protocol fixtures and pinned OpenClaw 2026.7.1. No live provider, production TLS/DNS, real vault, universal runtime support or injection-elimination claim. |
| `CM-SEC-006` | The isolated Agent fixture has zero ambient provider/host/tenant credentials and one Gateway-only application path; direct Internet, provider, peer, host, socket and unmanaged-effect paths are denied by the tested fixture. | `docs/development/evidence/admin-ai-aas-035-20260801.json`; [runtime tests](tests/openclaw-agent-runtime.test.mjs); `./demo/openclaw-agent/smoke.sh` | AAS-035 **12/12 PASS**; frozen smoke records **5** denials, **1** mediated effect with receipt/readback, stable Owner fingerprint and zero owned residue | Docker shares the host kernel. This is not a production sandbox, hostile-host boundary, complete supply-chain audit or production network/IAM claim. |
| `CM-SEC-007` | Declared effects are executed only at the broker/gate boundary. Transport acceptance is not success: authoritative provider readback and a bound receipt are mandatory; rejection, drift, ambiguity and replay do not become success. | `docs/development/evidence/admin-ai-aas-016-20260801.json`; [effect-gate tests](tests/demo-enforcement-gate.test.mjs); [approval tests](tests/demo-approval-workbench.test.mjs); `./demo/acceptance.sh SAFE_DEMO_COLD` | AAS-016 **4/4 PASS**; corrected cold smoke `READY_VERIFIED`, approved readback `VERIFIED`, rejected effect `DENIED`, replay denied, zero owned residue | One synthetic Dolibarr order path and local fixture identity. No provider transaction/ETag, production approval/IAM/MFA/quorum, provider Revoke or production Rollback claim. |

### PLANNED / IN PROGRESS — ISSUES ARE NOT EVIDENCE

`CM-ROADMAP-001`: public issue [#3](https://github.com/JimPansky/ChimpMaera/issues/3)
tracks the inactive catalogue and was still **open / in progress** when checked
on 2026-08-01.
The OpenClaw epic [#2](https://github.com/JimPansky/ChimpMaera/issues/2) and
children [#4](https://github.com/JimPansky/ChimpMaera/issues/4),
[#5](https://github.com/JimPansky/ChimpMaera/issues/5),
[#6](https://github.com/JimPansky/ChimpMaera/issues/6),
[#7](https://github.com/JimPansky/ChimpMaera/issues/7) and
[#8](https://github.com/JimPansky/ChimpMaera/issues/8) were still **open /
blocked**. The local checkpoint contains AAS-012 and isolated OpenClaw
candidates, so it is ahead of that public status text; it does **not** silently
change issue state, satisfy every issue acceptance criterion, merge the work or
turn the issues into evidence.

### NOT CLAIMED — EXTERNAL GATES

- `CM-NC-001`: no unhackability, absolute safety, security completeness or
  absence of unknown side channels.
- `CM-NC-002`: no thought, hidden-reasoning or chain-of-thought transparency.
  ChimpMaera evidences observable inputs, decisions, actions, readback and
  receipts—not private model thoughts.
- `CM-NC-003`: no universal-agent, universal-model or live-provider
  validation; Hermes and Claude Code runtime paths remain unproven here.
- `CM-NC-004`: no production security/readiness, hostile-host containment,
  production multi-tenancy, IAM/MFA, HSM/KMS/PKI/vault, high availability,
  compliance or permission to use real customer data. Those require external,
  independently operated production evidence.

**TCB and isolation limit.** For these local claims, the trusted computing base
includes the host kernel and Docker daemon, Gateway/brokers/effect gate,
catalogue/Profile/Policy state, local keys and evidence store, plus the provider
surface used for authoritative readback. Agents, models and imported content
are treated as untrusted. Compromise of the local TCB can forge or bypass local
evidence; container hardening reduces accidental exposure but does not create
an independent hostile-host boundary.

**Open knowledge. Governed agency. Verifiable outcomes.**

ChimpMaera is being developed around two reinforcing product promises:

- **Governed agency:** capabilities do not become authority by accident;
  provenance, scope, policy, approval and evidence constrain every effect.
- **Open knowledge:** distributed systems, capabilities, operational knowledge
  and evidence become explainable, governable and reusable agentic workflows.

The current evidence covers the narrow local demo described above. The broader
open-source Knowledge Operating System is the product direction, not a claim
that every component below is already implemented in v0.1.

## Watch ChimpMaera

Easy Start: [Meet Your New AI Colleague | ChimpMaera](https://youtu.be/8mB7O81Y2xA)

More Infos: [How ChimpMaera Governs AI Actions | Plan, Approval, Evidence](https://youtu.be/8lj5nd-LJa4)

The Real Deal: [Controllable AI: Capability Is Not Authority | ChimpMaera](https://youtu.be/mxN9biyelZ0)

## Start here

First read [The ChimpMaera Canon](docs/CANON.md), the laws that define how
agency, authority, isolation, effects and evidence relate. Then read
[The Zoo Field Guide](docs/ZOO-FIELD-GUIDE.md) for practical Profiles,
deployment-adapter choices and evidence procedures.

Then read [docs/QUICKSTART.md](docs/QUICKSTART.md) and run:

```sh
./demo/install.sh
```

### Connect your first system

The public v0.1 snapshot connects only the bundled synthetic EspoCRM and
Dolibarr demo. After installation, use
[Connect Your First System](docs/CONNECT-YOUR-FIRST-SYSTEM.md) to inspect that
working path and to prepare a governed connection design for another source
system. The guide separates what works in this snapshot from locally validated
but unreleased contracts and planned onboarding capabilities.

Remove only installer-owned resources with:

```sh
./demo/uninstall.sh --purge
```

The installer never needs production credentials. It creates local random
demo secrets under `.chimpmaera-demo/`; that runtime directory is ignored and
is not part of this release.

## Included areas

- `demo/`: playable installer, local runtime, synthetic fixtures and rollback.
- `assets/brand/`: the public ChimpMaera master mark used by this repository.
- `packages/`: the narrow TypeScript contract/runtime source required by the
  demo image.
- `schemas/`: public machine-readable contracts used by the candidate.
- `tests/`: focused local tests for the governed effect gate and synthetic
  fixture integrity, including the deterministic Admin-AI preview boundary.

## Knowledge that travels safely

ChimpMaera is designed to standardize understanding across distributed source
systems without requiring all operational data to be copied into one place. It
formalizes dependencies, cause and effect, context, safe use and supporting
evidence while the underlying records can remain in their systems of record.

The intended knowledge-sharing building blocks are:

- System Advisor Guides in vendor-neutral JSON, YAML or Markdown that different
  AI systems can read consistently;
- machine-readable manifests and a capability catalog;
- reusable workflow recipes and a cause/effect/context graph;
- BI semantic contracts for consistent analysis;
- tests and evidence that bind recommendations to what was actually verified;
- sanitized contribution bundles for deliberately sharing reusable knowledge.

MCP can provide an optional access channel to these artifacts, but it does not
define the knowledge. The portable Guides and contracts do.

The intended community flywheel is compact:

> integrate a system → formalize knowledge → correlate data → analyze in BI →
> derive evidence-bound recommendations → feed validated Guides and recipes
> back to the community

Security enables this exchange. Shared artifacts carry provenance, trust class
and tenant scope; redaction and owner-controlled publication protect sensitive
context; shared or untrusted content grants no authority. ChimpMaera does not
claim a central data lake, a universal ontology or automatic publication of
private company data.

## Safety boundary

All published service ports bind to loopback. Backend networks are internal,
the demo does not mount the Docker socket, and the ChimpMaera container runs
as a non-root user with a read-only root filesystem. These are local PoC
guardrails (`CM-SEC-009`) and one Docker Reference Adapter, not a per-Agent
Docker product requirement, hostile-host boundary, or production-security
claim.

See [docs/KNOWN-LIMITATIONS.md](docs/KNOWN-LIMITATIONS.md) and
[SECURITY.md](SECURITY.md) before use. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
maps the shipped local implementation to the Canon without claiming production
coverage.

Repository-declared OCI, npm, CI and runtime/public byte closure can be checked
offline with `npm run supply-chain:verify`; see
[docs/SUPPLY-CHAIN.md](docs/SUPPLY-CHAIN.md) for its strict claim limits.

## Join the Zoo

Use ChimpMaera, inspect how it works, adapt it to your context and contribute
improvements through [CONTRIBUTING.md](CONTRIBUTING.md). Joining the Zoo means
participating in an open community; it does not imply company membership,
employment or authority.

Public delivery is tracked through one issue per clear, adoptable slice or
epic—not by mirroring every internal microtask. Issues, pull requests, evidence
and release notes remain linked from planning through actual publication;
`locally validated` is not `released`, and `planned` is not `proven`.

## License

Code is provided under Apache-2.0 as described in [LICENSE](LICENSE),
[NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
Bundled reference media has the narrower boundary described in
[MEDIA-LICENSE.md](MEDIA-LICENSE.md). Apache-2.0 grants no trademark rights.

Contributions are welcome under [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Developer Certificate of Origin process](CONTRIBUTING.md). Community conduct
is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Citation

Citation metadata is provided in [CITATION.cff](CITATION.cff). A directly usable
BibTeX entry is included below:

```bibtex
@software{pansky_chimpmaera,
  author = {Jim Pansky},
  title = {ChimpMaera},
  url = {https://github.com/JimPansky/ChimpMaera}
}
```

Citation is voluntary and does not replace license, notice, third-party, media
or trademark terms.

## Support

Like ChimpMaera and want to Support the Creator? Here you go:

<p>
  <a href="https://ko-fi.com/chimpmaera"><img src="assets/support/ko-fi.png" alt="Support ChimpMaera on Ko-fi" width="260" height="48"></a>
  &nbsp;
  <a href="https://buymeacoffee.com/jimpansky"><img src="assets/support/buy-me-a-coffee.png" alt="Support ChimpMaera on Buy Me a Coffee" width="260" height="48"></a>
</p>
