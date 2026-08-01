import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const CAPABILITY_CATALOGUE_API_VERSION =
  "chimpmaera.security/capability-catalogue/v1" as const;
export const CAPABILITY_ACTION_API_VERSION =
  "chimpmaera.security/capability-action/v1" as const;
export const CAPABILITY_CATALOGUE_ADMISSION_API_VERSION =
  "chimpmaera.security/capability-catalogue-admission/v1" as const;
export const CAPABILITY_ACTION_INSPECTION_API_VERSION =
  "chimpmaera.security/capability-action-inspection/v1" as const;
export const SYNTHETIC_CAPABILITY_CATALOGUE_ID =
  "chimpmaera.local/synthetic-provider-actions" as const;
export const SYNTHETIC_CAPABILITY_CATALOGUE_VERSION = "1.0.0" as const;

export const CAPABILITY_CATALOGUE_REQUIRED_NON_CLAIMS_V1 = [
  "LOCAL_SYNTHETIC_FIXTURE_ONLY",
  "NO_ACTIVATION_OR_EXECUTABLE_AUTHORITY",
  "NO_LIVE_ADAPTER_PROVENANCE_OR_COMPATIBILITY_CLAIM",
] as const;

export type CapabilityCatalogueNonClaimV1 =
  typeof CAPABILITY_CATALOGUE_REQUIRED_NON_CLAIMS_V1[number];

export type CapabilityActionV1 = Readonly<{
  schemaVersion: typeof CAPABILITY_ACTION_API_VERSION;
  actionId: "crm.contact.create" | "erp.order.create";
  lifecycleState: "INACTIVE";
  compatibleAdapterVersions: readonly string[];
  resources: readonly string[];
  fields: readonly string[];
  effect: "CREATE";
  providerRequest: Readonly<{
    method: "POST";
    path: "/Contact" | "/orders";
  }>;
  evidence: readonly string[];
  nonClaims: readonly CapabilityCatalogueNonClaimV1[];
}>;

export type CapabilityAdapterV1 = Readonly<{
  adapterId: "espocrm-local-fixture" | "dolibarr-local-fixture";
  adapterVersion: string;
  adapterDigest: string;
  lifecycleState: "INACTIVE";
  actions: readonly CapabilityActionV1[];
}>;

export type CapabilityCatalogueV1 = Readonly<{
  schemaVersion: typeof CAPABILITY_CATALOGUE_API_VERSION;
  catalogueId: typeof SYNTHETIC_CAPABILITY_CATALOGUE_ID;
  catalogueVersion: typeof SYNTHETIC_CAPABILITY_CATALOGUE_VERSION;
  lifecycleState: "INACTIVE";
  adapters: readonly CapabilityAdapterV1[];
}>;

export const CAPABILITY_CATALOGUE_ISSUE_CODES_V1 = [
  "CAPABILITY_ACTION_COMPATIBILITY_DENIED",
  "CAPABILITY_ACTION_DUPLICATE_DENIED",
  "CAPABILITY_ACTION_EVIDENCE_DENIED",
  "CAPABILITY_ACTION_INACTIVE_DENIED",
  "CAPABILITY_ACTION_NON_CLAIMS_DENIED",
  "CAPABILITY_ACTION_SCHEMA_DENIED",
  "CAPABILITY_ACTION_SURFACE_DENIED",
  "CAPABILITY_ACTION_UNKNOWN_DENIED",
  "CAPABILITY_ADAPTER_DIGEST_DENIED",
  "CAPABILITY_ADAPTER_DUPLICATE_DENIED",
  "CAPABILITY_ADAPTER_SCHEMA_DENIED",
  "CAPABILITY_ADAPTER_UNKNOWN_DENIED",
  "CAPABILITY_CATALOGUE_BINDING_DENIED",
  "CAPABILITY_CATALOGUE_INACTIVE_DENIED",
  "CAPABILITY_CATALOGUE_SCHEMA_DENIED",
] as const;
export type CapabilityCatalogueIssueCodeV1 =
  typeof CAPABILITY_CATALOGUE_ISSUE_CODES_V1[number];

export type CapabilityCatalogueAdmissionV1 = Readonly<{
  schemaVersion: typeof CAPABILITY_CATALOGUE_ADMISSION_API_VERSION;
  outcome: "ADMITTED_INACTIVE" | "DENY";
  decision: "DENY";
  claim: "DESCRIPTION_ONLY_NO_POLICY_APPROVAL_AUTHORITY_CREDENTIAL_OR_EFFECT";
  inputDigest: string | null;
  catalogueDigest: string | null;
  catalogue: CapabilityCatalogueV1 | null;
  issues: readonly CapabilityCatalogueIssueCodeV1[];
  resultDigest: string;
}>;

export type CapabilityActionInspectionRequestV1 = Readonly<{
  catalogueDigest: string;
  catalogueVersion: typeof SYNTHETIC_CAPABILITY_CATALOGUE_VERSION;
  adapterId: CapabilityAdapterV1["adapterId"];
  adapterVersion: string;
  actionId: CapabilityActionV1["actionId"];
  resource: string;
  fields: readonly string[];
  effect: "CREATE";
  method: "POST";
  path: "/Contact" | "/orders";
}>;

export type CapabilityActionDescriptorV1 = Readonly<{
  catalogueId: typeof SYNTHETIC_CAPABILITY_CATALOGUE_ID;
  catalogueVersion: typeof SYNTHETIC_CAPABILITY_CATALOGUE_VERSION;
  catalogueDigest: string;
  adapterId: CapabilityAdapterV1["adapterId"];
  adapterVersion: string;
  adapterDigest: string;
  actionId: CapabilityActionV1["actionId"];
  actionDigest: string;
  lifecycleState: "INACTIVE";
  resources: readonly string[];
  fields: readonly string[];
  effect: "CREATE";
  providerRequest: CapabilityActionV1["providerRequest"];
  evidence: readonly string[];
  nonClaims: readonly CapabilityCatalogueNonClaimV1[];
}>;

export type CapabilityActionInspectionV1 = Readonly<{
  schemaVersion: typeof CAPABILITY_ACTION_INSPECTION_API_VERSION;
  outcome: "DESCRIBED_INACTIVE" | "DENY";
  decision: "DENY";
  executable: false;
  claim: "DESCRIPTION_ONLY_NO_POLICY_APPROVAL_AUTHORITY_CREDENTIAL_OR_EFFECT";
  requestDigest: string | null;
  descriptor: CapabilityActionDescriptorV1 | null;
  issues: readonly CapabilityCatalogueIssueCodeV1[];
  resultDigest: string;
}>;

type RecordValue = Record<string, unknown>;

type ActionSpec = Readonly<{
  adapterId: CapabilityAdapterV1["adapterId"];
  adapterVersion: "1.0.0";
  resources: readonly string[];
  fields: readonly string[];
  effect: "CREATE";
  method: "POST";
  path: CapabilityActionV1["providerRequest"]["path"];
}>;

const ACTION_SPECS: Readonly<Record<CapabilityActionV1["actionId"], ActionSpec>> = {
  "crm.contact.create": {
    adapterId: "espocrm-local-fixture",
    adapterVersion: "1.0.0",
    resources: ["espocrm.contact"],
    fields: ["email", "name"],
    effect: "CREATE",
    method: "POST",
    path: "/Contact",
  },
  "erp.order.create": {
    adapterId: "dolibarr-local-fixture",
    adapterVersion: "1.0.0",
    resources: ["dolibarr.order"],
    fields: ["quantity", "sku"],
    effect: "CREATE",
    method: "POST",
    path: "/orders",
  },
};

const ADAPTER_IDS = [
  "dolibarr-local-fixture",
  "espocrm-local-fixture",
] as const;
const ACTION_IDS = ["crm.contact.create", "erp.order.create"] as const;

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function digestOrNull(value: unknown): string | null {
  try {
    return digest(value);
  } catch {
    return null;
  }
}

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

function sortedUniqueStrings(value: unknown): string[] | null {
  if (
    !Array.isArray(value)
    || value.length === 0
    || value.some((entry) => typeof entry !== "string")
    || new Set(value).size !== value.length
  ) return null;
  return [...value].sort() as string[];
}

function sameStringSet(value: readonly string[], expected: readonly string[]): boolean {
  return canonicalJson([...value].sort()) === canonicalJson([...expected].sort());
}

function validEvidenceReference(value: string): boolean {
  return /^docs\/development\/evidence\/[a-z0-9][a-z0-9._/-]{0,180}$/.test(value)
    && !value.includes("..")
    && !value.includes("//")
    && !value.endsWith("/");
}

function makeAdmission(
  core: Omit<CapabilityCatalogueAdmissionV1, "resultDigest">,
): CapabilityCatalogueAdmissionV1 {
  return { ...core, resultDigest: digest(core) };
}

function makeInspection(
  core: Omit<CapabilityActionInspectionV1, "resultDigest">,
): CapabilityActionInspectionV1 {
  return { ...core, resultDigest: digest(core) };
}

function parseAction(
  value: unknown,
  adapterId: CapabilityAdapterV1["adapterId"],
  adapterVersion: string,
  issues: Set<CapabilityCatalogueIssueCodeV1>,
): CapabilityActionV1 | null {
  if (!exactKeys(value, [
    "actionId", "compatibleAdapterVersions", "effect", "evidence", "fields",
    "lifecycleState", "nonClaims", "providerRequest", "resources", "schemaVersion",
  ])) {
    issues.add("CAPABILITY_ACTION_SCHEMA_DENIED");
    return null;
  }
  if (value.lifecycleState !== "INACTIVE") {
    issues.add("CAPABILITY_ACTION_INACTIVE_DENIED");
  }
  if (value.schemaVersion !== CAPABILITY_ACTION_API_VERSION) {
    issues.add("CAPABILITY_ACTION_SCHEMA_DENIED");
  }
  if (!ACTION_IDS.includes(value.actionId as CapabilityActionV1["actionId"])) {
    issues.add("CAPABILITY_ACTION_UNKNOWN_DENIED");
    return null;
  }
  const actionId = value.actionId as CapabilityActionV1["actionId"];
  const spec = ACTION_SPECS[actionId];
  const compatible = sortedUniqueStrings(value.compatibleAdapterVersions);
  if (
    compatible === null
    || !sameStringSet(compatible, [spec.adapterVersion])
    || !compatible.includes(adapterVersion)
  ) {
    issues.add("CAPABILITY_ACTION_COMPATIBILITY_DENIED");
  }
  const resources = sortedUniqueStrings(value.resources);
  const fields = sortedUniqueStrings(value.fields);
  if (
    adapterId !== spec.adapterId
    || resources === null
    || fields === null
    || !sameStringSet(resources, spec.resources)
    || !sameStringSet(fields, spec.fields)
    || value.effect !== spec.effect
    || !exactKeys(value.providerRequest, ["method", "path"])
    || value.providerRequest.method !== spec.method
    || value.providerRequest.path !== spec.path
  ) {
    issues.add("CAPABILITY_ACTION_SURFACE_DENIED");
  }
  const evidence = sortedUniqueStrings(value.evidence);
  if (evidence === null || evidence.some((entry) => !validEvidenceReference(entry))) {
    issues.add("CAPABILITY_ACTION_EVIDENCE_DENIED");
  }
  const nonClaims = sortedUniqueStrings(value.nonClaims);
  if (
    nonClaims === null
    || !sameStringSet(nonClaims, CAPABILITY_CATALOGUE_REQUIRED_NON_CLAIMS_V1)
  ) {
    issues.add("CAPABILITY_ACTION_NON_CLAIMS_DENIED");
  }
  if (
    issues.size > 0
    || compatible === null
    || resources === null
    || fields === null
    || evidence === null
    || nonClaims === null
  ) return null;
  return {
    schemaVersion: CAPABILITY_ACTION_API_VERSION,
    actionId,
    lifecycleState: "INACTIVE",
    compatibleAdapterVersions: compatible,
    resources,
    fields,
    effect: spec.effect,
    providerRequest: { method: spec.method, path: spec.path },
    evidence,
    nonClaims: nonClaims as CapabilityCatalogueNonClaimV1[],
  };
}

function parseAdapter(
  value: unknown,
  issues: Set<CapabilityCatalogueIssueCodeV1>,
): CapabilityAdapterV1 | null {
  if (!exactKeys(value, [
    "actions", "adapterDigest", "adapterId", "adapterVersion", "lifecycleState",
  ])) {
    issues.add("CAPABILITY_ADAPTER_SCHEMA_DENIED");
    return null;
  }
  if (!ADAPTER_IDS.includes(value.adapterId as CapabilityAdapterV1["adapterId"])) {
    issues.add("CAPABILITY_ADAPTER_UNKNOWN_DENIED");
    return null;
  }
  if (value.lifecycleState !== "INACTIVE") {
    issues.add("CAPABILITY_CATALOGUE_INACTIVE_DENIED");
  }
  if (typeof value.adapterVersion !== "string" || value.adapterVersion !== "1.0.0") {
    issues.add("CAPABILITY_ACTION_COMPATIBILITY_DENIED");
  }
  if (typeof value.adapterDigest !== "string" || !/^[a-f0-9]{64}$/.test(value.adapterDigest)) {
    issues.add("CAPABILITY_ADAPTER_DIGEST_DENIED");
  }
  if (!Array.isArray(value.actions) || value.actions.length !== 1) {
    issues.add("CAPABILITY_ADAPTER_SCHEMA_DENIED");
    return null;
  }
  const adapterId = value.adapterId as CapabilityAdapterV1["adapterId"];
  const action = parseAction(value.actions[0], adapterId, String(value.adapterVersion), issues);
  if (
    issues.size > 0
    || action === null
    || typeof value.adapterVersion !== "string"
    || typeof value.adapterDigest !== "string"
  ) return null;
  return {
    adapterId,
    adapterVersion: value.adapterVersion,
    adapterDigest: value.adapterDigest,
    lifecycleState: "INACTIVE",
    actions: [action],
  };
}

export function admitCapabilityCatalogueV1(input: unknown): CapabilityCatalogueAdmissionV1 {
  const issues = new Set<CapabilityCatalogueIssueCodeV1>();
  const inputDigest = digestOrNull(input);
  if (!exactKeys(input, [
    "adapters", "catalogueId", "catalogueVersion", "lifecycleState", "schemaVersion",
  ])) {
    issues.add("CAPABILITY_CATALOGUE_SCHEMA_DENIED");
  }
  if (!isRecord(input)) {
    return makeAdmission({
      schemaVersion: CAPABILITY_CATALOGUE_ADMISSION_API_VERSION,
      outcome: "DENY",
      decision: "DENY",
      claim: "DESCRIPTION_ONLY_NO_POLICY_APPROVAL_AUTHORITY_CREDENTIAL_OR_EFFECT",
      inputDigest,
      catalogueDigest: null,
      catalogue: null,
      issues: [...issues].sort(),
    });
  }
  if (
    input.schemaVersion !== CAPABILITY_CATALOGUE_API_VERSION
    || input.catalogueId !== SYNTHETIC_CAPABILITY_CATALOGUE_ID
    || input.catalogueVersion !== SYNTHETIC_CAPABILITY_CATALOGUE_VERSION
  ) {
    issues.add("CAPABILITY_CATALOGUE_SCHEMA_DENIED");
  }
  if (input.lifecycleState !== "INACTIVE") {
    issues.add("CAPABILITY_CATALOGUE_INACTIVE_DENIED");
  }
  if (!Array.isArray(input.adapters) || input.adapters.length !== ADAPTER_IDS.length) {
    issues.add("CAPABILITY_CATALOGUE_SCHEMA_DENIED");
  }
  const adapters: CapabilityAdapterV1[] = [];
  const adapterIds = new Set<string>();
  const actionIds = new Set<string>();
  if (Array.isArray(input.adapters)) {
    for (const adapterValue of input.adapters) {
      const localIssues = new Set<CapabilityCatalogueIssueCodeV1>();
      const adapter = parseAdapter(adapterValue, localIssues);
      for (const issue of localIssues) issues.add(issue);
      if (adapter === null) continue;
      if (adapterIds.has(adapter.adapterId)) {
        issues.add("CAPABILITY_ADAPTER_DUPLICATE_DENIED");
      }
      adapterIds.add(adapter.adapterId);
      for (const action of adapter.actions) {
        if (actionIds.has(action.actionId)) {
          issues.add("CAPABILITY_ACTION_DUPLICATE_DENIED");
        }
        actionIds.add(action.actionId);
      }
      adapters.push(adapter);
    }
  }
  if (
    !sameStringSet([...adapterIds], ADAPTER_IDS)
    || !sameStringSet([...actionIds], ACTION_IDS)
  ) {
    issues.add("CAPABILITY_CATALOGUE_SCHEMA_DENIED");
  }
  if (issues.size > 0 || adapters.length !== ADAPTER_IDS.length) {
    return makeAdmission({
      schemaVersion: CAPABILITY_CATALOGUE_ADMISSION_API_VERSION,
      outcome: "DENY",
      decision: "DENY",
      claim: "DESCRIPTION_ONLY_NO_POLICY_APPROVAL_AUTHORITY_CREDENTIAL_OR_EFFECT",
      inputDigest,
      catalogueDigest: null,
      catalogue: null,
      issues: [...issues].sort(),
    });
  }
  const catalogue: CapabilityCatalogueV1 = {
    schemaVersion: CAPABILITY_CATALOGUE_API_VERSION,
    catalogueId: SYNTHETIC_CAPABILITY_CATALOGUE_ID,
    catalogueVersion: SYNTHETIC_CAPABILITY_CATALOGUE_VERSION,
    lifecycleState: "INACTIVE",
    adapters: adapters.sort((left, right) => left.adapterId.localeCompare(right.adapterId)),
  };
  return makeAdmission({
    schemaVersion: CAPABILITY_CATALOGUE_ADMISSION_API_VERSION,
    outcome: "ADMITTED_INACTIVE",
    decision: "DENY",
    claim: "DESCRIPTION_ONLY_NO_POLICY_APPROVAL_AUTHORITY_CREDENTIAL_OR_EFFECT",
    inputDigest,
    catalogueDigest: digest(catalogue),
    catalogue,
    issues: ["CAPABILITY_CATALOGUE_INACTIVE_DENIED"],
  });
}

export function verifyCapabilityCatalogueAdmissionV1(
  value: unknown,
): CapabilityCatalogueAdmissionV1 {
  if (!exactKeys(value, [
    "catalogue", "catalogueDigest", "claim", "decision", "inputDigest", "issues",
    "outcome", "resultDigest", "schemaVersion",
  ])) throw new Error("CAPABILITY_CATALOGUE_ADMISSION_INVALID_DENIED");
  const { resultDigest, ...core } = value;
  if (typeof resultDigest !== "string" || digest(core) !== resultDigest) {
    throw new Error("CAPABILITY_CATALOGUE_ADMISSION_INVALID_DENIED");
  }
  if (value.outcome === "ADMITTED_INACTIVE") {
    const repeated = admitCapabilityCatalogueV1(value.catalogue);
    if (
      repeated.outcome !== "ADMITTED_INACTIVE"
      || repeated.catalogueDigest !== value.catalogueDigest
      || value.decision !== "DENY"
    ) throw new Error("CAPABILITY_CATALOGUE_ADMISSION_INVALID_DENIED");
  } else if (value.outcome !== "DENY" || value.catalogue !== null) {
    throw new Error("CAPABILITY_CATALOGUE_ADMISSION_INVALID_DENIED");
  }
  return value as unknown as CapabilityCatalogueAdmissionV1;
}

export function inspectCapabilityActionV1(
  admissionValue: unknown,
  requestValue: unknown,
): CapabilityActionInspectionV1 {
  const requestDigest = digestOrNull(requestValue);
  const issues = new Set<CapabilityCatalogueIssueCodeV1>();
  let admission: CapabilityCatalogueAdmissionV1;
  try {
    admission = verifyCapabilityCatalogueAdmissionV1(admissionValue);
  } catch {
    issues.add("CAPABILITY_CATALOGUE_BINDING_DENIED");
    return makeInspection({
      schemaVersion: CAPABILITY_ACTION_INSPECTION_API_VERSION,
      outcome: "DENY",
      decision: "DENY",
      executable: false,
      claim: "DESCRIPTION_ONLY_NO_POLICY_APPROVAL_AUTHORITY_CREDENTIAL_OR_EFFECT",
      requestDigest,
      descriptor: null,
      issues: [...issues],
    });
  }
  if (
    admission.outcome !== "ADMITTED_INACTIVE"
    || admission.catalogue === null
    || admission.catalogueDigest === null
  ) {
    issues.add("CAPABILITY_CATALOGUE_BINDING_DENIED");
  }
  if (!exactKeys(requestValue, [
    "actionId", "adapterId", "adapterVersion", "catalogueDigest", "catalogueVersion",
    "effect", "fields", "method", "path", "resource",
  ])) {
    issues.add("CAPABILITY_ACTION_SCHEMA_DENIED");
  }
  if (!isRecord(requestValue) || admission.catalogue === null || admission.catalogueDigest === null) {
    return makeInspection({
      schemaVersion: CAPABILITY_ACTION_INSPECTION_API_VERSION,
      outcome: "DENY",
      decision: "DENY",
      executable: false,
      claim: "DESCRIPTION_ONLY_NO_POLICY_APPROVAL_AUTHORITY_CREDENTIAL_OR_EFFECT",
      requestDigest,
      descriptor: null,
      issues: [...issues].sort(),
    });
  }
  if (
    requestValue.catalogueDigest !== admission.catalogueDigest
    || requestValue.catalogueVersion !== admission.catalogue.catalogueVersion
  ) issues.add("CAPABILITY_CATALOGUE_BINDING_DENIED");
  const adapter = admission.catalogue.adapters.find(
    (candidate) => candidate.adapterId === requestValue.adapterId,
  );
  if (adapter === undefined) {
    issues.add("CAPABILITY_ADAPTER_UNKNOWN_DENIED");
  } else if (adapter.adapterVersion !== requestValue.adapterVersion) {
    issues.add("CAPABILITY_ACTION_COMPATIBILITY_DENIED");
  }
  const action = adapter?.actions.find(
    (candidate) => candidate.actionId === requestValue.actionId,
  );
  if (action === undefined) {
    issues.add("CAPABILITY_ACTION_UNKNOWN_DENIED");
  } else {
    const requestedFields = sortedUniqueStrings(requestValue.fields);
    if (
      requestValue.resource !== action.resources[0]
      || requestedFields === null
      || !sameStringSet(requestedFields, action.fields)
      || requestValue.effect !== action.effect
      || requestValue.method !== action.providerRequest.method
      || requestValue.path !== action.providerRequest.path
    ) issues.add("CAPABILITY_ACTION_SURFACE_DENIED");
  }
  if (issues.size > 0 || adapter === undefined || action === undefined) {
    return makeInspection({
      schemaVersion: CAPABILITY_ACTION_INSPECTION_API_VERSION,
      outcome: "DENY",
      decision: "DENY",
      executable: false,
      claim: "DESCRIPTION_ONLY_NO_POLICY_APPROVAL_AUTHORITY_CREDENTIAL_OR_EFFECT",
      requestDigest,
      descriptor: null,
      issues: [...issues].sort(),
    });
  }
  const descriptor: CapabilityActionDescriptorV1 = {
    catalogueId: admission.catalogue.catalogueId,
    catalogueVersion: admission.catalogue.catalogueVersion,
    catalogueDigest: admission.catalogueDigest,
    adapterId: adapter.adapterId,
    adapterVersion: adapter.adapterVersion,
    adapterDigest: adapter.adapterDigest,
    actionId: action.actionId,
    actionDigest: digest(action),
    lifecycleState: "INACTIVE",
    resources: action.resources,
    fields: action.fields,
    effect: action.effect,
    providerRequest: action.providerRequest,
    evidence: action.evidence,
    nonClaims: action.nonClaims,
  };
  return makeInspection({
    schemaVersion: CAPABILITY_ACTION_INSPECTION_API_VERSION,
    outcome: "DESCRIBED_INACTIVE",
    decision: "DENY",
    executable: false,
    claim: "DESCRIPTION_ONLY_NO_POLICY_APPROVAL_AUTHORITY_CREDENTIAL_OR_EFFECT",
    requestDigest,
    descriptor,
    issues: ["CAPABILITY_ACTION_INACTIVE_DENIED"],
  });
}

export function verifyCapabilityActionInspectionV1(
  value: unknown,
): CapabilityActionInspectionV1 {
  if (!exactKeys(value, [
    "claim", "decision", "descriptor", "executable", "issues", "outcome",
    "requestDigest", "resultDigest", "schemaVersion",
  ])) throw new Error("CAPABILITY_ACTION_INSPECTION_INVALID_DENIED");
  const { resultDigest, ...core } = value;
  if (
    typeof resultDigest !== "string"
    || digest(core) !== resultDigest
    || value.decision !== "DENY"
    || value.executable !== false
  ) throw new Error("CAPABILITY_ACTION_INSPECTION_INVALID_DENIED");
  return value as unknown as CapabilityActionInspectionV1;
}

export function syntheticCapabilityCatalogueV1(): CapabilityCatalogueV1 {
  const evidence = [
    "docs/development/evidence/admin-ai-aas-012-20260801.json",
  ];
  const nonClaims = [...CAPABILITY_CATALOGUE_REQUIRED_NON_CLAIMS_V1];
  return {
    schemaVersion: CAPABILITY_CATALOGUE_API_VERSION,
    catalogueId: SYNTHETIC_CAPABILITY_CATALOGUE_ID,
    catalogueVersion: SYNTHETIC_CAPABILITY_CATALOGUE_VERSION,
    lifecycleState: "INACTIVE",
    adapters: [
      {
        adapterId: "dolibarr-local-fixture",
        adapterVersion: "1.0.0",
        adapterDigest: "d".repeat(64),
        lifecycleState: "INACTIVE",
        actions: [{
          schemaVersion: CAPABILITY_ACTION_API_VERSION,
          actionId: "erp.order.create",
          lifecycleState: "INACTIVE",
          compatibleAdapterVersions: ["1.0.0"],
          resources: ["dolibarr.order"],
          fields: ["quantity", "sku"],
          effect: "CREATE",
          providerRequest: { method: "POST", path: "/orders" },
          evidence,
          nonClaims,
        }],
      },
      {
        adapterId: "espocrm-local-fixture",
        adapterVersion: "1.0.0",
        adapterDigest: "e".repeat(64),
        lifecycleState: "INACTIVE",
        actions: [{
          schemaVersion: CAPABILITY_ACTION_API_VERSION,
          actionId: "crm.contact.create",
          lifecycleState: "INACTIVE",
          compatibleAdapterVersions: ["1.0.0"],
          resources: ["espocrm.contact"],
          fields: ["email", "name"],
          effect: "CREATE",
          providerRequest: { method: "POST", path: "/Contact" },
          evidence,
          nonClaims,
        }],
      },
    ],
  };
}

export function syntheticCapabilityActionInspectionRequestV1(
  admission: CapabilityCatalogueAdmissionV1,
  actionId: CapabilityActionV1["actionId"] = "crm.contact.create",
): CapabilityActionInspectionRequestV1 {
  if (admission.catalogueDigest === null) {
    throw new Error("CAPABILITY_CATALOGUE_NOT_ADMITTED_DENIED");
  }
  const spec = ACTION_SPECS[actionId];
  return {
    catalogueDigest: admission.catalogueDigest,
    catalogueVersion: SYNTHETIC_CAPABILITY_CATALOGUE_VERSION,
    adapterId: spec.adapterId,
    adapterVersion: spec.adapterVersion,
    actionId,
    resource: spec.resources[0] ?? "",
    fields: spec.fields,
    effect: spec.effect,
    method: spec.method,
    path: spec.path,
  };
}
