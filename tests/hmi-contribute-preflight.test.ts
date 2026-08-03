import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  HMI_ADAPTER_CONTRACT_VERSION_V1,
  HMI_ADAPTER_REQUEST_SCHEMA_V1,
  HMI_CONTRIBUTE_PREFLIGHT_SCHEMA_V1,
  HMI_CORE_VERSION_V1,
  mapHmiHarnessInvocationV1,
  validateHmiContributePreflightV1,
  type HmiGenerationBundleV1,
} from "../packages/contracts/src/index.js";

const limits = { maxReferences: 4, maxSourceBytes: 65_536, maxFindings: 200, maxOutputBytes: 16_384 };

function bundle(): HmiGenerationBundleV1 {
  return JSON.parse(readFileSync("tests/fixtures/hmi/positive-generation-v1.json", "utf8")) as HmiGenerationBundleV1;
}

function mapping(index = 16) {
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
      invocationCorrelation: "contribute-preflight-fixture",
      presentationMode: "JSON",
    },
  });
}

function positive(): any {
  return JSON.parse(readFileSync("tests/fixtures/hmi/positive-contribute-preflight-v1.json", "utf8"));
}

test("HMI-010 accepts the exact preparation-only contribute preflight schema", () => {
  const payload = positive();
  const schema = JSON.parse(readFileSync("schemas/contracts/hmi-contribute-preflight-v1.schema.json", "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(payload), true, JSON.stringify(validate.errors));
  const accepted = validateHmiContributePreflightV1(bundle(), mapping(), payload);
  assert.equal(accepted.outcome, "ACCEPTED");
  if (accepted.outcome !== "ACCEPTED") return;
  assert.equal(accepted.payload.schemaVersion, HMI_CONTRIBUTE_PREFLIGHT_SCHEMA_V1);
  assert.deepEqual(accepted.payload.preflightReasons, [
    "CONTRIBUTION_CAPABILITY_ABSENT", "PUBLICATION_ROUTE_ABSENT",
  ]);
  assert.match(accepted.payloadDigest, /^[a-f0-9]{64}$/);
});

test("HMI-010 binds operation, request, selected input and verified generation", () => {
  assert.deepEqual(validateHmiContributePreflightV1(bundle(), mapping(0), positive()), {
    outcome: "DENIED", reasonCodes: ["HMI_CONTRIBUTE_OPERATION_DENIED"],
  });
  for (const field of ["requestDigest", "inputDigest", "generationDigest"] as const) {
    const payload = positive();
    payload[field] = "f".repeat(64);
    assert.deepEqual(validateHmiContributePreflightV1(bundle(), mapping(), payload), {
      outcome: "DENIED", reasonCodes: ["HMI_CONTRIBUTE_BINDING_DENIED"],
    });
  }
});

test("HMI-010 requires a mapped selected input", () => {
  const mapped: any = mapping();
  mapped.request.inputDigest = null;
  assert.deepEqual(validateHmiContributePreflightV1(bundle(), mapped, positive()), {
    outcome: "DENIED", reasonCodes: ["HMI_CONTRIBUTE_BINDING_DENIED"],
  });
});

test("HMI-010 denies capability invention and selector widening", () => {
  const widened = positive();
  widened.subjectCapabilityIds = ["cm:describe-system"];
  assert.deepEqual(validateHmiContributePreflightV1(bundle(), mapping(), widened), {
    outcome: "DENIED", reasonCodes: ["HMI_CONTRIBUTE_SUBJECT_DENIED"],
  });
  const mapped: any = mapping();
  mapped.request.selectors = ["cm:describe-system"];
  assert.deepEqual(validateHmiContributePreflightV1(bundle(), mapped, positive()), {
    outcome: "DENIED", reasonCodes: ["HMI_CONTRIBUTE_SUBJECT_DENIED"],
  });
});

test("HMI-010 requires generation-declared local citations", () => {
  for (const citedSourceIds of [[], ["cm:undeclared-source"]]) {
    const payload = positive();
    payload.citedSourceIds = citedSourceIds;
    assert.deepEqual(validateHmiContributePreflightV1(bundle(), mapping(), payload), {
      outcome: "DENIED", reasonCodes: ["HMI_CONTRIBUTE_CITATION_DENIED"],
    });
  }
});

test("HMI-010 denies status, reason, authority and effect widening", () => {
  const cases: readonly [any, string][] = [
    [{ ...positive(), preparationStatus: "READY_TO_SUBMIT" }, "HMI_CONTRIBUTE_PREPARATION_DENIED"],
    [{ ...positive(), preflightReasons: ["PUBLICATION_ROUTE_ABSENT"] }, "HMI_CONTRIBUTE_PREPARATION_DENIED"],
    [{ ...positive(), evidenceStatus: "PRODUCTION" }, "HMI_CONTRIBUTE_PREPARATION_DENIED"],
    [{ ...positive(), authority: { ...positive().authority, writeTargets: ["issue"] } }, "HMI_CONTRIBUTE_AUTHORITY_DENIED"],
    [{ ...positive(), effects: { ...positive().effects, submissionPerformed: true } }, "HMI_CONTRIBUTE_EFFECT_DENIED"],
    [{ ...positive(), effects: { ...positive().effects, publicationPerformed: true } }, "HMI_CONTRIBUTE_EFFECT_DENIED"],
  ];
  for (const [payload, reason] of cases) {
    assert.deepEqual(validateHmiContributePreflightV1(bundle(), mapping(), payload), {
      outcome: "DENIED", reasonCodes: [reason],
    });
  }
});

test("HMI-010 canonical bytes are deterministic, transport-free and effect-free", () => {
  const first = validateHmiContributePreflightV1(bundle(), mapping(), positive());
  const second = validateHmiContributePreflightV1(bundle(), mapping(), positive());
  assert.deepEqual(first, second);
  assert.equal(first.outcome, "ACCEPTED");
  if (first.outcome !== "ACCEPTED") return;
  assert.doesNotMatch(first.canonicalBytes, /SYNTHETIC_CODEX|contribute-preflight-fixture|presentationMode/);
  assert.deepEqual(first.payload.authority, { requestedRights: [], routeIds: [], writeTargets: [] });
  assert.deepEqual(first.payload.effects, { submissionPerformed: false, publicationPerformed: false });
});
