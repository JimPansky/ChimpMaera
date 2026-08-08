import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  OPERATION_EVENT_QUALITY_CLAIM_BOUNDARY_V1,
  OPERATION_EVENT_QUALITY_FIELD_CLASSIFICATIONS_V1,
  OPERATION_EVENT_QUALITY_PROHIBITED_FIELDS_V1,
  evaluateOperationEventQualityV1,
  operationEventQualityEventDigestV1,
  operationEventQualityRecordDigestV1,
  renderPublicOperationEventQualityDecisionV1,
  type OperationEventQualityReasonCodeV1,
  type OperationEventQualityRecordV1,
} from "../packages/contracts/src/index.js";

interface MutationFixture {
  readonly caseId: string;
  readonly operation: "replace" | "replace-no-rehash" | "delete";
  readonly path: string;
  readonly value?: unknown;
  readonly expectedReason: OperationEventQualityReasonCodeV1;
}

function fixture(): OperationEventQualityRecordV1 {
  return JSON.parse(readFileSync(
    "tests/fixtures/operation-event-quality/positive-public-v1.json",
    "utf8",
  )) as OperationEventQualityRecordV1;
}

function replacePath(target: Record<string, any>, pointer: string, value: unknown): void {
  const parts = pointer.split("/").slice(1);
  const leaf = parts.pop();
  assert.ok(leaf !== undefined);
  let parent: any = target;
  for (const part of parts) parent = parent[part];
  parent[leaf] = value;
}

function deletePath(target: Record<string, any>, pointer: string): void {
  const parts = pointer.split("/").slice(1);
  const leaf = parts.pop();
  assert.ok(leaf !== undefined);
  let parent: any = target;
  for (const part of parts) parent = parent[part];
  delete parent[leaf];
}

function rehash(target: Record<string, any>): void {
  target.source.eventDigest = operationEventQualityEventDigestV1(target as OperationEventQualityRecordV1);
  target.recordDigest = operationEventQualityRecordDigestV1(target);
}

test("CM-OBS-001 freezes a closed operation event quality schema", () => {
  const schema = JSON.parse(readFileSync(
    "schemas/contracts/operation-event-quality-v1.schema.json",
    "utf8",
  )) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const input = fixture();
  assert.equal(validate(input), true, JSON.stringify(validate.errors));
  assert.deepEqual(evaluateOperationEventQualityV1(input), {
    schemaVersion: "chimpmaera.cm-obs/operation-event-quality-decision/v1",
    outcome: "ACCEPTED",
    reasonCodes: ["OBS_RECORD_CONFORMANT"],
    claimBoundary: OPERATION_EVENT_QUALITY_CLAIM_BOUNDARY_V1,
  });

  const classifiedPaths = OPERATION_EVENT_QUALITY_FIELD_CLASSIFICATIONS_V1.map(([path]) => path);
  assert.equal(classifiedPaths.length, 31);
  assert.equal(new Set(classifiedPaths).size, classifiedPaths.length);
  assert.deepEqual(classifiedPaths.slice(0, 6), [
    "/schemaVersion", "/operation/operationId", "/operation/runId",
    "/operation/attemptId", "/operation/traceId", "/operation/correlationId",
  ]);
  assert.deepEqual(classifiedPaths.slice(-3), [
    "/retention/rollbackProfile", "/claimBoundary", "/recordDigest",
  ]);
});

test("CM-OBS-001 binds sequence operation time raw evidence and assessment digests", () => {
  const input = fixture();
  assert.equal(operationEventQualityEventDigestV1(input), input.source.eventDigest);
  assert.equal(operationEventQualityRecordDigestV1(input as unknown as Record<string, unknown>), input.recordDigest);

  const changed = structuredClone(input) as unknown as Record<string, any>;
  changed.operation.traceId = "11111111111111111111111111111111";
  changed.recordDigest = operationEventQualityRecordDigestV1(changed);
  assert.deepEqual(
    evaluateOperationEventQualityV1(changed).reasonCodes,
    ["EVENT_DIGEST_MISMATCH_DENIED"],
  );
});

test("CM-OBS-001 negative matrix covers corrupt missing late raw and quality states", () => {
  const cases = JSON.parse(readFileSync(
    "tests/fixtures/operation-event-quality/negative-matrix-v1.json",
    "utf8",
  )) as MutationFixture[];
  assert.equal(cases.length, 8);
  for (const negative of cases) {
    const input = structuredClone(fixture()) as unknown as Record<string, any>;
    if (negative.operation === "delete") deletePath(input, negative.path);
    else replacePath(input, negative.path, negative.value);
    if (negative.operation === "replace") rehash(input);
    const result = evaluateOperationEventQualityV1(input);
    assert.ok(result.reasonCodes.includes(negative.expectedReason), `${negative.caseId}:${result.reasonCodes.join(",")}`);
    assert.equal(result.outcome, "DENIED", negative.caseId);
  }
});

test("CM-OBS-001 public decision projection leaks no seeded raw evidence bytes", () => {
  assert.equal(OPERATION_EVENT_QUALITY_PROHIBITED_FIELDS_V1.length, 18);
  const seeded = [
    "-----BEGIN " + "PRIVATE KEY-----",
    ["", "home", "operator", "private", "cm-obs.json"].join("/"),
    "gh" + "p_seededNotARealCredential000000000",
    "tenant-00000000-0000-0000-0000-000000000000",
  ];
  for (const sensitiveValue of seeded) {
    const input = structuredClone(fixture()) as unknown as Record<string, any>;
    input.source.detail = sensitiveValue;
    rehash(input);
    const publicBytes = renderPublicOperationEventQualityDecisionV1(input);
    assert.equal(publicBytes.includes(sensitiveValue), false);
    assert.deepEqual(Object.keys(JSON.parse(publicBytes)).sort(), [
      "claimBoundary", "outcome", "reasonCodes", "schemaVersion",
    ]);
    assert.ok(publicBytes.includes(OPERATION_EVENT_QUALITY_CLAIM_BOUNDARY_V1));
  }
});
