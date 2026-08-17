# Synthetic CPU video package reference

This directory is a dependency-free, local Linux reference for a deliberately
narrow `cm.video/v1` contract: validate fixed synthetic PNG/WAV inputs, select
three hash-closed descriptors from a static CPU function registry, assemble an
immutable package, and
independently read it back. `render.cmvideo` is canonical JSON with media type
`application/vnd.chimpmaera.synthetic-package-index+json`. It is a synthetic
package index, not a container and not generally playable video.

This does not complete Issue #18.

## Exact boundary

The job's 1280×720, 30 fps, and `yuv420p` fields are declared target metadata.
No pixels are encoded or converted to that target pixel format. Measured
properties are kept separately: the bounded parser observes 8-bit RGB PNG
dimensions and the bounded WAV parser observes PCM16, mono, 48 kHz samples.
Frame ticks are contiguous integers beginning at zero and ending at the exact
declared duration; audio has exactly 1,600 samples per frame. Shot and audio
evidence IDs share one globally unique namespace; source paths and scene IDs
are likewise unambiguous in their documented namespaces.

The selected roles are:

- `components/renderer.cpu-v1.json`: canonical synthetic package planning;
- `components/audio.pcm-v1.json`: fixed PCM passthrough of digest-bound fixture
  bytes;
- `components/qa.cpu-v1.json`: authorization of a complete artifact readback.

The audio role performs no synthesis. It is not TTS.

No playable or encoded video, codec, production renderer, production media,
Docker or container hardening, GPU, TTS, model, provider, network, upload,
publication, watcher, worker, deployment, external-artifact equivalence,
NVENC byte identity, or whole-epic result is claimed. PNG/WAV parsing and a
logical frame schedule are not encoded-video decode.

## Supported platform

The executable scope is a local Linux filesystem exposing `/proc/self/fd` and
`O_NOFOLLOW`, using the repository-supported Node runtime. It fails closed on
other platforms. Inputs and outputs must be ordinary local files/directories;
symlinks and special files are denied. No portability claim is made beyond
that tested boundary, and this directory does not provide a sandbox or an
"only writable output" guarantee.

Each bounded job, descriptor, implementation-evidence file, source asset, QA
artifact, and closure input is opened with no-follow semantics. The bytes
validated are the bytes used as evidence. Runtime descriptors never provide
executable bytes: `src/select-component.mjs` maps the three exact descriptor
tuples and implementation hashes to statically imported reviewed functions.
Replacement or extension is a reviewed build-time source/registry change.

## Commands

Create a disposable, pre-existing output root outside this source directory:

```text
mkdir /tmp/cmvideo-output
node tools/video-production-reference/bin/cm-video.mjs validate \
  --root tools/video-production-reference \
  --job tools/video-production-reference/jobs/job-alpha.synthetic-v1.json
node tools/video-production-reference/bin/cm-video.mjs validate-and-render \
  --root tools/video-production-reference \
  --job tools/video-production-reference/jobs/job-alpha.synthetic-v1.json \
  --output /tmp/cmvideo-output
```

`validate`, `render`, `qa`, and `validate-and-render` are the only commands.
Render/QA require `--output` to name a pre-existing local directory. Output is
`<output>/<job-name>/<immutable-version>`. The resolved absolute output-root
chain is retained from `/` through every directory entry. The final namespace
is acquired by one exclusive non-recursive directory creation; concurrent
identical renders therefore yield one success and one denial.

Artifacts use fixed names:

```text
ownership.json
frames/SNN.png
audio.pcm.wav
timeline.json
render.cmvideo
manifest.json
success.json
qa-receipt.json
```

Every artifact write is exclusive, retained-handle rehashed, and entry-bound.
`success.json` is published last and binds the exact render artifact set.
QA rejects missing, extra, symlinked, special, non-canonical, or changed files,
fully parses every PNG/WAV, snapshots every artifact inode before reading, and
re-enumerates/rebinds the complete set immediately before PASS.
The receipt binds the current artifact-set digest; an older PASS cannot
validate changed bytes. Failure cleanup enumerates only files owned by the
exclusive namespace after inode and `ownership.json` nonce verification and
never recursively deletes a caller-derived or replacement path. A same-user
rename or replacement of any absolute output-root ancestor, the output-root
entry, job parent, or final version observed before the final check is denied
and preserved. Immediately before render success and QA PASS, a fresh walk
rebinds every retained absolute-chain directory, the job parent, the final
version, and the exact ownership-marker nonce by type, device, and inode.

As with ordinary Linux pathnames, another same-user process in the same mount
namespace can mutate the namespace after that final walk; PASS is a
point-in-time local readback, not a lease, sandbox, or post-return immutability
guarantee. Node does not expose a transactional pathname lease around each
immediate `lstat`/marker rebind and its following pathname syscall, so mutation
inside that minimal interval is also outside the prevention claim. The real
same-user race probes cover replacements of the output root, job parent, final
version, and individual artifacts visible at the immediate rebind, plus extras
visible at the final re-enumeration.

## Contracts and deterministic fixtures

The closed source contracts are:

- `schemas/video-job.schema.v1.json`
- `schemas/component-descriptor.schema.v1.json`
- `schemas/ownership-marker.schema.v1.json`
- `schemas/render-manifest.schema.v1.json`
- `schemas/package-index.schema.v1.json`
- `schemas/success-marker.schema.v1.json`
- `schemas/qa-receipt.schema.v1.json`
- `schemas/timeline.schema.v1.json`

`scripts/generate-synthetic-assets.mjs` defaults to no-write verification of
the six checked-in fixture hashes. `--regenerate` is development-only: it uses
integer square waves and a specified stored-DEFLATE/zlib encoder, and reports
the old/new digest of every fixture. Regeneration writes an exclusive
same-directory temporary file through a retained no-follow handle, verifies
its bytes, atomically replaces the directory entry, then reopens no-follow and
rehashes. It never truncates through the target pathname. Any changed fixture
requires explicit job digest updates, review, tests, and integrity refresh.

Run the focused checks with `npm run video:test`. Run internal closure with
`node tools/video-production-reference/scripts/verify-closure.mjs`.
`SHA256SUMS` lists every regular file below this directory except itself; that
self-exclusion is the only internal-manifest exclusion.

See `EXTENSION-GUIDE.md` for the versioned change procedure and `NOTICE` for
redistribution and nonclaim notices.
