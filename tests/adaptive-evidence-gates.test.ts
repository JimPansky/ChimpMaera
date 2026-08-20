import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  ADAPTIVE_GATE_RECEIPT_SCHEMA_V1,
  ADAPTIVE_GATE_SPEC_SCHEMA_V1,
  ADAPTIVE_GATE_VERIFIER_VERSION_V1,
  adaptDeliveryConveyorReadbackV1,
  adaptiveReceiptDigestV1,
  adaptiveScopeDigestV1,
  adaptiveSpecDigestV1,
  projectAdaptiveCompletionV1,
  selectAdaptiveProfilesV1,
  validateAdaptiveDeliveryHistoryV1,
  validateAdaptiveGateSpecV1,
  verifyAdaptiveGatesV1,
  verifyAdaptiveReceiptV1,
  type AdaptiveCheckIdV1,
  type AdaptiveCheckResultV1,
  type AdaptiveGateReceiptV1,
  type AdaptiveGateSpecV1,
} from "../packages/contracts/src/index.js";

const NOW = 1_000_000;
const RESULT: AdaptiveCheckResultV1 = { exitCode: 0, stdout: "PASS\n", stderr: "", timedOut: false };
const CHECKS: readonly AdaptiveCheckIdV1[] = ["docs-build", "docs-spelling"];

function sha(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function spec(overrides: Partial<AdaptiveGateSpecV1> = {}): AdaptiveGateSpecV1 {
  const scope = overrides.scope ?? ["docs/ADAPTIVE-EVIDENCE-GATES.md"];
  return {
    schemaVersion: ADAPTIVE_GATE_SPEC_SCHEMA_V1,
    sliceId: "adaptive-docs",
    rootGoal: "Prove adaptive evidence root truth",
    subjectDigest: "a".repeat(64),
    scope,
    scopeDigest: adaptiveScopeDigestV1(scope),
    sliceType: "docs-only",
    risks: [],
    requestedProfiles: [],
    releaseRequired: false,
    productEvidenceRequired: false,
    evidenceMaxAgeMs: 10_000,
    gates: CHECKS.map((checkId) => ({ id: `gate-${checkId}`, checkId, expect: { exitCode: 0, stdout: "PASS\n" }, dependsOn: [] })),
    ...overrides,
  };
}

function execute(result = RESULT): readonly [AdaptiveCheckResultV1, AdaptiveCheckResultV1] {
  return [result, structuredClone(result)];
}

function verify(input: unknown, extra: Partial<Parameters<typeof verifyAdaptiveGatesV1>[0]> = {}) {
  return verifyAdaptiveGatesV1({ spec: input, nowMs: NOW, execute: () => execute(), ...extra });
}

function reason(result: ReturnType<typeof verifyAdaptiveGatesV1>): string | undefined {
  return result.outcome === "DENIED" ? result.reason : undefined;
}

function completion(args: Parameters<typeof projectAdaptiveCompletionV1>[0]) {
  const result = projectAdaptiveCompletionV1(args);
  assert.equal("outcome" in result, false);
  if ("outcome" in result) throw new Error(result.reason);
  return result;
}

test("schema and runtime freeze a closed adaptive specification", () => {
  const schema = JSON.parse(readFileSync("schemas/contracts/adaptive-evidence-gate-spec-v1.schema.json", "utf8"));
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  assert.equal(validate(spec()), true, JSON.stringify(validate.errors));
  assert.equal(validateAdaptiveGateSpecV1(spec()), true);
  assert.equal(validate({ ...spec(), checkbox: true }), false);
});

test("receipt schema is closed", () => {
  const schema = JSON.parse(readFileSync("schemas/contracts/adaptive-evidence-receipt-v1.schema.json", "utf8"));
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  const result = verify(spec());
  assert.equal(result.outcome, "PASS");
  if (result.outcome === "PASS") assert.equal(validate(result.receipts[0]), true, JSON.stringify(validate.errors));
});

test("docs-only selects only proportional docs gates", () => {
  assert.deepEqual(selectAdaptiveProfilesV1({ sliceType: "docs-only", risks: [], requestedProfiles: [], releaseRequired: false }), {
    outcome: "SELECTED", profiles: ["docs-minimal"],
  });
});

test("risk and release profiles are additive and deterministic", () => {
  assert.deepEqual(selectAdaptiveProfilesV1({
    sliceType: "code-runtime", risks: ["external", "security"], requestedProfiles: [], releaseRequired: true,
  }), { outcome: "SELECTED", profiles: ["code-runtime", "security-trust-boundary", "external-integration", "release-required"] });
});

test("unknown type, profile and risk deny", () => {
  assert.equal(selectAdaptiveProfilesV1({ sliceType: "mystery", risks: [], requestedProfiles: [], releaseRequired: false }).outcome, "DENIED");
  assert.deepEqual(selectAdaptiveProfilesV1({ sliceType: "docs-only", risks: ["mystery"], requestedProfiles: [], releaseRequired: false }), { outcome: "DENIED", reason: "UNKNOWN_RISK_ATTRIBUTE" });
  assert.deepEqual(selectAdaptiveProfilesV1({ sliceType: "docs-only", risks: [], requestedProfiles: ["mystery"], releaseRequired: false }), { outcome: "DENIED", reason: "UNKNOWN_PROFILE" });
});

test("happy verifier emits deterministic fresh digest-bound receipts", () => {
  const first = verify(spec());
  const second = verify(spec());
  assert.deepEqual(first, second);
  assert.equal(first.outcome, "PASS");
  if (first.outcome === "PASS") {
    assert.equal(first.receipts.length, 2);
    assert.match(first.selectionDigest, /^[a-f0-9]{64}$/);
    assert.equal(first.receipts.every((receipt) => receipt.expiresAtMs === NOW + 10_000), true);
  }
});

test("checkbox and prose cannot replace executable evidence", () => {
  assert.equal(reason(verify({ ...spec(), gates: [], checkbox: true })), "MISSING_CHECK_EXPECT");
});

test("missing CHECK or EXPECT denies", () => {
  const missing = structuredClone(spec()) as unknown as { gates: Record<string, unknown>[] };
  delete missing.gates[0]?.expect;
  assert.equal(reason(verify(missing)), "MISSING_CHECK_EXPECT");
});

test("failing command denies even when stdout claims PASS", () => {
  const result = verifyAdaptiveGatesV1({ spec: spec(), nowMs: NOW, execute: () => execute({ ...RESULT, exitCode: 7 }) });
  assert.equal(result.outcome, "DENIED");
  if (result.outcome === "DENIED") assert.equal(result.reason, "CHECK_FAILED");
});

test("timeouts fail closed", () => {
  const result = verifyAdaptiveGatesV1({ spec: spec(), nowMs: NOW, execute: () => execute({ ...RESULT, timedOut: true }) });
  assert.equal(result.outcome, "DENIED");
  if (result.outcome === "DENIED") assert.equal(result.reason, "CHECK_TIMEOUT");
});

test("flaky repeated result fails closed", () => {
  const result = verifyAdaptiveGatesV1({ spec: spec(), nowMs: NOW, execute: () => [RESULT, { ...RESULT, stdout: "DRIFT\n" }] });
  assert.equal(result.outcome, "DENIED");
  if (result.outcome === "DENIED") assert.equal(result.reason, "FLAKY_RESULT");
});

test("fresh receipt validates and stale or forged receipt denies", () => {
  const result = verify(spec());
  assert.equal(result.outcome, "PASS");
  if (result.outcome !== "PASS") return;
  const receipt = result.receipts[0];
  assert.ok(receipt);
  assert.equal(verifyAdaptiveReceiptV1(receipt, NOW).outcome, "PASS");
  assert.equal(reason(verifyAdaptiveReceiptV1(receipt, NOW + 10_001)), "STALE_RECEIPT");
  assert.equal(reason(verifyAdaptiveReceiptV1({ ...receipt, resultDigest: "b".repeat(64) }, NOW)), "FORGED_COUNT_OR_DIGEST");
});

test("forged profile count and digest deny", () => {
  assert.equal(reason(verify(spec(), { claimedCount: 9 })), "FORGED_COUNT_OR_DIGEST");
  assert.equal(reason(verify(spec(), { claimedSelectionDigest: "f".repeat(64) })), "FORGED_COUNT_OR_DIGEST");
});

test("expected root scope prevents silent scope shrink", () => {
  assert.equal(reason(verify(spec(), { expectedScope: ["docs/ADAPTIVE-EVIDENCE-GATES.md", "package.json"] })), "SILENT_SCOPE_SHRINK");
});

test("unsafe paths and unregistered commands deny before execution", () => {
  const unsafe = { ...spec(), scope: ["../escape"], scopeDigest: adaptiveScopeDigestV1(["../escape"]) };
  assert.equal(reason(verify(unsafe)), "UNSAFE_EVALUATOR_INPUT");
  const command = structuredClone(spec()) as unknown as { gates: Record<string, unknown>[] };
  command.gates[0]!.checkId = "node -e process.exit(0); touch owned";
  assert.equal(reason(verify(command)), "UNSAFE_EVALUATOR_INPUT");
});

test("CLI registry rejects surplus arguments", () => {
  const result = spawnSync(process.execPath, ["scripts/adaptive-evidence-gates.mjs", "--registry", "extra"], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "UNSAFE_EVALUATOR_INPUT\n");
});

test("delegated evidence requires a fresh matching receipt and parent rerun", () => {
  const delegatedSpec = spec({ gates: spec().gates.map((gate, index) => index === 0 ? { ...gate, delegated: true } : gate) });
  const resultDigest = sha(RESULT);
  const firstGate = delegatedSpec.gates[0];
  assert.ok(firstGate);
  const unsigned = {
    schemaVersion: ADAPTIVE_GATE_RECEIPT_SCHEMA_V1,
    gateId: firstGate.id,
    checkId: firstGate.checkId,
    subjectDigest: delegatedSpec.subjectDigest,
    specDigest: adaptiveSpecDigestV1(delegatedSpec),
    expectationDigest: sha(firstGate.expect),
    verifierVersion: ADAPTIVE_GATE_VERIFIER_VERSION_V1,
    resultDigest,
    observedAtMs: NOW - 1,
    expiresAtMs: NOW + 1_000,
  } as const;
  const receipt: AdaptiveGateReceiptV1 = { ...unsigned, receiptDigest: adaptiveReceiptDigestV1(unsigned) };
  assert.equal(reason(verify(delegatedSpec)), "DELEGATED_NOT_REVERIFIED");
  const passed = verify(delegatedSpec, { delegatedReceipts: { [firstGate.id]: receipt } });
  assert.equal(passed.outcome, "PASS");
  if (passed.outcome === "PASS") assert.equal(passed.parentReverifications, 1);
});

test("dependency cycles and unknown dependencies fail closed", () => {
  const unknown = spec({ gates: spec().gates.map((gate, index) => index === 0 ? { ...gate, dependsOn: ["missing-gate"] } : gate) });
  assert.equal(validateAdaptiveGateSpecV1(unknown), false);
  assert.equal(reason(verify(unknown)), "INVALID_DEPENDENCIES");
  const cyclicGates = spec().gates.map((gate, index, gates) => ({ ...gate, dependsOn: [gates[(index + 1) % gates.length]!.id] }));
  const cyclic = spec({ gates: cyclicGates });
  assert.equal(validateAdaptiveGateSpecV1(cyclic), false);
  assert.equal(reason(verify(cyclic)), "CYCLIC_DEPENDENCIES");
});

test("delivery state machine accepts only ordered terminal chains", () => {
  const terminal = ["PR_READY", "PR_OPEN", "CI_GREEN", "MERGED", "RELEASE_DECISION", "RELEASED"] as const;
  assert.equal(validateAdaptiveDeliveryHistoryV1(terminal), null);
  assert.equal(validateAdaptiveDeliveryHistoryV1(["PR_READY", "CI_GREEN"]), "INVALID_STATE_JUMP");
});

test("open PR, CI and release-decision prefixes remain nonterminal", () => {
  for (const history of [
    ["PR_READY", "PR_OPEN"],
    ["PR_READY", "PR_OPEN", "CI_GREEN"],
    ["PR_READY", "PR_OPEN", "CI_GREEN", "MERGED", "RELEASE_DECISION"],
  ] as const) {
    const result = completion({ verificationPassed: true, waitingExternal: false, activeSinceMs: NOW, nowMs: NOW, deadmanMs: 1_000, deliveryHistory: history, releaseRequired: true, productEvidenceRequired: false, productEvidenceComplete: false });
    assert.equal(result.rootState, "OPEN");
  }
});

test("product evidence remains separate from local and delivery completion", () => {
  const result = completion({ verificationPassed: true, waitingExternal: false, activeSinceMs: NOW, nowMs: NOW, deadmanMs: 1_000, deliveryHistory: ["PR_READY", "PR_OPEN", "CI_GREEN", "MERGED", "RELEASE_DECISION", "RELEASED"], releaseRequired: true, productEvidenceRequired: true, productEvidenceComplete: false });
  assert.equal(result.productEvidenceState, "OPEN");
  assert.equal(result.rootState, "OPEN");
});

test("100 percent root truth advances phase", () => {
  const result = completion({ verificationPassed: true, waitingExternal: false, activeSinceMs: NOW, nowMs: NOW, deadmanMs: 1_000, deliveryHistory: ["PR_READY", "PR_OPEN", "CI_GREEN", "MERGED", "RELEASE_DECISION", "RELEASED"], releaseRequired: true, productEvidenceRequired: false, productEvidenceComplete: false });
  assert.equal(result.rootState, "COMPLETE");
  assert.equal(result.nextAction, "ADVANCE_PHASE");
});

test("deadman marks stale active work ATTENTION, never success", () => {
  const result = completion({ verificationPassed: false, waitingExternal: false, activeSinceMs: 0, nowMs: 2_000, deadmanMs: 1_000, deliveryHistory: ["PR_READY"], releaseRequired: true, productEvidenceRequired: false, productEvidenceComplete: false });
  assert.equal(result.rootState, "STALE_ATTENTION");
  assert.equal(result.nextAction, "ATTENTION");
});

test("external wait stays waiting while safe internal work remains available", () => {
  const result = completion({ verificationPassed: false, waitingExternal: true, activeSinceMs: 0, nowMs: 2_000, deadmanMs: 1_000, deliveryHistory: ["PR_READY"], releaseRequired: true, productEvidenceRequired: false, productEvidenceComplete: false });
  assert.equal(result.rootState, "WAITING_EXTERNAL");
  assert.equal(result.nextAction, "CONTINUE_SAFE_INTERNAL_WORK");
  const misreported = projectAdaptiveCompletionV1({ verificationPassed: true, waitingExternal: true, activeSinceMs: 0, nowMs: 2_000, deadmanMs: 1_000, deliveryHistory: ["PR_READY"], releaseRequired: true, productEvidenceRequired: false, productEvidenceComplete: false });
  assert.deepEqual(misreported, { outcome: "DENIED", reason: "EXTERNAL_WAIT_MISREPORTED" });
});

test("read-only conveyor adapter rejects false terminal claims", () => {
  assert.deepEqual(adaptDeliveryConveyorReadbackV1({ schemaVersion: "pansphaira.delivery/readback/v1", history: ["PR_READY", "PR_OPEN"], terminal: true }), { outcome: "DENIED", reason: "CLAIM_MISMATCH" });
  assert.deepEqual(adaptDeliveryConveyorReadbackV1({ schemaVersion: "pansphaira.delivery/readback/v1", history: ["PR_READY", "PR_OPEN"], terminal: false }), ["PR_READY", "PR_OPEN"]);
});
