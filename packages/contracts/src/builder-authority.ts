import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const BUILDER_AUTHORITY_INPUT_API_VERSION =
  "chimpmaera.builder/authority-input/v1" as const;
export const BUILDER_AUTHORITY_RESULT_API_VERSION =
  "chimpmaera.builder/authority-result/v1" as const;

export const BUILDER_AUTHORITY_PROFILES_V1 = [
  "SAFE_GUIDED",
  "CUSTOM",
  "RAMPAGE_FULL_CONTROL_LAB",
] as const;
export type BuilderAuthorityProfileV1 =
  typeof BUILDER_AUTHORITY_PROFILES_V1[number];

export const BUILDER_AUTHORITY_PROFILE_REQUESTS_V1 = [
  ...BUILDER_AUTHORITY_PROFILES_V1,
  "RAMPAGE",
  "FULL_CONTROL_LAB",
] as const;
export type BuilderAuthorityProfileRequestV1 =
  typeof BUILDER_AUTHORITY_PROFILE_REQUESTS_V1[number];

export const BUILDER_RIGHT_EFFECT_CLASSES_V1 = [
  "READ_ONLY",
  "REVERSIBLE_WRITE",
  "IRREVERSIBLE_EFFECT",
  "INSTALL_ACTIVATE",
  "PUBLICATION",
] as const;
export type BuilderRightEffectClassV1 =
  typeof BUILDER_RIGHT_EFFECT_CLASSES_V1[number];

export const BUILDER_AUTHORITY_ROUTES_V1 = [
  "AUTO_EXECUTE",
  "OWNER_APPROVAL",
  "DENY",
] as const;
export type BuilderAuthorityRouteV1 =
  typeof BUILDER_AUTHORITY_ROUTES_V1[number];

export type BuilderRegisteredRightV1 = Readonly<{
  rightId: string;
  effectClass: BuilderRightEffectClassV1;
}>;

export type BuilderCustomRuleV1 = Readonly<{
  rightId: string;
  route: Exclude<BuilderAuthorityRouteV1, "DENY">;
}>;

export type BuilderAuthorityInputV1 = Readonly<{
  schemaVersion: typeof BUILDER_AUTHORITY_INPUT_API_VERSION;
  tenant: string;
  actor: string;
  requestedProfile: BuilderAuthorityProfileRequestV1 | null;
  registeredRights: readonly BuilderRegisteredRightV1[];
  hostSystemCeiling: readonly string[];
  assignments: readonly string[];
  currentConstraints: readonly string[];
  customRules: readonly BuilderCustomRuleV1[];
}>;

export type BuilderAuthorityDecisionV1 = Readonly<{
  rightId: string;
  effectClass: BuilderRightEffectClassV1;
  inHostSystemCeiling: boolean;
  inOwnerProfile: boolean;
  inAssignments: boolean;
  inCurrentConstraints: boolean;
  effective: boolean;
  route: BuilderAuthorityRouteV1;
  reasonFacts: readonly string[];
}>;

export type BuilderAuthorityResultV1 = Readonly<{
  schemaVersion: typeof BUILDER_AUTHORITY_RESULT_API_VERSION;
  claim: "DECISION_MATRIX_ONLY_NO_EXECUTABLE_AUTHORITY";
  tenant: string;
  actor: string;
  profile: Readonly<{
    requested: BuilderAuthorityProfileRequestV1 | null;
    selected: BuilderAuthorityProfileV1;
    defaulted: boolean;
  }>;
  formula: "HOST_SYSTEM_CEILING_INTERSECT_OWNER_PROFILE_INTERSECT_ASSIGNMENTS_INTERSECT_CURRENT_CONSTRAINTS";
  inputDigest: string;
  decisions: readonly BuilderAuthorityDecisionV1[];
  effectiveRights: readonly string[];
  automaticRights: readonly string[];
  ownerApprovalRights: readonly string[];
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
    && canonicalJson(Object.keys(value).sort())
      === canonicalJson([...expected].sort());
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function invalid(): never {
  throw new Error("BUILDER_AUTHORITY_INPUT_INVALID_DENIED");
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string"
    && /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/.test(value);
}

function assertUniqueReferences(
  value: unknown,
  registered: ReadonlySet<string>,
): string[] {
  if (!Array.isArray(value) || value.some((entry) => !isIdentifier(entry))) {
    return invalid();
  }
  const normalized = [...value].sort();
  if (new Set(normalized).size !== normalized.length) return invalid();
  if (normalized.some((entry) => !registered.has(entry))) return invalid();
  return normalized;
}

function selectProfile(
  requested: unknown,
): Readonly<{
  requested: BuilderAuthorityProfileRequestV1 | null;
  selected: BuilderAuthorityProfileV1;
  defaulted: boolean;
}> {
  if (requested === null) {
    return { requested: null, selected: "SAFE_GUIDED", defaulted: true };
  }
  if (!BUILDER_AUTHORITY_PROFILE_REQUESTS_V1.includes(
    requested as BuilderAuthorityProfileRequestV1,
  )) return invalid();
  const selected = requested === "RAMPAGE" || requested === "FULL_CONTROL_LAB"
    ? "RAMPAGE_FULL_CONTROL_LAB"
    : requested as BuilderAuthorityProfileV1;
  return {
    requested: requested as BuilderAuthorityProfileRequestV1,
    selected,
    defaulted: false,
  };
}

function normalizeRegisteredRights(value: unknown): BuilderRegisteredRightV1[] {
  if (!Array.isArray(value) || value.length === 0) return invalid();
  const rights = value.map((entry) => {
    if (!exactKeys(entry, ["effectClass", "rightId"])) return invalid();
    if (
      !isIdentifier(entry.rightId)
      || !BUILDER_RIGHT_EFFECT_CLASSES_V1.includes(
        entry.effectClass as BuilderRightEffectClassV1,
      )
    ) return invalid();
    return {
      rightId: entry.rightId,
      effectClass: entry.effectClass as BuilderRightEffectClassV1,
    };
  }).sort((left, right) => left.rightId.localeCompare(right.rightId));
  if (new Set(rights.map(({ rightId }) => rightId)).size !== rights.length) {
    return invalid();
  }
  return rights;
}

function normalizeCustomRules(
  value: unknown,
  registered: ReadonlySet<string>,
  profile: BuilderAuthorityProfileV1,
): BuilderCustomRuleV1[] {
  if (!Array.isArray(value)) return invalid();
  const rules = value.map((entry) => {
    if (!exactKeys(entry, ["rightId", "route"])) return invalid();
    if (
      !isIdentifier(entry.rightId)
      || !registered.has(entry.rightId)
      || !["AUTO_EXECUTE", "OWNER_APPROVAL"].includes(entry.route as string)
    ) return invalid();
    return {
      rightId: entry.rightId,
      route: entry.route as BuilderCustomRuleV1["route"],
    };
  }).sort((left, right) => left.rightId.localeCompare(right.rightId));
  if (new Set(rules.map(({ rightId }) => rightId)).size !== rules.length) {
    return invalid();
  }
  if (profile !== "CUSTOM" && rules.length > 0) return invalid();
  return rules;
}

function safeGuidedRoute(
  effectClass: BuilderRightEffectClassV1,
): Exclude<BuilderAuthorityRouteV1, "DENY"> {
  return effectClass === "READ_ONLY" ? "AUTO_EXECUTE" : "OWNER_APPROVAL";
}

export function resolveBuilderAuthorityV1(input: unknown): BuilderAuthorityResultV1 {
  if (!exactKeys(input, [
    "actor",
    "assignments",
    "currentConstraints",
    "customRules",
    "hostSystemCeiling",
    "registeredRights",
    "requestedProfile",
    "schemaVersion",
    "tenant",
  ])) return invalid();
  if (
    input.schemaVersion !== BUILDER_AUTHORITY_INPUT_API_VERSION
    || !isIdentifier(input.tenant)
    || !isIdentifier(input.actor)
  ) return invalid();

  const profile = selectProfile(input.requestedProfile);
  const registeredRights = normalizeRegisteredRights(input.registeredRights);
  const registered = new Set(registeredRights.map(({ rightId }) => rightId));
  const hostSystemCeiling = assertUniqueReferences(input.hostSystemCeiling, registered);
  const assignments = assertUniqueReferences(input.assignments, registered);
  const currentConstraints = assertUniqueReferences(input.currentConstraints, registered);
  const customRules = normalizeCustomRules(input.customRules, registered, profile.selected);
  const customByRight = new Map(customRules.map((rule) => [rule.rightId, rule.route]));
  const hostSet = new Set(hostSystemCeiling);
  const assignmentSet = new Set(assignments);
  const constraintSet = new Set(currentConstraints);

  const decisions = registeredRights.map(({ rightId, effectClass }) => {
    const inHostSystemCeiling = hostSet.has(rightId);
    const customRoute = customByRight.get(rightId);
    const inOwnerProfile = profile.selected !== "CUSTOM" || customRoute !== undefined;
    const inAssignments = assignmentSet.has(rightId);
    const inCurrentConstraints = constraintSet.has(rightId);
    const effective = inHostSystemCeiling
      && inOwnerProfile
      && inAssignments
      && inCurrentConstraints;
    const selectedRoute = profile.selected === "SAFE_GUIDED"
      ? safeGuidedRoute(effectClass)
      : profile.selected === "CUSTOM"
        ? customRoute ?? "OWNER_APPROVAL"
        : "AUTO_EXECUTE";
    const route: BuilderAuthorityRouteV1 = effective ? selectedRoute : "DENY";
    const reasonFacts = [
      `HOST_SYSTEM_CEILING:${inHostSystemCeiling ? "INCLUDED" : "EXCLUDED"}`,
      `OWNER_PROFILE:${inOwnerProfile ? "INCLUDED" : "EXCLUDED"}`,
      `ASSIGNMENT:${inAssignments ? "INCLUDED" : "EXCLUDED"}`,
      `CURRENT_CONSTRAINT:${inCurrentConstraints ? "INCLUDED" : "EXCLUDED"}`,
      profile.defaulted
        ? "PROFILE:SAFE_GUIDED_DEFAULT"
        : `PROFILE:${profile.selected}`,
      `ROUTE:${route}`,
    ];
    return {
      rightId,
      effectClass,
      inHostSystemCeiling,
      inOwnerProfile,
      inAssignments,
      inCurrentConstraints,
      effective,
      route,
      reasonFacts,
    };
  });

  const normalizedInput: BuilderAuthorityInputV1 = {
    schemaVersion: BUILDER_AUTHORITY_INPUT_API_VERSION,
    tenant: input.tenant,
    actor: input.actor,
    requestedProfile: profile.requested,
    registeredRights,
    hostSystemCeiling,
    assignments,
    currentConstraints,
    customRules,
  };
  const core = {
    schemaVersion: BUILDER_AUTHORITY_RESULT_API_VERSION,
    claim: "DECISION_MATRIX_ONLY_NO_EXECUTABLE_AUTHORITY" as const,
    tenant: normalizedInput.tenant,
    actor: normalizedInput.actor,
    profile,
    formula: "HOST_SYSTEM_CEILING_INTERSECT_OWNER_PROFILE_INTERSECT_ASSIGNMENTS_INTERSECT_CURRENT_CONSTRAINTS" as const,
    inputDigest: digest(normalizedInput),
    decisions,
    effectiveRights: decisions.filter(({ effective }) => effective)
      .map(({ rightId }) => rightId),
    automaticRights: decisions.filter(({ route }) => route === "AUTO_EXECUTE")
      .map(({ rightId }) => rightId),
    ownerApprovalRights: decisions.filter(({ route }) => route === "OWNER_APPROVAL")
      .map(({ rightId }) => rightId),
  };
  return { ...core, resultDigest: digest(core) };
}

export function syntheticBuilderAuthorityInputV1(
  requestedProfile: BuilderAuthorityProfileRequestV1 | null = null,
): BuilderAuthorityInputV1 {
  const registeredRights = [
    { rightId: "zoo.record.read", effectClass: "READ_ONLY" },
    { rightId: "zoo.record.update", effectClass: "REVERSIBLE_WRITE" },
    { rightId: "bundle.publish", effectClass: "PUBLICATION" },
  ] as const;
  return {
    schemaVersion: BUILDER_AUTHORITY_INPUT_API_VERSION,
    tenant: "synthetic-zoo",
    actor: "agent:builder",
    requestedProfile,
    registeredRights,
    hostSystemCeiling: registeredRights.map(({ rightId }) => rightId),
    assignments: registeredRights.map(({ rightId }) => rightId),
    currentConstraints: registeredRights.map(({ rightId }) => rightId),
    customRules: requestedProfile === "CUSTOM"
      ? registeredRights.map(({ rightId }) => ({
          rightId,
          route: "OWNER_APPROVAL" as const,
        }))
      : [],
  };
}
