# CM Dev Worker M0 operator guide

## Supported outcome

M0 freezes `chimpmaera.dev/development-worker-profile/v1`,
`chimpmaera.dev/work-order/v1`, and `chimpmaera.dev/work-receipt/v1` and
provides one default-off, synthetic-only execution path. It admits exactly a
fictional issue IID 117 snapshot bound to the current public repository
identity, applies one bounded documentation change, runs one allowlisted
in-process test, emits a deterministic receipt, and destroys its temporary
workspace.

Build and run it from the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run dev-worker:synthetic
```

Running `node dist/packages/dev-worker/src/cli.js` without
`--synthetic-fixture` fails closed. M0 never accepts a URL, credential,
repository path, provider/model name, shell command, publication target, or
arbitrary issue selector from the CLI.

## M1A bootstrap mode

M1A adds a default-off bootstrap command for a trusted controller-owned,
OpenAI-compatible model frontdoor and a pre-materialized read-only repository
projection:

```sh
node dist/packages/dev-worker/src/cli.js --m1a-bootstrap-config demo/dev-worker/m1a-bootstrap.example.json
```

The example config is intentionally disabled and contains no secret. A trusted
operator must materialize the repository projection and structured issue
snapshot first, compute the file and manifest digests, bind the allowed and
denied paths, and only then flip the private controller config to `enabled:
true`. The worker cannot provide or override a base URL, model ID, provider
kind, headers, key, provider-policy digest, or budget. Those values are
server-side broker configuration only.

Credential values are resolved only from handles inside the trusted
controller. For the OpenRouter profile, provide `OPENROUTER_API_KEY` to the
trusted broker process and use only the handle
`credential-handle:openrouter-api-key` in config. For a generic
OpenAI-compatible endpoint, provide `OPENAI_COMPATIBLE_API_KEY` to the broker
process and use `credential-handle:openai-compatible-api-key`. Do not place the
credential in a work order, child environment, prompt, repository projection,
log, error text, or receipt. Missing credentials fail closed.

The model may return only strict
`chimpmaera.dev/patch-candidate/v1` JSON with one bounded file change against
the bound base commit and file digest. The trusted controller applies that
candidate only in an ephemeral copy, runs the existing allowlisted verifier,
emits a normalized patch/test/cleanup receipt, and removes the workspace. The
authoritative checkout or projection root must remain unchanged.

## M1B public-source boundary

The trusted controller admits exactly `JimPansky/PANSPHAIRA` from the public
GitHub origin `https://github.com/JimPansky/PANSPHAIRA.git`. It binds one
immutable base commit, one issue-snapshot digest, the projection manifest, and
the path policy before a provider can be invoked. Anonymous public read is the
preferred materialization route. GitHub authentication, when separately
authorized for review or merge operations, belongs only to the trusted
controller and is never forwarded to the worker or model.

There is deliberately no local-GitLab client, mirror, token, project lookup,
listing, search, URL selector, project-ID selector, or fallback. Any GitLab
host/URL/project request and every other repository identity is rejected as
`FOREIGN_SOURCE_DENIED` before provider invocation. The rejection is generic:
it does not confirm whether the requested source exists and does not reproduce
foreign identifiers in model payloads or receipts. A provider-call counter is
part of the trusted test boundary and must remain zero for all such denials.

For an issue-bound new-file pilot, the trusted projection separates readable
input paths from the single writable output path. The controller digest-binds
the minimal public issue snapshot and each admitted input file, while the
candidate must use the SHA-256 of empty bytes as `beforeSha256` for the one new
file. Readable inputs never become writable merely because they are visible to
the model.

### Default-off post-M1B model candidates

The following provider IDs are trusted-controller candidates only. They are
not worker inputs, active routes, benchmark winners, or production defaults:

- `cm.dev.fast` → `deepseek-ai/DeepSeek-V4-Flash-0731`
- `cm.dev.code` → `moonshotai/Kimi-K2.7-Code`
- `cm.dev.long` → `zai-org/GLM-5.2`
- `cm.dev.escalate` → `deepseek-ai/DeepSeek-V4-Pro`

All four mappings remain default-off. The worker sees only an admitted alias;
the trusted controller owns the provider ID, route, credential, policy digest,
and budget. `cm.dev.primary` remains deliberately unassigned until a later
controlled PanSphaira benchmark uses identical tasks and hidden gates to prove
the quality, cost, and latency choice. No Kimi, GLM, or Pro call is M1B
evidence. A pilot against any superseded preview ID is also not evidence for
the `DeepSeek-V4-Flash-0731` candidate.

Self-development remains without self-authority: the worker may propose
changes to PanSphaira as a reviewable patch/test/receipt bundle, but it cannot
activate its own controller changes, widen protected paths, write CI or GitHub
workflow files, publish a branch, create or update a review, merge, tag,
release, deploy, or change provider policy.

## M1B single-repository isolation

M1B keeps the live path default-off and narrows the first public pilot to a
trusted-controller materialized projection from `JimPansky/PANSPHAIRA` only.
The controller binds the public repository identity, Issue #117 snapshot
digest, base commit, projection manifest digest, `PUBLIC_OSS` data class,
server-side `cm.dev.fast` alias, DeepInfra model ID, budget, lease, allowed
paths, denied protected paths, and no-publication boundary before any provider
call is possible.

The worker still receives no source-host credential, model credential, home or
workspace root, other repository mount, Git remote, Docker socket, unrestricted
network, repository listing/search surface, merge authority, release authority,
or publish authority. Private or foreign source identities, arbitrary
repositories, project identifiers, repository URLs, path traversal, symlink
escapes, mixed provenance, stale issue/base bindings, credential-shaped
material, protected paths, expired leases, model/provider/budget widening, and
prompt attempts to widen scope must deny locally with provider-call count `0`.

Live provider output remains untrusted. The trusted controller may retain a
DeepInfra result only as a bounded patch/test/receipt candidate after schema,
path, digest, budget, and cleanup validation. Low-quality, empty, ambiguous,
or scope-widening candidates are negative evidence, not a reason to widen the
route or retry outside the configured call cap.

## M2 trusted Draft-MR publication boundary

M2 adds three strict, versioned contracts:
`publication-broker-request/v1`, `publication-broker-readback/v1`, and
`publication-broker-receipt/v1`. The default-off trusted broker accepts only
an already-bounded patch and exact project, repository, Issue #117 snapshot,
work-order ID/digest, lease ID/expiry, base ref/commit, changed-path digest,
patch digest, and fresh `cm/dev-worker/117/*` branch. It can perform exactly
three effects: create that branch, push the bounded patch, and create an open
Draft MR targeting the bound base. Authority stays in controller-owned policy;
the worker's v1 work order remains publication mode `NONE`.

The broker rejects unknown fields, version or digest drift, malformed or
expired requests, replay conflicts, branch collisions, foreign or protected
paths, non-Draft or retargeted MRs, forbidden authority language, and
credential-shaped content before publication. Exact replay returns a new
digest-valid `REPLAYED` receipt without calling the provider again. Success
requires strict authoritative readback of project, branch, base/head, open
Draft MR, target, patch, paths, and sanitized CI metadata; provider
acknowledgement alone is insufficient. Malformed, secret-shaped, or dishonest
readback fails closed.

The deterministic GitLab-compatible fake is the only adapter in this slice.
It supports injected push, MR, and readback failures so tests prove owned
branch/MR cleanup after partial failure. No CLI mode exposes publication and
no credential value, URL, raw CI log, or provider error enters a request,
readback, receipt, or denial.

Scope and evidence are the strict contracts, fake adapter, broker, positive
publish/replay/readback tests, and negative authority/confusion/failure tests.
The dependency is clear because this boundary consumes M1's admitted patch and
does not require M3 scheduling, independent model review, or a second adapter.
Risk: a future real adapter could implement readback or cleanup dishonestly;
fallback is to keep `enabled: false`. Rollback marker: revert the M2 contracts,
broker, tests, manifest entries, and these guide/checklist additions; synthetic
state is in memory and no external cleanup is needed.

Non-claims: this is not a real GitLab/OpenRouter mutation, provider onboarding,
production activation, runtime/network isolation proof, customer-data test,
merge/mark-ready/force-push/delete/tag/release/admin/variable/runner/registry
authority, independent review, M3 parallelism, or second-adapter evidence.

## M3 controller scheduling and independent review

M3 adds strict `governed-workload-request/v1` and
`governed-workload-receipt/v1` contracts without changing any M0–M2 wire
format. The default-off controller must be explicitly enabled by trusted local
policy. Admission is synchronous and deterministic: schema/digest, freshness,
request identity, adapter binding, workload/lease/identity/capability/model
binding, writer-scope conflicts, then global/project/provider budgets. A
reservation is recorded before an adapter can yield. Writer exclusion is keyed
independently by project-and-issue and project-and-work-order, so concurrent
attempts cannot obtain two writer leases for either scope. Global, project and
provider parallel, request and cost ceilings are controller-owned and
cumulative; exhaustion denies rather than queues, retries, or widens.

The reviewer is a distinct `workload:cm-dev-reviewer-m3` workload using the
server-bound `cm.dev.review` route, its own `REVIEWER` lease, and only
`cm.dev.evidence.read`. Its frozen adapter input contains an evidence digest,
workload kind and model alias: no workspace path, patch-write function,
publication function, route selector or budget editor exists. Output claiming
workspace mutation, publication, path/route/budget widening, a patch, or a
writer lease is denied. The receipt records all five authorities as false.

Both `opencode-contract-fixture` and `portable-local-fixture` implement the
same thin adapter interface and are bound by ID, semantic version and config
digest. They are deterministic in-process JSON fixtures. This proves that the
governance core is not coupled to OpenCode-specific APIs; it does **not** prove
or claim execution of OpenCode, Aider, mini-SWE-agent, a live model provider,
network isolation, or a real source host. Adapter output digest, workload and
usage mismatches fail closed. Failed admitted attempts retain their reserved
cumulative request/cost allocation conservatively. Active slots are released
in `finally`, while first-writer lease ownership remains bound to each issue
and work-order scope for the controller lifetime.

M3 evidence is the two schemas, controller core, two fixture paths, positive
receipts, and adversarial tests for parallel oversubscription, same-issue and
same-order writers, every budget tier, reviewer authority attempts, adapter
mismatch/tampering, replay/conflict, expiry, wrong identity/lease/capability/
model, and unknown fields. No M3 CLI or publication route is added.

Assumption: one controller instance is the atomic admission domain. Risk: the
in-memory reservation ledger does not coordinate multiple processes or survive
a restart. Fallback: run one default-off controller instance or place the same
compare-and-reserve transition behind a durable transactional store before
production. Review marker: require a cross-process linearizability design and
crash-recovery test before distributed activation.

Rollback: revert the M3 contract additions, governance source, schemas, test,
package test entry, manifest/checksum entries, and these documentation
sections. The fixture adapters perform no external effects, so rollback needs
no provider, workspace, branch, MR, credential, infrastructure, or release
cleanup.

## Trust and authority boundary

The trusted controller validates the strict schemas, work-order digest,
project/issue/base snapshot, workload, lease, paths, capabilities, server-owned
model alias/provider-policy digest, exact budget, and publication absence
before creating an ephemeral projection. Model output remains an untrusted
proposal and passes credential, path, symlink, protected-path, patch-size,
budget, and scope-widening guards before the synthetic test runs. The receipt
binds normalized changed paths, patch, test output, usage, cleanup, and its own
digest. It contains no workspace path or raw prompt.

The worker receives no source-host or model-provider credential, SSH agent, host home,
Docker socket, CI variable, registry credential, other repository mount, or
external network route. The worker implements no source-host write, push, review,
merge, tag, release, deployment, or runtime activation operation.

OpenCode is replaceable defense in depth, not a security boundary. The pinned
template [`demo/dev-worker/opencode-adapter-v1.json`](../demo/dev-worker/opencode-adapter-v1.json)
denies by default and explicitly denies web fetch/search, skills, subagents,
MCP configuration, plugins, and external directories. PanSphaira's controller,
filesystem projection, isolation, and external broker remain authoritative even
if a harness permission is missing or bypassed.

## Pin and evidence boundary

The template follows the official OpenCode configuration and permission docs
at upstream tag `v1.18.12`, tag-object commit
`729a6eda23a431a287aed28307e248ec3561cb1b`, checked 2026-08-04. The controller
binds that identity and the template SHA-256. M0 does not download or execute
OpenCode, so this is a configuration-contract pin rather than supply-chain or
runtime evidence. Before M1, an owner must replace it with a verified immutable
image digest and re-check current config semantics.

## PDCA evidence and recovery

- Plan gates: strict schemas, synthetic-only CLI, deterministic success,
  required negative probes, cleanup, repository checks, and CI.
- Do: the server fixes the synthetic project, route, provider policy, budget,
  capabilities, test, and no-publication boundary.
- Check: `tests/development-worker.test.ts` covers the positive pilot,
  determinism, schema drift, stale/cross-boundary inputs, credentials,
  traversal/symlinks/protected paths, budgets, prompt injection, and forbidden
  publication authority.
- Act/recovery: remove the M0 files and package-script entry to roll back; no
  external state needs cleanup. A cleanup failure is a hard denial.

Conservative assumption: an embedded synthetic OpenAI-compatible response is
enough to prove adapter shape without implying provider behavior. Risk: it
cannot prove network isolation or real provider accounting. Fallback: retain
the default-off CLI and require separate M1 evidence. Review marker: validate
the pinned image, controller/broker split, and network enforcement before any
broader runtime claim.

Known non-claims remain arbitrary source-host interoperability, live OpenRouter evidence,
production isolation, quality parity, publication, merge, release, and
deployment. M1A uses local fake-provider tests only; Issue #117 keeps M1B-M3
open.
