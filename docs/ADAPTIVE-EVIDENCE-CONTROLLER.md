# Default-off adaptive evidence controller

The controller is a bounded operator-invoked successor to Adaptive Evidence
Gates. It is **disabled by default** and is not a scheduler, daemon, hook,
GitHub client or autonomous publication mechanism.

It consumes an exact local configuration and a fresh digest-bound result,
persists state atomically, maintains a last-verified snapshot, and records
`WAITING_EXTERNAL` without translating it into failure or success. External
attempts saturate at three. A stale lease becomes `ATTENTION`; an active lease
collision, state drift, unsafe input or partial write fails closed.

The operator may stop a configured controller by creating the owned
`DISABLED` marker in its state directory. Disabled runs do not mutate state.

```sh
node scripts/adaptive-controller.mjs \
  --config ./controller-config.json \
  --result ./verified-result.json \
  --state-dir ./controller-state
```

The CLI accepts no other arguments and discovers no configuration or schedule.
Activation requires an operator-supplied configuration with `enabled: true`.
Result evidence
must be produced and verified outside this controller. SHA-256 state binding
detects drift but is not an authenticity or authorization mechanism.

Rollback is to create the disable marker and restore only the exact
`state.lkg.json` snapshot through an operator-owned atomic action. Never delete
historical evidence, widen a lease, infer external completion, or bypass the
existing full-suite/protected-delivery path.

Non-claims: no default activation, infinite liveness, external-system truth,
production readiness, multi-host consensus, security certification, GitHub
authority, owner-message trigger, hidden `sessions_send`, customer/live data,
gateway/provider mutation or automatic release.
