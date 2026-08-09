import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const CRM_READ_CONNECTOR_SCHEMA_V1 = "chimpmaera.connector/crm-read/v1" as const;
export const CRM_READ_SOURCE_SCHEMA_V1 = "chimpmaera.connector/crm-supported-export/v1" as const;
export const CRM_READ_SCOPE_V1 = "crm.synthetic.bi.read" as const;

export type CrmEntityV1 = "accounts" | "opportunities";
export type CrmReadDenialCodeV1 =
  | "CONNECTOR_DISABLED" | "CREDENTIAL_MISSING" | "OPERATION_DENIED" | "MUTATION_DENIED"
  | "TENANT_MISMATCH" | "SCOPE_DENIED" | "FIELD_DENIED" | "REQUEST_MALFORMED"
  | "SOURCE_MALFORMED" | "SOURCE_STALE" | "SOURCE_PARTIAL" | "CURSOR_REPLAYED" | "CURSOR_STALE";

export interface CrmAccountV1 { readonly accountId: string; readonly accountName: string; readonly industry: string; }
export interface CrmOpportunityV1 { readonly opportunityId: string; readonly accountId: string; readonly opportunityName: string; readonly stage: "QUALIFY" | "PROPOSE" | "WON" | "LOST"; readonly amount: number; readonly currency: "EUR"; readonly expectedCloseDate: string; }
export type CrmRecordV1 = CrmAccountV1 | CrmOpportunityV1;

export interface CrmReadConnectorContractV1 {
  readonly schemaVersion: typeof CRM_READ_CONNECTOR_SCHEMA_V1;
  readonly contractVersion: "1.0.0";
  readonly connectorId: "connector:synthetic-crm-bi-v1";
  readonly defaultEnabled: false;
  readonly adapter: "SUPPORTED_EXPORT_API_SHAPED";
  readonly evidenceClass: "LOCAL_SYNTHETIC";
  readonly tenantId: "tenant:synthetic-zoo";
  readonly identity: { readonly principalId: "principal:bi-m1-reader"; readonly scopes: readonly [typeof CRM_READ_SCOPE_V1]; readonly credentialSource: "EXPLICIT_REFERENCE_ONLY"; };
  readonly operations: readonly ["LIST_ACCOUNTS", "LIST_OPPORTUNITIES", "READ_SOURCE_FACTS"];
  readonly fields: { readonly accounts: readonly ["accountId", "accountName", "industry"]; readonly opportunities: readonly ["opportunityId", "accountId", "opportunityName", "stage", "amount", "currency", "expectedCloseDate"]; };
  readonly policy: { readonly maxPageSize: 2; readonly maxAgeSeconds: 3600; readonly writesAllowed: false; readonly adminAllowed: false; readonly unknownFieldsAllowed: false; };
  readonly contractDigest: string;
}

export interface CrmSupportedExportV1 {
  readonly schemaVersion: typeof CRM_READ_SOURCE_SCHEMA_V1;
  readonly exportId: string;
  readonly tenantId: string;
  readonly generatedAt: string;
  readonly expiresAt: string;
  readonly lineage: { readonly sourceSystem: "SYNTHETIC_CRM"; readonly sourceDatasetId: string; readonly extractionMode: "SUPPORTED_EXPORT"; readonly sourceDigest: string; };
  readonly batches: readonly { readonly batchId: string; readonly entity: CrmEntityV1; readonly sequence: number; readonly complete: boolean; readonly records: readonly CrmRecordV1[]; }[];
}

export interface CrmReadRequestV1 { readonly operation: "LIST_ACCOUNTS" | "LIST_OPPORTUNITIES" | "READ_SOURCE_FACTS"; readonly tenantId: string; readonly principalId: string; readonly scopes: readonly string[]; readonly credentialPresent: boolean; readonly fields: readonly string[]; readonly pageSize: number; readonly cursor?: string; }
export type CrmReadResultV1 = { readonly outcome: "DENIED"; readonly code: CrmReadDenialCodeV1 } | { readonly outcome: "READ"; readonly entity: CrmEntityV1; readonly records: readonly CrmRecordV1[]; readonly metadata: { readonly tenantId: string; readonly trust: "LOCAL_SYNTHETIC"; readonly exportId: string; readonly generatedAt: string; readonly expiresAt: string; readonly sourceDatasetId: string; readonly sourceDigest: string; readonly batchIds: readonly string[]; readonly recordCount: number; readonly pageSize: number; readonly nextCursor: string | null; }; readonly readbackDigest: string; };

const CONTRACT_CONTENT = {
  schemaVersion: CRM_READ_CONNECTOR_SCHEMA_V1, contractVersion: "1.0.0", connectorId: "connector:synthetic-crm-bi-v1", defaultEnabled: false,
  adapter: "SUPPORTED_EXPORT_API_SHAPED", evidenceClass: "LOCAL_SYNTHETIC", tenantId: "tenant:synthetic-zoo",
  identity: { principalId: "principal:bi-m1-reader", scopes: [CRM_READ_SCOPE_V1], credentialSource: "EXPLICIT_REFERENCE_ONLY" },
  operations: ["LIST_ACCOUNTS", "LIST_OPPORTUNITIES", "READ_SOURCE_FACTS"],
  fields: { accounts: ["accountId", "accountName", "industry"], opportunities: ["opportunityId", "accountId", "opportunityName", "stage", "amount", "currency", "expectedCloseDate"] },
  policy: { maxPageSize: 2, maxAgeSeconds: 3600, writesAllowed: false, adminAllowed: false, unknownFieldsAllowed: false },
} as const;
const sha = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
const exact = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const keys = (v: unknown, expected: readonly string[]): v is Record<string, unknown> => record(v) && exact(Object.keys(v).sort(), [...expected].sort());
const id = (v: unknown) => typeof v === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(v);
const digest = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const timestamp = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(v) && !Number.isNaN(Date.parse(v));

export function crmReadConnectorContractDigestV1(value: Omit<CrmReadConnectorContractV1, "contractDigest"> | CrmReadConnectorContractV1): string {
  const content = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "contractDigest")); return sha(content);
}
export function verifyCrmReadConnectorContractV1(value: unknown): value is CrmReadConnectorContractV1 {
  return keys(value, [...Object.keys(CONTRACT_CONTENT), "contractDigest"]) && digest(value.contractDigest)
    && exact(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "contractDigest")), CONTRACT_CONTENT)
    && value.contractDigest === sha(CONTRACT_CONTENT);
}

function validRecord(entity: CrmEntityV1, value: unknown): value is CrmRecordV1 {
  if (entity === "accounts") return keys(value, CONTRACT_CONTENT.fields.accounts) && id(value.accountId) && typeof value.accountName === "string" && /^[A-Za-z0-9 &-]{1,64}$/.test(value.accountName) && typeof value.industry === "string" && /^[A-Z_]{2,32}$/.test(value.industry);
  return keys(value, CONTRACT_CONTENT.fields.opportunities) && id(value.opportunityId) && id(value.accountId) && typeof value.opportunityName === "string" && /^[A-Za-z0-9 &-]{1,64}$/.test(value.opportunityName) && ["QUALIFY", "PROPOSE", "WON", "LOST"].includes(String(value.stage)) && typeof value.amount === "number" && Number.isSafeInteger(value.amount) && value.amount >= 0 && value.currency === "EUR" && typeof value.expectedCloseDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.expectedCloseDate);
}
function validateSource(value: unknown): CrmReadDenialCodeV1 | null {
  if (!keys(value, ["schemaVersion", "exportId", "tenantId", "generatedAt", "expiresAt", "lineage", "batches"]) || value.schemaVersion !== CRM_READ_SOURCE_SCHEMA_V1 || !id(value.exportId) || !id(value.tenantId) || !timestamp(value.generatedAt) || !timestamp(value.expiresAt) || Date.parse(value.expiresAt as string) <= Date.parse(value.generatedAt as string) || !keys(value.lineage, ["sourceSystem", "sourceDatasetId", "extractionMode", "sourceDigest"]) || value.lineage.sourceSystem !== "SYNTHETIC_CRM" || !id(value.lineage.sourceDatasetId) || value.lineage.extractionMode !== "SUPPORTED_EXPORT" || !digest(value.lineage.sourceDigest) || !Array.isArray(value.batches)) return "SOURCE_MALFORMED";
  const seen = new Set<string>(); let previous = 0;
  for (const batch of value.batches) {
    if (!keys(batch, ["batchId", "entity", "sequence", "complete", "records"]) || !id(batch.batchId) || !["accounts", "opportunities"].includes(String(batch.entity)) || !Number.isInteger(batch.sequence) || (batch.sequence as number) <= previous || seen.has(batch.batchId as string) || typeof batch.complete !== "boolean" || !Array.isArray(batch.records) || !batch.records.every((item) => validRecord(batch.entity as CrmEntityV1, item))) return "SOURCE_MALFORMED";
    previous = batch.sequence as number; seen.add(batch.batchId as string); if (!batch.complete) return "SOURCE_PARTIAL";
  }
  const content = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "lineage"));
  const lineageContent = Object.fromEntries(Object.entries(value.lineage).filter(([key]) => key !== "sourceDigest"));
  if (value.lineage.sourceDigest !== sha({ ...content, lineage: lineageContent })) return "SOURCE_MALFORMED";
  return null;
}

export function createCrmReadAdapterV1({ contract, source, enabled, now }: { contract: unknown; source: unknown; enabled: boolean; now: string }) {
  const consumed = new Set<string>();
  return (request: unknown): CrmReadResultV1 => {
    if (!enabled) return { outcome: "DENIED", code: "CONNECTOR_DISABLED" };
    if (!verifyCrmReadConnectorContractV1(contract) || !timestamp(now) || !record(request)) return { outcome: "DENIED", code: "REQUEST_MALFORMED" };
    if (Object.keys(request).some((key) => !["operation", "tenantId", "principalId", "scopes", "credentialPresent", "fields", "pageSize", "cursor"].includes(key))) return { outcome: "DENIED", code: "MUTATION_DENIED" };
    if (!request.credentialPresent) return { outcome: "DENIED", code: "CREDENTIAL_MISSING" };
    if (![...contract.operations].includes(request.operation as never)) return { outcome: "DENIED", code: /CREATE|WRITE|UPDATE|DELETE|ADMIN|MUTAT/i.test(String(request.operation)) ? "MUTATION_DENIED" : "OPERATION_DENIED" };
    if (request.tenantId !== contract.tenantId) return { outcome: "DENIED", code: "TENANT_MISMATCH" };
    if (request.principalId !== contract.identity.principalId || !exact(request.scopes, contract.identity.scopes)) return { outcome: "DENIED", code: "SCOPE_DENIED" };
    const entity: CrmEntityV1 = request.operation === "LIST_ACCOUNTS" ? "accounts" : "opportunities";
    const expectedFields = contract.fields[entity];
    if (!Array.isArray(request.fields) || !exact(request.fields, expectedFields)) return { outcome: "DENIED", code: "FIELD_DENIED" };
    if (!Number.isInteger(request.pageSize) || (request.pageSize as number) < 1 || (request.pageSize as number) > contract.policy.maxPageSize) return { outcome: "DENIED", code: "REQUEST_MALFORMED" };
    const sourceError = validateSource(source); if (sourceError) return { outcome: "DENIED", code: sourceError };
    const typedSource = source as CrmSupportedExportV1;
    if (typedSource.tenantId !== contract.tenantId) return { outcome: "DENIED", code: "TENANT_MISMATCH" };
    if (Date.parse(now) > Date.parse(typedSource.expiresAt) || Date.parse(now) - Date.parse(typedSource.generatedAt) > contract.policy.maxAgeSeconds * 1000) return { outcome: "DENIED", code: "SOURCE_STALE" };
    let offset = 0;
    if (request.cursor !== undefined) {
      if (typeof request.cursor !== "string") return { outcome: "DENIED", code: "REQUEST_MALFORMED" };
      if (consumed.has(request.cursor)) return { outcome: "DENIED", code: "CURSOR_REPLAYED" };
      const match = /^crm1:([a-f0-9]{16}):(accounts|opportunities):(\d+)$/.exec(request.cursor);
      if (!match || match[1] !== typedSource.lineage.sourceDigest.slice(0, 16) || match[2] !== entity) return { outcome: "DENIED", code: "CURSOR_STALE" };
      offset = Number(match[3]); consumed.add(request.cursor);
    }
    const batches = typedSource.batches.filter((batch) => batch.entity === entity); const all = batches.flatMap((batch) => batch.records); const page = all.slice(offset, offset + (request.pageSize as number)); const next = offset + page.length;
    const nextCursor = next < all.length ? `crm1:${typedSource.lineage.sourceDigest.slice(0, 16)}:${entity}:${next}` : null;
    const metadata = { tenantId: typedSource.tenantId, trust: "LOCAL_SYNTHETIC" as const, exportId: typedSource.exportId, generatedAt: typedSource.generatedAt, expiresAt: typedSource.expiresAt, sourceDatasetId: typedSource.lineage.sourceDatasetId, sourceDigest: typedSource.lineage.sourceDigest, batchIds: batches.map((batch) => batch.batchId), recordCount: page.length, pageSize: request.pageSize as number, nextCursor };
    return { outcome: "READ", entity, records: structuredClone(page), metadata, readbackDigest: sha({ entity, records: page, metadata }) };
  };
}
