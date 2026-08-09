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
const lockedPaths = [
  ...walk("demo/openclaw-agent"),
  "packages/contracts/src/canonical-json.js",
  "packages/contracts/src/capability-catalogue.ts",
  "scripts/verify-openclaw-agent-runtime-lock.mjs",
].sort();
lock.fixtureBuild.artifactSha256 = Object.fromEntries(lockedPaths.map((relative) => [relative, digest(relative)]));
writeJson(lockPath, lock);

const proofPath = "security/secure-default-proof-v1.json";
const proof = JSON.parse(readFileSync(path.join(root, proofPath), "utf8"));
const proofAdditions = [
  { path: "demo/manifests/supply-chain/openclaw-agent-runtime-lock-v1.json", role: "IMPLEMENTATION" },
  { path: "scripts/verify-openclaw-agent-runtime-lock.mjs", role: "VERIFIER" },
  { path: "demo/openclaw-agent/runtime-contract-v1.json", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/gateway-workload-contract-v2.json", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/plugin/identity-v2.mjs", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/gateway.mjs", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/gateway.Dockerfile", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/openclaw.Dockerfile", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/openclaw.json", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/plugin/index.mjs", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/plugin/response-v1.mjs", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/plugin/openclaw.plugin.json", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/plugin/package.json", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/capability-m1-4-adapter.mjs", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/gateway-state.mjs", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/mind-store.mjs", role: "IMPLEMENTATION" },
  { path: "packages/contracts/src/capability-catalogue.ts", role: "IMPLEMENTATION" },
  { path: "packages/contracts/src/canonical-json.ts", role: "IMPLEMENTATION" },
  { path: "packages/contracts/src/canonical-json.js", role: "IMPLEMENTATION" },
  { path: "tests/capability-catalogue.test.ts", role: "TEST" },
  { path: "tests/canonical-json-runtime-parity.test.mjs", role: "TEST" },
  { path: "tests/openclaw-agent-runtime-lock.test.mjs", role: "TEST" },
  { path: "tests/openclaw-agent-runtime.test.mjs", role: "TEST" },
  { path: "tests/openclaw-gateway-identity-network.test.mjs", role: "TEST" },
  { path: "tests/openclaw-gateway-state.test.mjs", role: "TEST" },
  { path: "tests/openclaw-m1.4-gateway-e2e.test.mjs", role: "TEST" },
  { path: "tests/helpers/openclaw-m1-4-harness.mjs", role: "TEST" },
  { path: "security/openclaw-m1.4-evidence-v1.json", role: "EVIDENCE" },
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
const bi004Node = dag.nodes.find(({ id }) => id === "bi-semantic-reconciliation-v1");
if (bi004Node === undefined) throw new Error("BI_004_DAG_NODE_MISSING");
const bi004Inputs = [
  ["packages/contracts/src/bi-semantic-reconciliation.ts", "CONTRACT"],
  ["schemas/contracts/bi-semantic-model-v1.schema.json", "SCHEMA"],
  ["tests/fixtures/bi-semantic/model-v1.json", "FIXTURE"],
  ["tests/fixtures/bi-semantic/positive-reconciliation-v1.json", "FIXTURE"],
  ["tests/bi-semantic-reconciliation.test.ts", "VALIDATOR"],
  ["docs/BI-SEMANTIC-RECONCILIATION-GUIDE.md", "DERIVED_EVIDENCE"],
  ["docs/development/bi-004-semantic-reconciliation-pdca.md", "DERIVED_EVIDENCE"],
  ["verification/bi-004-semantic-reconciliation-evidence-v1.json", "DERIVED_EVIDENCE"],
];
bi004Node.inputs = bi004Inputs.map(([inputPath, role]) => ({ path: inputPath, role, sha256: digest(inputPath) }));
const bi005Node = dag.nodes.find(({ id }) => id === "bi-dashboard-readback-v1");
if (bi005Node === undefined) throw new Error("BI_005_DAG_NODE_MISSING");
const bi005Inputs = [
  ["packages/contracts/src/bi-dashboard.ts", "CONTRACT"],
  ["schemas/contracts/bi-dashboard-v1.schema.json", "SCHEMA"],
  ["tests/fixtures/bi-dashboard/dashboard-set-v1.json", "FIXTURE"],
  ["tests/fixtures/bi-dashboard/request-v1.json", "FIXTURE"],
  ["tests/fixtures/bi-dashboard/negative-probes-v1.json", "FIXTURE"],
  ["tests/bi-dashboard.test.ts", "VALIDATOR"],
  ["scripts/render-bi-dashboard-evidence.mjs", "VALIDATOR"],
  ["docs/BI-DASHBOARD-READBACK-GUIDE.md", "DERIVED_EVIDENCE"],
  ["docs/development/bi-005-dashboard-readback-pdca.md", "DERIVED_EVIDENCE"],
  ["verification/bi-005-dashboard-evidence-v1.json", "DERIVED_EVIDENCE"],
  ...["normal", "empty", "stale", "conflict", "denied", "error"].map((state) => [`verification/bi-005-dashboard-readbacks/${state}.json`, "DERIVED_EVIDENCE"]),
];
bi005Node.inputs = bi005Inputs.map(([inputPath, role]) => ({ path: inputPath, role, sha256: digest(inputPath) }));
const m14Node = dag.nodes.find(({ id }) => id === "openclaw-m1-4");
if (m14Node === undefined) throw new Error("OPENCLAW_M1_4_DAG_NODE_MISSING");
const m14Inputs = [
  ["demo/manifests/supply-chain/openclaw-agent-runtime-lock-v1.json", "CONTRACT"],
  ["scripts/verify-openclaw-agent-runtime-lock.mjs", "VALIDATOR"],
  ["demo/openclaw-agent/runtime-contract-v1.json", "CONTRACT"],
  ["demo/openclaw-agent/gateway-workload-contract-v2.json", "CONTRACT"],
  ["demo/openclaw-agent/plugin/identity-v2.mjs", "SECURITY"],
  ["demo/openclaw-agent/gateway.mjs", "SOURCE"],
  ["demo/openclaw-agent/gateway-state.mjs", "SOURCE"],
  ["demo/openclaw-agent/gateway.Dockerfile", "SOURCE"],
  ["demo/openclaw-agent/openclaw.Dockerfile", "SOURCE"],
  ["demo/openclaw-agent/openclaw.json", "CONTRACT"],
  ["demo/openclaw-agent/plugin/index.mjs", "SOURCE"],
  ["demo/openclaw-agent/plugin/response-v1.mjs", "VALIDATOR"],
  ["demo/openclaw-agent/plugin/openclaw.plugin.json", "CONTRACT"],
  ["demo/openclaw-agent/plugin/package.json", "CONTRACT"],
  ["demo/openclaw-agent/capability-m1-4-adapter.mjs", "SOURCE"],
  ["packages/contracts/src/capability-catalogue.ts", "CONTRACT"],
  ["packages/contracts/src/canonical-json.ts", "CONTRACT"],
  ["packages/contracts/src/canonical-json.js", "SOURCE"],
  ["tests/capability-catalogue.test.ts", "VALIDATOR"],
  ["tests/canonical-json-runtime-parity.test.mjs", "VALIDATOR"],
  ["tests/openclaw-agent-runtime-lock.test.mjs", "VALIDATOR"],
  ["tests/openclaw-agent-runtime.test.mjs", "VALIDATOR"],
  ["tests/openclaw-gateway-identity-network.test.mjs", "VALIDATOR"],
  ["tests/openclaw-gateway-state.test.mjs", "VALIDATOR"],
  ["tests/openclaw-m1.4-gateway-e2e.test.mjs", "VALIDATOR"],
  ["tests/helpers/openclaw-m1-4-harness.mjs", "FIXTURE"],
  ["docs/OPENCLAW-BOUNDED-STATE-OPERATOR-GUIDE.md", "DERIVED_EVIDENCE"],
  ["docs/development/openclaw-m1.4-issue-7-pdca.md", "DERIVED_EVIDENCE"],
  ["security/openclaw-m1.4-evidence-v1.json", "DERIVED_EVIDENCE"],
];
m14Node.inputs = m14Inputs.map(([inputPath, role]) => ({ path: inputPath, role, sha256: digest(inputPath) }));
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
