#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildSecureDefaultEvidence } from "./verify-secure-default-proof.mjs";

const root = process.cwd();
const digest = (relative) => createHash("sha256").update(readFileSync(path.join(root, relative))).digest("hex");
const writeJson = (relative, value) => writeFileSync(path.join(root, relative), `${JSON.stringify(value, null, 2)}\n`);

function walk(relative) {
  return readdirSync(path.join(root, relative), { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory() ? walk(path.posix.join(relative, entry.name)) : [path.posix.join(relative, entry.name)]);
}

const lockPath = "demo/manifests/supply-chain/openclaw-agent-runtime-lock-v1.json";
const lock = JSON.parse(readFileSync(path.join(root, lockPath), "utf8"));
const lockedPaths = [...walk("demo/openclaw-agent"), "scripts/verify-openclaw-agent-runtime-lock.mjs"].sort();
lock.fixtureBuild.artifactSha256 = Object.fromEntries(lockedPaths.map((relative) => [relative, digest(relative)]));
writeJson(lockPath, lock);

const proofPath = "security/secure-default-proof-v1.json";
const proof = JSON.parse(readFileSync(path.join(root, proofPath), "utf8"));
const proofAdditions = [
  { path: "demo/openclaw-agent/gateway-state.mjs", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/mind-store.mjs", role: "IMPLEMENTATION" },
  { path: "tests/openclaw-gateway-state.test.mjs", role: "TEST" },
];
const byPath = new Map(proof.artifacts.map((artifact) => [artifact.path, artifact]));
for (const artifact of proofAdditions) if (!byPath.has(artifact.path)) byPath.set(artifact.path, artifact);
proof.artifacts = [...byPath.values()].map((artifact) => ({ ...artifact, sha256: digest(artifact.path) }));
proof.schemaBinding.sha256 = digest(proof.schemaBinding.path);
proof.verifier.sha256 = digest(proof.verifier.path);
writeJson(proofPath, proof);
writeJson("security/secure-default-proof-evidence-v1.json", buildSecureDefaultEvidence(proof));

const dagPath = "verification/verification-dag-v2.json";
const dag = JSON.parse(readFileSync(path.join(root, dagPath), "utf8"));
for (const node of dag.nodes) {
  node.inputs = node.inputs.map((input) => ({ ...input, sha256: digest(input.path) }));
}
writeJson(dagPath, dag);

const sumsPath = path.join(root, "SHA256SUMS");
const entries = new Map(readFileSync(sumsPath, "utf8").trimEnd().split("\n").map((line) => {
  const match = line.match(/^[a-f0-9]{64}  \.\/(.+)$/);
  if (!match) throw new Error(`INVALID_CHECKSUM_LINE:${line}`);
  return [match[1], null];
}));
for (const line of readFileSync(path.join(root, "release/public-files.manifest"), "utf8").split("\n")) {
  if (line && !line.startsWith("#")) entries.set(line.split("\t")[0], null);
}
for (const relative of ["scripts/refresh-integrity-data.mjs"]) entries.set(relative, null);
const output = [...entries.keys()].sort().map((relative) => {
  if (!statSync(path.join(root, relative)).isFile()) throw new Error(`CHECKSUM_TARGET_NOT_FILE:${relative}`);
  return `${digest(relative)}  ./${relative}`;
});
writeFileSync(sumsPath, `${output.join("\n")}\n`);
console.log(`refreshed ${lockedPaths.length} runtime-lock artifacts, ${proof.artifacts.length} proof artifacts, and ${entries.size} checksums`);
