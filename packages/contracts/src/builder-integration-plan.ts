import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import {
  BUILDER_AUTHORITY_INPUT_API_VERSION,
  resolveBuilderAuthorityV1,
  type BuilderAuthorityInputV1,
  type BuilderAuthorityRouteV1,
  type BuilderAuthorityProfileV1,
} from "./builder-authority.js";
import {
  BUILDER_CAPABILITY_RESOLUTION_INPUT_API_VERSION,
  resolveBuilderCapabilitiesV1,
  type BuilderCapabilityRegistrationV1,
} from "./builder-capability-resolution.js";
import {
  BUILDER_DISCOVERY_INPUT_API_VERSION,
  discoverBuilderSystemV1,
  type BuilderDiscoveryEffectClassV1,
  type BuilderDiscoveryInputV1,
} from "./builder-discovery.js";

export const BUILDER_INTEGRATION_PLAN_INPUT_API_VERSION =
  "chimpmaera.builder/integration-plan-input/v1" as const;
export const BUILDER_INTEGRATION_PLAN_API_VERSION =
  "chimpmaera.builder/integration-plan/v1" as const;
export const BUILDER_PLANNED_SYSTEM_MANIFEST_API_VERSION =
  "chimpmaera.builder/planned-system-manifest/v1" as const;
export const BUILDER_OBJECT_GRAPH_API_VERSION =
  "chimpmaera.builder/object-dependency-graph/v1" as const;
export const BUILDER_GENERIC_CONTRACT_API_VERSION =
  "chimpmaera.builder/generic-integration-contract/v1" as const;

export const BUILDER_SCAFFOLD_KINDS_V1 = ["ADAPTER", "SKILL"] as const;
export type BuilderScaffoldKindV1 = typeof BUILDER_SCAFFOLD_KINDS_V1[number];

export type BuilderIntegrationPlanInputV1 = Readonly<{
  schemaVersion: typeof BUILDER_INTEGRATION_PLAN_INPUT_API_VERSION;
  discoveryInput: BuilderDiscoveryInputV1;
  registeredCapabilities: readonly BuilderCapabilityRegistrationV1[];
  authorityInput: BuilderAuthorityInputV1;
  scaffoldKind: BuilderScaffoldKindV1;
}>;

export type BuilderPlannedSystemManifestV1 = Readonly<{
  schemaVersion: typeof BUILDER_PLANNED_SYSTEM_MANIFEST_API_VERSION;
  sourceManifestId: string;
  sourceManifestDigest: string;
  tenant: string;
  systemId: string;
  systemType: string;
  dataClassification: "SYNTHETIC";
  objectTypes: readonly string[];
  operationIds: readonly string[];
  manifestDigest: string;
}>;

export type BuilderObjectDependencyGraphV1 = Readonly<{
  schemaVersion: typeof BUILDER_OBJECT_GRAPH_API_VERSION;
  nodes: readonly Readonly<{ objectType: string; description: string }>[];
  edges: readonly Readonly<{
    fromObjectType: string;
    toDependencyObjectType: string;
  }>[];
  graphDigest: string;
}>;

export type BuilderRollbackStrategyV1 =
  | "NOT_APPLICABLE_READ_ONLY"
  | "RESTORE_PRIOR_VALUE"
  | "OWNER_DEFINED_RECOVERY_REQUIRED"
  | "DEACTIVATE_AND_REMOVE_OWNED_RESIDUE"
  | "WITHDRAWAL_OR_CORRECTION_REQUIRED";

export type BuilderGenericIntegrationContractV1 = Readonly<{
  schemaVersion: typeof BUILDER_GENERIC_CONTRACT_API_VERSION;
  contractId: string;
  templateId:
    | "chimpmaera.builder/generic-adapter-contract/v1"
    | "chimpmaera.builder/generic-skill-contract/v1";
  scaffoldKind: BuilderScaffoldKindV1;
  operationId: string;
  objectType: string;
  effectClass: BuilderDiscoveryEffectClassV1;
  capabilityState: "REUSE_REGISTERED" | "UNRESOLVED_INTENT";
  capabilityRef: string;
  capabilityBindingDigest: string;
  lifecycleState: "INACTIVE";
  executable: false;
  authorityGranted: false;
  effectAuthorized: false;
}>;

export type BuilderProfileDiffV1 = Readonly<{
  selectedProfile: BuilderAuthorityProfileV1;
  entries: readonly Readonly<{
    rightId: string;
    effectClass: BuilderDiscoveryEffectClassV1;
    safeGuidedRoute: Exclude<BuilderAuthorityRouteV1, "DENY">;
    selectedRoute: BuilderAuthorityRouteV1;
    changedFromSafeGuided: boolean;
    effective: boolean;
    reasonFacts: readonly string[];
  }>[];
}>;

export type BuilderSyntheticFixtureV1 = Readonly<{
  fixtureId: string;
  operationId: string;
  dataClassification: "SYNTHETIC";
  mode: "READ_EXPECTATION" | "REVERSIBLE_WRITE_ROLLBACK" | "EFFECT_RECOVERY_PROBE";
  assertions: readonly string[];
}>;

export type BuilderRollbackPlanV1 = Readonly<{
  operationId: string;
  requiredBeforeActivation: boolean;
  strategy: BuilderRollbackStrategyV1;
  contextRefs: readonly string[];
  successEvidence: readonly string[];
}>;

export type BuilderIntegrationPlanV1 = Readonly<{
  schemaVersion: typeof BUILDER_INTEGRATION_PLAN_API_VERSION;
  claim: "DATA_ONLY_GENERIC_PLAN_NO_AUTHORITY_EFFECT_ACTIVATION_OR_PUBLICATION";
  tenant: string;
  systemId: string;
  systemType: string;
  planningStatus: "PREPARATION_REQUIRED" | "READY_FOR_QUALITY_GATE";
  sourceBindings: Readonly<{
    discoveryRecordDigest: string;
    capabilityResolutionDigest: string;
    authorityResultDigest: string;
  }>;
  systemManifest: BuilderPlannedSystemManifestV1;
  objectDependencyGraph: BuilderObjectDependencyGraphV1;
  integrationContracts: readonly BuilderGenericIntegrationContractV1[];
  profileDiff: BuilderProfileDiffV1;
  fixtures: readonly BuilderSyntheticFixtureV1[];
  rollbackPlan: readonly BuilderRollbackPlanV1[];
  inputDigest: string;
  planDigest: string;
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
  throw new Error("BUILDER_INTEGRATION_PLAN_INVALID_DENIED");
}

function safeGuidedRoute(
  effectClass: BuilderDiscoveryEffectClassV1,
): Exclude<BuilderAuthorityRouteV1, "DENY"> {
  return effectClass === "READ_ONLY" ? "AUTO_EXECUTE" : "OWNER_APPROVAL";
}

function rollbackStrategy(
  effectClass: BuilderDiscoveryEffectClassV1,
): BuilderRollbackStrategyV1 {
  const strategies: Record<BuilderDiscoveryEffectClassV1, BuilderRollbackStrategyV1> = {
    READ_ONLY: "NOT_APPLICABLE_READ_ONLY",
    REVERSIBLE_WRITE: "RESTORE_PRIOR_VALUE",
    IRREVERSIBLE_EFFECT: "OWNER_DEFINED_RECOVERY_REQUIRED",
    INSTALL_ACTIVATE: "DEACTIVATE_AND_REMOVE_OWNED_RESIDUE",
    PUBLICATION: "WITHDRAWAL_OR_CORRECTION_REQUIRED",
  };
  return strategies[effectClass];
}

function fixtureMode(
  effectClass: BuilderDiscoveryEffectClassV1,
): BuilderSyntheticFixtureV1["mode"] {
  if (effectClass === "READ_ONLY") return "READ_EXPECTATION";
  if (effectClass === "REVERSIBLE_WRITE") return "REVERSIBLE_WRITE_ROLLBACK";
  return "EFFECT_RECOVERY_PROBE";
}

function fixtureAssertions(effectClass: BuilderDiscoveryEffectClassV1): string[] {
  if (effectClass === "READ_ONLY") {
    return ["NO_STATE_CHANGE", "BOUNDED_READBACK", "RECEIPT_REQUIRED"];
  }
  if (effectClass === "REVERSIBLE_WRITE") {
    return ["PRIOR_VALUE_CAPTURED", "BOUNDED_READBACK", "ROLLBACK_PROVEN", "RECEIPT_REQUIRED"];
  }
  return ["OWNER_ROUTE_REQUIRED", "RECOVERY_EVIDENCE_REQUIRED", "RECEIPT_REQUIRED"];
}

export function planBuilderIntegrationV1(input: unknown): BuilderIntegrationPlanV1 {
  if (!exactKeys(input, [
    "authorityInput",
    "discoveryInput",
    "registeredCapabilities",
    "scaffoldKind",
    "schemaVersion",
  ])
    || input.schemaVersion !== BUILDER_INTEGRATION_PLAN_INPUT_API_VERSION
    || !BUILDER_SCAFFOLD_KINDS_V1.includes(input.scaffoldKind as BuilderScaffoldKindV1)
    || !isRecord(input.discoveryInput)
    || input.discoveryInput.schemaVersion !== BUILDER_DISCOVERY_INPUT_API_VERSION
    || !isRecord(input.authorityInput)
    || input.authorityInput.schemaVersion !== BUILDER_AUTHORITY_INPUT_API_VERSION
    || !Array.isArray(input.registeredCapabilities)) return invalid();

  const discoveryInput = input.discoveryInput as unknown as BuilderDiscoveryInputV1;
  const registeredCapabilities = input.registeredCapabilities as unknown as
    readonly BuilderCapabilityRegistrationV1[];
  const authorityInput = input.authorityInput as unknown as BuilderAuthorityInputV1;
  const scaffoldKind = input.scaffoldKind as BuilderScaffoldKindV1;

  const discovery = discoverBuilderSystemV1(discoveryInput);
  const capabilityResolution = resolveBuilderCapabilitiesV1({
    schemaVersion: BUILDER_CAPABILITY_RESOLUTION_INPUT_API_VERSION,
    discovery,
    registeredCapabilities,
  });
  const authority = resolveBuilderAuthorityV1(authorityInput);
  if (
    authority.tenant !== discovery.tenant
    || authority.actor !== discovery.actor
    || capabilityResolution.tenant !== discovery.tenant
    || capabilityResolution.systemId !== discovery.system.systemId
    || capabilityResolution.discoveryRecordDigest !== discovery.recordDigest
  ) return invalid();

  const operationsById = new Map(
    discovery.discoveredOperations.map((operation) => [operation.operationId, operation]),
  );
  if (
    authority.decisions.length !== operationsById.size
    || authority.decisions.some((decision) => {
      const operation = operationsById.get(decision.rightId);
      return operation === undefined || operation.effectClass !== decision.effectClass;
    })
  ) return invalid();

  const systemManifestCore = {
    schemaVersion: BUILDER_PLANNED_SYSTEM_MANIFEST_API_VERSION,
    sourceManifestId: discovery.system.manifestId,
    sourceManifestDigest: discovery.sourceDigests.manifest,
    tenant: discovery.tenant,
    systemId: discovery.system.systemId,
    systemType: discovery.system.systemType,
    dataClassification: "SYNTHETIC" as const,
    objectTypes: discovery.discoveredObjects.map(({ objectType }) => objectType).sort(),
    operationIds: discovery.discoveredOperations.map(({ operationId }) => operationId).sort(),
  };
  const systemManifest: BuilderPlannedSystemManifestV1 = {
    ...systemManifestCore,
    manifestDigest: digest(systemManifestCore),
  };

  const graphCore = {
    schemaVersion: BUILDER_OBJECT_GRAPH_API_VERSION,
    nodes: discovery.discoveredObjects.map(({ objectType, description }) => ({
      objectType,
      description,
    })).sort((left, right) => left.objectType.localeCompare(right.objectType)),
    edges: discovery.discoveredObjects.flatMap(({ objectType, dependencyObjectTypes }) =>
      dependencyObjectTypes.map((toDependencyObjectType) => ({
        fromObjectType: objectType,
        toDependencyObjectType,
      }))).sort((left, right) =>
      `${left.fromObjectType}:${left.toDependencyObjectType}`.localeCompare(
        `${right.fromObjectType}:${right.toDependencyObjectType}`,
      )),
  };
  const objectDependencyGraph: BuilderObjectDependencyGraphV1 = {
    ...graphCore,
    graphDigest: digest(graphCore),
  };

  const reusedByOperation = new Map(
    capabilityResolution.reusedCapabilities.map((entry) => [entry.operationId, entry]),
  );
  const unresolvedByOperation = new Map(
    capabilityResolution.unresolvedIntents.map((entry) => [entry.operationId, entry]),
  );
  const templateId = scaffoldKind === "ADAPTER"
    ? "chimpmaera.builder/generic-adapter-contract/v1" as const
    : "chimpmaera.builder/generic-skill-contract/v1" as const;

  const integrationContracts = discovery.discoveredOperations.map((operation) => {
    const reused = reusedByOperation.get(operation.operationId);
    const unresolved = unresolvedByOperation.get(operation.operationId);
    if ((reused === undefined) === (unresolved === undefined)) return invalid();
    const capabilityState = reused === undefined
      ? "UNRESOLVED_INTENT" as const
      : "REUSE_REGISTERED" as const;
    const capabilityRef = reused?.capabilityId ?? unresolved?.proposalId;
    if (capabilityRef === undefined) return invalid();
    const capabilityBindingDigest = reused?.descriptorDigest ?? digest(unresolved);
    const contractSeed = {
      discoveryRecordDigest: discovery.recordDigest,
      operationId: operation.operationId,
      scaffoldKind,
      capabilityRef,
      capabilityBindingDigest,
    };
    return {
      schemaVersion: BUILDER_GENERIC_CONTRACT_API_VERSION,
      contractId: `contract:${digest(contractSeed).slice(0, 24)}`,
      templateId,
      scaffoldKind,
      operationId: operation.operationId,
      objectType: operation.objectType,
      effectClass: operation.effectClass,
      capabilityState,
      capabilityRef,
      capabilityBindingDigest,
      lifecycleState: "INACTIVE" as const,
      executable: false as const,
      authorityGranted: false as const,
      effectAuthorized: false as const,
    };
  }).sort((left, right) => left.operationId.localeCompare(right.operationId));

  const profileDiff: BuilderProfileDiffV1 = {
    selectedProfile: authority.profile.selected,
    entries: authority.decisions.map((decision) => {
      const baseline = safeGuidedRoute(decision.effectClass);
      return {
        rightId: decision.rightId,
        effectClass: decision.effectClass,
        safeGuidedRoute: baseline,
        selectedRoute: decision.route,
        changedFromSafeGuided: decision.route !== baseline,
        effective: decision.effective,
        reasonFacts: decision.reasonFacts,
      };
    }).sort((left, right) => left.rightId.localeCompare(right.rightId)),
  };

  const fixtures = discovery.discoveredOperations.map((operation) => ({
    fixtureId: `fixture:${digest({
      discoveryRecordDigest: discovery.recordDigest,
      operationId: operation.operationId,
    }).slice(0, 24)}`,
    operationId: operation.operationId,
    dataClassification: "SYNTHETIC" as const,
    mode: fixtureMode(operation.effectClass),
    assertions: fixtureAssertions(operation.effectClass),
  })).sort((left, right) => left.operationId.localeCompare(right.operationId));

  const contextsById = new Map(
    discovery.selectedContexts.map((context) => [context.contextId, context]),
  );
  const rollbackPlan = discovery.discoveredOperations.map((operation) => {
    const contextRefs = operation.contextRefs.filter((reference) => {
      const kind = contextsById.get(reference)?.kind;
      return kind === "ROLLBACK" || kind === "SAFETY";
    }).sort();
    return {
      operationId: operation.operationId,
      requiredBeforeActivation: operation.effectClass !== "READ_ONLY",
      strategy: rollbackStrategy(operation.effectClass),
      contextRefs,
      successEvidence: operation.effectClass === "READ_ONLY"
        ? ["NO_STATE_CHANGE", "READ_RECEIPT"]
        : ["PRIOR_VALUE", "POST_WRITE_READBACK", "ROLLBACK_READBACK", "EFFECT_RECEIPT"],
    };
  }).sort((left, right) => left.operationId.localeCompare(right.operationId));

  const inputBinding = {
    schemaVersion: BUILDER_INTEGRATION_PLAN_INPUT_API_VERSION,
    discoveryRecordDigest: discovery.recordDigest,
    capabilityResolutionDigest: capabilityResolution.resultDigest,
    authorityResultDigest: authority.resultDigest,
    scaffoldKind,
  };
  const core = {
    schemaVersion: BUILDER_INTEGRATION_PLAN_API_VERSION,
    claim: "DATA_ONLY_GENERIC_PLAN_NO_AUTHORITY_EFFECT_ACTIVATION_OR_PUBLICATION" as const,
    tenant: discovery.tenant,
    systemId: discovery.system.systemId,
    systemType: discovery.system.systemType,
    planningStatus: capabilityResolution.unresolvedIntents.length > 0
      ? "PREPARATION_REQUIRED" as const
      : "READY_FOR_QUALITY_GATE" as const,
    sourceBindings: {
      discoveryRecordDigest: discovery.recordDigest,
      capabilityResolutionDigest: capabilityResolution.resultDigest,
      authorityResultDigest: authority.resultDigest,
    },
    systemManifest,
    objectDependencyGraph,
    integrationContracts,
    profileDiff,
    fixtures,
    rollbackPlan,
    inputDigest: digest(inputBinding),
  };
  return { ...core, planDigest: digest(core) };
}

export function verifyBuilderIntegrationPlanV1(value: unknown): BuilderIntegrationPlanV1 {
  if (!exactKeys(value, [
    "claim",
    "fixtures",
    "inputDigest",
    "integrationContracts",
    "objectDependencyGraph",
    "planDigest",
    "planningStatus",
    "profileDiff",
    "rollbackPlan",
    "schemaVersion",
    "sourceBindings",
    "systemId",
    "systemManifest",
    "systemType",
    "tenant",
  ])) return invalid();
  const { planDigest, ...core } = value;
  if (
    value.schemaVersion !== BUILDER_INTEGRATION_PLAN_API_VERSION
    || value.claim !== "DATA_ONLY_GENERIC_PLAN_NO_AUTHORITY_EFFECT_ACTIVATION_OR_PUBLICATION"
    || typeof planDigest !== "string"
    || !/^[a-f0-9]{64}$/.test(planDigest)
    || digest(core) !== planDigest
  ) return invalid();
  const serialized = canonicalJson(value);
  for (const forbidden of [
    "credentialHandle", "credentialValue", "rawPayload", "providerCall",
    "effectCallback", "activationToken", "approvalToken", "executableCode",
    "customerScript",
  ]) if (serialized.includes(`\"${forbidden}\"`)) return invalid();
  return value as unknown as BuilderIntegrationPlanV1;
}
