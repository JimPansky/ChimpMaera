import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  POC_SETUP_COMPATIBILITY_REQUEST_API_VERSION,
  PocSetupCompatibilityError,
  analyzePocSetupCompatibilityV1,
  applyPocEarlyAdminRepairV1,
  buildPocEarlyAdminRepairPlanV1,
  buildPocEarlyAdminStatusV1,
  buildPocGuidedDemoCleanupReceiptV1,
  buildPocGuidedDemoSetupReceiptV1,
  buildPocSetupCompatibilityPlanV1,
  defaultPocSetupCompatibilityRequestV1,
  expectedPocGuidedDemoTemplatesV1,
  resumePocEarlyAdminSetupV1,
  runPocEarlyAdminSyntheticSetupV1,
  sealPocSetupCompatibilityCatalogV1,
  validatePocSetupCompatibilityCatalogV1,
  verifyPocGuidedDemoSetupReceiptV1,
  verifyPocSetupCompatibilityPlanV1,
  type PocSetupCompatibilityCatalogV1,
  type PocSetupCompatibilityRequestV1,
  type PocShowcaseV1,
} from "../packages/contracts/src/index.js";

const catalog = validatePocSetupCompatibilityCatalogV1(JSON.parse(
  readFileSync("examples/poc-setup-planner/catalog-v1.json", "utf8"),
) as PocSetupCompatibilityCatalogV1);
const showcase = JSON.parse(
  readFileSync("examples/poc-release/showcase-v1.json", "utf8"),
) as PocShowcaseV1;
const guided = expectedPocGuidedDemoTemplatesV1();

function request(
  overrides: Partial<PocSetupCompatibilityRequestV1> = {},
): PocSetupCompatibilityRequestV1 {
  return {
    ...defaultPocSetupCompatibilityRequestV1(catalog),
    ...overrides,
  };
}

function reseal(
  mutate: (value: any) => void,
): PocSetupCompatibilityCatalogV1 {
  const value: any = structuredClone(catalog);
  mutate(value);
  return sealPocSetupCompatibilityCatalogV1(value);
}

test("SETUP-PLANNER-DEFAULT Enter path reaches all six synthetic use cases with shared components", () => {
  const safeDefault = defaultPocSetupCompatibilityRequestV1(catalog);
  const analysis = analyzePocSetupCompatibilityV1(catalog, safeDefault);
  assert.equal(safeDefault.frontdoorPath, "RECOMMENDED_DEMO");
  assert.equal(safeDefault.baseTemplateId, "quick-tour");
  assert.equal(analysis.useCases.length, 6);
  assert.deepEqual(
    [...new Set(analysis.useCases.map(({ status }) => status))],
    ["READY_SIMULATED"],
  );
  assert.equal(
    analysis.selectedComponentIds.filter((id) =>
      id === "core.safe-control-plane"
    ).length,
    1,
  );
  assert.equal(
    analysis.selectedComponentIds.filter((id) => id === "simulator.shared-poc")
      .length,
    1,
  );
  const plan = verifyPocSetupCompatibilityPlanV1(
    buildPocSetupCompatibilityPlanV1(showcase, guided, catalog, safeDefault),
  );
  assert.equal(plan.frontdoor.enterAcceptsSafeRecommendedDefaults, true);
  assert.equal(plan.frontdoor.baseTemplateSelection, "SINGLE_SELECT");
  assert.equal(plan.frontdoor.additionalComponentsSelection, "CHECKBOX_MULTI_SELECT");
  assert.equal(plan.authorityBinding.activeDuringPlanning, "SAFE_GUIDED");
  assert.equal(plan.authorityBinding.catalogTrustTier, "CURATED_VERIFIED");
  assert.equal(
    plan.guidedSetupPlan.template.trustTier,
    "CATALOG_CURATED_VERIFIED",
  );
  assert.equal(plan.guidedSetupPlan.template.informedConfirmationRequired, false);
  assert.match(plan.planDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(plan.guidedSetupPlan.planDigest, /^sha256:[a-f0-9]{64}$/);
});

test("SETUP-PLANNER-USE-CASE-FIRST resolves AND dependencies and selectable OR providers", () => {
  const real = request({
    selectedUseCaseIds: ["POC-UC-001", "POC-UC-002"],
    executionPreference: "REAL_PREFERRED",
    providerSelections: {
      "forge-provider": "provider.forge-alternative",
    },
  });
  const analysis = analyzePocSetupCompatibilityV1(catalog, real);
  assert.deepEqual(
    analysis.useCases.map(({ status }) => status),
    ["READY_REAL", "READY_REAL"],
  );
  assert.ok(analysis.selectedComponentIds.includes("provider.forge-alternative"));
  assert.ok(!analysis.selectedComponentIds.includes("provider.forge-local"));
  assert.ok(analysis.selectedComponentIds.includes("provider.document-local"));
  assert.ok(analysis.selectedComponentIds.includes("runtime.node"));
  assert.ok(analysis.automaticallyAdded.some(({ reason }) =>
    reason.includes("required by core.safe-control-plane")
  ));
});

test("SETUP-PLANNER-SYSTEM-FIRST distinguishes missing, simulated and bundle completion", () => {
  const emptyBase = reseal((value) => {
    const quick = value.baseTemplates.find((item: any) =>
      item.templateId === "quick-tour"
    )!;
    (quick.defaultComponentIds as string[]) = [];
  });
  const missing = analyzePocSetupCompatibilityV1(emptyBase, request({
    mode: "SYSTEM_FIRST",
    selectedUseCaseIds: [],
    selectedComponentIds: [],
    executionPreference: "REAL_PREFERRED",
    completeBundle: false,
  }));
  assert.equal(
    missing.useCases.find(({ useCaseId }) => useCaseId === "POC-UC-001")!
      .status,
    "PARTIAL_MISSING",
  );
  assert.ok(
    missing.useCases.find(({ useCaseId }) => useCaseId === "POC-UC-001")!
      .missingRequirements.includes(
        "component:core.safe-control-plane@>=1.0.0 <2.0.0",
      ),
  );
  const simulated = analyzePocSetupCompatibilityV1(catalog, request({
    mode: "SYSTEM_FIRST",
    selectedUseCaseIds: [],
    selectedComponentIds: ["simulator.shared-poc"],
    completeBundle: false,
  }));
  assert.ok(simulated.useCases.every(({ status }) =>
    status === "READY_SIMULATED"
  ));
  const completed = analyzePocSetupCompatibilityV1(emptyBase, request({
    mode: "SYSTEM_FIRST",
    selectedUseCaseIds: ["POC-UC-001"],
    selectedComponentIds: [],
    completeBundle: true,
    providerSelections: {
      "forge-provider": "provider.forge-alternative",
    },
  }));
  assert.equal(
    completed.useCases.find(({ useCaseId }) => useCaseId === "POC-UC-001")!
      .status,
    "READY_REAL",
  );
  assert.ok(completed.automaticallyAdded.some(({ reason }) =>
    reason === "bundle completion for POC-UC-001"
  ));
});

test("SETUP-PLANNER-INCOMPATIBILITY overrides apparent provider readiness", () => {
  const analysis = analyzePocSetupCompatibilityV1(catalog, request({
    selectedUseCaseIds: ["POC-UC-001"],
    selectedComponentIds: ["tool.legacy-unsafe-network"],
    executionPreference: "REAL_PREFERRED",
  }));
  assert.equal(analysis.useCases[0]!.status, "INCOMPATIBLE");
  assert.ok(analysis.useCases[0]!.incompatibleReasons.some((reason) =>
    reason.includes("tool.legacy-unsafe-network")
  ));
  assert.deepEqual(analysis.resources.networkAccess, ["https://unsafe.invalid"]);
  assert.ok(analysis.resources.effects.includes("unbounded_network_probe"));
});

test("SETUP-PLANNER-CUSTOM accepts sealed declared catalogs but never activates requested Full Control", () => {
  const custom = reseal((value) => {
    value.provenance.source = "CUSTOM";
    value.provenance.label = "Local owner-supplied test catalog";
    value.provenance.trustTier = "CUSTOM_UNVERIFIED";
    value.provenance.rights = "Apache-2.0";
    value.provenance.manifestPath = "catalogs/local-owner-test.json";
    const quick = value.baseTemplates.find((item: any) => item.recommended)!;
    quick.templateId = "owner-starter";
    quick.requestedAuthorityProfile = "FULL_CONTROL_LAB";
  });
  validatePocSetupCompatibilityCatalogV1(custom);
  const customRequest = request({
    frontdoorPath: "LOAD_CUSTOM_OR_COMMUNITY",
    baseTemplateId: "owner-starter",
    authorityProfile: "FULL_CONTROL_LAB",
  });
  const plan = buildPocSetupCompatibilityPlanV1(
    showcase,
    guided,
    custom,
    customRequest,
  );
  assert.equal(plan.authorityBinding.requested, "FULL_CONTROL_LAB");
  assert.equal(plan.authorityBinding.activeDuringPlanning, "SAFE_GUIDED");
  assert.equal(plan.authorityBinding.catalogTrustTier, "CUSTOM_UNVERIFIED");
  assert.equal(plan.guidedSetupPlan.template.trustTier, "CUSTOM_LOCAL_UNVERIFIED");
  assert.equal(plan.guidedSetupPlan.template.informedConfirmationRequired, true);
  const status = buildPocEarlyAdminStatusV1(plan.guidedSetupPlan);
  assert.equal(status.authority.profile.profileId, "SAFE_GUIDED");
});

test("SETUP-PLANNER-COMMUNITY preserves unverified trust without narrowing the open catalog path", () => {
  const community = reseal((value) => {
    value.provenance.source = "COMMUNITY";
    value.provenance.label = "Repository-local community fixture";
    value.provenance.trustTier = "COMMUNITY_UNVERIFIED";
    value.provenance.manifestPath = "catalogs/community-fixture.json";
  });
  const plan = buildPocSetupCompatibilityPlanV1(
    showcase,
    guided,
    community,
    request({ frontdoorPath: "LOAD_CUSTOM_OR_COMMUNITY" }),
  );
  assert.equal(plan.authorityBinding.catalogTrustTier, "COMMUNITY_UNVERIFIED");
  assert.equal(
    plan.guidedSetupPlan.template.trustTier,
    "COMMUNITY_LOCAL_UNVERIFIED",
  );
  assert.equal(plan.guidedSetupPlan.template.informedConfirmationRequired, true);
});

test("SETUP-PLANNER-NEG rejects unknown schema, tampering, undeclared capability and traversal", () => {
  const unknown = structuredClone(catalog) as unknown as Record<string, unknown>;
  unknown.apiVersion = "chimpmaera.dev/poc-setup-compatibility-catalog/v2";
  assert.throws(
    () => validatePocSetupCompatibilityCatalogV1(
      unknown as unknown as PocSetupCompatibilityCatalogV1,
    ),
    (error: unknown) => error instanceof PocSetupCompatibilityError,
  );
  const tampered: any = structuredClone(catalog);
  tampered.components[0]!.displayName = "tampered";
  assert.throws(
    () => validatePocSetupCompatibilityCatalogV1(tampered),
    /CATALOG_SCHEMA_OR_DIGEST_INVALID/,
  );
  const undeclared: any = structuredClone(catalog);
  (undeclared.components[0]!.capabilityIds as string[]).push(
    "capability.undeclared",
  );
  const sealedUndeclared = sealPocSetupCompatibilityCatalogV1(undeclared);
  assert.throws(
    () => validatePocSetupCompatibilityCatalogV1(sealedUndeclared),
    /COMPONENT_SCHEMA_OR_CAPABILITY_INVALID/,
  );
  const traversal: any = structuredClone(catalog);
  traversal.provenance.manifestPath = "catalogs/../private/escape.json";
  const sealedTraversal = sealPocSetupCompatibilityCatalogV1(traversal);
  assert.throws(
    () => validatePocSetupCompatibilityCatalogV1(sealedTraversal),
    /CATALOG_PATH_TRAVERSAL_DENIED/,
  );
});

test("SETUP-PLANNER-NEG rejects unknown selections, invalid alternatives, incompatible plans and digest drift", () => {
  assert.throws(
    () => analyzePocSetupCompatibilityV1(catalog, request({
      baseTemplateId: "missing-template",
    })),
    /UNKNOWN_BASE_TEMPLATE/,
  );
  assert.throws(
    () => analyzePocSetupCompatibilityV1(catalog, request({
      selectedComponentIds: ["missing-component"],
    })),
    /UNKNOWN_COMPONENT/,
  );
  assert.throws(
    () => analyzePocSetupCompatibilityV1(catalog, request({
      selectedUseCaseIds: ["POC-UC-001"],
      providerSelections: { "forge-provider": "provider.document-local" },
      executionPreference: "REAL_PREFERRED",
    })),
    /PROVIDER_ALTERNATIVE_NOT_ALLOWED/,
  );
  const incompatibleRequest = request({
    selectedUseCaseIds: ["POC-UC-001"],
    selectedComponentIds: ["tool.legacy-unsafe-network"],
    executionPreference: "REAL_PREFERRED",
  });
  assert.throws(
    () => buildPocSetupCompatibilityPlanV1(
      showcase,
      guided,
      catalog,
      incompatibleRequest,
    ),
    /SELECTED_USE_CASE_BUNDLE_NOT_EXECUTABLE/,
  );
  const valid = buildPocSetupCompatibilityPlanV1(
    showcase,
    guided,
    catalog,
    defaultPocSetupCompatibilityRequestV1(catalog),
  );
  const alteredPlan: any = structuredClone(valid);
  alteredPlan.lifecycle.healthBeforeDemo = false;
  assert.throws(
    () => verifyPocSetupCompatibilityPlanV1(alteredPlan),
    /COMPATIBILITY_PLAN_TAMPERED/,
  );
  const invalidVersion = reseal((value) => {
    value.components.find((item: any) =>
      item.componentId === "runtime.node"
    ).version = "23.0.0";
  });
  assert.throws(
    () => validatePocSetupCompatibilityCatalogV1(invalidVersion),
    /COMPONENT_VERSION_CONSTRAINT_UNSATISFIED/,
  );
  assert.throws(
    () => buildPocSetupCompatibilityPlanV1(
      showcase,
      [],
      catalog,
      defaultPocSetupCompatibilityRequestV1(catalog),
    ),
    /GUIDED_BASE_TEMPLATE_NOT_FOUND/,
  );
});

test("SETUP-PLANNER-LIFECYCLE binds Setup → Health → Demo → Rerun/Resume → Cleanup receipts", () => {
  const plan = buildPocSetupCompatibilityPlanV1(
    showcase,
    guided,
    catalog,
    defaultPocSetupCompatibilityRequestV1(catalog),
  );
  const setupReceipt = verifyPocGuidedDemoSetupReceiptV1(
    buildPocGuidedDemoSetupReceiptV1(plan.guidedSetupPlan),
    plan.guidedSetupPlan,
  );
  assert.equal(setupReceipt.health.status, "PASS");
  assert.equal(setupReceipt.demoEvidence.length, 6);
  assert.equal(
    setupReceipt.idempotency.status,
    "IDEMPOTENT_RERUN_ACCEPTED",
  );
  const failed = runPocEarlyAdminSyntheticSetupV1(
    buildPocEarlyAdminStatusV1(plan.guidedSetupPlan),
    { injectFailure: "TRANSIENT_HEALTH_CHECK_FAILURE" },
  );
  const repair = buildPocEarlyAdminRepairPlanV1(
    failed,
    "TRANSIENT_HEALTH_CHECK_FAILURE",
  );
  assert.equal(failed.resume.checkpointStage, "install_sandbox");
  const repaired = applyPocEarlyAdminRepairV1(failed, repair, true);
  const resumed = resumePocEarlyAdminSetupV1(repaired.status);
  assert.equal(resumed.health.status, "PASS");
  assert.equal(resumed.progress.percent, 100);
  assert.equal(resumed.resume.cacheReusable, true);
  const cleanup = buildPocGuidedDemoCleanupReceiptV1(
    plan.guidedSetupPlan,
    setupReceipt,
  );
  assert.equal(cleanup.removedOnlyOwnedState, true);
  assert.equal(cleanup.planDigest, plan.guidedSetupPlan.planDigest);
});

test("SETUP-PLANNER-REQUEST manifest contract is explicit and reproducible", () => {
  const value = request({
    apiVersion: POC_SETUP_COMPATIBILITY_REQUEST_API_VERSION,
    mode: "SYSTEM_FIRST",
    selectedUseCaseIds: ["POC-UC-002"],
    selectedComponentIds: ["provider.document-local"],
    completeBundle: true,
  });
  const first = analyzePocSetupCompatibilityV1(catalog, value);
  const second = analyzePocSetupCompatibilityV1(catalog, structuredClone(value));
  assert.equal(first.analysisDigest, second.analysisDigest);
});
