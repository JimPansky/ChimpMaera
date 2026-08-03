import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import {
  HMI_CORE_VERSION_V1,
  normalizeHmiSemanticResultV1,
  verifyHmiGenerationV1,
  type HmiGenerationBundleV1,
} from "./hmi-core.js";

export const HMI_ADAPTER_REQUEST_SCHEMA_V1 = "chimpmaera.hmi/adapter-request/v1" as const;
export const HMI_ADAPTER_CONTRACT_VERSION_V1 = "1.0.0" as const;

export type HmiOperationV1 = "discover" | "explain" | "plan" | "handoff" | "validate" | "contribute";
export type HmiSyntheticHarnessV1 = "SYNTHETIC_OPENCLAW" | "SYNTHETIC_CODEX";

export interface HmiAdapterPinV1 {
  readonly coreVersion: typeof HMI_CORE_VERSION_V1;
  readonly adapterContractVersion: typeof HMI_ADAPTER_CONTRACT_VERSION_V1;
  readonly generationDigest: string;
}

export interface HmiAdapterLimitsV1 {
  readonly maxReferences: number;
  readonly maxSourceBytes: number;
  readonly maxFindings: number;
  readonly maxOutputBytes: number;
}

export interface HmiHarnessInvocationV1 {
  readonly schemaVersion: typeof HMI_ADAPTER_REQUEST_SCHEMA_V1;
  readonly operation: HmiOperationV1;
  readonly query: string;
  readonly selectors: readonly string[];
  readonly selectedInput: unknown | null;
  readonly limits: HmiAdapterLimitsV1;
  readonly transport: {
    readonly harnessId: HmiSyntheticHarnessV1;
    readonly adapterVersion: "synthetic-v1";
    readonly invocationCorrelation: string;
    readonly presentationMode: "JSON" | "MARKDOWN";
  };
}

export interface HmiCanonicalRequestV1 {
  readonly schemaVersion: typeof HMI_ADAPTER_REQUEST_SCHEMA_V1;
  readonly operation: HmiOperationV1;
  readonly generationDigest: string;
  readonly adapterContractVersion: typeof HMI_ADAPTER_CONTRACT_VERSION_V1;
  readonly query: string;
  readonly selectors: readonly string[];
  readonly inputDigest: string | null;
  readonly limits: HmiAdapterLimitsV1;
}

export type HmiAdapterReasonCodeV1 =
  | "HMI_ADAPTER_SCHEMA_DENIED"
  | "HMI_ADAPTER_OPERATION_DENIED"
  | "HMI_ADAPTER_PIN_DENIED"
  | "HMI_ADAPTER_GENERATION_DENIED"
  | "HMI_ADAPTER_LIMIT_DENIED"
  | "HMI_ADAPTER_INPUT_DENIED";

export type HmiAdapterMappingV1 =
  | {
    readonly outcome: "MAPPED";
    readonly request: HmiCanonicalRequestV1;
    readonly canonicalRequestBytes: string;
    readonly requestDigest: string;
    readonly transportEnvelope: HmiHarnessInvocationV1["transport"];
  }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly [HmiAdapterReasonCodeV1] };

function sha256(bytes: string): string {
  return createHash("sha256").update(bytes, "utf8").digest("hex");
}

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

function isSelector(value: unknown): value is string {
  return typeof value === "string"
    && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
}

function isBoundedInteger(value: unknown, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= maximum;
}

function denied(reason: HmiAdapterReasonCodeV1): HmiAdapterMappingV1 {
  return { outcome: "DENIED", reasonCodes: [reason] };
}

function hasValidLimits(value: unknown, ceiling: HmiAdapterLimitsV1): value is HmiAdapterLimitsV1 {
  return exactKeys(value, ["maxReferences", "maxSourceBytes", "maxFindings", "maxOutputBytes"])
    && isBoundedInteger(value.maxReferences, ceiling.maxReferences)
    && isBoundedInteger(value.maxSourceBytes, ceiling.maxSourceBytes)
    && isBoundedInteger(value.maxFindings, ceiling.maxFindings)
    && isBoundedInteger(value.maxOutputBytes, ceiling.maxOutputBytes);
}

export function mapHmiHarnessInvocationV1(
  bundle: HmiGenerationBundleV1,
  pin: HmiAdapterPinV1,
  value: unknown,
): HmiAdapterMappingV1 {
  if (!exactKeys(pin, ["coreVersion", "adapterContractVersion", "generationDigest"])
    || pin.coreVersion !== HMI_CORE_VERSION_V1
    || pin.adapterContractVersion !== HMI_ADAPTER_CONTRACT_VERSION_V1
    || !isDigest(pin.generationDigest)) return denied("HMI_ADAPTER_PIN_DENIED");

  const verification = verifyHmiGenerationV1(bundle);
  if (verification.outcome !== "VERIFIED") return denied("HMI_ADAPTER_GENERATION_DENIED");
  if (verification.generationDigest !== pin.generationDigest) return denied("HMI_ADAPTER_PIN_DENIED");

  if (!exactKeys(value, ["schemaVersion", "operation", "query", "selectors", "selectedInput", "limits", "transport"])) {
    return denied("HMI_ADAPTER_SCHEMA_DENIED");
  }
  if (value.schemaVersion !== HMI_ADAPTER_REQUEST_SCHEMA_V1
    || typeof value.operation !== "string"
    || !["discover", "explain", "plan", "handoff", "validate", "contribute"].includes(value.operation)) {
    return denied("HMI_ADAPTER_OPERATION_DENIED");
  }
  if (typeof value.query !== "string" || value.query.length < 1 || value.query.length > 4_096
    || value.query !== value.query.normalize("NFC")
    || !Array.isArray(value.selectors) || value.selectors.length > 4
    || new Set(value.selectors).size !== value.selectors.length
    || !value.selectors.every(isSelector)) return denied("HMI_ADAPTER_INPUT_DENIED");
  if (!hasValidLimits(value.limits, bundle.manifest.limits)) return denied("HMI_ADAPTER_LIMIT_DENIED");
  if (!exactKeys(value.transport, ["harnessId", "adapterVersion", "invocationCorrelation", "presentationMode"])
    || !["SYNTHETIC_OPENCLAW", "SYNTHETIC_CODEX"].includes(value.transport.harnessId as string)
    || value.transport.adapterVersion !== "synthetic-v1"
    || typeof value.transport.invocationCorrelation !== "string"
    || !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(value.transport.invocationCorrelation)
    || !["JSON", "MARKDOWN"].includes(value.transport.presentationMode as string)) {
    return denied("HMI_ADAPTER_SCHEMA_DENIED");
  }

  let inputDigest: string | null = null;
  if (value.selectedInput !== null) {
    try {
      inputDigest = normalizeHmiSemanticResultV1(value.selectedInput).responseDigest;
    } catch {
      return denied("HMI_ADAPTER_INPUT_DENIED");
    }
  }
  const request: HmiCanonicalRequestV1 = {
    schemaVersion: HMI_ADAPTER_REQUEST_SCHEMA_V1,
    operation: value.operation as HmiOperationV1,
    generationDigest: pin.generationDigest,
    adapterContractVersion: HMI_ADAPTER_CONTRACT_VERSION_V1,
    query: value.query,
    selectors: [...value.selectors].sort() as string[],
    inputDigest,
    limits: {
      maxReferences: value.limits.maxReferences as number,
      maxSourceBytes: value.limits.maxSourceBytes as number,
      maxFindings: value.limits.maxFindings as number,
      maxOutputBytes: value.limits.maxOutputBytes as number,
    },
  };
  const canonicalRequestBytes = canonicalJson(request);
  return {
    outcome: "MAPPED",
    request,
    canonicalRequestBytes,
    requestDigest: sha256(canonicalRequestBytes),
    transportEnvelope: value.transport as unknown as HmiHarnessInvocationV1["transport"],
  };
}

export function mapHmiHarnessResponseV1(mapping: HmiAdapterMappingV1, semanticResult: unknown):
  | {
    readonly outcome: "MAPPED";
    readonly canonicalResponseBytes: string;
    readonly responseDigest: string;
    readonly transportEnvelope: HmiHarnessInvocationV1["transport"];
  }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly [HmiAdapterReasonCodeV1] } {
  if (mapping.outcome !== "MAPPED") return { outcome: "DENIED", reasonCodes: mapping.reasonCodes };
  try {
    const normalized = normalizeHmiSemanticResultV1(semanticResult);
    return {
      outcome: "MAPPED",
      canonicalResponseBytes: normalized.canonicalBytes,
      responseDigest: normalized.responseDigest,
      transportEnvelope: mapping.transportEnvelope,
    };
  } catch {
    return { outcome: "DENIED", reasonCodes: ["HMI_ADAPTER_INPUT_DENIED"] };
  }
}
