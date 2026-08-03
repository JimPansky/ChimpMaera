import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  HMI_ADAPTER_CONTRACT_VERSION_V1,
  HMI_ADAPTER_REQUEST_SCHEMA_V1,
  HMI_CORE_VERSION_V1,
  HMI_EXPLAIN_PAYLOAD_SCHEMA_V1,
  mapHmiHarnessInvocationV1,
  validateHmiExplainPayloadV1,
  type HmiGenerationBundleV1,
} from "../packages/contracts/src/index.js";

const limits = { maxReferences: 4, maxSourceBytes: 65_536, maxFindings: 200, maxOutputBytes: 16_384 };

function bundle(): HmiGenerationBundleV1 {
  return JSON.parse(readFileSync("tests/fixtures/hmi/positive-generation-v1.json", "utf8")) as HmiGenerationBundleV1;
}

function mapping(index = 4) {
  const generation = bundle();
  const golden = JSON.parse(readFileSync("tests/fixtures/hmi/adapter-golden-v1.json", "utf8"))[index];
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
    transport: {
      harnessId: "SYNTHETIC_CODEX",
      adapterVersion: "synthetic-v1",
      invocationCorrelation: "explain-schema-fixture",
      presentationMode: "JSON",
    },
  });
}

function positive(): any {
  return JSON.parse(readFileSync("tests/fixtures/hmi/positive-explain-payload-v1.json", "utf8"));
}

test("HMI-007 accepts the exact public explain schema and provenance-bound fixture", () => {
  const payload = positive();
  const schema = JSON.parse(readFileSync("schemas/contracts/hmi-explain-payload-v1.schema.json", "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(payload), true, JSON.stringify(validate.errors));
  const accepted = validateHmiExplainPayloadV1(bundle(), mapping(), payload);
  assert.equal(accepted.outcome, "ACCEPTED");
  if (accepted.outcome !== "ACCEPTED") return;
  assert.equal(accepted.payload.schemaVersion, HMI_EXPLAIN_PAYLOAD_SCHEMA_V1);
  assert.deepEqual(accepted.payload.subjectCapabilityIds, ["cm:describe-system"]);
  assert.deepEqual(accepted.payload.citedSourceIds, ["cm:hmi-source-001"]);
  assert.match(accepted.payloadDigest, /^[a-f0-9]{64}$/);
});

test("HMI-007 binds operation, request and exact verified generation", () => {
  assert.deepEqual(validateHmiExplainPayloadV1(bundle(), mapping(0), positive()), {
    outcome: "DENIED", reasonCodes: ["HMI_EXPLAIN_OPERATION_DENIED"],
  });
  const payload = positive();
  payload.generationDigest = "f".repeat(64);
  assert.deepEqual(validateHmiExplainPayloadV1(bundle(), mapping(), payload), {
    outcome: "DENIED", reasonCodes: ["HMI_EXPLAIN_BINDING_DENIED"],
  });
  const invalidBundle: any = bundle();
  invalidBundle.manifest.generationDigest = "f".repeat(64);
  assert.deepEqual(validateHmiExplainPayloadV1(invalidBundle, mapping(), positive()), {
    outcome: "DENIED", reasonCodes: ["HMI_EXPLAIN_BINDING_DENIED"],
  });
});

test("HMI-007 denies selector widening and undeclared subjects", () => {
  const widened = positive();
  widened.subjectCapabilityIds.push("cm:undeclared-capability");
  assert.deepEqual(validateHmiExplainPayloadV1(bundle(), mapping(), widened), {
    outcome: "DENIED", reasonCodes: ["HMI_EXPLAIN_SUBJECT_DENIED"],
  });
  const mapped: any = mapping();
  mapped.request.selectors = ["cm:undeclared-capability"];
  const undeclared = positive();
  undeclared.subjectCapabilityIds = ["cm:undeclared-capability"];
  assert.deepEqual(validateHmiExplainPayloadV1(bundle(), mapped, undeclared), {
    outcome: "DENIED", reasonCodes: ["HMI_EXPLAIN_SUBJECT_DENIED"],
  });
});

test("HMI-007 requires declared citations within the mapped reference ceiling", () => {
  for (const citedSourceIds of [[], ["cm:undeclared-source"]]) {
    const payload = positive();
    payload.citedSourceIds = citedSourceIds;
    assert.deepEqual(validateHmiExplainPayloadV1(bundle(), mapping(), payload), {
      outcome: "DENIED", reasonCodes: ["HMI_EXPLAIN_CITATION_DENIED"],
    });
  }
  const mapped: any = mapping();
  mapped.request.limits.maxReferences = 1;
  const payload = positive();
  payload.citedSourceIds = ["cm:hmi-source-001", "cm:hmi-source-002"];
  assert.deepEqual(validateHmiExplainPayloadV1(bundle(), mapped, payload), {
    outcome: "DENIED", reasonCodes: ["HMI_EXPLAIN_CITATION_DENIED"],
  });
});

test("HMI-007 denies schema, marker and authority drift", () => {
  const cases: readonly [any, string][] = [
    [{ ...positive(), transport: {} }, "HMI_EXPLAIN_SCHEMA_DENIED"],
    [{ ...positive(), citationPolicy: "CITATIONS_OPTIONAL" }, "HMI_EXPLAIN_CITATION_DENIED"],
    [{ ...positive(), evidenceStatus: "PRODUCTION" }, "HMI_EXPLAIN_CITATION_DENIED"],
    [{ ...positive(), authority: { ...positive().authority, requestedRights: ["read"] } }, "HMI_EXPLAIN_AUTHORITY_DENIED"],
  ];
  for (const [payload, reason] of cases) {
    assert.deepEqual(validateHmiExplainPayloadV1(bundle(), mapping(), payload), {
      outcome: "DENIED", reasonCodes: [reason],
    });
  }
});

test("HMI-007 canonical bytes are deterministic, transport-free and authority-free", () => {
  const first = validateHmiExplainPayloadV1(bundle(), mapping(), positive());
  const second = validateHmiExplainPayloadV1(bundle(), mapping(), positive());
  assert.deepEqual(first, second);
  assert.equal(first.outcome, "ACCEPTED");
  if (first.outcome !== "ACCEPTED") return;
  assert.doesNotMatch(first.canonicalBytes, /SYNTHETIC_CODEX|explain-schema-fixture|presentationMode/);
  assert.deepEqual(first.payload.authority, { requestedRights: [], routeIds: [], writeTargets: [] });
});
