# HMI-002 synthetic adapter parity contract PDCA

Status: implemented and verified locally with synthetic fixtures; not installed,
activated, released or production-ready.

## Plan

Implement one bounded follow-on slice for issue #42: a pure transport contract
that maps synthetic OpenClaw and Codex fixture invocations to the same closed
HMI request, pins the exact verified generation, and keeps harness metadata out
of canonical semantic bytes. Do not create a live skill, plugin, harness
configuration, tool route, credential, authority field or mutable assignment.

Acceptance evidence was fixed before implementation:

- golden request and response semantic parity: 20/20;
- allowed operation mapping limited to the six frozen HMI operations;
- generation, core and adapter contract pins exact;
- harness transport metadata absent from canonical request/response bytes;
- caller limits may only preserve or tighten generation ceilings; and
- stale pins, unknown operations, ambient authority fields and drift deny.

## Do

- Added a closed adapter request contract for `discover`, `explain`, `plan`,
  `handoff`, `validate` and `contribute`.
- Added exact generation/core/adapter pins, canonical selected-input hashing,
  canonical request hashing and normalized response hashing.
- Kept `harnessId`, adapter version, correlation and presentation mode in a
  separate transport envelope.
- Added 20 public-safe golden requests spanning all six operations and two
  synthetic harness identities.
- Added denial probes for unknown operation, undeclared ambient credential
  fields, stale generation pin, widened limits, mutable adapter version,
  non-JSON input and post-verification generation drift.
- Declared only the source contract, fixture and test in the public staging
  manifest; this development evidence remains repository-only.

## Check

| Gate | Result |
|---|---:|
| Focused HMI core + adapter tests | 10/10 pass |
| Golden request canonical-byte/digest parity | 20/20 pass |
| Golden response canonical-byte/digest parity | 20/20 pass |
| New adapter denial probes | 7/7 deny with expected typed reason |
| Transport metadata found in canonical bytes | 0 |
| Adapter transport envelope size | below 8 KiB |
| Rights/routes/write/activation fields in canonical request | 0 |
| Full repository tests | 259/259 pass |
| TypeScript lint | pass |
| Supply-chain declaration verification | pass |
| Release-governance verification | pass |
| Isolated local public-stage build | 1/1 pass, 309 files |

## Act

This completes one locally reachable adapter-parity contract slice. It proves
that two synthetic transport envelopes can produce byte-identical canonical
request and normalized response semantics for the frozen 20-case corpus.

Conservative assumption: Wave 0 uses only adapter contract `1.0.0`, core
`1.0.0`, adapter version `synthetic-v1`, and the exact verified generation
digest. Risk: a reviewed core dispatcher may require an additive request field
or stricter per-operation shape. Fallback: revert this additive module, fixture
and test without changing the accepted generation or any runtime. Review
marker: first dispatcher integration, operation-specific schema, real harness
proposal, compatibility change or runtime use.

Next frontier: harden HMI progressive-disclosure and operation-specific safety
contracts without installing an adapter. A live OpenClaw/Codex skill or plugin
was consciously rejected because it would cross the local authority-free proof
boundary and requires a separately authorized proposal/install workflow.

Claim boundary: local deterministic synthetic contract evidence only. It does
not prove live harness compatibility, hostile-host isolation, operational
durability, release status or production readiness.
