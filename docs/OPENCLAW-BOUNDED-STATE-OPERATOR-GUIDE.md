# OpenClaw bounded runtime and state contract

Status: default-off local synthetic Reference Adapter for `OPENCLAW-M1.3`

This slice gives the pinned OpenClaw fixture narrowly bounded temporary state
and a managed synthetic mind store. It does not give the Agent host access,
privileged execution, arbitrary mounts, direct provider access, or a durable
production store.

## Effective runtime boundary

Both containers run as fixed non-root numeric users with a read-only root,
all Linux capabilities dropped, `no-new-privileges`, finite CPU, memory and PID
limits, no published ports, and one internal Compose network. Neither service
declares host PID/IPC, a device, a bind mount, the Docker socket, or an
arbitrary volume. The Gateway alone receives the labelled managed volume at
`/var/lib/chimpmaera`.

The Agent has three writable tmpfs mounts: `/tmp` (32 MiB), ephemeral OpenClaw
state at `/var/lib/openclaw` (64 MiB), and `/scratch` (exactly 1 MiB). They are
`noexec,nosuid,nodev`; `/scratch` and OpenClaw state end with the container
instance. Restart evidence writes exactly 1,048,576 scratch bytes, observes
`ENOSPC` for the next byte, restarts the Agent, and proves the file is absent.
Normal container pseudo-devices may still exist; the claim is that no host
device is mounted or declared, not that Linux exposes no device nodes.

## Managed mind-store semantics

Every operation is bound to workload identity, tenant, purpose, and generation.
Only `SYNTHETIC_PREFERENCE` and `SYNTHETIC_WORKING_NOTE` are accepted. Credentials,
customer or personal data, and production secrets are explicitly denied data
classes. Values are limited to 2,048 bytes, each scope to 16 entries and 16,384
value bytes, the envelope to 16 scopes, and retention to 86,400 seconds. The
persisted envelope is validated in full before readiness; malformed shapes,
unsafe counters, invalid effects/replay state, quota excess, excessive retention,
digest tampering, and stale generations fail closed. Expired entries are purged
before readiness and cannot be read.

Reset is a two-phase, persisted, scope-derived generation change. It deletes
only mutable entries in the bound scope. It preserves foreign-scope state,
effect replay receipts, and sanitised run evidence. During a prepared reset,
reads/writes deny. Startup completes a valid prepared reset before readiness;
an invalid or replayed journal fails startup/readiness. Old-generation reads
and writes deny. Repeating the same completed reset is safe and idempotent.
Persisted generations are bounded below the unsafe-integer edge. The exact
maximum advanceable generation can complete once into a valid final generation;
a further reset returns `MIND_GENERATION_EXHAUSTED_DENIED` without changing the
journal or mind state. The store-layer denial performs no persistence; at the
Gateway endpoint only the bounded denial counter is durably incremented.

Health means the process is live. Readiness additionally means the state file
is valid, no recovery is pending, and persistence succeeds. Quota exhaustion
is a scoped request denial and does not make the Gateway unready. Reset and
restart return to readiness only after the generation transition or recovery
has completed.

An existing valid `chimpmaera.aas035/gateway-state/v1` M1.2 file is upgraded
atomically to `gateway-state/v2` at startup. The migration preserves validated
effects and their receipts, replay JTIs, counters, and valid legacy mind entries,
then initializes the managed scoped mind envelope. Invalid legacy input is left
unchanged and startup fails closed. Purging valid legacy state is not an upgrade
step.

The setup image cache key covers every source used by both fixture Dockerfiles,
including `gateway-state.mjs`; changing only state validation therefore forces
the owned local Gateway image to rebuild on the next explicit setup.

## Reproduction and evidence

Offline and deterministic checks require Node.js and Docker Compose, but not a
running daemon:

```sh
npm run openclaw-runtime-lock:verify
npm run openclaw-m1.3:test
```

On the supported Linux/x86_64 Docker host, the explicit live smoke is:

```sh
./demo/openclaw-agent/smoke.sh
```

It records effective user, read-only filesystem, capabilities, privilege,
mounts, tmpfs/resource bounds, network, lifecycle, quota/reset/replay, and
tenant-isolation results beneath `.chimpmaera-aas035/runs/`. Inputs and values
are synthetic. The fixture is absent from ordinary Compose configuration and
starts only through profile `aas035`.

## Risk, fallback, and review marker

Rollback is ownership-scoped:

```sh
./demo/openclaw-agent/reset.sh --purge
```

That stops/removes only the candidate project, its labelled synthetic state,
and owned derivative image tags. Reverting the issue commits then restores the
prior default-off baseline. The scoped purge is destructive rollback to an
intentionally clean synthetic baseline, not the migration path for valid M1.2
state.

Docker, its daemon, the host kernel, and the Gateway remain in the TCB. Review
again if the runtime digest, platform, Compose controls, writable paths,
identity binding, data classes, quotas, retention, reset/recovery algorithm,
or public claim changes.

This does **not** claim hostile-host containment, production data protection,
durable backup, privacy/compliance certification, or disaster-recovery
guarantees. It also does not establish production multi-tenancy, customer-data
fitness, availability, or protection from a compromised Docker daemon/kernel.
