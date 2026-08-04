# CM Dev Worker M0 operator guide

## Supported outcome

M0 freezes `chimpmaera.dev/development-worker-profile/v1`,
`chimpmaera.dev/work-order/v1`, and `chimpmaera.dev/work-receipt/v1` and
provides one default-off, synthetic-only execution path. It admits exactly the
fictional issue IID 117 in the fictional `ChimpMaera-fixture` project, applies
one bounded documentation change, runs one allowlisted in-process test, emits
a deterministic receipt, and destroys its temporary workspace.

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

## Trust and authority boundary

The trusted controller validates the strict schemas, work-order digest,
project/issue/base snapshot, workload, lease, paths, capabilities, server-owned
model alias/provider-policy digest, exact budget, and publication absence
before creating an ephemeral projection. Model output remains an untrusted
proposal and passes credential, path, symlink, protected-path, patch-size,
budget, and scope-widening guards before the synthetic test runs. The receipt
binds normalized changed paths, patch, test output, usage, cleanup, and its own
digest. It contains no workspace path or raw prompt.

The worker receives no GitLab/OpenRouter credential, SSH agent, host home,
Docker socket, CI variable, registry credential, other repository mount, or
external network route. M0 implements no GitLab write, push, merge-request,
merge, tag, release, deployment, or runtime activation operation.

OpenCode is replaceable defense in depth, not a security boundary. The pinned
template [`demo/dev-worker/opencode-adapter-v1.json`](../demo/dev-worker/opencode-adapter-v1.json)
denies by default and explicitly denies web fetch/search, skills, subagents,
MCP configuration, plugins, and external directories. ChimpMaera's controller,
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
the pinned image, GitLab broker split, and network enforcement before M1.

Known non-claims remain real GitLab interoperability, real model-provider
behavior, production isolation, quality parity, publication, merge, release,
and deployment. Issue #117 keeps M1-M3 open.
