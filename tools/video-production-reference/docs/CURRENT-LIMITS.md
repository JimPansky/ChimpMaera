# Current Limits

- The default image is CPU-first and uses `libx264`; it does not reproduce the
  accepted NVENC bytes from the owner host.
- The default image does not include Qwen3-TTS, Whisper, Torch, CUDA, model
  weights, or accepted owner media. The package includes optional, replaceable
  voice and logo reference files; jobs may omit them.
- The reference renderer supports static ordered PNG shots, locked mono 48 kHz
  WAV audio, direct dissolves, final silent hold, ffprobe, full decode, and
  checksums.
- It validates the production law that narration explains principles while
  visuals carry IDs, hashes, amounts, versions, and details. It does not perform
  human localization review itself; the job must carry the reviewed gate.
- Reference media is never a required identity choice. Jobs may use, replace,
  modify, or omit the bundled examples.
- When a job declares `spec.referenceAssets`, the validator requires an
  accepted status, an in-root path, and the exact declared SHA-256. It does not
  infer rights or suitability from a passing hash.
- GPU/TTS is a contract scaffold only. It requires an offline `/models` mount
  containing `Qwen/Qwen3-TTS-12Hz-1.7B-Base` at commit
  `fd4b254389122332181a7c3db7f27e918eec64e3`, compatible CUDA/Torch/qwen-tts,
  Whisper `20250625`, a separately reviewed voice input, and explicit
  no-fallback settings.
- No public upload, push, publish, message, or external contact is available
  from the container contract.
