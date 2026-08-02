import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  BUILDER_AUTHORITY_INPUT_API_VERSION,
  BUILDER_INTEGRATION_PLAN_INPUT_API_VERSION,
  BUILDER_QUALITY_EVIDENCE_INPUT_API_VERSION,
  buildBuilderQualityEvidenceV1,
  canonicalJson,
  planBuilderIntegrationV1,
  verifyBuilderQualityEvidenceV1,
  type BuilderAuthorityInputV1,
  type BuilderCapabilityRegistrationV1,
  type BuilderDiscoveryInputV1,
  type BuilderIntegrationPlanInputV1,
  type BuilderLifecycleRouteInputV1,
  type BuilderQualityEvidenceInputV1,
  type BuilderQualityObservationV1,
} from "../packages/contracts/src/index.js";

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function plan() {
  const discoveryInput = JSON.parse(
    readFileSync("tests/fixtures/builder/g2-zoo-system.json", "utf8"),
  ) as BuilderDiscoveryInputV1;
  const registeredCapabilities = [JSON.parse(
    readFileSync("tests/fixtures/builder/g3-capability-registry.json", "utf8"),
  ) as BuilderCapabilityRegistrationV1];
  const registeredRights = [
    { rightId: "habitat.setpoint.update", effectClass: "REVERSIBLE_WRITE" as const },
    { rightId: "habitat.temperature.read", effectClass: "READ_ONLY" as const },
  ];
  const rightIds = registeredRights.map(({ rightId }) => rightId);
  const authorityInput: BuilderAuthorityInputV1 = {
    schemaVersion: BUILDER_AUTHORITY_INPUT_API_VERSION,
    tenant: "synthetic-zoo",
    actor: "agent:builder",
    requestedProfile: null,
    registeredRights,
    hostSystemCeiling: rightIds,
    assignments: rightIds,
    currentConstraints: rightIds,
    customRules: [],
  };
  const input: BuilderIntegrationPlanInputV1 = {
    schemaVersion: BUILDER_INTEGRATION_PLAN_INPUT_API_VERSION,
    discoveryInput,
    registeredCapabilities,
    authorityInput,
    scaffoldKind: "ADAPTER",
  };
  return planBuilderIntegrationV1(input);
}

function routes(): BuilderLifecycleRouteInputV1[] {
  return [
    { action: "INSTALLATION", route: "OWNER_APPROVAL" },
    { action: "ACTIVATION", route: "OWNER_APPROVAL" },
    { action: "MUTATION", route: "DENY" },
    { action: "PUBLICATION", route: "DENY" },
  ];
}

function observations(): BuilderQualityObservationV1[] {
  const source = plan();
  return source.integrationContracts.map((contract) => contract.capabilityState === "UNRESOLVED_INTENT"
    ? {
      operationId: contract.operationId,
      planDigest: source.planDigest,
      contractId: contract.contractId,
      capabilityBindingDigest: contract.capabilityBindingDigest,
      mode: "SYNTHETIC_CONTRACT_HARNESS" as const,
      result: "NOT_EXECUTED_UNRESOLVED_INTENT" as const,
      beforeDigest: null,
      afterEffectDigest: null,
      finalDigest: null,
      readbackDigest: null,
      receiptDigest: null,
    }
    : {
      operationId: contract.operationId,
      planDigest: source.planDigest,
      contractId: contract.contractId,
      capabilityBindingDigest: contract.capabilityBindingDigest,
      mode: "SYNTHETIC_CONTRACT_HARNESS" as const,
      result: "MATCHED_NO_CHANGE" as const,
      beforeDigest: digest({ temperatureC: 22.5 }),
      afterEffectDigest: digest({ temperatureC: 22.5 }),
      finalDigest: digest({ temperatureC: 22.5 }),
      readbackDigest: digest({ operationId: contract.operationId, temperatureC: 22.5 }),
      receiptDigest: digest({ operationId: contract.operationId, result: "MATCHED_NO_CHANGE" }),
    });
}

function input(): BuilderQualityEvidenceInputV1 {
  return {
    schemaVersion: BUILDER_QUALITY_EVIDENCE_INPUT_API_VERSION,
    issueId: "BLD-001",
    claimId: "BLD-001-G5",
    plan: plan(),
    lifecycleRoutes: routes(),
    observations: observations(),
  };
}

function mutate<T>(value: T, change: (draft: Record<string, any>) => void): unknown {
  const draft = structuredClone(value) as Record<string, any>;
  change(draft);
  return draft;
}

test("BLD-001-G5 produces deterministic schema-valid local evidence", () => {
  const first = buildBuilderQualityEvidenceV1(input());
  const second = buildBuilderQualityEvidenceV1(input());
  assert.equal(first.reportDigest, second.reportDigest);
  assert.equal(first.qualityStatus, "PASS_PREPARATION_REQUIRED");
  assert.equal(first.focusedChecks.length, 6);
  assert.equal(first.negativeProbeCoverage.length, 8);
  assert.equal(first.evidencePackage.deliveryStatus, "locally_validated");
  assert.equal(first.evidencePackage.releaseStatus, "NOT_RELEASED");
  assert.equal(verifyBuilderQualityEvidenceV1(first).reportDigest, first.reportDigest);

  const schema = JSON.parse(
    readFileSync("schemas/contracts/builder-quality-evidence-v1.schema.json", "utf8"),
  ) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(first), true, JSON.stringify(validate.errors));
});

test("BLD-001-G5 keeps installation activation mutation and publication independent", () => {
  const result = buildBuilderQualityEvidenceV1(input());
  assert.deepEqual(result.lifecycleRouteDecisions.map(({ action, route }) => ({ action, route })), [
    { action: "ACTIVATION", route: "OWNER_APPROVAL" },
    { action: "INSTALLATION", route: "OWNER_APPROVAL" },
    { action: "MUTATION", route: "DENY" },
    { action: "PUBLICATION", route: "DENY" },
  ]);
  assert.equal(new Set(result.lifecycleRouteDecisions.map(({ decisionDigest }) =>
    decisionDigest)).size, 4);
  assert.equal(JSON.stringify(result).includes("approveAll"), false);
});

test("BLD-001-G5 reconciles readback and keeps unresolved intent explicit non-success", () => {
  const result = buildBuilderQualityEvidenceV1(input());
  assert.deepEqual(result.reconciliation.map(({ operationId, status }) => ({ operationId, status })), [
    {
      operationId: "habitat.setpoint.update",
      status: "NOT_EXECUTED_UNRESOLVED_INTENT",
    },
    {
      operationId: "habitat.temperature.read",
      status: "MATCHED_NO_CHANGE",
    },
  ]);
  assert.equal(result.reconciliation[0]?.readbackDigest, null);
  assert.match(result.reconciliation[1]?.readbackDigest ?? "", /^[a-f0-9]{64}$/);
});

test("BLD-001-G5 canonicalizes route and observation ordering", () => {
  const baseline = buildBuilderQualityEvidenceV1(input());
  const reordered = structuredClone(input());
  (reordered.lifecycleRoutes as BuilderLifecycleRouteInputV1[]).reverse();
  (reordered.observations as BuilderQualityObservationV1[]).reverse();
  assert.equal(buildBuilderQualityEvidenceV1(reordered).reportDigest, baseline.reportDigest);
});

test("BLD-001-G5 negative probes deny binding readback rollback routing and secret drift", () => {
  const base = input();
  const cases = [
    mutate(base, (draft) => { draft.plan.planDigest = "0".repeat(64); }),
    mutate(base, (draft) => { draft.observations[1].capabilityBindingDigest = "0".repeat(64); }),
    mutate(base, (draft) => { draft.observations[1].afterEffectDigest = "1".repeat(64); }),
    mutate(base, (draft) => {
      draft.observations[0].result = "MATCHED_ROLLBACK";
      draft.observations[0].beforeDigest = "1".repeat(64);
      draft.observations[0].afterEffectDigest = "2".repeat(64);
      draft.observations[0].finalDigest = "1".repeat(64);
      draft.observations[0].readbackDigest = "3".repeat(64);
      draft.observations[0].receiptDigest = "4".repeat(64);
    }),
    mutate(base, (draft) => { draft.lifecycleRoutes.pop(); }),
    mutate(base, (draft) => { draft.lifecycleRoutes[3].action = "MUTATION"; }),
    mutate(base, (draft) => { draft.approveAll = true; }),
    mutate(base, (draft) => { draft.rawData = { secret: "synthetic-but-forbidden" }; }),
  ];
  for (const candidate of cases) {
    assert.throws(
      () => buildBuilderQualityEvidenceV1(candidate),
      /BUILDER_QUALITY_EVIDENCE_INVALID_DENIED/,
    );
  }
});

test("BLD-001-G5 verifier rejects result mutation and aggregate approval fields", () => {
  const result = buildBuilderQualityEvidenceV1(input());
  for (const candidate of [
    mutate(result, (draft) => { draft.evidencePackage.releaseStatus = "RELEASED"; }),
    mutate(result, (draft) => { draft.aggregateApproval = "synthetic"; }),
  ]) {
    assert.throws(
      () => verifyBuilderQualityEvidenceV1(candidate),
      /BUILDER_QUALITY_EVIDENCE_INVALID_DENIED/,
    );
  }
});
