import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  hmiGenerationDigestV1,
  normalizeHmiSemanticResultV1,
  verifyHmiGenerationV1,
  type HmiGenerationBundleV1,
  type HmiGenerationManifestV1,
  type HmiGenerationReasonCodeV1,
} from "../packages/contracts/src/index.js";

interface NegativeFixture {
  readonly caseId: string;
  readonly operation: "add" | "replace" | "append";
  readonly path: string;
  readonly value: unknown;
  readonly expectedReason: HmiGenerationReasonCodeV1;
}

function fixture(): HmiGenerationBundleV1 {
  return JSON.parse(readFileSync("tests/fixtures/hmi/positive-generation-v1.json", "utf8")) as HmiGenerationBundleV1;
}

function mutate(source: HmiGenerationBundleV1, mutation: NegativeFixture): unknown {
  const result = structuredClone(source) as unknown as Record<string, any>;
  const parts = mutation.path.split("/").slice(1);
  let target: any = result;
  for (const part of parts) target = target[part];
  if (mutation.operation === "append") target.push(mutation.value);
  else {
    const leaf = parts.pop();
    assert.ok(leaf);
    let parent: any = result;
    for (const part of parts) parent = parent[part];
    parent[leaf] = mutation.value;
  }
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

test("HMI-M1 accepts one closed immutable authority-free synthetic generation", () => {
  const input = fixture();
  const before = structuredClone(input);
  const schema = JSON.parse(readFileSync("schemas/contracts/hmi-generation-bundle-v1.schema.json", "utf8")) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(input), true, JSON.stringify(validate.errors));
  assert.deepEqual(verifyHmiGenerationV1(input), {
    outcome: "VERIFIED",
    reasonCodes: ["HMI_GENERATION_VERIFIED"],
    generationDigest: input.manifest.generationDigest,
    fileCount: 3,
    rightsCount: 0,
    routeCount: 0,
    writeTargetCount: 0,
  });
  assert.deepEqual(input, before, "verification must not mutate the supplied generation");
});

test("HMI-M1 canonical generation digest is stable across 100 object-key reorderings", () => {
  const expected = fixture().manifest.generationDigest;
  for (let index = 0; index < 100; index += 1) {
    const reordered = reorderObjects(fixture().manifest, index) as HmiGenerationManifestV1;
    assert.equal(hmiGenerationDigestV1(reordered), expected, `reordering ${index}`);
  }
});

test("HMI-M1 normalizes Unicode and object keys while preserving array semantics", () => {
  const first = normalizeHmiSemanticResultV1({ z: ["second", "first"], label: "Cafe\u0301" });
  const second = normalizeHmiSemanticResultV1({ label: "Caf\u00e9", z: ["second", "first"] });
  assert.deepEqual(first, second);
  assert.equal(first.canonicalBytes, "{\"label\":\"Caf\u00e9\",\"z\":[\"second\",\"first\"]}");
  assert.throws(() => normalizeHmiSemanticResultV1({ "Cafe\u0301": 1, "Caf\u00e9": 2 }), /Unicode-colliding/);
});

test("HMI-M1 denies all declared path, file, authority, and content drift probes", () => {
  const cases = JSON.parse(readFileSync("tests/fixtures/hmi/negative-matrix-v1.json", "utf8")) as NegativeFixture[];
  assert.equal(cases.length, 10);
  for (const negative of cases) {
    const result = verifyHmiGenerationV1(mutate(fixture(), negative));
    assert.equal(result.outcome, "DENIED", negative.caseId);
    assert.ok(result.reasonCodes.includes(negative.expectedReason), `${negative.caseId}: ${result.reasonCodes.join(",")}`);
  }
});

test("HMI-M1 denies a forged manifest digest and an omitted declared file", () => {
  const forged = fixture() as any;
  forged.manifest.generationDigest = "f".repeat(64);
  assert.deepEqual(verifyHmiGenerationV1(forged), {
    outcome: "DENIED",
    reasonCodes: ["HMI_GENERATION_DIGEST_DENIED"],
  });
  const missing = fixture() as any;
  missing.files.splice(0, 1);
  assert.deepEqual(verifyHmiGenerationV1(missing), {
    outcome: "DENIED",
    reasonCodes: ["HMI_FILE_SET_DENIED"],
  });

  const unboundCapability = fixture() as any;
  unboundCapability.manifest.capabilities[0].descriptorDigest = "a".repeat(64);
  unboundCapability.manifest.generationDigest = hmiGenerationDigestV1(unboundCapability.manifest);
  assert.deepEqual(verifyHmiGenerationV1(unboundCapability), {
    outcome: "DENIED",
    reasonCodes: ["HMI_CAPABILITY_DENIED"],
  });
});
