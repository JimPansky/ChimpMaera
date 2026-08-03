import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  HMI_ADAPTER_CONTRACT_VERSION_V1,
  HMI_ADAPTER_REQUEST_SCHEMA_V1,
  HMI_CORE_VERSION_V1,
  HMI_DISCLOSURE_CLAIM_BOUNDARY_V1,
  HMI_DISCLOSURE_SCHEMA_V1,
  mapHmiHarnessInvocationV1,
  projectHmiDisclosureV1,
  type HmiAdapterMappingV1,
  type HmiDisclosureTierV1,
  type HmiGenerationBundleV1,
  type HmiOperationV1,
} from "../packages/contracts/src/index.js";

const operations: readonly HmiOperationV1[] = ["discover", "explain", "plan", "handoff", "validate", "contribute"];
const tiers: readonly HmiDisclosureTierV1[] = ["SUMMARY", "DETAIL", "EVIDENCE"];
const limits = { maxReferences: 4, maxSourceBytes: 65_536, maxFindings: 200, maxOutputBytes: 16_384 };

function generation(): HmiGenerationBundleV1 {
  return JSON.parse(readFileSync("tests/fixtures/hmi/positive-generation-v1.json", "utf8")) as HmiGenerationBundleV1;
}

function mapping(
  operation: HmiOperationV1 = "explain",
  requestLimits: typeof limits = limits,
): HmiAdapterMappingV1 {
  const bundle = generation();
  return mapHmiHarnessInvocationV1(bundle, {
    coreVersion: HMI_CORE_VERSION_V1,
    adapterContractVersion: HMI_ADAPTER_CONTRACT_VERSION_V1,
    generationDigest: bundle.manifest.generationDigest,
  }, {
    schemaVersion: HMI_ADAPTER_REQUEST_SCHEMA_V1,
    operation,
    query: `Synthetic ${operation} request`,
    selectors: ["cm:describe-system"],
    selectedInput: null,
    limits: requestLimits,
    transport: {
      harnessId: "SYNTHETIC_CODEX",
      adapterVersion: "synthetic-v1",
      invocationCorrelation: "disclosure-fixture",
      presentationMode: "JSON",
    },
  });
}

function input(bound: HmiAdapterMappingV1, requestedTier: HmiDisclosureTierV1 = "EVIDENCE") {
  assert.equal(bound.outcome, "MAPPED");
  if (bound.outcome !== "MAPPED") throw new Error("expected mapped fixture");
  return {
    schemaVersion: HMI_DISCLOSURE_SCHEMA_V1,
    operation: bound.request.operation,
    requestDigest: bound.requestDigest,
    generationDigest: bound.request.generationDigest,
    requestedTier,
    maxItems: 16,
    items: [
      {
        itemId: "cm:summary-001", tier: "SUMMARY", text: "Synthetic summary with bounded local claims.",
        sourceIds: [], evidenceDigest: null, contentClass: "PUBLIC_SYNTHETIC", claimStatus: "LOCAL_SYNTHETIC",
      },
      {
        itemId: "cm:detail-001", tier: "DETAIL", text: "Deterministic detail derived from a public-safe fixture.",
        sourceIds: ["cm:hmi-source-001"], evidenceDigest: null,
        contentClass: "PUBLIC_SYNTHETIC", claimStatus: "LOCAL_SYNTHETIC",
      },
      {
        itemId: "cm:evidence-001", tier: "EVIDENCE", text: "Local synthetic evidence; no release or runtime claim.",
        sourceIds: ["cm:hmi-source-001"], evidenceDigest: "a".repeat(64),
        contentClass: "PUBLIC_SYNTHETIC", claimStatus: "LOCAL_SYNTHETIC",
      },
    ],
    authority: { requestedRights: [], routeIds: [], writeTargets: [] },
  };
}

test("HMI-M3 publishes the closed 6-operation by 3-tier progressive-disclosure matrix", () => {
  let checked = 0;
  for (const operation of operations) {
    for (const tier of tiers) {
      const result = projectHmiDisclosureV1(mapping(operation), input(mapping(operation), tier));
      assert.equal(result.outcome, "PUBLISHED", `${operation}:${tier}`);
      if (result.outcome !== "PUBLISHED") continue;
      const expectedCount = tiers.indexOf(tier) + 1;
      assert.equal(result.disclosure.items.length, expectedCount, `${operation}:${tier}`);
      assert.deepEqual(result.disclosure.items.map((item) => item.tier), tiers.slice(0, expectedCount));
      assert.equal(result.disclosure.omittedCount, 3 - expectedCount);
      assert.equal(result.disclosure.claimBoundary, HMI_DISCLOSURE_CLAIM_BOUNDARY_V1);
      assert.doesNotMatch(result.canonicalBytes, /SYNTHETIC_CODEX|disclosure-fixture/);
      checked += 1;
    }
  }
  assert.equal(checked, 18);
});

test("HMI-M3 is deterministic, non-mutating, canonically ordered and max-item bounded", () => {
  const bound = mapping();
  const supplied = input(bound);
  supplied.maxItems = 2;
  supplied.items.reverse();
  const before = structuredClone(supplied);
  const first = projectHmiDisclosureV1(bound, supplied);
  const second = projectHmiDisclosureV1(bound, structuredClone(supplied));
  assert.deepEqual(first, second);
  assert.deepEqual(supplied, before);
  assert.equal(first.outcome, "PUBLISHED");
  if (first.outcome !== "PUBLISHED") return;
  assert.deepEqual(first.disclosure.items.map((item) => item.tier), ["SUMMARY", "DETAIL"]);
  assert.equal(first.disclosure.omittedCount, 1);
  assert.equal(Buffer.byteLength(first.canonicalBytes, "utf8") < limits.maxOutputBytes, true);
});

test("HMI-M3 enforces the exact mapped findings, references and output-byte limits", () => {
  const findingBound = mapping("explain", { ...limits, maxFindings: 2 });
  const tooManyFindings = input(findingBound);
  tooManyFindings.maxItems = 2;
  assert.deepEqual(projectHmiDisclosureV1(findingBound, tooManyFindings), {
    outcome: "DENIED", reasonCodes: ["HMI_DISCLOSURE_LIMIT_DENIED"],
  });

  const referenceBound = mapping("explain", { ...limits, maxReferences: 1 });
  const tooManyReferences = input(referenceBound);
  tooManyReferences.items[1]!.sourceIds = ["cm:hmi-source-002"];
  assert.deepEqual(projectHmiDisclosureV1(referenceBound, tooManyReferences), {
    outcome: "DENIED", reasonCodes: ["HMI_DISCLOSURE_LIMIT_DENIED"],
  });

  const baselineMapping = mapping();
  const baseline = projectHmiDisclosureV1(baselineMapping, input(baselineMapping));
  assert.equal(baseline.outcome, "PUBLISHED");
  if (baseline.outcome !== "PUBLISHED") return;
  const byteLimit = Buffer.byteLength(baseline.canonicalBytes, "utf8") - 1;
  const outputBound = mapping("explain", { ...limits, maxOutputBytes: byteLimit });
  assert.deepEqual(projectHmiDisclosureV1(outputBound, input(outputBound)), {
    outcome: "DENIED", reasonCodes: ["HMI_DISCLOSURE_LIMIT_DENIED"],
  });
});

test("HMI-M3 denies unbound, stale, unknown-operation and ambient-authority disclosures", () => {
  const bound = mapping();
  const deniedMapping: HmiAdapterMappingV1 = { outcome: "DENIED", reasonCodes: ["HMI_ADAPTER_PIN_DENIED"] };
  assert.deepEqual(projectHmiDisclosureV1(deniedMapping, input(bound)), {
    outcome: "DENIED", reasonCodes: ["HMI_DISCLOSURE_BINDING_DENIED"],
  });
  assert.deepEqual(projectHmiDisclosureV1(bound, { ...input(bound), requestDigest: "f".repeat(64) }), {
    outcome: "DENIED", reasonCodes: ["HMI_DISCLOSURE_BINDING_DENIED"],
  });
  assert.deepEqual(projectHmiDisclosureV1(bound, { ...input(bound), operation: "execute" }), {
    outcome: "DENIED", reasonCodes: ["HMI_DISCLOSURE_OPERATION_DENIED"],
  });
  assert.deepEqual(projectHmiDisclosureV1(bound, {
    ...input(bound), authority: { requestedRights: ["cm:write"], routeIds: [], writeTargets: [] },
  }), { outcome: "DENIED", reasonCodes: ["HMI_DISCLOSURE_AUTHORITY_DENIED"] });
});

test("HMI-M3 denies credential, identity, private-path, host-inventory and job-id content without reflection", () => {
  const probes = [
    "Authorization: Bearer synthetic-token",
    "password=synthetic-password",
    "Contact operator@example.test for details.",
    `Inspect ${["", "home", "operator", "private", "config.json"].join("/")}.`,
    "Connect to 192.168.4.20 for status.",
    "job_id=private-job-001",
  ];
  for (const text of probes) {
    const supplied = input(mapping());
    supplied.items[0]!.text = text;
    const result = projectHmiDisclosureV1(mapping(), supplied);
    assert.deepEqual(result, { outcome: "DENIED", reasonCodes: ["HMI_DISCLOSURE_CONTENT_DENIED"] });
    assert.doesNotMatch(JSON.stringify(result), new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("HMI-M3 denies provenance, tier, schema and aggregate-size drift", () => {
  const missingEvidence = input(mapping());
  missingEvidence.items[2]!.evidenceDigest = null;
  assert.deepEqual(projectHmiDisclosureV1(mapping(), missingEvidence), {
    outcome: "DENIED", reasonCodes: ["HMI_DISCLOSURE_PROVENANCE_DENIED"],
  });
  assert.deepEqual(projectHmiDisclosureV1(mapping(), { ...input(mapping()), requestedTier: "RAW" }), {
    outcome: "DENIED", reasonCodes: ["HMI_DISCLOSURE_TIER_DENIED"],
  });
  assert.deepEqual(projectHmiDisclosureV1(mapping(), { ...input(mapping()), transport: {} }), {
    outcome: "DENIED", reasonCodes: ["HMI_DISCLOSURE_SCHEMA_DENIED"],
  });
  assert.deepEqual(projectHmiDisclosureV1(mapping(), { ...input(mapping()), maxItems: 17 }), {
    outcome: "DENIED", reasonCodes: ["HMI_DISCLOSURE_LIMIT_DENIED"],
  });
  const oversized = input(mapping());
  oversized.items = Array.from({ length: 17 }, (_, index) => ({
    itemId: `cm:detail-${String(index).padStart(3, "0")}`,
    tier: "DETAIL" as const,
    text: "x".repeat(1_024),
    sourceIds: ["cm:hmi-source-001"],
    evidenceDigest: null,
    contentClass: "PUBLIC_SYNTHETIC" as const,
    claimStatus: "LOCAL_SYNTHETIC" as const,
  }));
  assert.deepEqual(projectHmiDisclosureV1(mapping(), oversized), {
    outcome: "DENIED", reasonCodes: ["HMI_DISCLOSURE_LIMIT_DENIED"],
  });
});
