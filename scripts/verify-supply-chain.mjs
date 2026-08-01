#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCK_PATH = "demo/manifests/supply-chain/artifact-lock-v1.json";

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fail(code) {
  throw new Error(code);
}

function assert(condition, code) {
  if (!condition) fail(code);
}

function safeRelative(relative) {
  assert(
    typeof relative === "string"
    && relative.length > 0
    && !path.isAbsolute(relative)
    && !relative.includes("\\")
    && !relative.includes("\0")
    && relative === relative.normalize("NFC")
    && !relative.split("/").some((part) => ["", ".", ".."].includes(part)),
    "SUPPLY_CHAIN_PATH_INVALID_DENIED",
  );
  return relative;
}

async function safeRootEntry(root, relative, expectedKind) {
  const checked = safeRelative(relative);
  let candidate = root;
  let metadata;
  for (const part of checked.split("/")) {
    candidate = path.join(candidate, part);
    try {
      metadata = await lstat(candidate);
    } catch {
      fail("SUPPLY_CHAIN_SOURCE_MISSING_DENIED");
    }
    assert(
      !metadata.isSymbolicLink(),
      "SUPPLY_CHAIN_SYMLINK_SOURCE_DENIED",
    );
  }
  const canonical = await realpath(candidate);
  const fromRoot = path.relative(root, canonical);
  assert(
    fromRoot !== ".."
    && !fromRoot.startsWith(`..${path.sep}`)
    && !path.isAbsolute(fromRoot),
    "SUPPLY_CHAIN_SOURCE_ESCAPE_DENIED",
  );
  assert(
    expectedKind === "directory" ? metadata.isDirectory() : metadata.isFile(),
    "SUPPLY_CHAIN_SOURCE_TYPE_INVALID_DENIED",
  );
  return candidate;
}

export async function verifySupplyChain({ root = process.cwd() } = {}) {
  const resolvedRoot = await realpath(path.resolve(root));
  const read = async (relative) => readFile(
    await safeRootEntry(resolvedRoot, relative, "file"),
    "utf8",
  );
  const lock = JSON.parse(await read(LOCK_PATH));
  assert(
    lock.schemaVersion === "chimpmaera.demo/supply-chain-artifact-lock/v1"
    && lock.lockId === "chimpmaera-v02-declared-inputs-v1"
    && /not registry signature/i.test(lock.claimBoundary)
    && /not .*SBOM/i.test(lock.claimBoundary),
    "SUPPLY_CHAIN_LOCK_INVALID_DENIED",
  );
  const checks = [];

  const lockedReferences = new Set();
  for (const artifact of lock.ociDeclarations ?? []) {
    assert(
      /^[^\s@]+@sha256:[a-f0-9]{64}$/.test(artifact.reference)
      && artifact.verification === "DECLARATION_PINNED_SIGNATURE_NOT_VERIFIED"
      && !lockedReferences.has(artifact.reference),
      "SUPPLY_CHAIN_OCI_LOCK_INVALID_DENIED",
    );
    lockedReferences.add(artifact.reference);
    for (const location of artifact.locations ?? []) {
      assert(
        ["FROM", "IMAGE"].includes(location.kind)
        && Number.isSafeInteger(location.occurrences)
        && location.occurrences > 0,
        "SUPPLY_CHAIN_OCI_LOCATION_INVALID_DENIED",
      );
      const source = await read(location.path);
      const occurrences = source.split(artifact.reference).length - 1;
      assert(
        occurrences === location.occurrences,
        "SUPPLY_CHAIN_OCI_DECLARATION_DRIFT_DENIED",
      );
    }
  }
  for (const dockerfilePath of [
    "demo/chimpmaera.Dockerfile",
    "demo/openclaw-agent/gateway.Dockerfile",
    "demo/openclaw-agent/openclaw.Dockerfile",
    "demo/model-access-broker/broker.Dockerfile",
    "demo/model-access-broker/frontdoor.Dockerfile",
    "demo/model-access-broker/openclaw.Dockerfile",
    "demo/model-access-broker/provider.Dockerfile",
    "demo/managed-skill-lifecycle/manager.Dockerfile",
    "demo/managed-skill-lifecycle/openclaw.Dockerfile",
    "tools/video-production-reference/Dockerfile",
  ]) {
    const source = await read(dockerfilePath);
    for (const match of source.matchAll(/^FROM\s+(\S+)/gm)) {
      assert(
        lockedReferences.has(match[1]),
        "SUPPLY_CHAIN_UNLOCKED_FROM_DENIED",
      );
    }
  }
  const localTags = new Set((lock.localBuildTags ?? []).map(({ reference }) => reference));
  for (const composePath of [
    "demo/compose.yaml",
    "demo/openclaw-agent/compose.yaml",
    "demo/model-access-broker/compose.yaml",
    "demo/managed-skill-lifecycle/compose.yaml",
    "tools/video-production-reference/compose.yaml",
  ]) {
    const source = await read(composePath);
    for (const match of source.matchAll(/^\s+image:\s+(.+)$/gm)) {
      const reference = match[1].trim();
      if (reference === "${CM_CHIMP_IMAGE}") continue;
      assert(
        lockedReferences.has(reference) || localTags.has(reference),
        "SUPPLY_CHAIN_UNLOCKED_COMPOSE_IMAGE_DENIED",
      );
    }
  }
  const installer = await read("demo/install.sh");
  assert(
    lock.runtimeResolvedImages?.length === 1
    && lock.runtimeResolvedImages[0].variable === "CM_CHIMP_IMAGE"
    && /docker image inspect chimpmaera\/v01-runtime:local/.test(installer)
    && /chimpmaera\/v01-runtime@sha256:\*/.test(installer)
    && /sha256:\*/.test(installer),
    "SUPPLY_CHAIN_RUNTIME_IMAGE_RESOLUTION_INVALID_DENIED",
  );
  checks.push("OCI_DECLARATIONS_PINNED");

  const packageJson = JSON.parse(await read("package.json"));
  const packageLock = JSON.parse(await read("package-lock.json"));
  assert(
    packageJson.packageManager === lock.npm?.packageManager
    && packageLock.lockfileVersion === lock.npm?.lockfileVersion,
    "SUPPLY_CHAIN_NPM_VERSION_DRIFT_DENIED",
  );
  for (const [packagePath, metadata] of Object.entries(packageLock.packages ?? {})) {
    if (packagePath === "") continue;
    assert(
      typeof metadata.integrity === "string"
      && /^sha(?:256|384|512)-[A-Za-z0-9+/=]+$/.test(metadata.integrity),
      "SUPPLY_CHAIN_NPM_INTEGRITY_MISSING_DENIED",
    );
  }
  checks.push("NPM_LOCK_INTEGRITY_DECLARED");

  const workflow = await read(lock.ci.workflowPath);
  const actions = [...workflow.matchAll(/^\s*uses:\s*\S+@([^\s#]+)/gm)];
  assert(
    actions.length > 0
    && actions.every((match) => /^[a-f0-9]{40}$/.test(match[1])),
    "SUPPLY_CHAIN_CI_ACTION_NOT_COMMIT_PINNED_DENIED",
  );
  const npmVersion = lock.npm.packageManager.replace(/^npm@/, "");
  assert(
    workflow.includes(`npm install --global npm@${npmVersion}`),
    "SUPPLY_CHAIN_CI_NPM_VERSION_DRIFT_DENIED",
  );
  checks.push("CI_ACTIONS_AND_NPM_PINNED");

  const runtimeDirectory = await safeRootEntry(
    resolvedRoot,
    lock.runtimeClosure.directory,
    "directory",
  );
  const runtimeFiles = (await readdir(runtimeDirectory))
    .filter((name) => name.endsWith(".mjs"))
    .sort();
  for (const runtimeFile of runtimeFiles) {
    await safeRootEntry(
      resolvedRoot,
      `${lock.runtimeClosure.directory}/${runtimeFile}`,
      "file",
    );
  }
  const dockerfile = await read(lock.runtimeClosure.dockerfile);
  const copiedRuntimeFiles = [...dockerfile.matchAll(
    /^COPY demo\/runtime\/([^\s]+)\s+\.\/[^\s]+$/gm,
  )].map((match) => match[1]).sort();
  assert(
    canonicalJson(runtimeFiles) === canonicalJson(copiedRuntimeFiles),
    "SUPPLY_CHAIN_RUNTIME_COPY_CLOSURE_DENIED",
  );
  checks.push("RUNTIME_COPY_CLOSURE_VERIFIED");

  const manifestText = await read(lock.publicClosure.manifestPath);
  const publicSources = new Set();
  for (const line of manifestText.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const fields = line.split("\t");
    assert(
      fields.length === 3
      && fields[0] === fields[1]
      && ["0644", "0755"].includes(fields[2])
      && !publicSources.has(fields[0]),
      "SUPPLY_CHAIN_PUBLIC_MANIFEST_INVALID_DENIED",
    );
    const source = safeRelative(fields[0]);
    await safeRootEntry(resolvedRoot, source, "file");
    publicSources.add(source);
  }
  for (const required of lock.publicClosure.requiredPaths ?? []) {
    assert(publicSources.has(required), "SUPPLY_CHAIN_PUBLIC_CLOSURE_MISSING_DENIED");
    await safeRootEntry(resolvedRoot, required, "file");
  }
  assert(
    ![...publicSources].some((source) => source.startsWith("docs/development/")),
    "SUPPLY_CHAIN_DEVELOPMENT_EVIDENCE_PUBLIC_DENIED",
  );
  checks.push("PUBLIC_RELEASE_CRITICAL_CLOSURE_VERIFIED");

  const compose = await read("demo/compose.yaml");
  assert(
    /read_only:\s+true/.test(compose)
    && /cap_drop:\s+\[ALL\]/.test(compose)
    && /no-new-privileges:true/.test(compose)
    && !/^\s{2}paperless:/m.test(compose)
    && lock.paperless.status === "ADAPTER_ONLY_NO_OCI_ARTIFACT"
    && lock.paperless.stockComposeEnabled === false,
    "SUPPLY_CHAIN_RUNTIME_POSTURE_DRIFT_DENIED",
  );
  checks.push("RUNTIME_POSTURE_AND_PAPERLESS_NON_CLAIM_VERIFIED");

  return {
    schemaVersion: "chimpmaera.demo/supply-chain-verification-report/v1",
    status: "PASS",
    lockId: lock.lockId,
    lockDigest: digest(canonicalJson(lock)),
    checks,
    claimBoundary: lock.claimBoundary,
  };
}

const invokedPath = process.argv[1] === undefined
  ? ""
  : path.resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 0) fail("SUPPLY_CHAIN_ARGUMENT_INVALID_DENIED");
    process.stdout.write(`${JSON.stringify(await verifySupplyChain(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      schemaVersion: "chimpmaera.demo/supply-chain-verification-report/v1",
      status: "FAIL",
      code: error?.message ?? "SUPPLY_CHAIN_VERIFICATION_FAILED_DENIED",
    })}\n`);
    process.exitCode = 1;
  }
}
