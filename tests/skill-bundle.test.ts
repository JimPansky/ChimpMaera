import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  SKILL_BUNDLE_MANIFEST_SCHEMA_V1,
  assertSkillBundleCompatibilityV1,
  buildSkillBundleLockV1,
  canonicalJson,
  canonicalSkillBundleManifestBytesV1,
  defaultSkillBundleCompatibilityMatrixV1,
  normalizeSkillBundleManifestV1,
  verifySkillBundleExactFilesV1,
  verifySkillBundleLockV1,
  type SkillBundleFileInputV1,
  type SkillBundleManifestV1,
} from "../packages/contracts/src/index.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function manifest(): SkillBundleManifestV1 {
  return {
    schemaVersion: SKILL_BUNDLE_MANIFEST_SCHEMA_V1,
    bundleId: "skillbundle:zoo-greeter",
    version: "1.0.0",
    format: "OPENCLAW_SKILL",
    entrypoint: "SKILL.md",
    displayName: "Zoo Greeter",
    license: "Apache-2.0",
    publisher: "publisher:chimpmaera-local",
    source: {
      kind: "LOCAL_CONTENT",
      locator: `local+sha256:${sha256("zoo-greeter-source")}`,
      mutable: false,
    },
    files: [
      { path: "docs/usage.md", role: "DOC", mediaType: "text/markdown" },
      { path: "config/settings.json", role: "CONFIG", mediaType: "application/json" },
      { path: "tests/fixtures/greeting.txt", role: "TEST_FIXTURE", mediaType: "text/plain" },
      { path: "SKILL.md", role: "ENTRYPOINT", mediaType: "text/markdown" },
    ],
    dependencies: [
      {
        id: "dependency:local-policy",
        version: "1.0.0",
        digest: sha256("local-policy"),
        registry: "LOCAL_LOCK",
      },
    ],
    capabilityContracts: [
      {
        capabilityId: "capability:documents.read",
        version: "1.0.0",
        digest: sha256("documents-read"),
        activationState: "INACTIVE",
      },
    ],
    compatibility: defaultSkillBundleCompatibilityMatrixV1(),
    authority: {
      installation: "NO_AUTHORITY",
      activation: "NO_AUTHORITY",
      grantedCapabilities: [],
    },
    limitations: [
      "OPENCLAW_V1_ONLY_COMPATIBILITY",
      "NO_LIVE_REGISTRY_OR_SIGNATURE_PROOF",
      "DISCOVERY_OR_PRESENCE_IS_NOT_AUTHORITY",
      "LOCAL_DETERMINISTIC_CONTRACT_ONLY",
      "NO_INSTALLATION_OR_ACTIVATION_AUTHORITY",
    ],
  };
}

function files(): readonly SkillBundleFileInputV1[] {
  return [
    { path: "tests/fixtures/greeting.txt", bytes: "Hello from fixture\n" },
    { path: "SKILL.md", bytes: "# Zoo Greeter\n\nSay hello without requesting capabilities.\n" },
    { path: "config/settings.json", bytes: "{\"mode\":\"safe\"}\n" },
    { path: "docs/usage.md", bytes: "Use only after separate activation.\n" },
  ];
}

function mutate<T>(value: T, change: (draft: Record<string, any>) => void): unknown {
  const draft = structuredClone(value) as Record<string, any>;
  change(draft);
  return draft;
}

function reorder(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) {
    const mapped = value.map((entry, index) => reorder(entry, seed + index + 1));
    return seed % 2 === 0 ? mapped.reverse() : mapped.sort((left, right) =>
      canonicalJson(right).localeCompare(canonicalJson(left)));
  }
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value).map(([key, entry], index) => [key, reorder(entry, seed + index + 3)] as const);
    const ordered = seed % 3 === 0 ? entries.reverse() : entries.sort(([left], [right]) => right.localeCompare(left));
    return Object.fromEntries(ordered);
  }
  return value;
}

function writeMaterialized(root: string, material = files()): void {
  for (const file of material) {
    const target = path.join(root, file.path);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, file.bytes);
  }
}

test("ASF-01 schemas accept the canonical manifest and lock tuple", () => {
  const manifestSchema = JSON.parse(readFileSync(
    "schemas/contracts/skill-bundle-manifest-v1.schema.json", "utf8",
  )) as object;
  const lockSchema = JSON.parse(readFileSync(
    "schemas/contracts/skill-bundle-lock-v1.schema.json", "utf8",
  )) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(manifestSchema, "skill-bundle-manifest-v1.schema.json");
  const validateManifest = ajv.compile(manifestSchema);
  const validateLock = ajv.compile(lockSchema);
  const normalized = normalizeSkillBundleManifestV1(manifest());
  const lock = buildSkillBundleLockV1(manifest(), files());

  assert.equal(validateManifest(normalized), true, JSON.stringify(validateManifest.errors));
  assert.equal(validateLock(lock), true, JSON.stringify(validateLock.errors));
  assert.equal(verifySkillBundleLockV1(lock).lockIdentity, lock.lockIdentity);
  assert.match(lock.lockIdentity, /^[a-f0-9]{64}$/);
  assert.equal(lock.authority.activation, "NO_AUTHORITY");
  assert.deepEqual(lock.authority.grantedCapabilities, []);
});

test("ASF-01 100 meaningful reorder variants canonicalize to identical manifest bytes, digest and lock identity", () => {
  const baselineManifestBytes = canonicalSkillBundleManifestBytesV1(manifest());
  const baselineLock = buildSkillBundleLockV1(manifest(), files());
  for (let index = 0; index < 100; index += 1) {
    const variant = reorder(manifest(), index);
    const reorderedFiles = reorder(files(), index) as readonly SkillBundleFileInputV1[];
    const candidateManifestBytes = canonicalSkillBundleManifestBytesV1(variant);
    const candidateLock = buildSkillBundleLockV1(variant, reorderedFiles);
    assert.equal(candidateManifestBytes, baselineManifestBytes, `manifest-bytes-${index}`);
    assert.equal(candidateLock.manifestDigest, baselineLock.manifestDigest, `manifest-digest-${index}`);
    assert.equal(candidateLock.fileSetDigest, baselineLock.fileSetDigest, `file-set-${index}`);
    assert.equal(candidateLock.lockIdentity, baselineLock.lockIdentity, `lock-${index}`);
  }
});

test("ASF-01 exact-file verification binds all material bytes and emits sanitized evidence", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cm-skill-bundle-"));
  try {
    const lock = buildSkillBundleLockV1(manifest(), files());
    writeMaterialized(root);
    const evidence = verifySkillBundleExactFilesV1(lock, root);
    assert.equal(evidence.lockIdentity, lock.lockIdentity);
    assert.equal(evidence.fixtureCorpus.reorderVariants, 100);
    assert.equal(evidence.byteCoverage.files, 4);
    assert.equal(evidence.byteCoverage.materialBytes, files().reduce((sum, file) =>
      sum + Buffer.from(file.bytes).length, 0));
    assert.doesNotMatch(JSON.stringify(evidence), new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(JSON.stringify(evidence), /Hello from fixture|Zoo Greeter/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ASF-01 exact-file verification denies missing, extra, changed and symlink material", () => {
  const lock = buildSkillBundleLockV1(manifest(), files());
  const cases: readonly [string, (root: string) => void][] = [
    ["missing file", (root) => writeMaterialized(root, files().filter((file) => file.path !== "docs/usage.md"))],
    ["extra file", (root) => {
      writeMaterialized(root);
      writeFileSync(path.join(root, "extra.txt"), "extra");
    }],
    ["changed bytes", (root) => {
      writeMaterialized(root);
      writeFileSync(path.join(root, "SKILL.md"), "changed\n");
    }],
    ["symlink escape", (root) => {
      writeMaterialized(root, files().filter((file) => file.path !== "docs/usage.md"));
      mkdirSync(path.join(root, "docs"), { recursive: true });
      symlinkSync("/etc/passwd", path.join(root, "docs/usage.md"));
    }],
  ];
  for (const [label, prepare] of cases) {
    const root = mkdtempSync(path.join(tmpdir(), "cm-skill-bundle-negative-"));
    try {
      prepare(root);
      assert.throws(() => verifySkillBundleExactFilesV1(lock, root), /SKILL_BUNDLE_CONTRACT_INVALID_DENIED/, label);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("ASF-01 unresolved, mutable, ambiguous and digest-drift inputs fail closed", () => {
  const base = manifest();
  const lock = buildSkillBundleLockV1(base, files());
  const cases = [
    mutate(base, (draft) => { draft.unknown = true; }),
    mutate(base, (draft) => { draft.source.mutable = true; }),
    mutate(base, (draft) => { draft.source.locator = "local:latest"; }),
    mutate(base, (draft) => { draft.displayName = "${SKILL_NAME}"; }),
    mutate(base, (draft) => { draft.files.push({ ...draft.files[0], path: "skill.md" }); }),
    mutate(base, (draft) => { draft.files[0].path = "../escape.md"; }),
    mutate(base, (draft) => { draft.capabilityContracts[0].activationState = "ACTIVE"; }),
    mutate(lock, (draft) => { draft.files[0].sha256 = "0".repeat(64); }),
    mutate(lock, (draft) => { draft.source.locator = "skill-bundle:latest"; }),
    mutate(lock, (draft) => { draft.fileSetDigest = "0".repeat(64); }),
  ];
  for (const candidate of cases) assert.throws(
    () => {
      if ((candidate as Record<string, unknown>).schemaVersion === "chimpmaera.skill-bundle/lock/v1") {
        verifySkillBundleLockV1(candidate);
      } else {
        normalizeSkillBundleManifestV1(candidate);
      }
    },
    /SKILL_BUNDLE_CONTRACT_INVALID_DENIED/,
  );
});

test("ASF-01 compatibility matrix supports exact v1 OpenClaw consumers and denies drift to LKG", () => {
  const lock = buildSkillBundleLockV1(manifest(), files());
  for (const consumer of ["GENERATION", "ANALYSIS", "INSTALLATION", "ROLLBACK"] as const) {
    assert.equal(assertSkillBundleCompatibilityV1(lock, consumer, "OPENCLAW").consumer, consumer);
  }
  const negatives: readonly [string, () => void][] = [
    ["unsupported runtime", () => assertSkillBundleCompatibilityV1(lock, "INSTALLATION", "HERMES")],
    ["manifest major drift", () => assertSkillBundleCompatibilityV1(lock, "GENERATION", "OPENCLAW", "chimpmaera.skill-bundle/manifest/v2")],
    ["lock major drift", () => assertSkillBundleCompatibilityV1(lock, "ROLLBACK", "OPENCLAW", undefined, "chimpmaera.skill-bundle/lock/v2")],
    ["capability ambiguity", () => assertSkillBundleCompatibilityV1(
      mutate(lock, (draft) => { draft.compatibility.supported.pop(); }),
      "ROLLBACK",
      "OPENCLAW",
    )],
    ["minor widening", () => assertSkillBundleCompatibilityV1(
      mutate(lock, (draft) => { draft.compatibility.supported[0].manifestMinor = 1; }),
      "GENERATION",
      "OPENCLAW",
    )],
  ];
  for (const [label, run] of negatives) {
    assert.throws(run, /SKILL_BUNDLE_(?:COMPATIBILITY_DENIED_TO_LKG|CONTRACT_INVALID_DENIED)/, label);
  }
});
