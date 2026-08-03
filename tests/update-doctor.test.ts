import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  UPDATE_DOCTOR_EXIT_CODES_V1,
  updateDoctorContractDigest,
  verifyUpdateDoctorContractBundleV1,
  type UpdateDoctorContractBundleV1,
  type UpdateDoctorReasonCodeV1,
} from "../packages/contracts/src/index.js";

interface NegativeFixture {
  readonly caseId: string;
  readonly operation: "add" | "replace";
  readonly path: string;
  readonly value: unknown;
  readonly expectedReason: UpdateDoctorReasonCodeV1;
}

function fixture(): UpdateDoctorContractBundleV1 {
  return JSON.parse(readFileSync(
    "tests/fixtures/update-doctor/positive-contract-bundle-v1.json",
    "utf8",
  )) as UpdateDoctorContractBundleV1;
}

function mutate(source: UpdateDoctorContractBundleV1, mutation: NegativeFixture): unknown {
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

test("UD-001 freezes three closed JSON schemas and accepts the exact v1 fixture", () => {
  const input = fixture();
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const lock = ajv.compile(JSON.parse(readFileSync("schemas/contracts/update-lock-profile-v1.schema.json", "utf8")));
  const operation = ajv.compile(JSON.parse(readFileSync("schemas/contracts/update-operation-contract-v1.schema.json", "utf8")));
  const doctor = ajv.compile(JSON.parse(readFileSync("schemas/contracts/doctor-report-v1.schema.json", "utf8")));

  assert.equal(lock(input.lockProfile), true, JSON.stringify(lock.errors));
  assert.equal(operation(input.operationPlan), true, JSON.stringify(operation.errors));
  assert.equal(operation(input.operationReceipt), true, JSON.stringify(operation.errors));
  assert.equal(doctor(input.doctorReport), true, JSON.stringify(doctor.errors));
  assert.deepEqual(verifyUpdateDoctorContractBundleV1(input), {
    outcome: "ACCEPTED",
    reasonCodes: ["UPDATE_CONTRACT_ACCEPTED"],
    exitCode: 0,
  });
});

test("UD-001 canonical digests survive 100 object-key reorder repetitions", () => {
  const input = fixture();
  const contracts: readonly [Record<string, unknown>, string, string][] = [
    [input.lockProfile as unknown as Record<string, unknown>, "lockDigest", input.lockProfile.lockDigest],
    [input.operationPlan as unknown as Record<string, unknown>, "planDigest", input.operationPlan.planDigest],
    [input.doctorReport as unknown as Record<string, unknown>, "reportDigest", input.doctorReport.reportDigest],
    [input.operationReceipt as unknown as Record<string, unknown>, "receiptDigest", input.operationReceipt.receiptDigest],
  ];
  for (let repetition = 0; repetition < 100; repetition += 1) {
    for (const [contract, digestKey, expected] of contracts) {
      const reordered = reorderKeys(contract, repetition) as Record<string, unknown>;
      assert.equal(updateDoctorContractDigest(reordered, digestKey), expected, `${digestKey}:${repetition}`);
    }
  }
});

test("UD-001 denies v2, unknown fields, mutable targets, digest drift, authority delta, and mutation claims", () => {
  const cases = JSON.parse(readFileSync(
    "tests/fixtures/update-doctor/negative-matrix-v1-v2.json",
    "utf8",
  )) as NegativeFixture[];
  assert.equal(cases.length, 8);
  for (const negative of cases) {
    const result = verifyUpdateDoctorContractBundleV1(mutate(fixture(), negative));
    assert.equal(result.outcome, "DENIED", negative.caseId);
    assert.ok(result.reasonCodes.includes(negative.expectedReason), `${negative.caseId}:${result.reasonCodes.join(",")}`);
    assert.equal(result.exitCode, UPDATE_DOCTOR_EXIT_CODES_V1[result.reasonCodes[0]!]);
  }
});

test("UD-001 public doctor projection has no seeded secret, private path, address, or arbitrary error channel", () => {
  const publicJson = JSON.stringify(fixture().doctorReport);
  const forbidden = [
    new RegExp("-----BEGIN " + "[A-Z ]*" + "PRIVATE" + " KEY-----"),
    /\/home\/[A-Za-z0-9._-]+\//,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    /(?:exception|stack|hostname|secret|token|privatePath)/i,
  ];
  for (const pattern of forbidden) assert.doesNotMatch(publicJson, pattern);

  const seeded = [
    "-----BEGIN " + "PRIVATE" + " KEY-----",
    ["", "ho" + "me", "operator", "private", "config.json"].join("/"),
    "192.0.2.10",
    "arbitrary adapter exception",
  ];
  for (const [index, value] of seeded.entries()) {
    const negative: NegativeFixture = {
      caseId: `seeded-leak-${index}`,
      operation: "add",
      path: "/doctorReport/privateDetails",
      value,
      expectedReason: "SCHEMA_DENIED",
    };
    assert.deepEqual(verifyUpdateDoctorContractBundleV1(mutate(fixture(), negative)), {
      outcome: "DENIED",
      reasonCodes: ["SCHEMA_DENIED"],
      exitCode: 10,
    });
  }
});
