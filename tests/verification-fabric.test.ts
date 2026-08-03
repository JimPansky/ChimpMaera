import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  verifyVerificationFabricBundleV1,
  type VerificationFabricBundleV1,
  type VerificationReasonCodeV1,
} from "../packages/contracts/src/index.js";

interface NegativeFixture {
  readonly caseId: string;
  readonly operation: "replace" | "remove";
  readonly path: string;
  readonly value?: unknown;
  readonly expectedReason: VerificationReasonCodeV1;
}

function fixture(): VerificationFabricBundleV1 {
  return JSON.parse(readFileSync("tests/fixtures/verification-fabric/positive-bundle-v1.json", "utf8")) as VerificationFabricBundleV1;
}

function applyMutation(source: VerificationFabricBundleV1, mutation: NegativeFixture): unknown {
  const result = structuredClone(source) as unknown as Record<string, any>;
  const parts = mutation.path.split("/").slice(1);
  const leaf = parts.pop();
  assert.ok(leaf);
  let parent: any = result;
  for (const part of parts) parent = parent[part];
  if (mutation.operation === "remove") {
    if (Array.isArray(parent)) parent.splice(Number(leaf), 1);
    else delete parent[leaf];
  } else {
    parent[leaf] = mutation.value;
  }
  return result;
}

test("VF-001 freezes a schema-valid public verification contract set", () => {
  const schema = JSON.parse(readFileSync("schemas/contracts/verification-fabric-bundle-v1.schema.json", "utf8")) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const input = fixture();
  assert.equal(validate(input), true, JSON.stringify(validate.errors));
  assert.deepEqual(verifyVerificationFabricBundleV1(input), {
    outcome: "VERIFIED",
    reasonCodes: ["VERIFICATION_COMPLETE"],
  });
});

test("VF-001 denies stale missing mismatched self-produced corrupt and unredacted evidence fixtures", () => {
  const cases = JSON.parse(readFileSync(
    "tests/fixtures/verification-fabric/negative-matrix-v1.json",
    "utf8",
  )) as NegativeFixture[];
  assert.equal(cases.length, 6);
  for (const negative of cases) {
    const result = verifyVerificationFabricBundleV1(applyMutation(fixture(), negative));
    assert.equal(result.outcome, "DENIED", negative.caseId);
    assert.ok(result.reasonCodes.includes(negative.expectedReason), `${negative.caseId}: ${result.reasonCodes.join(",")}`);
  }
});

test("VF-001 rejects digest-preserving payload edits and independent LKG pointer corruption", () => {
  const changedCheck = structuredClone(fixture()) as unknown as Record<string, any>;
  changedCheck.checkRuns[0].completedAtMs += 1;
  const changedCheckResult = verifyVerificationFabricBundleV1(changedCheck);
  assert.equal(changedCheckResult.outcome, "DENIED");
  assert.ok(changedCheckResult.reasonCodes.includes("EVIDENCE_MISMATCH_DENIED"));

  const changedPointer = structuredClone(fixture()) as unknown as Record<string, any>;
  changedPointer.lkg.pointer.generation += 1;
  changedPointer.lkg.readback.observedGeneration += 1;
  const changedPointerResult = verifyVerificationFabricBundleV1(changedPointer);
  assert.equal(changedPointerResult.outcome, "DENIED");
  assert.ok(changedPointerResult.reasonCodes.includes("LKG_CORRUPT_DENIED"));
});
