import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import {
  verifyAzureIdentityProfileV1,
  type AzureIdentityProfileV1,
} from "./azure-identity-profile.js";
import { VERIFICATION_FABRIC_BUNDLE_SCHEMA_V1 } from "./verification-fabric.js";

export const POWER_PLATFORM_READ_CONNECTOR_SCHEMA_V1 = "chimpmaera.connector/power-platform-read/v1" as const;
export const POWER_PLATFORM_READ_CONNECTOR_VERSION_V1 = "1.0.0" as const;

export type PowerPlatformReadConnectorReasonCodeV1 =
  | "POWER_PLATFORM_READ_CONNECTOR_VERIFIED"
  | "POWER_PLATFORM_CONNECTOR_SCHEMA_DENIED"
  | "POWER_PLATFORM_CONNECTOR_COMPATIBILITY_DENIED"
  | "POWER_PLATFORM_CONNECTOR_OPENAPI_DENIED"
  | "POWER_PLATFORM_CONNECTOR_IDENTITY_DENIED"
  | "POWER_PLATFORM_CONNECTOR_OPERATION_DENIED"
  | "POWER_PLATFORM_CONNECTOR_AUTHORITY_DENIED"
  | "POWER_PLATFORM_CONNECTOR_LIFECYCLE_DENIED"
  | "POWER_PLATFORM_CONNECTOR_CREDENTIAL_DENIED"
  | "POWER_PLATFORM_CONNECTOR_DIGEST_DENIED";

export interface PowerPlatformReadOperationV1 {
  readonly operationKey: "LIST_CAPABILITIES" | "SUBMIT_GOVERNED_QUERY" | "GET_OPERATION_STATUS" | "GET_READBACK" | "GET_RECEIPT";
  readonly operationId: "ListCapabilities" | "SubmitGovernedQuery" | "GetOperationStatus" | "GetReadback" | "GetReceipt";
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly semantic: "DISCOVERY" | "LOGICAL_READ" | "STATUS" | "AUTHORITATIVE_READBACK" | "BOUND_RECEIPT";
  readonly delegatedScope: "cm.discovery.read" | "cm.operator.read";
  readonly idempotencyKeyRequired: boolean;
}

export interface PowerPlatformReadConnectorV1 {
  readonly schemaVersion: typeof POWER_PLATFORM_READ_CONNECTOR_SCHEMA_V1;
  readonly connectorId: string;
  readonly contractVersion: typeof POWER_PLATFORM_READ_CONNECTOR_VERSION_V1;
  readonly platform: "MICROSOFT_POWER_PLATFORM_CUSTOM_CONNECTOR";
  readonly evidenceClass: "LOCAL_SYNTHETIC";
  readonly openApi: {
    readonly version: "2.0";
    readonly basePath: "/v1";
    readonly schemes: readonly ["https"];
    readonly arbitraryServerSelectionAllowed: false;
  };
  readonly identityBinding: {
    readonly profileId: string;
    readonly profileDigest: string;
    readonly delegatedScopes: readonly ["cm.discovery.read", "cm.operator.read"];
    readonly applicationRoles: readonly [];
  };
  readonly verificationBinding: {
    readonly bundleSchemaVersion: typeof VERIFICATION_FABRIC_BUNDLE_SCHEMA_V1;
    readonly requiredTuple: readonly ["subjectDigest", "planDigest", "evidenceBundleDigest", "verdictDigest", "readbackDigest"];
  };
  readonly operations: readonly PowerPlatformReadOperationV1[];
  readonly authorityBoundary: {
    readonly genericInvocationAllowed: false;
    readonly arbitraryUrlAllowed: false;
    readonly arbitraryHttpMethodAllowed: false;
    readonly arbitraryCommandAllowed: false;
    readonly arbitraryBodySchemaAllowed: false;
    readonly callerTenantAllowed: false;
    readonly callerCredentialAllowed: false;
    readonly unknownOperationsDenied: true;
    readonly requestedRights: readonly [];
    readonly writeTargets: readonly [];
    readonly proposalOperations: readonly [];
    readonly approvalOperations: readonly [];
    readonly executionOperations: readonly [];
    readonly cancellationOperations: readonly [];
  };
  readonly lifecycle: {
    readonly acceptanceSemantics: "OPERATION_REFERENCE_ONLY";
    readonly businessSuccessRequires: "AUTHORITATIVE_READBACK_AND_BOUND_RECEIPT";
    readonly terminalCommittedIsBusinessSuccess: false;
    readonly authoritativeReadbackRequired: true;
    readonly boundReceiptRequired: true;
  };
  readonly credentials: {
    readonly storedByConnector: false;
    readonly embeddedAllowed: false;
    readonly ambientAllowed: false;
    readonly dynamicSelectionAllowed: false;
    readonly secretReferences: readonly [];
  };
  readonly contractDigest: string;
}

export type PowerPlatformReadConnectorVerificationV1 =
  | {
    readonly outcome: "VERIFIED";
    readonly reasonCodes: readonly ["POWER_PLATFORM_READ_CONNECTOR_VERIFIED"];
    readonly contractDigest: string;
    readonly operationCount: 5;
    readonly writeOperationCount: 0;
    readonly requestedRightsCount: 0;
    readonly writeTargetCount: 0;
  }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly PowerPlatformReadConnectorReasonCodeV1[] };

const EXPECTED_OPERATIONS: readonly PowerPlatformReadOperationV1[] = [
  {
    operationKey: "LIST_CAPABILITIES", operationId: "ListCapabilities", method: "GET",
    path: "/v1/capabilities", semantic: "DISCOVERY", delegatedScope: "cm.discovery.read",
    idempotencyKeyRequired: false,
  },
  {
    operationKey: "SUBMIT_GOVERNED_QUERY", operationId: "SubmitGovernedQuery", method: "POST",
    path: "/v1/queries", semantic: "LOGICAL_READ", delegatedScope: "cm.operator.read",
    idempotencyKeyRequired: true,
  },
  {
    operationKey: "GET_OPERATION_STATUS", operationId: "GetOperationStatus", method: "GET",
    path: "/v1/operations/{operationId}", semantic: "STATUS", delegatedScope: "cm.operator.read",
    idempotencyKeyRequired: false,
  },
  {
    operationKey: "GET_READBACK", operationId: "GetReadback", method: "GET",
    path: "/v1/operations/{operationId}/readback", semantic: "AUTHORITATIVE_READBACK",
    delegatedScope: "cm.operator.read", idempotencyKeyRequired: false,
  },
  {
    operationKey: "GET_RECEIPT", operationId: "GetReceipt", method: "GET",
    path: "/v1/operations/{operationId}/receipt", semantic: "BOUND_RECEIPT",
    delegatedScope: "cm.operator.read", idempotencyKeyRequired: false,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function exact(value: unknown, expected: unknown): boolean {
  return canonicalJson(value) === canonicalJson(expected);
}

function denied(reason: PowerPlatformReadConnectorReasonCodeV1): PowerPlatformReadConnectorVerificationV1 {
  return { outcome: "DENIED", reasonCodes: [reason] };
}

export function powerPlatformReadConnectorDigestV1(contract: PowerPlatformReadConnectorV1): string {
  if (!isRecord(contract)) throw new TypeError("INVALID_POWER_PLATFORM_READ_CONNECTOR");
  const content = Object.fromEntries(Object.entries(contract).filter(([key]) => key !== "contractDigest"));
  return createHash("sha256").update(canonicalJson(content), "utf8").digest("hex");
}

export function verifyPowerPlatformReadConnectorV1(
  value: unknown,
  identityProfile: AzureIdentityProfileV1,
): PowerPlatformReadConnectorVerificationV1 {
  if (!exactKeys(value, [
    "schemaVersion", "connectorId", "contractVersion", "platform", "evidenceClass", "openApi",
    "identityBinding", "verificationBinding", "operations", "authorityBoundary", "lifecycle",
    "credentials", "contractDigest",
  ]) || value.schemaVersion !== POWER_PLATFORM_READ_CONNECTOR_SCHEMA_V1 || !isId(value.connectorId)
    || !isDigest(value.contractDigest)) return denied("POWER_PLATFORM_CONNECTOR_SCHEMA_DENIED");
  if (value.contractVersion !== POWER_PLATFORM_READ_CONNECTOR_VERSION_V1
    || value.platform !== "MICROSOFT_POWER_PLATFORM_CUSTOM_CONNECTOR"
    || value.evidenceClass !== "LOCAL_SYNTHETIC") return denied("POWER_PLATFORM_CONNECTOR_COMPATIBILITY_DENIED");
  if (!exact(value.openApi, {
    version: "2.0", basePath: "/v1", schemes: ["https"], arbitraryServerSelectionAllowed: false,
  })) return denied("POWER_PLATFORM_CONNECTOR_OPENAPI_DENIED");
  const identityResult = verifyAzureIdentityProfileV1(identityProfile);
  if (!exactKeys(value.identityBinding, ["profileId", "profileDigest", "delegatedScopes", "applicationRoles"])
    || identityResult.outcome !== "VERIFIED" || value.identityBinding.profileId !== identityProfile.profileId
    || value.identityBinding.profileDigest !== identityProfile.profileDigest
    || !exact(value.identityBinding.delegatedScopes, ["cm.discovery.read", "cm.operator.read"])
    || !exact(value.identityBinding.delegatedScopes, identityProfile.apiPermissions.delegatedScopes)
    || !exact(value.identityBinding.applicationRoles, [])) return denied("POWER_PLATFORM_CONNECTOR_IDENTITY_DENIED");
  if (!exact(value.operations, EXPECTED_OPERATIONS)) return denied("POWER_PLATFORM_CONNECTOR_OPERATION_DENIED");
  if (!exact(value.authorityBoundary, {
    genericInvocationAllowed: false,
    arbitraryUrlAllowed: false,
    arbitraryHttpMethodAllowed: false,
    arbitraryCommandAllowed: false,
    arbitraryBodySchemaAllowed: false,
    callerTenantAllowed: false,
    callerCredentialAllowed: false,
    unknownOperationsDenied: true,
    requestedRights: [],
    writeTargets: [],
    proposalOperations: [],
    approvalOperations: [],
    executionOperations: [],
    cancellationOperations: [],
  })) return denied("POWER_PLATFORM_CONNECTOR_AUTHORITY_DENIED");
  if (!exact(value.verificationBinding, {
    bundleSchemaVersion: VERIFICATION_FABRIC_BUNDLE_SCHEMA_V1,
    requiredTuple: ["subjectDigest", "planDigest", "evidenceBundleDigest", "verdictDigest", "readbackDigest"],
  }) || !exact(value.lifecycle, {
    acceptanceSemantics: "OPERATION_REFERENCE_ONLY",
    businessSuccessRequires: "AUTHORITATIVE_READBACK_AND_BOUND_RECEIPT",
    terminalCommittedIsBusinessSuccess: false,
    authoritativeReadbackRequired: true,
    boundReceiptRequired: true,
  })) return denied("POWER_PLATFORM_CONNECTOR_LIFECYCLE_DENIED");
  if (!exact(value.credentials, {
    storedByConnector: false,
    embeddedAllowed: false,
    ambientAllowed: false,
    dynamicSelectionAllowed: false,
    secretReferences: [],
  })) return denied("POWER_PLATFORM_CONNECTOR_CREDENTIAL_DENIED");
  const contract = value as unknown as PowerPlatformReadConnectorV1;
  if (powerPlatformReadConnectorDigestV1(contract) !== contract.contractDigest) {
    return denied("POWER_PLATFORM_CONNECTOR_DIGEST_DENIED");
  }
  return {
    outcome: "VERIFIED",
    reasonCodes: ["POWER_PLATFORM_READ_CONNECTOR_VERIFIED"],
    contractDigest: contract.contractDigest,
    operationCount: 5,
    writeOperationCount: 0,
    requestedRightsCount: 0,
    writeTargetCount: 0,
  };
}
