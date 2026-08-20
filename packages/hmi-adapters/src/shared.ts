import { canonicalJson } from "../../contracts/src/canonical-json.js";
import {
  HMI_ADAPTER_REQUEST_SCHEMA_V1,
  mapHmiHarnessInvocationV1,
  normalizeHmiSemanticResultV1,
  verifyHmiGenerationV1,
  type HmiAdapterMappingV1,
  type HmiAdapterPinV1,
  type HmiConformantHarnessV1,
  type HmiGenerationBundleV1,
  type HmiHarnessAdapterVersionV1,
} from "../../contracts/src/index.js";

export const HMI_CONFORMANT_ENTRYPOINT_SCHEMA_V1 = "pansphaira.hmi/conformant-entrypoint/v1" as const;
export const HMI_CONFORMANT_ENTRYPOINT_VERSION_V1 = "1.0.0" as const;

export type HmiConformantEntrypointOperationV1 = "discover" | "explain" | "contribute-preflight";

export interface HmiConformantEntrypointDescriptorV1 {
  readonly schemaVersion: "pansphaira.hmi/conformant-entrypoint-descriptor/v1";
  readonly entrypointVersion: typeof HMI_CONFORMANT_ENTRYPOINT_VERSION_V1;
  readonly harnessId: HmiConformantHarnessV1;
  readonly adapterVersion: HmiHarnessAdapterVersionV1;
  readonly lifecycleState: "DESCRIBED_INACTIVE";
  readonly operations: readonly ["discover", "explain", "contribute-preflight"];
  readonly authority: {
    readonly requestedRights: readonly [];
    readonly routeIds: readonly [];
    readonly writeTargets: readonly [];
    readonly networkRoutes: readonly [];
    readonly externalDependencies: readonly [];
  };
  readonly effects: {
    readonly installPerformed: false;
    readonly activationPerformed: false;
    readonly writePerformed: false;
  };
}

export interface HmiConformantEntrypointInvocationV1 {
  readonly schemaVersion: typeof HMI_CONFORMANT_ENTRYPOINT_SCHEMA_V1;
  readonly operation: HmiConformantEntrypointOperationV1;
  readonly query: string;
  readonly selectors: readonly string[];
  readonly selectedInput: unknown | null;
  readonly limits: {
    readonly maxReferences: number;
    readonly maxSourceBytes: number;
    readonly maxFindings: number;
    readonly maxOutputBytes: number;
  };
  readonly correlation: string;
}

export type HmiConformantEntrypointReasonCodeV1 =
  | "HMI_ENTRYPOINT_SCHEMA_DENIED"
  | "HMI_ENTRYPOINT_OPERATION_DENIED"
  | "HMI_ENTRYPOINT_PIN_DENIED"
  | "HMI_ENTRYPOINT_GENERATION_DENIED"
  | "HMI_ENTRYPOINT_LIMIT_DENIED"
  | "HMI_ENTRYPOINT_INPUT_DENIED"
  | "HMI_ENTRYPOINT_SELECTOR_DENIED";

type MappedAdapter = Extract<HmiAdapterMappingV1, { readonly outcome: "MAPPED" }>;

export type HmiConformantEntrypointMappingV1 =
  | {
    readonly outcome: "MAPPED";
    readonly operation: HmiConformantEntrypointOperationV1;
    readonly mapping: MappedAdapter;
    readonly request: MappedAdapter["request"];
    readonly canonicalRequestBytes: string;
    readonly requestDigest: string;
    readonly transportEnvelope: MappedAdapter["transportEnvelope"];
  }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly [HmiConformantEntrypointReasonCodeV1] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function denied(reason: HmiConformantEntrypointReasonCodeV1): HmiConformantEntrypointMappingV1 {
  return { outcome: "DENIED", reasonCodes: [reason] };
}

function translatedDenial(mapping: Extract<HmiAdapterMappingV1, { readonly outcome: "DENIED" }>): HmiConformantEntrypointMappingV1 {
  const reason = mapping.reasonCodes[0];
  if (reason === "HMI_ADAPTER_GENERATION_DENIED") return denied("HMI_ENTRYPOINT_GENERATION_DENIED");
  if (reason === "HMI_ADAPTER_PIN_DENIED") return denied("HMI_ENTRYPOINT_PIN_DENIED");
  if (reason === "HMI_ADAPTER_LIMIT_DENIED") return denied("HMI_ENTRYPOINT_LIMIT_DENIED");
  if (reason === "HMI_ADAPTER_INPUT_DENIED") return denied("HMI_ENTRYPOINT_INPUT_DENIED");
  return denied("HMI_ENTRYPOINT_SCHEMA_DENIED");
}

export function conformantEntrypointDescriptorV1(
  harnessId: HmiConformantHarnessV1,
): HmiConformantEntrypointDescriptorV1 {
  return Object.freeze({
    schemaVersion: "pansphaira.hmi/conformant-entrypoint-descriptor/v1",
    entrypointVersion: HMI_CONFORMANT_ENTRYPOINT_VERSION_V1,
    harnessId,
    adapterVersion: harnessId === "OPENCLAW" ? "openclaw-entrypoint-v1" : "codex-entrypoint-v1",
    lifecycleState: "DESCRIBED_INACTIVE",
    operations: Object.freeze(["discover", "explain", "contribute-preflight"] as const),
    authority: Object.freeze({
      requestedRights: Object.freeze([] as const),
      routeIds: Object.freeze([] as const),
      writeTargets: Object.freeze([] as const),
      networkRoutes: Object.freeze([] as const),
      externalDependencies: Object.freeze([] as const),
    }),
    effects: Object.freeze({ installPerformed: false, activationPerformed: false, writePerformed: false }),
  });
}

function isValidDescriptor(value: HmiConformantEntrypointDescriptorV1): boolean {
  const expectedVersion = value.harnessId === "OPENCLAW"
    ? "openclaw-entrypoint-v1"
    : value.harnessId === "CODEX" ? "codex-entrypoint-v1" : null;
  return value.schemaVersion === "pansphaira.hmi/conformant-entrypoint-descriptor/v1"
    && value.entrypointVersion === HMI_CONFORMANT_ENTRYPOINT_VERSION_V1
    && value.adapterVersion === expectedVersion
    && value.lifecycleState === "DESCRIBED_INACTIVE"
    && canonicalJson(value.operations) === canonicalJson(["discover", "explain", "contribute-preflight"])
    && canonicalJson(value.authority) === canonicalJson({
      requestedRights: [], routeIds: [], writeTargets: [], networkRoutes: [], externalDependencies: [],
    })
    && canonicalJson(value.effects) === canonicalJson({
      installPerformed: false, activationPerformed: false, writePerformed: false,
    });
}

export function mapConformantHmiEntrypointV1(
  descriptor: HmiConformantEntrypointDescriptorV1,
  bundle: HmiGenerationBundleV1,
  pin: HmiAdapterPinV1,
  value: unknown,
): HmiConformantEntrypointMappingV1 {
  if (!isValidDescriptor(descriptor)) return denied("HMI_ENTRYPOINT_SCHEMA_DENIED");
  if (verifyHmiGenerationV1(bundle).outcome !== "VERIFIED") return denied("HMI_ENTRYPOINT_GENERATION_DENIED");
  if (!exactKeys(value, ["schemaVersion", "operation", "query", "selectors", "selectedInput", "limits", "correlation"])) {
    return denied("HMI_ENTRYPOINT_SCHEMA_DENIED");
  }
  if (value.schemaVersion !== HMI_CONFORMANT_ENTRYPOINT_SCHEMA_V1
    || typeof value.operation !== "string"
    || !descriptor.operations.includes(value.operation as HmiConformantEntrypointOperationV1)) {
    return denied("HMI_ENTRYPOINT_OPERATION_DENIED");
  }
  if (!Array.isArray(value.selectors)) return denied("HMI_ENTRYPOINT_INPUT_DENIED");
  const operation = value.operation as HmiConformantEntrypointOperationV1;
  const declaredCapabilities = new Set(bundle.manifest.capabilities.map((item) => item.capabilityId));
  if ((operation === "discover" || operation === "explain")
    && value.selectors.some((selector) => typeof selector !== "string" || !declaredCapabilities.has(selector))) {
    return denied("HMI_ENTRYPOINT_SELECTOR_DENIED");
  }
  if (operation === "contribute-preflight" && value.selectors.length !== 0) {
    return denied("HMI_ENTRYPOINT_SELECTOR_DENIED");
  }
  if (operation === "contribute-preflight" && value.selectedInput === null) {
    return denied("HMI_ENTRYPOINT_INPUT_DENIED");
  }
  if (!isRecord(value.limits) || !Number.isSafeInteger(value.limits.maxSourceBytes)
    || (value.limits.maxSourceBytes as number) < 1) return denied("HMI_ENTRYPOINT_LIMIT_DENIED");
  if (value.selectedInput !== null) {
    try {
      const normalized = normalizeHmiSemanticResultV1(value.selectedInput);
      if (Buffer.byteLength(normalized.canonicalBytes, "utf8") > (value.limits.maxSourceBytes as number)) {
        return denied("HMI_ENTRYPOINT_LIMIT_DENIED");
      }
    } catch {
      return denied("HMI_ENTRYPOINT_INPUT_DENIED");
    }
  }

  const mapping = mapHmiHarnessInvocationV1(bundle, pin, {
    schemaVersion: HMI_ADAPTER_REQUEST_SCHEMA_V1,
    operation: operation === "contribute-preflight" ? "contribute" : operation,
    query: value.query,
    selectors: value.selectors,
    selectedInput: value.selectedInput,
    limits: value.limits,
    transport: {
      harnessId: descriptor.harnessId,
      adapterVersion: descriptor.adapterVersion,
      invocationCorrelation: value.correlation,
      presentationMode: descriptor.harnessId === "OPENCLAW" ? "MARKDOWN" : "JSON",
    },
  });
  if (mapping.outcome !== "MAPPED") return translatedDenial(mapping);
  return {
    outcome: "MAPPED",
    operation,
    mapping,
    request: mapping.request,
    canonicalRequestBytes: mapping.canonicalRequestBytes,
    requestDigest: mapping.requestDigest,
    transportEnvelope: mapping.transportEnvelope,
  };
}
