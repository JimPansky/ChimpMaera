import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  HMI_ADAPTER_CONTRACT_VERSION_V1,
  HMI_ADAPTER_REQUEST_SCHEMA_V1,
  HMI_CORE_VERSION_V1,
  mapHmiHarnessInvocationV1,
  validateHmiDiscoverPayloadV1,
  validateHmiExplainPayloadV1,
  type HmiGenerationBundleV1,
} from "../packages/contracts/src/index.js";

const limits = { maxReferences: 4, maxSourceBytes: 65_536, maxFindings: 200, maxOutputBytes: 16_384 };
const load = (path: string) => JSON.parse(readFileSync(path, "utf8"));

function bundle(): HmiGenerationBundleV1 {
  return load("tests/fixtures/hmi/positive-generation-v1.json") as HmiGenerationBundleV1;
}

function mapping(index: number) {
  const generation = bundle();
  const golden = load("tests/fixtures/hmi/adapter-golden-v1.json")[index];
  return mapHmiHarnessInvocationV1(generation, {
    coreVersion: HMI_CORE_VERSION_V1,
    adapterContractVersion: HMI_ADAPTER_CONTRACT_VERSION_V1,
    generationDigest: generation.manifest.generationDigest,
  }, {
    schemaVersion: HMI_ADAPTER_REQUEST_SCHEMA_V1,
    operation: golden.operation,
    query: golden.query,
    selectors: golden.selectors,
    selectedInput: golden.selectedInput,
    limits,
    transport: { harnessId: "SYNTHETIC_OPENCLAW", adapterVersion: "synthetic-v1", invocationCorrelation: "post-explain-audit", presentationMode: "JSON" },
  });
}

test("HMI-008 discover and explain preserve the same selector set semantics", () => {
  const discoverMapping: any = mapping(1);
  const explainMapping: any = mapping(4);
  const discover = load("tests/fixtures/hmi/positive-discover-payload-v1.json");
  discover.requestDigest = discoverMapping.requestDigest;
  discover.filters.capabilityIds = ["cm:describe-system"];
  const explain = load("tests/fixtures/hmi/positive-explain-payload-v1.json");
  assert.equal(validateHmiDiscoverPayloadV1(discoverMapping, discover).outcome, "ACCEPTED");
  assert.equal(validateHmiExplainPayloadV1(bundle(), explainMapping, explain).outcome, "ACCEPTED");
  assert.deepEqual(discover.filters.capabilityIds, explain.subjectCapabilityIds);
});

test("HMI-008 both operation payloads bind one immutable generation and grant zero authority", () => {
  const discoverMapping: any = mapping(1);
  const discover = load("tests/fixtures/hmi/positive-discover-payload-v1.json");
  discover.requestDigest = discoverMapping.requestDigest;
  discover.filters.capabilityIds = ["cm:describe-system"];
  const explain = load("tests/fixtures/hmi/positive-explain-payload-v1.json");
  const accepted = [
    validateHmiDiscoverPayloadV1(discoverMapping, discover),
    validateHmiExplainPayloadV1(bundle(), mapping(4), explain),
  ];
  for (const result of accepted) {
    assert.equal(result.outcome, "ACCEPTED");
    if (result.outcome !== "ACCEPTED") continue;
    assert.equal(result.payload.generationDigest, bundle().manifest.generationDigest);
    assert.deepEqual(result.payload.authority, { requestedRights: [], routeIds: [], writeTargets: [] });
  }
});

test("HMI-008 explain cannot widen references beyond mapped or generated evidence", () => {
  const explain = load("tests/fixtures/hmi/positive-explain-payload-v1.json");
  explain.citedSourceIds = ["cm:hmi-source-001", "cm:unmapped-source"];
  assert.deepEqual(validateHmiExplainPayloadV1(bundle(), mapping(4), explain), {
    outcome: "DENIED", reasonCodes: ["HMI_EXPLAIN_CITATION_DENIED"],
  });
});
