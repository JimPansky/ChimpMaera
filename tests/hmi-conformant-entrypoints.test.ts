import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  HMI_ADAPTER_CONTRACT_VERSION_V1,
  HMI_CORE_VERSION_V1,
  mapHmiHarnessResponseV1,
  type HmiAdapterPinV1,
  type HmiGenerationBundleV1,
} from "../packages/contracts/src/index.js";
import {
  CODEX_HMI_ENTRYPOINT_V1,
  mapCodexHmiEntrypointV1,
} from "../packages/hmi-adapters/src/codex.js";
import {
  OPENCLAW_HMI_ENTRYPOINT_V1,
  mapOpenClawHmiEntrypointV1,
} from "../packages/hmi-adapters/src/openclaw.js";

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

function invocation(operation: "discover" | "explain" | "contribute-preflight") {
  return {
    schemaVersion: "pansphaira.hmi/conformant-entrypoint/v1",
    operation,
    query: `Bounded ${operation}`,
    selectors: operation === "contribute-preflight" ? [] : ["cm:describe-system"],
    selectedInput: operation === "contribute-preflight" ? { goal: "document-only" } : null,
    limits,
    correlation: `hmi-${operation}`,
  };
}

test("HMI-ADAPTER-M0 publishes two inactive zero-authority entrypoint descriptors", () => {
  for (const descriptor of [OPENCLAW_HMI_ENTRYPOINT_V1, CODEX_HMI_ENTRYPOINT_V1]) {
    assert.equal(descriptor.lifecycleState, "DESCRIBED_INACTIVE");
    assert.deepEqual(descriptor.operations, ["discover", "explain", "contribute-preflight"]);
    assert.deepEqual(descriptor.authority, {
      requestedRights: [], routeIds: [], writeTargets: [], networkRoutes: [], externalDependencies: [],
    });
    assert.deepEqual(descriptor.effects, { installPerformed: false, activationPerformed: false, writePerformed: false });
  }
  assert.equal(OPENCLAW_HMI_ENTRYPOINT_V1.harnessId, "OPENCLAW");
  assert.equal(CODEX_HMI_ENTRYPOINT_V1.harnessId, "CODEX");
  assert.equal(Object.isFrozen(OPENCLAW_HMI_ENTRYPOINT_V1), true);
  assert.equal(Object.isFrozen(OPENCLAW_HMI_ENTRYPOINT_V1.operations), true);
  assert.equal(Object.isFrozen(CODEX_HMI_ENTRYPOINT_V1.authority), true);
});

test("HMI-ADAPTER-M0 maps all three allowed operations with cross-harness canonical parity", () => {
  for (const operation of ["discover", "explain", "contribute-preflight"] as const) {
    const openClaw = mapOpenClawHmiEntrypointV1(generation(), pin(), invocation(operation));
    const codex = mapCodexHmiEntrypointV1(generation(), pin(), invocation(operation));
    assert.equal(openClaw.outcome, "MAPPED", operation);
    assert.equal(codex.outcome, "MAPPED", operation);
    if (openClaw.outcome !== "MAPPED" || codex.outcome !== "MAPPED") continue;
    assert.equal(openClaw.canonicalRequestBytes, codex.canonicalRequestBytes, operation);
    assert.equal(openClaw.requestDigest, codex.requestDigest, operation);
    assert.equal(openClaw.request.operation, operation === "contribute-preflight" ? "contribute" : operation);
    assert.equal(openClaw.transportEnvelope.harnessId, "OPENCLAW");
    assert.equal(codex.transportEnvelope.harnessId, "CODEX");
    assert.doesNotMatch(openClaw.canonicalRequestBytes, /OPENCLAW|CODEX|entrypoint-v1|correlation/);
  }
});

test("HMI-ADAPTER-M0 denies unsupported operations, ambient fields, selector widening and missing preflight input", () => {
  assert.deepEqual(mapOpenClawHmiEntrypointV1(generation(), pin(), {
    ...invocation("discover"), operation: "plan",
  }), { outcome: "DENIED", reasonCodes: ["HMI_ENTRYPOINT_OPERATION_DENIED"] });
  assert.deepEqual(mapCodexHmiEntrypointV1(generation(), pin(), {
    ...invocation("explain"), credential: "ambient",
  }), { outcome: "DENIED", reasonCodes: ["HMI_ENTRYPOINT_SCHEMA_DENIED"] });
  assert.deepEqual(mapCodexHmiEntrypointV1(generation(), pin(), {
    ...invocation("explain"), selectors: ["cm:undeclared-capability"],
  }), { outcome: "DENIED", reasonCodes: ["HMI_ENTRYPOINT_SELECTOR_DENIED"] });
  assert.deepEqual(mapOpenClawHmiEntrypointV1(generation(), pin(), {
    ...invocation("contribute-preflight"), selectedInput: null,
  }), { outcome: "DENIED", reasonCodes: ["HMI_ENTRYPOINT_INPUT_DENIED"] });
});

test("HMI-ADAPTER-M0 enforces canonical source and response byte ceilings", () => {
  const bounded = { ...limits, maxSourceBytes: 32, maxOutputBytes: 32 };
  assert.deepEqual(mapOpenClawHmiEntrypointV1(generation(), pin(), {
    ...invocation("contribute-preflight"), limits: bounded, selectedInput: { value: "x".repeat(40) },
  }), { outcome: "DENIED", reasonCodes: ["HMI_ENTRYPOINT_LIMIT_DENIED"] });

  const mapped = mapCodexHmiEntrypointV1(generation(), pin(), {
    ...invocation("discover"), limits: bounded,
  });
  assert.equal(mapped.outcome, "MAPPED");
  if (mapped.outcome !== "MAPPED") return;
  assert.deepEqual(mapHmiHarnessResponseV1(mapped.mapping, { value: "x".repeat(40) }), {
    outcome: "DENIED", reasonCodes: ["HMI_ADAPTER_LIMIT_DENIED"],
  });
});

test("HMI-ADAPTER-M0 remains deterministic and fail-closed on generation drift", () => {
  const first = mapOpenClawHmiEntrypointV1(generation(), pin(), invocation("explain"));
  const second = mapOpenClawHmiEntrypointV1(generation(), pin(), invocation("explain"));
  assert.deepEqual(first, second);
  const drifted = generation() as any;
  drifted.files[0].content += "drift";
  assert.deepEqual(mapOpenClawHmiEntrypointV1(drifted, pin(), invocation("explain")), {
    outcome: "DENIED", reasonCodes: ["HMI_ENTRYPOINT_GENERATION_DENIED"],
  });
});
