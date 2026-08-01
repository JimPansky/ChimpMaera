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

Pending prerequisite proof; no runtime image has been selected.

## Check

Pending prerequisite and implementation evidence.

## Act

Pending PDCA review and frontier audit.
