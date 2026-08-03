import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  RESOURCE_PLANE_IDS_V1,
  RESOURCE_PLANE_TEMPLATES_V1,
  canonicalJson,
  compileResourcePlanePlanV1,
  syntheticResourcePlaneProfileInputV1,
  verifyResourcePlanePlanV1,
  type ResourcePlaneProfileInputV1,
} from "../packages/contracts/src/index.js";

function mutate(
  input: ResourcePlaneProfileInputV1 | unknown,
  change: (value: Record<string, any>) => void,
): unknown {
  const value = structuredClone(input) as Record<string, any>;
  change(value);
  return value;
}

function rehashPlan(value: Record<string, any>): void {
  const { planDigest: _planDigest, ...core } = value;
  value.planDigest = createHash("sha256").update(canonicalJson(core)).digest("hex");
}

test("RPP-M0-1 compiles exactly seven closed resource planes and satisfies schema", () => {
  const input = syntheticResourcePlaneProfileInputV1();
  const first = compileResourcePlanePlanV1(input);
  const second = compileResourcePlanePlanV1(input);
  assert.equal(first.claim, "DECLARATIVE_RESOURCE_PLANE_PLAN_ONLY_NO_EXECUTION");
  assert.equal(first.authorityFree, true);
  assert.equal(first.runtimeActivation, false);
  assert.deepEqual(first.planes.map(({ planeId }) => planeId), RESOURCE_PLANE_IDS_V1);
  assert.equal(first.planDigest, second.planDigest);
  assert.equal(verifyResourcePlanePlanV1(first).planDigest, first.planDigest);

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const inputSchema = JSON.parse(readFileSync(
    "schemas/contracts/resource-plane-profile-input-v1.schema.json",
    "utf8",
  )) as object;
  const validateInput = ajv.compile(inputSchema);
  assert.equal(validateInput(input), true, JSON.stringify(validateInput.errors));

  const planSchema = JSON.parse(readFileSync(
    "schemas/contracts/resource-plane-plan-v1.schema.json",
    "utf8",
  )) as object;
  const validatePlan = ajv.compile(planSchema);
  assert.equal(validatePlan(first), true, JSON.stringify(validatePlan.errors));
});

test("RPP-M0-2 SAFE_GUIDED auto-routes reads and owner-routes effects", () => {
  const plan = compileResourcePlanePlanV1(syntheticResourcePlaneProfileInputV1());
  const decisions = plan.planes.flatMap(({ decisions }) => decisions);
  assert.equal(decisions.find(({ rightId }) => rightId === "filesystem.content.read")?.route,
    "AUTO_EXECUTE");
  assert.equal(decisions.find(({ rightId }) => rightId === "filesystem.owned.write")?.route,
    "OWNER_APPROVAL");
  assert.equal(decisions.find(({ rightId }) => rightId === "secrets.value.read")?.route,
    "OWNER_APPROVAL");
  assert.equal(plan.effectiveRightsDiff.entries.every(({ change }) =>
    change === "UNCHANGED"), true);
});

test("RPP-M0-3 CUSTOM and FULL_CONTROL emit an explicit effective-rights diff", () => {
  const customInput = structuredClone(
    syntheticResourcePlaneProfileInputV1("CUSTOM"),
  ) as any;
  customInput.customRules = customInput.customRules.map((rule: {
    rightId: string;
    route: "AUTO_EXECUTE" | "OWNER_APPROVAL";
  }) => ({
    ...rule,
    route: rule.rightId === "filesystem.owned.write" ? "AUTO_EXECUTE" : rule.route,
  }));
  const custom = compileResourcePlanePlanV1(customInput);
  assert.equal(custom.authorityProfile, "CUSTOM");
  assert.ok(custom.effectiveRightsDiff.routeChanged.includes("filesystem.owned.write"));
  assert.ok(custom.effectiveRightsDiff.routeChanged.includes("network.resolve"));

  const narrowed = structuredClone(
    syntheticResourcePlaneProfileInputV1("CUSTOM"),
  ) as any;
  narrowed.customRules = narrowed.customRules.filter(({ rightId }: { rightId: string }) =>
    rightId !== "devices.actuate");
  const narrowedPlan = compileResourcePlanePlanV1(narrowed);
  assert.deepEqual(narrowedPlan.effectiveRightsDiff.removed, ["devices.actuate"]);

  const full = compileResourcePlanePlanV1(
    syntheticResourcePlaneProfileInputV1("FULL_CONTROL"),
  );
  assert.equal(full.authorityProfile, "RAMPAGE_FULL_CONTROL_LAB");
  assert.ok(full.effectiveRightsDiff.routeChanged.includes("network.https.write"));
  assert.equal(full.effectiveRightsDiff.added.length, 0);
  assert.equal(full.effectiveRightsDiff.removed.length, 0);
});

test("RPP-M0-4 host, assignment and current-constraint ceilings remain binding", () => {
  const input = structuredClone(
    syntheticResourcePlaneProfileInputV1("FULL_CONTROL"),
  ) as any;
  input.hostSystemCeiling = input.hostSystemCeiling.filter((right: string) =>
    right !== "process.spawn");
  input.assignments = input.assignments.filter((right: string) =>
    right !== "network.listen");
  input.currentConstraints = input.currentConstraints.filter((right: string) =>
    right !== "devices.actuate");
  const plan = compileResourcePlanePlanV1(input);
  const decisions = plan.planes.flatMap(({ decisions }) => decisions);
  for (const rightId of ["process.spawn", "network.listen", "devices.actuate"]) {
    assert.equal(decisions.find((decision) => decision.rightId === rightId)?.route, "DENY");
  }
  assert.equal(decisions.find(({ rightId }) => rightId === "docker.container.run")?.route,
    "AUTO_EXECUTE");
});

test("RPP-M0-5 input order is canonicalized", () => {
  const baseline = compileResourcePlanePlanV1(syntheticResourcePlaneProfileInputV1("CUSTOM"));
  const reordered = structuredClone(
    syntheticResourcePlaneProfileInputV1("CUSTOM"),
  ) as any;
  reordered.planeTemplates.reverse();
  for (const plane of reordered.planeTemplates) plane.requestedRights.reverse();
  reordered.hostSystemCeiling.reverse();
  reordered.assignments.reverse();
  reordered.currentConstraints.reverse();
  reordered.customRules.reverse();
  const same = compileResourcePlanePlanV1(reordered);
  assert.equal(same.inputDigest, baseline.inputDigest);
  assert.equal(same.planDigest, baseline.planDigest);
});

test("RPP-M0-6 negative matrix fails closed for plane, template, right and profile drift", () => {
  const base = syntheticResourcePlaneProfileInputV1();
  const cases: readonly [string, unknown][] = [
    ["missing plane", mutate(base, (value) => { value.planeTemplates.pop(); })],
    ["duplicate plane", mutate(base, (value) => {
      value.planeTemplates[6] = structuredClone(value.planeTemplates[0]);
    })],
    ["unknown plane", mutate(base, (value) => {
      value.planeTemplates[0].planeId = "GPU";
    })],
    ["wrong template", mutate(base, (value) => {
      value.planeTemplates[0].templateId = RESOURCE_PLANE_TEMPLATES_V1.NETWORK.templateId;
    })],
    ["unknown right", mutate(base, (value) => {
      value.planeTemplates[0].requestedRights[0] = "filesystem.root.takeover";
    })],
    ["right in wrong plane", mutate(base, (value) => {
      value.planeTemplates[0].requestedRights[0] = "network.resolve";
    })],
    ["duplicate right", mutate(base, (value) => {
      value.planeTemplates[0].requestedRights.push(value.planeTemplates[0].requestedRights[0]);
    })],
    ["unknown ceiling right", mutate(base, (value) => {
      value.hostSystemCeiling.push("ambient.root");
    })],
    ["unknown profile", mutate(base, (value) => { value.selectedProfile = "RAMPAGE"; })],
    ["safe hidden custom rule", mutate(base, (value) => {
      value.customRules.push({ rightId: "network.https.write", route: "AUTO_EXECUTE" });
    })],
    ["hidden input field", mutate(base, (value) => { value.runtimeActivation = true; })],
  ];
  for (const [label, candidate] of cases) {
    assert.throws(
      () => compileResourcePlanePlanV1(candidate),
      /RESOURCE_PLANE_PROFILE_INVALID_DENIED/,
      label,
    );
  }
});

test("RPP-M0-7 output has no executable or authority-bearing material", () => {
  const plan = compileResourcePlanePlanV1(
    syntheticResourcePlaneProfileInputV1("FULL_CONTROL"),
  );
  const encoded = JSON.stringify(plan);
  for (const forbidden of [
    "credential",
    "token",
    "effectCallback",
    "command",
    "endpoint",
    "providerBinding",
    "lease",
    "approval",
  ]) assert.equal(encoded.includes(`\"${forbidden}\"`), false, forbidden);

  const changed = mutate(plan, (value) => { value.runtimeActivation = true; });
  assert.throws(
    () => verifyResourcePlanePlanV1(changed),
    /RESOURCE_PLANE_PROFILE_INVALID_DENIED/,
  );

  const hidden = mutate(plan, (value) => {
    value.planes[0].command = "synthetic-only";
    rehashPlan(value);
  });
  const inconsistent = mutate(plan, (value) => {
    value.effectiveRightsDiff.entries[0].change = "ADDED";
    value.effectiveRightsDiff.added = [value.effectiveRightsDiff.entries[0].rightId];
    rehashPlan(value);
  });
  for (const forged of [hidden, inconsistent]) {
    assert.throws(
      () => verifyResourcePlanePlanV1(forged),
      /RESOURCE_PLANE_PROFILE_INVALID_DENIED/,
    );
  }
});
