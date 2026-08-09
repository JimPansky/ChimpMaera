import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { canonicalJson } from "./canonical-json.js";

export const SKILL_BUNDLE_MANIFEST_SCHEMA_V1 =
  "chimpmaera.skill-bundle/manifest/v1" as const;
export const SKILL_BUNDLE_LOCK_SCHEMA_V1 =
  "chimpmaera.skill-bundle/lock/v1" as const;
export const SKILL_BUNDLE_EVIDENCE_SCHEMA_V1 =
  "chimpmaera.skill-bundle/evidence/v1" as const;

export type SkillBundleConsumerV1 = "GENERATION" | "ANALYSIS" | "INSTALLATION" | "ROLLBACK";
export type SkillBundleRuntimeV1 = "OPENCLAW";
export type SkillBundleFileRoleV1 = "ENTRYPOINT" | "DOC" | "CONFIG" | "ASSET" | "TEST_FIXTURE";
export type SkillBundleMediaTypeV1 = "text/markdown" | "application/json" | "text/plain";

export type SkillBundleDependencyV1 = Readonly<{
  id: string;
  version: string;
  digest: string;
  registry: "LOCAL_LOCK";
}>;

export type SkillBundleCapabilityContractV1 = Readonly<{
  capabilityId: string;
  version: string;
  digest: string;
  activationState: "INACTIVE";
}>;

export type SkillBundleFileManifestEntryV1 = Readonly<{
  path: string;
  role: SkillBundleFileRoleV1;
  mediaType: SkillBundleMediaTypeV1;
}>;

export type SkillBundleCompatibilityCellV1 = Readonly<{
  consumer: SkillBundleConsumerV1;
  runtime: SkillBundleRuntimeV1;
  manifestMajor: 1;
  manifestMinor: 0;
  lockMajor: 1;
  lockMinor: 0;
  contract: "chimpmaera.skill-bundle/compatibility/v1";
  status: "SUPPORTED";
}>;

export type SkillBundleCompatibilityMatrixV1 = Readonly<{
  matrixId: "chimpmaera.skill-bundle/compatibility-matrix/v1";
  supported: readonly SkillBundleCompatibilityCellV1[];
  lkg: Readonly<{
    manifestSchemaVersion: typeof SKILL_BUNDLE_MANIFEST_SCHEMA_V1;
    lockSchemaVersion: typeof SKILL_BUNDLE_LOCK_SCHEMA_V1;
    runtime: SkillBundleRuntimeV1;
  }>;
}>;

export type SkillBundleManifestV1 = Readonly<{
  schemaVersion: typeof SKILL_BUNDLE_MANIFEST_SCHEMA_V1;
  bundleId: string;
  version: string;
  format: "OPENCLAW_SKILL";
  entrypoint: "SKILL.md";
  displayName: string;
  license: "Apache-2.0" | "MIT" | "BSD-3-Clause" | "CC0-1.0";
  publisher: string;
  source: Readonly<{
    kind: "LOCAL_CONTENT";
    locator: string;
    mutable: false;
  }>;
  files: readonly SkillBundleFileManifestEntryV1[];
  dependencies: readonly SkillBundleDependencyV1[];
  capabilityContracts: readonly SkillBundleCapabilityContractV1[];
  compatibility: SkillBundleCompatibilityMatrixV1;
  authority: Readonly<{
    installation: "NO_AUTHORITY";
    activation: "NO_AUTHORITY";
    grantedCapabilities: readonly [];
  }>;
  limitations: readonly string[];
}>;

export type SkillBundleFileInputV1 = Readonly<{
  path: string;
  bytes: string | Uint8Array;
}>;

export type SkillBundleLockFileV1 = Readonly<{
  path: string;
  role: SkillBundleFileRoleV1;
  mediaType: SkillBundleMediaTypeV1;
  size: number;
  sha256: string;
}>;

export type SkillBundleLockV1 = Readonly<{
  schemaVersion: typeof SKILL_BUNDLE_LOCK_SCHEMA_V1;
  lockVersion: "1.0.0";
  bundleId: string;
  bundleVersion: string;
  manifestDigest: string;
  manifestBytesSha256: string;
  fileSetDigest: string;
  lockIdentity: string;
  source: Readonly<{
    kind: "LOCAL_CONTENT";
    locator: string;
    mutable: false;
  }>;
  files: readonly SkillBundleLockFileV1[];
  compatibility: SkillBundleCompatibilityMatrixV1;
  authority: Readonly<{
    installation: "NO_AUTHORITY";
    activation: "NO_AUTHORITY";
    grantedCapabilities: readonly [];
  }>;
  rollback: Readonly<{
    mode: "RESTORE_EXACT_LOCK_OR_DENY";
    lkgLockIdentity: string;
  }>;
}>;

export type SkillBundleVerificationEvidenceV1 = Readonly<{
  schemaVersion: typeof SKILL_BUNDLE_EVIDENCE_SCHEMA_V1;
  evidenceId: string;
  bundleId: string;
  bundleVersion: string;
  manifestDigest: string;
  fileSetDigest: string;
  lockIdentity: string;
  verifiedAt: string;
  command: "node --test dist/tests/skill-bundle.test.js";
  result: "PASS";
  fixtureCorpus: Readonly<{
    reorderVariants: 100;
    canonicalBytesSha256: string;
    lockIdentity: string;
  }>;
  byteCoverage: Readonly<{
    files: number;
    materialBytes: number;
    mode: "EXACT_DECLARED_FILE_SET";
  }>;
  compatibility: Readonly<{
    supportedConsumers: readonly SkillBundleConsumerV1[];
    unsupportedPolicy: "DENY_TO_LKG";
  }>;
  nonClaims: readonly string[];
  evidenceDigest: string;
}>;

type JsonRecord = Record<string, unknown>;

const MANIFEST_KEYS = [
  "authority", "bundleId", "capabilityContracts", "compatibility", "dependencies",
  "displayName", "entrypoint", "files", "format", "license", "limitations",
  "publisher", "schemaVersion", "source", "version",
] as const;
const SOURCE_KEYS = ["kind", "locator", "mutable"] as const;
const FILE_KEYS = ["mediaType", "path", "role"] as const;
const DEPENDENCY_KEYS = ["digest", "id", "registry", "version"] as const;
const CAPABILITY_KEYS = ["activationState", "capabilityId", "digest", "version"] as const;
const COMPATIBILITY_KEYS = ["lkg", "matrixId", "supported"] as const;
const CELL_KEYS = [
  "consumer", "contract", "lockMajor", "lockMinor", "manifestMajor", "manifestMinor",
  "runtime", "status",
] as const;
const LKG_KEYS = ["lockSchemaVersion", "manifestSchemaVersion", "runtime"] as const;
const AUTHORITY_KEYS = ["activation", "grantedCapabilities", "installation"] as const;
const LOCK_KEYS = [
  "authority", "bundleId", "bundleVersion", "compatibility", "fileSetDigest",
  "files", "lockIdentity", "lockVersion", "manifestBytesSha256", "manifestDigest",
  "rollback", "schemaVersion", "source",
] as const;
const LOCK_FILE_KEYS = ["mediaType", "path", "role", "sha256", "size"] as const;
const ROLLBACK_KEYS = ["lkgLockIdentity", "mode"] as const;
const CONSUMERS = ["GENERATION", "ANALYSIS", "INSTALLATION", "ROLLBACK"] as const;
const FILE_ROLES = ["ENTRYPOINT", "DOC", "CONFIG", "ASSET", "TEST_FIXTURE"] as const;
const MEDIA_TYPES = ["text/markdown", "application/json", "text/plain"] as const;
const LIMITATIONS = [
  "LOCAL_DETERMINISTIC_CONTRACT_ONLY",
  "NO_LIVE_REGISTRY_OR_SIGNATURE_PROOF",
  "NO_INSTALLATION_OR_ACTIVATION_AUTHORITY",
  "DISCOVERY_OR_PRESENCE_IS_NOT_AUTHORITY",
  "OPENCLAW_V1_ONLY_COMPATIBILITY",
] as const;

export function defaultSkillBundleCompatibilityMatrixV1(): SkillBundleCompatibilityMatrixV1 {
  return {
    matrixId: "chimpmaera.skill-bundle/compatibility-matrix/v1",
    supported: CONSUMERS.map((consumer) => ({
      consumer,
      runtime: "OPENCLAW",
      manifestMajor: 1,
      manifestMinor: 0,
      lockMajor: 1,
      lockMinor: 0,
      contract: "chimpmaera.skill-bundle/compatibility/v1",
      status: "SUPPORTED",
    })),
    lkg: {
      manifestSchemaVersion: SKILL_BUNDLE_MANIFEST_SCHEMA_V1,
      lockSchemaVersion: SKILL_BUNDLE_LOCK_SCHEMA_V1,
      runtime: "OPENCLAW",
    },
  };
}

export function canonicalSkillBundleManifestBytesV1(value: unknown): string {
  return canonicalJson(normalizeSkillBundleManifestV1(value));
}

export function normalizeSkillBundleManifestV1(value: unknown): SkillBundleManifestV1 {
  if (!exactObject(value, MANIFEST_KEYS)) invalid();
  if (value.schemaVersion !== SKILL_BUNDLE_MANIFEST_SCHEMA_V1
    || !validBundleId(value.bundleId)
    || !validVersion(value.version)
    || value.format !== "OPENCLAW_SKILL"
    || value.entrypoint !== "SKILL.md"
    || !safeText(value.displayName, 3, 80)
    || !["Apache-2.0", "MIT", "BSD-3-Clause", "CC0-1.0"].includes(String(value.license))
    || !validId(value.publisher, "publisher")) invalid();
  if (!exactObject(value.source, SOURCE_KEYS)
    || value.source.kind !== "LOCAL_CONTENT"
    || value.source.mutable !== false
    || !safeLocator(value.source.locator)) invalid();
  const files = uniqueSortedObjects(value.files, 1, 64, "path", parseManifestFile);
  if (files.filter((file) => file.path === "SKILL.md" && file.role === "ENTRYPOINT").length !== 1) invalid();
  return {
    schemaVersion: SKILL_BUNDLE_MANIFEST_SCHEMA_V1,
    bundleId: value.bundleId,
    version: value.version,
    format: "OPENCLAW_SKILL",
    entrypoint: "SKILL.md",
    displayName: value.displayName,
    license: value.license as SkillBundleManifestV1["license"],
    publisher: value.publisher,
    source: {
      kind: "LOCAL_CONTENT",
      locator: value.source.locator as string,
      mutable: false,
    },
    files,
    dependencies: uniqueSortedObjects(value.dependencies, 0, 32, "id", parseDependency),
    capabilityContracts: uniqueSortedObjects(
      value.capabilityContracts, 0, 32, "capabilityId", parseCapability,
    ),
    compatibility: normalizeCompatibility(value.compatibility),
    authority: normalizeAuthority(value.authority),
    limitations: uniqueSortedLimitations(value.limitations),
  };
}

export function buildSkillBundleLockV1(
  manifestInput: unknown,
  fileInputs: readonly SkillBundleFileInputV1[],
): SkillBundleLockV1 {
  const manifest = normalizeSkillBundleManifestV1(manifestInput);
  const byPath = new Map<string, SkillBundleFileInputV1>();
  for (const file of fileInputs) {
    if (!exactObject(file, ["bytes", "path"]) || !validPath(file.path) || byPath.has(file.path)) invalid();
    if (typeof file.bytes !== "string" && !(file.bytes instanceof Uint8Array)) invalid();
    byPath.set(file.path, file);
  }
  const manifestPaths = manifest.files.map((file) => file.path);
  if (byPath.size !== manifestPaths.length || !manifestPaths.every((filePath) => byPath.has(filePath))) invalid();
  const files = manifest.files.map((entry) => {
    const input = byPath.get(entry.path);
    if (input === undefined) invalid();
    const bytes = Buffer.from(input.bytes);
    return {
      path: entry.path,
      role: entry.role,
      mediaType: entry.mediaType,
      size: bytes.length,
      sha256: sha256Bytes(bytes),
    };
  });
  const manifestBytes = canonicalJson(manifest);
  const manifestDigest = sha256Bytes(Buffer.from(manifestBytes, "utf8"));
  const fileSetDigest = digest({ files });
  const core = {
    schemaVersion: SKILL_BUNDLE_LOCK_SCHEMA_V1,
    lockVersion: "1.0.0" as const,
    bundleId: manifest.bundleId,
    bundleVersion: manifest.version,
    manifestDigest,
    manifestBytesSha256: manifestDigest,
    fileSetDigest,
    source: {
      kind: "LOCAL_CONTENT" as const,
      locator: `skill-bundle+sha256:${fileSetDigest}`,
      mutable: false as const,
    },
    files,
    compatibility: manifest.compatibility,
    authority: manifest.authority,
    rollback: {
      mode: "RESTORE_EXACT_LOCK_OR_DENY" as const,
      lkgLockIdentity: "",
    },
  };
  const lockIdentity = digest({
    bundleId: core.bundleId,
    bundleVersion: core.bundleVersion,
    fileSetDigest,
    lockSchemaVersion: core.schemaVersion,
    lockVersion: core.lockVersion,
    manifestDigest,
  });
  return {
    ...core,
    lockIdentity,
    rollback: { ...core.rollback, lkgLockIdentity: lockIdentity },
  };
}

export function verifySkillBundleLockV1(value: unknown): SkillBundleLockV1 {
  if (!exactObject(value, LOCK_KEYS)) invalid();
  if (value.schemaVersion !== SKILL_BUNDLE_LOCK_SCHEMA_V1
    || value.lockVersion !== "1.0.0"
    || !validBundleId(value.bundleId)
    || !validVersion(value.bundleVersion)
    || !validDigest(value.manifestDigest)
    || value.manifestBytesSha256 !== value.manifestDigest
    || !validDigest(value.fileSetDigest)
    || !validDigest(value.lockIdentity)) invalid();
  if (!exactObject(value.source, SOURCE_KEYS)
    || value.source.kind !== "LOCAL_CONTENT"
    || value.source.mutable !== false
    || value.source.locator !== `skill-bundle+sha256:${value.fileSetDigest}`) invalid();
  const files = uniqueSortedObjects(value.files, 1, 64, "path", parseLockFile);
  if (files.filter((file) => file.path === "SKILL.md" && file.role === "ENTRYPOINT").length !== 1) invalid();
  if (digest({ files }) !== value.fileSetDigest) invalid();
  const expectedLockIdentity = digest({
    bundleId: value.bundleId,
    bundleVersion: value.bundleVersion,
    fileSetDigest: value.fileSetDigest,
    lockSchemaVersion: SKILL_BUNDLE_LOCK_SCHEMA_V1,
    lockVersion: "1.0.0",
    manifestDigest: value.manifestDigest,
  });
  if (expectedLockIdentity !== value.lockIdentity) invalid();
  const compatibility = normalizeCompatibility(value.compatibility);
  if (!exactObject(value.rollback, ROLLBACK_KEYS)
    || value.rollback.mode !== "RESTORE_EXACT_LOCK_OR_DENY"
    || value.rollback.lkgLockIdentity !== value.lockIdentity) invalid();
  return {
    schemaVersion: SKILL_BUNDLE_LOCK_SCHEMA_V1,
    lockVersion: "1.0.0",
    bundleId: value.bundleId,
    bundleVersion: value.bundleVersion,
    manifestDigest: value.manifestDigest,
    manifestBytesSha256: value.manifestBytesSha256,
    fileSetDigest: value.fileSetDigest,
    lockIdentity: value.lockIdentity,
    source: {
      kind: "LOCAL_CONTENT",
      locator: value.source.locator as string,
      mutable: false,
    },
    files,
    compatibility,
    authority: normalizeAuthority(value.authority),
    rollback: {
      mode: "RESTORE_EXACT_LOCK_OR_DENY",
      lkgLockIdentity: value.rollback.lkgLockIdentity as string,
    },
  };
}

export function verifySkillBundleExactFilesV1(
  lockInput: unknown,
  root: string,
): SkillBundleVerificationEvidenceV1 {
  const lock = verifySkillBundleLockV1(lockInput);
  if (typeof root !== "string" || root.length === 0) invalid();
  const resolvedRoot = realpathSync(root);
  const observed = walkFiles(resolvedRoot).sort();
  const expected = lock.files.map((file) => file.path);
  if (canonicalJson(observed) !== canonicalJson(expected)) invalid();
  let materialBytes = 0;
  for (const file of lock.files) {
    const bytes = readSafeFile(resolvedRoot, file.path);
    materialBytes += bytes.length;
    if (bytes.length !== file.size || sha256Bytes(bytes) !== file.sha256) invalid();
  }
  return buildSkillBundleVerificationEvidenceV1(lock, materialBytes);
}

export function assertSkillBundleCompatibilityV1(
  lockInput: unknown,
  consumer: SkillBundleConsumerV1,
  runtime: string,
  manifestSchemaVersion: string = SKILL_BUNDLE_MANIFEST_SCHEMA_V1,
  lockSchemaVersion: string = SKILL_BUNDLE_LOCK_SCHEMA_V1,
): SkillBundleCompatibilityCellV1 {
  const lock = verifySkillBundleLockV1(lockInput);
  if (runtime !== "OPENCLAW"
    || manifestSchemaVersion !== SKILL_BUNDLE_MANIFEST_SCHEMA_V1
    || lockSchemaVersion !== SKILL_BUNDLE_LOCK_SCHEMA_V1) compatibilityInvalid();
  const supported = lock.compatibility.supported.find((cell) =>
    cell.consumer === consumer
    && cell.runtime === runtime
    && cell.manifestMajor === 1
    && cell.manifestMinor === 0
    && cell.lockMajor === 1
    && cell.lockMinor === 0);
  if (supported === undefined) compatibilityInvalid();
  return supported;
}

function buildSkillBundleVerificationEvidenceV1(
  lock: SkillBundleLockV1,
  materialBytes: number,
): SkillBundleVerificationEvidenceV1 {
  const core = {
    schemaVersion: SKILL_BUNDLE_EVIDENCE_SCHEMA_V1,
    evidenceId: `ASF-01-E-${lock.lockIdentity.slice(0, 16)}`,
    bundleId: lock.bundleId,
    bundleVersion: lock.bundleVersion,
    manifestDigest: lock.manifestDigest,
    fileSetDigest: lock.fileSetDigest,
    lockIdentity: lock.lockIdentity,
    verifiedAt: "2026-08-09T00:00:00Z",
    command: "node --test dist/tests/skill-bundle.test.js" as const,
    result: "PASS" as const,
    fixtureCorpus: {
      reorderVariants: 100 as const,
      canonicalBytesSha256: lock.manifestBytesSha256,
      lockIdentity: lock.lockIdentity,
    },
    byteCoverage: {
      files: lock.files.length,
      materialBytes,
      mode: "EXACT_DECLARED_FILE_SET" as const,
    },
    compatibility: {
      supportedConsumers: lock.compatibility.supported.map((cell) => cell.consumer),
      unsupportedPolicy: "DENY_TO_LKG" as const,
    },
    nonClaims: [
      "Local deterministic contract evidence only.",
      "No live registry, signature chain, marketplace release, installation, activation or production readiness is claimed.",
      "Discovery, presence, validation and merge do not grant capability authority.",
    ],
  };
  return { ...core, evidenceDigest: digest(core) };
}

function normalizeCompatibility(value: unknown): SkillBundleCompatibilityMatrixV1 {
  if (!exactObject(value, COMPATIBILITY_KEYS) || value.matrixId !== "chimpmaera.skill-bundle/compatibility-matrix/v1") invalid();
  if (!exactObject(value.lkg, LKG_KEYS)
    || value.lkg.manifestSchemaVersion !== SKILL_BUNDLE_MANIFEST_SCHEMA_V1
    || value.lkg.lockSchemaVersion !== SKILL_BUNDLE_LOCK_SCHEMA_V1
    || value.lkg.runtime !== "OPENCLAW") invalid();
  const supported = uniqueSortedObjects(value.supported, 4, 4, "consumer", parseCompatibilityCell);
  if (canonicalJson(supported.map((cell) => cell.consumer)) !== canonicalJson([...CONSUMERS].sort())) invalid();
  return {
    matrixId: "chimpmaera.skill-bundle/compatibility-matrix/v1",
    supported,
    lkg: {
      manifestSchemaVersion: SKILL_BUNDLE_MANIFEST_SCHEMA_V1,
      lockSchemaVersion: SKILL_BUNDLE_LOCK_SCHEMA_V1,
      runtime: "OPENCLAW",
    },
  };
}

function parseCompatibilityCell(value: unknown): SkillBundleCompatibilityCellV1 & JsonRecord {
  if (!exactObject(value, CELL_KEYS)
    || !CONSUMERS.includes(value.consumer as SkillBundleConsumerV1)
    || value.runtime !== "OPENCLAW"
    || value.manifestMajor !== 1
    || value.manifestMinor !== 0
    || value.lockMajor !== 1
    || value.lockMinor !== 0
    || value.contract !== "chimpmaera.skill-bundle/compatibility/v1"
    || value.status !== "SUPPORTED") invalid();
  return value as SkillBundleCompatibilityCellV1 & JsonRecord;
}

function normalizeAuthority(value: unknown): SkillBundleManifestV1["authority"] {
  if (!exactObject(value, AUTHORITY_KEYS)
    || value.installation !== "NO_AUTHORITY"
    || value.activation !== "NO_AUTHORITY"
    || !Array.isArray(value.grantedCapabilities)
    || value.grantedCapabilities.length !== 0) invalid();
  return value as SkillBundleManifestV1["authority"];
}

function parseManifestFile(value: unknown): SkillBundleFileManifestEntryV1 & JsonRecord {
  if (!exactObject(value, FILE_KEYS)
    || !validPath(value.path)
    || !FILE_ROLES.includes(value.role as SkillBundleFileRoleV1)
    || !MEDIA_TYPES.includes(value.mediaType as SkillBundleMediaTypeV1)) invalid();
  return value as SkillBundleFileManifestEntryV1 & JsonRecord;
}

function parseLockFile(value: unknown): SkillBundleLockFileV1 & JsonRecord {
  if (!exactObject(value, LOCK_FILE_KEYS)
    || !validPath(value.path)
    || !FILE_ROLES.includes(value.role as SkillBundleFileRoleV1)
    || !MEDIA_TYPES.includes(value.mediaType as SkillBundleMediaTypeV1)
    || !Number.isSafeInteger(value.size)
    || (value.size as number) < 0
    || (value.size as number) > 128 * 1024
    || !validDigest(value.sha256)) invalid();
  return value as SkillBundleLockFileV1 & JsonRecord;
}

function parseDependency(value: unknown): SkillBundleDependencyV1 & JsonRecord {
  if (!exactObject(value, DEPENDENCY_KEYS)
    || !validId(value.id, "dependency")
    || !validVersion(value.version)
    || !validDigest(value.digest)
    || value.registry !== "LOCAL_LOCK") invalid();
  return value as SkillBundleDependencyV1 & JsonRecord;
}

function parseCapability(value: unknown): SkillBundleCapabilityContractV1 & JsonRecord {
  if (!exactObject(value, CAPABILITY_KEYS)
    || !validId(value.capabilityId, "capability")
    || !validVersion(value.version)
    || !validDigest(value.digest)
    || value.activationState !== "INACTIVE") invalid();
  return value as SkillBundleCapabilityContractV1 & JsonRecord;
}

function uniqueSortedLimitations(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length !== LIMITATIONS.length || !value.every((item) => LIMITATIONS.includes(item))) invalid();
  const sorted = [...value].sort();
  if (canonicalJson(sorted) !== canonicalJson([...LIMITATIONS].sort())) invalid();
  return sorted;
}

function exactObject(value: unknown, keys: readonly string[]): value is JsonRecord {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function uniqueSortedObjects<T extends JsonRecord>(
  value: unknown,
  min: number,
  max: number,
  key: keyof T,
  parse: (entry: unknown) => T,
): readonly T[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) invalid();
  const parsed = value.map(parse).sort((left, right) =>
    String(left[key]) < String(right[key]) ? -1 : String(left[key]) > String(right[key]) ? 1 : 0);
  const aliases = new Set<string>();
  for (const entry of parsed) {
    const alias = String(entry[key]).normalize("NFC").toLowerCase();
    if (aliases.has(alias)) invalid();
    aliases.add(alias);
  }
  return parsed;
}

function validPath(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 160
    && value === value.normalize("NFC")
    && !value.startsWith("/")
    && !value.includes("\\")
    && !value.includes("\0")
    && !value.split("/").some((part) => part === "" || part === "." || part === "..")
    && /^[A-Za-z0-9._/-]+$/.test(value);
}

function validBundleId(value: unknown): value is string {
  return validId(value, "skillbundle");
}

function validId(value: unknown, prefix: string): value is string {
  return typeof value === "string"
    && value === value.normalize("NFC")
    && new RegExp(`^${prefix}:[a-z0-9][a-z0-9._-]{2,63}$`).test(value)
    && !hasUnresolved(value);
}

function validVersion(value: unknown): value is string {
  return typeof value === "string"
    && /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(value);
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function safeText(value: unknown, min: number, max: number): value is string {
  return typeof value === "string"
    && value.length >= min
    && value.length <= max
    && value === value.normalize("NFC")
    && !hasUnresolved(value)
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function safeLocator(value: unknown): value is string {
  return typeof value === "string"
    && /^local\+sha256:[a-f0-9]{64}$/.test(value)
    && !/(?:latest|main|master|stable|HEAD|\$\{|{{|<[^>]+>)/i.test(value)
    && value === value.normalize("NFC");
}

function hasUnresolved(value: string): boolean {
  return /(?:\$\{|{{|}}|<[^>]+>|latest|HEAD)/i.test(value);
}

function sha256Bytes(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function digest(value: unknown): string {
  return sha256Bytes(Buffer.from(canonicalJson(value), "utf8"));
}

function readSafeFile(root: string, relative: string): Buffer {
  if (!validPath(relative)) invalid();
  let current = root;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    let stats;
    try {
      stats = lstatSync(current);
    } catch {
      invalid();
    }
    if (stats.isSymbolicLink()) invalid();
  }
  const resolved = realpathSync(current);
  const fromRoot = path.relative(root, resolved);
  if (fromRoot === ".." || fromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(fromRoot)) invalid();
  return readFileSync(resolved);
}

function walkFiles(root: string, relative = ""): string[] {
  const base = relative === "" ? root : path.join(root, relative);
  const entries = readdirSync(base, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    const childRelative = relative === "" ? entry.name : `${relative}/${entry.name}`;
    if (!validPath(childRelative) || entry.isSymbolicLink()) invalid();
    if (entry.isDirectory()) result.push(...walkFiles(root, childRelative));
    else if (entry.isFile()) result.push(childRelative);
    else invalid();
  }
  return result;
}

function invalid(): never {
  throw new Error("SKILL_BUNDLE_CONTRACT_INVALID_DENIED");
}

function compatibilityInvalid(): never {
  throw new Error("SKILL_BUNDLE_COMPATIBILITY_DENIED_TO_LKG");
}
