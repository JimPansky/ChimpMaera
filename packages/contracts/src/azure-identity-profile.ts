import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const AZURE_IDENTITY_PROFILE_SCHEMA_V1 = "chimpmaera.identity/azure-profile/v1" as const;
export const AZURE_IDENTITY_CONTRACT_VERSION_V1 = "1.0.0" as const;

export type AzureIdentityProfileReasonCodeV1 =
  | "AZURE_IDENTITY_PROFILE_VERIFIED"
  | "AZURE_IDENTITY_SCHEMA_DENIED"
  | "AZURE_IDENTITY_COMPATIBILITY_DENIED"
  | "AZURE_IDENTITY_FLOW_DENIED"
  | "AZURE_IDENTITY_TENANT_DENIED"
  | "AZURE_IDENTITY_TOKEN_VALIDATION_DENIED"
  | "AZURE_IDENTITY_SCOPE_DENIED"
  | "AZURE_IDENTITY_AUTHORITY_DENIED"
  | "AZURE_IDENTITY_CREDENTIAL_DENIED"
  | "AZURE_IDENTITY_DIGEST_DENIED";

export interface AzureIdentityProfileV1 {
  readonly schemaVersion: typeof AZURE_IDENTITY_PROFILE_SCHEMA_V1;
  readonly profileId: string;
  readonly contractVersion: typeof AZURE_IDENTITY_CONTRACT_VERSION_V1;
  readonly provider: "MICROSOFT_ENTRA_ID";
  readonly evidenceClass: "LOCAL_SYNTHETIC";
  readonly flow: {
    readonly kind: "OIDC_AUTHORIZATION_CODE_PKCE_S256";
    readonly redirectBinding: "REGISTERED_EXACT";
    readonly stateRequired: true;
    readonly nonceRequired: true;
  };
  readonly tenantBoundary: {
    readonly mode: "SINGLE_TENANT";
    readonly tenantSource: "VERIFIED_TOKEN";
    readonly requestTenantAccepted: false;
    readonly crossTenantAllowed: false;
    readonly issuerTemplate: "https://login.microsoftonline.com/{tenant}/v2.0";
    readonly blockedAuthorities: readonly ["common", "consumers", "organizations"];
  };
  readonly tokenValidation: {
    readonly audience: "api://chimpmaera.synthetic/read";
    readonly signatureAlgorithms: readonly ["RS256"];
    readonly requiredClaims: readonly ["iss", "aud", "tid", "sub", "exp", "nbf", "iat", "scp"];
    readonly maximumClockSkewSeconds: number;
    readonly tokenUse: "API_ENTRY_AUTHENTICATION_ONLY";
    readonly providerTokenForwarding: false;
  };
  readonly apiPermissions: {
    readonly mode: "DELEGATED";
    readonly delegatedScopes: readonly ["cm.discovery.read"];
    readonly applicationRoles: readonly [];
    readonly broadPermissionNamesRejected: true;
  };
  readonly capabilityBoundary: {
    readonly authenticationGrantsAuthority: false;
    readonly requestedRights: readonly [];
    readonly routeIds: readonly [];
    readonly writeTargets: readonly [];
    readonly approvalDecisionAllowed: false;
    readonly executionAllowed: false;
  };
  readonly credentials: {
    readonly ambientAllowed: false;
    readonly embeddedAllowed: false;
    readonly dynamicSelectionAllowed: false;
    readonly secretReferences: readonly [];
  };
  readonly profileDigest: string;
}

export type AzureIdentityProfileVerificationV1 =
  | {
    readonly outcome: "VERIFIED";
    readonly reasonCodes: readonly ["AZURE_IDENTITY_PROFILE_VERIFIED"];
    readonly profileDigest: string;
    readonly delegatedScopeCount: number;
    readonly requestedRightsCount: 0;
    readonly routeCount: 0;
    readonly writeTargetCount: 0;
  }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly AzureIdentityProfileReasonCodeV1[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
}

function exactStringArray(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value) && canonicalJson(value) === canonicalJson(expected);
}

function denied(reason: AzureIdentityProfileReasonCodeV1): AzureIdentityProfileVerificationV1 {
  return { outcome: "DENIED", reasonCodes: [reason] };
}

export function azureIdentityProfileDigestV1(profile: AzureIdentityProfileV1): string {
  if (!isRecord(profile)) throw new TypeError("INVALID_AZURE_IDENTITY_PROFILE");
  const content = Object.fromEntries(Object.entries(profile).filter(([key]) => key !== "profileDigest"));
  return createHash("sha256").update(canonicalJson(content), "utf8").digest("hex");
}

export function verifyAzureIdentityProfileV1(value: unknown): AzureIdentityProfileVerificationV1 {
  if (!exactKeys(value, [
    "schemaVersion", "profileId", "contractVersion", "provider", "evidenceClass", "flow",
    "tenantBoundary", "tokenValidation", "apiPermissions", "capabilityBoundary", "credentials",
    "profileDigest",
  ])) return denied("AZURE_IDENTITY_SCHEMA_DENIED");
  if (value.schemaVersion !== AZURE_IDENTITY_PROFILE_SCHEMA_V1 || !isId(value.profileId)
    || !isDigest(value.profileDigest)) return denied("AZURE_IDENTITY_SCHEMA_DENIED");
  if (value.contractVersion !== AZURE_IDENTITY_CONTRACT_VERSION_V1
    || value.provider !== "MICROSOFT_ENTRA_ID" || value.evidenceClass !== "LOCAL_SYNTHETIC") {
    return denied("AZURE_IDENTITY_COMPATIBILITY_DENIED");
  }
  if (!exactKeys(value.flow, ["kind", "redirectBinding", "stateRequired", "nonceRequired"])
    || value.flow.kind !== "OIDC_AUTHORIZATION_CODE_PKCE_S256"
    || value.flow.redirectBinding !== "REGISTERED_EXACT"
    || value.flow.stateRequired !== true || value.flow.nonceRequired !== true) {
    return denied("AZURE_IDENTITY_FLOW_DENIED");
  }
  if (!exactKeys(value.tenantBoundary, [
    "mode", "tenantSource", "requestTenantAccepted", "crossTenantAllowed", "issuerTemplate",
    "blockedAuthorities",
  ]) || value.tenantBoundary.mode !== "SINGLE_TENANT"
    || value.tenantBoundary.tenantSource !== "VERIFIED_TOKEN"
    || value.tenantBoundary.requestTenantAccepted !== false
    || value.tenantBoundary.crossTenantAllowed !== false
    || value.tenantBoundary.issuerTemplate !== "https://login.microsoftonline.com/{tenant}/v2.0"
    || !exactStringArray(value.tenantBoundary.blockedAuthorities, ["common", "consumers", "organizations"])) {
    return denied("AZURE_IDENTITY_TENANT_DENIED");
  }
  if (!exactKeys(value.tokenValidation, [
    "audience", "signatureAlgorithms", "requiredClaims", "maximumClockSkewSeconds", "tokenUse",
    "providerTokenForwarding",
  ]) || value.tokenValidation.audience !== "api://chimpmaera.synthetic/read"
    || !exactStringArray(value.tokenValidation.signatureAlgorithms, ["RS256"])
    || !exactStringArray(value.tokenValidation.requiredClaims, ["iss", "aud", "tid", "sub", "exp", "nbf", "iat", "scp"])
    || !Number.isSafeInteger(value.tokenValidation.maximumClockSkewSeconds)
    || (value.tokenValidation.maximumClockSkewSeconds as number) < 0
    || (value.tokenValidation.maximumClockSkewSeconds as number) > 300
    || value.tokenValidation.tokenUse !== "API_ENTRY_AUTHENTICATION_ONLY"
    || value.tokenValidation.providerTokenForwarding !== false) {
    return denied("AZURE_IDENTITY_TOKEN_VALIDATION_DENIED");
  }
  if (!exactKeys(value.apiPermissions, [
    "mode", "delegatedScopes", "applicationRoles", "broadPermissionNamesRejected",
  ]) || value.apiPermissions.mode !== "DELEGATED"
    || !exactStringArray(value.apiPermissions.delegatedScopes, ["cm.discovery.read"])
    || !Array.isArray(value.apiPermissions.applicationRoles) || value.apiPermissions.applicationRoles.length !== 0
    || value.apiPermissions.broadPermissionNamesRejected !== true) {
    return denied("AZURE_IDENTITY_SCOPE_DENIED");
  }
  if (!exactKeys(value.capabilityBoundary, [
    "authenticationGrantsAuthority", "requestedRights", "routeIds", "writeTargets",
    "approvalDecisionAllowed", "executionAllowed",
  ]) || value.capabilityBoundary.authenticationGrantsAuthority !== false
    || value.capabilityBoundary.approvalDecisionAllowed !== false
    || value.capabilityBoundary.executionAllowed !== false
    || ![value.capabilityBoundary.requestedRights, value.capabilityBoundary.routeIds,
      value.capabilityBoundary.writeTargets].every((items) => Array.isArray(items) && items.length === 0)) {
    return denied("AZURE_IDENTITY_AUTHORITY_DENIED");
  }
  if (!exactKeys(value.credentials, [
    "ambientAllowed", "embeddedAllowed", "dynamicSelectionAllowed", "secretReferences",
  ]) || value.credentials.ambientAllowed !== false || value.credentials.embeddedAllowed !== false
    || value.credentials.dynamicSelectionAllowed !== false || !Array.isArray(value.credentials.secretReferences)
    || value.credentials.secretReferences.length !== 0) {
    return denied("AZURE_IDENTITY_CREDENTIAL_DENIED");
  }
  const profile = value as unknown as AzureIdentityProfileV1;
  if (azureIdentityProfileDigestV1(profile) !== profile.profileDigest) return denied("AZURE_IDENTITY_DIGEST_DENIED");
  return {
    outcome: "VERIFIED",
    reasonCodes: ["AZURE_IDENTITY_PROFILE_VERIFIED"],
    profileDigest: profile.profileDigest,
    delegatedScopeCount: profile.apiPermissions.delegatedScopes.length,
    requestedRightsCount: 0,
    routeCount: 0,
    writeTargetCount: 0,
  };
}
