import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  MAINTENANCE_AXIS_NAMES_V1,
  maintenanceContractDigest,
  parseMaintenanceContractBundleV1,
  renderMaintenanceContractBundleV1,
  verifyMaintenanceContractBundleV1,
  type MaintenanceContractBundleV1,
  type MaintenanceReasonCodeV1,
} from "../packages/contracts/src/index.js";

interface NegativeFixture {
  readonly caseId: string;
  readonly operation: "add" | "replace";
  readonly path: string;
  readonly value: unknown;
  readonly expectedReason: MaintenanceReasonCodeV1;
}

function fixture(): MaintenanceContractBundleV1 {
  return JSON.parse(readFileSync(
    "tests/fixtures/update-doctor/positive-maintenance-contract-freeze-v1.json", "utf8",
  )) as MaintenanceContractBundleV1;
}

function mutate(source: MaintenanceContractBundleV1, mutation: NegativeFixture): unknown {
  const output = structuredClone(source) as unknown as Record<string, any>;
  const parts = mutation.path.split("/").slice(1);
  const leaf = parts.pop();
  assert.ok(leaf !== undefined);
  let parent: any = output;
  for (const part of parts) parent = parent[part];
  if (Array.isArray(parent)) parent.splice(Number(leaf), mutation.operation === "add" ? 0 : 1, mutation.value);
  else parent[leaf] = mutation.value;
  return output;
}

function reorderKeys(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return value.map((item) => reorderKeys(item, seed + 1));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  const offset = entries.length === 0 ? 0 : seed % entries.length;
  const rotated = [...entries.slice(offset), ...entries.slice(0, offset)].reverse();
  return Object.fromEntries(rotated.map(([key, item]) => [key, reorderKeys(item, seed + 1)]));
}

test("UD-001 additive freeze validates closed lock, compatibility, plan, receipt and Doctor schemas", () => {
  const input = fixture();
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const lock = ajv.compile(JSON.parse(readFileSync("schemas/contracts/maintenance-installation-lock-v1.schema.json", "utf8")));
  const compatibility = ajv.compile(JSON.parse(readFileSync("schemas/contracts/maintenance-compatibility-profile-v1.schema.json", "utf8")));
  const operation = ajv.compile(JSON.parse(readFileSync("schemas/contracts/maintenance-operation-contract-v1.schema.json", "utf8")));
  const doctor = ajv.compile(JSON.parse(readFileSync("schemas/contracts/maintenance-doctor-report-v1.schema.json", "utf8")));
  assert.equal(lock(input.installationLock), true, JSON.stringify(lock.errors));
  assert.equal(compatibility(input.compatibilityProfile), true, JSON.stringify(compatibility.errors));
  assert.equal(operation(input.operationPlan), true, JSON.stringify(operation.errors));
  assert.equal(operation(input.operationReceipt), true, JSON.stringify(operation.errors));
  assert.equal(doctor(input.doctorReport), true, JSON.stringify(doctor.errors));
  assert.deepEqual(Object.keys(input.installationLock.versionAxes), [...MAINTENANCE_AXIS_NAMES_V1]);
});

test("UD-001 parser and renderer are deterministic across 100 object-key reorderings", () => {
  const input = fixture();
  const expected = renderMaintenanceContractBundleV1(input);
  const expectedResult = verifyMaintenanceContractBundleV1(input);
  assert.equal(expectedResult.outcome, "ACCEPTED");
  for (let repetition = 0; repetition < 100; repetition += 1) {
    const result = parseMaintenanceContractBundleV1(JSON.stringify(reorderKeys(input, repetition)));
    assert.equal(result.outcome, "ACCEPTED", `repetition:${repetition}`);
    if (result.outcome === "ACCEPTED" && expectedResult.outcome === "ACCEPTED") {
      assert.equal(result.canonicalJson, expected);
      assert.equal(result.bundleDigest, expectedResult.bundleDigest);
    }
  }
});

test("UD-001 exact artifact digests and cross-contract bindings verify", () => {
  const input = fixture();
  const artifacts: readonly [Record<string, unknown>, string, string][] = [
    [input.installationLock as unknown as Record<string, unknown>, "lockDigest", input.installationLock.lockDigest],
    [input.compatibilityProfile as unknown as Record<string, unknown>, "profileDigest", input.compatibilityProfile.profileDigest],
    [input.operationPlan as unknown as Record<string, unknown>, "planDigest", input.operationPlan.planDigest],
    [input.doctorReport as unknown as Record<string, unknown>, "reportDigest", input.doctorReport.reportDigest],
    [input.operationReceipt as unknown as Record<string, unknown>, "receiptDigest", input.operationReceipt.receiptDigest],
  ];
  for (const [artifact, digestKey, expected] of artifacts) {
    assert.equal(maintenanceContractDigest(artifact, digestKey), expected, digestKey);
  }
  assert.equal(verifyMaintenanceContractBundleV1(input).outcome, "ACCEPTED");
  assert.equal(input.operationPlan.executionAuthorized, false);
  assert.equal(input.operationReceipt.mutationObserved, false);
  assert.equal(input.operationPlan.fromLockDigest, input.operationPlan.targetLockDigest);
});

test("UD-001 negative matrix denies v2, unknown, mutable, drift, authority, compatibility and mutation cases", () => {
  const cases = JSON.parse(readFileSync(
    "tests/fixtures/update-doctor/maintenance-contract-freeze-negative-matrix-v1-v2.json", "utf8",
  )) as NegativeFixture[];
  assert.equal(cases.length, 10);
  for (const negative of cases) {
    const result = verifyMaintenanceContractBundleV1(mutate(fixture(), negative));
    assert.equal(result.outcome, "DENIED", negative.caseId);
    assert.deepEqual(result.reasonCodes, [negative.expectedReason], negative.caseId);
  }
  assert.deepEqual(parseMaintenanceContractBundleV1("not-json"), {
    outcome: "DENIED", reasonCodes: ["INVALID_JSON_DENIED"], exitCode: 20,
  });
});

test("UD-001 public fixture is privacy-bounded and parsing never executes fixture content", () => {
  const before = JSON.stringify(fixture());
  const publicJson = JSON.stringify(fixture().doctorReport.publicProjection);
  const forbidden = [
    new RegExp("-----BEGIN " + "[A-Z ]*" + "PRIVATE" + " KEY-----"),
    /\/home\/[A-Za-z0-9._-]+\//,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    /(?:exception|stack|hostname|secret|token|privatePath)/i,
  ];
  for (const pattern of forbidden) assert.doesNotMatch(publicJson, pattern);
  const hostile = JSON.stringify({ ...fixture(), execute: "globalThis.fixtureExecuted = true" });
  (globalThis as Record<string, unknown>).fixtureExecuted = false;
  assert.equal(parseMaintenanceContractBundleV1(hostile).outcome, "DENIED");
  assert.equal((globalThis as Record<string, unknown>).fixtureExecuted, false);
  assert.equal(JSON.stringify(fixture()), before);
});
