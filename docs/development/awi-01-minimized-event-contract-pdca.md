# AWI-01 minimized event, consent and retention contract PDCA

Status: released as regular Latest `v0.2.0-poc.20260804.4`; no collection,
telemetry, training, ingestion or runtime authority was added.

## Plan

Deliver issue #43 as an authority-free contract slice. The ten SMART gates are
closed field classification, consent vocabulary, finite retention/deletion,
pseudonymous digest-bound sources, complete prohibited-field denial,
disclosure-safe public projection, 100 canonical reorderings, repository
gates, protected integration, and regular Latest release/readback/issue truth
plus exactly one later Verification Fabric Shadow sample.

Assumption: a synthetic schema and pure evaluator can prove minimization and
lifecycle semantics without collecting data. Risk: schema conformance could
be mistaken for consent to collect, or a free-form field could leak through
readback. Fallback: deny unknown, prohibited, unclassified, expired, deleted,
digest-mismatched or consent-invalid input; return fixed reason vocabulary;
keep all collection and ingestion absent. Review markers: before PR, after
required CI, at release readback and before issue closure/Shadow sampling.

## Do

- Added one closed Draft 2020-12 record schema and matching TypeScript types.
- Added an exact 29-field classification registry and 16 prohibited fields.
- Added a pure evaluator with explicit evaluation time and canonical SHA-256.
- Added public-synthetic consent rules, three finite retention profiles,
  deletion request/deadline rules and payload-free deleted tombstones.
- Added fixed-vocabulary public decision rendering with no record payload.
- Added one positive fixture, 11 negative mutations and seven lifecycle cases.
- Added no collector, telemetry, network, worker, training, ingestion or
  execution surface.

## Check

Initial focused evidence: 6/6 tests pass; 29/29 classifications are unique;
100/100 reordered objects preserve the digest; 16/16 prohibited-field probes
deny; 11/11 negative cases fail closed; 7/7 lifecycle cases match; five seeded
sensitive values emit zero matching bytes.

Final delivery evidence:

- authoritative suite: 328/328 plus 12/12 secure-default pretests;
- documentation site: 5/5;
- release governance: 27/27 before the new component binding;
- supply chain: 6/6; root SHA-256 closure and npm audit: pass/zero;
- feature PR #109 merged as `5b041534b73dd6230e0279804fea5381e7941dad`;
- release-identity PR #110 merged as release target
  `214b58d87ebfe91178f416ee26b8e89aa0447b76`;
- exact release-target Main CI `30878008319`, including Docker/video smoke:
  pass;
- two exact-source archive builds: byte-identical;
- regular Latest `v0.2.0-poc.20260804.4`: non-draft/non-prerelease, with an
  archive of 1,396,293 bytes at
  `03d4eecf66ae2b2380d2f7fc95d21c7cf9cf4465b71848205e91d510772094a9`
  and a 135-byte checksum manifest at
  `81d855e87d7ee2c19ef79405f58b1ec3b8ca0e82b912cb3c4f4ad4547dff98be`;
- anonymous Latest redirect, metadata, both asset bytes/hashes, raw-Main
  version and the AWI guide route: pass.

Issue closure, canonical raw-Main release binding and the single organic
Shadow sample remain pending until this release-truth integration merges.

## Act

Keep the record minimized and authority-free. Do not add a collector or use
real work records to strengthen this local contract claim. If a later runtime
consumer is proposed, it requires a separate consent, privacy, authority and
production-evidence gate.

Claim boundary:
`DECLARATIVE_AGENT_WORK_EVENT_CONTRACT_ONLY_NO_COLLECTION_NO_TELEMETRY_NO_TRAINING_NO_PRODUCTION_INGESTION`.
