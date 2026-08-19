import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const CONTENT_ENVELOPE_API_VERSION =
  "chimpmaera.security/content-envelope/v1" as const;
export const TYPED_ACTION_CANDIDATE_API_VERSION =
  "chimpmaera.security/typed-action-candidate/v1" as const;
export const TRUSTED_RECONSTRUCTION_CONTEXT_API_VERSION =
  "chimpmaera.security/trusted-reconstruction-context/v1" as const;
export const TRUST_BOUNDARY_RESULT_API_VERSION =
  "chimpmaera.security/trust-boundary-result/v1" as const;
export const TRUSTED_ACTION_CATALOG_VERSION =
  "chimpmaera.security/trusted-action-catalog/v1" as const;

export const CONTENT_ORIGINS_V1 = [
  "PROVIDER",
  "TOOL",
  "DOCUMENT",
  "MEMORY",
] as const;
export type ContentOriginV1 = typeof CONTENT_ORIGINS_V1[number];

export const CONTENT_TRUST_LABELS_V1 = [
  "UNTRUSTED_PROVIDER_CONTENT",
  "UNTRUSTED_TOOL_OUTPUT",
  "UNTRUSTED_RETRIEVED_DOCUMENT",
  "UNTRUSTED_RECALLED_MEMORY",
] as const;
export type ContentTrustLabelV1 = typeof CONTENT_TRUST_LABELS_V1[number];

export const CONTENT_DATA_CLASSES_V1 = [
  "PUBLIC",
  "INTERNAL_SYNTHETIC",
  "CONFIDENTIAL_SYNTHETIC",
] as const;
export type ContentDataClassV1 = typeof CONTENT_DATA_CLASSES_V1[number];

export type ContentEnvelopeV1 = Readonly<{
  schemaVersion: typeof CONTENT_ENVELOPE_API_VERSION;
  envelopeId: string;
  origin: ContentOriginV1;
  trust: ContentTrustLabelV1;
  tenant: string;
  dataClass: ContentDataClassV1;
  instructionEligibility: "DATA_ONLY";
  content: string;
}>;

export type TypedActionCandidateV1 = Readonly<{
  schemaVersion: typeof TYPED_ACTION_CANDIDATE_API_VERSION;
  catalogVersion: typeof TRUSTED_ACTION_CATALOG_VERSION;
  actionId: "crm.contact.create" | "erp.order.create";
  arguments: Readonly<Record<string, string | number>>;
  evidenceEnvelopeIds: readonly string[];
}>;

export type TrustedReconstructionContextV1 = Readonly<{
  schemaVersion: typeof TRUSTED_RECONSTRUCTION_CONTEXT_API_VERSION;
  catalogVersion: typeof TRUSTED_ACTION_CATALOG_VERSION;
  actor: string;
  tenant: string;
  replayKey: string;
  envelopes: readonly ContentEnvelopeV1[];
}>;

export type ReconstructedActionCandidateV1 = Readonly<{
  actionType: "PROVIDER_MUTATION_CANDIDATE";
  actor: string;
  catalogVersion: typeof TRUSTED_ACTION_CATALOG_VERSION;
  credentialHandle: string;
  payload: Readonly<{
    method: "POST";
    path: "/Contact" | "/orders";
    body: Readonly<Record<string, string | number>>;
  }>;
  replayKey: string;
  scope: Readonly<{
    actor: string;
    tenant: string;
    provider: "espocrm" | "dolibarr";
    entity: "Contact" | "Order";
    operation: "CREATE_IF_ABSENT";
  }>;
}>;

export const TRUST_BOUNDARY_ISSUE_CODES_V1 = [
  "TRUST_BOUNDARY_ACTION_UNKNOWN_DENIED",
  "TRUST_BOUNDARY_ARGUMENT_SCHEMA_DENIED",
  "TRUST_BOUNDARY_CANDIDATE_SCHEMA_DENIED",
  "TRUST_BOUNDARY_CATALOG_VERSION_DENIED",
  "TRUST_BOUNDARY_CONTEXT_SCHEMA_DENIED",
  "TRUST_BOUNDARY_ENVELOPE_DUPLICATE_DENIED",
  "TRUST_BOUNDARY_ENVELOPE_SCHEMA_DENIED",
  "TRUST_BOUNDARY_EVIDENCE_BINDING_DENIED",
  "TRUST_BOUNDARY_INSTRUCTION_ELIGIBILITY_DENIED",
  "TRUST_BOUNDARY_ORIGIN_TRUST_MISMATCH_DENIED",
  "TRUST_BOUNDARY_TENANT_BINDING_DENIED",
] as const;
export type TrustBoundaryIssueCodeV1 =
  typeof TRUST_BOUNDARY_ISSUE_CODES_V1[number];

export type TrustBoundaryResultV1 = Readonly<{
  schemaVersion: typeof TRUST_BOUNDARY_RESULT_API_VERSION;
  outcome: "RECONSTRUCTED_CANDIDATE" | "DENY";
  claim: "CANDIDATE_ONLY_NO_DECISION_APPROVAL_AUTHORITY_OR_PROVIDER_CALL";
  inputDigest: string | null;
  candidateDigest: string | null;
  evidenceDigest: string | null;
  actionDigest: string | null;
  action: ReconstructedActionCandidateV1 | null;
  evidence: readonly Readonly<{
    envelopeId: string;
    origin: ContentOriginV1;
    trust: ContentTrustLabelV1;
    tenant: string;
    dataClass: ContentDataClassV1;
    instructionEligibility: "DATA_ONLY";
    contentDigest: string;
  }>[];
  issues: readonly TrustBoundaryIssueCodeV1[];
  resultDigest: string;
}>;

type RecordValue = Record<string, unknown>;

const EXPECTED_TRUST: Readonly<Record<ContentOriginV1, ContentTrustLabelV1>> = {
  PROVIDER: "UNTRUSTED_PROVIDER_CONTENT",
  TOOL: "UNTRUSTED_TOOL_OUTPUT",
  DOCUMENT: "UNTRUSTED_RETRIEVED_DOCUMENT",
  MEMORY: "UNTRUSTED_RECALLED_MEMORY",
};

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
    && canonicalJson(Object.keys(value).sort())
      === canonicalJson([...expected].sort());
}

function isBoundIdentifier(value: unknown): value is string {
  return typeof value === "string"
    && /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/.test(value);
}

function isBoundText(value: unknown, maximum: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximum
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
}

function makeResult(
  core: Omit<TrustBoundaryResultV1, "resultDigest">,
): TrustBoundaryResultV1 {
  return { ...core, resultDigest: digest(core) };
}

function deny(
  candidate: unknown,
  trustedContext: unknown,
  issues: ReadonlySet<TrustBoundaryIssueCodeV1>,
): TrustBoundaryResultV1 {
  return makeResult({
    schemaVersion: TRUST_BOUNDARY_RESULT_API_VERSION,
    outcome: "DENY",
    claim: "CANDIDATE_ONLY_NO_DECISION_APPROVAL_AUTHORITY_OR_PROVIDER_CALL",
    inputDigest: digestOrNull({ candidate, trustedContext }),
    candidateDigest: null,
    evidenceDigest: null,
    actionDigest: null,
    action: null,
    evidence: [],
    issues: [...issues].sort(),
  });
}

function parseEnvelope(
  value: unknown,
  tenant: string,
  issues: Set<TrustBoundaryIssueCodeV1>,
): ContentEnvelopeV1 | null {
  if (!isRecord(value)) {
    issues.add("TRUST_BOUNDARY_ENVELOPE_SCHEMA_DENIED");
    return null;
  }
  if (!exactKeys(value, [
    "content",
    "dataClass",
    "envelopeId",
    "instructionEligibility",
    "origin",
    "schemaVersion",
    "tenant",
    "trust",
  ])) {
    issues.add("TRUST_BOUNDARY_ENVELOPE_SCHEMA_DENIED");
    return null;
  }
  if (
    value.schemaVersion !== CONTENT_ENVELOPE_API_VERSION
    || !isBoundIdentifier(value.envelopeId)
    || !CONTENT_ORIGINS_V1.includes(value.origin as ContentOriginV1)
    || !CONTENT_TRUST_LABELS_V1.includes(value.trust as ContentTrustLabelV1)
    || !CONTENT_DATA_CLASSES_V1.includes(value.dataClass as ContentDataClassV1)
    || !isBoundText(value.content, 16_384)
    || !isBoundIdentifier(value.tenant)
  ) {
    issues.add("TRUST_BOUNDARY_ENVELOPE_SCHEMA_DENIED");
    return null;
  }
  if (value.instructionEligibility !== "DATA_ONLY") {
    issues.add("TRUST_BOUNDARY_INSTRUCTION_ELIGIBILITY_DENIED");
  }
  if (value.tenant !== tenant) {
    issues.add("TRUST_BOUNDARY_TENANT_BINDING_DENIED");
  }
  const origin = value.origin as ContentOriginV1;
  const trust = value.trust as ContentTrustLabelV1;
  if (EXPECTED_TRUST[origin] !== trust) {
    issues.add("TRUST_BOUNDARY_ORIGIN_TRUST_MISMATCH_DENIED");
  }
  if (issues.size > 0) return null;
  return {
    schemaVersion: CONTENT_ENVELOPE_API_VERSION,
    envelopeId: value.envelopeId,
    origin,
    trust,
    tenant: value.tenant,
    dataClass: value.dataClass as ContentDataClassV1,
    instructionEligibility: "DATA_ONLY",
    content: value.content,
  };
}

function parseContext(
  value: unknown,
  issues: Set<TrustBoundaryIssueCodeV1>,
): TrustedReconstructionContextV1 | null {
  if (!exactKeys(value, [
    "actor",
    "catalogVersion",
    "envelopes",
    "replayKey",
    "schemaVersion",
    "tenant",
  ])) {
    issues.add("TRUST_BOUNDARY_CONTEXT_SCHEMA_DENIED");
    return null;
  }
  if (
    value.schemaVersion !== TRUSTED_RECONSTRUCTION_CONTEXT_API_VERSION
    || !isBoundIdentifier(value.actor)
    || !isBoundIdentifier(value.tenant)
    || typeof value.replayKey !== "string"
    || !/^admin-ai:poc:[A-Za-z0-9:._-]{8,140}$/.test(value.replayKey)
    || !Array.isArray(value.envelopes)
    || value.envelopes.length < 1
    || value.envelopes.length > 32
  ) {
    issues.add("TRUST_BOUNDARY_CONTEXT_SCHEMA_DENIED");
    return null;
  }
  if (value.catalogVersion !== TRUSTED_ACTION_CATALOG_VERSION) {
    issues.add("TRUST_BOUNDARY_CATALOG_VERSION_DENIED");
  }
  const envelopes: ContentEnvelopeV1[] = [];
  const ids = new Set<string>();
  for (const envelopeValue of value.envelopes) {
    const envelopeIssues = new Set<TrustBoundaryIssueCodeV1>();
    const envelope = parseEnvelope(envelopeValue, value.tenant, envelopeIssues);
    for (const issue of envelopeIssues) issues.add(issue);
    if (envelope === null) continue;
    if (ids.has(envelope.envelopeId)) {
      issues.add("TRUST_BOUNDARY_ENVELOPE_DUPLICATE_DENIED");
      continue;
    }
    ids.add(envelope.envelopeId);
    envelopes.push(envelope);
  }
  if (issues.size > 0 || envelopes.length !== value.envelopes.length) return null;
  return {
    schemaVersion: TRUSTED_RECONSTRUCTION_CONTEXT_API_VERSION,
    catalogVersion: TRUSTED_ACTION_CATALOG_VERSION,
    actor: value.actor,
    tenant: value.tenant,
    replayKey: value.replayKey,
    envelopes: envelopes.sort((left, right) =>
      left.envelopeId.localeCompare(right.envelopeId)),
  };
}

function parseContactArguments(
  value: unknown,
  issues: Set<TrustBoundaryIssueCodeV1>,
): Readonly<Record<string, string | number>> | null {
  if (!exactKeys(value, ["emailAddress", "firstName", "lastName"])) {
    issues.add("TRUST_BOUNDARY_ARGUMENT_SCHEMA_DENIED");
    return null;
  }
  if (
    !isBoundText(value.firstName, 80)
    || !isBoundText(value.lastName, 80)
    || typeof value.emailAddress !== "string"
    || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9.-]{1,190}$/.test(
      value.emailAddress,
    )
  ) {
    issues.add("TRUST_BOUNDARY_ARGUMENT_SCHEMA_DENIED");
    return null;
  }
  return {
    emailAddress: value.emailAddress,
    firstName: value.firstName,
    lastName: value.lastName,
  };
}

function parseOrderArguments(
  value: unknown,
  issues: Set<TrustBoundaryIssueCodeV1>,
): Readonly<Record<string, string | number>> | null {
  if (!exactKeys(value, ["customerId", "customerReference", "orderDateEpoch"])) {
    issues.add("TRUST_BOUNDARY_ARGUMENT_SCHEMA_DENIED");
    return null;
  }
  if (
    !Number.isSafeInteger(value.customerId)
    || (value.customerId as number) < 1
    || (value.customerId as number) > 1_000_000
    || !Number.isSafeInteger(value.orderDateEpoch)
    || (value.orderDateEpoch as number) < 1_735_689_600
    || (value.orderDateEpoch as number) > 1_893_456_000
    || typeof value.customerReference !== "string"
    || !/^CM-[A-Z0-9-]{1,61}$/.test(value.customerReference)
  ) {
    issues.add("TRUST_BOUNDARY_ARGUMENT_SCHEMA_DENIED");
    return null;
  }
  return {
    customerId: value.customerId as number,
    customerReference: value.customerReference,
    orderDateEpoch: value.orderDateEpoch as number,
  };
}

type ParsedCandidate = Readonly<{
  schemaVersion: typeof TYPED_ACTION_CANDIDATE_API_VERSION;
  catalogVersion: typeof TRUSTED_ACTION_CATALOG_VERSION;
  actionId: "crm.contact.create" | "erp.order.create";
  arguments: Readonly<Record<string, string | number>>;
  evidenceEnvelopeIds: readonly string[];
}>;

function parseCandidate(
  value: unknown,
  context: TrustedReconstructionContextV1,
  issues: Set<TrustBoundaryIssueCodeV1>,
): ParsedCandidate | null {
  if (!exactKeys(value, [
    "actionId",
    "arguments",
    "catalogVersion",
    "evidenceEnvelopeIds",
    "schemaVersion",
  ])) {
    issues.add("TRUST_BOUNDARY_CANDIDATE_SCHEMA_DENIED");
    return null;
  }
  if (
    value.schemaVersion !== TYPED_ACTION_CANDIDATE_API_VERSION
    || !Array.isArray(value.evidenceEnvelopeIds)
    || value.evidenceEnvelopeIds.length < 1
    || value.evidenceEnvelopeIds.some((entry) => !isBoundIdentifier(entry))
  ) {
    issues.add("TRUST_BOUNDARY_CANDIDATE_SCHEMA_DENIED");
    return null;
  }
  if (value.catalogVersion !== TRUSTED_ACTION_CATALOG_VERSION) {
    issues.add("TRUST_BOUNDARY_CATALOG_VERSION_DENIED");
  }
  if (!isRecord(value.arguments)) {
    issues.add("TRUST_BOUNDARY_ARGUMENT_SCHEMA_DENIED");
    return null;
  }
  let argumentsValue: Readonly<Record<string, string | number>> | null = null;
  if (value.actionId === "crm.contact.create") {
    argumentsValue = parseContactArguments(value.arguments, issues);
  } else if (value.actionId === "erp.order.create") {
    argumentsValue = parseOrderArguments(value.arguments, issues);
  } else {
    issues.add("TRUST_BOUNDARY_ACTION_UNKNOWN_DENIED");
  }
  const evidenceIds = value.evidenceEnvelopeIds as string[];
  const uniqueIds = [...new Set(evidenceIds)].sort();
  const contextIds = context.envelopes.map(({ envelopeId }) => envelopeId).sort();
  if (
    uniqueIds.length !== evidenceIds.length
    || canonicalJson(uniqueIds) !== canonicalJson(contextIds)
  ) {
    issues.add("TRUST_BOUNDARY_EVIDENCE_BINDING_DENIED");
  }
  if (issues.size > 0 || argumentsValue === null) return null;
  return {
    schemaVersion: TYPED_ACTION_CANDIDATE_API_VERSION,
    catalogVersion: TRUSTED_ACTION_CATALOG_VERSION,
    actionId: value.actionId as ParsedCandidate["actionId"],
    arguments: argumentsValue,
    evidenceEnvelopeIds: uniqueIds,
  };
}

function reconstructAction(
  candidate: ParsedCandidate,
  context: TrustedReconstructionContextV1,
): ReconstructedActionCandidateV1 {
  if (candidate.actionId === "crm.contact.create") {
    return {
      actionType: "PROVIDER_MUTATION_CANDIDATE",
      actor: context.actor,
      catalogVersion: TRUSTED_ACTION_CATALOG_VERSION,
      credentialHandle: "secret-handle:espocrm-local-v1",
      payload: {
        method: "POST",
        path: "/Contact",
        body: {
          description: "PanSphaira trust-boundary synthetic contact",
          emailAddress: candidate.arguments.emailAddress as string,
          firstName: candidate.arguments.firstName as string,
          lastName: candidate.arguments.lastName as string,
        },
      },
      replayKey: context.replayKey,
      scope: {
        actor: context.actor,
        tenant: context.tenant,
        provider: "espocrm",
        entity: "Contact",
        operation: "CREATE_IF_ABSENT",
      },
    };
  }
  return {
    actionType: "PROVIDER_MUTATION_CANDIDATE",
    actor: context.actor,
    catalogVersion: TRUSTED_ACTION_CATALOG_VERSION,
    credentialHandle: "secret-handle:dolibarr-local-v1",
    payload: {
      method: "POST",
      path: "/orders",
      body: {
        date: candidate.arguments.orderDateEpoch as number,
        ref_client: candidate.arguments.customerReference as string,
        socid: candidate.arguments.customerId as number,
      },
    },
    replayKey: context.replayKey,
    scope: {
      actor: context.actor,
      tenant: context.tenant,
      provider: "dolibarr",
      entity: "Order",
      operation: "CREATE_IF_ABSENT",
    },
  };
}

export function reconstructTrustedActionCandidateV1(
  candidateValue: unknown,
  trustedContextValue: unknown,
): TrustBoundaryResultV1 {
  const issues = new Set<TrustBoundaryIssueCodeV1>();
  const context = parseContext(trustedContextValue, issues);
  if (context === null) return deny(candidateValue, trustedContextValue, issues);
  const candidate = parseCandidate(candidateValue, context, issues);
  if (candidate === null) return deny(candidateValue, trustedContextValue, issues);

  const evidence = context.envelopes.map((envelope) => ({
    envelopeId: envelope.envelopeId,
    origin: envelope.origin,
    trust: envelope.trust,
    tenant: envelope.tenant,
    dataClass: envelope.dataClass,
    instructionEligibility: envelope.instructionEligibility,
    contentDigest: digest(envelope.content),
  }));
  const action = reconstructAction(candidate, context);
  return makeResult({
    schemaVersion: TRUST_BOUNDARY_RESULT_API_VERSION,
    outcome: "RECONSTRUCTED_CANDIDATE",
    claim: "CANDIDATE_ONLY_NO_DECISION_APPROVAL_AUTHORITY_OR_PROVIDER_CALL",
    inputDigest: digest({ candidate, trustedContext: context }),
    candidateDigest: digest(candidate),
    evidenceDigest: digest(evidence),
    actionDigest: digest(action),
    action,
    evidence,
    issues: [],
  });
}

export function verifyTrustBoundaryResultV1(value: unknown): TrustBoundaryResultV1 {
  if (!exactKeys(value, [
    "action",
    "actionDigest",
    "candidateDigest",
    "claim",
    "evidence",
    "evidenceDigest",
    "inputDigest",
    "issues",
    "outcome",
    "resultDigest",
    "schemaVersion",
  ])) throw new Error("TRUST_BOUNDARY_RESULT_INVALID_DENIED");
  const { resultDigest, ...core } = value;
  if (
    value.schemaVersion !== TRUST_BOUNDARY_RESULT_API_VERSION
    || value.claim !== "CANDIDATE_ONLY_NO_DECISION_APPROVAL_AUTHORITY_OR_PROVIDER_CALL"
    || typeof resultDigest !== "string"
    || digest(core) !== resultDigest
  ) throw new Error("TRUST_BOUNDARY_RESULT_INVALID_DENIED");
  if (value.outcome === "RECONSTRUCTED_CANDIDATE") {
    if (
      !isRecord(value.action)
      || typeof value.actionDigest !== "string"
      || digest(value.action) !== value.actionDigest
      || !Array.isArray(value.evidence)
      || typeof value.evidenceDigest !== "string"
      || digest(value.evidence) !== value.evidenceDigest
      || !Array.isArray(value.issues)
      || value.issues.length !== 0
    ) throw new Error("TRUST_BOUNDARY_RESULT_INVALID_DENIED");
  } else if (
    value.outcome !== "DENY"
    || value.action !== null
    || value.actionDigest !== null
    || value.candidateDigest !== null
    || value.evidenceDigest !== null
    || !Array.isArray(value.evidence)
    || value.evidence.length !== 0
    || !Array.isArray(value.issues)
    || value.issues.length < 1
  ) {
    throw new Error("TRUST_BOUNDARY_RESULT_INVALID_DENIED");
  }
  return value as unknown as TrustBoundaryResultV1;
}

export function syntheticTrustedReconstructionContextV1(
  content: Partial<Record<ContentOriginV1, string>> = {},
): TrustedReconstructionContextV1 {
  const tenant = "panskys-zoo-demo";
  const envelope = (
    origin: ContentOriginV1,
    suffix: string,
    fallback: string,
  ): ContentEnvelopeV1 => ({
    schemaVersion: CONTENT_ENVELOPE_API_VERSION,
    envelopeId: `evidence:${suffix}:v1`,
    origin,
    trust: EXPECTED_TRUST[origin],
    tenant,
    dataClass: "INTERNAL_SYNTHETIC",
    instructionEligibility: "DATA_ONLY",
    content: content[origin] ?? fallback,
  });
  return {
    schemaVersion: TRUSTED_RECONSTRUCTION_CONTEXT_API_VERSION,
    catalogVersion: TRUSTED_ACTION_CATALOG_VERSION,
    actor: "agent:admin-ai-poc",
    tenant,
    replayKey: "admin-ai:poc:trust-boundary-001",
    envelopes: [
      envelope("PROVIDER", "provider", "Synthetic provider record."),
      envelope("TOOL", "tool", "Synthetic tool output."),
      envelope("DOCUMENT", "document", "Synthetic retrieved document."),
      envelope("MEMORY", "memory", "Synthetic recalled memory."),
    ],
  };
}

export function syntheticTypedActionCandidateV1(
  actionId: TypedActionCandidateV1["actionId"] = "crm.contact.create",
): TypedActionCandidateV1 {
  return {
    schemaVersion: TYPED_ACTION_CANDIDATE_API_VERSION,
    catalogVersion: TRUSTED_ACTION_CATALOG_VERSION,
    actionId,
    arguments: actionId === "crm.contact.create"
      ? {
          emailAddress: "trust-boundary@example.invalid",
          firstName: "Avery",
          lastName: "Boundary",
        }
      : {
          customerId: 7,
          customerReference: "CM-TRUST-BOUNDARY-001",
          orderDateEpoch: 1_767_225_600,
        },
    evidenceEnvelopeIds: [
      "evidence:provider:v1",
      "evidence:tool:v1",
      "evidence:document:v1",
      "evidence:memory:v1",
    ],
  };
}
