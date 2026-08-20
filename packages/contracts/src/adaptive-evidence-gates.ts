import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const ADAPTIVE_GATE_SPEC_SCHEMA_V1 = "chimpmaera.verification/adaptive-gate-spec/v1" as const;
export const ADAPTIVE_GATE_RECEIPT_SCHEMA_V1 = "chimpmaera.verification/adaptive-gate-receipt/v1" as const;
export const ADAPTIVE_GATE_VERIFIER_VERSION_V1 = "pansphaira-adaptive-gates/1" as const;

export const ADAPTIVE_SLICE_TYPES_V1 = [
  "docs-only", "code-runtime", "ui-presentation", "security-trust-boundary", "external-integration",
] as const;
export const ADAPTIVE_RISKS_V1 = ["security", "trust", "external"] as const;
export const ADAPTIVE_PROFILES_V1 = [
  "docs-minimal", "code-runtime", "ui-presentation", "security-trust-boundary",
  "external-integration", "release-required",
] as const;
export const ADAPTIVE_CHECK_IDS_V1 = [
  "docs-build", "docs-spelling", "build", "lint", "focused-test", "ui-accessibility",
  "ui-interaction", "security-negative", "unsafe-input", "authority-secret", "remote-readback",
  "timeout-recovery", "idempotency", "delivery-readback",
] as const;

export type AdaptiveSliceTypeV1 = typeof ADAPTIVE_SLICE_TYPES_V1[number];
export type AdaptiveRiskV1 = typeof ADAPTIVE_RISKS_V1[number];
export type AdaptiveProfileV1 = typeof ADAPTIVE_PROFILES_V1[number];
export type AdaptiveCheckIdV1 = typeof ADAPTIVE_CHECK_IDS_V1[number];
export type AdaptiveDeliveryStateV1 =
  | "PR_READY" | "PR_OPEN" | "CI_GREEN" | "MERGED" | "RELEASE_DECISION" | "RELEASED" | "CLOSED_NO_RELEASE";
export type AdaptiveLocalStateV1 = "OPEN" | "WAITING_EXTERNAL" | "STALE_ATTENTION" | "COMPLETE";
export type AdaptiveProductEvidenceStateV1 = "NOT_REQUIRED" | "OPEN" | "COMPLETE";
export type AdaptiveDenialV1 =
  | "INVALID_SPEC" | "MISSING_CHECK_EXPECT" | "UNKNOWN_PROFILE" | "UNKNOWN_RISK_ATTRIBUTE"
  | "INVALID_DEPENDENCIES" | "CYCLIC_DEPENDENCIES" | "UNSAFE_EVALUATOR_INPUT"
  | "CHECK_FAILED" | "CHECK_TIMEOUT" | "FLAKY_RESULT" | "STALE_RECEIPT"
  | "FORGED_COUNT_OR_DIGEST" | "DELEGATED_NOT_REVERIFIED" | "SILENT_SCOPE_SHRINK"
  | "INVALID_STATE_JUMP" | "CLAIM_MISMATCH" | "EXTERNAL_WAIT_MISREPORTED";

export interface AdaptiveGateExpectationV1 {
  readonly exitCode: number;
  readonly stdout: string;
}

export interface AdaptiveGateV1 {
  readonly id: string;
  readonly checkId: AdaptiveCheckIdV1;
  readonly expect: AdaptiveGateExpectationV1;
  readonly dependsOn: readonly string[];
  readonly delegated?: boolean;
}

export interface AdaptiveGateSpecV1 {
  readonly schemaVersion: typeof ADAPTIVE_GATE_SPEC_SCHEMA_V1;
  readonly sliceId: string;
  readonly rootGoal: string;
  readonly subjectDigest: string;
  readonly scope: readonly string[];
  readonly scopeDigest: string;
  readonly sliceType: AdaptiveSliceTypeV1;
  readonly risks: readonly AdaptiveRiskV1[];
  readonly requestedProfiles: readonly AdaptiveProfileV1[];
  readonly releaseRequired: boolean;
  readonly productEvidenceRequired: boolean;
  readonly evidenceMaxAgeMs: number;
  readonly gates: readonly AdaptiveGateV1[];
}

export interface AdaptiveCheckResultV1 {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}

export interface AdaptiveGateReceiptV1 {
  readonly schemaVersion: typeof ADAPTIVE_GATE_RECEIPT_SCHEMA_V1;
  readonly gateId: string;
  readonly checkId: AdaptiveCheckIdV1;
  readonly subjectDigest: string;
  readonly specDigest: string;
  readonly expectationDigest: string;
  readonly verifierVersion: typeof ADAPTIVE_GATE_VERIFIER_VERSION_V1;
  readonly resultDigest: string;
  readonly observedAtMs: number;
  readonly expiresAtMs: number;
  readonly receiptDigest: string;
}

export interface AdaptiveVerificationSuccessV1 {
  readonly outcome: "PASS";
  readonly selectedProfiles: readonly AdaptiveProfileV1[];
  readonly receipts: readonly AdaptiveGateReceiptV1[];
  readonly selectedCount: number;
  readonly selectionDigest: string;
  readonly parentReverifications: number;
}

export type AdaptiveVerificationResultV1 = AdaptiveVerificationSuccessV1 | {
  readonly outcome: "DENIED";
  readonly reason: AdaptiveDenialV1;
  readonly detail: string;
};

export interface AdaptiveCompletionProjectionV1 {
  readonly localState: AdaptiveLocalStateV1;
  readonly deliveryState: AdaptiveDeliveryStateV1;
  readonly deliveryTerminal: boolean;
  readonly productEvidenceState: AdaptiveProductEvidenceStateV1;
  readonly rootState: "OPEN" | "WAITING_EXTERNAL" | "STALE_ATTENTION" | "COMPLETE";
  readonly nextAction: "ADVANCE_PHASE" | "CONTINUE_SAFE_INTERNAL_WORK" | "WAIT_EXTERNAL" | "ATTENTION";
  readonly nonClaims: readonly string[];
}

const PROFILE_BY_TYPE: Readonly<Record<AdaptiveSliceTypeV1, AdaptiveProfileV1>> = {
  "docs-only": "docs-minimal",
  "code-runtime": "code-runtime",
  "ui-presentation": "ui-presentation",
  "security-trust-boundary": "security-trust-boundary",
  "external-integration": "external-integration",
};
const PROFILE_ORDER = new Map(ADAPTIVE_PROFILES_V1.map((profile, index) => [profile, index]));
const REQUIRED_CHECKS: Readonly<Record<AdaptiveProfileV1, readonly AdaptiveCheckIdV1[]>> = {
  "docs-minimal": ["docs-build", "docs-spelling"],
  "code-runtime": ["build", "lint", "focused-test"],
  "ui-presentation": ["ui-accessibility", "ui-interaction"],
  "security-trust-boundary": ["security-negative", "unsafe-input", "authority-secret"],
  "external-integration": ["remote-readback", "timeout-recovery", "idempotency"],
  "release-required": ["delivery-readback"],
};
const DELIVERY_TRANSITIONS: Readonly<Record<AdaptiveDeliveryStateV1, readonly AdaptiveDeliveryStateV1[]>> = {
  PR_READY: ["PR_OPEN"],
  PR_OPEN: ["CI_GREEN"],
  CI_GREEN: ["MERGED"],
  MERGED: ["RELEASE_DECISION"],
  RELEASE_DECISION: ["RELEASED", "CLOSED_NO_RELEASE"],
  RELEASED: [],
  CLOSED_NO_RELEASE: [],
};

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, required: readonly string[], optional: readonly string[] = []): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value);
  return required.every((key) => actual.includes(key))
    && actual.every((key) => required.includes(key) || optional.includes(key));
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,63}$/.test(value);
}

export function isSafeAdaptivePathV1(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512
    && !value.startsWith("/") && !value.includes("\\") && !value.includes("\0")
    && value === value.normalize("NFC")
    && value.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

export function adaptiveScopeDigestV1(scope: readonly string[]): string {
  return digest([...scope].sort((left, right) => left.localeCompare(right, "en")));
}

export function adaptiveSpecDigestV1(spec: AdaptiveGateSpecV1): string {
  return digest(spec);
}

export function adaptiveReceiptDigestV1(receipt: Omit<AdaptiveGateReceiptV1, "receiptDigest">): string {
  return digest(receipt);
}

export function selectAdaptiveProfilesV1(input: {
  readonly sliceType: unknown;
  readonly risks: readonly unknown[];
  readonly requestedProfiles: readonly unknown[];
  readonly releaseRequired: boolean;
}): { readonly outcome: "SELECTED"; readonly profiles: readonly AdaptiveProfileV1[] } | {
  readonly outcome: "DENIED"; readonly reason: "UNKNOWN_PROFILE" | "UNKNOWN_RISK_ATTRIBUTE" | "INVALID_SPEC";
} {
  if (!(ADAPTIVE_SLICE_TYPES_V1 as readonly unknown[]).includes(input.sliceType)) {
    return { outcome: "DENIED", reason: "UNKNOWN_PROFILE" };
  }
  if (input.risks.some((risk) => !(ADAPTIVE_RISKS_V1 as readonly unknown[]).includes(risk))) {
    return { outcome: "DENIED", reason: "UNKNOWN_RISK_ATTRIBUTE" };
  }
  if (input.requestedProfiles.some((profile) => !(ADAPTIVE_PROFILES_V1 as readonly unknown[]).includes(profile))) {
    return { outcome: "DENIED", reason: "UNKNOWN_PROFILE" };
  }
  const profiles = new Set<AdaptiveProfileV1>([
    PROFILE_BY_TYPE[input.sliceType as AdaptiveSliceTypeV1],
    ...(input.requestedProfiles as readonly AdaptiveProfileV1[]),
  ]);
  if (input.risks.includes("security") || input.risks.includes("trust")) profiles.add("security-trust-boundary");
  if (input.risks.includes("external")) profiles.add("external-integration");
  if (input.releaseRequired) profiles.add("release-required");
  return {
    outcome: "SELECTED",
    profiles: [...profiles].sort((left, right) => (PROFILE_ORDER.get(left) ?? 99) - (PROFILE_ORDER.get(right) ?? 99)),
  };
}

function validateDependencies(gates: readonly AdaptiveGateV1[]): AdaptiveDenialV1 | null {
  const byId = new Map(gates.map((gate) => [gate.id, gate]));
  if (byId.size !== gates.length || gates.some((gate) => gate.dependsOn.some((id) => !byId.has(id)))) {
    return "INVALID_DEPENDENCIES";
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    const gate = byId.get(id);
    if (!gate) return true;
    visiting.add(id);
    if (gate.dependsOn.some(visit)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return gates.some((gate) => visit(gate.id)) ? "CYCLIC_DEPENDENCIES" : null;
}

export function validateAdaptiveGateSpecV1(value: unknown): value is AdaptiveGateSpecV1 {
  if (!exactKeys(value, [
    "schemaVersion", "sliceId", "rootGoal", "subjectDigest", "scope", "scopeDigest", "sliceType",
    "risks", "requestedProfiles", "releaseRequired", "productEvidenceRequired", "evidenceMaxAgeMs", "gates",
  ])) return false;
  if (value.schemaVersion !== ADAPTIVE_GATE_SPEC_SCHEMA_V1 || !isIdentifier(value.sliceId)
    || typeof value.rootGoal !== "string" || value.rootGoal.length < 3 || value.rootGoal.length > 512
    || !isDigest(value.subjectDigest) || !Array.isArray(value.scope) || value.scope.length === 0
    || !value.scope.every(isSafeAdaptivePathV1) || new Set(value.scope).size !== value.scope.length
    || value.scopeDigest !== adaptiveScopeDigestV1(value.scope as string[])
    || !(ADAPTIVE_SLICE_TYPES_V1 as readonly unknown[]).includes(value.sliceType)
    || !Array.isArray(value.risks) || !Array.isArray(value.requestedProfiles)
    || new Set(value.risks).size !== value.risks.length
    || new Set(value.requestedProfiles).size !== value.requestedProfiles.length
    || typeof value.releaseRequired !== "boolean" || typeof value.productEvidenceRequired !== "boolean"
    || !Number.isSafeInteger(value.evidenceMaxAgeMs) || (value.evidenceMaxAgeMs as number) <= 0
    || !Array.isArray(value.gates) || value.gates.length === 0) return false;
  if (selectAdaptiveProfilesV1({
    sliceType: value.sliceType, risks: value.risks, requestedProfiles: value.requestedProfiles,
    releaseRequired: value.releaseRequired,
  }).outcome === "DENIED") return false;
  return value.gates.every((gate) => exactKeys(gate, ["id", "checkId", "expect", "dependsOn"], ["delegated"])
    && isIdentifier(gate.id) && (ADAPTIVE_CHECK_IDS_V1 as readonly unknown[]).includes(gate.checkId)
    && exactKeys(gate.expect, ["exitCode", "stdout"])
    && Number.isSafeInteger(gate.expect.exitCode) && typeof gate.expect.stdout === "string"
    && gate.expect.stdout.length <= 16_384 && Array.isArray(gate.dependsOn) && gate.dependsOn.every(isIdentifier)
    && (!Object.hasOwn(gate, "delegated") || typeof gate.delegated === "boolean"))
    && validateDependencies(value.gates as AdaptiveGateV1[]) === null;
}

export function verifyAdaptiveGatesV1(args: {
  readonly spec: unknown;
  readonly nowMs: number;
  readonly expectedScope?: readonly string[];
  readonly claimedCount?: number;
  readonly claimedSelectionDigest?: string;
  readonly delegatedReceipts?: Readonly<Record<string, AdaptiveGateReceiptV1>>;
  readonly execute: (checkId: AdaptiveCheckIdV1) => readonly [AdaptiveCheckResultV1, AdaptiveCheckResultV1];
}): AdaptiveVerificationResultV1 {
  if (isRecord(args.spec)) {
    if (Array.isArray(args.spec.gates) && args.spec.gates.some((gate) => !isRecord(gate)
      || !Object.hasOwn(gate, "checkId") || !Object.hasOwn(gate, "expect"))) {
      return { outcome: "DENIED", reason: "MISSING_CHECK_EXPECT", detail: "every mechanical gate requires CHECK and EXPECT" };
    }
    if (Array.isArray(args.spec.scope) && args.spec.scope.some((path) => !isSafeAdaptivePathV1(path))) {
      return { outcome: "DENIED", reason: "UNSAFE_EVALUATOR_INPUT", detail: "unsafe scope path" };
    }
    if (Array.isArray(args.spec.gates) && args.spec.gates.some((gate) => isRecord(gate)
      && !(ADAPTIVE_CHECK_IDS_V1 as readonly unknown[]).includes(gate.checkId))) {
      return { outcome: "DENIED", reason: "UNSAFE_EVALUATOR_INPUT", detail: "check is not registered" };
    }
    if (Array.isArray(args.spec.gates) && args.spec.gates.every((gate) => isRecord(gate)
      && isIdentifier(gate.id) && Array.isArray(gate.dependsOn) && gate.dependsOn.every(isIdentifier))) {
      const dependencyReason = validateDependencies(args.spec.gates as unknown as AdaptiveGateV1[]);
      if (dependencyReason) return { outcome: "DENIED", reason: dependencyReason, detail: "dependency graph denied" };
    }
    if (Array.isArray(args.spec.risks) && Array.isArray(args.spec.requestedProfiles)) {
      const preliminary = selectAdaptiveProfilesV1({
        sliceType: args.spec.sliceType,
        risks: args.spec.risks,
        requestedProfiles: args.spec.requestedProfiles,
        releaseRequired: args.spec.releaseRequired === true,
      });
      if (preliminary.outcome === "DENIED") {
        return { outcome: "DENIED", reason: preliminary.reason, detail: "unknown adaptive selector input" };
      }
      if (Array.isArray(args.spec.gates)) {
        const available = new Set(args.spec.gates.filter(isRecord).map((gate) => gate.checkId));
        const missing = preliminary.profiles.flatMap((profile) => REQUIRED_CHECKS[profile]).filter((check) => !available.has(check));
        if (missing.length > 0) return { outcome: "DENIED", reason: "MISSING_CHECK_EXPECT", detail: missing.join(",") };
      }
    }
  }
  if (!validateAdaptiveGateSpecV1(args.spec)) return { outcome: "DENIED", reason: "INVALID_SPEC", detail: "closed schema or invariant denied" };
  const spec = args.spec;
  if (args.expectedScope && adaptiveScopeDigestV1(args.expectedScope) !== spec.scopeDigest) {
    return { outcome: "DENIED", reason: "SILENT_SCOPE_SHRINK", detail: "expected scope digest differs" };
  }
  const selected = selectAdaptiveProfilesV1(spec);
  if (selected.outcome === "DENIED") return { outcome: "DENIED", reason: selected.reason, detail: "profile selection denied" };
  const selectionDigest = digest(selected.profiles);
  if ((args.claimedCount !== undefined && args.claimedCount !== selected.profiles.length)
    || (args.claimedSelectionDigest !== undefined && args.claimedSelectionDigest !== selectionDigest)) {
    return { outcome: "DENIED", reason: "FORGED_COUNT_OR_DIGEST", detail: "selection claim differs from recompute" };
  }
  const specDigest = adaptiveSpecDigestV1(spec);
  const receipts: AdaptiveGateReceiptV1[] = [];
  let parentReverifications = 0;
  for (const gate of spec.gates) {
    const runs = args.execute(gate.checkId);
    if (runs.length !== 2 || runs.some((run) => run.timedOut)) {
      return { outcome: "DENIED", reason: "CHECK_TIMEOUT", detail: gate.id };
    }
    if (canonicalJson(runs[0]) !== canonicalJson(runs[1])) {
      return { outcome: "DENIED", reason: "FLAKY_RESULT", detail: gate.id };
    }
    const result = runs[0];
    if (!result || result.exitCode !== gate.expect.exitCode || result.stdout !== gate.expect.stdout) {
      return { outcome: "DENIED", reason: "CHECK_FAILED", detail: gate.id };
    }
    const unsigned = {
      schemaVersion: ADAPTIVE_GATE_RECEIPT_SCHEMA_V1,
      gateId: gate.id,
      checkId: gate.checkId,
      subjectDigest: spec.subjectDigest,
      specDigest,
      expectationDigest: digest(gate.expect),
      verifierVersion: ADAPTIVE_GATE_VERIFIER_VERSION_V1,
      resultDigest: digest(result),
      observedAtMs: args.nowMs,
      expiresAtMs: args.nowMs + spec.evidenceMaxAgeMs,
    } as const;
    const receipt = { ...unsigned, receiptDigest: adaptiveReceiptDigestV1(unsigned) };
    if (gate.delegated) {
      const delegated = args.delegatedReceipts?.[gate.id];
      if (!delegated || verifyAdaptiveReceiptV1(delegated, args.nowMs).outcome !== "PASS"
        || delegated.subjectDigest !== receipt.subjectDigest
        || delegated.specDigest !== receipt.specDigest
        || delegated.checkId !== receipt.checkId
        || delegated.resultDigest !== receipt.resultDigest) {
        return { outcome: "DENIED", reason: "DELEGATED_NOT_REVERIFIED", detail: gate.id };
      }
      parentReverifications += 1;
    }
    receipts.push(receipt);
  }
  return {
    outcome: "PASS", selectedProfiles: selected.profiles, receipts,
    selectedCount: selected.profiles.length, selectionDigest, parentReverifications,
  };
}

export function verifyAdaptiveReceiptV1(receipt: AdaptiveGateReceiptV1, nowMs: number): AdaptiveVerificationResultV1 {
  if (!exactKeys(receipt, [
    "schemaVersion", "gateId", "checkId", "subjectDigest", "specDigest", "expectationDigest",
    "verifierVersion", "resultDigest", "observedAtMs", "expiresAtMs", "receiptDigest",
  ]) || receipt.schemaVersion !== ADAPTIVE_GATE_RECEIPT_SCHEMA_V1 || !isIdentifier(receipt.gateId)
    || !(ADAPTIVE_CHECK_IDS_V1 as readonly unknown[]).includes(receipt.checkId)
    || !isDigest(receipt.subjectDigest) || !isDigest(receipt.specDigest) || !isDigest(receipt.expectationDigest)
    || receipt.verifierVersion !== ADAPTIVE_GATE_VERIFIER_VERSION_V1 || !isDigest(receipt.resultDigest)
    || !Number.isSafeInteger(receipt.observedAtMs) || receipt.observedAtMs < 0
    || !Number.isSafeInteger(receipt.expiresAtMs) || receipt.expiresAtMs <= receipt.observedAtMs
    || !isDigest(receipt.receiptDigest)) {
    return { outcome: "DENIED", reason: "FORGED_COUNT_OR_DIGEST", detail: "receipt schema denied" };
  }
  const { receiptDigest, ...unsigned } = receipt;
  if (adaptiveReceiptDigestV1(unsigned) !== receiptDigest) {
    return { outcome: "DENIED", reason: "FORGED_COUNT_OR_DIGEST", detail: receipt.gateId };
  }
  if (receipt.expiresAtMs < nowMs) return { outcome: "DENIED", reason: "STALE_RECEIPT", detail: receipt.gateId };
  return { outcome: "PASS", selectedProfiles: [], receipts: [receipt], selectedCount: 0, selectionDigest: digest([]), parentReverifications: 0 };
}

export function validateAdaptiveDeliveryHistoryV1(history: readonly AdaptiveDeliveryStateV1[]): AdaptiveDenialV1 | null {
  if (history.length === 0 || history[0] !== "PR_READY") return "INVALID_STATE_JUMP";
  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1];
    const current = history[index];
    if (!previous || !current || !DELIVERY_TRANSITIONS[previous].includes(current)) return "INVALID_STATE_JUMP";
  }
  return null;
}

export function projectAdaptiveCompletionV1(args: {
  readonly verificationPassed: boolean;
  readonly waitingExternal: boolean;
  readonly activeSinceMs: number;
  readonly nowMs: number;
  readonly deadmanMs: number;
  readonly deliveryHistory: readonly AdaptiveDeliveryStateV1[];
  readonly releaseRequired: boolean;
  readonly productEvidenceRequired: boolean;
  readonly productEvidenceComplete: boolean;
}): AdaptiveCompletionProjectionV1 | { readonly outcome: "DENIED"; readonly reason: AdaptiveDenialV1 } {
  if (args.waitingExternal && args.verificationPassed) {
    return { outcome: "DENIED", reason: "EXTERNAL_WAIT_MISREPORTED" };
  }
  const deliveryError = validateAdaptiveDeliveryHistoryV1(args.deliveryHistory);
  if (deliveryError) return { outcome: "DENIED", reason: deliveryError };
  const deliveryState = args.deliveryHistory.at(-1) ?? "PR_READY";
  const deliveryTerminal = deliveryState === "RELEASED" || (!args.releaseRequired && deliveryState === "CLOSED_NO_RELEASE");
  const productEvidenceState: AdaptiveProductEvidenceStateV1 = !args.productEvidenceRequired
    ? "NOT_REQUIRED" : args.productEvidenceComplete ? "COMPLETE" : "OPEN";
  const stale = !args.verificationPassed && !args.waitingExternal && args.nowMs - args.activeSinceMs > args.deadmanMs;
  const localState: AdaptiveLocalStateV1 = stale ? "STALE_ATTENTION"
    : args.waitingExternal ? "WAITING_EXTERNAL" : args.verificationPassed ? "COMPLETE" : "OPEN";
  const complete = localState === "COMPLETE" && deliveryTerminal && productEvidenceState !== "OPEN";
  const rootState = complete ? "COMPLETE" : stale ? "STALE_ATTENTION"
    : args.waitingExternal ? "WAITING_EXTERNAL" : "OPEN";
  return {
    localState, deliveryState, deliveryTerminal, productEvidenceState, rootState,
    nextAction: complete ? "ADVANCE_PHASE" : stale ? "ATTENTION"
      : args.waitingExternal ? "CONTINUE_SAFE_INTERNAL_WORK" : "ADVANCE_PHASE",
    nonClaims: complete ? [] : ["Local evidence does not imply terminal delivery or product evidence."],
  };
}

export function adaptDeliveryConveyorReadbackV1(value: unknown): readonly AdaptiveDeliveryStateV1[] | {
  readonly outcome: "DENIED"; readonly reason: "CLAIM_MISMATCH";
} {
  if (!exactKeys(value, ["schemaVersion", "history", "terminal"])
    || value.schemaVersion !== "pansphaira.delivery/readback/v1" || !Array.isArray(value.history)
    || value.history.some((state) => !Object.hasOwn(DELIVERY_TRANSITIONS, state as PropertyKey))
    || typeof value.terminal !== "boolean") return { outcome: "DENIED", reason: "CLAIM_MISMATCH" };
  const history = value.history as AdaptiveDeliveryStateV1[];
  if (validateAdaptiveDeliveryHistoryV1(history)) return { outcome: "DENIED", reason: "CLAIM_MISMATCH" };
  const terminal = ["RELEASED", "CLOSED_NO_RELEASE"].includes(history.at(-1) ?? "");
  return terminal === value.terminal ? history : { outcome: "DENIED", reason: "CLAIM_MISMATCH" };
}
