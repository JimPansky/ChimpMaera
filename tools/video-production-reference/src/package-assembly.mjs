// Atomic synthetic package assembly and independent QA readback. This creates
// no encoded/playable video: render.cmvideo is canonical JSON indexing copied
// PNG/WAV fixtures and their declared timeline.
import { createHash } from "node:crypto";
import { lstat, mkdir, open, readdir, rmdir, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { canonicalJson, lockedVideoSpec } from "./job-validator.mjs";
import { anchoredPath, openAbsoluteDirectoryChain, openRelativeDirectory, readRelativeRegularOnce } from "./safe-io.mjs";
import { parseStrictJson } from "./strict-json.mjs";
import { decodePng, readWavData } from "./media-io.mjs";
import { SELECTION_CONTRACT_SCHEMA_V1 } from "./select-component.mjs";

export const RENDER_MANIFEST_SCHEMA = "chimpmaera.video/synthetic-render-manifest/v1";
export const TIMELINE_SCHEMA = "chimpmaera.video/synthetic-timeline/v1";
export const PACKAGE_INDEX_SCHEMA = "chimpmaera.video/synthetic-package-index/v1";
export const SUCCESS_SCHEMA = "chimpmaera.video/synthetic-success/v1";
export const QA_RECEIPT_SCHEMA = "chimpmaera.video/synthetic-qa-receipt/v1";

const TOP_WITHOUT_QA = ["audio.pcm.wav", "manifest.json", "ownership.json", "render.cmvideo", "success.json", "timeline.json", "frames"];
const MAX_OUTPUT_FILE = 4_000_000;

function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function jsonBytes(value) { return Buffer.from(canonicalJson(value), "utf8"); }
function artifactSetDigest(artifacts) { return hash(jsonBytes(artifacts)); }
function sameJson(left, right) { return canonicalJson(left) === canonicalJson(right); }

function componentBindings(components) {
  return Object.fromEntries(["renderer", "audio", "qa"].map((role) => [role, components[role]]));
}

function construct({ validated, components, rendererPlan, audioResult }) {
  const job = validated.job;
  if (rendererPlan.jobDigest !== validated.jobDigest || rendererPlan.frameCount !== validated.assets.length
    || rendererPlan.durationFrames !== validated.durationFrames) throw new Error("RENDER_PLAN_BINDING_DENIED");
  if (audioResult.sha256 !== validated.audio.sha256 || audioResult.sampleCount !== validated.expectedAudioSamples
    || audioResult.bytesBase64 !== validated.audio.bytesBase64) throw new Error("AUDIO_PASSTHROUGH_BINDING_DENIED");

  const frames = validated.assets.map((asset) => ({
    id: asset.id,
    sceneId: asset.sceneId,
    file: `frames/${asset.sceneId}.png`,
    sha256: asset.sha256,
    startFrame: asset.startFrame,
    endFrame: asset.endFrame,
    measuredPng: asset.measuredPng,
  }));
  const target = {
    width: job.spec.video.width,
    height: job.spec.video.height,
    fps: job.spec.video.fps,
    declaredTargetPixelFormat: job.spec.video.declaredTargetPixelFormat,
    durationFrames: job.spec.video.durationFrames,
    durationSeconds: job.spec.video.durationSeconds,
  };
  const measuredAudio = validated.audio.measuredWav;
  const timeline = {
    schemaVersion: TIMELINE_SCHEMA,
    job: { name: job.metadata.name, immutableOutputVersion: job.metadata.immutableOutputVersion, jobDigest: validated.jobDigest },
    target,
    frames,
    audio: { id: validated.audio.id, file: "audio.pcm.wav", sha256: validated.audio.sha256, measuredWav: measuredAudio },
  };
  const timelineBytes = jsonBytes(timeline);
  const payloadArtifacts = [
    ...frames.map((frame) => ({ path: frame.file, sha256: frame.sha256, bytes: Buffer.from(validated.assets.find((asset) => asset.sceneId === frame.sceneId).bytesBase64, "base64").length })),
    { path: "audio.pcm.wav", sha256: validated.audio.sha256, bytes: Buffer.from(audioResult.bytesBase64, "base64").length },
    { path: "timeline.json", sha256: hash(timelineBytes), bytes: timelineBytes.length },
  ].sort((a, b) => a.path.localeCompare(b.path));
  const packageIndex = {
    schemaVersion: PACKAGE_INDEX_SCHEMA,
    mediaType: "application/vnd.chimpmaera.synthetic-package-index+json",
    playableVideo: false,
    job: timeline.job,
    declaredTarget: target,
    measuredSources: {
      frames: frames.map(({ sceneId, measuredPng, sha256 }) => ({ sceneId, sha256, ...measuredPng })),
      audio: { sha256: validated.audio.sha256, ...measuredAudio },
    },
    timeline: { file: "timeline.json", sha256: hash(timelineBytes) },
    payloadArtifacts,
  };
  const packageBytes = jsonBytes(packageIndex);
  const ownershipCore = {
    schemaVersion: "chimpmaera.video/synthetic-output-ownership/v1",
    jobDigest: validated.jobDigest,
    namespace: `${job.metadata.name}/${job.metadata.immutableOutputVersion}`,
  };
  const ownership = { ...ownershipCore, nonce: hash(jsonBytes(ownershipCore)) };
  const ownershipBytes = jsonBytes(ownership);
  const expectedRenderFiles = [
    "ownership.json", ...frames.map((frame) => frame.file), "audio.pcm.wav", "timeline.json", "render.cmvideo", "manifest.json", "success.json",
  ].sort();
  const manifest = {
    schemaVersion: RENDER_MANIFEST_SCHEMA,
    status: "RENDERED",
    frozenJob: job,
    jobDigest: validated.jobDigest,
    semanticCommand: {
      operation: "synthetic-package-assembly",
      selectionContract: SELECTION_CONTRACT_SCHEMA_V1,
      outputPolicy: "exclusive-immutable-namespace",
    },
    components: componentBindings(components),
    sourceAssets: {
      frames: validated.assets.map((asset) => ({ id: asset.id, sceneId: asset.sceneId, path: asset.path, sha256: asset.sha256 })),
      audio: { id: validated.audio.id, path: validated.audio.path, sha256: validated.audio.sha256 },
    },
    frameSchedule: frames.map(({ id, sceneId, startFrame, endFrame }) => ({ id, sceneId, startFrame, endFrame })),
    copiedOutputs: [
      ...frames.map(({ sceneId, file, sha256 }) => ({ sourceId: sceneId, file, sha256 })),
      { sourceId: validated.audio.id, file: "audio.pcm.wav", sha256: validated.audio.sha256 },
    ],
    timeline: { file: "timeline.json", sha256: hash(timelineBytes) },
    packageIndex: { file: "render.cmvideo", sha256: hash(packageBytes), playableVideo: false },
    expectedRenderFiles,
    expectedQaFile: "qa-receipt.json",
  };
  const manifestBytes = jsonBytes(manifest);
  const artifactDescriptors = [
    { path: "ownership.json", sha256: hash(ownershipBytes), bytes: ownershipBytes.length },
    ...payloadArtifacts,
    { path: "render.cmvideo", sha256: hash(packageBytes), bytes: packageBytes.length },
    { path: "manifest.json", sha256: hash(manifestBytes), bytes: manifestBytes.length },
  ].sort((a, b) => a.path.localeCompare(b.path));
  const artifactSetSha256 = artifactSetDigest(artifactDescriptors);
  const success = {
    schemaVersion: SUCCESS_SCHEMA,
    status: "SUCCESS",
    jobDigest: validated.jobDigest,
    artifactSetSha256,
    artifacts: artifactDescriptors,
  };
  return {
    frames, timeline, timelineBytes, packageIndex, packageBytes, ownership, ownershipBytes,
    manifest, manifestBytes, artifactDescriptors, artifactSetSha256, success, successBytes: jsonBytes(success),
    audioBytes: Buffer.from(audioResult.bytesBase64, "base64"),
  };
}

function sameInode(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

async function entryStat(directory, relativePath) {
  return lstat(anchoredPath(directory, relativePath), { bigint: true });
}

async function bindDirectoryEntry({ parentHandle, name, handle, expectedInfo }) {
  const [entry, retained] = await Promise.all([
    entryStat(parentHandle, name),
    handle.stat({ bigint: true }),
  ]);
  if (!entry.isDirectory() || !retained.isDirectory()
    || !sameInode(entry, expectedInfo) || !sameInode(retained, expectedInfo)) {
    throw new Error("OUTPUT_DIRECTORY_BINDING_DENIED");
  }
}

async function bindAbsoluteDirectoryChain(chain) {
  if (!Array.isArray(chain) || chain.length === 0) throw new Error("OUTPUT_ROOT_BINDING_DENIED");
  const root = chain[0];
  const retainedRoot = await root.handle.stat({ bigint: true });
  if (root.name !== null || !retainedRoot.isDirectory() || !sameInode(retainedRoot, root.info)) {
    throw new Error("OUTPUT_ROOT_BINDING_DENIED");
  }
  for (let index = 1; index < chain.length; index += 1) {
    await bindDirectoryEntry({
      parentHandle: chain[index - 1].handle,
      name: chain[index].name,
      handle: chain[index].handle,
      expectedInfo: chain[index].info,
    });
  }
}

async function closeAbsoluteDirectoryChain(chain) {
  if (!chain) return;
  for (const { handle } of [...chain].reverse()) await handle.close().catch(() => {});
}

async function bindOwnedFinal({ nameHandle, finalName, finalHandle, finalInfo, ownershipBytes }) {
  await bindDirectoryEntry({ parentHandle: nameHandle, name: finalName, handle: finalHandle, expectedInfo: finalInfo });
  const marker = await readRelativeRegularOnce(finalHandle, "ownership.json", 16_384);
  if (!marker.bytes.equals(ownershipBytes)) throw new Error("OUTPUT_OWNERSHIP_BINDING_DENIED");
}

async function bindCallerVisibleFinal({ outputChain, name, nameHandle, nameInfo, finalName, finalHandle, finalInfo, ownershipBytes }) {
  await bindAbsoluteDirectoryChain(outputChain);
  await bindDirectoryEntry({ parentHandle: outputChain.at(-1).handle, name, handle: nameHandle, expectedInfo: nameInfo });
  await bindOwnedFinal({ nameHandle, finalName, finalHandle, finalInfo, ownershipBytes });
}

async function writeAll(file, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const { bytesWritten } = await file.write(bytes, offset, bytes.length - offset, offset);
    if (bytesWritten <= 0) throw new Error("OUTPUT_SHORT_WRITE_DENIED");
    offset += bytesWritten;
  }
}

async function readAllAt(file, size) {
  const bytes = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const { bytesRead } = await file.read(bytes, offset, size - offset, offset);
    if (bytesRead <= 0) throw new Error("OUTPUT_SHORT_READ_DENIED");
    offset += bytesRead;
  }
  return bytes;
}

async function independentlyWrite(directory, relativePath, bytes) {
  const flags = constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;
  let file;
  try {
    file = await open(anchoredPath(directory, relativePath), flags, 0o600);
    const initial = await file.stat({ bigint: true });
    if (!initial.isFile()) throw new Error("OUTPUT_FILE_TYPE_DENIED");
    await writeAll(file, bytes);
    await file.sync();
    const retained = await file.stat({ bigint: true });
    const entry = await entryStat(directory, relativePath);
    if (!entry.isFile() || !sameInode(entry, retained) || retained.size !== BigInt(bytes.length)) {
      throw new Error("OUTPUT_FILE_BINDING_DENIED");
    }
    const observed = await readAllAt(file, bytes.length);
    if (hash(observed) !== hash(bytes) || !observed.equals(bytes)) throw new Error("OUTPUT_INDEPENDENT_REHASH_DENIED");
    return retained;
  } finally {
    await file?.close().catch(() => {});
  }
}

async function verifyOwnedFile(directory, relativePath, expectedInfo, expectedBytes) {
  const entry = await entryStat(directory, relativePath);
  if (!entry.isFile() || !sameInode(entry, expectedInfo) || statBinding(entry) !== statBinding(expectedInfo)) {
    throw new Error("OUTPUT_FILE_REPLACED_DENIED");
  }
  const observed = await readRelativeRegularOnce(directory, relativePath, Math.max(MAX_OUTPUT_FILE, expectedBytes.length));
  if (!observed.bytes.equals(expectedBytes) || hash(observed.bytes) !== hash(expectedBytes)) {
    throw new Error("OUTPUT_FILE_REHASH_DENIED");
  }
}

async function safeUnlinkOwned(directory, relativePath, expectedInfo) {
  try {
    const current = await entryStat(directory, relativePath);
    if (!current.isFile() || !sameInode(current, expectedInfo)) return;
    await unlink(anchoredPath(directory, relativePath));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function cleanupOwned({ finalHandle, finalInfo, ownershipBytes, markerConfirmed, topFiles, frameFiles, framesInfo, nameHandle, nameInfo, finalName, outputChain, name, createdName }) {
  const outputHandle = outputChain.at(-1).handle;
  try {
    const retained = await finalHandle.stat({ bigint: true });
    if (!retained.isDirectory() || !sameInode(retained, finalInfo)) return;
    if (markerConfirmed) {
      let markerOk = false;
      try { markerOk = (await readRelativeRegularOnce(finalHandle, "ownership.json", 16_384)).bytes.equals(ownershipBytes); }
      catch {}
      if (!markerOk) return;
    }

    let framesHandle;
    if (framesInfo) {
      try {
        framesHandle = await openRelativeDirectory(finalHandle, "frames");
        await bindDirectoryEntry({ parentHandle: finalHandle, name: "frames", handle: framesHandle, expectedInfo: framesInfo });
        for (const [file, info] of [...frameFiles].reverse()) await safeUnlinkOwned(framesHandle, file, info);
        await bindDirectoryEntry({ parentHandle: finalHandle, name: "frames", handle: framesHandle, expectedInfo: framesInfo });
        await framesHandle.close();
        framesHandle = undefined;
        await rmdir(anchoredPath(finalHandle, "frames"));
      } catch {}
      await framesHandle?.close().catch(() => {});
    }
    for (const [file, info] of [...topFiles].reverse()) {
      if (file !== "ownership.json") await safeUnlinkOwned(finalHandle, file, info);
    }

    let finalStillOwned = false;
    try {
      if (markerConfirmed) {
        let pathBound = false;
        try {
          await bindOwnedFinal({ nameHandle, finalName, finalHandle, finalInfo, ownershipBytes });
          pathBound = true;
        } catch {}
        const markerInfo = topFiles.get("ownership.json");
        if (!markerInfo) throw new Error("OUTPUT_OWNERSHIP_BINDING_DENIED");
        await safeUnlinkOwned(finalHandle, "ownership.json", markerInfo);
        if (!pathBound) throw new Error("OUTPUT_DIRECTORY_BINDING_DENIED");
      }
      await bindDirectoryEntry({ parentHandle: nameHandle, name: finalName, handle: finalHandle, expectedInfo: finalInfo });
      finalStillOwned = true;
    } catch {}
    await finalHandle.close();
    if (finalStillOwned) await rmdir(anchoredPath(nameHandle, finalName)).catch(() => {});

    let nameStillOwned = false;
    if (createdName) {
      try {
        await bindDirectoryEntry({ parentHandle: outputHandle, name, handle: nameHandle, expectedInfo: nameInfo });
        nameStillOwned = true;
      } catch {}
    }
    await nameHandle.close();
    if (nameStillOwned) await rmdir(anchoredPath(outputHandle, name)).catch(() => {});
  } catch {
    // Cleanup is deliberately conservative: only retained, marker-bound inodes
    // are emptied, and a pathname is removed only after an immediate rebind.
  } finally {
    await finalHandle?.close().catch(() => {});
    await nameHandle?.close().catch(() => {});
    await closeAbsoluteDirectoryChain(outputChain);
  }
}

export async function renderPackage({ validated, components, rendererPlan, audioResult, outputRoot }) {
  const job = validated.job;
  let built;
  try { built = construct({ validated, components, rendererPlan, audioResult }); }
  catch { return { outcome: "DENIED", reasonCodes: ["COMPONENT_BINDING_DENIED"] }; }
  let outputChain;
  try {
    outputChain = await openAbsoluteDirectoryChain(outputRoot);
    await bindAbsoluteDirectoryChain(outputChain);
  }
  catch {
    await closeAbsoluteDirectoryChain(outputChain);
    return { outcome: "DENIED", reasonCodes: ["OUTPUT_ROOT_DENIED"] };
  }
  const outputHandle = outputChain.at(-1).handle;
  let createdName = false;
  let finalCreated = false;
  let nameHandle;
  let finalHandle;
  let nameInfo;
  let finalInfo;
  let framesInfo;
  let markerConfirmed = false;
  const topFiles = new Map();
  const frameFiles = new Map();
  try {
    try { await mkdir(anchoredPath(outputHandle, job.metadata.name), { mode: 0o700 }); createdName = true; }
    catch (error) { if (error.code !== "EEXIST") throw error; }
    nameHandle = await openRelativeDirectory(outputHandle, job.metadata.name);
    nameInfo = await nameHandle.stat({ bigint: true });
    await bindDirectoryEntry({ parentHandle: outputHandle, name: job.metadata.name, handle: nameHandle, expectedInfo: nameInfo });
    try { await mkdir(anchoredPath(nameHandle, job.metadata.immutableOutputVersion), { mode: 0o700 }); finalCreated = true; }
    catch (error) {
      if (error.code === "EEXIST") {
        await nameHandle.close();
        await closeAbsoluteDirectoryChain(outputChain);
        return { outcome: "DENIED", reasonCodes: ["OUTPUT_EXISTS_DENIED"] };
      }
      throw error;
    }
    finalHandle = await openRelativeDirectory(nameHandle, job.metadata.immutableOutputVersion);
    finalInfo = await finalHandle.stat({ bigint: true });
    await bindDirectoryEntry({ parentHandle: nameHandle, name: job.metadata.immutableOutputVersion, handle: finalHandle, expectedInfo: finalInfo });
    try {
      topFiles.set("ownership.json", await independentlyWrite(finalHandle, "ownership.json", built.ownershipBytes));
      markerConfirmed = true;
      await bindCallerVisibleFinal({
        outputChain,
        name: job.metadata.name,
        nameHandle,
        nameInfo,
        finalName: job.metadata.immutableOutputVersion,
        finalHandle,
        finalInfo,
        ownershipBytes: built.ownershipBytes,
      });
      await mkdir(anchoredPath(finalHandle, "frames"), { mode: 0o700 });
      const framesHandle = await openRelativeDirectory(finalHandle, "frames");
      try {
        framesInfo = await framesHandle.stat({ bigint: true });
        await bindDirectoryEntry({ parentHandle: finalHandle, name: "frames", handle: framesHandle, expectedInfo: framesInfo });
        for (const [index, frame] of built.frames.entries()) {
          const file = `${frame.sceneId}.png`;
          frameFiles.set(file, await independentlyWrite(framesHandle, file, Buffer.from(validated.assets[index].bytesBase64, "base64")));
        }
      } finally { await framesHandle.close(); }
      topFiles.set("audio.pcm.wav", await independentlyWrite(finalHandle, "audio.pcm.wav", built.audioBytes));
      topFiles.set("timeline.json", await independentlyWrite(finalHandle, "timeline.json", built.timelineBytes));
      topFiles.set("render.cmvideo", await independentlyWrite(finalHandle, "render.cmvideo", built.packageBytes));
      topFiles.set("manifest.json", await independentlyWrite(finalHandle, "manifest.json", built.manifestBytes));
      topFiles.set("success.json", await independentlyWrite(finalHandle, "success.json", built.successBytes));
      if (!(await exactDirectoryNames(finalHandle, TOP_WITHOUT_QA))) throw new Error("OUTPUT_ARTIFACT_SET_DENIED");
      const finalFramesHandle = await openRelativeDirectory(finalHandle, "frames");
      try {
        await bindDirectoryEntry({ parentHandle: finalHandle, name: "frames", handle: finalFramesHandle, expectedInfo: framesInfo });
        if (!(await exactDirectoryNames(finalFramesHandle, [...frameFiles.keys()]))) throw new Error("OUTPUT_ARTIFACT_SET_DENIED");
        for (const [index, frame] of built.frames.entries()) {
          const file = `${frame.sceneId}.png`;
          await verifyOwnedFile(finalFramesHandle, file, frameFiles.get(file), Buffer.from(validated.assets[index].bytesBase64, "base64"));
        }
      } finally { await finalFramesHandle.close(); }
      const finalBytes = new Map([
        ["ownership.json", built.ownershipBytes],
        ["audio.pcm.wav", built.audioBytes],
        ["timeline.json", built.timelineBytes],
        ["render.cmvideo", built.packageBytes],
        ["manifest.json", built.manifestBytes],
        ["success.json", built.successBytes],
      ]);
      for (const [file, expectedBytes] of finalBytes) {
        await verifyOwnedFile(finalHandle, file, topFiles.get(file), expectedBytes);
      }
      await bindCallerVisibleFinal({
        outputChain,
        name: job.metadata.name,
        nameHandle,
        nameInfo,
        finalName: job.metadata.immutableOutputVersion,
        finalHandle,
        finalInfo,
        ownershipBytes: built.ownershipBytes,
      });
      await finalHandle.close();
      await nameHandle.close();
      await closeAbsoluteDirectoryChain(outputChain);
      return {
        outcome: "RENDERED",
        outputDir: `${job.metadata.name}/${job.metadata.immutableOutputVersion}`,
        artifactSetSha256: built.artifactSetSha256,
        artifacts: built.artifactDescriptors,
      };
    } catch (error) {
      await cleanupOwned({ finalHandle, finalInfo, ownershipBytes: built.ownershipBytes, markerConfirmed, topFiles, frameFiles, framesInfo, nameHandle, nameInfo, finalName: job.metadata.immutableOutputVersion, outputChain, name: job.metadata.name, createdName });
      return { outcome: "DENIED", reasonCodes: [error.code === "EEXIST" ? "OUTPUT_WRITE_EXISTS_DENIED" : "OUTPUT_ASSEMBLY_DENIED"] };
    }
  } catch {
    if (finalHandle && finalInfo && nameHandle && nameInfo) {
      await cleanupOwned({ finalHandle, finalInfo, ownershipBytes: built.ownershipBytes, markerConfirmed, topFiles, frameFiles, framesInfo, nameHandle, nameInfo, finalName: job.metadata.immutableOutputVersion, outputChain, name: job.metadata.name, createdName });
    } else {
      await finalHandle?.close().catch(() => {});
      await nameHandle?.close().catch(() => {});
    }
    await closeAbsoluteDirectoryChain(outputChain);
    return { outcome: "DENIED", reasonCodes: ["OUTPUT_NAMESPACE_DENIED"] };
  }
}

async function exactDirectoryNames(handle, expected) {
  const names = (await readdir(`/proc/self/fd/${handle.fd}`)).sort();
  return names.length === expected.length && expected.slice().sort().every((name, index) => name === names[index]);
}

async function readCanonicalJson(handle, path, maxBytes = 262_144) {
  const bytes = (await readRelativeRegularOnce(handle, path, maxBytes)).bytes;
  const value = parseStrictJson(bytes, { maxBytes, maxNodes: 16_384, maxTotalStringLength: 131_072 });
  if (!bytes.equals(jsonBytes(value))) throw new Error("QA_NONCANONICAL_JSON_DENIED");
  return { bytes, value };
}

function statBinding(info) {
  return [info.dev, info.ino, info.mode, info.size, info.mtimeNs, info.ctimeNs].join(":");
}

async function artifactSnapshot(finalHandle, framesHandle, expectedTop, expectedFrames) {
  if (!(await exactDirectoryNames(finalHandle, expectedTop))
    || !(await exactDirectoryNames(framesHandle, expectedFrames))) {
    throw new Error("QA_ARTIFACT_SET_DENIED");
  }
  const snapshot = new Map();
  for (const name of expectedTop) {
    const info = await entryStat(finalHandle, name);
    if (name === "frames" ? !info.isDirectory() : !info.isFile()) throw new Error("QA_ARTIFACT_TYPE_DENIED");
    snapshot.set(name, statBinding(info));
  }
  for (const name of expectedFrames) {
    const info = await entryStat(framesHandle, name);
    if (!info.isFile()) throw new Error("QA_ARTIFACT_TYPE_DENIED");
    snapshot.set(`frames/${name}`, statBinding(info));
  }
  return snapshot;
}

function sameSnapshot(left, right) {
  return left.size === right.size && [...left].every(([path, binding]) => right.get(path) === binding);
}

function snapshotExtends(previous, current, addedPath, addedInfo) {
  return current.size === previous.size + 1
    && [...previous].every(([path, binding]) => current.get(path) === binding)
    && current.get(addedPath) === statBinding(addedInfo);
}

export async function qaPackage({ validated, components, rendererPlan, audioResult, qaRun, outputRoot }) {
  const deny = (...reasonCodes) => ({ outcome: "DENIED", reasonCodes });
  let outputChain;
  let outputHandle;
  let nameHandle;
  let finalHandle;
  let framesHandle;
  let createdReceiptInfo;
  try {
    const built = construct({ validated, components, rendererPlan, audioResult });
    outputChain = await openAbsoluteDirectoryChain(outputRoot);
    await bindAbsoluteDirectoryChain(outputChain);
    outputHandle = outputChain.at(-1).handle;
    nameHandle = await openRelativeDirectory(outputHandle, validated.job.metadata.name);
    const nameInfo = await nameHandle.stat({ bigint: true });
    await bindDirectoryEntry({ parentHandle: outputHandle, name: validated.job.metadata.name, handle: nameHandle, expectedInfo: nameInfo });
    finalHandle = await openRelativeDirectory(nameHandle, validated.job.metadata.immutableOutputVersion);
    const finalInfo = await finalHandle.stat({ bigint: true });
    await bindCallerVisibleFinal({
      outputChain,
      name: validated.job.metadata.name,
      nameHandle,
      nameInfo,
      finalName: validated.job.metadata.immutableOutputVersion,
      finalHandle,
      finalInfo,
      ownershipBytes: built.ownershipBytes,
    });
    const topNames = (await readdir(`/proc/self/fd/${finalHandle.fd}`)).sort();
    const hasReceipt = topNames.includes("qa-receipt.json");
    const expectedTop = [...TOP_WITHOUT_QA, ...(hasReceipt ? ["qa-receipt.json"] : [])].sort();
    framesHandle = await openRelativeDirectory(finalHandle, "frames");
    const framesInfo = await framesHandle.stat({ bigint: true });
    await bindDirectoryEntry({ parentHandle: finalHandle, name: "frames", handle: framesHandle, expectedInfo: framesInfo });
    const expectedFrameNames = validated.assets.map((asset) => `${asset.sceneId}.png`).sort();
    const beforeRead = await artifactSnapshot(finalHandle, framesHandle, expectedTop, expectedFrameNames);

    const ownership = await readCanonicalJson(finalHandle, "ownership.json");
    const timeline = await readCanonicalJson(finalHandle, "timeline.json");
    const packageIndex = await readCanonicalJson(finalHandle, "render.cmvideo");
    const manifest = await readCanonicalJson(finalHandle, "manifest.json", 524_288);
    const success = await readCanonicalJson(finalHandle, "success.json");
    const alreadyRead = new Map([
      ["ownership.json", ownership.bytes],
      ["timeline.json", timeline.bytes],
      ["render.cmvideo", packageIndex.bytes],
      ["manifest.json", manifest.bytes],
    ]);
    if (!sameJson(ownership.value, built.ownership) || !sameJson(timeline.value, built.timeline)
      || !sameJson(packageIndex.value, built.packageIndex) || !sameJson(manifest.value, built.manifest)
      || !sameJson(success.value, built.success)) return deny("QA_EVIDENCE_BINDING_DENIED");
    const qaAuthorization = qaRun({
      kind: "complete-artifact-readback",
      artifactSetSha256: built.artifactSetSha256,
      jobDigest: validated.jobDigest,
    });
    if (success.value.artifactSetSha256 !== built.artifactSetSha256
      || qaAuthorization.artifactSetSha256 !== built.artifactSetSha256
      || qaAuthorization.jobDigest !== validated.jobDigest) return deny("QA_ARTIFACT_SET_DIGEST_DENIED");

    const observedArtifacts = [];
    for (const artifact of built.artifactDescriptors) {
      const root = artifact.path.startsWith("frames/") ? framesHandle : finalHandle;
      const path = artifact.path.startsWith("frames/") ? artifact.path.slice(7) : artifact.path;
      const bytes = alreadyRead.get(artifact.path)
        ?? (await readRelativeRegularOnce(root, path, Math.max(MAX_OUTPUT_FILE, artifact.bytes))).bytes;
      if (bytes.length !== artifact.bytes || hash(bytes) !== artifact.sha256) return deny("QA_ARTIFACT_DIGEST_DENIED");
      observedArtifacts.push({ path: artifact.path, sha256: hash(bytes), bytes: bytes.length });
      if (artifact.path.startsWith("frames/")) {
        const decoded = decodePng(bytes);
        if (decoded.width !== 1280 || decoded.height !== 720) return deny("QA_FRAME_MEDIA_DENIED");
      } else if (artifact.path === "audio.pcm.wav") {
        const decoded = readWavData(bytes);
        if (decoded.sampleCount !== validated.expectedAudioSamples) return deny("QA_AUDIO_MEDIA_DENIED");
      }
    }
    if (artifactSetDigest(observedArtifacts.sort((a, b) => a.path.localeCompare(b.path))) !== built.artifactSetSha256) return deny("QA_ARTIFACT_SET_DIGEST_DENIED");

    const receipt = {
      schemaVersion: QA_RECEIPT_SCHEMA,
      outcome: "PASS",
      jobDigest: validated.jobDigest,
      artifactSetSha256: built.artifactSetSha256,
      qaComponent: components.qa,
      checks: ["closed-schemas", "complete-artifact-set", "component-bindings", "frame-schedule", "png-full-decode", "wav-pcm-full-decode"],
    };
    const receiptBytes = jsonBytes(receipt);
    const prepared = await artifactSnapshot(finalHandle, framesHandle, expectedTop, expectedFrameNames);
    if (!sameSnapshot(beforeRead, prepared)) return deny("QA_ARTIFACT_REPLACED_DENIED");
    if (hasReceipt) {
      const existing = await readCanonicalJson(finalHandle, "qa-receipt.json");
      if (!existing.bytes.equals(receiptBytes)) return deny("QA_STALE_RECEIPT_DENIED");
    } else {
      createdReceiptInfo = await independentlyWrite(finalHandle, "qa-receipt.json", receiptBytes);
    }
    await new Promise((resolve) => setImmediate(resolve));
    const passTop = [...TOP_WITHOUT_QA, "qa-receipt.json"].sort();
    const beforePass = await artifactSnapshot(finalHandle, framesHandle, passTop, expectedFrameNames);
    if (hasReceipt ? !sameSnapshot(prepared, beforePass)
      : !snapshotExtends(prepared, beforePass, "qa-receipt.json", createdReceiptInfo)) {
      throw new Error("QA_ARTIFACT_REPLACED_DENIED");
    }
    await bindDirectoryEntry({ parentHandle: finalHandle, name: "frames", handle: framesHandle, expectedInfo: framesInfo });
    await bindCallerVisibleFinal({
      outputChain,
      name: validated.job.metadata.name,
      nameHandle,
      nameInfo,
      finalName: validated.job.metadata.immutableOutputVersion,
      finalHandle,
      finalInfo,
      ownershipBytes: built.ownershipBytes,
    });
    return { outcome: "PASS", artifactSetSha256: built.artifactSetSha256, receipt };
  } catch {
    if (createdReceiptInfo && finalHandle) {
      await safeUnlinkOwned(finalHandle, "qa-receipt.json", createdReceiptInfo).catch(() => {});
    }
    return deny("QA_READBACK_DENIED");
  } finally {
    await framesHandle?.close().catch(() => {});
    await finalHandle?.close().catch(() => {});
    await nameHandle?.close().catch(() => {});
    await closeAbsoluteDirectoryChain(outputChain);
  }
}
