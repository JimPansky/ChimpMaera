// Closed build-time component registry. Descriptor JSON and implementation
// source remain hash-closed evidence, but runtime descriptors can only select
// these statically imported reviewed functions. Caller-supplied module bytes
// are never evaluated or imported.
import { createHash } from "node:crypto";
import { openAbsoluteDirectory, listDirectory, readRelativeRegularOnce } from "./safe-io.mjs";
import { parseStrictJson, deepFreeze } from "./strict-json.mjs";
import { run as runAudioPcm } from "./audio-pcm.mjs";
import { run as runQaCpu } from "./qa-cpu.mjs";
import { run as runRendererCpu } from "./render-cpu.mjs";

export const COMPONENT_DESCRIPTOR_SCHEMA_V1 = "chimpmaera.video/component-descriptor/v1";
export const SELECTION_CONTRACT_SCHEMA_V1 = "chimpmaera.video/selection/v1";
export const DECLARED_BACKENDS_V1 = Object.freeze(["cpu-ffmpeg-free"]);

const SHA256 = /^[a-f0-9]{64}$/;
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const EXACT_KEYS = ["backend", "capabilities", "defaultFor", "id", "implementation", "implementationSha256", "prohibitedFallback", "role", "schemaVersion", "version"];
const CONTRACTS = Object.freeze({
  "renderer.cpu.v1": Object.freeze({
    role: "renderer", backend: "cpu-ffmpeg-free", version: "1.0.0", implementation: "src/render-cpu.mjs",
    implementationSha256: "80d157f4fed19d9cbb99a47a18e27b4a7aebd32952665b6080f01d9940b51941",
    capabilities: Object.freeze(["synthetic.canonical-package-index", "synthetic.png-frame-assembly"]),
    run: runRendererCpu,
  }),
  "audio.pcm.v1": Object.freeze({
    role: "audio", backend: "cpu-ffmpeg-free", version: "1.0.0", implementation: "src/audio-pcm.mjs",
    implementationSha256: "b2672da02ede1fac79c23d107c7bc4295b62ef11fccfae2a0f3e2c71b22af8d9",
    capabilities: Object.freeze(["synthetic.pcm16-mono-48000-passthrough"]),
    run: runAudioPcm,
  }),
  "qa.cpu.v1": Object.freeze({
    role: "qa", backend: "cpu-ffmpeg-free", version: "1.0.0", implementation: "src/qa-cpu.mjs",
    implementationSha256: "3e1d8e5c0cf76faa184f3afc2199bb89857d89dce886eb2f63989bdec93f98fd",
    capabilities: Object.freeze(["synthetic.complete-artifact-readback", "synthetic.png-wav-bounded-parse"]),
    run: runQaCpu,
  }),
});
const TRUSTED_RUNS = new WeakMap();

function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

function exactKeys(value) {
  const keys = Object.keys(value).sort();
  return keys.length === EXACT_KEYS.length && EXACT_KEYS.slice().sort().every((key, index) => key === keys[index]);
}

function sameArray(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function validateDescriptor(descriptor, file) {
  const contract = CONTRACTS[descriptor.id];
  if (!exactKeys(descriptor) || !contract
    || descriptor.schemaVersion !== COMPONENT_DESCRIPTOR_SCHEMA_V1
    || descriptor.role !== contract.role || descriptor.backend !== contract.backend
    || descriptor.version !== contract.version || !SEMVER.test(descriptor.version)
    || descriptor.implementation !== contract.implementation || !SHA256.test(descriptor.implementationSha256)
    || descriptor.implementationSha256 !== contract.implementationSha256
    || descriptor.defaultFor !== "linux-cpu-reference" || descriptor.prohibitedFallback !== true
    || !sameArray(descriptor.capabilities, contract.capabilities)
    || new Set(descriptor.capabilities).size !== descriptor.capabilities.length) {
    throw new Error(`SELECTION_DESCRIPTOR_SCHEMA_DENIED: ${file}`);
  }
}

export async function loadDescriptors(root) {
  const rootHandle = await openAbsoluteDirectory(root);
  try {
    const entries = (await listDirectory(rootHandle, "components"))
      .map((entry) => entry.name).sort();
    if (entries.length !== Object.keys(CONTRACTS).length
      || entries.some((name) => !/^[a-z0-9.-]+\.json$/.test(name))) {
      throw new Error("SELECTION_DESCRIPTOR_SET_DENIED");
    }
    const records = [];
    const ids = new Set();
    const tuples = new Set();
    const defaults = new Set();
    for (const file of entries) {
      const descriptorInput = await readRelativeRegularOnce(rootHandle, `components/${file}`, 32_768);
      const descriptor = parseStrictJson(descriptorInput.bytes, { maxBytes: 32_768, maxNodes: 256 });
      validateDescriptor(descriptor, file);
      const contract = CONTRACTS[descriptor.id];
      const tuple = `${descriptor.role}\0${descriptor.backend}\0${descriptor.version}`;
      const defaultKey = `${descriptor.role}\0${descriptor.backend}\0${descriptor.defaultFor}`;
      if (ids.has(descriptor.id) || tuples.has(tuple) || defaults.has(defaultKey)) throw new Error("SELECTION_DESCRIPTOR_AMBIGUITY_DENIED");
      ids.add(descriptor.id); tuples.add(tuple); defaults.add(defaultKey);
      const implementationInput = await readRelativeRegularOnce(rootHandle, descriptor.implementation, 131_072);
      const observedImplementation = hash(implementationInput.bytes);
      if (observedImplementation !== descriptor.implementationSha256
        || observedImplementation !== contract.implementationSha256) {
        throw new Error(`SELECTION_IMPLEMENTATION_HASH_DENIED: ${descriptor.id}`);
      }
      const record = deepFreeze({
        descriptor,
        descriptorFile: `components/${file}`,
        descriptorSha256: hash(descriptorInput.bytes),
        implementationSha256: observedImplementation,
      });
      TRUSTED_RUNS.set(record, contract.run);
      records.push(record);
    }
    return Object.freeze(records.sort((a, b) => a.descriptor.id.localeCompare(b.descriptor.id)));
  } finally {
    await rootHandle.close().catch(() => {});
  }
}

function versionParts(value) {
  const match = value.match(/^(\^|>=|<=|>|<|=)?(\d+)\.(\d+)\.(\d+)$/);
  return match ? { op: match[1] ?? "=", parts: match.slice(2).map(Number) } : null;
}

export function versionSatisfies(required, provided) {
  const wanted = typeof required === "string" ? versionParts(required) : null;
  const actual = typeof provided === "string" && SEMVER.test(provided) ? versionParts(provided) : null;
  if (!wanted || !actual) return false;
  const order = actual.parts.findIndex((value, index) => value !== wanted.parts[index]);
  const compare = order < 0 ? 0 : actual.parts[order] < wanted.parts[order] ? -1 : 1;
  if (wanted.op === "^") return actual.parts[0] === wanted.parts[0] && compare >= 0;
  return ({ "=": compare === 0, ">=": compare >= 0, "<=": compare <= 0, ">": compare > 0, "<": compare < 0 })[wanted.op] ?? false;
}

export function selectComponent({ descriptors, role, backend, version }) {
  const deny = (...reasonCodes) => ({ outcome: "DENIED", reasonCodes });
  if (!Object.values(CONTRACTS).some((contract) => contract.role === role)) return deny("SELECTION_ROLE_DENIED");
  if (!DECLARED_BACKENDS_V1.includes(backend)) return deny("SELECTION_BACKEND_DENIED", "SELECTION_PROHIBITED_FALLBACK_DENIED");
  const matches = descriptors.filter((record) => record.descriptor.role === role && record.descriptor.backend === backend);
  if (matches.length !== 1) return deny("SELECTION_AMBIGUITY_DENIED", "SELECTION_PROHIBITED_FALLBACK_DENIED");
  if (!versionSatisfies(version, matches[0].descriptor.version)) return deny("SELECTION_VERSION_DENIED", "SELECTION_PROHIBITED_FALLBACK_DENIED");
  return { outcome: "VERIFIED", selection: matches[0], component: componentEvidence(matches[0]) };
}

export function componentEvidence(record) {
  return deepFreeze({
    descriptor: record.descriptor,
    descriptorFile: record.descriptorFile,
    descriptorSha256: record.descriptorSha256,
    implementationSha256: record.implementationSha256,
  });
}

export function getTrustedComponentRun(record) {
  const run = TRUSTED_RUNS.get(record);
  if (typeof run !== "function") throw new Error("SELECTION_IMPLEMENTATION_REGISTRY_DENIED");
  return run;
}
