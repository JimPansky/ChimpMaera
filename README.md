<p align="center">
  <img
    src="assets/brand/chimpmaera-negative.png"
    width="420"
    alt="ChimpMaera hybrid chimp-cyborg logo"
  >
</p>

# ChimpMaera

**Open knowledge. Governed agency. Verifiable outcomes.**

ChimpMaera is an open-source proof of concept and direction for a Knowledge
Operating System that turns scattered system knowledge into reusable guides,
contracts and workflows—without turning an AI agent into an authority. Today
you can run a local, synthetic
CRM-to-ERP proof of concept and inspect how a proposed action is governed,
executed, read back and proven.

[**Try the local POC**](#quickstart) ·
[**See how it works**](#how-it-works) ·
[**Verify security evidence**](docs/SECURITY-ASSURANCE.md) ·
[**Join the Zoo**](#join-the-zoo)

**Security, without magic words:** models and agents are untrusted proposers.
Inside the declared governed paths there is **no ambient authority, no master
key and no unmediated effect path**. Typed, default-off capabilities, policy,
approval, brokered execution, authoritative readback and receipts enforce that
boundary. The opt-in `FULL_CONTROL_LAB` profile deliberately leaves it and is
**not a security boundary**. Read the
[exact claims, evidence, maturity and TCB limits](docs/SECURITY-ASSURANCE.md).

## Release status

- **Current regular Latest release:** [`v0.2.0-poc.20260803.1`](https://github.com/JimPansky/ChimpMaera/releases/tag/v0.2.0-poc.20260803.1) — **Authority-Bounded Integration Contracts Increment**.
- **Historical predecessor:** [`v0.1.0`](https://github.com/JimPansky/ChimpMaera/releases/tag/v0.1.0) — historical only; it is not the current release.

Releases are accepted functional increments, not calendar events. Editorial
updates may describe progress, decisions, learnings or previews, but they do
not gate or prove publication. The exact Latest/draft/prerelease and anonymous
asset-readback rules are in [Release governance](docs/RELEASE-GOVERNANCE.md).
This release is not a production release, security certification, hosted
service, support promise or permission to connect real systems. Use only
synthetic data on a disposable or development host.

## What you can do today

- Run the loopback-only demo with fictional EspoCRM and Dolibarr data.
- Watch a safe proposal reach approval, execution, readback and a receipt—and
  watch denied, drifted or replayed actions fail closed.
- Inspect portable knowledge artifacts, typed capability contracts, policies,
  tests and evidence.
- Use the working local path to
  [design a governed connection](docs/CONNECT-YOUR-FIRST-SYSTEM.md) for another
  system without claiming an integration that has not been evidenced.

## Quickstart

From the repository root on a supported Linux host with Docker and Compose:

```sh
./demo/install.sh
```

Open the loopback URL printed by the installer. The demo needs no production
credentials; it creates local random demo secrets in an ignored runtime
directory. Follow the [full quickstart](docs/QUICKSTART.md) for prerequisites,
verification and troubleshooting.

Remove only installer-owned resources with:

```sh
./demo/uninstall.sh --purge
```

The current release and its evidence policy are listed in
[Release status](#release-status); `v0.1.0` is historical only.

## How it works

> **Owner asks → Agent proposes → Gateway decides → Workbench if needed →
> Broker executes → Readback / Receipt proves**

The Agent can assemble a typed candidate, but it cannot approve itself, choose
credentials or perform the effect. The trusted path evaluates authority and
policy, obtains explicit approval when required, executes only the declared
effect, then treats provider acceptance as incomplete until authoritative
readback and a bound receipt agree.

## Knowledge that travels safely

ChimpMaera's broader direction is a vendor-neutral Knowledge Operating System:
System Advisor Guides, manifests, capability catalogs, workflow recipes,
cause/effect/context graphs and BI semantic contracts that different tools can
understand consistently. Records can remain in their systems of record while
sanitized, provenance-bound knowledge becomes reusable.

Shared or untrusted knowledge grants no authority. Trust class, tenant scope,
owner-controlled publication and redaction protect sensitive context.
ChimpMaera does not claim a central data lake, universal ontology or automatic
publication of private company data.

## Join the Zoo

Pick the entry path that fits:

- **Use locally:** run or study the POC without publishing anything.
- **Report a gap:** open a focused issue; report vulnerabilities through the
  [private security route](SECURITY.md), never a public issue.
- **Solve an issue:** choose a bounded task and link evidence in the pull
  request.
- **Improve knowledge:** refine a Guide, contract, recipe, test or sanitized
  example.
- **Add an adapter or skill:** start with the
  [connection guide](docs/CONNECT-YOUR-FIRST-SYSTEM.md) and preserve the
  default-off, evidence-gated boundary.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow. Never contribute
secrets, personal data, private prompts, host inventories, local paths or
non-public security details. Joining the Zoo means participating in an open
community—not company membership, employment or authority.

## Go deeper

- [The ChimpMaera Canon](docs/CANON.md): normative laws for agency, authority,
  effects and evidence.
- [Zoo Field Guide](docs/ZOO-FIELD-GUIDE.md): practical Profiles, adapters and
  evidence procedures.
- [Architecture](docs/ARCHITECTURE.md), [known limitations](docs/KNOWN-LIMITATIONS.md)
  and [supply-chain verification](docs/SUPPLY-CHAIN.md).
- [Security Assurance](docs/SECURITY-ASSURANCE.md): complete scoped claims,
  maturity, evidence and non-claims.

## Watch ChimpMaera

Current overview videos are temporarily unavailable while their public naming
and claims are re-verified. No video is release evidence.

## Project details

Use [SECURITY.md](SECURITY.md) for private vulnerability reporting and
[SUPPORT.md](SUPPORT.md) for help. Code is Apache-2.0 under
[LICENSE](LICENSE), [NOTICE](NOTICE) and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); reference media follows
[MEDIA-LICENSE.md](MEDIA-LICENSE.md), and Apache-2.0 grants no trademark
rights. [CITATION.cff](CITATION.cff) provides citation metadata.
[Community conduct](CODE_OF_CONDUCT.md), the
[Developer Certificate of Origin](CONTRIBUTING.md) and the
[contributor workflow](CONTRIBUTING.md) apply. Voluntary creator support is
available through [Ko-fi](https://ko-fi.com/chimpmaera) and
[Buy Me a Coffee](https://buymeacoffee.com/jimpansky).
