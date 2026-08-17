// Fixed synthetic PCM16 mono 48 kHz passthrough. It performs no synthesis and
// makes no TTS claim; output is digest-bound to the supplied fixture bytes.
import { createHash } from "node:crypto";

export function run(input) {
  if (!input || input.kind !== "pcm16-passthrough"
    || typeof input.bytesBase64 !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.bytesBase64)
    || !/^[a-f0-9]{64}$/.test(input.sha256)
    || !Number.isInteger(input.sampleCount) || input.sampleCount <= 0) {
    throw new Error("AUDIO_COMPONENT_INPUT_DENIED");
  }
  const bytes = Buffer.from(input.bytesBase64, "base64");
  if (bytes.toString("base64") !== input.bytesBase64
    || createHash("sha256").update(bytes).digest("hex") !== input.sha256) {
    throw new Error("AUDIO_COMPONENT_DIGEST_DENIED");
  }
  return Object.freeze({ bytesBase64: input.bytesBase64, sha256: input.sha256, sampleCount: input.sampleCount });
}
