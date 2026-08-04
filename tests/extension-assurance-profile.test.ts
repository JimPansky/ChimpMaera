import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  EXTENSION_ASSURANCE_HARD_FAIL_RULES_V1,
  EXTENSION_ASSURANCE_RETEST_TRIGGERS_V1,
  evaluateExtensionAssuranceProfileV1,
  extensionAssuranceProfileDigestV1,
  renderPublicExtensionAssuranceResultV1,
  type ExtensionAssuranceProfileV1,
  type ExtensionAssuranceReasonCodeV1,
} from "../packages/contracts/src/index.js";

interface NegativeFixture {
  readonly caseId: string;
  readonly operation: "replace" | "remove";
  readonly path: string;
  readonly value?: unknown;
  readonly expectedReason: ExtensionAssuranceReasonCodeV1;
}

function fixture(): ExtensionAssuranceProfileV1 {
  return JSON.parse(readFileSync(
    "tests/fixtures/extension-assurance/positive-profile-v1.json",
    "utf8",
  )) as ExtensionAssuranceProfileV1;
}

function mutate(source: ExtensionAssuranceProfileV1, mutation: NegativeFixture): Record<string, any> {
  const result = structuredClone(source) as unknown as Record<string, any>;
  const parts = mutation.path.split("/").slice(1);
  const leaf = parts.pop();
  assert.ok(leaf !== undefined);
  let parent: any = result;
  for (const part of parts) parent = parent[part];
  if (mutation.operation === "remove") {
    if (Array.isArray(parent)) parent.splice(Number(leaf), 1);
    else delete parent[leaf];
  } else parent[leaf] = mutation.value;
  result.profileDigest = extensionAssuranceProfileDigestV1(result);
  return result;
}

function reorderKeys(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return value.map((item) => reorderKeys(item, seed + 1));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  const offset = entries.length === 0 ? 0 : seed % entries.length;
  const rotated = [...entries.slice(offset), ...entries.slice(0, offset)].reverse();
  return Object.fromEntries(rotated.map(([key, item]) => [key, reorderKeys(item, seed + 1)]));
}

test("ETL-01 freezes one closed schema with every required assurance field", () => {
  const schema = JSON.parse(readFileSync(
    "schemas/contracts/extension-assurance-profile-v1.schema.json",
    "utf8",
  )) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const input = fixture();
  assert.equal(validate(input), true, JSON.stringify(validate.errors));
  assert.equal(input.checks.length, EXTENSION_ASSURANCE_HARD_FAIL_RULES_V1.length + 1);
  assert.deepEqual(input.retestTriggers, EXTENSION_ASSURANCE_RETEST_TRIGGERS_V1);
  assert.deepEqual(evaluateExtensionAssuranceProfileV1(input), {
    schemaVersion: "chimpmaera.extension-trust/assurance-result/v1",
    outcome: "PROFILE_CONFORMANT",
    reasonCodes: ["PROFILE_CONFORMANT"],
    publicClaim: "LOCALLY_EVALUATED_SYNTHETIC",
    claimBoundary: "LOCAL_SYNTHETIC_PROFILE_ONLY_NO_TRUST_BADGE_NO_ACCEPTANCE_NO_ACTIVATION_NO_EXECUTION",
  });
});

test("ETL-01 profile digest survives 100 object-key reorder repetitions", () => {
  const input = fixture();
  for (let repetition = 0; repetition < 100; repetition += 1) {
    const reordered = reorderKeys(input, repetition) as Record<string, unknown>;
    assert.equal(extensionAssuranceProfileDigestV1(reordered), input.profileDigest, String(repetition));
  }
});

test("ETL-01 denies every universal hard fail and routes clean retest cases", () => {
  const cases = JSON.parse(readFileSync(
    "tests/fixtures/extension-assurance/negative-matrix-v1.json",
    "utf8",
  )) as NegativeFixture[];
  assert.equal(cases.length, 14);
  assert.deepEqual(cases.slice(0, 8).map(({ caseId }) => caseId), [
    "malware-hard-fail", "credential-hard-fail", "authority-hard-fail", "egress-hard-fail",
    "executable-hard-fail", "disclosure-hard-fail", "signature-hard-fail", "evidence-tamper-hard-fail",
  ]);
  for (const negative of cases) {
    const result = evaluateExtensionAssuranceProfileV1(mutate(fixture(), negative));
    assert.ok(result.reasonCodes.includes(negative.expectedReason), `${negative.caseId}:${result.reasonCodes.join(",")}`);
    const retestOnly = [
      "EVIDENCE_STALE_RETEST_REQUIRED", "EVIDENCE_MISMATCH_RETEST_REQUIRED", "FALSE_NEGATIVE_RETEST_REQUIRED",
    ].includes(negative.expectedReason);
    assert.equal(result.outcome, retestOnly ? "RETEST_REQUIRED" : "DENIED", negative.caseId);
  }
});

test("ETL-01 denies missing universal gates, unknown fields and digest-preserving edits", () => {
  const missing = fixture() as unknown as Record<string, any>;
  missing.checks.splice(0, 1);
  missing.profileDigest = extensionAssuranceProfileDigestV1(missing);
  assert.ok(evaluateExtensionAssuranceProfileV1(missing).reasonCodes.includes("UNIVERSAL_GATE_MISSING_DENIED"));

  const unknown = fixture() as unknown as Record<string, any>;
  unknown.runtimeActivation = true;
  assert.deepEqual(evaluateExtensionAssuranceProfileV1(unknown).reasonCodes, ["SCHEMA_DENIED"]);

  const drift = fixture() as unknown as Record<string, any>;
  drift.riskClass = "CRITICAL";
  assert.ok(evaluateExtensionAssuranceProfileV1(drift).reasonCodes.includes("DIGEST_MISMATCH_DENIED"));
});

test("ETL-01 security-shaped inputs route privately and emit zero seeded disclosure bytes", () => {
  const privateRoute = fixture() as unknown as Record<string, any>;
  privateRoute.securityRouting = {
    classification: "SECURITY_SENSITIVE",
    route: "SECURITY_POLICY_PRIVATE",
    publicDetail: "NONE",
  };
  privateRoute.profileDigest = extensionAssuranceProfileDigestV1(privateRoute);
  assert.equal(evaluateExtensionAssuranceProfileV1(privateRoute).outcome, "PROFILE_CONFORMANT");

  const seeded = [
    "-----BEGIN " + "PRIVATE KEY-----",
    ["", "ho" + "me", "operator", "private", "finding.txt"].join("/"),
    "gh" + "p_seededNotARealCredential000000000",
    "security@example.invalid",
  ];
  for (const sensitiveValue of seeded) {
    const shaped = structuredClone(privateRoute) as Record<string, any>;
    shaped.securityFinding = sensitiveValue;
    const publicBytes = renderPublicExtensionAssuranceResultV1(shaped);
    assert.equal(publicBytes.includes(sensitiveValue), false);
    assert.deepEqual(Object.keys(JSON.parse(publicBytes)).sort(), [
      "claimBoundary", "outcome", "publicClaim", "reasonCodes", "schemaVersion",
    ]);
  }
});
