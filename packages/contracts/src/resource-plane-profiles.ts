import { createHash } from "node:crypto";
import {
  BUILDER_AUTHORITY_INPUT_API_VERSION,
  resolveBuilderAuthorityV1,
  type BuilderAuthorityDecisionV1,
  type BuilderAuthorityInputV1,
  type BuilderAuthorityProfileRequestV1,
  type BuilderAuthorityRouteV1,
  type BuilderCustomRuleV1,
  type BuilderRegisteredRightV1,
} from "./builder-authority.js";
import { canonicalJson } from "./canonical-json.js";

export const RESOURCE_PLANE_PROFILE_INPUT_API_VERSION =
  "chimpmaera.resource-plane/profile-input/v1" as const;
export const RESOURCE_PLANE_PLAN_API_VERSION =
  "chimpmaera.resource-plane/declarative-plan/v1" as const;

export const RESOURCE_PLANE_IDS_V1 = [
  "FILESYSTEM",
  "NETWORK",
  "PROCESS",
  "DOCKER",
  "SECRETS",
  "MODELS_TOOLS",
  "DEVICES",
] as const;
export type ResourcePlaneIdV1 = typeof RESOURCE_PLANE_IDS_V1[number];

export const RESOURCE_PLANE_PROFILES_V1 = [
  "SAFE_GUIDED",
  "CUSTOM",
  "FULL_CONTROL",
] as const;
export type ResourcePlaneProfileV1 = typeof RESOURCE_PLANE_PROFILES_V1[number];

export const RESOURCE_PLANE_TEMPLATES_V1 = {
  FILESYSTEM: {
    templateId: "chimpmaera.resource-plane/filesystem-closed/v1",
    rights: [
      { rightId: "filesystem.metadata.read", effectClass: "READ_ONLY" },
      { rightId: "filesystem.content.read", effectClass: "READ_ONLY" },
      { rightId: "filesystem.owned.write", effectClass: "REVERSIBLE_WRITE" },
      { rightId: "filesystem.delete", effectClass: "IRREVERSIBLE_EFFECT" },
    ],
  },
  NETWORK: {
    templateId: "chimpmaera.resource-plane/network-closed/v1",
    rights: [
      { rightId: "network.resolve", effectClass: "READ_ONLY" },
      { rightId: "network.https.read", effectClass: "READ_ONLY" },
      { rightId: "network.https.write", effectClass: "IRREVERSIBLE_EFFECT" },
      { rightId: "network.listen", effectClass: "INSTALL_ACTIVATE" },
    ],
  },
  PROCESS: {
    templateId: "chimpmaera.resource-plane/process-closed/v1",
    rights: [
      { rightId: "process.inspect", effectClass: "READ_ONLY" },
      { rightId: "process.spawn", effectClass: "INSTALL_ACTIVATE" },
      { rightId: "process.signal", effectClass: "IRREVERSIBLE_EFFECT" },
    ],
  },
  DOCKER: {
    templateId: "chimpmaera.resource-plane/docker-closed/v1",
    rights: [
      { rightId: "docker.inspect", effectClass: "READ_ONLY" },
      { rightId: "docker.image.pull", effectClass: "INSTALL_ACTIVATE" },
      { rightId: "docker.container.run", effectClass: "INSTALL_ACTIVATE" },
      { rightId: "docker.container.remove", effectClass: "REVERSIBLE_WRITE" },
    ],
  },
  SECRETS: {
    templateId: "chimpmaera.resource-plane/secrets-closed/v1",
    rights: [
      { rightId: "secrets.metadata.read", effectClass: "READ_ONLY" },
      { rightId: "secrets.value.read", effectClass: "IRREVERSIBLE_EFFECT" },
      { rightId: "secrets.value.write", effectClass: "IRREVERSIBLE_EFFECT" },
    ],
  },
  MODELS_TOOLS: {
    templateId: "chimpmaera.resource-plane/models-tools-closed/v1",
    rights: [
      { rightId: "models-tools.catalog.read", effectClass: "READ_ONLY" },
      { rightId: "models-tools.model.invoke", effectClass: "IRREVERSIBLE_EFFECT" },
      { rightId: "models-tools.tool.invoke", effectClass: "IRREVERSIBLE_EFFECT" },
      { rightId: "models-tools.tool.install", effectClass: "INSTALL_ACTIVATE" },
    ],
  },
  DEVICES: {
    templateId: "chimpmaera.resource-plane/devices-closed/v1",
    rights: [
      { rightId: "devices.inspect", effectClass: "READ_ONLY" },
      { rightId: "devices.sensor.read", effectClass: "READ_ONLY" },
      { rightId: "devices.actuate", effectClass: "IRREVERSIBLE_EFFECT" },
    ],
  },
} as const satisfies Record<ResourcePlaneIdV1, Readonly<{
  templateId: string;
  rights: readonly BuilderRegisteredRightV1[];
}>>;

export type ResourcePlaneTemplateSelectionV1 = Readonly<{
  planeId: ResourcePlaneIdV1;
  templateId: string;
  requestedRights: readonly string[];
}>;

export type ResourcePlaneProfileInputV1 = Readonly<{
  schemaVersion: typeof RESOURCE_PLANE_PROFILE_INPUT_API_VERSION;
  tenant: string;
  actor: string;
  selectedProfile: ResourcePlaneProfileV1;
  planeTemplates: readonly ResourcePlaneTemplateSelectionV1[];
  hostSystemCeiling: readonly string[];
  assignments: readonly string[];
  currentConstraints: readonly string[];
  customRules: readonly BuilderCustomRuleV1[];
}>;

export type ResourcePlaneEffectiveRightsDiffEntryV1 = Readonly<{
  planeId: ResourcePlaneIdV1;
  rightId: string;
  effectClass: BuilderRegisteredRightV1["effectClass"];
  safeGuidedEffective: boolean;
  safeGuidedRoute: BuilderAuthorityRouteV1;
  selectedEffective: boolean;
  selectedRoute: BuilderAuthorityRouteV1;
  change: "ADDED" | "REMOVED" | "ROUTE_CHANGED" | "UNCHANGED";
}>;

export type ResourcePlanePlanV1 = Readonly<{
  schemaVersion: typeof RESOURCE_PLANE_PLAN_API_VERSION;
  claim: "DECLARATIVE_RESOURCE_PLANE_PLAN_ONLY_NO_EXECUTION";
  tenant: string;
  actor: string;
  selectedProfile: ResourcePlaneProfileV1;
  authorityProfile: "SAFE_GUIDED" | "CUSTOM" | "RAMPAGE_FULL_CONTROL_LAB";
  authorityFree: true;
  runtimeActivation: false;
  sourceBindings: Readonly<{
    safeGuidedAuthorityResultDigest: string;
    selectedAuthorityResultDigest: string;
  }>;
  planes: readonly Readonly<{
    planeId: ResourcePlaneIdV1;
    templateId: string;
    requestedRights: readonly string[];
    decisions: readonly BuilderAuthorityDecisionV1[];
  }>[];
  effectiveRightsDiff: Readonly<{
    baselineProfile: "SAFE_GUIDED";
    selectedProfile: ResourcePlaneProfileV1;
    added: readonly string[];
    removed: readonly string[];
    routeChanged: readonly string[];
    entries: readonly ResourcePlaneEffectiveRightsDiffEntryV1[];
  }>;
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
  throw new Error("RESOURCE_PLANE_PROFILE_INVALID_DENIED");
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string"
    && /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/.test(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isRoute(value: unknown): value is BuilderAuthorityRouteV1 {
  return value === "AUTO_EXECUTE" || value === "OWNER_APPROVAL" || value === "DENY";
}

function normalizeReferences(value: unknown, registered: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)
    || value.some((entry) => typeof entry !== "string" || !registered.has(entry))) {
    return invalid();
  }
  const normalized = [...value].sort();
  if (new Set(normalized).size !== normalized.length) return invalid();
  return normalized;
}

function normalizeTemplates(value: unknown): Readonly<{
  templates: ResourcePlaneTemplateSelectionV1[];
  registeredRights: BuilderRegisteredRightV1[];
  planeByRight: ReadonlyMap<string, ResourcePlaneIdV1>;
}> {
  if (!Array.isArray(value) || value.length !== RESOURCE_PLANE_IDS_V1.length) {
    return invalid();
  }
  const templates = value.map((entry) => {
    if (!exactKeys(entry, ["planeId", "requestedRights", "templateId"])
      || !RESOURCE_PLANE_IDS_V1.includes(entry.planeId as ResourcePlaneIdV1)) {
      return invalid();
    }
    const planeId = entry.planeId as ResourcePlaneIdV1;
    const template = RESOURCE_PLANE_TEMPLATES_V1[planeId];
    if (entry.templateId !== template.templateId
      || !Array.isArray(entry.requestedRights)
      || entry.requestedRights.length === 0
      || entry.requestedRights.some((right) => typeof right !== "string")) {
      return invalid();
    }
    const allowed = new Set(template.rights.map(({ rightId }) => rightId));
    const requestedRights = [...entry.requestedRights].sort();
    if (new Set(requestedRights).size !== requestedRights.length
      || requestedRights.some((right) => !allowed.has(right))) return invalid();
    return { planeId, templateId: template.templateId, requestedRights };
  }).sort((left, right) =>
    RESOURCE_PLANE_IDS_V1.indexOf(left.planeId)
      - RESOURCE_PLANE_IDS_V1.indexOf(right.planeId));
  if (new Set(templates.map(({ planeId }) => planeId)).size !== RESOURCE_PLANE_IDS_V1.length) {
    return invalid();
  }

  const planeByRight = new Map<string, ResourcePlaneIdV1>();
  const registeredRights = templates.flatMap(({ planeId, requestedRights }) => {
    const catalog = new Map(
      RESOURCE_PLANE_TEMPLATES_V1[planeId].rights.map((right) => [right.rightId, right]),
    );
    return requestedRights.map((rightId) => {
      const right = catalog.get(rightId);
      if (right === undefined || planeByRight.has(rightId)) return invalid();
      planeByRight.set(rightId, planeId);
      return { ...right };
    });
  }).sort((left, right) => left.rightId.localeCompare(right.rightId));
  return { templates, registeredRights, planeByRight };
}

function normalizeCustomRules(
  value: unknown,
  selectedProfile: ResourcePlaneProfileV1,
  registered: ReadonlySet<string>,
): BuilderCustomRuleV1[] {
  if (!Array.isArray(value)) return invalid();
  const rules = value.map((entry) => {
    if (!exactKeys(entry, ["rightId", "route"])
      || typeof entry.rightId !== "string"
      || !registered.has(entry.rightId)
      || !["AUTO_EXECUTE", "OWNER_APPROVAL"].includes(entry.route as string)) {
      return invalid();
    }
    return {
      rightId: entry.rightId,
      route: entry.route as BuilderCustomRuleV1["route"],
    };
  }).sort((left, right) => left.rightId.localeCompare(right.rightId));
  if (new Set(rules.map(({ rightId }) => rightId)).size !== rules.length) return invalid();
  if (selectedProfile !== "CUSTOM" && rules.length > 0) return invalid();
  return rules;
}

function authorityRequest(profile: ResourcePlaneProfileV1): BuilderAuthorityProfileRequestV1 {
  return profile === "FULL_CONTROL" ? "FULL_CONTROL_LAB" : profile;
}

function expectedAuthorityProfile(
  profile: ResourcePlaneProfileV1,
): "SAFE_GUIDED" | "CUSTOM" | "RAMPAGE_FULL_CONTROL_LAB" {
  return profile === "FULL_CONTROL" ? "RAMPAGE_FULL_CONTROL_LAB" : profile;
}

function changeFor(
  baseline: BuilderAuthorityDecisionV1,
  selected: BuilderAuthorityDecisionV1,
): ResourcePlaneEffectiveRightsDiffEntryV1["change"] {
  if (!baseline.effective && selected.effective) return "ADDED";
  if (baseline.effective && !selected.effective) return "REMOVED";
  if (baseline.route !== selected.route) return "ROUTE_CHANGED";
  return "UNCHANGED";
}

export function compileResourcePlanePlanV1(input: unknown): ResourcePlanePlanV1 {
  if (!exactKeys(input, [
    "actor",
    "assignments",
    "currentConstraints",
    "customRules",
    "hostSystemCeiling",
    "planeTemplates",
    "schemaVersion",
    "selectedProfile",
    "tenant",
  ])
    || input.schemaVersion !== RESOURCE_PLANE_PROFILE_INPUT_API_VERSION
    || !isIdentifier(input.tenant)
    || !isIdentifier(input.actor)
    || !RESOURCE_PLANE_PROFILES_V1.includes(input.selectedProfile as ResourcePlaneProfileV1)) {
    return invalid();
  }

  const selectedProfile = input.selectedProfile as ResourcePlaneProfileV1;
  const { templates, registeredRights, planeByRight } = normalizeTemplates(input.planeTemplates);
  const registered = new Set(registeredRights.map(({ rightId }) => rightId));
  const hostSystemCeiling = normalizeReferences(input.hostSystemCeiling, registered);
  const assignments = normalizeReferences(input.assignments, registered);
  const currentConstraints = normalizeReferences(input.currentConstraints, registered);
  const customRules = normalizeCustomRules(input.customRules, selectedProfile, registered);
  const common = {
    schemaVersion: BUILDER_AUTHORITY_INPUT_API_VERSION,
    tenant: input.tenant,
    actor: input.actor,
    registeredRights,
    hostSystemCeiling,
    assignments,
    currentConstraints,
  } as const;
  const baselineInput: BuilderAuthorityInputV1 = {
    ...common,
    requestedProfile: "SAFE_GUIDED",
    customRules: [],
  };
  const selectedInput: BuilderAuthorityInputV1 = {
    ...common,
    requestedProfile: authorityRequest(selectedProfile),
    customRules,
  };
  const baseline = resolveBuilderAuthorityV1(baselineInput);
  const selected = resolveBuilderAuthorityV1(selectedInput);
  const baselineByRight = new Map(
    baseline.decisions.map((decision) => [decision.rightId, decision]),
  );

  const entries = selected.decisions.map((decision) => {
    const baselineDecision = baselineByRight.get(decision.rightId);
    const planeId = planeByRight.get(decision.rightId);
    if (baselineDecision === undefined || planeId === undefined) return invalid();
    return {
      planeId,
      rightId: decision.rightId,
      effectClass: decision.effectClass,
      safeGuidedEffective: baselineDecision.effective,
      safeGuidedRoute: baselineDecision.route,
      selectedEffective: decision.effective,
      selectedRoute: decision.route,
      change: changeFor(baselineDecision, decision),
    };
  }).sort((left, right) => left.rightId.localeCompare(right.rightId));

  const normalizedInput: ResourcePlaneProfileInputV1 = {
    schemaVersion: RESOURCE_PLANE_PROFILE_INPUT_API_VERSION,
    tenant: input.tenant,
    actor: input.actor,
    selectedProfile,
    planeTemplates: templates,
    hostSystemCeiling,
    assignments,
    currentConstraints,
    customRules,
  };
  const core = {
    schemaVersion: RESOURCE_PLANE_PLAN_API_VERSION,
    claim: "DECLARATIVE_RESOURCE_PLANE_PLAN_ONLY_NO_EXECUTION" as const,
    tenant: input.tenant,
    actor: input.actor,
    selectedProfile,
    authorityProfile: selected.profile.selected,
    authorityFree: true as const,
    runtimeActivation: false as const,
    sourceBindings: {
      safeGuidedAuthorityResultDigest: baseline.resultDigest,
      selectedAuthorityResultDigest: selected.resultDigest,
    },
    planes: templates.map((template) => ({
      ...template,
      decisions: selected.decisions.filter((decision) =>
        planeByRight.get(decision.rightId) === template.planeId),
    })),
    effectiveRightsDiff: {
      baselineProfile: "SAFE_GUIDED" as const,
      selectedProfile,
      added: entries.filter(({ change }) => change === "ADDED").map(({ rightId }) => rightId),
      removed: entries.filter(({ change }) => change === "REMOVED").map(({ rightId }) => rightId),
      routeChanged: entries.filter(({ change }) => change === "ROUTE_CHANGED")
        .map(({ rightId }) => rightId),
      entries,
    },
    inputDigest: digest(normalizedInput),
  };
  return { ...core, planDigest: digest(core) };
}

export function verifyResourcePlanePlanV1(value: unknown): ResourcePlanePlanV1 {
  if (!exactKeys(value, [
    "actor",
    "authorityFree",
    "authorityProfile",
    "claim",
    "effectiveRightsDiff",
    "inputDigest",
    "planes",
    "planDigest",
    "runtimeActivation",
    "schemaVersion",
    "selectedProfile",
    "sourceBindings",
    "tenant",
  ])
    || value.schemaVersion !== RESOURCE_PLANE_PLAN_API_VERSION
    || value.claim !== "DECLARATIVE_RESOURCE_PLANE_PLAN_ONLY_NO_EXECUTION"
    || value.authorityFree !== true
    || value.runtimeActivation !== false
    || !isIdentifier(value.tenant)
    || !isIdentifier(value.actor)
    || !RESOURCE_PLANE_PROFILES_V1.includes(value.selectedProfile as ResourcePlaneProfileV1)
    || value.authorityProfile !== expectedAuthorityProfile(
      value.selectedProfile as ResourcePlaneProfileV1,
    )
    || !Array.isArray(value.planes)
    || value.planes.length !== RESOURCE_PLANE_IDS_V1.length
    || !exactKeys(value.sourceBindings, [
      "safeGuidedAuthorityResultDigest",
      "selectedAuthorityResultDigest",
    ])
    || !isDigest(value.sourceBindings.safeGuidedAuthorityResultDigest)
    || !isDigest(value.sourceBindings.selectedAuthorityResultDigest)
    || !isDigest(value.inputDigest)
    || !isDigest(value.planDigest)) return invalid();

  const selectedProfile = value.selectedProfile as ResourcePlaneProfileV1;
  const seenPlanes = new Set<ResourcePlaneIdV1>();
  const seenRights = new Set<string>();
  const rightFacts = new Map<string, Readonly<{
    planeId: ResourcePlaneIdV1;
    effectClass: BuilderRegisteredRightV1["effectClass"];
  }>>();
  for (const plane of value.planes) {
    if (!exactKeys(plane, ["decisions", "planeId", "requestedRights", "templateId"])
      || !RESOURCE_PLANE_IDS_V1.includes(plane.planeId as ResourcePlaneIdV1)
      || seenPlanes.has(plane.planeId as ResourcePlaneIdV1)) return invalid();
    const planeId = plane.planeId as ResourcePlaneIdV1;
    seenPlanes.add(planeId);
    const template = RESOURCE_PLANE_TEMPLATES_V1[planeId];
    if (plane.templateId !== template.templateId
      || !Array.isArray(plane.requestedRights)
      || plane.requestedRights.length === 0
      || !Array.isArray(plane.decisions)
      || plane.decisions.length !== plane.requestedRights.length) return invalid();
    const catalogue = new Map<string, BuilderRegisteredRightV1>(
      template.rights.map((right) => [right.rightId, right]),
    );
    const requested = new Set<string>();
    for (const rightId of plane.requestedRights) {
      if (typeof rightId !== "string"
        || requested.has(rightId)
        || seenRights.has(rightId)
        || !catalogue.has(rightId)) return invalid();
      requested.add(rightId);
      seenRights.add(rightId);
      rightFacts.set(rightId, { planeId, effectClass: catalogue.get(rightId)!.effectClass });
    }
    const seenDecisions = new Set<string>();
    for (const decision of plane.decisions) {
      if (!exactKeys(decision, [
        "effectClass",
        "effective",
        "inAssignments",
        "inCurrentConstraints",
        "inHostSystemCeiling",
        "inOwnerProfile",
        "reasonFacts",
        "rightId",
        "route",
      ])
        || typeof decision.rightId !== "string"
        || !requested.has(decision.rightId)
        || seenDecisions.has(decision.rightId)
        || decision.effectClass !== catalogue.get(decision.rightId)?.effectClass
        || typeof decision.inHostSystemCeiling !== "boolean"
        || typeof decision.inOwnerProfile !== "boolean"
        || typeof decision.inAssignments !== "boolean"
        || typeof decision.inCurrentConstraints !== "boolean"
        || typeof decision.effective !== "boolean"
        || !isRoute(decision.route)
        || !Array.isArray(decision.reasonFacts)
        || decision.reasonFacts.length !== 6
        || decision.reasonFacts.some((fact) => typeof fact !== "string")) return invalid();
      const effective = decision.inHostSystemCeiling
        && decision.inOwnerProfile
        && decision.inAssignments
        && decision.inCurrentConstraints;
      if (decision.effective !== effective || (!effective && decision.route !== "DENY")) {
        return invalid();
      }
      seenDecisions.add(decision.rightId);
    }
  }
  if (seenPlanes.size !== RESOURCE_PLANE_IDS_V1.length) return invalid();

  if (!exactKeys(value.effectiveRightsDiff, [
    "added",
    "baselineProfile",
    "entries",
    "removed",
    "routeChanged",
    "selectedProfile",
  ])
    || value.effectiveRightsDiff.baselineProfile !== "SAFE_GUIDED"
    || value.effectiveRightsDiff.selectedProfile !== selectedProfile
    || !Array.isArray(value.effectiveRightsDiff.entries)
    || value.effectiveRightsDiff.entries.length !== seenRights.size) return invalid();
  const entries = value.effectiveRightsDiff.entries;
  const seenEntries = new Set<string>();
  const expectedChanges: Record<"ADDED" | "REMOVED" | "ROUTE_CHANGED", string[]> = {
    ADDED: [],
    REMOVED: [],
    ROUTE_CHANGED: [],
  };
  for (const entry of entries) {
    if (!exactKeys(entry, [
      "change",
      "effectClass",
      "planeId",
      "rightId",
      "safeGuidedEffective",
      "safeGuidedRoute",
      "selectedEffective",
      "selectedRoute",
    ])
      || typeof entry.rightId !== "string"
      || seenEntries.has(entry.rightId)
      || !rightFacts.has(entry.rightId)
      || entry.planeId !== rightFacts.get(entry.rightId)?.planeId
      || entry.effectClass !== rightFacts.get(entry.rightId)?.effectClass
      || typeof entry.safeGuidedEffective !== "boolean"
      || typeof entry.selectedEffective !== "boolean"
      || !isRoute(entry.safeGuidedRoute)
      || !isRoute(entry.selectedRoute)
      || !["ADDED", "REMOVED", "ROUTE_CHANGED", "UNCHANGED"].includes(
        entry.change as string,
      )) return invalid();
    const expectedChange = !entry.safeGuidedEffective && entry.selectedEffective
      ? "ADDED"
      : entry.safeGuidedEffective && !entry.selectedEffective
        ? "REMOVED"
        : entry.safeGuidedRoute !== entry.selectedRoute
          ? "ROUTE_CHANGED"
          : "UNCHANGED";
    if (entry.change !== expectedChange) return invalid();
    if (expectedChange !== "UNCHANGED") expectedChanges[expectedChange].push(entry.rightId);
    seenEntries.add(entry.rightId);
  }
  for (const [field, change] of [
    ["added", "ADDED"],
    ["removed", "REMOVED"],
    ["routeChanged", "ROUTE_CHANGED"],
  ] as const) {
    const observed = value.effectiveRightsDiff[field];
    if (!Array.isArray(observed)
      || observed.some((right) => typeof right !== "string")
      || canonicalJson(observed) !== canonicalJson(expectedChanges[change])) return invalid();
  }
  const { planDigest: _planDigest, ...core } = value;
  if (digest(core) !== value.planDigest) return invalid();
  return structuredClone(value) as unknown as ResourcePlanePlanV1;
}

export function syntheticResourcePlaneProfileInputV1(
  selectedProfile: ResourcePlaneProfileV1 = "SAFE_GUIDED",
): ResourcePlaneProfileInputV1 {
  const planeTemplates = RESOURCE_PLANE_IDS_V1.map((planeId) => ({
    planeId,
    templateId: RESOURCE_PLANE_TEMPLATES_V1[planeId].templateId,
    requestedRights: RESOURCE_PLANE_TEMPLATES_V1[planeId].rights
      .map(({ rightId }) => rightId),
  }));
  const allRights = planeTemplates.flatMap(({ requestedRights }) => requestedRights).sort();
  return {
    schemaVersion: RESOURCE_PLANE_PROFILE_INPUT_API_VERSION,
    tenant: "synthetic-zoo",
    actor: "agent:builder",
    selectedProfile,
    planeTemplates,
    hostSystemCeiling: allRights,
    assignments: allRights,
    currentConstraints: allRights,
    customRules: selectedProfile === "CUSTOM"
      ? allRights.map((rightId) => ({ rightId, route: "OWNER_APPROVAL" as const }))
      : [],
  };
}
