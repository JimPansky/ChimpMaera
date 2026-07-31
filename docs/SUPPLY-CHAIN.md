# Supply-chain declaration verification

ChimpMaera v0.2 includes an offline verifier for repository declarations:

```sh
npm run supply-chain:verify
```

It compares the versioned artifact lock with Dockerfile and Compose image
references, requires npm lock integrity fields, requires full commit SHAs for
CI actions, checks that every runtime module enters the runtime image, checks
critical public-release manifest coverage, and preserves the stock Paperless-
off boundary. A mismatch fails closed with a stable code.

A passing report means only that the checked repository declarations agree.
It does not verify registry signatures, SLSA provenance, transitive container
SBOMs, vulnerabilities, licenses, rebuild reproducibility or the safety of an
artifact's contents. The Paperless adapter has no OCI artifact because the
stock demo does not install Paperless; enabling a service later requires a
complete pinned application/database/queue/converter lock and separate live
evidence.

