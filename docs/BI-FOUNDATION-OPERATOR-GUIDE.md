# BI-001 default-off Docker foundation

This is a local synthetic foundation, not a dashboard or hosted BI service. A
fresh checkout defines no active service unless the `bi001` profile is selected.

## Reproduce

Use Linux/x86_64, Node.js 24, Docker Engine and Compose v2. Check out the exact
candidate commit reported with the delivery, then run:

```sh
cp demo/bi-foundation/config.example.json demo/bi-foundation/config.local.json
npm ci --ignore-scripts --no-audit --no-fund
npm run bi-foundation:test
./demo/bi-foundation/setup.sh
./demo/bi-foundation/start.sh
curl --fail http://127.0.0.1:12780/healthz
curl --fail http://127.0.0.1:12780/readyz
./demo/bi-foundation/stop.sh
./demo/bi-foundation/reset.sh
```

`setup.sh` verifies only and leaves the service off. `start.sh` is the sole
activation entry point. Health means the process responds; readiness additionally
requires its internal dependency, and Compose lifecycle completion uses
`/readyz`, not `/healthz`. Stop retains no persistent service data. Before reset
removes anything, it enumerates every container, network and volume carrying the
selected Compose project label and requires the fixture ownership label; it also
checks the local image. Any absent, foreign or ambiguous ownership fails before
`compose down`. Start and stop apply the same ownership precheck, and no lifecycle
command requests orphan removal. The profile declares no volumes, so reset never
requests volume deletion. Repeating reset after interruption is supported.

Local image handling has three fail-closed states. A successful inventory with no
matching image is clean absence; exactly one immutable image ID is accepted only
when its ID, fixture label and content-source label are readable and valid. List,
transport, permission, multiplicity or metadata failures are ambiguous and stop
before build, lifecycle mutation, image removal or a success message. Reset repeats
the same inventory after `compose down`, then removes only that validated immutable
image ID without force—never the mutable tag. If references change or remain, the
removal fails closed and reset does not claim success. This narrows local
concurrency risk but does not claim an atomic Docker inventory/removal transaction.

The single network is Docker-internal. Only the service health surface is bound,
and only to `127.0.0.1`. Both containers are non-root with read-only roots,
dropped capabilities, no-new-privileges, 32 PIDs, 64 MiB memory, 0.25 CPU and a
4 MiB temporary filesystem. No host path, socket, credential or persistent volume
is present. Missing/unsupported config, host/platform drift, mutable image input,
or changed locked bytes deny before lifecycle effects.

The additive BI-002 CRM declaration in `config.example.json` is also fixed to
`enabled: false`, the supported-export/API-shaped synthetic adapter, one
synthetic tenant, and `crm.synthetic.bi.read`. BI-001 lifecycle scripts do not
activate it. See `docs/CRM-READ-CONNECTOR-GUIDE.md` for its explicit local
adapter boundary and rollback.

The complementary BI-003 ERP declaration is independently fixed to
`enabled: false`, the same deterministic adapter shape, the synthetic tenant,
and `erp.synthetic.bi.read`. It does not alter BI-002 or grant cross-connector
authority. See `docs/ERP-READ-CONNECTOR-GUIDE.md`.

The lock records a digest-bound base and local byte closure. It does not establish
registry signatures, current registry/CVE completeness, SBOM or reproducible-build
provenance. The local image cache label hashes the ordered content digests only,
so identical bytes produce the same identity in different checkout paths. Roll
back by running `reset.sh`, then reverting the issue commits. If
Docker is unavailable, the deterministic offline verifier and behavioral tests
remain valid, while Compose-render and live-runtime evidence must be reported as
unavailable.

Non-claims: no production CRM/ERP/vendor compatibility, dashboard, production
deployment, hosted service, image publication, live credential, public exposure, availability,
production security, certification, current registry/CVE completeness, or
universal sandbox claim.
