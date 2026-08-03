import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  HMI_ADAPTER_CONTRACT_VERSION_V1,
  HMI_ADAPTER_REQUEST_SCHEMA_V1,
  HMI_CORE_VERSION_V1,
  HMI_DISCOVER_PAYLOAD_SCHEMA_V1,
  mapHmiHarnessInvocationV1,
  validateHmiDiscoverPayloadV1,
  type HmiAdapterMappingV1,
  type HmiGenerationBundleV1,
} from "../packages/contracts/src/index.js";

interface GoldenCase {
  readonly operation: "discover" | "explain" | "plan" | "handoff" | "validate" | "contribute";
  readonly query: string;
  readonly selectors: readonly string[];
  readonly selectedInput: unknown | null;
}

const limits = { maxReferences: 4, maxSourceBytes: 65_536, maxFindings: 200, maxOutputBytes: 16_384 };

function generation(): HmiGenerationBundleV1 {
  return JSON.parse(readFileSync("tests/fixtures/hmi/positive-generation-v1.json", "utf8")) as HmiGenerationBundleV1;
}

function golden(index = 0): GoldenCase {
  return (JSON.parse(readFileSync("tests/fixtures/hmi/adapter-golden-v1.json", "utf8")) as GoldenCase[])[index]!;
}

function mapping(index = 0): HmiAdapterMappingV1 {
  const bundle = generation();
  const item = golden(index);
  return mapHmiHarnessInvocationV1(bundle, {
    coreVersion: HMI_CORE_VERSION_V1,
    adapterContractVersion: HMI_ADAPTER_CONTRACT_VERSION_V1,
    generationDigest: bundle.manifest.generationDigest,
  }, {
    schemaVersion: HMI_ADAPTER_REQUEST_SCHEMA_V1,
    operation: item.operation,
    query: item.query,
    selectors: item.selectors,
    selectedInput: item.selectedInput,
    limits,
    transport: {
      harnessId: "SYNTHETIC_CODEX",
      adapterVersion: "synthetic-v1",
      invocationCorrelation: "discover-schema-fixture",
      presentationMode: "JSON",
    },
  });
}

function positive(): any {
  return JSON.parse(readFileSync("tests/fixtures/hmi/positive-discover-payload-v1.json", "utf8"));
}

test("HMI-004 accepts the exact public discover schema and canonicalizes finite filters", () => {
  const payload = positive();
  const schema = JSON.parse(readFileSync("schemas/contracts/hmi-discover-payload-v1.schema.json", "utf8")) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(payload), true, JSON.stringify(validate.errors));
  const accepted = validateHmiDiscoverPayloadV1(mapping(), payload);
  assert.equal(accepted.outcome, "ACCEPTED");
  if (accepted.outcome !== "ACCEPTED") return;
  assert.equal(accepted.payload.schemaVersion, HMI_DISCOVER_PAYLOAD_SCHEMA_V1);
  assert.deepEqual(accepted.payload.filters.effectClasses, ["DESCRIBE_ONLY", "READ_ONLY_VALIDATE"]);
  assert.match(accepted.payloadDigest, /^[a-f0-9]{64}$/);
});

test("HMI-004 binds capability filters to the exact mapped discover selectors", () => {
  const mapped = mapping(1);
  assert.equal(mapped.outcome, "MAPPED");
  if (mapped.outcome !== "MAPPED") return;
  const payload = positive();
  payload.requestDigest = mapped.requestDigest;
  payload.filters.capabilityIds = ["cm:describe-system"];
  const accepted = validateHmiDiscoverPayloadV1(mapped, payload);
  assert.equal(accepted.outcome, "ACCEPTED");
  payload.filters.capabilityIds = [];
  assert.deepEqual(validateHmiDiscoverPayloadV1(mapped, payload), {
    outcome: "DENIED", reasonCodes: ["HMI_DISCOVER_FILTER_DENIED"],
  });
});

test("HMI-004 denies non-discover mappings and denied adapter inputs", () => {
  assert.deepEqual(validateHmiDiscoverPayloadV1(mapping(4), positive()), {
    outcome: "DENIED", reasonCodes: ["HMI_DISCOVER_OPERATION_DENIED"],
  });
  assert.deepEqual(validateHmiDiscoverPayloadV1({
    outcome: "DENIED", reasonCodes: ["HMI_ADAPTER_INPUT_DENIED"],
  }, positive()), { outcome: "DENIED", reasonCodes: ["HMI_DISCOVER_BINDING_DENIED"] });
});

test("HMI-004 denies schema, binding, filter and authority drift with typed reasons", () => {
  const cases: readonly [any, string][] = [
    [{ ...positive(), extra: true }, "HMI_DISCOVER_SCHEMA_DENIED"],
    [{ ...positive(), requestDigest: "f".repeat(64) }, "HMI_DISCOVER_BINDING_DENIED"],
    [{ ...positive(), filters: { ...positive().filters, effectClasses: ["EXECUTE"] } }, "HMI_DISCOVER_FILTER_DENIED"],
    [{ ...positive(), filters: { ...positive().filters, effectClasses: ["DESCRIBE_ONLY", "DESCRIBE_ONLY"] } }, "HMI_DISCOVER_FILTER_DENIED"],
    [{ ...positive(), authority: { ...positive().authority, routeIds: ["cm:live"] } }, "HMI_DISCOVER_AUTHORITY_DENIED"],
  ];
  for (const [input, reason] of cases) {
    assert.deepEqual(validateHmiDiscoverPayloadV1(mapping(), input), {
      outcome: "DENIED", reasonCodes: [reason],
    });
  }
});

test("HMI-004 emits no transport metadata or authority and is deterministic", () => {
  const first = validateHmiDiscoverPayloadV1(mapping(), positive());
  const second = validateHmiDiscoverPayloadV1(mapping(), positive());
  assert.deepEqual(first, second);
  assert.equal(first.outcome, "ACCEPTED");
  if (first.outcome !== "ACCEPTED") return;
  assert.doesNotMatch(first.canonicalBytes, /SYNTHETIC_CODEX|discover-schema-fixture|presentationMode/);
  assert.deepEqual(first.payload.authority, { requestedRights: [], routeIds: [], writeTargets: [] });
  assert.equal(Buffer.byteLength(first.canonicalBytes, "utf8") < 4_096, true);
});
