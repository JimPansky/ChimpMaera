import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";

import {
  INTEGRATION_PROFILE_VARIANTS_V1,
  evaluateIntegrationProfileV1,
  integrationProfileDigestV1,
  type IntegrationProfileReasonCodeV1,
  type IntegrationProfileV1,
} from "../packages/contracts/src/index.js";

interface NegativeProbe {
  readonly caseId: string;
  readonly path: string;
  readonly value: unknown;
  readonly expectedReason: IntegrationProfileReasonCodeV1;
}

function fixtures(): IntegrationProfileV1[] {
  return JSON.parse(readFileSync("tests/fixtures/integration-profile/positive-variants-v1.json", "utf8")) as IntegrationProfileV1[];
}

function probes(): NegativeProbe[] {
  return JSON.parse(readFileSync("tests/fixtures/integration-profile/negative-probes-v1.json", "utf8")) as NegativeProbe[];
}

function mutate(source: IntegrationProfileV1, probe: NegativeProbe): unknown {
  const result = structuredClone(source) as unknown as Record<string, unknown>;
  const parts = probe.path.split("/").slice(1);
  const leaf = parts.pop();
  assert.ok(leaf);
  let target = result;
  for (const part of parts) target = target[part] as Record<string, unknown>;
  target[leaf] = probe.value;
  result.profileDigest = integrationProfileDigestV1(result as unknown as IntegrationProfileV1);
  return result;
}

function reorderObjects(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return value.map((item, index) => reorderObjects(item, seed + index + 1));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  const offset = entries.length === 0 ? 0 : seed % entries.length;
  const rotated = [...entries.slice(offset), ...entries.slice(0, offset)];
  if (seed % 2 === 1) rotated.reverse();
  return Object.fromEntries(rotated.map(([key, item], index) => [key, reorderObjects(item, seed + index + 1)]));
}

test("INT-PROFILE-001 accepts exactly five strict local-synthetic profile variants", () => {
  const schema = JSON.parse(readFileSync("schemas/contracts/integration-profile-v1.schema.json", "utf8")) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const profiles = fixtures();
  assert.equal(profiles.length, 5);
  assert.deepEqual(profiles.map(({ integration }) => integration.variant), [...INTEGRATION_PROFILE_VARIANTS_V1]);

  for (const profile of profiles) {
    assert.equal(validate(profile), true, `${profile.identity.profileId}: ${JSON.stringify(validate.errors)}`);
    assert.equal(integrationProfileDigestV1(profile), profile.profileDigest, profile.identity.profileId);
    assert.deepEqual(evaluateIntegrationProfileV1(profile), {
      schemaVersion: "cm.integration-profile-decision/v1",
      outcome: "CONFORMANT",
      reasonCodes: ["INTEGRATION_PROFILE_CONFORMANT"],
      claimBoundary: "LOCAL_SYNTHETIC_CONTRACT_ONLY_NO_TENANT_NO_CREDENTIAL_NO_PROVIDER_CALL_NO_AUTHORITY_NO_ACTIVATION_NO_EXTERNAL_WRITE",
      profileDigest: profile.profileDigest,
    });
  }
});

test("INT-PROFILE-001 canonical digests survive 100 object-key reorderings per variant", () => {
  for (const profile of fixtures()) {
    for (let index = 0; index < 100; index += 1) {
      const reordered = reorderObjects(profile, index) as IntegrationProfileV1;
      assert.equal(integrationProfileDigestV1(reordered), profile.profileDigest, `${profile.identity.profileId}:${index}`);
    }
  }
});

test("INT-PROFILE-001 fail-closed probes return their exact finite reason codes", () => {
  const base = fixtures()[0];
  assert.ok(base);
  const negative = probes();
  assert.deepEqual(negative.map(({ caseId }) => caseId), [
    "unknown-action", "hidden-write", "private-path", "unpinned-upstream",
    "cross-tenant-reference", "stale-evidence", "incompatible-version",
    "missing-rollback-target", "generic-proxy-override",
  ]);
  for (const probe of negative) {
    const result = evaluateIntegrationProfileV1(mutate(base, probe));
    assert.equal(result.outcome, "DENIED", probe.caseId);
    assert.deepEqual(result.reasonCodes, [probe.expectedReason], probe.caseId);
  }
});

test("INT-PROFILE-001 denies unknown fields, route drift and digest forgery", () => {
  const unknown = structuredClone(fixtures()[0]) as unknown as Record<string, unknown>;
  unknown.hiddenAuthority = true;
  assert.deepEqual(evaluateIntegrationProfileV1(unknown).reasonCodes, ["SCHEMA_DENIED"]);

  const routeDrift = structuredClone(fixtures()[0]) as IntegrationProfileV1;
  const firstRoute = routeDrift.routes[0] as unknown as Record<string, unknown>;
  firstRoute.contractSchemaVersion = "cm.generic/proxy/v1";
  (routeDrift as unknown as Record<string, unknown>).profileDigest = integrationProfileDigestV1(routeDrift);
  assert.deepEqual(evaluateIntegrationProfileV1(routeDrift).reasonCodes, ["ROUTE_CONTRACT_DENIED"]);

  const forged = structuredClone(fixtures()[0]) as unknown as Record<string, unknown>;
  forged.profileDigest = "f".repeat(64);
  assert.deepEqual(evaluateIntegrationProfileV1(forged).reasonCodes, ["DIGEST_MISMATCH_DENIED"]);
});

test("INT-PROFILE-001 malformed primitives and variant/class crossover fail closed without throwing", () => {
  const malformed = structuredClone(fixtures()[0]) as unknown as Record<string, unknown>;
  (malformed.lifecycle as Record<string, unknown>).rollbackTarget = null;
  assert.doesNotThrow(() => evaluateIntegrationProfileV1(malformed));
  assert.deepEqual(evaluateIntegrationProfileV1(malformed).reasonCodes, ["SCHEMA_DENIED"]);

  const crossover = structuredClone(fixtures()[0]) as IntegrationProfileV1;
  (crossover.integration as unknown as Record<string, unknown>).capabilityClass = "EXPORT_ONLY";
  (crossover.data as unknown as Record<string, unknown>).projectionClass = "EXPORT_ONLY";
  (crossover as unknown as Record<string, unknown>).profileDigest = integrationProfileDigestV1(crossover);
  assert.deepEqual(evaluateIntegrationProfileV1(crossover).reasonCodes, ["SCHEMA_DENIED"]);
});

test("INT-PROFILE-001 public fixtures contain no credential, provider or real tenant material", () => {
  const positive = readFileSync("tests/fixtures/integration-profile/positive-variants-v1.json", "utf8");
  for (const denied of [
    /-----BEGIN .*PRIVATE KEY-----/,
    /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /\/home\/[A-Za-z0-9._-]+\//,
    /\/mnt\/[A-Za-z0-9._-]+\//,
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  ]) assert.equal(denied.test(positive), false, denied.source);
});
