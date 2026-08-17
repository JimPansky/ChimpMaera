// Exact internal release closure. SHA256SUMS excludes only itself; every other
// entry must be a regular no-follow file and the sets must match both ways.
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { openAbsoluteDirectory, openRelativeDirectory, readRelativeRegularOnce } from "./safe-io.mjs";
import { parseStrictJson } from "./strict-json.mjs";
import { decodePng, readWavData } from "./media-io.mjs";

export const CLOSURE_MANIFEST = "SHA256SUMS";
export const DOCS_FILES = Object.freeze(["README.md", "EXTENSION-GUIDE.md", "NOTICE"]);
export const DOCUMENTED_PATH_REFERENCES = Object.freeze([
  "EXTENSION-GUIDE.md",
  "NOTICE",
  "SHA256SUMS",
  "assets/synthetic",
  "bin/cm-video.mjs",
  "components",
  "components/audio.pcm-v1.json",
  "components/qa.cpu-v1.json",
  "components/renderer.cpu-v1.json",
  "jobs/job-alpha.synthetic-v1.json",
  "schemas/component-descriptor.schema.v1.json",
  "schemas/ownership-marker.schema.v1.json",
  "schemas/package-index.schema.v1.json",
  "schemas/qa-receipt.schema.v1.json",
  "schemas/render-manifest.schema.v1.json",
  "schemas/success-marker.schema.v1.json",
  "schemas/timeline.schema.v1.json",
  "schemas/video-job.schema.v1.json",
  "scripts/generate-synthetic-assets.mjs",
  "scripts/verify-closure.mjs",
  "src/select-component.mjs",
]);
const SAFE_PATH = /^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/;

function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

export function parseManifest(text) {
  const entries = new Map();
  for (const line of text.split("\n")) {
    if (line === "") continue;
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    if (!match || !SAFE_PATH.test(match[2]) || match[2].split("/").some((part) => part === "." || part === "..")) {
      throw new Error("CLOSURE_MANIFEST_PATH_DENIED");
    }
    if (match[2] === CLOSURE_MANIFEST || entries.has(match[2])) throw new Error("CLOSURE_MANIFEST_DUPLICATE_OR_SELF_DENIED");
    entries.set(match[2], match[1]);
  }
  return entries;
}

async function enumerate(rootHandle) {
  const files = [];
  async function walk(handle, prefix) {
    const entries = (await readdir(`/proc/self/fd/${handle.fd}`, { withFileTypes: true }))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (!/^[A-Za-z0-9._-]+$/.test(entry.name) || entry.name === "." || entry.name === "..") throw new Error("CLOSURE_PATH_DENIED");
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) throw new Error(`CLOSURE_SPECIAL_FILE_DENIED:${path}`);
      if (entry.isDirectory()) {
        const child = await openRelativeDirectory(handle, entry.name);
        try { await walk(child, path); } finally { await child.close(); }
      } else files.push(path);
    }
  }
  await walk(rootHandle, "");
  return files.sort();
}

export function collectMarkdownFileRefs(text) {
  const refs = new Set();
  const consider = (candidate) => {
    let value = candidate.trim().replace(/^[`'"(<]+|[`'">),;:]+$/g, "").replace(/^\.\//, "");
    if (value.endsWith(".") && !/\.[A-Za-z0-9]+\.$/.test(value)) value = value.slice(0, -1);
    const prefix = "tools/video-production-reference/";
    if (value.startsWith(prefix)) value = value.slice(prefix.length);
    if (value.endsWith("/")) value = value.slice(0, -1);
    if (["EXTENSION-GUIDE.md", "NOTICE", "README.md", "SHA256SUMS"].includes(value)) {
      refs.add(value);
      return;
    }
    if (/^(?:assets|bin|components|jobs|schemas|scripts|src|tests)(?:\/.*)?$/.test(value)) {
      if (!SAFE_PATH.test(value) || value.split("/").some((part) => part === "." || part === "..")) {
        throw new Error(`CLOSURE_DOCUMENT_REFERENCE_PATH_DENIED:${value}`);
      }
      refs.add(value);
    }
  };
  for (const match of text.matchAll(/(?:^|[\s`'"(=])((?:tools\/video-production-reference\/)?(?:assets|bin|components|jobs|schemas|scripts|src|tests)\/[^\s`'"<>]*)/gm)) consider(match[1]);
  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    for (const token of match[1].split(/\s+/)) consider(token);
  }
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) consider(match[1]);
  return [...refs].sort();
}

const DESCRIPTOR_CONTRACTS = Object.freeze({
  "audio.pcm.v1": { file: "components/audio.pcm-v1.json", role: "audio", implementation: "src/audio-pcm.mjs", implementationSha256: "b2672da02ede1fac79c23d107c7bc4295b62ef11fccfae2a0f3e2c71b22af8d9", capabilities: ["synthetic.pcm16-mono-48000-passthrough"] },
  "qa.cpu.v1": { file: "components/qa.cpu-v1.json", role: "qa", implementation: "src/qa-cpu.mjs", implementationSha256: "3e1d8e5c0cf76faa184f3afc2199bb89857d89dce886eb2f63989bdec93f98fd", capabilities: ["synthetic.complete-artifact-readback", "synthetic.png-wav-bounded-parse"] },
  "renderer.cpu.v1": { file: "components/renderer.cpu-v1.json", role: "renderer", implementation: "src/render-cpu.mjs", implementationSha256: "80d157f4fed19d9cbb99a47a18e27b4a7aebd32952665b6080f01d9940b51941", capabilities: ["synthetic.canonical-package-index", "synthetic.png-frame-assembly"] },
});

function exactDescriptor(descriptor, path) {
  const keys = ["backend", "capabilities", "defaultFor", "id", "implementation", "implementationSha256", "prohibitedFallback", "role", "schemaVersion", "version"].sort();
  const contract = DESCRIPTOR_CONTRACTS[descriptor.id];
  return contract && contract.file === path && Object.keys(descriptor).sort().join("\0") === keys.join("\0")
    && descriptor.schemaVersion === "chimpmaera.video/component-descriptor/v1"
    && descriptor.role === contract.role
    && descriptor.backend === "cpu-ffmpeg-free" && descriptor.version === "1.0.0"
    && descriptor.defaultFor === "linux-cpu-reference" && descriptor.prohibitedFallback === true
    && descriptor.implementation === contract.implementation
    && descriptor.implementationSha256 === contract.implementationSha256
    && Array.isArray(descriptor.capabilities) && descriptor.capabilities.length === contract.capabilities.length
    && descriptor.capabilities.every((capability, index) => capability === contract.capabilities[index]);
}

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join("\0") === keys.slice().sort().join("\0");
}

function validJobStructure(job) {
  if (!exactKeys(job, ["apiVersion", "kind", "metadata", "spec"])
    || job.apiVersion !== "cm.video/v1" || job.kind !== "VideoJob"
    || !exactKeys(job.metadata, ["immutableOutputVersion", "name"])
    || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(job.metadata.name)
    || !/^[a-z0-9][a-z0-9.-]{0,63}$/.test(job.metadata.immutableOutputVersion)) return false;
  const spec = job.spec;
  const selection = (value) => exactKeys(value, ["backend", "expectedVersion"])
    && value.backend === "cpu-ffmpeg-free" && /^(?:\^|>=|<=|>|<|=)?[0-9]+\.[0-9]+\.[0-9]+$/.test(value.expectedVersion);
  if (!exactKeys(spec, ["assets", "audio", "mode", "qa", "render", "roots", "video"])
    || !["full-render", "validate-only"].includes(spec.mode) || !selection(spec.audio) || !selection(spec.qa)
    || !exactKeys(spec.render, ["backend", "expectedVersion", "overwrite", "publicActions"])
    || spec.render.backend !== "cpu-ffmpeg-free" || spec.render.overwrite !== false || spec.render.publicActions !== "forbidden"
    || !/^(?:\^|>=|<=|>|<|=)?[0-9]+\.[0-9]+\.[0-9]+$/.test(spec.render.expectedVersion)
    || !exactKeys(spec.roots, ["assets"]) || spec.roots.assets !== "assets/synthetic"
    || !exactKeys(spec.video, ["declaredTargetPixelFormat", "durationFrames", "durationSeconds", "fps", "height", "width"])
    || spec.video.width !== 1280 || spec.video.height !== 720 || spec.video.fps !== 30
    || spec.video.declaredTargetPixelFormat !== "yuv420p" || !Number.isInteger(spec.video.durationFrames)
    || spec.video.durationFrames <= 0 || spec.video.durationSeconds !== spec.video.durationFrames / 30
    || !exactKeys(spec.assets, ["audio", "shots"]) || !Array.isArray(spec.assets.shots) || spec.assets.shots.length === 0) return false;
  const ids = new Set(); const scenes = new Set(); const paths = new Set(); let next = 0;
  for (const shot of spec.assets.shots) {
    if (!exactKeys(shot, ["endFrame", "id", "path", "sceneId", "sha256", "startFrame", "status"])
      || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(shot.id) || !/^S[0-9]{2}$/.test(shot.sceneId)
      || !/^[A-Za-z0-9._-]+$/.test(shot.path) || !/^[a-f0-9]{64}$/.test(shot.sha256)
      || shot.status !== "accepted" || shot.startFrame !== next || !Number.isInteger(shot.endFrame) || shot.endFrame <= next
      || ids.has(shot.id) || scenes.has(shot.sceneId) || paths.has(shot.path)) return false;
    ids.add(shot.id); scenes.add(shot.sceneId); paths.add(shot.path); next = shot.endFrame;
  }
  const audio = spec.assets.audio;
  return next === spec.video.durationFrames
    && exactKeys(audio, ["channels", "id", "path", "sampleRate", "sha256", "status"])
    && /^[a-z0-9][a-z0-9._-]{0,63}$/.test(audio.id) && /^[A-Za-z0-9._-]+$/.test(audio.path)
    && /^[a-f0-9]{64}$/.test(audio.sha256) && audio.status === "accepted"
    && audio.sampleRate === 48000 && audio.channels === 1 && !ids.has(audio.id) && !paths.has(audio.path);
}

export async function enumerateShippedFiles(root) {
  const handle = await openAbsoluteDirectory(root);
  try { return (await enumerate(handle)).filter((path) => path !== CLOSURE_MANIFEST); }
  finally { await handle.close(); }
}

export async function verifyClosure({ root }) {
  const deny = (code, details = {}) => ({ outcome: "DENIED", reasonCodes: [code], ...details });
  let rootHandle;
  try { rootHandle = await openAbsoluteDirectory(root); } catch { return deny("CLOSURE_ROOT_DENIED"); }
  try {
    let allFiles;
    try { allFiles = await enumerate(rootHandle); } catch (error) { return deny(error.message.split(":")[0]); }
    if (!allFiles.includes(CLOSURE_MANIFEST)) return deny("CLOSURE_MANIFEST_MISSING_DENIED");
    let manifestInput;
    try { manifestInput = await readRelativeRegularOnce(rootHandle, CLOSURE_MANIFEST, 262_144); }
    catch { return deny("CLOSURE_MANIFEST_INPUT_DENIED"); }
    let manifest;
    try { manifest = parseManifest(manifestInput.bytes.toString("utf8")); }
    catch (error) { return deny(error.message); }
    const shipped = allFiles.filter((path) => path !== CLOSURE_MANIFEST);
    if (manifest.size !== shipped.length || shipped.some((path) => !manifest.has(path))
      || [...manifest.keys()].some((path) => !shipped.includes(path))) return deny("CLOSURE_FILE_SET_DENIED");

    const bytes = new Map();
    for (const path of shipped) {
      let input;
      try { input = await readRelativeRegularOnce(rootHandle, path, 4_000_000); }
      catch { return deny("CLOSURE_FILE_INPUT_DENIED", { path }); }
      if (hash(input.bytes) !== manifest.get(path)) return deny("CLOSURE_CHECKSUM_DENIED", { path });
      bytes.set(path, input.bytes);
    }

    const descriptorPaths = shipped.filter((path) => /^components\/.*\.json$/.test(path));
    const ids = new Set();
    const tuples = new Set();
    const roles = new Set();
    for (const path of descriptorPaths) {
      let descriptor;
      try { descriptor = parseStrictJson(bytes.get(path), { maxBytes: 32_768, maxNodes: 256 }); }
      catch { return deny("CLOSURE_DESCRIPTOR_STRICT_JSON_DENIED", { path }); }
      if (!exactDescriptor(descriptor, path) || !bytes.has(descriptor.implementation)
        || hash(bytes.get(descriptor.implementation)) !== descriptor.implementationSha256) return deny("CLOSURE_DESCRIPTOR_BINDING_DENIED", { path });
      const tuple = `${descriptor.role}\0${descriptor.backend}\0${descriptor.version}`;
      if (ids.has(descriptor.id) || tuples.has(tuple) || roles.has(descriptor.role)) return deny("CLOSURE_DESCRIPTOR_AMBIGUITY_DENIED");
      ids.add(descriptor.id); tuples.add(tuple); roles.add(descriptor.role);
    }
    if (["renderer", "audio", "qa"].some((role) => !roles.has(role))) return deny("CLOSURE_DESCRIPTOR_ROLE_SET_DENIED");

    let assetReferences = 0;
    for (const path of shipped.filter((value) => /^jobs\/.*\.json$/.test(value))) {
      let job;
      try { job = parseStrictJson(bytes.get(path)); } catch { return deny("CLOSURE_JOB_STRICT_JSON_DENIED", { path }); }
      if (!validJobStructure(job)) return deny("CLOSURE_JOB_SCHEMA_DENIED", { path });
      let next = 0;
      for (const shot of job.spec.assets.shots) {
        const assetPath = `assets/synthetic/${shot.path}`;
        if (shot.startFrame !== next || !Number.isInteger(shot.endFrame) || shot.endFrame <= next
          || !bytes.has(assetPath) || hash(bytes.get(assetPath)) !== shot.sha256) return deny("CLOSURE_JOB_ASSET_DENIED", { path, assetPath });
        try { decodePng(bytes.get(assetPath)); } catch { return deny("CLOSURE_JOB_MEDIA_DENIED", { assetPath }); }
        next = shot.endFrame;
        assetReferences += 1;
      }
      const audioPath = `assets/synthetic/${job.spec.assets.audio.path}`;
      if (next !== job.spec.video.durationFrames || !bytes.has(audioPath)
        || hash(bytes.get(audioPath)) !== job.spec.assets.audio.sha256) return deny("CLOSURE_JOB_ASSET_DENIED", { path, audioPath });
      try {
        if (readWavData(bytes.get(audioPath)).sampleCount !== job.spec.video.durationFrames * 1600) throw new Error("samples");
      } catch { return deny("CLOSURE_JOB_MEDIA_DENIED", { audioPath }); }
      assetReferences += 1;
    }

    const docRefs = new Set();
    for (const doc of DOCS_FILES) {
      if (!bytes.has(doc)) return deny("CLOSURE_DOCUMENT_MISSING_DENIED", { doc });
      try {
        for (const ref of collectMarkdownFileRefs(bytes.get(doc).toString("utf8"))) docRefs.add(ref);
      } catch (error) { return deny(error.message.split(":")[0]); }
    }
    const observedRefs = [...docRefs].sort();
    const requiredRefs = [...DOCUMENTED_PATH_REFERENCES].sort();
    if (observedRefs.length !== requiredRefs.length
      || observedRefs.some((ref, index) => ref !== requiredRefs[index])) {
      return deny("CLOSURE_DOCUMENT_REFERENCE_SET_DENIED", {
        missingDocumentedRefs: requiredRefs.filter((ref) => !docRefs.has(ref)),
        unexpectedDocumentedRefs: observedRefs.filter((ref) => !DOCUMENTED_PATH_REFERENCES.includes(ref)),
      });
    }
    const missingRefs = observedRefs.filter((ref) => ref !== CLOSURE_MANIFEST
      && !bytes.has(ref) && !shipped.some((path) => path.startsWith(`${ref}/`)));
    if (missingRefs.length) return deny("CLOSURE_DOCUMENT_REFERENCE_DENIED", { missingRefs });
    return {
      outcome: "PASS",
      checks: ["exact-regular-file-set", "sha256", "strict-jobs", "descriptor-implementation-binding", "documentation-references"],
      manifest: { files: manifest.size },
      refs: { components: descriptorPaths.length, docs: docRefs.size, jobAssets: assetReferences },
    };
  } finally { await rootHandle.close(); }
}

export function closureJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }
