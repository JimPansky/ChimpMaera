# Supply-chain declaration verification

The current public release includes an offline verifier for repository
declarations:

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

## OPENCLAW-M1.1 reference-adapter verification

GitHub issue #4 completes the public traceability pass over the existing
AAS-035 OpenClaw Docker Reference Adapter. The exact offline identity and all
currently selected local build/runtime and executable-helper inputs are verified with:

```sh
npm run openclaw-runtime-lock:verify
```

The deterministic JSON report names OpenClaw `2026.7.1`, upstream commit
`2d2ddc43d0dcf71f31283d780f9fe9ff4cc04fe4`, the OCI index and linux/amd64
manifest digests, the digest-pinned Gateway base, supported host, and checked
artifact count. It reads only checked-in bytes; it performs no registry lookup
and starts no runtime. The lock is
`demo/manifests/supply-chain/openclaw-agent-runtime-lock-v1.json`, its verifier
is `scripts/verify-openclaw-agent-runtime-lock.mjs`, and the executable
positive/negative/lifecycle map is:

| OPENCLAW-M1.1 acceptance | Command | Exact primary artifacts |
| --- | --- | --- |
| Every runtime/build/lifecycle input is immutable | `npm run openclaw-runtime-lock:verify` | runtime lock; verifier; setup/reset/smoke/helper; both Dockerfiles; Compose; plugin package; V2 workload/network contract; 24 locked local inputs |
| Provenance result records exact tested identity | `npm run openclaw-runtime-lock:verify` | verifier JSON report and `security/openclaw-m1.1-evidence-v1.json` |
| Fresh checkout is off; explicit lifecycle is deterministic | `npm run openclaw-m1.1:test` | profiled Compose, `setup.sh`, `reset.sh`, focused tests |
| Unsupported or mismatched inputs deny before runtime | `npm run openclaw-m1.1:test` | offline verifier, setup preflight, Docker command spies |
| Platform, limits and rollback are explicit | this section | runtime lock, this declaration, issue PDCA/evidence bindings |

## OPENCLAW-M1.2 gateway workload boundary

GitHub issue #5 adds `chimpmaera.openclaw/gateway-workload-contract/v2`
without changing the existing V1 request or receipt formats. The local
synthetic identity is workload-, audience-, tenant-, scope-, route-,
correlation-, and time-bound for at most 60 seconds on the deterministic
fixture clock. Each identity identifier is accepted once. Its public
deterministic proof is intentionally not a secret or production authentication
mechanism.

The network contract has one allow entry: HTTP POST to
`capability-gateway:8080/v2/broker/capabilities/execute` on the internal
`aas035_gateway_only` Compose network. Everything else is default-denied. The
focused behavioral gate is:

```sh
npm run openclaw-m1.2:test
```

It executes the positive correlation-bound request and negative destination,
protocol, DNS, route, missing/expired/audience/tenant/scope/correlation/proof,
and replay matrix. The legacy `/v1/capabilities/execute` route is retained only
as a stable fail-closed V1 denial and cannot create an effect. Fresh V2
assertions may safely retry the same V1 `requestId`: the Gateway returns the
established `REPLAY_SAME_RECEIPT`, while reuse of an identical assertion is
denied before effect dispatch. It also reads back the finite policy and proves the fixture
has no ambient proxy or credential environment, host credential mount, live
credential-shaped fixture bytes, or production credential claim. Denial
results contain only a version, status, optional validated correlation ID, and
stable code.

Evidence is bound by the containing Git commit in
`security/openclaw-m1.2-evidence-v2.json` and mapped criterion-by-criterion in
`docs/development/openclaw-m1.2-issue-5-pdca.md`. Rollback first runs the
ownership-scoped `reset.sh --purge`, then reverts the containing commit through
normal review. This local contract is not hostile-network certification,
production identity assurance, production IdP/tenant/credential distribution,
service-mesh rollout, live provider or application-database access,
infrastructure activation, or evidence about untested container/runtime
escapes.

### Default-off local lifecycle

Requirements are Linux on x86_64 (`linux/amd64`), Node.js 24 for offline
verification, Docker Engine, and Docker Compose v2. A fresh checkout defines
the fixture only behind profile `aas035`; ordinary Compose configuration has no
service to enable or start. To opt into the isolated local fixture, run:

```sh
./demo/openclaw-agent/setup.sh
```

Setup resolves its worktree root without loading fixture helpers, then verifies
the checked-in provenance lock, selected host platform, executable `lib.sh`,
all three lifecycle entry points, the verifier bytes, and all other locked
local inputs. The verifier also rejects any unlisted file or non-regular entry
in the complete fixture tree. Only after that passes does it source the helper or permit the
first Docker command. It then builds only the two labelled local derivative
images and starts only the explicitly profiled, project-scoped services.
Stop/remove is deterministic and ownership-scoped:

Both service declarations and both direct build commands explicitly request
`linux/amd64`; every shared Compose lifecycle command also receives that fixed
default. A conflicting ambient `DOCKER_DEFAULT_PLATFORM` denies after offline
verification and before any Docker command. This binds local or remote-daemon
resolution to the platform manifest identity recorded by the lock.

```sh
./demo/openclaw-agent/reset.sh
./demo/openclaw-agent/reset.sh --purge
```

The first command stops/removes the fixture services and network while
retaining labelled volumes. `--purge` also removes those volumes and the two
owned local derivative image tags, and denies ambiguous labelled residue. It is
safe to repeat after an interrupted setup. It never installs or enables a host
service and must not be replaced with a broad Docker prune command.

### Fail-closed boundary, limitations, and rollback

Mutable upstream selectors, a missing digest or lock, provenance drift,
altered/missing local input bytes, and any host other than Linux/x86_64 deny
during offline preflight; focused tests prove the Docker spy receives no
invocation. Source rollback is:
first run `reset.sh --purge`, then revert the single issue commit through normal
repository review. Cleanup is not provider rollback or authority revocation.

This proof does not start or publish an external image, verify a registry
signature, establish current CVE status, provide a complete SBOM or third-party
licence clearance, prove reproducible upstream image construction, validate
other architectures, or establish production/hostile-host fitness. Docker and
the host kernel remain in the local trusted computing base. The verifier's own
checked-in digest detects normal byte drift, while the reviewed Git commit,
repository checksum ledger, and supply-chain closure provide its external
binding. This is not cryptographic protection against a malicious checkout
that rewrites the lock, verifier, lifecycle scripts, and their bindings
together.
