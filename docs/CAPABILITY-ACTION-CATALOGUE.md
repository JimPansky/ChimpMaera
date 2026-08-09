# Finite inactive capability/action catalogue

Status: **LOCALLY VALIDATED CANDIDATE, NOT MERGED OR RELEASED**
Work item: AAS-012 / issue #3

This contract defines a closed local-synthetic catalogue and exercises its
Gateway and broker boundaries. It does not install an adapter, contact a
provider, use a credential, or activate a production capability.

## Catalogue contract

Catalogue `1.0.0` contains exactly `crm.contact.create` and
`erp.order.create`. The catalogue and each entry carry a canonical-JSON
SHA-256 digest. Each entry declares its stable action ID, version, resource,
strict request and response JSON schemas, request/response/execution bounds,
evidence contract, limitations, and `INACTIVE` state. Unknown properties and
all entries outside this finite set are rejected.

The public schema is
[`schemas/contracts/capability-catalogue-v1.schema.json`](../schemas/contracts/capability-catalogue-v1.schema.json)
and the fixture is fictional and deterministic. Catalogue admission alone
does not show that an action is safe. Schema-only validation accepts exactly
one canonical CRM entry followed by one canonical ERP entry, including their
matched resources, request/response schemas, limitations, and digests.

## Presence and activation are separate

These states are deliberately independent:

| State or event | What it establishes | What it does not establish |
| --- | --- | --- |
| Present, installed, discovered, admitted, or listed | The inactive bytes validate and can be described | Activation, policy approval, credentials, or execution authority |
| Separately authorized | One trusted maintainer record binds one tenant to the exact catalogue version/digest and action version/digest until its expiry | Provider safety, production fitness, or authority for another tenant/version/digest |
| Locally validated | Deterministic synthetic Gateway/broker tests passed for the tested bytes | Merge, release, deployment, or production activation |
| Merged | Maintainers accepted source history | Release or activation |
| Released | Particular public bytes were published | Activation or production readiness |

Merge and release never imply activation. Activation requires the separate
authorization record even when the same catalogue bytes are present.

## Gateway and broker binding

The Gateway requires exact catalogue/action versions and digests, an unexpired
tenant-bound maintainer authorization, and a separately supplied trusted local
policy binding. The request policy digest must exactly match that binding and
the digest-bound ticket retains its policy ID, version, and digest. Identity,
sanitized correlation, a unique request ID, a permitted resource, a strict
request, and an evidence sink are also mandatory. Denied decisions carry no
ticket.

The broker verifies the Gateway decision digest, repeats catalogue and
authorization validation, checks the exact ticket bindings, request digest,
trusted policy binding, schema, resource limits, evidence sink, and replay
state. An injectable monotonic clock bounds the synchronous synthetic
`prepare` call before commit. This observes elapsed time after `prepare`
returns; it neither cancels a still-running external operation nor claims an
external timeout boundary.

Before invoking executor-controlled `prepare`, the broker atomically reserves
the request ID as `IN_FLIGHT`, then structured-clones and deep-freezes the
validated request. The snapshot is revalidated against the exact schema and
ticket request digest, and only that immutable, digest-bound snapshot is
passed to `prepare`; successful commit changes the reservation to `CONSUMED`.
Clone or snapshot validation failure denies before `prepare` and clears the
provably pre-effect reservation.
Reentrant use during prepare or commit and retry of a consumed ID deny. A
pre-commit schema, shape, clock, or resource denial clears the local
reservation because the synthetic effect boundary has not invoked `commit`.
If commit throws after a possible effect, the reservation remains consumed and
the receipt is `AMBIGUOUS` with an unknown effect count. It never reports a
known zero-effect denial for that uncertain boundary.

Prepared effects are runtime-checked as a closed object with a response and a
callable commit. Null, primitive, missing, or non-callable shapes deny without
throwing across the broker boundary. The validated response is cloned and
deep-frozen before commit; receipt bytes and digest use that snapshot, so a
commit cannot widen or invalidate its retained response after validation.

Allowed and denied Gateway decisions identify the requested catalogue/action
version and digest when supplied. Gateway decisions and broker receipts expose
only a SHA-256 correlation digest, not the raw correlation ID. Receipts bind
the exact request/response digests and report zero, one, or an explicitly
unknown effect count for an ambiguous consumed commit.

## Fail-closed probes

Tests deny unknown action, field, resource, version, and digest; inactive or
untrusted authorization; stale authorization; cross-tenant requests;
schema-invalid requests and responses; replay; and missing policy, identity,
correlation, or evidence sink. Stale/different policy, slow synchronous
prepare, duplicate schema entries, cross-paired schemas/resources, reentrant
prepare/commit replay, malformed prepared effects, request snapshot mutation,
uncloneable requests, response mutation, and commit ambiguity are also
covered. Tampered Gateway tickets are denied again by the broker. Every
ordinary denial has zero effects; the sole commit-throw path is conservatively
marked ambiguous and consumed.

## Rollback

Disable or remove the affected authorization records and catalogue version.
The fallback is the last verified inactive-by-default catalogue, or no
catalogue, with every action denied. Rollback must not select a wider version,
infer authority from discovery, or bypass exact version/digest checks.

## Limitations and non-claims

This slice makes no claim of agent-container integration, production
activation, live credentials, provider onboarding, infrastructure change,
production readiness, universal sandboxing, security certification, merge,
release, or publication. It is a local in-process contract with synthetic
fixtures. It does not prove hostile-runtime containment, distributed replay
protection, cryptographic maintainer identity, provider correctness, or
production evidence-sink durability. Its monotonic timing applies only to the
synchronous local `prepare` boundary, and its replay states are an in-memory
contract rather than durable distributed coordination.
