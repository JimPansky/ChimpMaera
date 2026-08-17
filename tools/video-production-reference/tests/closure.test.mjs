import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectMarkdownFileRefs, DOCUMENTED_PATH_REFERENCES, enumerateShippedFiles, parseManifest, verifyClosure } from "../src/verify-closure.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = "SHA256SUMS";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function copied(t) {
  const temporary = await mkdtemp(join(tmpdir(), "cmvideo-closure-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = join(temporary, "reference");
  await cp(ROOT, root, { recursive: true });
  return root;
}

async function refreshEntries(root, paths) {
  const manifestPath = join(root, MANIFEST);
  const lines = (await readFile(manifestPath, "utf8")).trimEnd().split("\n");
  const replacements = new Map(await Promise.all(paths.map(async (path) => [path, sha(await readFile(join(root, path)))])));
  for (let index = 0; index < lines.length; index += 1) {
    const path = lines[index].slice(66);
    if (replacements.has(path)) { lines[index] = `${replacements.get(path)}  ${path}`; replacements.delete(path); }
  }
  for (const [path, digest] of replacements) lines.push(`${digest}  ${path}`);
  await writeFile(manifestPath, `${lines.sort((a, b) => a.slice(66).localeCompare(b.slice(66))).join("\n")}\n`);
}

test("real internal closure passes", async () => {
  const result = await verifyClosure({ root: ROOT });
  assert.equal(result.outcome, "PASS", JSON.stringify(result));
});

test("internal manifest excludes only itself and matches both directions", async () => {
  const manifest = parseManifest(await readFile(join(ROOT, MANIFEST), "utf8"));
  const files = await enumerateShippedFiles(ROOT);
  assert.deepEqual([...manifest.keys()].sort(), files);
  assert.ok(!manifest.has(MANIFEST));
});

test("missing manifested file is denied", async (t) => {
  const root = await copied(t); await unlink(join(root, "NOTICE"));
  assert.equal((await verifyClosure({ root })).outcome, "DENIED");
});

test("extra regular file is denied", async (t) => {
  const root = await copied(t); await writeFile(join(root, "extra.txt"), "extra\n");
  assert.deepEqual((await verifyClosure({ root })).reasonCodes, ["CLOSURE_FILE_SET_DENIED"]);
});

test("symlink entry is denied rather than followed or skipped", async (t) => {
  const root = await copied(t); await symlink("NOTICE", join(root, "link"));
  assert.deepEqual((await verifyClosure({ root })).reasonCodes, ["CLOSURE_SPECIAL_FILE_DENIED"]);
});

test("unsafe manifest path is denied", async () => {
  assert.throws(() => parseManifest(`${"0".repeat(64)}  ../escape\n`), /PATH_DENIED/);
});

test("manifest self-entry is denied", async () => {
  assert.throws(() => parseManifest(`${"0".repeat(64)}  SHA256SUMS\n`), /SELF_DENIED/);
});

test("checksum divergence is denied", async (t) => {
  const root = await copied(t); await writeFile(join(root, "NOTICE"), "tamper\n");
  assert.deepEqual((await verifyClosure({ root })).reasonCodes, ["CLOSURE_CHECKSUM_DENIED"]);
});

test("implementation binding fails even when its manifest checksum is refreshed", async (t) => {
  const root = await copied(t); const path = "src/render-cpu.mjs";
  await writeFile(join(root, path), "export function run() { return {}; }\n"); await refreshEntries(root, [path]);
  assert.deepEqual((await verifyClosure({ root })).reasonCodes, ["CLOSURE_DESCRIPTOR_BINDING_DENIED"]);
});

test("strict job validation fails even when its manifest checksum is refreshed", async (t) => {
  const root = await copied(t); const path = "jobs/job-alpha.synthetic-v1.json";
  const job = JSON.parse(await readFile(join(root, path), "utf8")); job.spec.video.width = 1;
  await writeFile(join(root, path), `${JSON.stringify(job, null, 2)}\n`); await refreshEntries(root, [path]);
  assert.deepEqual((await verifyClosure({ root })).reasonCodes, ["CLOSURE_JOB_SCHEMA_DENIED"]);
});

test("duplicate textual job key fails strict closure parsing", async (t) => {
  const root = await copied(t); const path = "jobs/job-alpha.synthetic-v1.json";
  const source = await readFile(join(root, path), "utf8"); await writeFile(join(root, path), source.replace("{\n", "{\n  \"kind\": \"VideoJob\",\n"));
  await refreshEntries(root, [path]);
  assert.deepEqual((await verifyClosure({ root })).reasonCodes, ["CLOSURE_JOB_STRICT_JSON_DENIED"]);
});

test("digest-consistent invalid media is denied by closure parsing", async (t) => {
  const root = await copied(t); const asset = "assets/synthetic/frame-s01.png"; const jobPath = "jobs/job-alpha.synthetic-v1.json";
  const bytes = Buffer.from("not-png"); await writeFile(join(root, asset), bytes);
  const job = JSON.parse(await readFile(join(root, jobPath), "utf8")); job.spec.assets.shots[0].sha256 = sha(bytes);
  await writeFile(join(root, jobPath), `${JSON.stringify(job, null, 2)}\n`); await refreshEntries(root, [asset, jobPath]);
  assert.deepEqual((await verifyClosure({ root })).reasonCodes, ["CLOSURE_JOB_MEDIA_DENIED"]);
});

test("all public documentation references participate in closure", async (t) => {
  const root = await copied(t); const path = "EXTENSION-GUIDE.md";
  await writeFile(join(root, path), `${await readFile(join(root, path), "utf8")}Missing \`src/not-shipped.mjs\`.\n`); await refreshEntries(root, [path]);
  assert.deepEqual((await verifyClosure({ root })).reasonCodes, ["CLOSURE_DOCUMENT_REFERENCE_SET_DENIED"]);
});

test("documentation parser closes code-block, command-prefixed, inline-code, and link paths", async () => {
  const refs = new Set();
  for (const doc of ["README.md", "EXTENSION-GUIDE.md", "NOTICE"]) {
    for (const ref of collectMarkdownFileRefs(await readFile(join(ROOT, doc), "utf8"))) refs.add(ref);
  }
  assert.deepEqual([...refs].sort(), [...DOCUMENTED_PATH_REFERENCES].sort());
  for (const required of [
    "bin/cm-video.mjs",
    "jobs/job-alpha.synthetic-v1.json",
    "scripts/verify-closure.mjs",
    "schemas/ownership-marker.schema.v1.json",
    "schemas/timeline.schema.v1.json",
  ]) assert.equal(refs.has(required), true, required);
});

test("omitting a required documented contract reference is denied", async (t) => {
  const root = await copied(t); const path = "README.md";
  const source = await readFile(join(root, path), "utf8");
  await writeFile(join(root, path), source.replace("- `schemas/timeline.schema.v1.json`\n", ""));
  await refreshEntries(root, [path]);
  const result = await verifyClosure({ root });
  assert.deepEqual(result.reasonCodes, ["CLOSURE_DOCUMENT_REFERENCE_SET_DENIED"]);
  assert.deepEqual(result.missingDocumentedRefs, ["schemas/timeline.schema.v1.json"]);
});

test("unsafe documentation path syntax is denied even when its checksum is refreshed", async (t) => {
  const root = await copied(t); const path = "NOTICE";
  await writeFile(join(root, path), `${await readFile(join(root, path), "utf8")}\nDenied path: \`src/../outside.mjs\`.\n`);
  await refreshEntries(root, [path]);
  assert.deepEqual((await verifyClosure({ root })).reasonCodes, ["CLOSURE_DOCUMENT_REFERENCE_PATH_DENIED"]);
});
