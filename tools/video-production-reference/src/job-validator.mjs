// Runtime validator for the intentionally narrow cm.video/v1 synthetic
// package-assembly job. Direct API objects cross the same strict JSON boundary
// as file inputs and validation proceeds only on a private frozen clone.
import { createHash } from "node:crypto";
import { openAbsoluteDirectory, readRelativeRegularOnce } from "./safe-io.mjs";
import { cloneStrictJson } from "./strict-json.mjs";
import { decodePng, readPngInfo, readWavData, readWavInfo } from "./media-io.mjs";

export const VIDEO_JOB_API_VERSION_V1 = "cm.video/v1";
export const VIDEO_JOB_KIND = "VideoJob";
export const JOB_SCHEMA_VERSION_V1 = "cm.video/v1";

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const DECLARED_TARGET_PIXEL_FORMAT = "yuv420p";
const SAMPLE_RATE = 48_000;
const CHANNELS = 1;
const SAMPLES_PER_FRAME = SAMPLE_RATE / FPS;
const MAX_ASSET_BYTES = 4_000_000;
const SAFE_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SAFE_VERSION = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const SAFE_ASSET_PATH = /^[A-Za-z0-9._-]+$/;
const SHA256 = /^[a-f0-9]{64}$/;
const VERSION_RANGE = /^(?:\^|>=|<=|>|<|=)?[0-9]+\.[0-9]+\.[0-9]+$/;

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && expected.slice().sort().every((key, index) => key === keys[index]);
}

function validSelection(value) {
  return exactKeys(value, ["backend", "expectedVersion"])
    && value.backend === "cpu-ffmpeg-free" && VERSION_RANGE.test(value.expectedVersion);
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function lockedVideoSpec() {
  return Object.freeze({
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
    declaredTargetPixelFormat: DECLARED_TARGET_PIXEL_FORMAT,
    audioSampleRate: SAMPLE_RATE,
    audioChannels: CHANNELS,
  });
}

export async function validateJob({ job, root }) {
  const deny = (...reasonCodes) => ({ outcome: "DENIED", reasonCodes });
  let frozen;
  try { frozen = cloneStrictJson(job); } catch { return deny("JOB_STRICT_JSON_DENIED"); }

  if (!exactKeys(frozen, ["apiVersion", "kind", "metadata", "spec"])) return deny("JOB_SCHEMA_DENIED");
  if (frozen.apiVersion !== VIDEO_JOB_API_VERSION_V1 || frozen.kind !== VIDEO_JOB_KIND) return deny("JOB_SCHEMA_DENIED");
  if (!exactKeys(frozen.metadata, ["immutableOutputVersion", "name"])
    || !SAFE_NAME.test(frozen.metadata.name) || !SAFE_VERSION.test(frozen.metadata.immutableOutputVersion)) {
    return deny("JOB_METADATA_DENIED");
  }
  const spec = frozen.spec;
  if (!exactKeys(spec, ["assets", "audio", "mode", "qa", "render", "roots", "video"])) return deny("JOB_SPEC_DENIED");
  if (spec.mode !== "full-render" && spec.mode !== "validate-only") return deny("JOB_MODE_DENIED");
  if (!exactKeys(spec.render, ["backend", "expectedVersion", "overwrite", "publicActions"])
    || spec.render.backend !== "cpu-ffmpeg-free" || !VERSION_RANGE.test(spec.render.expectedVersion)
    || spec.render.overwrite !== false || spec.render.publicActions !== "forbidden") return deny("JOB_RENDER_DENIED");
  if (!validSelection(spec.audio)) return deny("JOB_AUDIO_SELECTION_DENIED");
  if (!validSelection(spec.qa)) return deny("JOB_QA_SELECTION_DENIED");
  if (!exactKeys(spec.video, ["declaredTargetPixelFormat", "durationFrames", "durationSeconds", "fps", "height", "width"])
    || spec.video.width !== WIDTH || spec.video.height !== HEIGHT || spec.video.fps !== FPS
    || spec.video.declaredTargetPixelFormat !== DECLARED_TARGET_PIXEL_FORMAT
    || !Number.isInteger(spec.video.durationFrames) || spec.video.durationFrames <= 0
    || spec.video.durationSeconds !== spec.video.durationFrames / FPS) return deny("JOB_VIDEO_SPEC_DENIED");
  if (!exactKeys(spec.roots, ["assets"]) || spec.roots.assets !== "assets/synthetic") return deny("JOB_ASSET_ROOT_DENIED");
  if (!exactKeys(spec.assets, ["audio", "shots"]) || !Array.isArray(spec.assets.shots)
    || spec.assets.shots.length === 0 || spec.assets.shots.length > 64) return deny("JOB_ASSETS_DENIED");

  const shots = [];
  const ids = new Set();
  const scenes = new Set();
  const paths = new Set();
  let nextFrame = 0;
  for (const shot of spec.assets.shots) {
    if (!exactKeys(shot, ["endFrame", "id", "path", "sceneId", "sha256", "startFrame", "status"])
      || !SAFE_ID.test(shot.id) || !/^S[0-9]{2}$/.test(shot.sceneId) || shot.status !== "accepted"
      || !SAFE_ASSET_PATH.test(shot.path) || !SHA256.test(shot.sha256)
      || !Number.isInteger(shot.startFrame) || !Number.isInteger(shot.endFrame)
      || shot.startFrame !== nextFrame || shot.endFrame <= shot.startFrame) return deny("JOB_SHOT_DENIED");
    if (ids.has(shot.id) || scenes.has(shot.sceneId) || paths.has(shot.path)) return deny("JOB_DUPLICATE_ID_OR_ASSET_DENIED");
    ids.add(shot.id); scenes.add(shot.sceneId); paths.add(shot.path);
    nextFrame = shot.endFrame;
    shots.push(shot);
  }
  if (shots[0].startFrame !== 0 || nextFrame !== spec.video.durationFrames) return deny("JOB_FRAME_SCHEDULE_DENIED");

  const audio = spec.assets.audio;
  if (!exactKeys(audio, ["channels", "id", "path", "sampleRate", "sha256", "status"])
    || !SAFE_ID.test(audio.id) || audio.status !== "accepted" || !SAFE_ASSET_PATH.test(audio.path)
    || !SHA256.test(audio.sha256) || audio.sampleRate !== SAMPLE_RATE || audio.channels !== CHANNELS
    || ids.has(audio.id) || paths.has(audio.path)) return deny("JOB_AUDIO_DENIED");

  let rootHandle;
  try { rootHandle = await openAbsoluteDirectory(root); } catch { return deny("JOB_ROOT_INPUT_DENIED"); }
  try {
    const resolvedShots = [];
    for (const shot of shots) {
      let input;
      try { input = await readRelativeRegularOnce(rootHandle, `assets/synthetic/${shot.path}`, MAX_ASSET_BYTES); }
      catch { return deny("JOB_ASSET_INPUT_DENIED"); }
      const observed = hash(input.bytes);
      if (observed !== shot.sha256) return deny("JOB_HASH_MISMATCH_DENIED");
      let info;
      try {
        info = readPngInfo(input.bytes);
        const decoded = decodePng(input.bytes);
        if (decoded.width !== WIDTH || decoded.height !== HEIGHT) throw new Error("dimensions");
      } catch { return deny("JOB_SHOT_MEDIA_DENIED"); }
      if (info.width !== WIDTH || info.height !== HEIGHT || info.bitDepth !== 8 || info.colorType !== 2) return deny("JOB_SHOT_MEDIA_DENIED");
      resolvedShots.push(Object.freeze({
        ...shot,
        bytesBase64: input.bytes.toString("base64"),
        measuredPng: Object.freeze({ width: info.width, height: info.height, bitDepth: info.bitDepth, colorType: info.colorType }),
      }));
    }

    let audioInput;
    try { audioInput = await readRelativeRegularOnce(rootHandle, `assets/synthetic/${audio.path}`, MAX_ASSET_BYTES); }
    catch { return deny("JOB_AUDIO_INPUT_DENIED"); }
    if (hash(audioInput.bytes) !== audio.sha256) return deny("JOB_HASH_MISMATCH_DENIED");
    let wav;
    try {
      wav = readWavInfo(audioInput.bytes);
      const decoded = readWavData(audioInput.bytes);
      if (decoded.sampleCount !== spec.video.durationFrames * SAMPLES_PER_FRAME) throw new Error("sample count");
    } catch { return deny("JOB_AUDIO_MEDIA_DENIED"); }
    if (wav.sampleRate !== SAMPLE_RATE || wav.channels !== CHANNELS || wav.bitsPerSample !== 16
      || wav.sampleCount !== spec.video.durationFrames * SAMPLES_PER_FRAME) return deny("JOB_AUDIO_MEDIA_DENIED");

    const jobDigest = hash(Buffer.from(canonicalJson(frozen), "utf8"));
    return Object.freeze({
      outcome: "PASS",
      job: frozen,
      jobDigest,
      durationFrames: spec.video.durationFrames,
      durationSeconds: spec.video.durationSeconds,
      expectedAudioSamples: spec.video.durationFrames * SAMPLES_PER_FRAME,
      assets: Object.freeze(resolvedShots),
      audio: Object.freeze({
        ...audio,
        bytesBase64: audioInput.bytes.toString("base64"),
        measuredWav: Object.freeze({
          sampleRate: wav.sampleRate, channels: wav.channels, bitsPerSample: wav.bitsPerSample,
          sampleCount: wav.sampleCount, dataBytes: wav.dataBytes,
        }),
      }),
    });
  } finally {
    await rootHandle.close().catch(() => {});
  }
}
