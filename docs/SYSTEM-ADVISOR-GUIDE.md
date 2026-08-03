# System Advisor Guide contract

Status: **RELEASED, LOCAL-SYNTHETIC CONTRACT SURFACE**. The Guide authoring and
validation contract is present in the current regular release. A System Advisor
Guide is bounded knowledge for discovery and planning. It is data, not
authority, executable code, a credential store, live onboarding, tenant/provider
activation or proof that a live system is supported.

## Required content

A guide should bind one stable guide ID and version to one system type and list
only the operations it explains. For each selected operation it should cover:

- purpose, inputs, outputs and effect class;
- affected objects and dependency/cause relationships;
- safe defaults, preconditions, failure modes and rate/tenant boundaries;
- readback and reconciliation expectations;
- reversal or recovery requirements for effectful operations;
- references to synthetic fixtures and expected evidence.

Pair the guide with a Machine Manifest containing stable object, operation and
effect-class identifiers. Put ambient business/process knowledge in separate
typed context records. Discovery may select context only when the requested
operation and guide both reference it.

## Content boundary

Do not include credentials, secret values, private absolute paths, raw prompts,
raw runtime receipts, customer/tenant records, unrestricted log extracts,
publication authorization or executable privileged scripts. Use opaque handles
only in an authorized runtime contract; a contribution bundle carries digests
and public relative source paths, not live handles or raw evidence.

Unknown operations stay inactive `UNRESOLVED_INTENT`. An exact capability ID is
reused only when system type, operation ID and effect class also match. Similar
names are insufficient. Conflicting exact IDs deny the resolution.

## Review checklist

- Schema, version, system type and operation coverage are explicit.
- Object and context selection is minimal and traceable to the requested goal.
- Every effect class has an Owner route and every effectful operation has a
  pre-activation recovery strategy.
- Fixtures are synthetic and target semantics live in digest-bound contracts,
  not branches in the shared Builder core.
- Non-claims distinguish local contract evidence from production and release.
- Sanitized contribution remains opt-in and publication remains separately
  unauthorized.
