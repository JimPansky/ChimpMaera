import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  BUILDER_AUTHORITY_INPUT_API_VERSION,
  BUILDER_INTEGRATION_PLAN_INPUT_API_VERSION,
  planBuilderIntegrationV1,
  verifyBuilderIntegrationPlanV1,
  type BuilderAuthorityInputV1,
  type BuilderCapabilityRegistrationV1,
  type BuilderDiscoveryInputV1,
  type BuilderIntegrationPlanInputV1,
} from "../packages/contracts/src/index.js";

function discoveryInput(): BuilderDiscoveryInputV1 {
  return JSON.parse(
    readFileSync("tests/fixtures/builder/g2-zoo-system.json", "utf8"),
  ) as BuilderDiscoveryInputV1;
}

function registration(): BuilderCapabilityRegistrationV1 {
  return JSON.parse(
    readFileSync("tests/fixtures/builder/g3-capability-registry.json", "utf8"),
  ) as BuilderCapabilityRegistrationV1;
}

function authorityInput(
  requestedProfile: BuilderAuthorityInputV1["requestedProfile"] = null,
): BuilderAuthorityInputV1 {
  const registeredRights = [
    { rightId: "habitat.setpoint.update", effectClass: "REVERSIBLE_WRITE" as const },
    { rightId: "habitat.temperature.read", effectClass: "READ_ONLY" as const },
  ];
  const rightIds = registeredRights.map(({ rightId }) => rightId);
  return {
    schemaVersion: BUILDER_AUTHORITY_INPUT_API_VERSION,
    tenant: "synthetic-zoo",
    actor: "agent:builder",
    requestedProfile,
    registeredRights,
    hostSystemCeiling: rightIds,
    assignments: rightIds,
    currentConstraints: rightIds,
    customRules: requestedProfile === "CUSTOM"
      ? rightIds.map((rightId) => ({ rightId, route: "OWNER_APPROVAL" as const }))
      : [],
  };
}

function input(
  scaffoldKind: BuilderIntegrationPlanInputV1["scaffoldKind"] = "ADAPTER",
  authority: BuilderAuthorityInputV1 = authorityInput(),
): BuilderIntegrationPlanInputV1 {
  return {
    schemaVersion: BUILDER_INTEGRATION_PLAN_INPUT_API_VERSION,
    discoveryInput: discoveryInput(),
    registeredCapabilities: [registration()],
    authorityInput: authority,
    scaffoldKind,
  };
}

function mutate<T>(value: T, change: (draft: Record<string, any>) => void): unknown {
  const draft = structuredClone(value) as Record<string, any>;
  change(draft);
  return draft;
}

test("BLD-001-G4 plan is deterministic, digest-bound and satisfies the public schema", () => {
  const first = planBuilderIntegrationV1(input());
  const second = planBuilderIntegrationV1(input());
  assert.equal(first.planDigest, second.planDigest);
  assert.equal(first.inputDigest, second.inputDigest);
  assert.equal(
    verifyBuilderIntegrationPlanV1(first).planDigest,
    first.planDigest,
  );

  const schema = JSON.parse(
    readFileSync("schemas/contracts/builder-integration-plan-v1.schema.json", "utf8"),
  ) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(first), true, JSON.stringify(validate.errors));
});

test("BLD-001-G4 canonicalizes semantically unordered discovery and authority inputs", () => {
  const baseline = planBuilderIntegrationV1(input());
  const reordered = structuredClone(input()) as any;
  reordered.discoveryInput.machineManifest.objects.reverse();
  reordered.discoveryInput.machineManifest.operations.reverse();
  reordered.discoveryInput.intake.requestedOperationIds.reverse();
  reordered.discoveryInput.contexts.reverse();
  reordered.authorityInput.registeredRights.reverse();
  reordered.authorityInput.hostSystemCeiling.reverse();
  reordered.authorityInput.assignments.reverse();
  reordered.authorityInput.currentConstraints.reverse();
  const result = planBuilderIntegrationV1(reordered);
  assert.equal(result.inputDigest, baseline.inputDigest);
  assert.equal(result.planDigest, baseline.planDigest);
});

test("BLD-001-G4 emits one generic closed scaffold for reused and unresolved operations", () => {
  const result = planBuilderIntegrationV1(input());
  assert.equal(result.claim, "DATA_ONLY_GENERIC_PLAN_NO_AUTHORITY_EFFECT_ACTIVATION_OR_PUBLICATION");
  assert.equal(result.planningStatus, "PREPARATION_REQUIRED");
  assert.equal(result.systemManifest.dataClassification, "SYNTHETIC");
  assert.deepEqual(result.systemManifest.objectTypes, ["habitat", "sensor"]);
  assert.deepEqual(result.objectDependencyGraph.edges, [{
    fromObjectType: "habitat",
    toDependencyObjectType: "sensor",
  }]);

  assert.deepEqual(
    result.integrationContracts.map((contract) => ({
      operationId: contract.operationId,
      state: contract.capabilityState,
      template: contract.templateId,
    })),
    [
      {
        operationId: "habitat.setpoint.update",
        state: "UNRESOLVED_INTENT",
        template: "chimpmaera.builder/generic-adapter-contract/v1",
      },
      {
        operationId: "habitat.temperature.read",
        state: "REUSE_REGISTERED",
        template: "chimpmaera.builder/generic-adapter-contract/v1",
      },
    ],
  );
  assert.equal(result.integrationContracts.every((contract) =>
    contract.lifecycleState === "INACTIVE"
      && contract.executable === false
      && contract.authorityGranted === false
      && contract.effectAuthorized === false), true);
  assert.equal(JSON.stringify(result).includes("unknown.habitat-controller.js"), false);
});

test("BLD-001-G4 profile diff, fixtures and rollback stay separate from authority", () => {
  const result = planBuilderIntegrationV1(input());
  assert.equal(result.profileDiff.selectedProfile, "SAFE_GUIDED");
  assert.deepEqual(result.profileDiff.entries.map((entry) => ({
    rightId: entry.rightId,
    baseline: entry.safeGuidedRoute,
    selected: entry.selectedRoute,
    changed: entry.changedFromSafeGuided,
  })), [
    {
      rightId: "habitat.setpoint.update",
      baseline: "OWNER_APPROVAL",
      selected: "OWNER_APPROVAL",
      changed: false,
    },
    {
      rightId: "habitat.temperature.read",
      baseline: "AUTO_EXECUTE",
      selected: "AUTO_EXECUTE",
      changed: false,
    },
  ]);
  assert.equal(result.fixtures.every(({ dataClassification }) =>
    dataClassification === "SYNTHETIC"), true);
  assert.deepEqual(result.rollbackPlan.map(({ operationId, strategy }) => ({
    operationId,
    strategy,
  })), [
    { operationId: "habitat.setpoint.update", strategy: "RESTORE_PRIOR_VALUE" },
    { operationId: "habitat.temperature.read", strategy: "NOT_APPLICABLE_READ_ONLY" },
  ]);
});

test("BLD-001-G4 the same planner emits a generic skill contract without target code", () => {
  const adapter = planBuilderIntegrationV1(input("ADAPTER"));
  const skill = planBuilderIntegrationV1(input("SKILL"));
  assert.equal(skill.integrationContracts.every(({ templateId, scaffoldKind }) =>
    templateId === "chimpmaera.builder/generic-skill-contract/v1"
      && scaffoldKind === "SKILL"), true);
  assert.deepEqual(skill.systemManifest, adapter.systemManifest);
  assert.deepEqual(skill.objectDependencyGraph, adapter.objectDependencyGraph);
  assert.deepEqual(skill.rollbackPlan, adapter.rollbackPlan);
});

test("BLD-001-G4 owner-selected broad profile changes routes but never creates authority", () => {
  const result = planBuilderIntegrationV1(input(
    "ADAPTER",
    authorityInput("RAMPAGE_FULL_CONTROL_LAB"),
  ));
  assert.equal(result.profileDiff.selectedProfile, "RAMPAGE_FULL_CONTROL_LAB");
  assert.equal(result.profileDiff.entries.find(({ rightId }) =>
    rightId === "habitat.setpoint.update")?.changedFromSafeGuided, true);
  assert.equal(result.integrationContracts.every(({ authorityGranted }) =>
    authorityGranted === false), true);
});

test("BLD-001-G4 denies mismatched authority, missing rights, tampering and hidden fields", () => {
  const base = input();
  const cases = [
    mutate(base, (draft) => { draft.authorityInput.tenant = "synthetic-other"; }),
    mutate(base, (draft) => { draft.authorityInput.registeredRights.pop(); }),
    mutate(base, (draft) => { draft.authorityInput.registeredRights[0].effectClass = "READ_ONLY"; }),
    mutate(base, (draft) => { draft.registeredCapabilities[0].descriptorDigest = "0".repeat(64); }),
    mutate(base, (draft) => { draft.discoveryInput.machineManifest.dataClassification = "CUSTOMER"; }),
    mutate(base, (draft) => { draft.customerScript = "privileged target helper"; }),
  ];
  for (const candidate of cases) {
    assert.throws(
      () => planBuilderIntegrationV1(candidate),
      /BUILDER_(?:INTEGRATION_PLAN|AUTHORITY|CAPABILITY_RESOLUTION|DISCOVERY).*INVALID_DENIED/,
    );
  }
});

test("BLD-001-G4 verifier rejects mutation and authority-shaped hidden fields", () => {
  const result = planBuilderIntegrationV1(input());
  for (const candidate of [
    mutate(result, (draft) => { draft.integrationContracts[0].executable = true; }),
    mutate(result, (draft) => { draft.approvalToken = "synthetic"; }),
  ]) {
    assert.throws(
      () => verifyBuilderIntegrationPlanV1(candidate),
      /BUILDER_INTEGRATION_PLAN_INVALID_DENIED/,
    );
  }
});
