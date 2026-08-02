import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import {
  BUILDER_DISCOVERY_EFFECT_CLASSES_V1,
  BUILDER_DISCOVERY_RESULT_API_VERSION,
  type BuilderDiscoveryEffectClassV1,
  type BuilderDiscoveryRecordV1,
  type BuilderMachineOperationV1,
} from "./builder-discovery.js";

export const BUILDER_CAPABILITY_REGISTRATION_API_VERSION =
  "chimpmaera.builder/capability-registration/v1" as const;
export const BUILDER_CAPABILITY_RESOLUTION_INPUT_API_VERSION =
  "chimpmaera.builder/capability-resolution-input/v1" as const;
export const BUILDER_CAPABILITY_RESOLUTION_RESULT_API_VERSION =
  "chimpmaera.builder/capability-resolution/v1" as const;
export const BUILDER_UNRESOLVED_INTENT_API_VERSION =
  "chimpmaera.builder/unresolved-intent/v1" as const;

export type BuilderCapabilityRegistrationV1 = Readonly<{
  schemaVersion: typeof BUILDER_CAPABILITY_REGISTRATION_API_VERSION;
  capabilityId: string;
  catalogueId: string;
  catalogueVersion: string;
  lifecycleState: "INACTIVE";
  systemTypes: readonly string[];
  operationIds: readonly string[];
  effectClasses: readonly BuilderDiscoveryEffectClassV1[];
  dependencyRefs: readonly string[];
  evidence: readonly string[];
  recommendation: string;
  descriptorDigest: string;
}>;

export type BuilderCapabilityResolutionInputV1 = Readonly<{
  schemaVersion: typeof BUILDER_CAPABILITY_RESOLUTION_INPUT_API_VERSION;
  discovery: BuilderDiscoveryRecordV1;
  registeredCapabilities: readonly BuilderCapabilityRegistrationV1[];
}>;

export type BuilderReusedCapabilityV1 = Readonly<{
  operationId: string;
  capabilityId: string;
  catalogueId: string;
  catalogueVersion: string;
  descriptorDigest: string;
  lifecycleState: "INACTIVE";
  executable: false;
  authorityGranted: false;
  effectAuthorized: false;
}>;

export type BuilderUnresolvedIntentV1 = Readonly<{
  schemaVersion: typeof BUILDER_UNRESOLVED_INTENT_API_VERSION;
  proposalVersion: "1.0.0";
  proposalId: string;
  status: "UNRESOLVED_INTENT";
  lifecycleState: "INACTIVE";
  operationId: string;
  capabilityHint: string;
  effectClass: BuilderDiscoveryEffectClassV1;
  risk: string;
  dependencyRefs: readonly string[];
  recommendation: string;
  executable: false;
  authorityGranted: false;
  effectAuthorized: false;
}>;

export type BuilderCapabilityResolutionV1 = Readonly<{
  schemaVersion: typeof BUILDER_CAPABILITY_RESOLUTION_RESULT_API_VERSION;
  claim: "CAPABILITY_REUSE_PLAN_ONLY_NO_AUTHORITY_OR_EFFECT";
  tenant: string;
  systemId: string;
  discoveryRecordDigest: string;
  registeredCapabilitiesDigest: string;
  reusedCapabilities: readonly BuilderReusedCapabilityV1[];
  unresolvedIntents: readonly BuilderUnresolvedIntentV1[];
  inputDigest: string;
  resultDigest: string;
}>;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, expected: readonly string[]): value is RecordValue {
  return isRecord(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort());
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function invalid(): never {
  throw new Error("BUILDER_CAPABILITY_RESOLUTION_INVALID_DENIED");
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string"
    && /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/.test(value);
}

function isVersion(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isBoundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximum
    && value === value.trim()
    && value === value.normalize("NFC")
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    && !/\b(?:password|passwd|api[_ -]?key|access[_ -]?token)\s*[:=]\s*\S{8,}/i.test(value);
}

function normalizeIdentifiers(value: unknown, minimum = 1): string[] {
  if (
    !Array.isArray(value)
    || value.length < minimum
    || value.length > 64
    || value.some((entry) => !isIdentifier(entry))
  ) return invalid();
  const normalized = [...value].sort();
  if (new Set(normalized).size !== normalized.length) return invalid();
  return normalized;
}

function normalizeEvidence(value: unknown): string[] {
  const evidence = normalizeIdentifiers(value);
  if (evidence.some((entry) =>
    !/^docs\/development\/evidence\/[a-z0-9][a-z0-9._/-]{0,180}$/.test(entry)
    || entry.includes("..")
    || entry.includes("//")
    || entry.endsWith("/"))) return invalid();
  return evidence;
}

function registrationCore(
  value: Omit<BuilderCapabilityRegistrationV1, "descriptorDigest">,
): Omit<BuilderCapabilityRegistrationV1, "descriptorDigest"> {
  return value;
}

export function createBuilderCapabilityRegistrationV1(
  value: Omit<BuilderCapabilityRegistrationV1, "descriptorDigest">,
): BuilderCapabilityRegistrationV1 {
  if (!exactKeys(value, [
    "capabilityId",
    "catalogueId",
    "catalogueVersion",
    "dependencyRefs",
    "effectClasses",
    "evidence",
    "lifecycleState",
    "operationIds",
    "recommendation",
    "schemaVersion",
    "systemTypes",
  ])) return invalid();
  if (
    value.schemaVersion !== BUILDER_CAPABILITY_REGISTRATION_API_VERSION
    || !isIdentifier(value.capabilityId)
    || !isIdentifier(value.catalogueId)
    || !isVersion(value.catalogueVersion)
    || value.lifecycleState !== "INACTIVE"
    || !isBoundedText(value.recommendation, 320)
  ) return invalid();
  const effectClasses = normalizeIdentifiers(value.effectClasses) as BuilderDiscoveryEffectClassV1[];
  if (effectClasses.some((entry) => !BUILDER_DISCOVERY_EFFECT_CLASSES_V1.includes(entry))) {
    return invalid();
  }
  const core = registrationCore({
    schemaVersion: BUILDER_CAPABILITY_REGISTRATION_API_VERSION,
    capabilityId: value.capabilityId,
    catalogueId: value.catalogueId,
    catalogueVersion: value.catalogueVersion,
    lifecycleState: "INACTIVE",
    systemTypes: normalizeIdentifiers(value.systemTypes),
    operationIds: normalizeIdentifiers(value.operationIds),
    effectClasses,
    dependencyRefs: normalizeIdentifiers(value.dependencyRefs),
    evidence: normalizeEvidence(value.evidence),
    recommendation: value.recommendation,
  });
  return { ...core, descriptorDigest: digest(core) };
}

function parseRegistration(value: unknown): BuilderCapabilityRegistrationV1 {
  if (!exactKeys(value, [
    "capabilityId",
    "catalogueId",
    "catalogueVersion",
    "dependencyRefs",
    "descriptorDigest",
    "effectClasses",
    "evidence",
    "lifecycleState",
    "operationIds",
    "recommendation",
    "schemaVersion",
    "systemTypes",
  ]) || !isDigest(value.descriptorDigest)) return invalid();
  const { descriptorDigest, ...candidateCore } = value;
  const normalized = createBuilderCapabilityRegistrationV1(
    candidateCore as Omit<BuilderCapabilityRegistrationV1, "descriptorDigest">,
  );
  if (normalized.descriptorDigest !== descriptorDigest) return invalid();
  return normalized;
}

function verifyDiscovery(value: unknown): BuilderDiscoveryRecordV1 {
  if (!exactKeys(value, [
    "actor",
    "claim",
    "constraints",
    "discoveredObjects",
    "discoveredOperations",
    "goal",
    "inputDigest",
    "recordDigest",
    "requestedOperationIds",
    "schemaVersion",
    "selectedContexts",
    "selectedGuides",
    "sourceDigests",
    "system",
    "tenant",
  ])) return invalid();
  const { recordDigest, ...core } = value;
  if (
    value.schemaVersion !== BUILDER_DISCOVERY_RESULT_API_VERSION
    || value.claim !== "DISCOVERY_RECORD_ONLY_NO_AUTHORITY_OR_EFFECT"
    || !isIdentifier(value.tenant)
    || !isDigest(value.inputDigest)
    || !isDigest(recordDigest)
    || digest(core) !== recordDigest
    || !exactKeys(value.system, [
      "dataClassification", "manifestId", "systemId", "systemType",
    ])
    || value.system.dataClassification !== "SYNTHETIC"
    || !isIdentifier(value.system.systemId)
    || !isIdentifier(value.system.systemType)
    || !Array.isArray(value.discoveredOperations)
    || value.discoveredOperations.length === 0
  ) return invalid();
  for (const operation of value.discoveredOperations) {
    if (!exactKeys(operation, [
      "capabilityHint", "cause", "contextRefs", "effect", "effectClass",
      "objectType", "operationId", "reversible",
    ])
      || !isIdentifier(operation.operationId)
      || !isIdentifier(operation.objectType)
      || !isIdentifier(operation.capabilityHint)
      || !BUILDER_DISCOVERY_EFFECT_CLASSES_V1.includes(
        operation.effectClass as BuilderDiscoveryEffectClassV1,
      )
      || !Array.isArray(operation.contextRefs)
      || operation.contextRefs.some((reference) => !isIdentifier(reference))) {
      return invalid();
    }
  }
  return value as unknown as BuilderDiscoveryRecordV1;
}

function unresolvedRisk(effectClass: BuilderDiscoveryEffectClassV1): string {
  const risks: Record<BuilderDiscoveryEffectClassV1, string> = {
    READ_ONLY: "Unknown read intent has no admitted data boundary, minimization rule or evidence contract.",
    REVERSIBLE_WRITE: "Unknown reversible-write intent has no admitted adapter, rollback binding or effect authorization.",
    IRREVERSIBLE_EFFECT: "Unknown irreversible intent has no admitted effect boundary, approval route or recovery guarantee.",
    INSTALL_ACTIVATE: "Unknown installation intent has no admitted provenance, isolation, activation or rollback contract.",
    PUBLICATION: "Unknown publication intent has no admitted disclosure, consent, destination or withdrawal contract.",
  };
  return risks[effectClass];
}

function unresolvedIntent(
  discovery: BuilderDiscoveryRecordV1,
  operation: BuilderMachineOperationV1,
): BuilderUnresolvedIntentV1 {
  const dependencyRefs = [
    `object:${operation.objectType}`,
    ...operation.contextRefs,
    ...discovery.selectedGuides
      .filter(({ operationRefs }) => operationRefs.includes(operation.operationId))
      .map(({ guideId }) => guideId),
  ].sort();
  const proposalSeed = {
    discoveryRecordDigest: discovery.recordDigest,
    operationId: operation.operationId,
    capabilityHint: operation.capabilityHint,
  };
  return {
    schemaVersion: BUILDER_UNRESOLVED_INTENT_API_VERSION,
    proposalVersion: "1.0.0",
    proposalId: `unresolved:${digest(proposalSeed).slice(0, 24)}`,
    status: "UNRESOLVED_INTENT",
    lifecycleState: "INACTIVE",
    operationId: operation.operationId,
    capabilityHint: operation.capabilityHint,
    effectClass: operation.effectClass,
    risk: unresolvedRisk(operation.effectClass),
    dependencyRefs,
    recommendation: `Register and independently admit an exact capability descriptor for ${operation.capabilityHint}; then rerun resolution.`,
    executable: false,
    authorityGranted: false,
    effectAuthorized: false,
  };
}

export function resolveBuilderCapabilitiesV1(
  input: unknown,
): BuilderCapabilityResolutionV1 {
  if (!exactKeys(input, ["discovery", "registeredCapabilities", "schemaVersion"])
    || input.schemaVersion !== BUILDER_CAPABILITY_RESOLUTION_INPUT_API_VERSION
    || !Array.isArray(input.registeredCapabilities)
    || input.registeredCapabilities.length > 256) return invalid();
  const discovery = verifyDiscovery(input.discovery);
  const registrations = input.registeredCapabilities
    .map(parseRegistration)
    .sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
  if (new Set(registrations.map(({ capabilityId }) => capabilityId)).size !== registrations.length) {
    return invalid();
  }
  const byCapability = new Map(registrations.map((entry) => [entry.capabilityId, entry]));
  const reusedCapabilities: BuilderReusedCapabilityV1[] = [];
  const unresolvedIntents: BuilderUnresolvedIntentV1[] = [];
  for (const operation of discovery.discoveredOperations) {
    const registration = byCapability.get(operation.capabilityHint);
    if (registration === undefined) {
      unresolvedIntents.push(unresolvedIntent(discovery, operation));
      continue;
    }
    if (
      !registration.systemTypes.includes(discovery.system.systemType)
      || !registration.operationIds.includes(operation.operationId)
      || !registration.effectClasses.includes(operation.effectClass)
    ) return invalid();
    reusedCapabilities.push({
      operationId: operation.operationId,
      capabilityId: registration.capabilityId,
      catalogueId: registration.catalogueId,
      catalogueVersion: registration.catalogueVersion,
      descriptorDigest: registration.descriptorDigest,
      lifecycleState: "INACTIVE",
      executable: false,
      authorityGranted: false,
      effectAuthorized: false,
    });
  }
  const normalizedInput: BuilderCapabilityResolutionInputV1 = {
    schemaVersion: BUILDER_CAPABILITY_RESOLUTION_INPUT_API_VERSION,
    discovery,
    registeredCapabilities: registrations,
  };
  const core = {
    schemaVersion: BUILDER_CAPABILITY_RESOLUTION_RESULT_API_VERSION,
    claim: "CAPABILITY_REUSE_PLAN_ONLY_NO_AUTHORITY_OR_EFFECT" as const,
    tenant: discovery.tenant,
    systemId: discovery.system.systemId,
    discoveryRecordDigest: discovery.recordDigest,
    registeredCapabilitiesDigest: digest(registrations),
    reusedCapabilities: reusedCapabilities.sort((left, right) =>
      left.operationId.localeCompare(right.operationId)),
    unresolvedIntents: unresolvedIntents.sort((left, right) =>
      left.operationId.localeCompare(right.operationId)),
    inputDigest: digest(normalizedInput),
  };
  return { ...core, resultDigest: digest(core) };
}

export function verifyBuilderCapabilityResolutionV1(
  value: unknown,
): BuilderCapabilityResolutionV1 {
  if (!exactKeys(value, [
    "claim", "discoveryRecordDigest", "inputDigest", "registeredCapabilitiesDigest",
    "resultDigest", "reusedCapabilities", "schemaVersion", "systemId", "tenant",
    "unresolvedIntents",
  ])) return invalid();
  const { resultDigest, ...core } = value;
  if (
    value.schemaVersion !== BUILDER_CAPABILITY_RESOLUTION_RESULT_API_VERSION
    || value.claim !== "CAPABILITY_REUSE_PLAN_ONLY_NO_AUTHORITY_OR_EFFECT"
    || !isDigest(resultDigest)
    || digest(core) !== resultDigest
  ) return invalid();
  const serialized = canonicalJson(value);
  for (const forbidden of [
    "credentialHandle", "policyDecision", "approval", "authorityToken",
    "providerCall", "effectCallback", "activationToken", "rawPayload",
  ]) if (serialized.includes(`\"${forbidden}\"`)) return invalid();
  return value as unknown as BuilderCapabilityResolutionV1;
}
