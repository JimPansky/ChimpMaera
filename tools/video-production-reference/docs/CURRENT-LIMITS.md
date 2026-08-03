# Current Limits

- The default image is CPU-first and uses `libx264`; it does not reproduce the
  accepted NVENC bytes from the owner host.
- The default image does not include Qwen3-TTS, Whisper, Torch, CUDA, model
  weights, or accepted owner media. The package includes optional, replaceable
  voice and logo reference files; jobs may omit them.
- The reference renderer supports static ordered PNG shots, locked mono 48 kHz
  WAV audio, direct dissolves, ffprobe, full decode, loudness/true-peak,
  black-frame detection, and checksums.
- It validates the production law that narration explains principles while
  visuals carry IDs, hashes, amounts, versions, and details. It does not perform
  human language or semantic review itself; the job must carry named,
  revision-hash-bound review gates.
- The ten-second outro contract governs a designed final view. It deliberately
  does not carry forward silent-outro acceptance; terminal audio must follow a
  declared non-silent policy.
- Subtitle syntax and safe-area geometry are executed locally. ASR and OCR are
  evidence-receipt contracts because their models are not included. Fixture
  receipts cannot satisfy a `publication-candidate` manifest. The validator
  checks the receipts' hash-bound `audienceText`; it does not independently
  transcribe or OCR the media.
- Reference media is never a required identity choice. Jobs may use, replace,
  modify, or omit the bundled examples.
- When a job declares `spec.referenceAssets`, the validator requires an
  accepted status, an in-root path, and the exact declared SHA-256. It does not
  infer rights or suitability from a passing hash.
- GPU/TTS is not shipped by this reference image. A future model profile must
  pin its model and runtime revisions, use offline mounts where promised, and
  prohibit silent fallback before it can be documented as supported.
- No public upload, push, publish, message, or external contact is available
  from the container contract.
