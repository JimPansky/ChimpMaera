import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  HMI_ADAPTER_CONTRACT_VERSION_V1,
  HMI_ADAPTER_REQUEST_SCHEMA_V1,
  HMI_CORE_VERSION_V1,
  mapHmiHarnessInvocationV1,
  mapHmiHarnessResponseV1,
  type HmiAdapterPinV1,
  type HmiGenerationBundleV1,
  type HmiOperationV1,
} from "../packages/contracts/src/index.js";

interface GoldenCase {
  readonly caseId: string;
  readonly operation: HmiOperationV1;
  readonly query: string;
  readonly selectors: readonly string[];
  readonly selectedInput: unknown | null;
}

const limits = { maxReferences: 4, maxSourceBytes: 65_536, maxFindings: 200, maxOutputBytes: 16_384 };

function generation(): HmiGenerationBundleV1 {
  return JSON.parse(readFileSync("tests/fixtures/hmi/positive-generation-v1.json", "utf8")) as HmiGenerationBundleV1;
}

function pin(): HmiAdapterPinV1 {
  return {
    coreVersion: HMI_CORE_VERSION_V1,
    adapterContractVersion: HMI_ADAPTER_CONTRACT_VERSION_V1,
    generationDigest: generation().manifest.generationDigest,
  };
}

function invocation(item: GoldenCase, harnessId: "SYNTHETIC_OPENCLAW" | "SYNTHETIC_CODEX") {
  return {
    schemaVersion: HMI_ADAPTER_REQUEST_SCHEMA_V1,
    operation: item.operation,
    query: item.query,
    selectors: item.selectors,
    selectedInput: item.selectedInput,
    limits,
    transport: {
      harnessId,
      adapterVersion: "synthetic-v1",
      invocationCorrelation: harnessId === "SYNTHETIC_OPENCLAW" ? "openclaw-fixture" : "codex-fixture",
      presentationMode: harnessId === "SYNTHETIC_OPENCLAW" ? "MARKDOWN" : "JSON",
    },
  };
}

test("HMI-M2 maps 20/20 golden requests and responses with byte-identical cross-harness semantics", () => {
  const cases = JSON.parse(readFileSync("tests/fixtures/hmi/adapter-golden-v1.json", "utf8")) as GoldenCase[];
  assert.equal(cases.length, 20);
  assert.equal(new Set(cases.map(({ caseId }) => caseId)).size, 20);
  for (const item of cases) {
    const openClaw = mapHmiHarnessInvocationV1(generation(), pin(), invocation(item, "SYNTHETIC_OPENCLAW"));
    const codex = mapHmiHarnessInvocationV1(generation(), pin(), invocation(item, "SYNTHETIC_CODEX"));
    assert.equal(openClaw.outcome, "MAPPED", item.caseId);
    assert.equal(codex.outcome, "MAPPED", item.caseId);
    if (openClaw.outcome !== "MAPPED" || codex.outcome !== "MAPPED") continue;
    assert.equal(openClaw.canonicalRequestBytes, codex.canonicalRequestBytes, item.caseId);
    assert.equal(openClaw.requestDigest, codex.requestDigest, item.caseId);
    const semantic = { caseId: item.caseId, complete: true, citations: ["cm:hmi-source-001"], reasonCodes: [] };
    const openClawResponse = mapHmiHarnessResponseV1(openClaw, semantic);
    const codexResponse = mapHmiHarnessResponseV1(codex, semantic);
    assert.equal(openClawResponse.outcome, "MAPPED", item.caseId);
    assert.deepEqual(
      openClawResponse.outcome === "MAPPED" && {
        bytes: openClawResponse.canonicalResponseBytes,
        digest: openClawResponse.responseDigest,
      },
      codexResponse.outcome === "MAPPED" && {
        bytes: codexResponse.canonicalResponseBytes,
        digest: codexResponse.responseDigest,
      },
      item.caseId,
    );
  }
});

test("HMI-M2 keeps harness transport outside canonical semantic bytes", () => {
  const item = (JSON.parse(readFileSync("tests/fixtures/hmi/adapter-golden-v1.json", "utf8")) as GoldenCase[])[0]!;
  const mapped = mapHmiHarnessInvocationV1(generation(), pin(), invocation(item, "SYNTHETIC_OPENCLAW"));
  assert.equal(mapped.outcome, "MAPPED");
  if (mapped.outcome !== "MAPPED") return;
  assert.doesNotMatch(mapped.canonicalRequestBytes, /OPENCLAW|openclaw-fixture|MARKDOWN/);
  assert.equal(Buffer.byteLength(JSON.stringify(mapped.transportEnvelope), "utf8") < 8_192, true);
  assert.deepEqual(Object.keys(mapped.request), [
    "schemaVersion", "operation", "generationDigest", "adapterContractVersion", "query", "selectors", "inputDigest", "limits",
  ]);
});

test("HMI-M2 canonicalizes selector sets and denies selector grammar drift", () => {
  const item = (JSON.parse(readFileSync("tests/fixtures/hmi/adapter-golden-v1.json", "utf8")) as GoldenCase[])[0]!;
  const left = mapHmiHarnessInvocationV1(generation(), pin(), {
    ...invocation(item, "SYNTHETIC_OPENCLAW"), selectors: ["cm:beta-capability", "cm:alpha-capability"],
  });
  const right = mapHmiHarnessInvocationV1(generation(), pin(), {
    ...invocation(item, "SYNTHETIC_CODEX"), selectors: ["cm:alpha-capability", "cm:beta-capability"],
  });
  assert.equal(left.outcome, "MAPPED");
  assert.equal(right.outcome, "MAPPED");
  if (left.outcome !== "MAPPED" || right.outcome !== "MAPPED") return;
  assert.deepEqual(left.request.selectors, ["cm:alpha-capability", "cm:beta-capability"]);
  assert.equal(left.canonicalRequestBytes, right.canonicalRequestBytes);
  assert.equal(left.requestDigest, right.requestDigest);
  assert.deepEqual(mapHmiHarnessInvocationV1(generation(), pin(), {
    ...invocation(item, "SYNTHETIC_CODEX"), selectors: ["cm::invalid"],
  }), { outcome: "DENIED", reasonCodes: ["HMI_ADAPTER_INPUT_DENIED"] });
});

test("HMI-M2 denies unknown operations and ambient authority fields before mapping", () => {
  const item = (JSON.parse(readFileSync("tests/fixtures/hmi/adapter-golden-v1.json", "utf8")) as GoldenCase[])[0]!;
  const unknown = { ...invocation(item, "SYNTHETIC_CODEX"), operation: "execute" };
  assert.deepEqual(mapHmiHarnessInvocationV1(generation(), pin(), unknown), {
    outcome: "DENIED", reasonCodes: ["HMI_ADAPTER_OPERATION_DENIED"],
  });
  const ambient = { ...invocation(item, "SYNTHETIC_OPENCLAW"), credential: "ambient" };
  assert.deepEqual(mapHmiHarnessInvocationV1(generation(), pin(), ambient), {
    outcome: "DENIED", reasonCodes: ["HMI_ADAPTER_SCHEMA_DENIED"],
  });
});

test("HMI-M2 denies stale pins, widened limits, invalid transport, and non-JSON input", () => {
  const item = (JSON.parse(readFileSync("tests/fixtures/hmi/adapter-golden-v1.json", "utf8")) as GoldenCase[])[0]!;
  assert.deepEqual(mapHmiHarnessInvocationV1(generation(), { ...pin(), generationDigest: "f".repeat(64) }, invocation(item, "SYNTHETIC_CODEX")), {
    outcome: "DENIED", reasonCodes: ["HMI_ADAPTER_PIN_DENIED"],
  });
  assert.deepEqual(mapHmiHarnessInvocationV1(generation(), pin(), {
    ...invocation(item, "SYNTHETIC_CODEX"), limits: { ...limits, maxReferences: 5 },
  }), { outcome: "DENIED", reasonCodes: ["HMI_ADAPTER_LIMIT_DENIED"] });
  assert.deepEqual(mapHmiHarnessInvocationV1(generation(), pin(), {
    ...invocation(item, "SYNTHETIC_CODEX"), transport: { ...invocation(item, "SYNTHETIC_CODEX").transport, adapterVersion: "latest" },
  }), { outcome: "DENIED", reasonCodes: ["HMI_ADAPTER_SCHEMA_DENIED"] });
  assert.deepEqual(mapHmiHarnessInvocationV1(generation(), pin(), {
    ...invocation(item, "SYNTHETIC_CODEX"), selectedInput: { invalid: Number.NaN },
  }), { outcome: "DENIED", reasonCodes: ["HMI_ADAPTER_INPUT_DENIED"] });
});

test("HMI-M2 denies adapter use when the pinned generation no longer verifies", () => {
  const item = (JSON.parse(readFileSync("tests/fixtures/hmi/adapter-golden-v1.json", "utf8")) as GoldenCase[])[0]!;
  const drifted = generation() as any;
  drifted.files[0].content += "drift";
  assert.deepEqual(mapHmiHarnessInvocationV1(drifted, pin(), invocation(item, "SYNTHETIC_OPENCLAW")), {
    outcome: "DENIED", reasonCodes: ["HMI_ADAPTER_GENERATION_DENIED"],
  });
});
