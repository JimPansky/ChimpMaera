import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const HMI_GENERATION_SCHEMA_V1 = "chimpmaera.hmi/generation/v1" as const;
export const HMI_CORE_VERSION_V1 = "1.0.0" as const;
export const HMI_CONTRACT_VERSION_V1 = "1.0.0" as const;

export type HmiGenerationReasonCodeV1 =
  | "HMI_GENERATION_VERIFIED"
  | "HMI_SCHEMA_DENIED"
  | "HMI_COMPATIBILITY_DENIED"
  | "HMI_PATH_DENIED"
  | "HMI_FILE_KIND_DENIED"
  | "HMI_MUTABLE_FILE_DENIED"
  | "HMI_EXECUTABLE_FILE_DENIED"
  | "HMI_AUTHORITY_DENIED"
  | "HMI_CAPABILITY_DENIED"
  | "HMI_GENERATION_DIGEST_DENIED"
  | "HMI_FILE_SET_DENIED"
  | "HMI_FILE_DIGEST_DENIED";

export interface HmiGenerationFileV1 {
  readonly path: string;
  readonly mediaType: "application/json" | "text/markdown";
  readonly byteCount: number;
  readonly sha256: string;
  readonly role: "INDEX" | "KNOWLEDGE" | "CAPABILITY" | "VALIDATOR" | "NORMALIZATION";
  readonly kind: "REGULAR_FILE";
  readonly executable: false;
  readonly mutable: false;
}

export interface HmiGenerationManifestV1 {
  readonly schemaVersion: typeof HMI_GENERATION_SCHEMA_V1;
  readonly generationId: string;
  readonly coreVersion: typeof HMI_CORE_VERSION_V1;
  readonly contractVersion: typeof HMI_CONTRACT_VERSION_V1;
  readonly createdFrom: {
    readonly sourceSetDigest: string;
    readonly generatorDigest: string;
    readonly schemaDigest: string;
  };
  readonly provenance: readonly {
    readonly sourceId: string;
    readonly relativeRef: string;
    readonly sourceDigest: string;
    readonly trustClass: "PUBLIC_SYNTHETIC";
    readonly reviewStatus: "REVIEWED_LOCAL_SYNTHETIC";
    readonly nonClaims: readonly string[];
  }[];
  readonly files: readonly HmiGenerationFileV1[];
  readonly capabilities: readonly {
    readonly capabilityId: string;
    readonly descriptorDigest: string;
    readonly effectClass: "DESCRIBE_ONLY" | "PLAN_ONLY" | "READ_ONLY_VALIDATE";
    readonly requestedRights: readonly [];
    readonly routeId: null;
    readonly lifecycleState: "DESCRIBED_INACTIVE";
  }[];
  readonly validatorIds: readonly string[];
  readonly routes: readonly [];
  readonly authority: {
    readonly requestedRights: readonly [];
    readonly routeIds: readonly [];
    readonly writeTargets: readonly [];
    readonly networkRoutes: readonly [];
    readonly externalDependencies: readonly [];
  };
  readonly compatibility: {
    readonly coreVersion: typeof HMI_CORE_VERSION_V1;
    readonly contractVersion: typeof HMI_CONTRACT_VERSION_V1;
    readonly evidenceStatus: "LOCAL_SYNTHETIC";
  };
  readonly limits: {
    readonly maxReferences: number;
    readonly maxSourceBytes: number;
    readonly maxFindings: number;
    readonly maxOutputBytes: number;
  };
  readonly supersedes: string | null;
  readonly generationDigest: string;
}

export interface HmiGenerationBundleV1 {
  readonly manifest: HmiGenerationManifestV1;
  readonly files: readonly {
    readonly path: string;
    readonly encoding: "UTF8";
    readonly content: string;
  }[];
}

export type HmiGenerationVerificationV1 =
  | {
    readonly outcome: "VERIFIED";
    readonly reasonCodes: readonly ["HMI_GENERATION_VERIFIED"];
    readonly generationDigest: string;
    readonly fileCount: number;
    readonly rightsCount: 0;
    readonly routeCount: 0;
    readonly writeTargetCount: 0;
  }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly HmiGenerationReasonCodeV1[] };

function sha256(bytes: string): string {
  return createHash("sha256").update(bytes, "utf8").digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
}

function isIntegerBetween(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function isSafeRelativePath(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 240
    && value === value.normalize("NFC") && !value.startsWith("/") && !value.includes("\\")
    && !value.includes("\0") && !value.split("/").some((part) => ["", ".", ".."].includes(part));
}

function isUniqueStringArray(value: unknown, predicate: (item: unknown) => boolean): value is string[] {
  return Array.isArray(value) && new Set(value).size === value.length && value.every(predicate);
}

function denied(reason: HmiGenerationReasonCodeV1): HmiGenerationVerificationV1 {
  return { outcome: "DENIED", reasonCodes: [reason] };
}

function normalizeJson(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFC");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("HMI semantic normalization rejects non-finite numbers");
    return value;
  }
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (!isRecord(value)) throw new TypeError("HMI semantic normalization accepts plain JSON values only");
  const normalizedEntries = Object.entries(value).map(([key, item]) => [key.normalize("NFC"), normalizeJson(item)] as const);
  if (new Set(normalizedEntries.map(([key]) => key)).size !== normalizedEntries.length) {
    throw new TypeError("HMI semantic normalization rejects Unicode-colliding object keys");
  }
  return Object.fromEntries(normalizedEntries);
}

export function normalizeHmiSemanticResultV1(value: unknown): {
  readonly canonicalBytes: string;
  readonly responseDigest: string;
} {
  const canonicalBytes = canonicalJson(normalizeJson(value));
  return { canonicalBytes, responseDigest: sha256(canonicalBytes) };
}

export function hmiGenerationDigestV1(manifest: HmiGenerationManifestV1): string {
  if (!isRecord(manifest)) throw new TypeError("INVALID_HMI_GENERATION_MANIFEST");
  const content = Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== "generationDigest"));
  return sha256(canonicalJson(content));
}

export function verifyHmiGenerationV1(value: unknown): HmiGenerationVerificationV1 {
  if (!exactKeys(value, ["manifest", "files"]) || !Array.isArray(value.files)) return denied("HMI_SCHEMA_DENIED");
  const manifest = value.manifest;
  if (!exactKeys(manifest, [
    "schemaVersion", "generationId", "coreVersion", "contractVersion", "createdFrom", "provenance",
    "files", "capabilities", "validatorIds", "routes", "authority", "compatibility", "limits",
    "supersedes", "generationDigest",
  ])) return denied("HMI_SCHEMA_DENIED");
  if (manifest.schemaVersion !== HMI_GENERATION_SCHEMA_V1 || !isId(manifest.generationId)
    || !isDigest(manifest.generationDigest) || !(manifest.supersedes === null || isDigest(manifest.supersedes))) {
    return denied("HMI_SCHEMA_DENIED");
  }
  if (!exactKeys(manifest.createdFrom, ["sourceSetDigest", "generatorDigest", "schemaDigest"])
    || ![manifest.createdFrom.sourceSetDigest, manifest.createdFrom.generatorDigest, manifest.createdFrom.schemaDigest].every(isDigest)) {
    return denied("HMI_SCHEMA_DENIED");
  }
  if (!exactKeys(manifest.compatibility, ["coreVersion", "contractVersion", "evidenceStatus"])
    || manifest.coreVersion !== HMI_CORE_VERSION_V1 || manifest.contractVersion !== HMI_CONTRACT_VERSION_V1
    || manifest.compatibility.coreVersion !== HMI_CORE_VERSION_V1
    || manifest.compatibility.contractVersion !== HMI_CONTRACT_VERSION_V1
    || manifest.compatibility.evidenceStatus !== "LOCAL_SYNTHETIC") return denied("HMI_COMPATIBILITY_DENIED");
  if (!exactKeys(manifest.limits, ["maxReferences", "maxSourceBytes", "maxFindings", "maxOutputBytes"])
    || !isIntegerBetween(manifest.limits.maxReferences, 1, 4)
    || !isIntegerBetween(manifest.limits.maxSourceBytes, 1, 65_536)
    || !isIntegerBetween(manifest.limits.maxFindings, 1, 200)
    || !isIntegerBetween(manifest.limits.maxOutputBytes, 1, 16_384)) {
    return denied("HMI_SCHEMA_DENIED");
  }
  if (!Array.isArray(manifest.provenance) || manifest.provenance.length === 0) return denied("HMI_SCHEMA_DENIED");
  for (const source of manifest.provenance) {
    if (!exactKeys(source, ["sourceId", "relativeRef", "sourceDigest", "trustClass", "reviewStatus", "nonClaims"])
      || !isId(source.sourceId) || !isDigest(source.sourceDigest) || source.trustClass !== "PUBLIC_SYNTHETIC"
      || source.reviewStatus !== "REVIEWED_LOCAL_SYNTHETIC" || !isUniqueStringArray(source.nonClaims,
        (item) => typeof item === "string" && item.length > 0)) return denied("HMI_SCHEMA_DENIED");
    if (!isSafeRelativePath(source.relativeRef)) return denied("HMI_PATH_DENIED");
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) return denied("HMI_SCHEMA_DENIED");
  const declaredPaths = new Set<string>();
  const capabilityFileDigests = new Set<string>();
  for (const file of manifest.files) {
    if (!exactKeys(file, ["path", "mediaType", "byteCount", "sha256", "role", "kind", "executable", "mutable"])) {
      return denied("HMI_SCHEMA_DENIED");
    }
    if (!isSafeRelativePath(file.path)) return denied("HMI_PATH_DENIED");
    if (file.kind !== "REGULAR_FILE") return denied("HMI_FILE_KIND_DENIED");
    if (file.mutable !== false) return denied("HMI_MUTABLE_FILE_DENIED");
    if (file.executable !== false) return denied("HMI_EXECUTABLE_FILE_DENIED");
    if (!["application/json", "text/markdown"].includes(file.mediaType as string)
      || !isIntegerBetween(file.byteCount, 0, Number.MAX_SAFE_INTEGER) || !isDigest(file.sha256)
      || !["INDEX", "KNOWLEDGE", "CAPABILITY", "VALIDATOR", "NORMALIZATION"].includes(file.role as string)
      || declaredPaths.has(file.path)) return denied("HMI_SCHEMA_DENIED");
    declaredPaths.add(file.path);
    if (file.role === "CAPABILITY") capabilityFileDigests.add(file.sha256);
  }
  if (!Array.isArray(manifest.capabilities)) return denied("HMI_SCHEMA_DENIED");
  const capabilityIds = new Set<string>();
  for (const capability of manifest.capabilities) {
    if (!exactKeys(capability, [
      "capabilityId", "descriptorDigest", "effectClass", "requestedRights", "routeId", "lifecycleState",
    ]) || !isId(capability.capabilityId) || !isDigest(capability.descriptorDigest)
      || !["DESCRIBE_ONLY", "PLAN_ONLY", "READ_ONLY_VALIDATE"].includes(capability.effectClass as string)
      || capability.lifecycleState !== "DESCRIBED_INACTIVE" || capabilityIds.has(capability.capabilityId)) {
      return denied("HMI_SCHEMA_DENIED");
    }
    if (!Array.isArray(capability.requestedRights) || capability.requestedRights.length !== 0 || capability.routeId !== null) {
      return denied("HMI_AUTHORITY_DENIED");
    }
    capabilityIds.add(capability.capabilityId);
  }
  if (capabilityIds.size !== capabilityFileDigests.size
    || [...manifest.capabilities].some((capability) => !capabilityFileDigests.has(capability.descriptorDigest))) {
    return denied("HMI_CAPABILITY_DENIED");
  }
  if (!isUniqueStringArray(manifest.validatorIds, isId)) return denied("HMI_SCHEMA_DENIED");
  if (!Array.isArray(manifest.routes)) return denied("HMI_SCHEMA_DENIED");
  if (!exactKeys(manifest.authority, [
    "requestedRights", "routeIds", "writeTargets", "networkRoutes", "externalDependencies",
  ])) return denied("HMI_SCHEMA_DENIED");
  const authorityArrays = [manifest.authority.requestedRights, manifest.authority.routeIds,
    manifest.authority.writeTargets, manifest.authority.networkRoutes, manifest.authority.externalDependencies];
  if (!authorityArrays.every(Array.isArray)) return denied("HMI_SCHEMA_DENIED");
  if (manifest.routes.length !== 0 || authorityArrays.some((items) => (items as unknown[]).length !== 0)) {
    return denied("HMI_AUTHORITY_DENIED");
  }
  if (hmiGenerationDigestV1(manifest as unknown as HmiGenerationManifestV1) !== manifest.generationDigest) {
    return denied("HMI_GENERATION_DIGEST_DENIED");
  }
  const supplied = new Map<string, string>();
  for (const file of value.files) {
    if (!exactKeys(file, ["path", "encoding", "content"]) || file.encoding !== "UTF8" || typeof file.content !== "string") {
      return denied("HMI_SCHEMA_DENIED");
    }
    if (!isSafeRelativePath(file.path)) return denied("HMI_PATH_DENIED");
    if (supplied.has(file.path)) return denied("HMI_FILE_SET_DENIED");
    supplied.set(file.path, file.content);
  }
  if (supplied.size !== declaredPaths.size || [...supplied.keys()].some((path) => !declaredPaths.has(path))) {
    return denied("HMI_FILE_SET_DENIED");
  }
  for (const file of manifest.files) {
    const content = supplied.get(file.path);
    if (content === undefined) return denied("HMI_FILE_SET_DENIED");
    if (Buffer.byteLength(content, "utf8") !== file.byteCount || sha256(content) !== file.sha256) {
      return denied("HMI_FILE_DIGEST_DENIED");
    }
  }
  return {
    outcome: "VERIFIED",
    reasonCodes: ["HMI_GENERATION_VERIFIED"],
    generationDigest: manifest.generationDigest,
    fileCount: manifest.files.length,
    rightsCount: 0,
    routeCount: 0,
    writeTargetCount: 0,
  };
}
