#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildVerificationImpactPlanFailClosedV2,
  isSafeRepositoryPathV2,
} from "../dist/packages/contracts/src/verification-fabric-v2.js";

const DEFAULT_GRAPH_PATH = "verification/verification-dag-v2.json";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseArgs(argv) {
  const args = { base: "origin/main", head: "HEAD", graph: DEFAULT_GRAPH_PATH, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (!["--base", "--head", "--graph", "--output"].includes(option)) throw new Error("USAGE_DENIED");
    const value = argv[index + 1];
    if (!value) throw new Error("USAGE_DENIED");
    args[option.slice(2)] = value;
    index += 1;
  }
  if (!isSafeRepositoryPathV2(args.graph)) throw new Error("GRAPH_PATH_DENIED");
  return args;
}

function resolveCommit(root, reference) {
  return execFileSync("git", ["rev-parse", "--verify", `${reference}^{commit}`], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

function changedPaths(root, base, head) {
  return execFileSync("git", ["diff", "--name-only", "-z", `${base}...${head}`], {
    cwd: root,
    encoding: "utf8",
  }).split("\0").filter(Boolean);
}

function safeRead(root, relative) {
  if (!isSafeRepositoryPathV2(relative)) throw new Error("INPUT_PATH_DENIED");
  let cursor = root;
  for (const part of relative.split("/")) {
    cursor = path.join(cursor, part);
    if (lstatSync(cursor).isSymbolicLink()) throw new Error("INPUT_SYMLINK_DENIED");
  }
  const canonical = realpathSync(cursor);
  const fromRoot = path.relative(root, canonical);
  if (fromRoot.startsWith(`..${path.sep}`) || fromRoot === ".." || path.isAbsolute(fromRoot)) {
    throw new Error("INPUT_ESCAPE_DENIED");
  }
  return readFileSync(canonical);
}

export function computeVerificationPlan({ root = process.cwd(), argv = [] } = {}) {
  const canonicalRoot = realpathSync(root);
  let rawGraph = {};
  let graphPath = DEFAULT_GRAPH_PATH;
  let baseSha = "0".repeat(40);
  let headSha = "0".repeat(40);
  let diff = [];
  try {
    const args = parseArgs(argv);
    graphPath = args.graph;
    rawGraph = JSON.parse(safeRead(canonicalRoot, graphPath).toString("utf8"));
    baseSha = resolveCommit(canonicalRoot, args.base);
    headSha = resolveCommit(canonicalRoot, args.head);
    diff = changedPaths(canonicalRoot, baseSha, headSha);
    const observedInputDigests = {};
    for (const node of Array.isArray(rawGraph.nodes) ? rawGraph.nodes : []) {
      for (const input of Array.isArray(node.inputs) ? node.inputs : []) {
        if (typeof input.path === "string") observedInputDigests[input.path] = sha256(safeRead(canonicalRoot, input.path));
      }
    }
    const plan = buildVerificationImpactPlanFailClosedV2({
      graph: rawGraph,
      graphPath,
      baseSha,
      headSha,
      changedPaths: diff,
      observedInputDigests,
    });
    return { plan, output: args.output };
  } catch {
    const plan = buildVerificationImpactPlanFailClosedV2({
      graph: rawGraph,
      graphPath,
      baseSha,
      headSha,
      changedPaths: diff,
      observedInputDigests: {},
    }, () => { throw new Error("CLASSIFIER_FAILURE"); });
    return { plan, output: null };
  }
}

export function verificationPlanSummary(plan) {
  const reason = plan.reasons.length === 0 ? "none" : plan.reasons.join(",");
  return `Verification Fabric v2 Shadow: ${plan.mode}; nodes=${plan.selectedNodes.length}; tests=${plan.selectedTests.length}; hard-gates=${plan.hardGates.length}; reasons=${reason}; comparator=npm test`;
}

function main() {
  const { plan, output } = computeVerificationPlan({ argv: process.argv.slice(2) });
  const json = `${JSON.stringify(plan, null, 2)}\n`;
  if (output) writeFileSync(path.resolve(output), json, { flag: "wx" });
  process.stderr.write(`${verificationPlanSummary(plan)}\n`);
  process.stdout.write(json);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
