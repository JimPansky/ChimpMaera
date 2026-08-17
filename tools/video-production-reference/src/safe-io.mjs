// Linux-only, descriptor-relative I/O helpers. Inputs are opened once with
// O_NOFOLLOW, verified as bounded regular files, and consumed from that handle.
import { constants } from "node:fs";
import { open, readdir } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

const DIR_FLAGS = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
const FILE_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW;
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

export function requireSupportedPlatform() {
  if (process.platform !== "linux" || !Number.isInteger(constants.O_NOFOLLOW)) {
    const error = new Error("PLATFORM_UNSUPPORTED_DENIED: Linux O_NOFOLLOW is required");
    error.code = "PLATFORM_UNSUPPORTED_DENIED";
    throw error;
  }
}

function procPath(handle, name = "") {
  return `/proc/self/fd/${handle.fd}${name ? `/${name}` : ""}`;
}

function safeSegments(relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || isAbsolute(relativePath)) {
    throw new Error("PATH_DENIED");
  }
  const parts = relativePath.split("/");
  if (parts.some((part) => !SAFE_SEGMENT.test(part) || part === "." || part === "..")) {
    throw new Error("PATH_DENIED");
  }
  return parts;
}

async function assertDirectory(handle) {
  const info = await handle.stat({ bigint: true });
  if (!info.isDirectory()) throw new Error("DIRECTORY_TYPE_DENIED");
  return info;
}

export async function openAbsoluteDirectory(directoryPath) {
  requireSupportedPlatform();
  const absolute = resolve(directoryPath);
  if (!isAbsolute(absolute)) throw new Error("DIRECTORY_PATH_DENIED");
  let current = await open("/", DIR_FLAGS);
  try {
    for (const part of absolute.split("/").filter(Boolean)) {
      if (!SAFE_SEGMENT.test(part) || part === "." || part === "..") throw new Error("DIRECTORY_PATH_DENIED");
      const next = await open(procPath(current, part), DIR_FLAGS);
      await assertDirectory(next);
      await current.close();
      current = next;
    }
    await assertDirectory(current);
    return current;
  } catch (error) {
    await current.close().catch(() => {});
    throw error;
  }
}

export async function openAbsoluteDirectoryChain(directoryPath) {
  requireSupportedPlatform();
  const absolute = resolve(directoryPath);
  if (!isAbsolute(absolute)) throw new Error("DIRECTORY_PATH_DENIED");
  const chain = [];
  try {
    const rootHandle = await open("/", DIR_FLAGS);
    try {
      chain.push({ name: null, handle: rootHandle, info: await assertDirectory(rootHandle) });
    } catch (error) {
      await rootHandle.close().catch(() => {});
      throw error;
    }
    for (const part of absolute.split("/").filter(Boolean)) {
      if (!SAFE_SEGMENT.test(part) || part === "." || part === "..") throw new Error("DIRECTORY_PATH_DENIED");
      const parent = chain.at(-1).handle;
      const handle = await open(procPath(parent, part), DIR_FLAGS);
      try {
        chain.push({ name: part, handle, info: await assertDirectory(handle) });
      } catch (error) {
        await handle.close().catch(() => {});
        throw error;
      }
    }
    return chain;
  } catch (error) {
    await Promise.all(chain.reverse().map(({ handle }) => handle.close().catch(() => {})));
    throw error;
  }
}

export async function openRelativeDirectory(rootHandle, relativePath) {
  const parts = safeSegments(relativePath);
  let current = rootHandle;
  let ownsCurrent = false;
  try {
    for (const part of parts) {
      const next = await open(procPath(current, part), DIR_FLAGS);
      await assertDirectory(next);
      if (ownsCurrent) await current.close();
      current = next;
      ownsCurrent = true;
    }
    return current;
  } catch (error) {
    if (ownsCurrent) await current.close().catch(() => {});
    throw error;
  }
}

function unchanged(before, after) {
  return before.dev === after.dev && before.ino === after.ino
    && before.size === after.size && before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs;
}

export async function readRelativeRegularOnce(rootHandle, relativePath, maxBytes) {
  const parts = safeSegments(relativePath);
  const name = parts.pop();
  let closeParent = true;
  const parent = parts.length === 0
    ? (closeParent = false, rootHandle)
    : await openRelativeDirectory(rootHandle, parts.join("/"));
  let file;
  try {
    file = await open(procPath(parent, name), FILE_FLAGS);
    const before = await file.stat({ bigint: true });
    if (!before.isFile() || before.size < 0n || before.size > BigInt(maxBytes)) throw new Error("INPUT_FILE_TYPE_OR_SIZE_DENIED");
    const bytes = await file.readFile();
    const after = await file.stat({ bigint: true });
    if (bytes.length !== Number(before.size) || !unchanged(before, after)) throw new Error("INPUT_FILE_CHANGED_DENIED");
    return { bytes, stat: before };
  } finally {
    await file?.close().catch(() => {});
    if (closeParent) await parent.close().catch(() => {});
  }
}

export async function readAbsoluteRegularOnce(filePath, maxBytes) {
  const absolute = resolve(filePath);
  const pieces = absolute.split("/").filter(Boolean);
  const name = pieces.pop();
  if (!name) throw new Error("INPUT_PATH_DENIED");
  const parent = await openAbsoluteDirectory(`/${pieces.join("/")}`);
  try {
    return await readRelativeRegularOnce(parent, name, maxBytes);
  } finally {
    await parent.close().catch(() => {});
  }
}

export async function listDirectory(rootHandle, relativePath) {
  const directory = await openRelativeDirectory(rootHandle, relativePath);
  try {
    return await readdir(procPath(directory), { withFileTypes: true });
  } finally {
    await directory.close();
  }
}

export function anchoredPath(directoryHandle, relativePath) {
  safeSegments(relativePath);
  return procPath(directoryHandle, relativePath);
}
