import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";

import {
  analyticsProjectionDigestV1,
  verifyAnalyticsProjectionV1,
  type AnalyticsProjectionReasonCodeV1,
  type AnalyticsProjectionV1,
} from "../packages/contracts/src/index.js";

interface NegativeFixture {
  readonly caseId: string;
  readonly path: string;
  readonly value: unknown;
  readonly expectedReason: AnalyticsProjectionReasonCodeV1;
}

function projectionFixture(): AnalyticsProjectionV1 {
  const raw = JSON.parse(readFileSync("tests/fixtures/analytics/positive-projection-v1.json", "utf8"));
  raw.projectionDigest = analyticsProjectionDigestV1(raw);
  return raw as AnalyticsProjectionV1;
}

function mutate(source: AnalyticsProjectionV1, mutation: NegativeFixture): unknown {
  const result = structuredClone(source) as unknown as Record<string, unknown>;
  const parts = mutation.path.split("/").slice(1);
  const leaf = parts.pop();
  assert.ok(leaf);
  let target: Record<string, unknown> = result;
  for (const part of parts) target = target[part] as Record<string, unknown>;
  target[leaf] = mutation.value;
  result.projectionDigest = analyticsProjectionDigestV1(result as unknown as AnalyticsProjectionV1);
  return result;
}

function reorderObjects(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return value.map((item) => reorderObjects(item, seed + 1));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  const offset = entries.length === 0 ? 0 : seed % entries.length;
  const rotated = [...entries.slice(offset), ...entries.slice(0, offset)];
  if (seed % 2 === 1) rotated.reverse();
  return Object.fromEntries(rotated.map(([key, item], index) => [key, reorderObjects(item, seed + index + 1)]));
}

test("ANALYTICS-M1 accepts the read-only analytics projection", () => {
  const projection = projectionFixture();
  const before = structuredClone(projection);
  const schema = JSON.parse(readFileSync("schemas/contracts/chimpmaera-analytics-v1.schema.json", "utf8")) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(projection), true, JSON.stringify(validate.errors));
  assert.deepEqual(verifyAnalyticsProjectionV1(projection), {
    outcome: "VERIFIED",
    reasonCodes: ["ANALYTICS_PROJECTION_VERIFIED"],
    projectionDigest: projection.projectionDigest,
    laneCount: 2,
    directQueryAllowed: false,
    fieldClassificationCount: 8,
  });
  assert.deepEqual(projection, before, "verification must not mutate the projection");
});

test("ANALYTICS-M1 canonical projection digest is stable across 100 object-key reorderings", () => {
  const expected = analyticsProjectionDigestV1(projectionFixture());
  for (let index = 0; index < 100; index += 1) {
    const reordered = reorderObjects(projectionFixture(), index) as AnalyticsProjectionV1;
    assert.equal(analyticsProjectionDigestV1(reordered), expected, `reordering ${index}`);
  }
});

test("ANALYTICS-M1 denies authority, lane, lineage, receipt, classification, redaction, and compatibility drift", () => {
  const cases = JSON.parse(readFileSync("tests/fixtures/analytics/negative-matrix-v1.json", "utf8")) as NegativeFixture[];
  assert.equal(cases.length, 34);
  for (const negative of cases) {
    const result = verifyAnalyticsProjectionV1(mutate(projectionFixture(), negative));
    assert.equal(result.outcome, "DENIED", negative.caseId);
    assert.ok(result.reasonCodes.includes(negative.expectedReason), `${negative.caseId}: ${result.reasonCodes.join(",")}`);
  }
});

test("ANALYTICS-M1 denies digest forgery and schema version drift", () => {
  const forged = projectionFixture() as unknown as Record<string, unknown>;
  forged.projectionDigest = "f".repeat(64);
  assert.deepEqual(verifyAnalyticsProjectionV1(forged), {
    outcome: "DENIED", reasonCodes: ["ANALYTICS_PROJECTION_DIGEST_DENIED"],
  });
  const drifted = projectionFixture() as unknown as Record<string, unknown>;
  drifted.schemaVersion = "chimpmaera.analytics/v2";
  drifted.projectionDigest = analyticsProjectionDigestV1(drifted as unknown as AnalyticsProjectionV1);
  assert.deepEqual(verifyAnalyticsProjectionV1(drifted), {
    outcome: "DENIED", reasonCodes: ["ANALYTICS_PROJECTION_SCHEMA_DENIED"],
  });
});
