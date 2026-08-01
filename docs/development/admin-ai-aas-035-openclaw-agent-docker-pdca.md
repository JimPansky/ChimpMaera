# AAS-035 OpenClaw Agent Docker — PDCA record

Date: 2026-08-01
Branch: `feat/admin-ai-aas-035-openclaw-agent-docker`
Starting checkpoint: `3a2609036233f68f5e9e9afbb6b497c9ba969fa1`
Work item: `AAS-035` — OpenClaw Agent Docker, closed Gateway-only runtime
Initial prerequisite metric: **0/4**
Initial implementation metric: **0/12**

## Plan — maturity review before implementation

The Owner requires a real OpenClaw agent runtime as the highest product
frontier after AAS-012. OpenClaw is untrusted workload code: it can propose a
typed request but is never the Decision, Policy, Authority or Effect plane. The
currently running Owner OpenClaw, Gateway, vLLM and model infrastructure are
explicitly excluded. This slice can create, build and test only isolated,
ChimpMaera-owned fixture services and state.

Image selection is fail-closed behind four prerequisite gates:

1. official upstream source proves an actually supported Docker setup;
2. one exact upstream version/source revision and OCI digest are resolved;
3. source and bundled dependency licences permit the intended local build/test
   and any later redistribution claim remains separately evidenced;
4. this 12-case acceptance/negative/rollback/non-claim contract is recorded in
   the isolated worktree before service implementation.

Unknown, mutable, unofficial or licence-ambiguous provenance means no runtime
image is selected. A source-built fixture may be considered only when its base
and package inputs are also exact and the resulting local image identity is
recorded; it does not become an upstream-published-image claim.

### Twelve measurable implementation gates

1. **Image/provenance lock:** exact OpenClaw version, source commit, upstream
   Docker evidence, licence evidence, base image/package locks and resolved OCI
   digest are machine-readable; mutable tags and unknown provenance deny.
2. **Default-off service:** the service is excluded from ordinary startup and
   requires an explicit isolated fixture profile/command; catalog admission or
   install never activates it.
3. **Non-root read-only sandbox:** a fixed non-root UID/GID, read-only root,
   dropped capabilities, no-new-privileges, bounded tmpfs and resource limits
   are verified from both Compose and the running isolated fixture.
4. **No host authority:** no host path, root filesystem, Docker/Podman socket,
   device, privileged mode, PID/IPC namespace or process-control mount exists.
5. **Gateway-only network:** the agent attaches only to an internal isolated
   Gateway network; no default/external/provider/ERP/CRM route or DNS/proxy
   escape is available from the workload.
6. **Workload identity and zero ambient credentials:** one synthetic workload
   identity is bound to tenant/purpose/catalogue; image/config/environment/state
   contain no provider, system, registry, host or Owner credentials.
7. **Managed mind-store contract:** durable agent memory is an explicit bounded
   ChimpMaera-owned volume/API with tenant, purpose, trust, retention, quota,
   digest and reset semantics; arbitrary host filesystem persistence denies.
8. **Health/readiness/reset:** deterministic setup, liveness, dependency-aware
   readiness, restart recovery and idempotent reset are documented and tested.
9. **Typed Gateway request E2E:** a real OpenClaw runtime emits one exact AAS-012
   action request to the fixture Gateway; only Gateway/Broker mediation can
   produce the synthetic effect path, never a direct provider call.
10. **Receipt/readback/load evidence:** successful mediation binds identity,
    catalogue/action/Policy/authority/effect/readback digests; bounded concurrent
    load retains health and exactly-once/deny semantics.
11. **Negative matrix:** Gateway bypass, direct Internet/provider/ERP/CRM,
    filesystem/process/socket/device, credential discovery, raw/unknown action,
    incompatible image/catalogue, cross-tenant/mind-store, replay/reset/restart
    and resource-exhaustion probes fail closed without foreign effects.
12. **Clean rollback:** only fixture services/networks/images/volumes/state are
    stopped and purged; receipts/evidence survive as declared, zero owned runtime
    residue remains, and the Owner stack is byte/config/process-identical.

### Exact acceptance tests

- Validate the machine-readable provenance lock against checked-in upstream
  evidence and exact digests; independently resolve the selected reference.
- Render ordinary and explicit-profile Compose configurations and prove the
  OpenClaw service is absent from the former and closed in the latter.
- Inspect the running fixture's user, capabilities, security options, mounts,
  namespaces, networks, environment, filesystem and resource limits.
- Bootstrap/reset twice, persist one bounded mind entry across restart, reject
  foreign tenant/purpose access, then purge only owned state.
- Drive one real typed request from OpenClaw through the fixture Gateway/Broker,
  assert receipt plus semantic readback, and exercise bounded parallel load.
- Capture pre/post fingerprints for the excluded Owner OpenClaw/Gateway/vLLM/
  model processes/configuration without reading secrets or changing them.

### Exact negative probes

- Mutable/unresolved/wrong-platform image, source/tag/digest mismatch, missing
  Docker support or licence, unexpected package/base image and altered lock.
- Ordinary startup, catalogue admission or dependency readiness attempting to
  activate the service; disabled/default-off state falsely reporting ready.
- Root UID, writable root, added capability, privileged/device/PID/IPC sharing,
  Docker socket, host bind, undeclared volume or executable writable mount.
- Internet, metadata, loopback/host-gateway, DNS rebinding, redirect/proxy and
  direct provider/ERP/CRM paths; alternate network attachment after startup.
- Provider/system/Owner credential in image history, layers, environment,
  config, logs, mind store or error text; workload identity/tenant substitution.
- Host path/file/process/socket access, raw effect or shell action, unknown/open
  field/path, inactive/incompatible catalogue, replay and cross-tenant memory.
- Slow/oversize/fork-bomb/retry/concurrency/storage pressure, crash/restart and
  reset races; false success, duplicate effects or unbounded residue deny.

### Conservative local assumption

- **Purpose:** prove a useful real agent workload without expanding its ambient
  authority or coupling ChimpMaera to the Owner's live OpenClaw installation.
- **Assumption:** synthetic workload identity, Gateway/Broker, provider and mind
  fixtures are sufficient to test the local boundary composition; they are not
  production identity, network, provider or storage infrastructure.
- **Risk:** Docker/Compose controls share the host kernel, and a pinned upstream
  source/image can still contain undiscovered vulnerabilities or licence issues.
- **Fallback:** keep the service absent/default-off, detach its isolated network
  and remove only ChimpMaera-owned fixture state; if any prerequisite or negative
  probe cannot be closed, retain a deny-only protocol fixture with no OpenClaw
  runtime rather than weaken isolation.
- **Review marker:** require independent registry signature/SBOM/CVE/licence,
  production workload identity, network-policy and host-sandbox evidence before
  any deployment or redistribution claim.

### Rollback boundary

Rollback may stop and purge only resources carrying the unique AAS-035 fixture
ownership labels and paths. It must never stop, restart, reconfigure, inspect
secret state from or containerize the running Owner OpenClaw, Gateway, vLLM or
model services. Source rollback removes the additive AAS-035 fixture/lock/tests
while preserving AAS-012's inactive catalogue and prior receipts.

### Honest non-claims

Even complete local evidence would not prove a production sandbox, VM boundary,
host-kernel resistance, registry signature, complete SBOM/CVE/licence analysis,
live provider safety, production IAM/network policy, multi-tenant deployment or
security completeness. No push, PR, merge, tag, release, publication, live
credential, production deployment or external-system mutation is authorized.

## Do

Completed the read-only prerequisite proof against stable upstream v2026.7.1.
Official source, Docker documentation, Dockerfile, release evidence, OCI index,
platform manifest/config and MIT licence were bound into a machine-readable
lock. ChimpMaera selects only the immutable external GHCR reference for an
isolated local fixture and does not reuse upstream Compose or redistribute image
bytes. No OpenClaw service has been started.

## Check

Prerequisite metric:
`aas_035_openclaw_provenance_prerequisite_gates` **4/4 — complete**.
The offline verifier proves the exact source/version/index/platform/base
bindings, MIT/reference-only distribution boundary, required non-claims and
default-off/zero-ambient-authority selection policy. Mutation probes for a
mutable tag, source/digest/platform drift, licence/redistribution overclaim,
socket/egress permission and removed non-claim deny.

This does not yet advance any of the 12 runtime implementation gates; their
metric remains **0/12** pending the isolated Compose/service implementation.

## Act

Close the 4/4 prerequisite metric and do not repeat it without provenance drift.
Switch to `aas_035_openclaw_agent_docker_gates` **0/12**. The selected image may
be consumed only by the new default-off, internal-network fixture; upstream
Compose remains rejected. WIP stays one on AAS-035 and no lower-priority data,
ERP/CRM, BI or DMS breadth starts while this runtime slice is active.

## Runtime implementation PDCA — 12/12 closure

### Plan

Implement the already locked OpenClaw image as one explicitly profiled,
ChimpMaera-owned fixture. Keep OpenClaw untrusted and expose exactly one typed
AAS-012 action through a synthetic Gateway/Broker/provider path. Freeze the
runtime bytes only after focused and complete repository tests pass, then spend
the full-smoke budget once on the final corrected byte set.

### Do

Added the `demo/openclaw-agent` fixture with an internal-only Compose network,
non-root/read-only services, dropped capabilities, bounded tmpfs/process/RAM/CPU
limits, labelled volumes and no host bind, device, namespace, port or socket
authority. The agent image derives from the immutable upstream OCI index, loads
one closed plugin and one synthetic model route, and has no live credential or
direct provider route. A managed tenant/purpose/trust/quota-bound mind store,
durable receipts, idempotent semantic reset and ownership-scoped setup/purge are
implemented by the isolated fixture Gateway.

Runtime implementation commit: `2ddfd1e5ec70e6f6fc233aebc68339c1f709bf2d`.

The real upstream OpenClaw CLI completed the exact typed tool call through the
Gateway/Broker fixture. Five explicit HTTP denials, six egress targets, four
filesystem/host-authority targets, replay/load, cross-tenant, oversize, restart,
semantic-reset and idempotent-purge probes were exercised. The concurrency
probe was corrected from competing OpenClaw CLI writers to four concurrent
replays through the already proven OpenClaw tool boundary; this measures the
Gateway exactly-once boundary without introducing an unrelated shared-session
writer race.

### Check

`aas_035_openclaw_agent_docker_gates` is **12/12 — complete**:

1. immutable upstream/source/image/base/package lock: PASS;
2. ordinary Compose startup contains zero AAS-035 services: PASS;
3. non-root/read-only/capability/resource posture, static and live: PASS;
4. zero host/Docker/device/namespace authority: PASS;
5. one internal Gateway-only network and denied external routes: PASS;
6. synthetic bound workload identity and zero ambient credentials: PASS;
7. bounded managed mind-store persistence, quota and tenant isolation: PASS;
8. deterministic health/readiness/restart/setup/reset: PASS;
9. real OpenClaw to typed Gateway/Broker synthetic effect E2E: PASS;
10. receipt/readback/policy/authority digests and concurrent replay load: PASS;
11. complete negative matrix fails closed with one total synthetic effect: PASS;
12. idempotent labelled rollback leaves zero owned runtime residue: PASS.

Evidence: focused AAS-035 tests **7/7**, complete repository tests **102/102**,
video reference **15/15**, repository checksums **154/154**, supply-chain
verifier **6/6**, deterministic public staging PASS, and final
frozen-byte smoke `aas035-20260801T115932Z` PASS in **25,811 ms**. The smoke
recorded five denied Gateway requests, twelve effect attempts, exactly one
effect, two model calls, one receipt digest, one durable mind digest and
identical excluded-Owner fingerprints before/during/after. Summary SHA-256 is
`98c79565d04a9341f9b522ca5cb2c1ea58378d915061006534c09589fe1be538`.
Machine-readable evidence is in
`docs/development/evidence/admin-ai-aas-035-20260801.json`.

Correcting-byte history is explicit: the first run corrected an existence-only
`/proc/1/root` probe into an actual denied read and removed nondeterministic
local build attestations; the second baked the finite OpenClaw bootstrap set so
the immutable workspace stayed read-only; the third replaced concurrent CLI
device-pairing races with concurrent Gateway replay after one real OpenClaw E2E;
and the last correcting run renamed a managed cache path rejected by the public
hygiene scanner. Each repeat followed a real affected-byte change; the final run
is the only evidence used for closure.

### Act

Close AAS-035 at **12/12** and do not repeat this metric or the full smoke absent
a new correcting runtime/install-byte change. The conservative assumption held:
synthetic identity, provider and storage prove local boundary composition only.
Fallback remains default-off removal of labelled fixture resources. Review still
requires registry signature/SBOM/current-CVE/complete-licence evidence plus
production workload identity, network policy and stronger host isolation before
deployment or redistribution claims. No Owner OpenClaw/Gateway/vLLM/model byte,
configuration or process changed; no push, PR, merge, release or publication was
performed.
