import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  azureIdentityProfileDigestV1,
  verifyAzureIdentityProfileV1,
  type AzureIdentityProfileReasonCodeV1,
  type AzureIdentityProfileV1,
} from "../packages/contracts/src/index.js";

interface NegativeFixture {
  readonly caseId: string;
  readonly operation: "add" | "replace";
  readonly path: string;
  readonly value: unknown;
  readonly expectedReason: AzureIdentityProfileReasonCodeV1;
}

function fixture(): AzureIdentityProfileV1 {
  return JSON.parse(readFileSync("tests/fixtures/azure-identity/positive-profile-v1.json", "utf8")) as AzureIdentityProfileV1;
}

function mutate(source: AzureIdentityProfileV1, mutation: NegativeFixture): unknown {
  const result = structuredClone(source) as unknown as Record<string, any>;
  const parts = mutation.path.split("/").slice(1);
  const leaf = parts.pop();
  assert.ok(leaf);
  let target: any = result;
  for (const part of parts) target = target[part];
  target[leaf] = mutation.value;
  result.profileDigest = azureIdentityProfileDigestV1(result as unknown as AzureIdentityProfileV1);
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

test("AZID-M1 accepts a closed authority-free delegated identity profile", () => {
  const input = fixture();
  const before = structuredClone(input);
  const schema = JSON.parse(readFileSync("schemas/contracts/azure-identity-profile-v1.schema.json", "utf8")) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(input), true, JSON.stringify(validate.errors));
  assert.deepEqual(verifyAzureIdentityProfileV1(input), {
    outcome: "VERIFIED",
    reasonCodes: ["AZURE_IDENTITY_PROFILE_VERIFIED"],
    profileDigest: input.profileDigest,
    delegatedScopeCount: 1,
    requestedRightsCount: 0,
    routeCount: 0,
    writeTargetCount: 0,
  });
  assert.deepEqual(input, before, "verification must not mutate the profile");
});

test("AZID-M1 canonical profile digest is stable across 100 object-key reorderings", () => {
  const expected = fixture().profileDigest;
  for (let index = 0; index < 100; index += 1) {
    const reordered = reorderObjects(fixture(), index) as AzureIdentityProfileV1;
    assert.equal(azureIdentityProfileDigestV1(reordered), expected, `reordering ${index}`);
  }
});

test("AZID-M1 denies all declared flow, tenant, scope, authority, and credential drift", () => {
  const cases = JSON.parse(readFileSync("tests/fixtures/azure-identity/negative-matrix-v1.json", "utf8")) as NegativeFixture[];
  assert.equal(cases.length, 13);
  for (const negative of cases) {
    const result = verifyAzureIdentityProfileV1(mutate(fixture(), negative));
    assert.equal(result.outcome, "DENIED", negative.caseId);
    assert.ok(result.reasonCodes.includes(negative.expectedReason), `${negative.caseId}: ${result.reasonCodes.join(",")}`);
  }
});

test("AZID-M1 denies digest forgery and incompatible contract versions", () => {
  const forged = fixture() as any;
  forged.profileDigest = "f".repeat(64);
  assert.deepEqual(verifyAzureIdentityProfileV1(forged), {
    outcome: "DENIED",
    reasonCodes: ["AZURE_IDENTITY_DIGEST_DENIED"],
  });
  const incompatible = fixture() as any;
  incompatible.contractVersion = "2.0.0";
  incompatible.profileDigest = azureIdentityProfileDigestV1(incompatible);
  assert.deepEqual(verifyAzureIdentityProfileV1(incompatible), {
    outcome: "DENIED",
    reasonCodes: ["AZURE_IDENTITY_COMPATIBILITY_DENIED"],
  });
});
