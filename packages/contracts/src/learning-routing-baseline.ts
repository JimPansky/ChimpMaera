import { createHash } from "node:crypto";

import { canonicalJson } from "./canonical-json.js";

export const HISTORICAL_ROUTING_EPISODE_SCHEMA_V1 = "chimpmaera.dev/historical-routing-episode/v1" as const;
export const LEARNING_ROUTING_BASELINE_SCHEMA_V1 = "chimpmaera.dev/learning-routing-baseline/v1" as const;
export const LEARNING_ROUTING_BASELINE_VERSION_V1 = "lr-004.1" as const;

export const ROUTING_BASELINE_CLASSES_V1 = ["STATIC", "CURRENT", "CHEAP", "STRONG"] as const;
export type RoutingBaselineClassV1 = typeof ROUTING_BASELINE_CLASSES_V1[number];

export type HistoricalRoutingDispositionV1 =
  | "VERIFIED_RESOLVED"
  | "NOT_RESOLVED"
  | "ABORTED"
  | "DENIED"
  | "CENSORED"
  | "UNKNOWN"
  | "INSUFFICIENT_EVIDENCE";

export interface HistoricalRoutingEpisodeV1 {
  readonly schemaVersion: typeof HISTORICAL_ROUTING_EPISODE_SCHEMA_V1;
  readonly episodePseudonym: string;
  readonly sourceEvidence: "AUGUST_CANARY" | "PUBLIC_ISSUE_41" | "PUBLIC_ISSUE_58" | "SANITIZED_SYNTHETIC";
  readonly routeClass: RoutingBaselineClassV1;
  readonly versions: {
    readonly featureSpec: string;
    readonly modelCatalog: string;
    readonly priceBook: string;
    readonly routerArtifact: string;
    readonly verificationGraph: string;
  };
  readonly disposition: HistoricalRoutingDispositionV1;
  readonly evidenceComplete: boolean;
  readonly transportState: "NOT_SENT" | "CONFIRMED" | "FAILED" | "UNKNOWN" | "RECONCILED";
  readonly usage: {
    readonly calls: number;
    readonly repairs: number;
    readonly retries: number;
    readonly scoutCalls: number;
    readonly testRuns: number;
    readonly ciRuns: number;
    readonly reviewMinutes: number;
    readonly elapsedMs: number;
    readonly actualReceiptCostMicros: number | null;
    readonly priceAssumptionCostMicros: number;
    readonly unknownTransportReserveMicros: number;
  };
}

export interface NormalizedHistoricalRoutingEpisodeV1 extends HistoricalRoutingEpisodeV1 {
  readonly normalizedDisposition: HistoricalRoutingDispositionV1;
  readonly verifiedSuccess: boolean;
  readonly billedCostMicros: number;
  readonly reservedCostMicros: number;
  readonly totalCostMicros: number;
  readonly episodeDigest: string;
}

export interface RoutingBaselineMetricsV1 {
  readonly episodeCount: number;
  readonly verifiedSuccesses: number;
  readonly vsrPpm: number;
  readonly vsrWilson95Ppm: { readonly lower: number; readonly upper: number };
  readonly ecvrMicros: number | null;
  readonly etvrMs: number | null;
  readonly effortPerVerifiedSuccessMilli: {
    readonly calls: number | null;
    readonly repairs: number | null;
    readonly retries: number | null;
    readonly scoutCalls: number | null;
    readonly testRuns: number | null;
    readonly ciRuns: number | null;
    readonly reviewMinutes: number | null;
  };
  readonly totals: {
    readonly billedCostMicros: number;
    readonly reservedCostMicros: number;
    readonly totalCostMicros: number;
    readonly elapsedMs: number;
    readonly calls: number;
    readonly repairs: number;
    readonly retries: number;
    readonly scoutCalls: number;
    readonly testRuns: number;
    readonly ciRuns: number;
    readonly reviewMinutes: number;
  };
  readonly missingness: {
    readonly incompleteEvidence: number;
    readonly unknownTransport: number;
    readonly missingActualReceiptCost: number;
    readonly censored: number;
  };
  readonly confidence: "LOW" | "MEDIUM" | "HIGH";
}

export interface LearningRoutingBaselineV1 {
  readonly schemaVersion: typeof LEARNING_ROUTING_BASELINE_SCHEMA_V1;
  readonly baselineVersion: typeof LEARNING_ROUTING_BASELINE_VERSION_V1;
  readonly episodeDigests: readonly string[];
  readonly cohortDigest: string;
  readonly versionDigest: string;
  readonly overall: RoutingBaselineMetricsV1;
  readonly byRouteClass: Readonly<Record<RoutingBaselineClassV1, RoutingBaselineMetricsV1>>;
  readonly sourceCoverage: Readonly<Record<HistoricalRoutingEpisodeV1["sourceEvidence"], number>>;
  readonly claimBoundary: "READ_ONLY_OFFLINE_NO_ROUTING_ACTIVATION";
  readonly baselineDigest: string;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function validEpisode(value: unknown): value is HistoricalRoutingEpisodeV1 {
  if (!exactKeys(value, ["schemaVersion", "episodePseudonym", "sourceEvidence", "routeClass", "versions",
    "disposition", "evidenceComplete", "transportState", "usage"])
    || value.schemaVersion !== HISTORICAL_ROUTING_EPISODE_SCHEMA_V1
    || typeof value.episodePseudonym !== "string" || !/^ep_[a-f0-9]{32}$/.test(value.episodePseudonym)
    || !["AUGUST_CANARY", "PUBLIC_ISSUE_41", "PUBLIC_ISSUE_58", "SANITIZED_SYNTHETIC"].includes(value.sourceEvidence as string)
    || !ROUTING_BASELINE_CLASSES_V1.includes(value.routeClass as RoutingBaselineClassV1)
    || !["VERIFIED_RESOLVED", "NOT_RESOLVED", "ABORTED", "DENIED", "CENSORED", "UNKNOWN", "INSUFFICIENT_EVIDENCE"].includes(value.disposition as string)
    || typeof value.evidenceComplete !== "boolean"
    || !["NOT_SENT", "CONFIRMED", "FAILED", "UNKNOWN", "RECONCILED"].includes(value.transportState as string)) return false;
  if (!exactKeys(value.versions, ["featureSpec", "modelCatalog", "priceBook", "routerArtifact", "verificationGraph"])
    || !Object.values(value.versions).every(isDigest)) return false;
  if (!exactKeys(value.usage, ["calls", "repairs", "retries", "scoutCalls", "testRuns", "ciRuns",
    "reviewMinutes", "elapsedMs", "actualReceiptCostMicros", "priceAssumptionCostMicros", "unknownTransportReserveMicros"])) return false;
  return Object.entries(value.usage).every(([key, item]) => key === "actualReceiptCostMicros"
    ? item === null || nonNegativeInteger(item) : nonNegativeInteger(item));
}

/** Closed, read-only normalization. Invalid or duplicate inputs fail the entire cohort. */
export function normalizeHistoricalRoutingEpisodeV1(value: unknown): NormalizedHistoricalRoutingEpisodeV1 {
  if (!validEpisode(value)) throw new TypeError("INVALID_HISTORICAL_ROUTING_EPISODE");
  const normalizedDisposition = value.disposition === "VERIFIED_RESOLVED" && !value.evidenceComplete
    ? "INSUFFICIENT_EVIDENCE" : value.disposition;
  const billedCostMicros = value.usage.actualReceiptCostMicros ?? value.usage.priceAssumptionCostMicros;
  const reservedCostMicros = value.transportState === "UNKNOWN" && value.usage.actualReceiptCostMicros === null
    ? value.usage.unknownTransportReserveMicros : 0;
  const unsigned = {
    ...value,
    normalizedDisposition,
    verifiedSuccess: normalizedDisposition === "VERIFIED_RESOLVED",
    billedCostMicros,
    reservedCostMicros,
    totalCostMicros: billedCostMicros + reservedCostMicros,
  };
  return { ...unsigned, episodeDigest: digest(unsigned) };
}

function wilson95(successes: number, total: number): { readonly lower: number; readonly upper: number } {
  if (total === 0) return { lower: 0, upper: 1_000_000 };
  const z = 1.959963984540054;
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total) / denominator;
  return { lower: Math.round(Math.max(0, center - margin) * 1_000_000),
    upper: Math.round(Math.min(1, center + margin) * 1_000_000) };
}

function metrics(episodes: readonly NormalizedHistoricalRoutingEpisodeV1[]): RoutingBaselineMetricsV1 {
  const verifiedSuccesses = episodes.filter(({ verifiedSuccess }) => verifiedSuccess).length;
  const sum = (select: (episode: NormalizedHistoricalRoutingEpisodeV1) => number): number =>
    episodes.reduce((total, episode) => total + select(episode), 0);
  const totals = {
    billedCostMicros: sum(({ billedCostMicros }) => billedCostMicros),
    reservedCostMicros: sum(({ reservedCostMicros }) => reservedCostMicros),
    totalCostMicros: sum(({ totalCostMicros }) => totalCostMicros),
    elapsedMs: sum(({ usage }) => usage.elapsedMs),
    calls: sum(({ usage }) => usage.calls),
    repairs: sum(({ usage }) => usage.repairs),
    retries: sum(({ usage }) => usage.retries),
    scoutCalls: sum(({ usage }) => usage.scoutCalls),
    testRuns: sum(({ usage }) => usage.testRuns),
    ciRuns: sum(({ usage }) => usage.ciRuns),
    reviewMinutes: sum(({ usage }) => usage.reviewMinutes),
  };
  const perSuccess = (value: number): number | null => verifiedSuccesses === 0
    ? null : Math.round(value * 1_000 / verifiedSuccesses);
  const incomplete = episodes.filter(({ evidenceComplete }) => !evidenceComplete).length;
  const unknown = episodes.filter(({ transportState }) => transportState === "UNKNOWN").length;
  const missingCost = episodes.filter(({ usage }) => usage.actualReceiptCostMicros === null).length;
  const completeRatio = episodes.length === 0 ? 0 : (episodes.length - incomplete - unknown) / episodes.length;
  return {
    episodeCount: episodes.length,
    verifiedSuccesses,
    vsrPpm: episodes.length === 0 ? 0 : Math.round(verifiedSuccesses * 1_000_000 / episodes.length),
    vsrWilson95Ppm: wilson95(verifiedSuccesses, episodes.length),
    ecvrMicros: verifiedSuccesses === 0 ? null : Math.round(totals.totalCostMicros / verifiedSuccesses),
    etvrMs: verifiedSuccesses === 0 ? null : Math.round(totals.elapsedMs / verifiedSuccesses),
    effortPerVerifiedSuccessMilli: {
      calls: perSuccess(totals.calls), repairs: perSuccess(totals.repairs), retries: perSuccess(totals.retries),
      scoutCalls: perSuccess(totals.scoutCalls), testRuns: perSuccess(totals.testRuns),
      ciRuns: perSuccess(totals.ciRuns), reviewMinutes: perSuccess(totals.reviewMinutes),
    },
    totals,
    missingness: { incompleteEvidence: incomplete, unknownTransport: unknown,
      missingActualReceiptCost: missingCost,
      censored: episodes.filter(({ normalizedDisposition }) => normalizedDisposition === "CENSORED").length },
    confidence: episodes.length >= 24 && completeRatio === 1 ? "HIGH"
      : episodes.length >= 12 && completeRatio >= 0.8 ? "MEDIUM" : "LOW",
  };
}

/** Computes reproducible VSR/ECVR/ETVR and effort baselines without I/O or route recommendations. */
export function computeLearningRoutingBaselineV1(values: readonly unknown[]): LearningRoutingBaselineV1 {
  const episodes = values.map(normalizeHistoricalRoutingEpisodeV1)
    .sort((left, right) => left.episodePseudonym.localeCompare(right.episodePseudonym, "en"));
  if (new Set(episodes.map(({ episodePseudonym }) => episodePseudonym)).size !== episodes.length) {
    throw new TypeError("DUPLICATE_HISTORICAL_EPISODE");
  }
  const versionTuples = [...new Set(episodes.map(({ versions }) => canonicalJson(versions)))].sort();
  const sourceCoverage: LearningRoutingBaselineV1["sourceCoverage"] = {
    AUGUST_CANARY: episodes.filter(({ sourceEvidence }) => sourceEvidence === "AUGUST_CANARY").length,
    PUBLIC_ISSUE_41: episodes.filter(({ sourceEvidence }) => sourceEvidence === "PUBLIC_ISSUE_41").length,
    PUBLIC_ISSUE_58: episodes.filter(({ sourceEvidence }) => sourceEvidence === "PUBLIC_ISSUE_58").length,
    SANITIZED_SYNTHETIC: episodes.filter(({ sourceEvidence }) => sourceEvidence === "SANITIZED_SYNTHETIC").length,
  };
  const unsigned: Omit<LearningRoutingBaselineV1, "baselineDigest"> = {
    schemaVersion: LEARNING_ROUTING_BASELINE_SCHEMA_V1,
    baselineVersion: LEARNING_ROUTING_BASELINE_VERSION_V1,
    episodeDigests: episodes.map(({ episodeDigest }) => episodeDigest),
    cohortDigest: digest(episodes.map(({ episodeDigest }) => episodeDigest)),
    versionDigest: digest(versionTuples),
    overall: metrics(episodes),
    byRouteClass: {
      STATIC: metrics(episodes.filter(({ routeClass }) => routeClass === "STATIC")),
      CURRENT: metrics(episodes.filter(({ routeClass }) => routeClass === "CURRENT")),
      CHEAP: metrics(episodes.filter(({ routeClass }) => routeClass === "CHEAP")),
      STRONG: metrics(episodes.filter(({ routeClass }) => routeClass === "STRONG")),
    },
    sourceCoverage,
    claimBoundary: "READ_ONLY_OFFLINE_NO_ROUTING_ACTIVATION",
  };
  return { ...unsigned, baselineDigest: digest(unsigned) };
}
