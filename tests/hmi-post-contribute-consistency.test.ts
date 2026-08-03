import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  HMI_ADAPTER_CONTRACT_VERSION_V1,
  HMI_ADAPTER_REQUEST_SCHEMA_V1,
  HMI_CORE_VERSION_V1,
  HMI_DISCLOSURE_SCHEMA_V1,
  mapHmiHarnessInvocationV1,
  projectHmiDisclosureV1,
  validateHmiContributePreflightV1,
  type HmiAdapterMappingV1,
  type HmiGenerationBundleV1,
} from "../packages/contracts/src/index.js";

const limits = { maxReferences: 4, maxSourceBytes: 65_536, maxFindings: 200, maxOutputBytes: 16_384 };
const load = (path: string) => JSON.parse(readFileSync(path, "utf8"));

function bundle(): HmiGenerationBundleV1 {
  return load("tests/fixtures/hmi/positive-generation-v1.json") as HmiGenerationBundleV1;
}

function mapping(index: 16 | 17 = 16): HmiAdapterMappingV1 {
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
    transport: {
      harnessId: "SYNTHETIC_CODEX",
      adapterVersion: "synthetic-v1",
      invocationCorrelation: "post-contribute-audit",
      presentationMode: "JSON",
    },
  });
}

function preflight(bound: HmiAdapterMappingV1 = mapping()): any {
  assert.equal(bound.outcome, "MAPPED");
  if (bound.outcome !== "MAPPED") throw new Error("expected mapped contribute fixture");
  return {
    ...load("tests/fixtures/hmi/positive-contribute-preflight-v1.json"),
    requestDigest: bound.requestDigest,
    inputDigest: bound.request.inputDigest,
    generationDigest: bound.request.generationDigest,
  };
}

function disclosure(bound: HmiAdapterMappingV1, citedSourceIds: readonly string[]): any {
  assert.equal(bound.outcome, "MAPPED");
  if (bound.outcome !== "MAPPED") throw new Error("expected mapped contribute fixture");
  return {
    schemaVersion: HMI_DISCLOSURE_SCHEMA_V1,
    operation: "contribute",
    requestDigest: bound.requestDigest,
    generationDigest: bound.request.generationDigest,
    requestedTier: "EVIDENCE",
    maxItems: 2,
    items: [
      {
        itemId: "cm:contribute-summary-001",
        tier: "SUMMARY",
        text: "Contribution capability and publication route remain unavailable.",
        sourceIds: [],
        evidenceDigest: null,
        contentClass: "PUBLIC_SYNTHETIC",
        claimStatus: "LOCAL_SYNTHETIC",
      },
      {
        itemId: "cm:contribute-evidence-001",
        tier: "EVIDENCE",
        text: "Preparation-only evidence is bound to the checked synthetic generation.",
        sourceIds: [...citedSourceIds],
        evidenceDigest: "a".repeat(64),
        contentClass: "PUBLIC_SYNTHETIC",
        claimStatus: "LOCAL_SYNTHETIC",
      },
    ],
    authority: { requestedRights: [], routeIds: [], writeTargets: [] },
  };
}

test("HMI-011 both contribute intents remain preparation-only and capability-free", () => {
  for (const index of [16, 17] as const) {
    const bound = mapping(index);
    const accepted = validateHmiContributePreflightV1(bundle(), bound, preflight(bound));
    assert.equal(accepted.outcome, "ACCEPTED");
    if (accepted.outcome !== "ACCEPTED" || bound.outcome !== "MAPPED") continue;
    assert.equal(accepted.payload.operation, bound.request.operation);
    assert.equal(accepted.payload.requestDigest, bound.requestDigest);
    assert.equal(accepted.payload.inputDigest, bound.request.inputDigest);
    assert.deepEqual(accepted.payload.subjectCapabilityIds, bound.request.selectors);
    assert.equal(accepted.payload.preparationStatus, "PREPARATION_ONLY");
  }
});

test("HMI-011 preflight and disclosure preserve generation provenance and zero authority", () => {
  const bound = mapping();
  const accepted = validateHmiContributePreflightV1(bundle(), bound, preflight(bound));
  assert.equal(accepted.outcome, "ACCEPTED");
  if (accepted.outcome !== "ACCEPTED") return;
  const generationSourceIds = new Set(bundle().manifest.provenance.map((item) => item.sourceId));
  assert.equal(accepted.payload.citedSourceIds.every((item) => generationSourceIds.has(item)), true);

  const published = projectHmiDisclosureV1(bound, disclosure(bound, accepted.payload.citedSourceIds));
  assert.equal(published.outcome, "PUBLISHED");
  if (published.outcome !== "PUBLISHED") return;
  assert.equal(published.disclosure.requestDigest, accepted.payload.requestDigest);
  assert.equal(published.disclosure.generationDigest, accepted.payload.generationDigest);
  assert.deepEqual(published.disclosure.authority, accepted.payload.authority);
  assert.deepEqual(published.disclosure.items[1]?.sourceIds, accepted.payload.citedSourceIds);
});

test("HMI-011 stale binding and invented provenance fail closed across contracts", () => {
  const bound = mapping();
  const stale = preflight(bound);
  stale.requestDigest = "f".repeat(64);
  assert.deepEqual(validateHmiContributePreflightV1(bundle(), bound, stale), {
    outcome: "DENIED", reasonCodes: ["HMI_CONTRIBUTE_BINDING_DENIED"],
  });

  const invented = preflight(bound);
  invented.citedSourceIds = ["cm:invented-source"];
  assert.deepEqual(validateHmiContributePreflightV1(bundle(), bound, invented), {
    outcome: "DENIED", reasonCodes: ["HMI_CONTRIBUTE_CITATION_DENIED"],
  });

  const staleDisclosure = disclosure(bound, ["cm:hmi-source-001"]);
  staleDisclosure.generationDigest = "f".repeat(64);
  assert.deepEqual(projectHmiDisclosureV1(bound, staleDisclosure), {
    outcome: "DENIED", reasonCodes: ["HMI_DISCLOSURE_BINDING_DENIED"],
  });
});

test("HMI-011 authority and publication claims cannot widen through preflight or disclosure", () => {
  const bound = mapping();
  const widened = preflight(bound);
  widened.effects.publicationPerformed = true;
  assert.deepEqual(validateHmiContributePreflightV1(bundle(), bound, widened), {
    outcome: "DENIED", reasonCodes: ["HMI_CONTRIBUTE_EFFECT_DENIED"],
  });

  const claimed = disclosure(bound, ["cm:hmi-source-001"]);
  claimed.submissionPerformed = true;
  assert.deepEqual(projectHmiDisclosureV1(bound, claimed), {
    outcome: "DENIED", reasonCodes: ["HMI_DISCLOSURE_SCHEMA_DENIED"],
  });

  const accepted = validateHmiContributePreflightV1(bundle(), bound, preflight(bound));
  assert.equal(accepted.outcome, "ACCEPTED");
  if (accepted.outcome !== "ACCEPTED") return;
  assert.deepEqual(accepted.payload.effects, { submissionPerformed: false, publicationPerformed: false });
  assert.doesNotMatch(accepted.canonicalBytes, /SYNTHETIC_CODEX|post-contribute-audit|READY_TO_SUBMIT/);
});
