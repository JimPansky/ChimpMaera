import { createHash } from "node:crypto";

import { canonicalJson } from "./canonical-json.js";

export const SIGNAL_RELEASE_INTAKE_SCHEMA_V1 = "chimpmaera.dev/signal-release-intake/v1" as const;

export const SIGNAL_RELEASE_INTAKE_GATES_V1 = [
  "THREAD_LIVE",
  "NOT_DUPLICATE",
  "CHIMPMAERA_FIT",
  "PROBLEM_EVIDENCED",
  "ACTIONABLE",
  "PUBLIC_ONLY",
  "CONTENT_SAFE",
  "IP_CLEAR",
  "LOCAL_DECISION_ONLY",
] as const;

export type SignalReleaseIntakeGateV1 = typeof SIGNAL_RELEASE_INTAKE_GATES_V1[number];

export interface SignalReleaseIntakeV1 {
  readonly schemaVersion: typeof SIGNAL_RELEASE_INTAKE_SCHEMA_V1;
  readonly signalDigest: string;
  readonly gates: Readonly<Record<SignalReleaseIntakeGateV1, boolean>>;
}

export interface SignalReleaseIntakeDecisionV1 {
  readonly disposition: "PRE_CANDIDATE" | "REJECTED";
  readonly rejectionReasons: readonly `${SignalReleaseIntakeGateV1}_DENIED`[];
  readonly evaluatedGates: typeof SIGNAL_RELEASE_INTAKE_GATES_V1;
  readonly authorityBoundary: "LOCAL_SYNTHETIC_DECISION_NO_MONITORING_POSTING_OR_RELEASE";
  readonly decisionDigest: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort());
}

/** Pure, closed and fail-closed: this function has no monitoring, posting or release path. */
export function evaluateSignalReleaseIntakeV1(value: unknown): SignalReleaseIntakeDecisionV1 {
  if (!isRecord(value) || !exactKeys(value, ["schemaVersion", "signalDigest", "gates"])
    || value.schemaVersion !== SIGNAL_RELEASE_INTAKE_SCHEMA_V1
    || typeof value.signalDigest !== "string" || !/^[a-f0-9]{64}$/.test(value.signalDigest)
    || !isRecord(value.gates) || !exactKeys(value.gates, SIGNAL_RELEASE_INTAKE_GATES_V1)
    || !Object.values(value.gates).every((gate) => typeof gate === "boolean")) {
    throw new TypeError("SIGNAL_RELEASE_INTAKE_SCHEMA_DENIED");
  }
  const gates = value.gates as unknown as Record<SignalReleaseIntakeGateV1, boolean>;
  const rejectionReasons = SIGNAL_RELEASE_INTAKE_GATES_V1
    .filter((gate) => !gates[gate])
    .map((gate) => `${gate}_DENIED` as const);
  const unsigned = {
    disposition: rejectionReasons.length === 0 ? "PRE_CANDIDATE" as const : "REJECTED" as const,
    rejectionReasons,
    evaluatedGates: SIGNAL_RELEASE_INTAKE_GATES_V1,
    authorityBoundary: "LOCAL_SYNTHETIC_DECISION_NO_MONITORING_POSTING_OR_RELEASE" as const,
  };
  return {
    ...unsigned,
    decisionDigest: createHash("sha256").update(canonicalJson({ signalDigest: value.signalDigest, ...unsigned })).digest("hex"),
  };
}
