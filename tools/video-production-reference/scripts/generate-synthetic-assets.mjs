#!/usr/bin/env node
// Default mode is a no-write verification of checked-in fixture bytes.
// Development regeneration is explicit and uses only integer waveforms plus
// the specified stored-DEFLATE encoder in media-io.mjs.
import { createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writePng, writeWav } from "../src/media-io.mjs";
import { anchoredPath, openAbsoluteDirectory, readRelativeRegularOnce } from "../src/safe-io.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WIDTH = 1280;
const HEIGHT = 720;
const EXPECTED = Object.freeze({
  "frame-s01.png": "49c0ab6c7fe8e28725b57036f9ae921ffca088aa53417a4ff3e45d54c1931c76",
  "frame-s02.png": "59ac2035972203d2e4d9704617109aa3205c7e25cc00a39b6de596df461acdc8",
  "frame-s03.png": "fc48018519057b6e430a16e188429d91ce08ac82ccde63a2f3e2f1b9e609c9d3",
  "frame-s04.png": "f71d6e9a89d4515e51818d8ff279766406b89bad1001ffa1380accc362039295",
  "track-alpha.wav": "0588d14d07b7a8bed0dcecece9cf523c482e4b221949ea39200e3c3ff2be1e30",
  "track-beta.wav": "bdb66026805e779a68241d05406ddf58b8704ecf3f655971068154f71ead71a7",
});

function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

function solidRgb([red, green, blue]) {
  const pixel = Buffer.from([red, green, blue]);
  const bytes = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let offset = 0; offset < bytes.length; offset += 3) pixel.copy(bytes, offset);
  return bytes;
}

function squareSamples({ seconds, period, amplitude, phase = 0 }) {
  const samples = new Int16Array(seconds * 48_000);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = ((index + phase) % period) < period / 2 ? amplitude : -amplitude;
  }
  return samples;
}

function generated() {
  return new Map([
    ["frame-s01.png", writePng({ width: WIDTH, height: HEIGHT, rgb: solidRgb([200, 40, 40]) })],
    ["frame-s02.png", writePng({ width: WIDTH, height: HEIGHT, rgb: solidRgb([40, 160, 40]) })],
    ["frame-s03.png", writePng({ width: WIDTH, height: HEIGHT, rgb: solidRgb([40, 40, 200]) })],
    ["frame-s04.png", writePng({ width: WIDTH, height: HEIGHT, rgb: solidRgb([210, 180, 90]) })],
    ["track-alpha.wav", writeWav({ sampleRate: 48_000, samples: squareSamples({ seconds: 2, period: 200, amplitude: 12_000 }) })],
    ["track-beta.wav", writeWav({ sampleRate: 48_000, samples: squareSamples({ seconds: 3, period: 160, amplitude: 9_000, phase: 37 }) })],
  ]);
}

function sameInode(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

async function writeAll(file, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const { bytesWritten } = await file.write(bytes, offset, bytes.length - offset, offset);
    if (bytesWritten <= 0) throw new Error("FIXTURE_SHORT_WRITE_DENIED");
    offset += bytesWritten;
  }
}

async function readAll(file, size) {
  const bytes = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const { bytesRead } = await file.read(bytes, offset, size - offset, offset);
    if (bytesRead <= 0) throw new Error("FIXTURE_SHORT_READ_DENIED");
    offset += bytesRead;
  }
  return bytes;
}

async function replaceFixture(directory, name, bytes) {
  const temporaryName = `.${name}.${randomBytes(16).toString("hex")}.tmp`;
  const temporaryPath = anchoredPath(directory, temporaryName);
  const targetPath = anchoredPath(directory, name);
  let file;
  let ownedInfo;
  let renamed = false;
  try {
    file = await open(temporaryPath, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o644);
    ownedInfo = await file.stat({ bigint: true });
    if (!ownedInfo.isFile()) throw new Error("FIXTURE_TEMP_TYPE_DENIED");
    await writeAll(file, bytes);
    await file.sync();
    const retained = await file.stat({ bigint: true });
    const entry = await lstat(temporaryPath, { bigint: true });
    if (!entry.isFile() || !sameInode(entry, retained) || retained.size !== BigInt(bytes.length)
      || !(await readAll(file, bytes.length)).equals(bytes)) throw new Error("FIXTURE_TEMP_BINDING_DENIED");
    await rename(temporaryPath, targetPath);
    renamed = true;
    const reopened = await readRelativeRegularOnce(directory, name, 4_000_000);
    if (!reopened.bytes.equals(bytes) || hash(reopened.bytes) !== hash(bytes)) throw new Error(`FIXTURE_POST_RENAME_HASH_DENIED: ${name}`);
  } finally {
    await file?.close().catch(() => {});
    if (!renamed && ownedInfo) {
      try {
        const current = await lstat(temporaryPath, { bigint: true });
        if (current.isFile() && sameInode(current, ownedInfo)) await unlink(temporaryPath);
      } catch {}
    }
  }
}

export async function verifySyntheticFixtures({ regenerate = false, root = ROOT, writeLine = (line) => process.stdout.write(line) } = {}) {
  const fixtures = generated();
  const fixtureHandle = await openAbsoluteDirectory(resolve(root, "assets", "synthetic"));
  try {
    for (const [name, bytes] of fixtures) {
      const next = hash(bytes);
      if (regenerate) {
        let current = "UNREADABLE";
        try { current = hash((await readRelativeRegularOnce(fixtureHandle, name, 4_000_000)).bytes); } catch {}
        await replaceFixture(fixtureHandle, name, bytes);
        writeLine(`${name}\t${current}\t${next}\t${current === next ? "UNCHANGED" : "CHANGED"}\n`);
      } else {
        const current = hash((await readRelativeRegularOnce(fixtureHandle, name, 4_000_000)).bytes);
        if (next !== EXPECTED[name] || current !== EXPECTED[name]) {
          throw new Error(`FIXTURE_DIGEST_DENIED: ${name} expected=${EXPECTED[name]} generated=${next} checked-in=${current}`);
        }
        writeLine(`${name}\t${current}\tPASS\n`);
      }
    }
  } finally { await fixtureHandle.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const regenerate = process.argv.length === 3 && process.argv[2] === "--regenerate";
  if (!regenerate && process.argv.length !== 2) {
    process.stderr.write("usage: generate-synthetic-assets.mjs [--regenerate]\n");
    process.exitCode = 2;
  } else {
    try { await verifySyntheticFixtures({ regenerate }); }
    catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
  }
}
