<p align="center">
  <img src="assets/brand/chimpmaera-negative.png" width="560" alt="ChimpMaera hybrid chimp and cyborg chimera with wings, tail, and one red claw">
</p>

# ChimpMaera v0.1

ChimpMaera v0.1 is a local, synthetic proof of concept for a governed
CRM-to-ERP workflow. The included installer starts an isolated loopback-only
demo with ChimpMaera, EspoCRM and Dolibarr, seeds fictional data, performs one
explicitly governed business action and verifies the result through provider
readback.

The local v0.2 Wave 1 feature candidate on this branch adds an Approval
Workbench for the existing deterministic synthetic-order escalation: readable
business diff, explicit local Approve/Reject, a short one-use authority lease,
provider-gate enforcement, decision/effect receipts and semantic readback. It
does not call a live LLM or claim production authority. The v0.1.0 tag remains
unchanged.

This candidate is not a production release, security certification, hosted
service, support promise or permission to connect real systems. It contains no
credentials and should be used only with synthetic data on a disposable or
development host.

## Watch ChimpMaera

Easy Start: [Meet Your New AI Colleague | ChimpMaera](https://youtu.be/8mB7O81Y2xA)

More Infos: [How ChimpMaera Governs AI Actions | Plan, Approval, Evidence](https://youtu.be/8lj5nd-LJa4)

The Real Deal: [Controllable AI: Capability Is Not Authority | ChimpMaera](https://youtu.be/mxN9biyelZ0)

## Start here

First read [The ChimpMaera Canon](docs/CANON.md), the laws that define how
agency, authority, effects and evidence relate. Then read
[The Zoo Field Guide](docs/ZOO-FIELD-GUIDE.md) for practical application notes.

Then read [docs/QUICKSTART.md](docs/QUICKSTART.md) and run:

```sh
./demo/install.sh
```

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

## Safety boundary

All published service ports bind to loopback. Backend networks are internal,
the demo does not mount the Docker socket, and the ChimpMaera container runs
as a non-root user with a read-only root filesystem. These are local PoC
guardrails, not a hostile-host or production-security claim.

See [docs/KNOWN-LIMITATIONS.md](docs/KNOWN-LIMITATIONS.md) and
[SECURITY.md](SECURITY.md) before use. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
maps the shipped local implementation to the Canon without claiming production
coverage.

## Join the Zoo

Use ChimpMaera, inspect how it works, adapt it to your context and contribute
improvements through [CONTRIBUTING.md](CONTRIBUTING.md). Joining the Zoo means
participating in an open community; it does not imply company membership,
employment or authority.

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
