import assert from "node:assert/strict";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { verifySupplyChain } from "../scripts/verify-supply-chain.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = "demo/manifests/supply-chain/artifact-lock-v1.json";

async function fixture() {
  const target = await mkdtemp(path.join(tmpdir(), "cm-supply-chain-test-"));
  const lock = JSON.parse(await readFile(path.join(root, lockPath), "utf8"));
  const files = new Set([
    lockPath,
    "demo/chimpmaera.Dockerfile",
    "tools/video-production-reference/Dockerfile",
    "demo/compose.yaml",
    "tools/video-production-reference/compose.yaml",
    "demo/install.sh",
    "package.json",
    "package-lock.json",
    lock.ci.workflowPath,
    lock.publicClosure.manifestPath,
    ...lock.publicClosure.requiredPaths,
    ...lock.ociDeclarations.flatMap(({ locations }) =>
      locations.map(({ path: locationPath }) => locationPath)
    ),
  ]);
  for (const name of await (await import("node:fs/promises")).readdir(
    path.join(root, lock.runtimeClosure.directory),
  )) {
    if (name.endsWith(".mjs")) {
      files.add(`${lock.runtimeClosure.directory}/${name}`);
    }
  }
  for (const relative of files) {
    const destination = path.join(target, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(root, relative), destination);
  }
  return target;
}

async function mutate(relative, transform) {
  const target = await fixture();
  const file = path.join(target, relative);
  const source = await readFile(file, "utf8");
  await writeFile(file, transform(source));
  return target;
}

test("real repository declarations produce a bounded PASS report", async () => {
  const report = await verifySupplyChain({ root });
  assert.equal(report.status, "PASS");
  assert.match(report.lockDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual(report.checks, [
    "OCI_DECLARATIONS_PINNED",
    "NPM_LOCK_INTEGRITY_DECLARED",
    "CI_ACTIONS_AND_NPM_PINNED",
    "RUNTIME_COPY_CLOSURE_VERIFIED",
    "PUBLIC_RELEASE_CRITICAL_CLOSURE_VERIFIED",
    "RUNTIME_POSTURE_AND_PAPERLESS_NON_CLAIM_VERIFIED",
  ]);
  assert.match(report.claimBoundary, /not registry signature/i);
});

test("mutable OCI, npm integrity, CI ref, runtime omission and release omission deny", async () => {
  const cases = [
    [
      "demo/chimpmaera.Dockerfile",
      (source) => source.replace(
        /node:24\.14\.1-bookworm-slim@sha256:[a-f0-9]{64}/,
        "node:24.14.1-bookworm-slim",
      ),
      /SUPPLY_CHAIN_OCI_DECLARATION_DRIFT_DENIED/,
    ],
    [
      "package-lock.json",
      (source) => {
        const lock = JSON.parse(source);
        const key = Object.keys(lock.packages).find((value) => value !== "");
        delete lock.packages[key].integrity;
        return JSON.stringify(lock);
      },
      /SUPPLY_CHAIN_NPM_INTEGRITY_MISSING_DENIED/,
    ],
    [
      ".github/workflows/ci.yml",
      (source) => source.replace(/@[a-f0-9]{40}/, "@v4"),
      /SUPPLY_CHAIN_CI_ACTION_NOT_COMMIT_PINNED_DENIED/,
    ],
    [
      "demo/chimpmaera.Dockerfile",
      (source) => source.replace(
        /^COPY demo\/runtime\/policy-evaluator\.mjs.*\n/m,
        "",
      ),
      /SUPPLY_CHAIN_RUNTIME_COPY_CLOSURE_DENIED/,
    ],
    [
      "release/public-files.manifest",
      (source) => source.replace(
        /^demo\/runtime\/paperless-ngx-zoo-adapter\.mjs.*\n/m,
        "",
      ),
      /SUPPLY_CHAIN_PUBLIC_CLOSURE_MISSING_DENIED/,
    ],
  ];
  for (const [relative, transform, expected] of cases) {
    const target = await mutate(relative, transform);
    await assert.rejects(verifySupplyChain({ root: target }), expected);
  }
});

