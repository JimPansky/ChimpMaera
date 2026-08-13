export const EXTERNAL_BI_SERVICE_CONFIG_SCHEMA_V1 =
  "chimpmaera.external-bi-service/config/v1" as const;
export const EXTERNAL_BI_SERVICE_READBACK_SCHEMA_V1 =
  "chimpmaera.external-bi-service/readback/v1" as const;
export const EXTERNAL_BI_SERVICE_MIN_PRODUCT_VERSION_V1 = "v0.4.1" as const;
export const EXTERNAL_BI_SERVICE_MIN_AGENT_CONTRACT_V1 =
  "chimpmaera.bi/agent-result/v1" as const;

export const EXTERNAL_BI_SERVICE_CAPABILITIES_V1 = [
  "agent.health",
  "agent.status",
  "catalog.question",
  "catalog.search",
  "superset.health",
] as const;

const ENV_KEYS = [
  "BI_AGENT_BASE_URL",
  "SUPERSET_BASE_URL",
  "BI_AGENT_EXPECTED_PRODUCT_VERSION",
  "BI_AGENT_MIN_CONTRACT_VERSION",
  "BI_AGENT_TIMEOUT_MS",
] as const;

const UNSAFE_TEXT =
  /\b(?:select|insert|update|delete|merge|drop|alter|create|truncate|grant|revoke|exec(?:ute)?|dbcc|backup|restore|raw\s+sql|sql\s*lab|ignore\s+(?:all\s+)?previous|system\s+prompt|password|credential|secret|token)\b/i;

const PRIVATE_ADDRESS_HOSTS = new Set(["0.0.0.0", "169.254.169.254", "[::]", "::"]);

const QUESTION_PROMPTS = {
  largest_tables: "Largest tables by size",
  row_estimates_freshness: "Row estimates freshness",
  object_inventory_validity: "Object inventory validity",
  dependencies: "Dependencies",
  stored_logic_signatures: "Stored logic signatures",
  scheduler_mv_refresh: "Scheduler materialized view refresh",
  coverage_blind_spots: "Coverage blind spots",
  bi_relevance_candidates: "BI relevance candidates",
} as const;

export type ExternalBiServiceReasonCodeV1 =
  | "EXTERNAL_BI_SERVICE_DISABLED"
  | "EXTERNAL_BI_SERVICE_NOT_CONFIGURED"
  | "EXTERNAL_BI_SERVICE_CONFIG_VERIFIED"
  | "EXTERNAL_BI_SERVICE_CONFIG_DENIED"
  | "EXTERNAL_BI_SERVICE_URL_DENIED"
  | "EXTERNAL_BI_SERVICE_TIMEOUT_DENIED"
  | "EXTERNAL_BI_SERVICE_VERSION_DENIED"
  | "EXTERNAL_BI_SERVICE_HEALTH_UNAVAILABLE"
  | "EXTERNAL_BI_SERVICE_SUPERSET_MISMATCH"
  | "EXTERNAL_BI_SERVICE_STATUS_MALFORMED"
  | "EXTERNAL_BI_SERVICE_CAPABILITY_MISSING"
  | "EXTERNAL_BI_SERVICE_UNSAFE_REQUEST_DENIED"
  | "EXTERNAL_BI_SERVICE_MUTATION_DENIED";

export interface ExternalBiServiceConfigV1 {
  readonly schemaVersion: typeof EXTERNAL_BI_SERVICE_CONFIG_SCHEMA_V1;
  readonly enabled: boolean;
  readonly biAgentBaseUrl: string | null;
  readonly supersetBaseUrl: string | null;
  readonly expectedProductVersion: string;
  readonly minAgentContractVersion: typeof EXTERNAL_BI_SERVICE_MIN_AGENT_CONTRACT_V1;
  readonly timeoutMs: number;
  readonly allowedCapabilities: readonly typeof EXTERNAL_BI_SERVICE_CAPABILITIES_V1[number][];
}

export type ExternalBiServiceConfigDecisionV1 =
  | {
    readonly outcome: "VERIFIED";
    readonly reasonCodes: readonly ["EXTERNAL_BI_SERVICE_CONFIG_VERIFIED"];
    readonly config: ExternalBiServiceConfigV1;
  }
  | {
    readonly outcome: "DISABLED";
    readonly reasonCodes: readonly ("EXTERNAL_BI_SERVICE_DISABLED" | "EXTERNAL_BI_SERVICE_NOT_CONFIGURED")[];
    readonly config: ExternalBiServiceConfigV1;
  }
  | {
    readonly outcome: "DENIED";
    readonly reasonCodes: readonly ExternalBiServiceReasonCodeV1[];
  };

export type ExternalBiCatalogRequestV1 =
  | { readonly action: "status" }
  | { readonly action: "catalogQuestion"; readonly family: keyof typeof QUESTION_PROMPTS }
  | { readonly action: "catalogSearch"; readonly term: string; readonly limit?: number };

export interface ExternalBiServiceReadbackV1 {
  readonly schemaVersion: typeof EXTERNAL_BI_SERVICE_READBACK_SCHEMA_V1;
  readonly outcome: "READY";
  readonly expectedProductVersion: string;
  readonly minAgentContractVersion: typeof EXTERNAL_BI_SERVICE_MIN_AGENT_CONTRACT_V1;
  readonly health: "HEALTHY";
  readonly supersetHealth: "HEALTHY";
  readonly status: {
    readonly engine: "mssql" | "oracle";
    readonly sourceMode: "fixture" | "live";
    readonly catalogReady: true;
    readonly latestReceiptId: string | null;
  };
  readonly capabilities: readonly typeof EXTERNAL_BI_SERVICE_CAPABILITIES_V1[number][];
  readonly mutationEndpointsExposedByCm: false;
}

export type ExternalBiServiceProbeResultV1 =
  | {
    readonly outcome: "VERIFIED";
    readonly reasonCodes: readonly ["EXTERNAL_BI_SERVICE_CONFIG_VERIFIED"];
    readonly readback: ExternalBiServiceReadbackV1;
  }
  | {
    readonly outcome: "DISABLED";
    readonly reasonCodes: readonly ("EXTERNAL_BI_SERVICE_DISABLED" | "EXTERNAL_BI_SERVICE_NOT_CONFIGURED")[];
  }
  | {
    readonly outcome: "DENIED" | "UNAVAILABLE";
    readonly reasonCodes: readonly ExternalBiServiceReasonCodeV1[];
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function disabled(reasonCodes: readonly ("EXTERNAL_BI_SERVICE_DISABLED" | "EXTERNAL_BI_SERVICE_NOT_CONFIGURED")[]): ExternalBiServiceConfigDecisionV1 {
  return {
    outcome: "DISABLED",
    reasonCodes,
    config: {
      schemaVersion: EXTERNAL_BI_SERVICE_CONFIG_SCHEMA_V1,
      enabled: false,
      biAgentBaseUrl: null,
      supersetBaseUrl: null,
      expectedProductVersion: EXTERNAL_BI_SERVICE_MIN_PRODUCT_VERSION_V1,
      minAgentContractVersion: EXTERNAL_BI_SERVICE_MIN_AGENT_CONTRACT_V1,
      timeoutMs: 5000,
      allowedCapabilities: EXTERNAL_BI_SERVICE_CAPABILITIES_V1,
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
  if (!host || PRIVATE_ADDRESS_HOSTS.has(host)) return null;
  parsed.pathname = "/";
  return parsed.toString().replace(/\/$/, "");
}

function parseTimeout(value: string | undefined): number | null {
  if (value === undefined || value === "") return 5000;
  if (!/^[0-9]{2,6}$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= 100 && parsed <= 30000 ? parsed : null;
}

export function configureExternalBiServiceV1(
  env: Partial<Record<typeof ENV_KEYS[number], string | undefined>>,
): ExternalBiServiceConfigDecisionV1 {
  const hasAny = ENV_KEYS.some((key) => env[key] !== undefined && env[key] !== "");
  if (!hasAny) return disabled(["EXTERNAL_BI_SERVICE_NOT_CONFIGURED"]);

  const biAgentBaseUrl = env.BI_AGENT_BASE_URL ? sanitizeBaseUrl(env.BI_AGENT_BASE_URL) : null;
  const supersetBaseUrl = env.SUPERSET_BASE_URL ? sanitizeBaseUrl(env.SUPERSET_BASE_URL) : null;
  if (!biAgentBaseUrl || !supersetBaseUrl) return { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_URL_DENIED"] };

  const timeoutMs = parseTimeout(env.BI_AGENT_TIMEOUT_MS);
  if (timeoutMs === null) return { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_TIMEOUT_DENIED"] };

  const expectedProductVersion = env.BI_AGENT_EXPECTED_PRODUCT_VERSION ?? EXTERNAL_BI_SERVICE_MIN_PRODUCT_VERSION_V1;
  if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(expectedProductVersion)) {
    return { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_VERSION_DENIED"] };
  }
  const minAgentContractVersion = env.BI_AGENT_MIN_CONTRACT_VERSION ?? EXTERNAL_BI_SERVICE_MIN_AGENT_CONTRACT_V1;
  if (minAgentContractVersion !== EXTERNAL_BI_SERVICE_MIN_AGENT_CONTRACT_V1) {
    return { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_VERSION_DENIED"] };
  }

  return {
    outcome: "VERIFIED",
    reasonCodes: ["EXTERNAL_BI_SERVICE_CONFIG_VERIFIED"],
    config: {
      schemaVersion: EXTERNAL_BI_SERVICE_CONFIG_SCHEMA_V1,
      enabled: true,
      biAgentBaseUrl,
      supersetBaseUrl,
      expectedProductVersion,
      minAgentContractVersion,
      timeoutMs,
      allowedCapabilities: EXTERNAL_BI_SERVICE_CAPABILITIES_V1,
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

async function json(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return null; }
}

function abortSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

export async function probeExternalBiServiceV1(
  decision: ExternalBiServiceConfigDecisionV1,
  fetchImpl: typeof fetch = fetch,
): Promise<ExternalBiServiceProbeResultV1> {
  if (decision.outcome === "DISABLED") return { outcome: "DISABLED", reasonCodes: decision.reasonCodes };
  if (decision.outcome === "DENIED") return decision;
  const { config } = decision;
  if (config.biAgentBaseUrl === null || config.supersetBaseUrl === null) {
    return { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_URL_DENIED"] };
  }
  try {
    const agentHealth = await fetchImpl(endpoint(config.biAgentBaseUrl, "/healthz"), {
      method: "GET",
      signal: abortSignal(config.timeoutMs),
    });
    const agentHealthBody = await json(agentHealth);
    if (!agentHealth.ok || !isRecord(agentHealthBody) || agentHealthBody.status !== "ok") {
      return { outcome: "UNAVAILABLE", reasonCodes: ["EXTERNAL_BI_SERVICE_HEALTH_UNAVAILABLE"] };
    }

    const supersetHealth = await fetchImpl(endpoint(config.supersetBaseUrl, "/health"), {
      method: "GET",
      signal: abortSignal(config.timeoutMs),
    });
    const supersetText = await supersetHealth.text().catch(() => "");
    if (!supersetHealth.ok || supersetText.trim() !== "OK") {
      return { outcome: "UNAVAILABLE", reasonCodes: ["EXTERNAL_BI_SERVICE_SUPERSET_MISMATCH"] };
    }

    const statusResponse = await fetchImpl(endpoint(config.biAgentBaseUrl, "/api/chat"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "status" }),
      signal: abortSignal(config.timeoutMs),
    });
    const statusBody = await json(statusResponse);
    if (!statusResponse.ok || !isRecord(statusBody)) {
      return { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_STATUS_MALFORMED"] };
    }
    const status = isRecord(statusBody.status) ? statusBody.status : null;
    if (statusBody.intent !== "STATUS" || !status || status.status !== "READY") {
      return { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_STATUS_MALFORMED"] };
    }
    if (!["mssql", "oracle"].includes(String(status.engine)) || !["fixture", "live"].includes(String(status.sourceMode))) {
      return { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_STATUS_MALFORMED"] };
    }
    if (status.catalogReady !== true) {
      return { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_CAPABILITY_MISSING"] };
    }

    return {
      outcome: "VERIFIED",
      reasonCodes: ["EXTERNAL_BI_SERVICE_CONFIG_VERIFIED"],
      readback: {
        schemaVersion: EXTERNAL_BI_SERVICE_READBACK_SCHEMA_V1,
        outcome: "READY",
        expectedProductVersion: config.expectedProductVersion,
        minAgentContractVersion: config.minAgentContractVersion,
        health: "HEALTHY",
        supersetHealth: "HEALTHY",
        status: {
          engine: status.engine as "mssql" | "oracle",
          sourceMode: status.sourceMode as "fixture" | "live",
          catalogReady: true,
          latestReceiptId: typeof status.latestReceiptId === "string" ? status.latestReceiptId : null,
        },
        capabilities: config.allowedCapabilities,
        mutationEndpointsExposedByCm: false,
      },
    };
  } catch {
    return { outcome: "UNAVAILABLE", reasonCodes: ["EXTERNAL_BI_SERVICE_HEALTH_UNAVAILABLE"] };
  }
}

export function renderExternalBiAgentPromptV1(request: ExternalBiCatalogRequestV1): string | null {
  if (request.action === "status") return "status";
  if (request.action === "catalogQuestion") return QUESTION_PROMPTS[request.family] ?? null;
  if (request.action === "catalogSearch") {
    const term = request.term.trim();
    if (term.length < 2 || term.length > 80 || UNSAFE_TEXT.test(term)) return null;
    return `Suche ${term}`;
  }
  return null;
}

export function assertExternalBiReadOnlyRequestV1(
  request: ExternalBiCatalogRequestV1 | { readonly action: string },
): readonly ExternalBiServiceReasonCodeV1[] {
  if (!isRecord(request) || typeof request.action !== "string") return ["EXTERNAL_BI_SERVICE_CONFIG_DENIED"];
  if (["analyze", "publish", "readback", "sql", "mutation"].includes(request.action)) {
    return ["EXTERNAL_BI_SERVICE_MUTATION_DENIED"];
  }
  const prompt = renderExternalBiAgentPromptV1(request as ExternalBiCatalogRequestV1);
  if (prompt === null || UNSAFE_TEXT.test(prompt)) return ["EXTERNAL_BI_SERVICE_UNSAFE_REQUEST_DENIED"];
  return [];
}
