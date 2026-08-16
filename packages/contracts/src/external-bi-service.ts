import { createHash } from "node:crypto";

import { canonicalJson } from "./canonical-json.js";

export const EXTERNAL_BI_SERVICE_CONFIG_SCHEMA_V2 =
  "chimpmaera.external-bi-service/config/v2" as const;
export const EXTERNAL_BI_SERVICE_READBACK_SCHEMA_V2 =
  "chimpmaera.external-bi-service/readback/v2" as const;
export const EXTERNAL_BI_SERVICE_PRODUCT_VERSION_V2 = "v0.8.0" as const;
export const EXTERNAL_BI_SERVICE_CONTRACT_ID_V2 =
  "superset-bi-agent.external" as const;
export const EXTERNAL_BI_SERVICE_CONTRACT_VERSION_V2 = "2.0.0" as const;
export const EXTERNAL_BI_SERVICE_ATTESTATION_SCHEMA_V2 =
  "superset-bi-agent.external/capability-attestation/v2" as const;
export const EXTERNAL_BI_SERVICE_REQUEST_SCHEMA_V2 =
  "superset-bi-agent.external/intent-request/v2" as const;
export const EXTERNAL_BI_SERVICE_RESULT_SCHEMA_V2 =
  "superset-bi-agent.external/intent-result/v2" as const;

export const EXTERNAL_BI_SERVICE_CAPABILITIES_V2 = [
  "bi.status.read",
  "bi.discovery.run",
  "bi.analysis.run",
  "bi.graph.adaptive-v1.plan",
  "bi.preview.create",
  "bi.readback.read",
] as const;

export const EXTERNAL_BI_SERVICE_ACTIONS_V2 = [
  "status",
  "discovery",
  "analyze",
  "plan",
  "preview",
  "readback",
] as const;

const CAPABILITY_ATTESTATION_V2 = {
  "bi.status.read": { action: "status", authority: "read-only" },
  "bi.discovery.run": { action: "discovery", authority: "local-evidence-write" },
  "bi.analysis.run": { action: "analyze", authority: "source-read-only" },
  "bi.graph.adaptive-v1.plan": { action: "plan", authority: "proposal-only" },
  "bi.preview.create": { action: "preview", authority: "proposal-only" },
  "bi.readback.read": { action: "readback", authority: "read-only" },
} as const;

const ENV_KEYS = [
  "BI_AGENT_BASE_URL",
  "BI_AGENT_EXPECTED_PRODUCT_VERSION",
  "BI_AGENT_EXPECTED_CONTRACT_VERSION",
  "BI_AGENT_TIMEOUT_MS",
  "SUPERSET_BASE_URL",
] as const;

export type ExternalBiServiceReasonCodeV2 =
  | "EXTERNAL_BI_SERVICE_DISABLED"
  | "EXTERNAL_BI_SERVICE_NOT_CONFIGURED"
  | "EXTERNAL_BI_SERVICE_CONFIG_VERIFIED"
  | "EXTERNAL_BI_SERVICE_DIRECT_SUPERSET_CONFIG_DENIED"
  | "EXTERNAL_BI_SERVICE_URL_DENIED"
  | "EXTERNAL_BI_SERVICE_TIMEOUT_DENIED"
  | "EXTERNAL_BI_SERVICE_PRODUCT_VERSION_DENIED"
  | "EXTERNAL_BI_SERVICE_CONTRACT_VERSION_DENIED"
  | "EXTERNAL_BI_SERVICE_ATTESTATION_MALFORMED"
  | "EXTERNAL_BI_SERVICE_DIGEST_DENIED"
  | "EXTERNAL_BI_SERVICE_CAPABILITY_MISSING"
  | "EXTERNAL_BI_SERVICE_REQUEST_DENIED"
  | "EXTERNAL_BI_SERVICE_ACTION_DENIED"
  | "EXTERNAL_BI_SERVICE_UNSAFE_REQUEST_DENIED"
  | "EXTERNAL_BI_SERVICE_RESPONSE_MALFORMED"
  | "EXTERNAL_BI_SERVICE_STATUS_MALFORMED"
  | "EXTERNAL_BI_SERVICE_UNAVAILABLE";

export interface ExternalBiServiceConfigV2 {
  readonly schemaVersion: typeof EXTERNAL_BI_SERVICE_CONFIG_SCHEMA_V2;
  readonly enabled: boolean;
  readonly biAgentBaseUrl: string | null;
  readonly expectedProductVersion: typeof EXTERNAL_BI_SERVICE_PRODUCT_VERSION_V2;
  readonly expectedContractVersion: typeof EXTERNAL_BI_SERVICE_CONTRACT_VERSION_V2;
  readonly timeoutMs: number;
  readonly requiredCapabilities: readonly typeof EXTERNAL_BI_SERVICE_CAPABILITIES_V2[number][];
}

export type ExternalBiServiceConfigDecisionV2 =
  | { readonly outcome: "VERIFIED"; readonly reasonCodes: readonly ["EXTERNAL_BI_SERVICE_CONFIG_VERIFIED"]; readonly config: ExternalBiServiceConfigV2 }
  | { readonly outcome: "DISABLED"; readonly reasonCodes: readonly ("EXTERNAL_BI_SERVICE_DISABLED" | "EXTERNAL_BI_SERVICE_NOT_CONFIGURED")[]; readonly config: ExternalBiServiceConfigV2 }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly ExternalBiServiceReasonCodeV2[] };

export interface ExternalBiServiceReadbackV2 {
  readonly schemaVersion: typeof EXTERNAL_BI_SERVICE_READBACK_SCHEMA_V2;
  readonly outcome: "READY";
  readonly productVersion: typeof EXTERNAL_BI_SERVICE_PRODUCT_VERSION_V2;
  readonly contractVersion: typeof EXTERNAL_BI_SERVICE_CONTRACT_VERSION_V2;
  readonly capabilities: readonly typeof EXTERNAL_BI_SERVICE_CAPABILITIES_V2[number][];
  readonly acceptedGraphIncumbent: "adaptive-v1";
  readonly attestationDigest: string;
  readonly statusResponseDigest: string;
  readonly directSupersetAccessByCm: false;
}

export type ExternalBiServiceProbeResultV2 =
  | { readonly outcome: "VERIFIED"; readonly reasonCodes: readonly ["EXTERNAL_BI_SERVICE_CONFIG_VERIFIED"]; readonly readback: ExternalBiServiceReadbackV2 }
  | { readonly outcome: "DISABLED"; readonly reasonCodes: readonly ("EXTERNAL_BI_SERVICE_DISABLED" | "EXTERNAL_BI_SERVICE_NOT_CONFIGURED")[] }
  | { readonly outcome: "DENIED" | "UNAVAILABLE"; readonly reasonCodes: readonly ExternalBiServiceReasonCodeV2[] };

export type ExternalBiServiceActionV2 = typeof EXTERNAL_BI_SERVICE_ACTIONS_V2[number];

export interface ExternalBiServiceIntentRequestV2 {
  readonly requestId: string;
  readonly action: ExternalBiServiceActionV2;
  readonly input?: Readonly<Record<string, unknown>>;
}

export interface ExternalBiServiceIntentReadbackV2 {
  readonly action: ExternalBiServiceActionV2;
  readonly requestId: string;
  readonly attestationDigest: string;
  readonly responseDigest: string;
  readonly result: Readonly<Record<string, unknown>>;
}

export type ExternalBiServiceIntentResultV2 =
  | { readonly outcome: "VERIFIED"; readonly reasonCodes: readonly ["EXTERNAL_BI_SERVICE_CONFIG_VERIFIED"]; readonly readback: ExternalBiServiceIntentReadbackV2 }
  | { readonly outcome: "DISABLED"; readonly reasonCodes: readonly ("EXTERNAL_BI_SERVICE_DISABLED" | "EXTERNAL_BI_SERVICE_NOT_CONFIGURED")[] }
  | { readonly outcome: "DENIED" | "UNAVAILABLE"; readonly reasonCodes: readonly ExternalBiServiceReasonCodeV2[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function disabled(reasonCodes: readonly ("EXTERNAL_BI_SERVICE_DISABLED" | "EXTERNAL_BI_SERVICE_NOT_CONFIGURED")[]): ExternalBiServiceConfigDecisionV2 {
  return {
    outcome: "DISABLED",
    reasonCodes,
    config: {
      schemaVersion: EXTERNAL_BI_SERVICE_CONFIG_SCHEMA_V2,
      enabled: false,
      biAgentBaseUrl: null,
      expectedProductVersion: EXTERNAL_BI_SERVICE_PRODUCT_VERSION_V2,
      expectedContractVersion: EXTERNAL_BI_SERVICE_CONTRACT_VERSION_V2,
      timeoutMs: 5000,
      requiredCapabilities: EXTERNAL_BI_SERVICE_CAPABILITIES_V2,
    },
  };
}

function sanitizeBaseUrl(input: string): string | null {
  if (input.length > 2048 || /[\u0000-\u001f\s]/.test(input) || /%40/i.test(input)) return null;
  let parsed: URL;
  try { parsed = new URL(input); } catch { return null; }
  if (!["http:", "https:"].includes(parsed.protocol)) return null;
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  if (parsed.pathname !== "/" && parsed.pathname !== "") return null;
  const host = parsed.hostname.toLowerCase();
  if (!host || ["0.0.0.0", "169.254.169.254", "[::]", "::"].includes(host)) return null;
  parsed.pathname = "/";
  return parsed.toString().replace(/\/$/, "");
}

function parseTimeout(value: string | undefined): number | null {
  if (value === undefined || value === "") return 5000;
  if (!/^[0-9]{2,6}$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= 100 && parsed <= 30000 ? parsed : null;
}

export function configureExternalBiServiceV2(
  env: Partial<Record<typeof ENV_KEYS[number], string | undefined>>,
): ExternalBiServiceConfigDecisionV2 {
  const hasAny = ENV_KEYS.some((key) => env[key] !== undefined && env[key] !== "");
  if (!hasAny) return disabled(["EXTERNAL_BI_SERVICE_NOT_CONFIGURED"]);
  if (env.SUPERSET_BASE_URL) {
    return { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_DIRECT_SUPERSET_CONFIG_DENIED"] };
  }
  const biAgentBaseUrl = env.BI_AGENT_BASE_URL ? sanitizeBaseUrl(env.BI_AGENT_BASE_URL) : null;
  if (!biAgentBaseUrl) return { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_URL_DENIED"] };
  const timeoutMs = parseTimeout(env.BI_AGENT_TIMEOUT_MS);
  if (timeoutMs === null) return { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_TIMEOUT_DENIED"] };
  if (env.BI_AGENT_EXPECTED_PRODUCT_VERSION && env.BI_AGENT_EXPECTED_PRODUCT_VERSION !== EXTERNAL_BI_SERVICE_PRODUCT_VERSION_V2) {
    return { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_PRODUCT_VERSION_DENIED"] };
  }
  if (env.BI_AGENT_EXPECTED_CONTRACT_VERSION && env.BI_AGENT_EXPECTED_CONTRACT_VERSION !== EXTERNAL_BI_SERVICE_CONTRACT_VERSION_V2) {
    return { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_CONTRACT_VERSION_DENIED"] };
  }
  return {
    outcome: "VERIFIED",
    reasonCodes: ["EXTERNAL_BI_SERVICE_CONFIG_VERIFIED"],
    config: {
      schemaVersion: EXTERNAL_BI_SERVICE_CONFIG_SCHEMA_V2,
      enabled: true,
      biAgentBaseUrl,
      expectedProductVersion: EXTERNAL_BI_SERVICE_PRODUCT_VERSION_V2,
      expectedContractVersion: EXTERNAL_BI_SERVICE_CONTRACT_VERSION_V2,
      timeoutMs,
      requiredCapabilities: EXTERNAL_BI_SERVICE_CAPABILITIES_V2,
    },
  };
}

function endpoint(baseUrl: string, pathname: string): string {
  const parsed = new URL(baseUrl);
  parsed.pathname = pathname;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

async function responseJson(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return null; }
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

function bodyWithout(value: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([entry]) => entry !== key));
}

function validateAttestation(value: unknown, config: ExternalBiServiceConfigV2): ExternalBiServiceReasonCodeV2 | null {
  if (!isRecord(value) || value.schemaVersion !== EXTERNAL_BI_SERVICE_ATTESTATION_SCHEMA_V2) return "EXTERNAL_BI_SERVICE_ATTESTATION_MALFORMED";
  const product = isRecord(value.product) ? value.product : null;
  const contract = isRecord(value.contract) ? value.contract : null;
  if (!product || product.id !== "superset-bi-agent" || product.version !== config.expectedProductVersion) return "EXTERNAL_BI_SERVICE_PRODUCT_VERSION_DENIED";
  if (!contract || contract.id !== EXTERNAL_BI_SERVICE_CONTRACT_ID_V2 || contract.version !== config.expectedContractVersion) return "EXTERNAL_BI_SERVICE_CONTRACT_VERSION_DENIED";
  const proof = isRecord(value.attestation) ? value.attestation : null;
  if (!proof || proof.algorithm !== "sha256-canonical-json" || typeof proof.digest !== "string") return "EXTERNAL_BI_SERVICE_ATTESTATION_MALFORMED";
  try {
    if (proof.digest !== digest(bodyWithout(value, "attestation"))) return "EXTERNAL_BI_SERVICE_DIGEST_DENIED";
  } catch { return "EXTERNAL_BI_SERVICE_ATTESTATION_MALFORMED"; }
  if (!Array.isArray(value.capabilities)) return "EXTERNAL_BI_SERVICE_ATTESTATION_MALFORMED";
  for (const id of config.requiredCapabilities) {
    const expected = CAPABILITY_ATTESTATION_V2[id];
    const item = value.capabilities.find((candidate) => isRecord(candidate) && candidate.id === id);
    if (!isRecord(item) || item.action !== expected.action || item.authority !== expected.authority || item.externalIntent === false) {
      return "EXTERNAL_BI_SERVICE_CAPABILITY_MISSING";
    }
  }
  const graph = isRecord(value.graph) ? value.graph : null;
  const boundaries = isRecord(value.boundaries) ? value.boundaries : null;
  if (!graph || graph.acceptedIncumbent !== "adaptive-v1" || graph.candidatePromotion !== "none") return "EXTERNAL_BI_SERVICE_CAPABILITY_MISSING";
  if (!boundaries || boundaries.sourceDatabaseCredentialsAccepted !== false || boundaries.freeSqlAccepted !== false
    || boundaries.rawSourceRowsReturned !== false || boundaries.modelMutationAuthority !== false
    || boundaries.directSupersetMutationIntentAccepted !== false
    || boundaries.persistentSupersetWorkflow !== "trusted-preview-approval-apply-readback-rollback-only") {
    return "EXTERNAL_BI_SERVICE_ATTESTATION_MALFORMED";
  }
  return null;
}

const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FORBIDDEN_REQUEST_KEY = /^(?:sql|query|password|passwd|secret|token|credential|credentials|authorization|cookie|raw|rawrows|rows|url|uri|host|port)$/i;
const FORBIDDEN_REQUEST_TEXT = /(?:\b(?:select|insert|update|delete|merge|drop|alter|create|truncate|grant|revoke|exec(?:ute)?|dbcc|backup|restore)\b|\braw\s+sql\b|\bsql\s*lab\b|password|credential|secret|api[_ -]?key|bearer\s+\S+|system\s+prompt|ignore\s+(?:all\s+)?previous)/i;

function unsafeRequestValue(value: unknown): boolean {
  if (typeof value === "string") return FORBIDDEN_REQUEST_TEXT.test(value);
  if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return false;
  if (Array.isArray(value)) return value.some(unsafeRequestValue);
  if (!isRecord(value)) return true;
  return Object.entries(value).some(([key, item]) => FORBIDDEN_REQUEST_KEY.test(key.replace(/[^A-Za-z0-9]/g, "")) || unsafeRequestValue(item));
}

function validateIntentRequest(request: ExternalBiServiceIntentRequestV2): ExternalBiServiceReasonCodeV2 | null {
  if (!isRecord(request) || !REQUEST_ID.test(String(request.requestId ?? ""))) return "EXTERNAL_BI_SERVICE_REQUEST_DENIED";
  if (!EXTERNAL_BI_SERVICE_ACTIONS_V2.includes(request.action as ExternalBiServiceActionV2)) return "EXTERNAL_BI_SERVICE_ACTION_DENIED";
  const keys = Object.keys(request);
  if (keys.some((key) => !["requestId", "action", "input"].includes(key))) return "EXTERNAL_BI_SERVICE_REQUEST_DENIED";
  if (request.input !== undefined && (!isRecord(request.input) || unsafeRequestValue(request.input))) return "EXTERNAL_BI_SERVICE_UNSAFE_REQUEST_DENIED";
  try { canonicalJson(request); } catch { return "EXTERNAL_BI_SERVICE_REQUEST_DENIED"; }
  return null;
}

function validateIntentEnvelope(
  value: unknown,
  request: ExternalBiServiceIntentRequestV2,
  attestationDigest: string,
  config: ExternalBiServiceConfigV2,
): ExternalBiServiceReasonCodeV2 | null {
  if (!isRecord(value) || value.schemaVersion !== EXTERNAL_BI_SERVICE_RESULT_SCHEMA_V2
    || value.action !== request.action || value.requestId !== request.requestId) return "EXTERNAL_BI_SERVICE_RESPONSE_MALFORMED";
  const runtime = isRecord(value.runtime) ? value.runtime : null;
  const product = runtime && isRecord(runtime.product) ? runtime.product : null;
  const contract = runtime && isRecord(runtime.contract) ? runtime.contract : null;
  if (!product || product.id !== "superset-bi-agent" || product.version !== config.expectedProductVersion) return "EXTERNAL_BI_SERVICE_PRODUCT_VERSION_DENIED";
  if (!contract || contract.id !== EXTERNAL_BI_SERVICE_CONTRACT_ID_V2 || contract.version !== config.expectedContractVersion) return "EXTERNAL_BI_SERVICE_CONTRACT_VERSION_DENIED";
  if (value.capabilityAttestationDigest !== attestationDigest) return "EXTERNAL_BI_SERVICE_DIGEST_DENIED";
  const integrity = isRecord(value.integrity) ? value.integrity : null;
  if (!integrity || integrity.algorithm !== "sha256-canonical-json" || typeof integrity.digest !== "string") return "EXTERNAL_BI_SERVICE_RESPONSE_MALFORMED";
  try {
    if (integrity.digest !== digest(bodyWithout(value, "integrity"))) return "EXTERNAL_BI_SERVICE_DIGEST_DENIED";
  } catch { return "EXTERNAL_BI_SERVICE_RESPONSE_MALFORMED"; }
  const result = isRecord(value.result) ? value.result : null;
  if (!result) return "EXTERNAL_BI_SERVICE_RESPONSE_MALFORMED";
  if (request.action === "status" && result.status !== "READY") return "EXTERNAL_BI_SERVICE_STATUS_MALFORMED";
  return null;
}

export async function invokeExternalBiServiceV2(
  decision: ExternalBiServiceConfigDecisionV2,
  request: ExternalBiServiceIntentRequestV2,
  fetchImpl: typeof fetch = fetch,
): Promise<ExternalBiServiceIntentResultV2> {
  if (decision.outcome === "DISABLED") return { outcome: "DISABLED", reasonCodes: decision.reasonCodes };
  if (decision.outcome === "DENIED") return decision;
  const requestError = validateIntentRequest(request);
  if (requestError) return { outcome: "DENIED", reasonCodes: [requestError] };
  const { config } = decision;
  if (config.biAgentBaseUrl === null) return { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_URL_DENIED"] };
  try {
    const attestationResponse = await fetchImpl(endpoint(config.biAgentBaseUrl, "/v2/capabilities"), {
      method: "GET", signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!attestationResponse.ok) return { outcome: "UNAVAILABLE", reasonCodes: ["EXTERNAL_BI_SERVICE_UNAVAILABLE"] };
    const attestation = await responseJson(attestationResponse);
    const attestationError = validateAttestation(attestation, config);
    if (attestationError) return { outcome: "DENIED", reasonCodes: [attestationError] };
    const proof = (attestation as Record<string, unknown>).attestation as Record<string, unknown>;
    const attestationDigest = proof.digest as string;
    const payload = {
      schemaVersion: EXTERNAL_BI_SERVICE_REQUEST_SCHEMA_V2,
      requestId: request.requestId,
      action: request.action,
      ...(request.input === undefined ? {} : { input: request.input }),
    };
    const response = await fetchImpl(endpoint(config.biAgentBaseUrl, "/v2/intents"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) return { outcome: "UNAVAILABLE", reasonCodes: ["EXTERNAL_BI_SERVICE_UNAVAILABLE"] };
    const value = await responseJson(response);
    const responseError = validateIntentEnvelope(value, request, attestationDigest, config);
    if (responseError) return { outcome: "DENIED", reasonCodes: [responseError] };
    const record = value as Record<string, unknown>;
    const integrity = record.integrity as Record<string, unknown>;
    return {
      outcome: "VERIFIED",
      reasonCodes: ["EXTERNAL_BI_SERVICE_CONFIG_VERIFIED"],
      readback: {
        action: request.action,
        requestId: request.requestId,
        attestationDigest,
        responseDigest: integrity.digest as string,
        result: record.result as Readonly<Record<string, unknown>>,
      },
    };
  } catch {
    return { outcome: "UNAVAILABLE", reasonCodes: ["EXTERNAL_BI_SERVICE_UNAVAILABLE"] };
  }
}

export async function probeExternalBiServiceV2(
  decision: ExternalBiServiceConfigDecisionV2,
  fetchImpl: typeof fetch = fetch,
): Promise<ExternalBiServiceProbeResultV2> {
  const status = await invokeExternalBiServiceV2(decision, { requestId: "cm-external-bi-probe", action: "status" }, fetchImpl);
  if (status.outcome !== "VERIFIED") return status;
  try {
    return {
      outcome: "VERIFIED",
      reasonCodes: ["EXTERNAL_BI_SERVICE_CONFIG_VERIFIED"],
      readback: {
        schemaVersion: EXTERNAL_BI_SERVICE_READBACK_SCHEMA_V2,
        outcome: "READY",
        productVersion: EXTERNAL_BI_SERVICE_PRODUCT_VERSION_V2,
        contractVersion: EXTERNAL_BI_SERVICE_CONTRACT_VERSION_V2,
        capabilities: EXTERNAL_BI_SERVICE_CAPABILITIES_V2,
        acceptedGraphIncumbent: "adaptive-v1",
        attestationDigest: status.readback.attestationDigest,
        statusResponseDigest: status.readback.responseDigest,
        directSupersetAccessByCm: false,
      },
    };
  } catch {
    return { outcome: "UNAVAILABLE", reasonCodes: ["EXTERNAL_BI_SERVICE_UNAVAILABLE"] };
  }
}
