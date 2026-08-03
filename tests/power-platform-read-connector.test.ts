import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  powerPlatformReadConnectorDigestV1,
  verifyPowerPlatformReadConnectorV1,
  type AzureIdentityProfileV1,
  type PowerPlatformReadConnectorReasonCodeV1,
  type PowerPlatformReadConnectorV1,
} from "../packages/contracts/src/index.js";

interface NegativeFixture {
  readonly caseId: string;
  readonly path: string;
  readonly value: unknown;
  readonly expectedReason: PowerPlatformReadConnectorReasonCodeV1;
}

function contractFixture(): PowerPlatformReadConnectorV1 {
  return JSON.parse(readFileSync("tests/fixtures/power-platform/positive-read-connector-v1.json", "utf8")) as PowerPlatformReadConnectorV1;
}

function identityFixture(): AzureIdentityProfileV1 {
  return JSON.parse(readFileSync("tests/fixtures/azure-identity/positive-profile-v1.json", "utf8")) as AzureIdentityProfileV1;
}

function mutate(source: PowerPlatformReadConnectorV1, mutation: NegativeFixture): unknown {
  const result = structuredClone(source) as unknown as Record<string, any>;
  const parts = mutation.path.split("/").slice(1);
  const leaf = parts.pop();
  assert.ok(leaf);
  let target: any = result;
  for (const part of parts) target = target[part];
  target[leaf] = mutation.value;
  result.contractDigest = powerPlatformReadConnectorDigestV1(result as unknown as PowerPlatformReadConnectorV1);
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

test("PPREAD-M1 accepts the five-operation authority-free read connector", () => {
  const contract = contractFixture();
  const before = structuredClone(contract);
  const schema = JSON.parse(readFileSync("schemas/contracts/power-platform-read-connector-v1.schema.json", "utf8")) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(contract), true, JSON.stringify(validate.errors));
  assert.deepEqual(verifyPowerPlatformReadConnectorV1(contract, identityFixture()), {
    outcome: "VERIFIED",
    reasonCodes: ["POWER_PLATFORM_READ_CONNECTOR_VERIFIED"],
    contractDigest: contract.contractDigest,
    operationCount: 5,
    writeOperationCount: 0,
    requestedRightsCount: 0,
    writeTargetCount: 0,
  });
  assert.deepEqual(contract, before, "verification must not mutate the contract");
});

test("PPREAD-M1 canonical contract digest is stable across 100 object-key reorderings", () => {
  const expected = contractFixture().contractDigest;
  for (let index = 0; index < 100; index += 1) {
    const reordered = reorderObjects(contractFixture(), index) as PowerPlatformReadConnectorV1;
    assert.equal(powerPlatformReadConnectorDigestV1(reordered), expected, `reordering ${index}`);
  }
});

test("PPREAD-M1 denies declared operation, authority, lifecycle, and credential drift", () => {
  const cases = JSON.parse(readFileSync("tests/fixtures/power-platform/negative-matrix-v1.json", "utf8")) as NegativeFixture[];
  assert.equal(cases.length, 11);
  for (const negative of cases) {
    const result = verifyPowerPlatformReadConnectorV1(mutate(contractFixture(), negative), identityFixture());
    assert.equal(result.outcome, "DENIED", negative.caseId);
    assert.ok(result.reasonCodes.includes(negative.expectedReason), `${negative.caseId}: ${result.reasonCodes.join(",")}`);
  }
});

test("PPREAD-M1 denies identity substitution, digest forgery, and incompatible versions", () => {
  const substitutedIdentity = identityFixture() as any;
  substitutedIdentity.profileId = "identity:substituted-profile";
  assert.deepEqual(verifyPowerPlatformReadConnectorV1(contractFixture(), substitutedIdentity), {
    outcome: "DENIED", reasonCodes: ["POWER_PLATFORM_CONNECTOR_IDENTITY_DENIED"],
  });
  const forged = contractFixture() as any;
  forged.contractDigest = "f".repeat(64);
  assert.deepEqual(verifyPowerPlatformReadConnectorV1(forged, identityFixture()), {
    outcome: "DENIED", reasonCodes: ["POWER_PLATFORM_CONNECTOR_DIGEST_DENIED"],
  });
  const incompatible = contractFixture() as any;
  incompatible.contractVersion = "2.0.0";
  incompatible.contractDigest = powerPlatformReadConnectorDigestV1(incompatible);
  assert.deepEqual(verifyPowerPlatformReadConnectorV1(incompatible, identityFixture()), {
    outcome: "DENIED", reasonCodes: ["POWER_PLATFORM_CONNECTOR_COMPATIBILITY_DENIED"],
  });
});
