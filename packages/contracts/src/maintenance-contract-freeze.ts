import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const MAINTENANCE_BUNDLE_SCHEMA_V1 = "chimpmaera.maintenance/contract-freeze/v1" as const;
export const INSTALLATION_LOCK_SCHEMA_V1 = "chimpmaera.maintenance/installation-lock/v1" as const;
export const MAINTENANCE_COMPATIBILITY_SCHEMA_V1 = "chimpmaera.maintenance/compatibility-profile/v1" as const;
export const MAINTENANCE_PLAN_SCHEMA_V1 = "chimpmaera.maintenance/operation-plan/v1" as const;
export const MAINTENANCE_RECEIPT_SCHEMA_V1 = "chimpmaera.maintenance/operation-receipt/v1" as const;
export const MAINTENANCE_DOCTOR_SCHEMA_V1 = "chimpmaera.maintenance/doctor-report/v1" as const;

export const MAINTENANCE_AXIS_NAMES_V1 = [
  "core", "packs", "adapters", "policies", "schemas", "generations",
] as const;

export type MaintenanceReasonCodeV1 =
  | "MAINTENANCE_CONTRACT_ACCEPTED"
  | "INVALID_JSON_DENIED"
  | "SCHEMA_DENIED"
  | "UNSUPPORTED_VERSION_DENIED"
  | "MUTABLE_TARGET_DENIED"
  | "DIGEST_MISMATCH_DENIED"
  | "AUTHORITY_DELTA_DENIED"
  | "COMPATIBILITY_DENIED"
  | "MUTATION_CLAIM_DENIED";

export const MAINTENANCE_EXIT_CODES_V1: Readonly<Record<MaintenanceReasonCodeV1, number>> = {
  MAINTENANCE_CONTRACT_ACCEPTED: 0,
  INVALID_JSON_DENIED: 20,
  SCHEMA_DENIED: 21,
  UNSUPPORTED_VERSION_DENIED: 22,
  MUTABLE_TARGET_DENIED: 23,
  DIGEST_MISMATCH_DENIED: 24,
  AUTHORITY_DELTA_DENIED: 25,
  COMPATIBILITY_DENIED: 26,
  MUTATION_CLAIM_DENIED: 27,
};

export interface MaintenanceComponentLockV1 {
  readonly componentId: string;
  readonly version: string;
  readonly digest: string;
}

export interface InstallationLockV1 {
  readonly schemaVersion: typeof INSTALLATION_LOCK_SCHEMA_V1;
  readonly lockId: string;
  readonly releaseId: string;
  readonly versionAxes: {
    readonly core: readonly MaintenanceComponentLockV1[];
    readonly packs: readonly MaintenanceComponentLockV1[];
    readonly adapters: readonly MaintenanceComponentLockV1[];
    readonly policies: readonly MaintenanceComponentLockV1[];
    readonly schemas: readonly MaintenanceComponentLockV1[];
    readonly generations: readonly MaintenanceComponentLockV1[];
  };
  readonly authorityProfileDigest: string;
  readonly lockDigest: string;
}

export interface MaintenanceCompatibilityProfileV1 {
  readonly schemaVersion: typeof MAINTENANCE_COMPATIBILITY_SCHEMA_V1;
  readonly profileId: string;
  readonly subjectLockDigest: string;
  readonly requiredAxisVersions: {
    readonly core: string;
    readonly packs: string;
    readonly adapters: string;
    readonly policies: string;
    readonly schemas: string;
    readonly generations: string;
  };
  readonly unresolvedInputs: readonly [];
  readonly mutableInputs: readonly [];
  readonly authorityDelta: { readonly added: readonly []; readonly removed: readonly [] };
  readonly verdict: "COMPATIBLE";
  readonly profileDigest: string;
}

export interface MaintenanceOperationPlanV1 {
  readonly schemaVersion: typeof MAINTENANCE_PLAN_SCHEMA_V1;
  readonly operationId: string;
  readonly intent: "CHECK_UPDATE" | "PREVIEW_MIGRATION" | "DOCTOR";
  readonly fromLockDigest: string;
  readonly targetLockDigest: string;
  readonly compatibilityProfileDigest: string;
  readonly authorityDelta: { readonly added: readonly []; readonly removed: readonly [] };
  readonly executionAuthorized: false;
  readonly issuedAtMs: number;
  readonly planDigest: string;
}

export interface MaintenanceDoctorReportV1 {
  readonly schemaVersion: typeof MAINTENANCE_DOCTOR_SCHEMA_V1;
  readonly reportId: string;
  readonly readOnly: true;
  readonly observedLockDigest: string;
  readonly compatibilityProfileDigest: string;
  readonly checks: readonly {
    readonly checkId: string;
    readonly status: "PASS" | "FAIL" | "NOT_OBSERVED";
    readonly reasonCode: "OBSERVATION_MATCHED" | "OBSERVATION_MISMATCH" | "OBSERVATION_UNAVAILABLE";
  }[];
  readonly publicProjection: {
    readonly releaseId: string;
    readonly overallStatus: "READY_FOR_REVIEW" | "NOT_READY" | "INCOMPLETE";
    readonly reasonCodes: readonly ("CONTRACTS_VALID" | "CHECK_FAILED" | "CHECK_UNAVAILABLE")[];
  };
  readonly generatedAtMs: number;
  readonly reportDigest: string;
}

export interface MaintenanceOperationReceiptV1 {
  readonly schemaVersion: typeof MAINTENANCE_RECEIPT_SCHEMA_V1;
  readonly operationId: string;
  readonly outcome: "VALIDATED";
  readonly reasonCodes: readonly ["MAINTENANCE_CONTRACT_ACCEPTED"];
  readonly exitCode: 0;
  readonly planDigest: string;
  readonly beforeLockDigest: string;
  readonly afterLockDigest: string;
  readonly mutationObserved: false;
  readonly completedAtMs: number;
  readonly receiptDigest: string;
}

export interface MaintenanceContractBundleV1 {
  readonly schemaVersion: typeof MAINTENANCE_BUNDLE_SCHEMA_V1;
  readonly installationLock: InstallationLockV1;
  readonly compatibilityProfile: MaintenanceCompatibilityProfileV1;
  readonly operationPlan: MaintenanceOperationPlanV1;
  readonly doctorReport: MaintenanceDoctorReportV1;
  readonly operationReceipt: MaintenanceOperationReceiptV1;
}

export type MaintenanceContractResultV1 =
  | { readonly outcome: "ACCEPTED"; readonly reasonCodes: readonly ["MAINTENANCE_CONTRACT_ACCEPTED"]; readonly exitCode: 0; readonly canonicalJson: string; readonly bundleDigest: string; readonly bundle: MaintenanceContractBundleV1 }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly MaintenanceReasonCodeV1[]; readonly exitCode: number };

const EXACT_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
const ID = /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/;
const DIGEST = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

function isTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function validComponent(value: unknown): value is MaintenanceComponentLockV1 {
  return exactKeys(value, ["componentId", "version", "digest"])
    && isId(value.componentId) && typeof value.version === "string"
    && EXACT_VERSION.test(value.version) && isDigest(value.digest);
}

function normalizedLock(lock: InstallationLockV1): InstallationLockV1 {
  const sorted = (items: readonly MaintenanceComponentLockV1[]) =>
    [...items].sort((a, b) => a.componentId.localeCompare(b.componentId));
  return {
    ...lock,
    versionAxes: {
      core: sorted(lock.versionAxes.core),
      packs: sorted(lock.versionAxes.packs),
      adapters: sorted(lock.versionAxes.adapters),
      policies: sorted(lock.versionAxes.policies),
      schemas: sorted(lock.versionAxes.schemas),
      generations: sorted(lock.versionAxes.generations),
    },
  };
}

function normalizedBundle(bundle: MaintenanceContractBundleV1): MaintenanceContractBundleV1 {
  return { ...bundle, installationLock: normalizedLock(bundle.installationLock) };
}

export function maintenanceContractDigest(value: Record<string, unknown>, digestKey: string): string {
  const unsigned = Object.fromEntries(Object.entries(value).filter(([key]) => key !== digestKey));
  return createHash("sha256").update(canonicalJson(unsigned)).digest("hex");
}

export function renderMaintenanceContractBundleV1(bundle: MaintenanceContractBundleV1): string {
  return canonicalJson(normalizedBundle(bundle));
}

function schemaVersions(value: Record<string, unknown>): unknown[] {
  return [
    value.schemaVersion,
    (value.installationLock as Record<string, unknown> | undefined)?.schemaVersion,
    (value.compatibilityProfile as Record<string, unknown> | undefined)?.schemaVersion,
    (value.operationPlan as Record<string, unknown> | undefined)?.schemaVersion,
    (value.doctorReport as Record<string, unknown> | undefined)?.schemaVersion,
    (value.operationReceipt as Record<string, unknown> | undefined)?.schemaVersion,
  ];
}

function hasUnsupportedVersion(value: Record<string, unknown>): boolean {
  const expected = [MAINTENANCE_BUNDLE_SCHEMA_V1, INSTALLATION_LOCK_SCHEMA_V1,
    MAINTENANCE_COMPATIBILITY_SCHEMA_V1, MAINTENANCE_PLAN_SCHEMA_V1,
    MAINTENANCE_DOCTOR_SCHEMA_V1, MAINTENANCE_RECEIPT_SCHEMA_V1];
  return schemaVersions(value).some((version, index) => version !== undefined && version !== expected[index]);
}

function preflightSemanticDenial(value: Record<string, unknown>): MaintenanceReasonCodeV1 | null {
  const lock = isRecord(value.installationLock) ? value.installationLock : null;
  const axes = lock && isRecord(lock.versionAxes) ? lock.versionAxes : null;
  if (axes) {
    for (const axis of MAINTENANCE_AXIS_NAMES_V1) {
      const components = axes[axis];
      if (Array.isArray(components) && components.some((component) => isRecord(component)
        && typeof component.version === "string" && !EXACT_VERSION.test(component.version))) {
        return "MUTABLE_TARGET_DENIED";
      }
    }
  }
  const compatibility = isRecord(value.compatibilityProfile) ? value.compatibilityProfile : null;
  if (compatibility && ((Array.isArray(compatibility.unresolvedInputs) && compatibility.unresolvedInputs.length > 0)
    || (Array.isArray(compatibility.mutableInputs) && compatibility.mutableInputs.length > 0))) {
    return "COMPATIBILITY_DENIED";
  }
  const deltas = [compatibility?.authorityDelta,
    isRecord(value.operationPlan) ? value.operationPlan.authorityDelta : null];
  if (deltas.some((delta) => isRecord(delta)
    && ((Array.isArray(delta.added) && delta.added.length > 0)
      || (Array.isArray(delta.removed) && delta.removed.length > 0)))) {
    return "AUTHORITY_DELTA_DENIED";
  }
  const plan = isRecord(value.operationPlan) ? value.operationPlan : null;
  const receipt = isRecord(value.operationReceipt) ? value.operationReceipt : null;
  if (plan?.executionAuthorized === true || receipt?.mutationObserved === true) return "MUTATION_CLAIM_DENIED";
  return null;
}

function validLock(value: unknown): value is InstallationLockV1 {
  if (!exactKeys(value, ["schemaVersion", "lockId", "releaseId", "versionAxes", "authorityProfileDigest", "lockDigest"])
    || value.schemaVersion !== INSTALLATION_LOCK_SCHEMA_V1 || !isId(value.lockId)
    || typeof value.releaseId !== "string" || !EXACT_VERSION.test(value.releaseId)
    || !isDigest(value.authorityProfileDigest) || !isDigest(value.lockDigest)
    || !exactKeys(value.versionAxes, MAINTENANCE_AXIS_NAMES_V1)) return false;
  const axes = value.versionAxes as Record<(typeof MAINTENANCE_AXIS_NAMES_V1)[number], unknown>;
  for (const axis of MAINTENANCE_AXIS_NAMES_V1) {
    const components = axes[axis];
    if (!Array.isArray(components) || components.length === 0 || !components.every(validComponent)) return false;
    const ids = components.map(({ componentId }) => componentId);
    if (ids.length !== new Set(ids).size) return false;
  }
  return (axes.core as unknown[]).length === 1;
}

function validCompatibility(value: unknown): value is MaintenanceCompatibilityProfileV1 {
  const axisVersions = isRecord(value) && isRecord(value.requiredAxisVersions)
    ? value.requiredAxisVersions : {};
  return exactKeys(value, ["schemaVersion", "profileId", "subjectLockDigest", "requiredAxisVersions",
    "unresolvedInputs", "mutableInputs", "authorityDelta", "verdict", "profileDigest"])
    && value.schemaVersion === MAINTENANCE_COMPATIBILITY_SCHEMA_V1 && isId(value.profileId)
    && isDigest(value.subjectLockDigest) && exactKeys(value.requiredAxisVersions, MAINTENANCE_AXIS_NAMES_V1)
    && MAINTENANCE_AXIS_NAMES_V1.every((axis) => typeof axisVersions[axis] === "string"
      && EXACT_VERSION.test(axisVersions[axis] as string))
    && Array.isArray(value.unresolvedInputs) && value.unresolvedInputs.length === 0
    && Array.isArray(value.mutableInputs) && value.mutableInputs.length === 0
    && exactKeys(value.authorityDelta, ["added", "removed"])
    && Array.isArray(value.authorityDelta.added) && value.authorityDelta.added.length === 0
    && Array.isArray(value.authorityDelta.removed) && value.authorityDelta.removed.length === 0
    && value.verdict === "COMPATIBLE" && isDigest(value.profileDigest);
}

function validPlan(value: unknown): value is MaintenanceOperationPlanV1 {
  return exactKeys(value, ["schemaVersion", "operationId", "intent", "fromLockDigest", "targetLockDigest",
    "compatibilityProfileDigest", "authorityDelta", "executionAuthorized", "issuedAtMs", "planDigest"])
    && value.schemaVersion === MAINTENANCE_PLAN_SCHEMA_V1 && isId(value.operationId)
    && ["CHECK_UPDATE", "PREVIEW_MIGRATION", "DOCTOR"].includes(value.intent as string)
    && isDigest(value.fromLockDigest) && isDigest(value.targetLockDigest)
    && isDigest(value.compatibilityProfileDigest) && exactKeys(value.authorityDelta, ["added", "removed"])
    && Array.isArray(value.authorityDelta.added) && value.authorityDelta.added.length === 0
    && Array.isArray(value.authorityDelta.removed) && value.authorityDelta.removed.length === 0
    && value.executionAuthorized === false && isTimestamp(value.issuedAtMs) && isDigest(value.planDigest);
}

function validDoctor(value: unknown): value is MaintenanceDoctorReportV1 {
  return exactKeys(value, ["schemaVersion", "reportId", "readOnly", "observedLockDigest",
    "compatibilityProfileDigest", "checks", "publicProjection", "generatedAtMs", "reportDigest"])
    && value.schemaVersion === MAINTENANCE_DOCTOR_SCHEMA_V1 && isId(value.reportId) && value.readOnly === true
    && isDigest(value.observedLockDigest) && isDigest(value.compatibilityProfileDigest)
    && Array.isArray(value.checks) && value.checks.length > 0
    && value.checks.every((check) => exactKeys(check, ["checkId", "status", "reasonCode"])
      && isId(check.checkId) && ["PASS", "FAIL", "NOT_OBSERVED"].includes(check.status as string)
      && ["OBSERVATION_MATCHED", "OBSERVATION_MISMATCH", "OBSERVATION_UNAVAILABLE"].includes(check.reasonCode as string))
    && exactKeys(value.publicProjection, ["releaseId", "overallStatus", "reasonCodes"])
    && typeof value.publicProjection.releaseId === "string" && EXACT_VERSION.test(value.publicProjection.releaseId)
    && ["READY_FOR_REVIEW", "NOT_READY", "INCOMPLETE"].includes(value.publicProjection.overallStatus as string)
    && Array.isArray(value.publicProjection.reasonCodes) && value.publicProjection.reasonCodes.length > 0
    && value.publicProjection.reasonCodes.every((reason) => ["CONTRACTS_VALID", "CHECK_FAILED", "CHECK_UNAVAILABLE"].includes(reason as string))
    && isTimestamp(value.generatedAtMs) && isDigest(value.reportDigest);
}

function validReceipt(value: unknown): value is MaintenanceOperationReceiptV1 {
  return exactKeys(value, ["schemaVersion", "operationId", "outcome", "reasonCodes", "exitCode", "planDigest",
    "beforeLockDigest", "afterLockDigest", "mutationObserved", "completedAtMs", "receiptDigest"])
    && value.schemaVersion === MAINTENANCE_RECEIPT_SCHEMA_V1 && isId(value.operationId)
    && value.outcome === "VALIDATED" && canonicalJson(value.reasonCodes) === canonicalJson(["MAINTENANCE_CONTRACT_ACCEPTED"])
    && value.exitCode === 0 && isDigest(value.planDigest) && isDigest(value.beforeLockDigest)
    && isDigest(value.afterLockDigest) && value.mutationObserved === false
    && isTimestamp(value.completedAtMs) && isDigest(value.receiptDigest);
}

function deny(reason: MaintenanceReasonCodeV1): MaintenanceContractResultV1 {
  return { outcome: "DENIED", reasonCodes: [reason], exitCode: MAINTENANCE_EXIT_CODES_V1[reason] };
}

export function verifyMaintenanceContractBundleV1(input: unknown): MaintenanceContractResultV1 {
  if (!exactKeys(input, ["schemaVersion", "installationLock", "compatibilityProfile", "operationPlan", "doctorReport", "operationReceipt"])) {
    if (isRecord(input) && hasUnsupportedVersion(input)) return deny("UNSUPPORTED_VERSION_DENIED");
    return deny("SCHEMA_DENIED");
  }
  if (hasUnsupportedVersion(input)) return deny("UNSUPPORTED_VERSION_DENIED");
  const semanticDenial = preflightSemanticDenial(input);
  if (semanticDenial) return deny(semanticDenial);
  if (!validLock(input.installationLock) || !validCompatibility(input.compatibilityProfile)
    || !validPlan(input.operationPlan) || !validDoctor(input.doctorReport) || !validReceipt(input.operationReceipt)) {
    return deny("SCHEMA_DENIED");
  }
  const bundle = normalizedBundle(input as unknown as MaintenanceContractBundleV1);
  const allVersions = MAINTENANCE_AXIS_NAMES_V1.flatMap((axis) => bundle.installationLock.versionAxes[axis].map(({ version }) => version));
  if (allVersions.some((version) => !EXACT_VERSION.test(version))) return deny("MUTABLE_TARGET_DENIED");
  if (bundle.compatibilityProfile.unresolvedInputs.length > 0 || bundle.compatibilityProfile.mutableInputs.length > 0) return deny("COMPATIBILITY_DENIED");
  if (bundle.compatibilityProfile.authorityDelta.added.length > 0 || bundle.compatibilityProfile.authorityDelta.removed.length > 0
    || bundle.operationPlan.authorityDelta.added.length > 0 || bundle.operationPlan.authorityDelta.removed.length > 0) return deny("AUTHORITY_DELTA_DENIED");
  const digests: readonly [Record<string, unknown>, string, string][] = [
    [bundle.installationLock as unknown as Record<string, unknown>, "lockDigest", bundle.installationLock.lockDigest],
    [bundle.compatibilityProfile as unknown as Record<string, unknown>, "profileDigest", bundle.compatibilityProfile.profileDigest],
    [bundle.operationPlan as unknown as Record<string, unknown>, "planDigest", bundle.operationPlan.planDigest],
    [bundle.doctorReport as unknown as Record<string, unknown>, "reportDigest", bundle.doctorReport.reportDigest],
    [bundle.operationReceipt as unknown as Record<string, unknown>, "receiptDigest", bundle.operationReceipt.receiptDigest],
  ];
  if (digests.some(([value, key, expected]) => maintenanceContractDigest(value, key) !== expected)) return deny("DIGEST_MISMATCH_DENIED");
  const lockDigest = bundle.installationLock.lockDigest;
  const profileDigest = bundle.compatibilityProfile.profileDigest;
  if (bundle.compatibilityProfile.subjectLockDigest !== lockDigest
    || bundle.operationPlan.fromLockDigest !== lockDigest || bundle.operationPlan.targetLockDigest !== lockDigest
    || bundle.operationPlan.compatibilityProfileDigest !== profileDigest
    || bundle.doctorReport.observedLockDigest !== lockDigest || bundle.doctorReport.compatibilityProfileDigest !== profileDigest
    || bundle.operationReceipt.planDigest !== bundle.operationPlan.planDigest
    || bundle.operationReceipt.beforeLockDigest !== lockDigest || bundle.operationReceipt.afterLockDigest !== lockDigest) {
    return deny("DIGEST_MISMATCH_DENIED");
  }
  if (bundle.operationPlan.executionAuthorized !== false || bundle.operationReceipt.mutationObserved !== false) return deny("MUTATION_CLAIM_DENIED");
  const rendered = renderMaintenanceContractBundleV1(bundle);
  return {
    outcome: "ACCEPTED",
    reasonCodes: ["MAINTENANCE_CONTRACT_ACCEPTED"],
    exitCode: 0,
    canonicalJson: rendered,
    bundleDigest: createHash("sha256").update(rendered).digest("hex"),
    bundle,
  };
}

export function parseMaintenanceContractBundleV1(json: string): MaintenanceContractResultV1 {
  try {
    return verifyMaintenanceContractBundleV1(JSON.parse(json));
  } catch {
    return deny("INVALID_JSON_DENIED");
  }
}
