import assert from "node:assert/strict";
import { test } from "node:test";
import {
  admitCapabilityCatalogueV1,
  CAPABILITY_CATALOGUE_REQUIRED_NON_CLAIMS_V1,
  inspectCapabilityActionV1,
  syntheticCapabilityActionInspectionRequestV1,
  syntheticCapabilityCatalogueV1,
  verifyCapabilityActionInspectionV1,
  verifyCapabilityCatalogueAdmissionV1,
  type CapabilityCatalogueIssueCodeV1,
} from "../packages/contracts/src/index.js";

function mutate<T>(value: T, change: (draft: Record<string, any>) => void): unknown {
  const draft = structuredClone(value) as Record<string, any>;
  change(draft);
  return draft;
}

test("AAS-012-1 finite catalogue admission is closed, normalized and digest-bound", () => {
  const catalogue = syntheticCapabilityCatalogueV1();
  const admission = admitCapabilityCatalogueV1(catalogue);
  assert.equal(admission.outcome, "ADMITTED_INACTIVE");
  assert.equal(admission.decision, "DENY");
  assert.match(admission.catalogueDigest ?? "", /^[a-f0-9]{64}$/);
  assert.equal(
    verifyCapabilityCatalogueAdmissionV1(admission).resultDigest,
    admission.resultDigest,
  );
  assert.deepEqual(
    admission.catalogue?.adapters.map(({ adapterId }) => adapterId),
    ["dolibarr-local-fixture", "espocrm-local-fixture"],
  );

  const reordered = mutate(catalogue, (draft) => {
    draft.adapters.reverse();
    for (const adapter of draft.adapters) {
      adapter.actions[0].fields.reverse();
      adapter.actions[0].nonClaims.reverse();
    }
  });
  const reorderedAdmission = admitCapabilityCatalogueV1(reordered);
  assert.equal(reorderedAdmission.outcome, "ADMITTED_INACTIVE");
  assert.equal(reorderedAdmission.catalogueDigest, admission.catalogueDigest);
  assert.deepEqual(reorderedAdmission.catalogue, admission.catalogue);
});

test("AAS-012-2 every action shows exact evidence, versions, surface and non-claims", () => {
  const admission = admitCapabilityCatalogueV1(syntheticCapabilityCatalogueV1());
  for (const actionId of ["crm.contact.create", "erp.order.create"] as const) {
    const inspected = inspectCapabilityActionV1(
      admission,
      syntheticCapabilityActionInspectionRequestV1(admission, actionId),
    );
    assert.equal(inspected.outcome, "DESCRIBED_INACTIVE");
    assert.equal(inspected.decision, "DENY");
    assert.equal(inspected.executable, false);
    assert.equal(inspected.descriptor?.lifecycleState, "INACTIVE");
    assert.equal(inspected.descriptor?.adapterVersion, "1.0.0");
    assert.match(inspected.descriptor?.adapterDigest ?? "", /^[a-f0-9]{64}$/);
    assert.match(inspected.descriptor?.actionDigest ?? "", /^[a-f0-9]{64}$/);
    assert.deepEqual(
      inspected.descriptor?.nonClaims,
      [...CAPABILITY_CATALOGUE_REQUIRED_NON_CLAIMS_V1].sort(),
    );
    assert.deepEqual(inspected.descriptor?.evidence, [
      "docs/development/evidence/admin-ai-aas-012-20260801.json",
    ]);
    assert.equal(
      verifyCapabilityActionInspectionV1(inspected).resultDigest,
      inspected.resultDigest,
    );
  }
});

test("AAS-012-3 install, admission and inspection cannot imply activation or authority", () => {
  const admission = admitCapabilityCatalogueV1(syntheticCapabilityCatalogueV1());
  const inspected = inspectCapabilityActionV1(
    admission,
    syntheticCapabilityActionInspectionRequestV1(admission),
  );
  for (const value of [admission, inspected]) {
    const serialized = JSON.stringify(value);
    assert.equal(value.decision, "DENY");
    for (const forbidden of [
      "credentialHandle",
      "policyDecision",
      "approval",
      "authority",
      "providerCall",
      "effectCallback",
      "headers",
      "url",
      "activationToken",
    ]) assert.equal(serialized.includes(`\"${forbidden}\"`), false, forbidden);
  }
  assert.deepEqual(admission.issues, ["CAPABILITY_CATALOGUE_INACTIVE_DENIED"]);
  assert.deepEqual(inspected.issues, ["CAPABILITY_ACTION_INACTIVE_DENIED"]);

  for (const change of [
    (draft: Record<string, any>) => { draft.lifecycleState = "ACTIVE"; },
    (draft: Record<string, any>) => { draft.enabled = true; },
    (draft: Record<string, any>) => { draft.adapters[0].lifecycleState = "ACTIVE"; },
    (draft: Record<string, any>) => { draft.adapters[0].actions[0].lifecycleState = "ACTIVE"; },
    (draft: Record<string, any>) => { draft.adapters[0].actions[0].authority = "owner"; },
  ]) {
    const denied = admitCapabilityCatalogueV1(
      mutate(syntheticCapabilityCatalogueV1(), change),
    );
    assert.equal(denied.outcome, "DENY");
    assert.equal(denied.catalogue, null);
  }
});

test("AAS-012-4 unknown, incompatible, tampered and open surfaces fail closed", () => {
  const catalogue = syntheticCapabilityCatalogueV1();
  const admissionProbes: readonly [
    string,
    (draft: Record<string, any>) => void,
    CapabilityCatalogueIssueCodeV1,
  ][] = [
    ["adapter", (draft) => { draft.adapters[0].adapterId = "shell-local"; }, "CAPABILITY_ADAPTER_UNKNOWN_DENIED"],
    ["action", (draft) => { draft.adapters[0].actions[0].actionId = "shell.exec"; }, "CAPABILITY_ACTION_UNKNOWN_DENIED"],
    ["version", (draft) => { draft.adapters[0].adapterVersion = "2.0.0"; }, "CAPABILITY_ACTION_COMPATIBILITY_DENIED"],
    ["digest", (draft) => { draft.adapters[0].adapterDigest = "latest"; }, "CAPABILITY_ADAPTER_DIGEST_DENIED"],
    ["evidence", (draft) => { draft.adapters[0].actions[0].evidence = ["../../secret"]; }, "CAPABILITY_ACTION_EVIDENCE_DENIED"],
    ["non-claim", (draft) => { draft.adapters[0].actions[0].nonClaims.pop(); }, "CAPABILITY_ACTION_NON_CLAIMS_DENIED"],
    ["path", (draft) => { draft.adapters[0].actions[0].providerRequest.path = "/admin"; }, "CAPABILITY_ACTION_SURFACE_DENIED"],
    ["field", (draft) => { draft.adapters[0].actions[0].fields.push("password"); }, "CAPABILITY_ACTION_SURFACE_DENIED"],
    ["duplicate", (draft) => { draft.adapters[1] = structuredClone(draft.adapters[0]); }, "CAPABILITY_ADAPTER_DUPLICATE_DENIED"],
  ];
  for (const [label, change, issue] of admissionProbes) {
    const denied = admitCapabilityCatalogueV1(mutate(catalogue, change));
    assert.equal(denied.outcome, "DENY", label);
    assert.equal(denied.catalogue, null, label);
    assert.ok(denied.issues.includes(issue), label);
  }

  const admission = admitCapabilityCatalogueV1(catalogue);
  const request = syntheticCapabilityActionInspectionRequestV1(admission);
  for (const [label, change, issue] of [
    ["catalogue digest", (draft: Record<string, any>) => { draft.catalogueDigest = "0".repeat(64); }, "CAPABILITY_CATALOGUE_BINDING_DENIED"],
    ["adapter", (draft: Record<string, any>) => { draft.adapterId = "unknown"; }, "CAPABILITY_ADAPTER_UNKNOWN_DENIED"],
    ["action", (draft: Record<string, any>) => { draft.actionId = "unknown"; }, "CAPABILITY_ACTION_UNKNOWN_DENIED"],
    ["resource", (draft: Record<string, any>) => { draft.resource = "host.filesystem"; }, "CAPABILITY_ACTION_SURFACE_DENIED"],
    ["field", (draft: Record<string, any>) => { draft.fields.push("secret"); }, "CAPABILITY_ACTION_SURFACE_DENIED"],
    ["path", (draft: Record<string, any>) => { draft.path = "/admin"; }, "CAPABILITY_ACTION_SURFACE_DENIED"],
  ] as const) {
    const denied = inspectCapabilityActionV1(admission, mutate(request, change));
    assert.equal(denied.outcome, "DENY", label);
    assert.equal(denied.descriptor, null, label);
    assert.ok(denied.issues.includes(issue), label);
  }

  const tamperedAdmission = structuredClone(admission) as Record<string, any>;
  tamperedAdmission.catalogue.adapters[0].adapterDigest = "0".repeat(64);
  const denied = inspectCapabilityActionV1(tamperedAdmission, request);
  assert.equal(denied.outcome, "DENY");
  assert.ok(denied.issues.includes("CAPABILITY_CATALOGUE_BINDING_DENIED"));

  const inspected = inspectCapabilityActionV1(admission, request);
  const tamperedInspection = structuredClone(inspected) as Record<string, any>;
  tamperedInspection.descriptor.lifecycleState = "ACTIVE";
  assert.throws(
    () => verifyCapabilityActionInspectionV1(tamperedInspection),
    /CAPABILITY_ACTION_INSPECTION_INVALID_DENIED/,
  );
});
