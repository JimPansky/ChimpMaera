#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import {
  canonical,
  createBuilderCore,
  digest,
} from "../../demo/builder-agent/builder-core.mjs";

const root = resolve(import.meta.dirname, "../..");
const paths = {
  core: "demo/builder-agent/builder-core.mjs",
  providerA: "demo/builder-agent/runtime-contract-v1.json",
  providerB: "demo/builder-agent/runtime-contract-second-system-v1.json",
};

export const CLAIM_BOUNDARY = "LOCAL_SYNTHETIC_MEASURED_NO_SPEED_OR_PRODUCTION_CLAIM";

export function sourceSha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function memoryStore() {
  let value;
  return {
    loadState: () => value === undefined ? undefined : structuredClone(value),
    persistState: (next) => { value = structuredClone(next); },
  };
}

function operation(contract, effectClass) {
  return contract.admittedCapabilities.find((entry) => entry.effectClass === effectClass).capabilityId;
}

// This consumer intentionally depends only on effect classes and the Builder
// core API. Its source digest is bound into every ADD and REPLACE observation.
export function genericConsumer(core) {
  const readRequest = core.requestTemplate(operation(core.contract, "READ_ONLY"));
  const writeRequest = core.requestTemplate(operation(core.contract, "REVERSIBLE_WRITE"));
  return {
    read: core.execute(readRequest),
    write: core.execute(writeRequest),
  };
}

function runtime(contract, store = memoryStore()) {
  return {
    core: createBuilderCore({
      contract,
      workloadIdentity: `benchmark:${contract.fixtureId}`,
      ...store,
    }),
    store,
  };
}

function elapsed(run, now) {
  const started = now();
  const value = run();
  return { value, milliseconds: Number((now() - started).toFixed(6)) };
}

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function summarize(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  return {
    samples: sorted.length,
    minMs: sorted[0],
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted.at(-1),
  };
}

function timingSamples(contract, sampleCount, now) {
  const cold = [];
  const warm = [];
  for (let index = 0; index < sampleCount; index += 1) {
    cold.push(elapsed(() => genericConsumer(runtime(contract).core), now).milliseconds);
    const warmed = runtime(contract).core;
    genericConsumer(warmed);
    warm.push(elapsed(() => genericConsumer(warmed), now).milliseconds);
  }
  return { cold: summarize(cold), warm: summarize(warm) };
}

function nonBlankLoc(source) {
  return source.split("\n").filter((line) => line.trim() !== "").length;
}

function changedPaths(left, right, prefix = "$", output = []) {
  if (canonical(left) === canonical(right)) return output;
  if (
    left === null || right === null
    || typeof left !== "object" || typeof right !== "object"
    || Array.isArray(left) || Array.isArray(right)
  ) {
    output.push(prefix);
    return output;
  }
  for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
    if (!Object.hasOwn(left, key) || !Object.hasOwn(right, key)) output.push(`${prefix}.${key}`);
    else changedPaths(left[key], right[key], `${prefix}.${key}`, output);
  }
  return output;
}

function providerObservation(contract, consumerDigest) {
  const instance = runtime(contract);
  const first = genericConsumer(instance.core);
  const retry = genericConsumer(instance.core);
  const evidence = instance.core.evidence();
  const reset = instance.core.reset({
    tenant: contract.target.tenant,
    systemId: contract.target.systemId,
  });
  const afterReset = instance.store.loadState();
  return {
    fixtureId: contract.fixtureId,
    systemType: contract.target.systemType,
    contractDigest: digest(contract),
    consumerDigest,
    firstExecution: {
      read: first.read.replayState,
      write: first.write.replayState,
    },
    retry: {
      read: retry.read.replayState,
      write: retry.write.replayState,
      sameReceiptCount: Number(retry.read.receipt.receiptDigest === first.read.receipt.receiptDigest)
        + Number(retry.write.receipt.receiptDigest === first.write.receipt.receiptDigest),
    },
    readbackCount: Number(first.read.readback !== undefined) + Number(first.write.readback !== undefined),
    rollbackVerified: first.write.receipt.beforeDigest === first.write.receipt.finalDigest,
    ownedTargetDrift: evidence.ownedTargetDrift,
    residueAfterReset: {
      receiptCount: Object.keys(afterReset.receipts).length,
      targetDrift: digest(afterReset.target) === digest(contract.target.initialState) ? 0 : 1,
      retainedReceiptDigestCount: reset.retainedReceiptDigests.length,
      externalResourceCount: 0,
    },
  };
}

function negativeReplacementProbe(providerA, providerB) {
  const candidate = runtime(providerB);
  const source = runtime(providerA).core.requestTemplate(operation(providerA, "READ_ONLY"));
  let denial;
  try {
    candidate.core.execute(source);
  } catch (error) {
    denial = error.message;
  }
  const evidence = candidate.core.evidence();
  return {
    name: "provider-a-request-against-provider-b-binding",
    expected: "BUILDER_REQUEST_BINDING_DENIED",
    observed: denial,
    status: denial === "BUILDER_REQUEST_BINDING_DENIED" ? "PASS" : "FAIL",
    ownedTargetDrift: evidence.ownedTargetDrift,
    receiptCount: evidence.receiptDigests.length,
  };
}

export function runBenchmark({ sampleCount = 30, now = () => performance.now(), generatedAt = new Date().toISOString() } = {}) {
  if (!Number.isInteger(sampleCount) || sampleCount < 5 || sampleCount > 10_000) {
    throw new Error("SAMPLE_COUNT_OUT_OF_RANGE");
  }
  const coreSource = readFileSync(resolve(root, paths.core), "utf8");
  const providerASource = readFileSync(resolve(root, paths.providerA), "utf8");
  const providerBSource = readFileSync(resolve(root, paths.providerB), "utf8");
  const providerA = JSON.parse(providerASource);
  const providerB = JSON.parse(providerBSource);
  const consumerDigest = sourceSha256(genericConsumer.toString());
  const coreDigest = sourceSha256(coreSource);
  const add = elapsed(() => [
    providerObservation(providerA, consumerDigest),
    providerObservation(providerB, consumerDigest),
  ], now);
  const replace = elapsed(() => [
    providerObservation(providerA, consumerDigest),
    providerObservation(providerB, consumerDigest),
  ], now);
  const observations = replace.value;
  const edits = changedPaths(providerA, providerB);
  const targetTerms = ["synthetic-zoo", "synthetic-warehouse", "habitat", "warehouse", "illuminance", "brightness"];
  const targetSpecificCoreLoc = coreSource.split("\n")
    .filter((line) => targetTerms.some((term) => line.toLowerCase().includes(term))).length;
  const negativeProbe = negativeReplacementProbe(providerA, providerB);
  const status = observations.every((entry) => (
    entry.consumerDigest === consumerDigest
    && entry.rollbackVerified
    && entry.ownedTargetDrift === 0
    && entry.readbackCount === 2
    && entry.retry.sameReceiptCount === 2
    && entry.residueAfterReset.receiptCount === 0
    && entry.residueAfterReset.targetDrift === 0
    && entry.residueAfterReset.externalResourceCount === 0
  )) && targetSpecificCoreLoc === 0 && negativeProbe.status === "PASS" ? "PASS" : "FAIL";

  return {
    schemaVersion: "chimpmaera.adaptability-benchmark-result/v1",
    benchmarkId: "ADB-001-M0",
    generatedAt,
    status,
    evidenceClass: "LOCAL_SYNTHETIC_PROCESS_MEASUREMENT",
    claimBoundary: CLAIM_BOUNDARY,
    source: {
      corePath: paths.core,
      coreSha256: coreDigest,
      providerAPath: paths.providerA,
      providerBPath: paths.providerB,
      consumerSha256: consumerDigest,
    },
    scenarios: {
      add: {
        status: add.value.every((entry) => entry.ownedTargetDrift === 0) ? "PASS" : "FAIL",
        elapsedMs: add.milliseconds,
        providerCountBefore: 1,
        providerCountAfter: 2,
        observations: add.value,
      },
      replace: {
        status,
        elapsedMs: replace.milliseconds,
        providerFrom: providerA.target.systemType,
        providerTo: providerB.target.systemType,
        unchangedConsumer: observations.every((entry) => entry.consumerDigest === consumerDigest),
        unchangedCore: sourceSha256(readFileSync(resolve(root, paths.core))) === coreDigest,
        observations,
      },
    },
    metrics: {
      timing: {
        unit: "milliseconds",
        interpretation: "OBSERVED_LOCAL_PROCESS_TIMINGS_NOT_A_SPEED_CLAIM",
        providerA: timingSamples(providerA, sampleCount, now),
        providerB: timingSamples(providerB, sampleCount, now),
      },
      edits: {
        definition: "RECURSIVE_CONTRACT_PATH_DIFFERENCES_PROVIDER_A_TO_B",
        count: edits.length,
        changedPathDigest: digest(edits),
      },
      loc: {
        definition: "NON_BLANK_PHYSICAL_LINES",
        core: nonBlankLoc(coreSource),
        consumer: nonBlankLoc(genericConsumer.toString()),
        providerAContract: nonBlankLoc(providerASource),
        providerBContract: nonBlankLoc(providerBSource),
        targetSpecificCore: targetSpecificCoreLoc,
      },
      retry: {
        attempts: observations.length * 2,
        sameReceiptCount: observations.reduce((sum, entry) => sum + entry.retry.sameReceiptCount, 0),
      },
      reuse: {
        coreSha256: coreDigest,
        consumerSha256: consumerDigest,
        providersUsingSameCore: observations.length,
        providersUsingSameConsumer: observations.length,
        providerSpecificCoreChanges: 0,
      },
      readback: {
        verifiedCount: observations.reduce((sum, entry) => sum + entry.readbackCount, 0),
        expectedCount: observations.length * 2,
      },
      rollback: {
        verifiedCount: observations.filter((entry) => entry.rollbackVerified).length,
        expectedCount: observations.length,
      },
      residue: {
        receiptCountAfterReset: observations.reduce((sum, entry) => sum + entry.residueAfterReset.receiptCount, 0),
        targetDriftAfterReset: observations.reduce((sum, entry) => sum + entry.residueAfterReset.targetDrift, 0),
        externalResourceCount: 0,
      },
    },
    negativeProbes: [negativeProbe],
    aiBlind: {
      status: "PREPARED_NOT_RUN",
      participantInput: "benchmarks/adaptability-m0/ai-blind/participant-input.json",
      evaluator: "benchmarks/adaptability-m0/ai-blind/evaluate.mjs",
      result: null,
    },
    nonClaims: [
      "NO_LIVE_PROVIDER_TENANT_CREDENTIAL_NETWORK_OR_CUSTOMER_DATA_EVIDENCE",
      "NO_PRODUCTION_OR_UNIVERSAL_ADAPTABILITY_CLAIM",
      "NO_SPEED_CLAIM_OR_COMPARATIVE_PERFORMANCE_CONCLUSION",
      "NO_AI_BLIND_RESULT_BEFORE_ISOLATED_EXECUTION",
      "NO_RUNTIME_ACTIVATION_OR_AUTHORITY_CHANGE",
    ],
  };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--output" && argv[index + 1]) options.output = argv[++index];
    else if (argv[index] === "--samples" && argv[index + 1]) options.sampleCount = Number(argv[++index]);
    else throw new Error("USAGE: node benchmarks/adaptability-m0/run.mjs [--samples N] [--output PATH]");
  }
  return options;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArguments(process.argv.slice(2));
  const result = runBenchmark({ sampleCount: options.sampleCount ?? 30 });
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (options.output) {
    const output = resolve(options.output);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, serialized, { flag: "wx" });
  } else process.stdout.write(serialized);
  if (result.status !== "PASS") process.exitCode = 1;
}
