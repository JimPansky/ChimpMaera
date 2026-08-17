# Versioned extension guide

This is a closed reference, not an ambient plugin loader. The current
build-time registry statically imports exactly one renderer, one PCM
passthrough audio component, and one QA component on backend
`cpu-ffmpeg-free`, all at version `1.0.0`. Descriptor and implementation files
remain hash-closed distribution evidence; none supplies runtime executable
bytes. Unknown IDs, roles, backends, capabilities, versions, defaults,
descriptor keys, duplicate IDs, duplicate role/backend/version tuples, and
multiple defaults are denied.

An intentional extension therefore requires a reviewed contract-version
change, not merely dropping a file into `components/`:

1. define the exact identity, role, backend, interface, version, implementation
   path/hash, default, and capabilities tuple in
   `schemas/component-descriptor.schema.v1.json` and `src/select-component.mjs`;
2. statically import the reviewed function in the registry and bind its exact
   distribution bytes with `implementationSha256`; never add runtime module
   loading from descriptor paths or caller-supplied bytes;
3. add job fields to `schemas/video-job.schema.v1.json` and the independent
   runtime validator together, with strict boundary and parity attacks;
4. bind descriptor and implementation digests, semantic configuration, source
   inputs, schedule, copied outputs, and the exact artifact set into render and
   QA evidence;
5. add independent tamper, swap, symlink, race, ambiguity, complete-set, and
   denial-no-mutation tests;
6. refresh this directory's `SHA256SUMS`, the public manifest, Verification
   DAG hashes, and root `SHA256SUMS` only after all bytes settle.

The current audio interface is intentionally only digest-bound PCM16 mono
48 kHz passthrough. It consumes the checked-in WAV bytes selected by
`spec.audio`; it does not synthesize speech and must not be described as TTS.

Do not extend this contract to imply playable/encoded video, a codec,
production rendering, Docker/container hardening, GPU, TTS, models, providers,
network access, upload/publication, workers/deployment, production media,
external-artifact equivalence, or NVENC byte identity. Those are different
products and gates. If an optional implementation cannot satisfy the same
input, ownership, evidence, QA, and closure rules, omit it.
