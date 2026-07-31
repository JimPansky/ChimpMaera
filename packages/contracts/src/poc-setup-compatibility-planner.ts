import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import {
  POC_GUIDED_DEMO_TEMPLATE_API_VERSION,
  buildPocGuidedDemoSetupPlanV1,
  verifyPocGuidedDemoSetupPlanV1,
  type PocGuidedDemoSetupPlanV1,
  type PocGuidedDemoTemplateV1,
} from "./poc-guided-demo-bootstrap.js";
import type { PocAdminAuthorityProfileIdV1 } from "./poc-early-admin-ai-setup.js";
import type { PocShowcaseV1 } from "./poc-showcase.js";

export const POC_SETUP_COMPATIBILITY_CATALOG_API_VERSION =
  "chimpmaera.dev/poc-setup-compatibility-catalog/v1" as const;
export const POC_SETUP_COMPATIBILITY_REQUEST_API_VERSION =
  "chimpmaera.dev/poc-setup-compatibility-request/v1" as const;
export const POC_SETUP_COMPATIBILITY_PLAN_API_VERSION =
  "chimpmaera.dev/poc-setup-compatibility-plan/v1" as const;

export type PocSetupCompatibilityStatusV1 =
  | "READY_REAL"
  | "READY_SIMULATED"
  | "PARTIAL_MISSING"
  | "INCOMPATIBLE";

export type PocSetupPlannerModeV1 = "USE_CASE_FIRST" | "SYSTEM_FIRST";
export type PocSetupFrontdoorPathV1 =
  | "RECOMMENDED_DEMO"
  | "COMPOSE_DEMO"
  | "LOAD_CUSTOM_OR_COMMUNITY";
export type PocSetupComponentKindV1 =
  | "SYSTEM"
  | "TOOL"
  | "MODULE"
  | "PROVIDER"
  | "SIMULATOR";

type ProvenanceV1 = Readonly<{
  source: "BUILTIN" | "COMMUNITY" | "CUSTOM";
  label: string;
  trustTier: "CURATED_VERIFIED" | "COMMUNITY_UNVERIFIED" | "CUSTOM_UNVERIFIED";
  rights: string;
  manifestPath: string;
  digest: string;
}>;

export type PocSetupComponentV1 = Readonly<{
  componentId: string;
  kind: PocSetupComponentKindV1;
  displayName: string;
  version: string;
  executionMode: "REAL" | "SYNTHETIC" | "SUPPORT";
  capabilityIds: readonly string[];
  requiredDependencies: readonly Readonly<{
    componentId: string;
    versionConstraint: string;
  }>[];
  incompatibleWith: readonly string[];
  downloadBytes: number;
  diskBytes: number;
  networkAccess: readonly string[];
  effects: readonly string[];
  provenance: Readonly<{
    label: string;
    trustTier: ProvenanceV1["trustTier"];
    rights: string;
  }>;
}>;

export type PocSetupUseCaseV1 = Readonly<{
  useCaseId: string;
  displayName: string;
  requiredCapabilities: readonly string[];
  requiredComponents: readonly Readonly<{
    componentId: string;
    versionConstraint: string;
  }>[];
  providerAlternatives: readonly Readonly<{
    groupId: string;
    capabilityId: string;
    oneOfComponentIds: readonly string[];
  }>[];
  recommendedComponentIds: readonly string[];
  optionalComponentIds: readonly string[];
  syntheticSimulatorComponentId: string | null;
  incompatibleWithComponentIds: readonly string[];
  effects: readonly string[];
}>;

export type PocSetupBaseTemplateV1 = Readonly<{
  templateId: string;
  displayName: string;
  recommended: boolean;
  selectedUseCaseIds: readonly string[];
  defaultComponentIds: readonly string[];
  recommendedComponentIds: readonly string[];
  requestedAuthorityProfile: PocAdminAuthorityProfileIdV1;
}>;

export type PocSetupCompatibilityCatalogV1 = Readonly<{
  apiVersion: typeof POC_SETUP_COMPATIBILITY_CATALOG_API_VERSION;
  kind: "PocSetupCompatibilityCatalog";
  catalogId: string;
  catalogVersion: string;
  provenance: ProvenanceV1;
  capabilityIds: readonly string[];
  components: readonly PocSetupComponentV1[];
  useCases: readonly PocSetupUseCaseV1[];
  baseTemplates: readonly PocSetupBaseTemplateV1[];
}>;

export type PocSetupCompatibilityRequestV1 = Readonly<{
  apiVersion: typeof POC_SETUP_COMPATIBILITY_REQUEST_API_VERSION;
  kind: "PocSetupCompatibilityRequest";
  frontdoorPath: PocSetupFrontdoorPathV1;
  mode: PocSetupPlannerModeV1;
  baseTemplateId: string;
  selectedUseCaseIds: readonly string[];
  selectedComponentIds: readonly string[];
  providerSelections: Readonly<Record<string, string>>;
  executionPreference: "REAL_PREFERRED" | "SIMULATION_ONLY";
  completeBundle: boolean;
  authorityProfile: PocAdminAuthorityProfileIdV1;
}>;

export type PocSetupUseCaseCompatibilityV1 = Readonly<{
  useCaseId: string;
  displayName: string;
  status: PocSetupCompatibilityStatusV1;
  selectedProviderIds: readonly string[];
  missingRequirements: readonly string[];
  incompatibleReasons: readonly string[];
  simulatorAvailable: boolean;
  completionComponentIds: readonly string[];
}>;

export type PocSetupCompatibilityAnalysisV1 = Readonly<{
  mode: PocSetupPlannerModeV1;
  selectedUseCaseIds: readonly string[];
  selectedComponentIds: readonly string[];
  automaticallyAdded: readonly Readonly<{
    componentId: string;
    reason: string;
  }>[];
  requiredComponentIds: readonly string[];
  recommendedComponentIds: readonly string[];
  optionalComponentIds: readonly string[];
  missingComponentIds: readonly string[];
  useCases: readonly PocSetupUseCaseCompatibilityV1[];
  resources: Readonly<{
    downloadBytes: number;
    diskBytes: number;
    networkAccess: readonly string[];
    effects: readonly string[];
  }>;
  catalogDigest: string;
  analysisDigest: string;
}>;

export type PocSetupCompatibilityPlanV1 = Readonly<{
  apiVersion: typeof POC_SETUP_COMPATIBILITY_PLAN_API_VERSION;
  kind: "PocSetupCompatibilityPlan";
  frontdoor: Readonly<{
    paths: readonly PocSetupFrontdoorPathV1[];
    selected: PocSetupFrontdoorPathV1;
    enterAcceptsSafeRecommendedDefaults: true;
    baseTemplateSelection: "SINGLE_SELECT";
    additionalComponentsSelection: "CHECKBOX_MULTI_SELECT";
    questionPolicy: "NO_FIXED_MAXIMUM_ASK_ONLY_WHEN_REQUIRED";
  }>;
  request: PocSetupCompatibilityRequestV1;
  authorityBinding: Readonly<{
    requested: PocAdminAuthorityProfileIdV1;
    activeDuringPlanning: "SAFE_GUIDED";
    customCatalogMayRequestButNeverActivateFullControl: true;
    ownerActivationRequired: true;
    catalogTrustTier: ProvenanceV1["trustTier"];
    guidedPlanTrustTier: PocGuidedDemoTemplateV1["provenance"]["trustTier"];
  }>;
  compatibility: PocSetupCompatibilityAnalysisV1;
  guidedSetupPlan: PocGuidedDemoSetupPlanV1;
  lifecycle: Readonly<{
    resume: "DIGEST_BOUND_CHECKPOINT";
    cache: "VERIFY_BEFORE_REUSE";
    cleanup: "OWNED_STATE_ONLY";
    healthBeforeDemo: true;
    rerunIdempotent: true;
  }>;
  planDigest: string;
}>;

export class PocSetupCompatibilityError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const fail = (code: string): never => {
  throw new PocSetupCompatibilityError(code);
};
const digest = (value: unknown): string =>
  `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
const identifier = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,79}$/;
const semver = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const safeManifestPath = /^(?:examples|catalogs)\/[a-zA-Z0-9._/-]+\.json$/;

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function catalogCore(
  catalog: PocSetupCompatibilityCatalogV1,
): PocSetupCompatibilityCatalogV1 {
  return {
    ...catalog,
    provenance: { ...catalog.provenance, digest: "" },
  };
}

export function sealPocSetupCompatibilityCatalogV1(
  input: Omit<PocSetupCompatibilityCatalogV1, "provenance"> & Readonly<{
    provenance: Omit<ProvenanceV1, "digest"> & Readonly<{ digest?: string }>;
  }>,
): PocSetupCompatibilityCatalogV1 {
  const unsigned = {
    ...input,
    provenance: { ...input.provenance, digest: "" },
  } as PocSetupCompatibilityCatalogV1;
  return {
    ...unsigned,
    provenance: { ...unsigned.provenance, digest: digest(unsigned) },
  };
}

function componentMap(
  catalog: PocSetupCompatibilityCatalogV1,
): ReadonlyMap<string, PocSetupComponentV1> {
  return new Map(catalog.components.map((component) => [
    component.componentId,
    component,
  ]));
}

function parseVersion(value: string): readonly [number, number, number] {
  if (!semver.test(value)) fail("INVALID_COMPONENT_VERSION");
  return value.split(".").map(Number) as unknown as readonly [number, number, number];
}

function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index]! !== b[index]!) return a[index]! - b[index]!;
  }
  return 0;
}

function satisfies(version: string, constraint: string): boolean {
  if (semver.test(constraint)) return compareVersions(version, constraint) === 0;
  const clauses = constraint.split(" ").filter(Boolean);
  if (clauses.length === 0) return false;
  return clauses.every((clause) => {
    const match = /^(>=|<=|>|<)([0-9]+\.[0-9]+\.[0-9]+)$/.exec(clause);
    if (!match) return false;
    const comparison = compareVersions(version, match[2]!);
    return match[1] === ">=" ? comparison >= 0
      : match[1] === "<=" ? comparison <= 0
        : match[1] === ">" ? comparison > 0
          : comparison < 0;
  });
}

function assertSafeManifestPath(path: string): void {
  if (
    !safeManifestPath.test(path)
    || path.startsWith("/")
    || path.includes("..")
    || path.includes("\\")
  ) fail("CATALOG_PATH_TRAVERSAL_DENIED");
}

export function validatePocSetupCompatibilityCatalogV1(
  input: PocSetupCompatibilityCatalogV1,
): PocSetupCompatibilityCatalogV1 {
  const catalog = input;
  if (
    catalog.apiVersion !== POC_SETUP_COMPATIBILITY_CATALOG_API_VERSION
    || catalog.kind !== "PocSetupCompatibilityCatalog"
    || !identifier.test(catalog.catalogId)
    || !semver.test(catalog.catalogVersion)
    || !/^sha256:[a-f0-9]{64}$/.test(catalog.provenance.digest)
    || catalog.provenance.digest !== digest(catalogCore(catalog))
    || !catalog.provenance.label
    || !catalog.provenance.rights
    || catalog.capabilityIds.length === 0
    || catalog.components.length === 0
    || catalog.useCases.length === 0
    || catalog.baseTemplates.length === 0
  ) fail("CATALOG_SCHEMA_OR_DIGEST_INVALID");
  assertSafeManifestPath(catalog.provenance.manifestPath);
  if (
    !unique(catalog.capabilityIds)
    || !unique(catalog.components.map(({ componentId }) => componentId))
    || !unique(catalog.useCases.map(({ useCaseId }) => useCaseId))
    || !unique(catalog.baseTemplates.map(({ templateId }) => templateId))
    || catalog.baseTemplates.filter(({ recommended }) => recommended).length !== 1
  ) fail("CATALOG_DUPLICATE_OR_DEFAULT_INVALID");
  const capabilities = new Set(catalog.capabilityIds);
  const components = componentMap(catalog);
  const useCases = new Set(catalog.useCases.map(({ useCaseId }) => useCaseId));
  for (const component of catalog.components) {
    if (
      !identifier.test(component.componentId)
      || !semver.test(component.version)
      || !unique(component.capabilityIds)
      || component.capabilityIds.some((id) => !capabilities.has(id))
      || component.requiredDependencies.some(({ componentId }) =>
        !components.has(componentId)
      )
      || component.incompatibleWith.some((id) => !components.has(id))
      || component.downloadBytes < 0
      || component.diskBytes < 0
      || !component.provenance.rights
      || !component.provenance.label
    ) fail("COMPONENT_SCHEMA_OR_CAPABILITY_INVALID");
    for (const dependency of component.requiredDependencies) {
      const target = components.get(dependency.componentId)!;
      if (!satisfies(target.version, dependency.versionConstraint)) {
        fail("COMPONENT_VERSION_CONSTRAINT_UNSATISFIED");
      }
    }
  }
  for (const useCase of catalog.useCases) {
    const references = [
      ...useCase.requiredComponents.map(({ componentId }) => componentId),
      ...useCase.providerAlternatives.flatMap(({ oneOfComponentIds }) =>
        oneOfComponentIds
      ),
      ...useCase.recommendedComponentIds,
      ...useCase.optionalComponentIds,
      ...useCase.incompatibleWithComponentIds,
      ...(useCase.syntheticSimulatorComponentId
        ? [useCase.syntheticSimulatorComponentId]
        : []),
    ];
    if (
      !identifier.test(useCase.useCaseId)
      || useCase.requiredCapabilities.some((id) => !capabilities.has(id))
      || useCase.providerAlternatives.some(({ capabilityId }) =>
        !capabilities.has(capabilityId)
      )
      || references.some((id) => !components.has(id))
      || !unique(useCase.providerAlternatives.map(({ groupId }) => groupId))
      || useCase.providerAlternatives.some(({ capabilityId, oneOfComponentIds }) =>
        oneOfComponentIds.length === 0
        || !unique(oneOfComponentIds)
        || oneOfComponentIds.some((id) =>
          !components.get(id)!.capabilityIds.includes(capabilityId)
        )
      )
      || (
        useCase.syntheticSimulatorComponentId !== null
        && components.get(useCase.syntheticSimulatorComponentId)!.kind
          !== "SIMULATOR"
      )
    ) fail("USE_CASE_SCHEMA_OR_REFERENCE_INVALID");
  }
  for (const template of catalog.baseTemplates) {
    if (
      !identifier.test(template.templateId)
      || template.selectedUseCaseIds.some((id) => !useCases.has(id))
      || [...template.defaultComponentIds, ...template.recommendedComponentIds]
        .some((id) => !components.has(id))
    ) fail("BASE_TEMPLATE_REFERENCE_INVALID");
  }
  return catalog;
}

function dependencyClosure(
  components: ReadonlyMap<string, PocSetupComponentV1>,
  initial: ReadonlySet<string>,
): Readonly<{ ids: Set<string>; additions: { componentId: string; reason: string }[] }> {
  const ids = new Set(initial);
  const additions: { componentId: string; reason: string }[] = [];
  const pending = [...ids];
  while (pending.length > 0) {
    const componentId = pending.shift()!;
    const component = components.get(componentId) ?? fail("UNKNOWN_COMPONENT");
    for (const dependency of component.requiredDependencies) {
      const target = components.get(dependency.componentId)
        ?? fail("UNKNOWN_COMPONENT");
      if (!satisfies(target.version, dependency.versionConstraint)) {
        fail("COMPONENT_VERSION_CONSTRAINT_UNSATISFIED");
      }
      if (!ids.has(target.componentId)) {
        ids.add(target.componentId);
        pending.push(target.componentId);
        additions.push({
          componentId: target.componentId,
          reason: `required by ${componentId} (${dependency.versionConstraint})`,
        });
      }
    }
  }
  return { ids, additions };
}

function completionForUseCase(
  useCase: PocSetupUseCaseV1,
  selected: ReadonlySet<string>,
  providerSelections: Readonly<Record<string, string>>,
): string[] {
  const completion = useCase.requiredComponents
    .filter(({ componentId }) => !selected.has(componentId))
    .map(({ componentId }) => componentId);
  for (const group of useCase.providerAlternatives) {
    if (!group.oneOfComponentIds.some((id) => selected.has(id))) {
      completion.push(
        providerSelections[group.groupId] ?? group.oneOfComponentIds[0]!,
      );
    }
  }
  return [...new Set(completion)];
}

function evaluateUseCase(
  catalog: PocSetupCompatibilityCatalogV1,
  useCase: PocSetupUseCaseV1,
  selected: ReadonlySet<string>,
  providerSelections: Readonly<Record<string, string>>,
): PocSetupUseCaseCompatibilityV1 {
  const components = componentMap(catalog);
  const missing: string[] = [];
  const incompatible: string[] = [];
  const selectedProviders: string[] = [];
  for (const requirement of useCase.requiredComponents) {
    const component = components.get(requirement.componentId)!;
    if (
      !selected.has(requirement.componentId)
      || !satisfies(component.version, requirement.versionConstraint)
    ) {
      missing.push(
        `component:${requirement.componentId}@${requirement.versionConstraint}`,
      );
    }
  }
  for (const group of useCase.providerAlternatives) {
    const explicitlySelected = providerSelections[group.groupId];
    if (
      explicitlySelected
      && !group.oneOfComponentIds.includes(explicitlySelected)
    ) fail("PROVIDER_ALTERNATIVE_NOT_ALLOWED");
    const selectedProvider = explicitlySelected && selected.has(explicitlySelected)
      ? explicitlySelected
      : group.oneOfComponentIds.find((id) => selected.has(id));
    if (selectedProvider) selectedProviders.push(selectedProvider);
    else {
      missing.push(
        `provider:${group.groupId}[${group.oneOfComponentIds.join("|")}]`,
      );
    }
  }
  for (const blocked of useCase.incompatibleWithComponentIds) {
    if (selected.has(blocked)) incompatible.push(`use-case-blocks:${blocked}`);
  }
  for (const componentId of selected) {
    const component = components.get(componentId)!;
    for (const blocked of component.incompatibleWith) {
      if (selected.has(blocked)) {
        incompatible.push(`component-conflict:${componentId}<->${blocked}`);
      }
    }
  }
  const simulatorAvailable = useCase.syntheticSimulatorComponentId !== null;
  const simulatorSelected = useCase.syntheticSimulatorComponentId !== null
    && selected.has(useCase.syntheticSimulatorComponentId);
  const completionComponentIds = completionForUseCase(
    useCase,
    selected,
    providerSelections,
  );
  let status: PocSetupCompatibilityStatusV1;
  if (incompatible.length > 0) status = "INCOMPATIBLE";
  else if (missing.length === 0) {
    const providerModes = selectedProviders.map((id) =>
      components.get(id)!.executionMode
    );
    status = simulatorSelected || providerModes.includes("SYNTHETIC")
      ? "READY_SIMULATED"
      : "READY_REAL";
  } else if (simulatorSelected) {
    const simulator = components.get(useCase.syntheticSimulatorComponentId!)!;
    const simulatorDependenciesReady = simulator.requiredDependencies.every(
      ({ componentId, versionConstraint }) =>
        selected.has(componentId)
        && satisfies(components.get(componentId)!.version, versionConstraint),
    );
    status = simulatorDependenciesReady ? "READY_SIMULATED" : "PARTIAL_MISSING";
  } else status = "PARTIAL_MISSING";
  return {
    useCaseId: useCase.useCaseId,
    displayName: useCase.displayName,
    status,
    selectedProviderIds: selectedProviders,
    missingRequirements: missing,
    incompatibleReasons: [...new Set(incompatible)].sort(),
    simulatorAvailable,
    completionComponentIds,
  };
}

function analysisCore(
  analysis: PocSetupCompatibilityAnalysisV1,
): Omit<PocSetupCompatibilityAnalysisV1, "analysisDigest"> {
  const { analysisDigest: _analysisDigest, ...core } = analysis;
  return core;
}

export function analyzePocSetupCompatibilityV1(
  catalogInput: PocSetupCompatibilityCatalogV1,
  request: PocSetupCompatibilityRequestV1,
): PocSetupCompatibilityAnalysisV1 {
  const catalog = validatePocSetupCompatibilityCatalogV1(catalogInput);
  const templates = new Map(catalog.baseTemplates.map((template) => [
    template.templateId,
    template,
  ]));
  const template = templates.get(request.baseTemplateId)
    ?? fail("UNKNOWN_BASE_TEMPLATE");
  const useCases = new Map(catalog.useCases.map((useCase) => [
    useCase.useCaseId,
    useCase,
  ]));
  const requestedUseCaseIds = request.mode === "USE_CASE_FIRST"
    ? request.selectedUseCaseIds
    : catalog.useCases.map(({ useCaseId }) => useCaseId);
  if (
    !unique(request.selectedUseCaseIds)
    || !unique(request.selectedComponentIds)
    || request.selectedUseCaseIds.some((id) => !useCases.has(id))
  ) fail("UNKNOWN_OR_DUPLICATE_SELECTION");
  const initial = new Set([
    ...template.defaultComponentIds,
    ...request.selectedComponentIds,
  ]);
  const auto: { componentId: string; reason: string }[] = [];
  if (
    request.mode === "SYSTEM_FIRST"
    && request.completeBundle
    && request.selectedUseCaseIds.length > 0
  ) {
    for (const useCaseId of request.selectedUseCaseIds) {
      const useCase = useCases.get(useCaseId)!;
      for (const componentId of completionForUseCase(
        useCase,
        initial,
        request.providerSelections,
      )) {
        if (!initial.has(componentId)) {
          initial.add(componentId);
          auto.push({
            componentId,
            reason: `bundle completion for ${useCaseId}`,
          });
        }
      }
    }
  }
  if (request.mode === "USE_CASE_FIRST") {
    for (const useCaseId of request.selectedUseCaseIds) {
      const useCase = useCases.get(useCaseId)!;
      for (const requirement of useCase.requiredComponents) {
        if (!initial.has(requirement.componentId)) {
          initial.add(requirement.componentId);
          auto.push({
            componentId: requirement.componentId,
            reason: `required by ${useCaseId}`,
          });
        }
      }
      if (
        request.executionPreference === "SIMULATION_ONLY"
        && useCase.syntheticSimulatorComponentId
      ) {
        if (!initial.has(useCase.syntheticSimulatorComponentId)) {
          initial.add(useCase.syntheticSimulatorComponentId);
          auto.push({
            componentId: useCase.syntheticSimulatorComponentId,
            reason: `synthetic fallback for ${useCaseId}`,
          });
        }
      } else {
        for (const group of useCase.providerAlternatives) {
          const providerId = request.providerSelections[group.groupId]
            ?? group.oneOfComponentIds[0]!;
          if (!group.oneOfComponentIds.includes(providerId)) {
            fail("PROVIDER_ALTERNATIVE_NOT_ALLOWED");
          }
          if (!initial.has(providerId)) {
            initial.add(providerId);
            auto.push({
              componentId: providerId,
              reason: `provider ${group.groupId} for ${useCaseId}`,
            });
          }
        }
      }
    }
  }
  const closure = dependencyClosure(componentMap(catalog), initial);
  auto.push(...closure.additions);
  const selected = closure.ids;
  const evaluated = requestedUseCaseIds.map((id) =>
    evaluateUseCase(catalog, useCases.get(id)!, selected, request.providerSelections)
  );
  const required = request.selectedUseCaseIds.flatMap((id) =>
    useCases.get(id)!.requiredComponents.map(({ componentId }) => componentId)
  );
  const recommended = request.selectedUseCaseIds.flatMap((id) =>
    useCases.get(id)!.recommendedComponentIds
  );
  const optional = request.selectedUseCaseIds.flatMap((id) =>
    useCases.get(id)!.optionalComponentIds
  );
  const missing = evaluated.flatMap(({ completionComponentIds, status }) =>
    status === "READY_REAL" ? [] : completionComponentIds
  );
  const selectedComponents = [...selected].sort().map((id) =>
    componentMap(catalog).get(id)!
  );
  const withoutDigest = {
    mode: request.mode,
    selectedUseCaseIds: [...request.selectedUseCaseIds],
    selectedComponentIds: selectedComponents.map(({ componentId }) =>
      componentId
    ),
    automaticallyAdded: auto,
    requiredComponentIds: [...new Set(required)].sort(),
    recommendedComponentIds: [...new Set(recommended)].sort(),
    optionalComponentIds: [...new Set(optional)].sort(),
    missingComponentIds: [...new Set(missing)].sort(),
    useCases: evaluated,
    resources: {
      downloadBytes: selectedComponents.reduce(
        (sum, component) => sum + component.downloadBytes,
        0,
      ),
      diskBytes: selectedComponents.reduce(
        (sum, component) => sum + component.diskBytes,
        0,
      ),
      networkAccess: [...new Set(selectedComponents.flatMap(
        ({ networkAccess }) => networkAccess,
      ))].sort(),
      effects: [...new Set([
        ...selectedComponents.flatMap(({ effects }) => effects),
        ...request.selectedUseCaseIds.flatMap((id) => useCases.get(id)!.effects),
      ])].sort(),
    },
    catalogDigest: catalog.provenance.digest,
  };
  return {
    ...withoutDigest,
    analysisDigest: digest(withoutDigest),
  };
}

function composedTemplate(
  catalog: PocSetupCompatibilityCatalogV1,
  base: PocGuidedDemoTemplateV1,
  request: PocSetupCompatibilityRequestV1,
  analysis: PocSetupCompatibilityAnalysisV1,
): PocGuidedDemoTemplateV1 {
  const componentById = componentMap(catalog);
  const safeId = `compat-${digest({
    catalog: catalog.provenance.digest,
    request,
    analysis: analysis.analysisDigest,
  }).slice(7, 19)}`;
  const unsigned: PocGuidedDemoTemplateV1 = {
    ...base,
    templateId: safeId,
    displayName: `${base.displayName} compatibility bundle`,
    provenance: {
      label: catalog.provenance.label,
      source: "LOCAL_PATH",
      trustTier: catalog.provenance.trustTier === "CURATED_VERIFIED"
        ? "CATALOG_CURATED_VERIFIED"
        : catalog.provenance.trustTier === "CUSTOM_UNVERIFIED"
          ? "CUSTOM_LOCAL_UNVERIFIED"
          : "COMMUNITY_LOCAL_UNVERIFIED",
      manifestDigest: "",
      signature: "NOT_REQUIRED",
    },
    recommended: false,
    purpose: `Digest-bound ${request.mode} compatibility bundle.`,
    includedModules: analysis.selectedComponentIds,
    includedCapabilities: [...new Set(analysis.selectedComponentIds.flatMap(
      (id) => componentById.get(id)!.capabilityIds,
    ))].sort(),
    declaredNetworkAccess: analysis.resources.networkAccess,
    declaredEffects: analysis.resources.effects,
    selectedUseCaseIds: request.selectedUseCaseIds,
    syntheticDataset: {
      datasetId: `synthetic.${safeId}.v1`,
      description: "catalog-selected local compatibility planner fixtures",
      containsRealCustomerData: false,
      containsCredentials: false,
    },
    welcomeTour: [
      "Review compatibility, alternatives and automatically added dependencies.",
      "Run health checks before the selected synthetic demo.",
      "Inspect digest-bound receipts, resume and owned-state cleanup.",
    ],
    cleanup: {
      ownedStateRoot: `artifacts/poc-guided-demo/playgrounds/${safeId}`,
      command: `npm run poc:setup -- --cleanup --template=${safeId}`,
      removesOnlyOwnedState: true,
    },
  };
  return {
    ...unsigned,
    provenance: {
      ...unsigned.provenance,
      manifestDigest: digest(unsigned),
    },
  };
}

function compatibilityPlanCore(
  plan: PocSetupCompatibilityPlanV1,
): Omit<PocSetupCompatibilityPlanV1, "planDigest"> {
  const { planDigest: _planDigest, ...core } = plan;
  return core;
}

export function buildPocSetupCompatibilityPlanV1(
  showcase: PocShowcaseV1,
  guidedTemplates: readonly PocGuidedDemoTemplateV1[],
  catalogInput: PocSetupCompatibilityCatalogV1,
  request: PocSetupCompatibilityRequestV1,
): PocSetupCompatibilityPlanV1 {
  const catalog = validatePocSetupCompatibilityCatalogV1(catalogInput);
  const analysis = analyzePocSetupCompatibilityV1(catalog, request);
  const failed = analysis.useCases.filter(({ status }) =>
    status === "PARTIAL_MISSING" || status === "INCOMPATIBLE"
  );
  if (request.mode === "USE_CASE_FIRST" && failed.length > 0) {
    fail("SELECTED_USE_CASE_BUNDLE_NOT_EXECUTABLE");
  }
  const base = guidedTemplates.find(({ templateId }) =>
    templateId === request.baseTemplateId
  ) ?? guidedTemplates.find(({ recommended }) => recommended)
    ?? fail("GUIDED_BASE_TEMPLATE_NOT_FOUND");
  const template = composedTemplate(catalog, base, request, analysis);
  const guidedSetupPlan = buildPocGuidedDemoSetupPlanV1(
    showcase,
    [...guidedTemplates, template],
    { templateId: template.templateId },
  );
  const core = {
    apiVersion: POC_SETUP_COMPATIBILITY_PLAN_API_VERSION,
    kind: "PocSetupCompatibilityPlan" as const,
    frontdoor: {
      paths: [
        "RECOMMENDED_DEMO",
        "COMPOSE_DEMO",
        "LOAD_CUSTOM_OR_COMMUNITY",
      ] as const,
      selected: request.frontdoorPath,
      enterAcceptsSafeRecommendedDefaults: true as const,
      baseTemplateSelection: "SINGLE_SELECT" as const,
      additionalComponentsSelection: "CHECKBOX_MULTI_SELECT" as const,
      questionPolicy: "NO_FIXED_MAXIMUM_ASK_ONLY_WHEN_REQUIRED" as const,
    },
    request,
    authorityBinding: {
      requested: request.authorityProfile,
      activeDuringPlanning: "SAFE_GUIDED" as const,
      customCatalogMayRequestButNeverActivateFullControl: true as const,
      ownerActivationRequired: true as const,
      catalogTrustTier: catalog.provenance.trustTier,
      guidedPlanTrustTier: guidedSetupPlan.template.trustTier,
    },
    compatibility: analysis,
    guidedSetupPlan,
    lifecycle: {
      resume: "DIGEST_BOUND_CHECKPOINT" as const,
      cache: "VERIFY_BEFORE_REUSE" as const,
      cleanup: "OWNED_STATE_ONLY" as const,
      healthBeforeDemo: true as const,
      rerunIdempotent: true as const,
    },
  };
  return { ...core, planDigest: digest(core) };
}

export function verifyPocSetupCompatibilityPlanV1(
  plan: PocSetupCompatibilityPlanV1,
): PocSetupCompatibilityPlanV1 {
  if (
    plan.apiVersion !== POC_SETUP_COMPATIBILITY_PLAN_API_VERSION
    || plan.kind !== "PocSetupCompatibilityPlan"
    || plan.planDigest !== digest(compatibilityPlanCore(plan))
    || plan.authorityBinding.activeDuringPlanning !== "SAFE_GUIDED"
    || plan.authorityBinding.guidedPlanTrustTier
      !== plan.guidedSetupPlan.template.trustTier
  ) fail("COMPATIBILITY_PLAN_TAMPERED");
  verifyPocGuidedDemoSetupPlanV1(plan.guidedSetupPlan);
  return plan;
}

export function defaultPocSetupCompatibilityRequestV1(
  catalogInput: PocSetupCompatibilityCatalogV1,
): PocSetupCompatibilityRequestV1 {
  const catalog = validatePocSetupCompatibilityCatalogV1(catalogInput);
  const template = catalog.baseTemplates.find(({ recommended }) => recommended)!;
  return {
    apiVersion: POC_SETUP_COMPATIBILITY_REQUEST_API_VERSION,
    kind: "PocSetupCompatibilityRequest",
    frontdoorPath: "RECOMMENDED_DEMO",
    mode: "USE_CASE_FIRST",
    baseTemplateId: template.templateId,
    selectedUseCaseIds: template.selectedUseCaseIds,
    selectedComponentIds: template.defaultComponentIds,
    providerSelections: {},
    executionPreference: "SIMULATION_ONLY",
    completeBundle: true,
    authorityProfile: "SAFE_GUIDED",
  };
}
