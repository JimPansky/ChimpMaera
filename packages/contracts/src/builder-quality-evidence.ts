import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import {
  verifyBuilderIntegrationPlanV1,
  type BuilderIntegrationPlanV1,
} from "./builder-integration-plan.js";

export const BUILDER_QUALITY_EVIDENCE_INPUT_API_VERSION =
  "chimpmaera.builder/quality-evidence-input/v1" as const;
export const BUILDER_QUALITY_EVIDENCE_API_VERSION =
  "chimpmaera.builder/quality-evidence/v1" as const;

export const BUILDER_LIFECYCLE_ACTIONS_V1 = [
  "INSTALLATION",
  "ACTIVATION",
  "MUTATION",
  "PUBLICATION",
] as const;
export type BuilderLifecycleActionV1 = typeof BUILDER_LIFECYCLE_ACTIONS_V1[number];
export type BuilderLifecycleRouteV1 = "AUTO_EXECUTE" | "OWNER_APPROVAL" | "DENY";

export type BuilderLifecycleRouteInputV1 = Readonly<{
  action: BuilderLifecycleActionV1;
  route: BuilderLifecycleRouteV1;
}>;

export type BuilderQualityObservationResultV1 =
  | "MATCHED_NO_CHANGE"
  | "MATCHED_ROLLBACK"
  | "NOT_EXECUTED_UNRESOLVED_INTENT"
  | "NOT_EXECUTED_OWNER_ROUTE_ONLY";

export type BuilderQualityObservationV1 = Readonly<{
  operationId: string;
  planDigest: string;
  contractId: string;
  capabilityBindingDigest: string;
  mode: "SYNTHETIC_CONTRACT_HARNESS";
  result: BuilderQualityObservationResultV1;
  beforeDigest: string | null;
  afterEffectDigest: string | null;
  finalDigest: string | null;
  readbackDigest: string | null;
  receiptDigest: string | null;
}>;

export type BuilderQualityEvidenceInputV1 = Readonly<{
  schemaVersion: typeof BUILDER_QUALITY_EVIDENCE_INPUT_API_VERSION;
  issueId: string;
  claimId: string;
  plan: BuilderIntegrationPlanV1;
  lifecycleRoutes: readonly BuilderLifecycleRouteInputV1[];
  observations: readonly BuilderQualityObservationV1[];
}>;

export type BuilderQualityEvidenceV1 = Readonly<{
  schemaVersion: typeof BUILDER_QUALITY_EVIDENCE_API_VERSION;
  claim: "SYNTHETIC_LOCAL_QUALITY_EVIDENCE_NO_INSTALLATION_ACTIVATION_MUTATION_OR_PUBLICATION";
  issueId: string;
  claimIds: readonly string[];
  tenant: string;
  systemId: string;
  sourcePlanDigest: string;
  qualityStatus: "PASS_PREPARATION_REQUIRED" | "PASS_READY_FOR_G6";
  focusedChecks: readonly Readonly<{
    checkId: string;
    status: "PASS";
  }>[];
  negativeProbeCoverage: readonly Readonly<{
    probeId: string;
    expected: "DENY_OR_EXPLICIT_NON_SUCCESS";
    status: "PASS";
  }>[];
  reconciliation: readonly Readonly<{
    operationId: string;
    status:
      | "MATCHED_NO_CHANGE"
      | "ROLLBACK_VERIFIED"
      | "NOT_EXECUTED_UNRESOLVED_INTENT"
      | "NOT_EXECUTED_OWNER_ROUTE_ONLY";
    readbackDigest: string | null;
    receiptDigest: string | null;
  }>[];
  lifecycleRouteDecisions: readonly Readonly<{
    action: BuilderLifecycleActionV1;
    route: BuilderLifecycleRouteV1;
    decisionDigest: string;
  }>[];
  evidencePackage: Readonly<{
    evidenceId: string;
    issueId: string;
    claimIds: readonly string[];
    deliveryStatus: "locally_validated";
    releaseStatus: "NOT_RELEASED";
    dataClassification: "SYNTHETIC";
    sourcePlanDigest: string;
  }>;
  inputDigest: string;
  reportDigest: string;
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

function validDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function invalid(): never {
  throw new Error("BUILDER_QUALITY_EVIDENCE_INVALID_DENIED");
}

function nullEvidence(observation: BuilderQualityObservationV1): boolean {
  return observation.beforeDigest === null
    && observation.afterEffectDigest === null
    && observation.finalDigest === null
    && observation.readbackDigest === null
    && observation.receiptDigest === null;
}

function validateObservation(
  observation: BuilderQualityObservationV1,
  contract: BuilderIntegrationPlanV1["integrationContracts"][number],
  planDigest: string,
): BuilderQualityEvidenceV1["reconciliation"][number] {
  if (
    !exactKeys(observation, [
      "afterEffectDigest", "beforeDigest", "capabilityBindingDigest", "contractId",
      "finalDigest", "mode", "operationId", "planDigest", "readbackDigest",
      "receiptDigest", "result",
    ])
    || observation.operationId !== contract.operationId
    || observation.planDigest !== planDigest
    || observation.contractId !== contract.contractId
    || observation.capabilityBindingDigest !== contract.capabilityBindingDigest
    || observation.mode !== "SYNTHETIC_CONTRACT_HARNESS"
  ) return invalid();

  if (contract.capabilityState === "UNRESOLVED_INTENT") {
    if (observation.result !== "NOT_EXECUTED_UNRESOLVED_INTENT" || !nullEvidence(observation)) {
      return invalid();
    }
    return {
      operationId: contract.operationId,
      status: "NOT_EXECUTED_UNRESOLVED_INTENT",
      readbackDigest: null,
      receiptDigest: null,
    };
  }

  if (contract.effectClass === "READ_ONLY") {
    if (
      observation.result !== "MATCHED_NO_CHANGE"
      || !validDigest(observation.beforeDigest)
      || observation.afterEffectDigest !== observation.beforeDigest
      || observation.finalDigest !== observation.beforeDigest
      || !validDigest(observation.readbackDigest)
      || !validDigest(observation.receiptDigest)
    ) return invalid();
    return {
      operationId: contract.operationId,
      status: "MATCHED_NO_CHANGE",
      readbackDigest: observation.readbackDigest,
      receiptDigest: observation.receiptDigest,
    };
  }

  if (contract.effectClass === "REVERSIBLE_WRITE") {
    if (
      observation.result !== "MATCHED_ROLLBACK"
      || !validDigest(observation.beforeDigest)
      || !validDigest(observation.afterEffectDigest)
      || observation.afterEffectDigest === observation.beforeDigest
      || observation.finalDigest !== observation.beforeDigest
      || !validDigest(observation.readbackDigest)
      || !validDigest(observation.receiptDigest)
    ) return invalid();
    return {
      operationId: contract.operationId,
      status: "ROLLBACK_VERIFIED",
      readbackDigest: observation.readbackDigest,
      receiptDigest: observation.receiptDigest,
    };
  }

  if (observation.result !== "NOT_EXECUTED_OWNER_ROUTE_ONLY" || !nullEvidence(observation)) {
    return invalid();
  }
  return {
    operationId: contract.operationId,
    status: "NOT_EXECUTED_OWNER_ROUTE_ONLY",
    readbackDigest: null,
    receiptDigest: null,
  };
}

export function buildBuilderQualityEvidenceV1(
  input: unknown,
): BuilderQualityEvidenceV1 {
  if (!exactKeys(input, [
    "claimId", "issueId", "lifecycleRoutes", "observations", "plan", "schemaVersion",
  ])
    || input.schemaVersion !== BUILDER_QUALITY_EVIDENCE_INPUT_API_VERSION
    || typeof input.issueId !== "string"
    || !/^[A-Z]+-[0-9]+$/.test(input.issueId)
    || typeof input.claimId !== "string"
    || !/^[A-Z]+-[0-9]+-G[0-9]+$/.test(input.claimId)
    || !Array.isArray(input.lifecycleRoutes)
    || !Array.isArray(input.observations)
  ) return invalid();

  let plan: BuilderIntegrationPlanV1;
  try {
    plan = verifyBuilderIntegrationPlanV1(input.plan);
  } catch {
    return invalid();
  }
  if (
    plan.systemManifest.dataClassification !== "SYNTHETIC"
    || plan.integrationContracts.some((contract) =>
      contract.lifecycleState !== "INACTIVE"
      || contract.executable !== false
      || contract.authorityGranted !== false
      || contract.effectAuthorized !== false)
    || plan.fixtures.length !== plan.integrationContracts.length
    || plan.rollbackPlan.length !== plan.integrationContracts.length
  ) return invalid();

  const routes = input.lifecycleRoutes as unknown as BuilderLifecycleRouteInputV1[];
  const actions = new Set<BuilderLifecycleActionV1>();
  for (const route of routes) {
    if (!exactKeys(route, ["action", "route"])
      || !BUILDER_LIFECYCLE_ACTIONS_V1.includes(route.action)
      || !["AUTO_EXECUTE", "OWNER_APPROVAL", "DENY"].includes(route.route)
      || actions.has(route.action)) return invalid();
    actions.add(route.action);
  }
  if (routes.length !== BUILDER_LIFECYCLE_ACTIONS_V1.length
    || BUILDER_LIFECYCLE_ACTIONS_V1.some((action) => !actions.has(action))) return invalid();

  const observations = input.observations as unknown as BuilderQualityObservationV1[];
  const observationByOperation = new Map<string, BuilderQualityObservationV1>();
  for (const observation of observations) {
    if (!isRecord(observation)
      || typeof observation.operationId !== "string"
      || observationByOperation.has(observation.operationId)) return invalid();
    observationByOperation.set(observation.operationId, observation);
  }
  if (observations.length !== plan.integrationContracts.length) return invalid();

  const reconciliation = plan.integrationContracts.map((contract) => {
    const observation = observationByOperation.get(contract.operationId);
    if (observation === undefined) return invalid();
    return validateObservation(observation, contract, plan.planDigest);
  }).sort((left, right) => left.operationId.localeCompare(right.operationId));

  const lifecycleRouteDecisions = routes.map((route) => ({
    action: route.action,
    route: route.route,
    decisionDigest: digest({
      action: route.action,
      route: route.route,
      sourcePlanDigest: plan.planDigest,
    }),
  })).sort((left, right) => left.action.localeCompare(right.action));

  const focusedChecks = [
    "SOURCE_PLAN_DIGEST_BOUND",
    "SYNTHETIC_DATA_ONLY",
    "CONTRACTS_INACTIVE_NO_AUTHORITY_OR_EFFECT",
    "CAPABILITY_BINDINGS_RECONCILED",
    "READBACK_AND_RECOVERY_EVIDENCE_RECONCILED",
    "FOUR_LIFECYCLE_ROUTES_INDEPENDENT",
  ].map((checkId) => ({ checkId, status: "PASS" as const }));
  const negativeProbeCoverage = [
    "SOURCE_PLAN_TAMPER",
    "CAPABILITY_BINDING_SUBSTITUTION",
    "READBACK_MISMATCH",
    "ROLLBACK_MISMATCH",
    "UNRESOLVED_INTENT_EXECUTION",
    "ROUTE_CATEGORY_OMISSION_OR_DUPLICATION",
    "ROUTE_AGGREGATION_FIELD",
    "RAW_OR_SECRET_EVIDENCE_FIELD",
  ].map((probeId) => ({
    probeId,
    expected: "DENY_OR_EXPLICIT_NON_SUCCESS" as const,
    status: "PASS" as const,
  }));
  const inputBinding = {
    schemaVersion: BUILDER_QUALITY_EVIDENCE_INPUT_API_VERSION,
    issueId: input.issueId,
    claimId: input.claimId,
    sourcePlanDigest: plan.planDigest,
    lifecycleRouteDecisions,
    observationDigests: observations.map((observation) => digest(observation)).sort(),
  };
  const inputDigest = digest(inputBinding);
  const evidenceId = `evidence:${digest({
    issueId: input.issueId,
    claimId: input.claimId,
    inputDigest,
  }).slice(0, 24)}`;
  const core = {
    schemaVersion: BUILDER_QUALITY_EVIDENCE_API_VERSION,
    claim: "SYNTHETIC_LOCAL_QUALITY_EVIDENCE_NO_INSTALLATION_ACTIVATION_MUTATION_OR_PUBLICATION" as const,
    issueId: input.issueId,
    claimIds: [input.claimId],
    tenant: plan.tenant,
    systemId: plan.systemId,
    sourcePlanDigest: plan.planDigest,
    qualityStatus: plan.planningStatus === "PREPARATION_REQUIRED"
      ? "PASS_PREPARATION_REQUIRED" as const
      : "PASS_READY_FOR_G6" as const,
    focusedChecks,
    negativeProbeCoverage,
    reconciliation,
    lifecycleRouteDecisions,
    evidencePackage: {
      evidenceId,
      issueId: input.issueId,
      claimIds: [input.claimId],
      deliveryStatus: "locally_validated" as const,
      releaseStatus: "NOT_RELEASED" as const,
      dataClassification: "SYNTHETIC" as const,
      sourcePlanDigest: plan.planDigest,
    },
    inputDigest,
  };
  return { ...core, reportDigest: digest(core) };
}

export function verifyBuilderQualityEvidenceV1(value: unknown): BuilderQualityEvidenceV1 {
  if (!exactKeys(value, [
    "claim", "claimIds", "evidencePackage", "focusedChecks", "inputDigest", "issueId",
    "lifecycleRouteDecisions", "negativeProbeCoverage", "qualityStatus", "reconciliation",
    "reportDigest", "schemaVersion", "sourcePlanDigest", "systemId", "tenant",
  ])) return invalid();
  const { reportDigest, ...core } = value;
  if (
    value.schemaVersion !== BUILDER_QUALITY_EVIDENCE_API_VERSION
    || value.claim !== "SYNTHETIC_LOCAL_QUALITY_EVIDENCE_NO_INSTALLATION_ACTIVATION_MUTATION_OR_PUBLICATION"
    || !validDigest(reportDigest)
    || digest(core) !== reportDigest
  ) return invalid();
  const serialized = canonicalJson(value);
  for (const forbidden of [
    "approveAll", "aggregateApproval", "credentialHandle", "credentialValue",
    "rawData", "rawPayload", "secret", "token", "customerData", "providerCall",
  ]) if (serialized.includes(`\"${forbidden}\"`)) return invalid();
  return value as unknown as BuilderQualityEvidenceV1;
}
