import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import {
  attachParserEnrichmentEvidence,
  buildPreflightEvidence,
  buildStoredLogicImpactReport,
  buildStoredLogicEvidence,
  buildAggregateProfilingEvidence,
  buildProfilingKnowledgePack,
  buildProfilingSupersetResult,
  buildProfilingCoverageLedger,
  authorizeProfilingProjection,
  canonicalJson,
  compileProfilingQuery,
  COVERAGE_LEDGER_SCHEMA,
  deriveProfilingCandidates,
  IDENTITY_CONTRACT_SCHEMA,
  identitySha256,
  normalizeJsonValue,
  normalizeSql,
  validateAnalyzeProfile,
  validateProfilingQueryManifest,
  validateQueryManifest,
  verifyStoredLogicImpactReport,
  verifyStoredLogicEvidence,
} from '../scripts/lib/db-analyzer/core.mjs';
import { buildOptionalParserEnrichment } from '../scripts/lib/db-analyzer/parser-enrichment.mjs';
import {
  normalizeMssqlRuntimeScopeResult,
  runAnalyzeProfile,
} from '../scripts/lib/db-analyzer/workflow.mjs';
import {
  loadAndResolveOperationProfile,
  resolveOperationProfile,
} from '../scripts/lib/db-analyzer/registry.mjs';
import {
  applyOperationMigration,
  applyOperationLifecycleAction,
  appendOperationHistory,
  createOperationLifecycleBackup,
  createOperationLifecycleRecord,
  createOperationMigrationPlan,
  createOperationCoordinator,
  initializeOperationLifecycleStore,
  readOperationLifecycleStore,
  recoverStaleOperationLifecycleOwnership,
  runOperationInvocation,
  selectLastKnownGoodOperation,
  validateOperationHistory,
  validateOperationLifecycleReceipt,
  validateOperationMigrationReceipt,
  validateOperationResumeCheckpoint,
} from '../scripts/lib/db-analyzer/operation.mjs';
import {
  buildOperationOutputBundle,
  writeOperationOutputBundle,
} from '../scripts/lib/db-analyzer/operation-outputs.mjs';
import { auditCatalogQuery, auditQueryPackSafety } from '../scripts/lib/db-analyzer/query-safety.mjs';
import { compareStructuralEvidence } from '../scripts/lib/db-analyzer/drift.mjs';
import { buildStructureMapOutputs } from '../scripts/lib/db-analyzer/outputs.mjs';
import { verifyDbAnalyzerDrift } from '../scripts/verify-db-analyzer-drift.mjs';
import { verifyDbAnalyzerOutputs } from '../scripts/verify-db-analyzer-outputs.mjs';
import { verifyDbAnalyzerProfilingProvenance } from '../scripts/verify-db-analyzer-profiling-provenance.mjs';
import { verifyDbAnalyzerCandidates } from '../scripts/verify-db-analyzer-candidates.mjs';
import { verifyDbAnalyzerProfilingCoverage } from '../scripts/verify-db-analyzer-profiling-coverage.mjs';
import { verifyDbAnalyzerProfilingReview } from '../scripts/verify-db-analyzer-profiling-review.mjs';
import { verifyDbAnalyzerKnowledge } from '../scripts/verify-db-analyzer-knowledge.mjs';
import { verifyDbAnalyzerSupersetResult } from '../scripts/verify-db-analyzer-superset-result.mjs';
import { verifyDbAnalyzerStoredLogicOutputs } from '../scripts/verify-db-analyzer-stored-logic-outputs.mjs';
import { verifyDbAnalyzerProvenance } from '../scripts/verify-db-analyzer-provenance.mjs';
import { verifyDbAnalyzerSafety } from '../scripts/verify-db-analyzer-safety.mjs';

const execFileAsync = promisify(execFile);

const root = path.resolve('query-packs/db-analyzer/v1');
const forbiddenSql = /\b(?:ALTER|CREATE|DELETE|DROP|EXEC(?:UTE)?|GRANT|INSERT|MERGE|REVOKE|TRUNCATE|UPDATE)\b/i;
const executableSql = (sql) => sql.replace(/'(?:''|[^'])*'/g, "''");

test('Slice 4 Gate 1 resolves symmetric credential-free source and capability registry profiles deterministically', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const profileFile = path.resolve(`tests/fixtures/db-analyzer/${engine}-operation-profile-ref-v1.json`);
    const first = await loadAndResolveOperationProfile(profileFile);
    const second = await loadAndResolveOperationProfile(profileFile);
    assert.deepEqual(first, second);
    assert.equal(first.schemaVersion, 'chimpmaera.db/operation-resolution/v1');
    assert.equal(first.source.engine, engine);
    assert.equal(first.source.policy.access, 'READ_ONLY');
    assert.equal(first.source.policy.allowRowSamples, false);
    assert.equal(first.source.credentialProvider.kind, 'ENV');
    assert.match(first.source.credentialProvider.reference, /^CM_DB_/);
    assert.equal(first.capabilityPack.capabilityPackVersion, '4.0.0');
    assert.equal(first.capabilityPack.queryPackVersion, 'v1');
    assert.equal(first.capabilityPack.normalizerVersion, 'v1');
    assert.equal(first.runtimeValidation, 'NOT_EXECUTED');
    assert.deepEqual(first.claims, {
      credentialsResolved: false,
      runtimeCompatibilityValidated: false,
      sourceConnected: false,
    });
    assert.match(first.resolutionSha256, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(canonicalJson(first), /password\s*[=:]|secret\s*[=:]|credentialValue/i);
  }
});

test('Slice 4 Gate 1 fails closed on embedded secrets, scope drift and capability widening', async () => {
  const registry = JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/source-registry-v1.json'), 'utf8'));
  const profileRef = JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/mssql-operation-profile-ref-v1.json'), 'utf8'));

  const embeddedSecret = structuredClone(registry);
  embeddedSecret.sources[0].credentialProvider.value = 'must-not-be-stored';
  assert.throws(() => resolveOperationProfile({ profileRef, registry: embeddedSecret }), /DB_REGISTRY_CREDENTIAL_PROVIDER_INVALID/);

  const scopeDrift = structuredClone(profileRef);
  scopeDrift.expected.scope.database = 'OTHER_DATABASE';
  assert.throws(() => resolveOperationProfile({ profileRef: scopeDrift, registry }), /DB_OPERATION_PROFILE_BINDING_DRIFT/);

  const capabilityWidening = structuredClone(registry);
  capabilityWidening.sources[0].enabledCapabilities.push('SOURCE_WRITES');
  assert.throws(() => resolveOperationProfile({ profileRef, registry: capabilityWidening }), /DB_REGISTRY_CAPABILITY_WIDENING_DENIED/);

  const traversal = structuredClone(profileRef);
  traversal.registryFile = '../source-registry-v1.json';
  assert.throws(() => resolveOperationProfile({ profileRef: traversal, registry }), /DB_OPERATION_PROFILE_REF_INVALID/);
});

const operationInvocation = ({ resolution, engine, kind, invocationId = `${engine}-${kind.toLowerCase()}-run-001`, overrides = {} }) => ({
  schemaVersion: 'chimpmaera.db/operation-invocation/v1',
  invocationId,
  requestedAt: '2026-08-11T09:05:00.000Z',
  trigger: { kind, reference: kind === 'MANUAL' ? 'cli:cm-db-analyze' : 'schedule:synthetic-nightly' },
  expectedResolutionSha256: resolution.resolutionSha256,
  controls: { timeoutMs: 100, maxAttempts: 2, retryDelayMs: 0, retryStates: ['TIMEOUT'], ...overrides },
});

test('Slice 4 Gate 2 uses one deterministic marker-scoped workflow for manual and scheduled invocations', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const resolution = await loadAndResolveOperationProfile(path.resolve(`tests/fixtures/db-analyzer/${engine}-operation-profile-ref-v1.json`));
    for (const kind of ['MANUAL', 'SCHEDULED']) {
      const invocation = operationInvocation({ resolution, engine, kind });
      const executor = async ({ resolution: boundResolution }) => ({
        state: 'SUCCEEDED',
        reasonCode: null,
        resultSha256: identitySha256({ engine, resolutionSha256: boundResolution.resolutionSha256 }),
      });
      const first = await runOperationInvocation({ resolution, invocation, coordinator: createOperationCoordinator(), executor });
      const second = await runOperationInvocation({ resolution, invocation, coordinator: createOperationCoordinator(), executor });
      assert.deepEqual(first, second);
      assert.equal(first.schemaVersion, 'chimpmaera.db/operation-run-receipt/v1');
      assert.equal(first.workflow, 'cm db analyze <profile>');
      assert.equal(first.invocation.trigger.kind, kind);
      assert.equal(first.binding.engine, engine);
      assert.equal(first.binding.resolutionSha256, resolution.resolutionSha256);
      assert.equal(first.ownership.ownerInvocationId, invocation.invocationId);
      assert.equal(first.ownership.acquisitionState, 'ACQUIRED');
      assert.equal(first.ownership.releaseState, 'RELEASED');
      assert.equal(first.outcome.state, 'SUCCEEDED');
      assert.equal(first.outcome.attemptsUsed, 1);
      assert.deepEqual(first.evidenceBoundary, {
        credentialsResolved: false,
        runtimeValidation: 'SYNTHETIC_UNVALIDATED',
        schedulerStarted: false,
        sourceConnected: false,
      });
      assert.equal(first.receiptSha256, identitySha256(Object.fromEntries(
        Object.entries(first).filter(([key]) => key !== 'receiptSha256'),
      )));
      assert.doesNotMatch(canonicalJson(first), /password\s*[=:]|secret\s*[=:]|credentialValue/i);
    }
  }
});

test('Slice 4 Gate 2 enforces concurrency, bounded timeout/retry and resolution binding', async () => {
  const resolution = await loadAndResolveOperationProfile(path.resolve('tests/fixtures/db-analyzer/mssql-operation-profile-ref-v1.json'));
  const coordinator = createOperationCoordinator();
  let unblock;
  const blocked = new Promise((resolve) => { unblock = resolve; });
  const firstInvocation = operationInvocation({ resolution, engine: 'mssql', kind: 'MANUAL' });
  const firstRun = runOperationInvocation({
    resolution,
    invocation: firstInvocation,
    coordinator,
    executor: async () => {
      await blocked;
      return { state: 'SUCCEEDED', reasonCode: null, resultSha256: identitySha256('first') };
    },
  });
  await Promise.resolve();
  await assert.rejects(
    runOperationInvocation({
      resolution,
      invocation: operationInvocation({ resolution, engine: 'mssql', kind: 'SCHEDULED' }),
      coordinator,
      executor: async () => ({ state: 'SUCCEEDED', reasonCode: null, resultSha256: identitySha256('second') }),
    }),
    /DB_OPERATION_CONCURRENCY_DENIED/,
  );
  unblock();
  await firstRun;

  let attempts = 0;
  const timeoutReceipt = await runOperationInvocation({
    resolution,
    invocation: operationInvocation({ resolution, engine: 'mssql', kind: 'SCHEDULED', invocationId: 'mssql-timeout-run-001', overrides: { timeoutMs: 5 } }),
    coordinator,
    executor: async ({ signal }) => {
      attempts += 1;
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { code: 'DB_OPERATION_ATTEMPT_TIMEOUT' })), { once: true });
      });
    },
  });
  assert.equal(attempts, 2);
  assert.equal(timeoutReceipt.outcome.state, 'TIMEOUT');
  assert.equal(timeoutReceipt.outcome.reasonCode, 'DB_OPERATION_ATTEMPT_TIMEOUT');
  assert.equal(timeoutReceipt.outcome.attemptsUsed, 2);
  assert.deepEqual(timeoutReceipt.attempts.map((attempt) => attempt.state), ['TIMEOUT', 'TIMEOUT']);

  const drifted = structuredClone(firstInvocation);
  drifted.expectedResolutionSha256 = '0'.repeat(64);
  await assert.rejects(
    runOperationInvocation({ resolution, invocation: drifted, coordinator, executor: async () => ({}) }),
    /DB_OPERATION_INVOCATION_INVALID/,
  );
  const widened = structuredClone(firstInvocation);
  widened.controls = { ...widened.controls, timeoutMs: resolution.source.policy.maxQueryTimeoutMs + 1, maxAttempts: 4 };
  await assert.rejects(
    runOperationInvocation({ resolution, invocation: widened, coordinator, executor: async () => ({}) }),
    /DB_OPERATION_INVOCATION_INVALID/,
  );
});

test('Slice 4 Gate 3 resumes both engines from digest-bound compatible checkpoints deterministically', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const resolution = await loadAndResolveOperationProfile(path.resolve(`tests/fixtures/db-analyzer/${engine}-operation-profile-ref-v1.json`));
    const invocation = operationInvocation({
      resolution,
      engine,
      kind: 'SCHEDULED',
      invocationId: `${engine}-resumable-run-001`,
      overrides: { maxAttempts: 3, retryStates: ['ERROR'] },
    });
    const resultSha256 = identitySha256({ engine, result: 'synthetic-resume-ground-truth' });
    let uninterruptedAttempts = 0;
    const uninterrupted = await runOperationInvocation({
      resolution,
      invocation,
      coordinator: createOperationCoordinator(),
      executor: async () => {
        uninterruptedAttempts += 1;
        return uninterruptedAttempts === 1
          ? { state: 'ERROR', reasonCode: 'SYNTHETIC_RESTART_REQUIRED', resultSha256: null }
          : { state: 'SUCCEEDED', reasonCode: null, resultSha256 };
      },
    });

    let checkpoint;
    await assert.rejects(
      runOperationInvocation({
        resolution,
        invocation,
        coordinator: createOperationCoordinator(),
        executor: async () => ({ state: 'ERROR', reasonCode: 'SYNTHETIC_RESTART_REQUIRED', resultSha256: null }),
        checkpointing: {
          checkpointedAt: '2026-08-11T09:05:01.000Z',
          validUntil: '2026-08-12T09:05:01.000Z',
          sink: async (candidate) => {
            checkpoint = candidate;
            throw Object.assign(new Error('synthetic process stop'), { code: 'SYNTHETIC_PROCESS_STOP' });
          },
        },
      }),
      /synthetic process stop/,
    );
    assert.equal(checkpoint.schemaVersion, 'chimpmaera.db/operation-resume-checkpoint/v1');
    assert.equal(checkpoint.binding.resolutionSha256, resolution.resolutionSha256);
    assert.equal(checkpoint.binding.engine, engine);
    assert.equal(checkpoint.binding.capabilityPackVersion, '4.0.0');
    assert.equal(checkpoint.binding.queryPackVersion, 'v1');
    assert.equal(checkpoint.binding.normalizerVersion, 'v1');
    assert.equal(checkpoint.progress.completedAttempts.length, 1);
    assert.equal(checkpoint.progress.nextAttempt, 2);
    assert.match(checkpoint.progress.completedAttempts[0].attemptIdentitySha256, /^[a-f0-9]{64}$/);
    assert.match(checkpoint.checkpointSha256, /^[a-f0-9]{64}$/);

    const resumed = await runOperationInvocation({
      resolution,
      invocation,
      coordinator: createOperationCoordinator(),
      executor: async ({ attempt }) => {
        assert.equal(attempt, 2);
        return { state: 'SUCCEEDED', reasonCode: null, resultSha256 };
      },
      resume: { checkpoint, resumedAt: '2026-08-11T10:05:01.000Z' },
    });
    const { resume: uninterruptedResume, receiptSha256: uninterruptedReceiptSha256, ...uninterruptedBody } = uninterrupted;
    const { resume: resumedBinding, receiptSha256: resumedReceiptSha256, ...resumedBody } = resumed;
    assert.deepEqual(resumedBody, uninterruptedBody);
    assert.equal(uninterruptedResume, null);
    assert.equal(resumedBinding.checkpointSha256, checkpoint.checkpointSha256);
    assert.equal(resumedBinding.resumedAt, '2026-08-11T10:05:01.000Z');
    assert.notEqual(resumedReceiptSha256, uninterruptedReceiptSha256);
    assert.deepEqual(resumed.attempts.map(({ attempt, state }) => ({ attempt, state })), [
      { attempt: 1, state: 'ERROR' },
      { attempt: 2, state: 'SUCCEEDED' },
    ]);
    assert.doesNotMatch(canonicalJson(checkpoint), /password\s*[=:]|secret\s*[=:]|credentialValue/i);
  }
});

test('Slice 4 Gate 3 rejects stale, foreign, tampered and capability-widened checkpoints', async () => {
  const mssql = await loadAndResolveOperationProfile(path.resolve('tests/fixtures/db-analyzer/mssql-operation-profile-ref-v1.json'));
  const oracle = await loadAndResolveOperationProfile(path.resolve('tests/fixtures/db-analyzer/oracle-operation-profile-ref-v1.json'));
  const invocation = operationInvocation({
    resolution: mssql,
    engine: 'mssql',
    kind: 'SCHEDULED',
    invocationId: 'mssql-checkpoint-negative-001',
    overrides: { maxAttempts: 3, retryStates: ['ERROR'] },
  });
  let checkpoint;
  await assert.rejects(
    runOperationInvocation({
      resolution: mssql,
      invocation,
      coordinator: createOperationCoordinator(),
      executor: async () => ({ state: 'ERROR', reasonCode: 'SYNTHETIC_RESTART_REQUIRED', resultSha256: null }),
      checkpointing: {
        checkpointedAt: '2026-08-11T09:05:01.000Z',
        validUntil: '2026-08-11T10:05:01.000Z',
        sink: async (candidate) => {
          checkpoint = candidate;
          throw new Error('stop-after-checkpoint');
        },
      },
    }),
    /stop-after-checkpoint/,
  );

  assert.throws(
    () => validateOperationResumeCheckpoint({
      checkpoint,
      resolution: mssql,
      invocation,
      resumedAt: '2026-08-11T10:05:01.001Z',
    }),
    /DB_OPERATION_CHECKPOINT_STALE/,
  );

  const tampered = structuredClone(checkpoint);
  tampered.progress.completedAttempts[0].reasonCode = 'INVENTED_SUCCESS';
  assert.throws(
    () => validateOperationResumeCheckpoint({
      checkpoint: tampered,
      resolution: mssql,
      invocation,
      resumedAt: '2026-08-11T09:30:00.000Z',
    }),
    /DB_OPERATION_CHECKPOINT_TAMPERED/,
  );

  const foreignInvocation = operationInvocation({
    resolution: oracle,
    engine: 'oracle',
    kind: 'SCHEDULED',
    invocationId: invocation.invocationId,
    overrides: { maxAttempts: 3, retryStates: ['ERROR'] },
  });
  assert.throws(
    () => validateOperationResumeCheckpoint({
      checkpoint,
      resolution: oracle,
      invocation: foreignInvocation,
      resumedAt: '2026-08-11T09:30:00.000Z',
    }),
    /DB_OPERATION_CHECKPOINT_FOREIGN/,
  );

  const widened = structuredClone(checkpoint);
  widened.binding.enabledCapabilities.push('SOURCE_WRITES');
  const { checkpointSha256: ignored, ...widenedBody } = widened;
  widened.checkpointSha256 = identitySha256(widenedBody);
  assert.throws(
    () => validateOperationResumeCheckpoint({
      checkpoint: widened,
      resolution: mssql,
      invocation,
      resumedAt: '2026-08-11T09:30:00.000Z',
    }),
    /DB_OPERATION_CHECKPOINT_CAPABILITY_WIDENING_DENIED/,
  );

  const inventedRuntime = structuredClone(checkpoint);
  inventedRuntime.evidenceBoundary.sourceConnected = true;
  const { checkpointSha256: ignoredRuntime, ...inventedRuntimeBody } = inventedRuntime;
  inventedRuntime.checkpointSha256 = identitySha256(inventedRuntimeBody);
  assert.throws(
    () => validateOperationResumeCheckpoint({
      checkpoint: inventedRuntime,
      resolution: mssql,
      invocation,
      resumedAt: '2026-08-11T09:30:00.000Z',
    }),
    /DB_OPERATION_CHECKPOINT_CLAIM_INVALID/,
  );
});

test('Slice 4 Gate 4 keeps bounded deterministic rescan/drift history and exact last-known-good evidence', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const resolution = await loadAndResolveOperationProfile(path.resolve(`tests/fixtures/db-analyzer/${engine}-operation-profile-ref-v1.json`));
    const successfulReceipt = async (invocationId, result) => runOperationInvocation({
      resolution,
      invocation: operationInvocation({ resolution, engine, kind: 'SCHEDULED', invocationId }),
      coordinator: createOperationCoordinator(),
      executor: async () => ({ state: 'SUCCEEDED', reasonCode: null, resultSha256: identitySha256({ engine, result }) }),
    });
    const baseline = await successfulReceipt(`${engine}-history-baseline-001`, 'A');
    const unchanged = await successfulReceipt(`${engine}-history-unchanged-002`, 'A');
    const changed = await successfulReceipt(`${engine}-history-changed-003`, 'B');
    let history = appendOperationHistory({
      resolution, receipt: baseline, recordedAt: '2026-08-11T11:00:00.000Z', maxEntries: 3,
    });
    history = appendOperationHistory({
      history, resolution, receipt: unchanged, recordedAt: '2026-08-11T11:01:00.000Z', maxEntries: 3,
    });
    history = appendOperationHistory({
      history, resolution, receipt: changed, recordedAt: '2026-08-11T11:02:00.000Z', maxEntries: 3,
    });
    assert.deepEqual(history.entries.map(({ drift }) => drift.state), ['BASELINE', 'UNCHANGED', 'CHANGED']);

    const resumableInvocation = operationInvocation({
      resolution,
      engine,
      kind: 'SCHEDULED',
      invocationId: `${engine}-history-resumed-004`,
      overrides: { maxAttempts: 3, retryStates: ['ERROR'] },
    });
    let checkpoint;
    await assert.rejects(
      runOperationInvocation({
        resolution,
        invocation: resumableInvocation,
        coordinator: createOperationCoordinator(),
        executor: async () => ({ state: 'ERROR', reasonCode: 'SYNTHETIC_RESTART_REQUIRED', resultSha256: null }),
        checkpointing: {
          checkpointedAt: '2026-08-11T11:03:00.000Z',
          validUntil: '2026-08-12T11:03:00.000Z',
          sink: async (candidate) => {
            checkpoint = candidate;
            throw new Error('stop-after-history-checkpoint');
          },
        },
      }),
      /stop-after-history-checkpoint/,
    );
    const resumed = await runOperationInvocation({
      resolution,
      invocation: resumableInvocation,
      coordinator: createOperationCoordinator(),
      executor: async () => ({ state: 'SUCCEEDED', reasonCode: null, resultSha256: identitySha256({ engine, result: 'C' }) }),
      resume: { checkpoint, resumedAt: '2026-08-11T11:04:00.000Z' },
    });
    history = appendOperationHistory({
      history,
      resolution,
      receipt: resumed,
      resumeCheckpoint: checkpoint,
      recordedAt: '2026-08-11T11:05:00.000Z',
      maxEntries: 3,
    });
    const failed = await runOperationInvocation({
      resolution,
      invocation: operationInvocation({
        resolution, engine, kind: 'SCHEDULED', invocationId: `${engine}-history-failed-005`,
      }),
      coordinator: createOperationCoordinator(),
      executor: async () => ({ state: 'ERROR', reasonCode: 'SYNTHETIC_SOURCE_UNAVAILABLE', resultSha256: null }),
    });
    history = appendOperationHistory({
      history, resolution, receipt: failed, recordedAt: '2026-08-11T11:06:00.000Z', maxEntries: 3,
    });
    const selected = selectLastKnownGoodOperation({ history, resolution });
    assert.equal(history.totalEntries, 5);
    assert.equal(history.entries.length, 3);
    assert.equal(history.prunedEntries, 2);
    assert.equal(history.entries.at(-1).receipt.outcome.state, 'ERROR');
    assert.equal(selected.sequence, 4);
    assert.equal(selected.receipt.receiptSha256, resumed.receiptSha256);
    assert.equal(selected.resumeCheckpoint.checkpointSha256, checkpoint.checkpointSha256);
    assert.equal(selected.drift.state, 'CHANGED');
    assert.equal(history.lastKnownGoodEntrySha256, selected.entrySha256);
    assert.deepEqual(
      history,
      validateOperationHistory({ history: structuredClone(history), resolution }),
    );
    assert.doesNotMatch(canonicalJson(history), /password\s*[=:]|secret\s*[=:]|credentialValue/i);
  }
});

test('Slice 4 Gate 4 rejects invented last-known-good, checkpoint drift, foreign history and retention widening', async () => {
  const mssql = await loadAndResolveOperationProfile(path.resolve('tests/fixtures/db-analyzer/mssql-operation-profile-ref-v1.json'));
  const oracle = await loadAndResolveOperationProfile(path.resolve('tests/fixtures/db-analyzer/oracle-operation-profile-ref-v1.json'));
  const invocation = operationInvocation({
    resolution: mssql,
    engine: 'mssql',
    kind: 'SCHEDULED',
    invocationId: 'mssql-history-negative-001',
    overrides: { maxAttempts: 3, retryStates: ['ERROR'] },
  });
  let checkpoint;
  await assert.rejects(
    runOperationInvocation({
      resolution: mssql,
      invocation,
      coordinator: createOperationCoordinator(),
      executor: async () => ({ state: 'ERROR', reasonCode: 'SYNTHETIC_RESTART_REQUIRED', resultSha256: null }),
      checkpointing: {
        checkpointedAt: '2026-08-11T11:10:00.000Z',
        validUntil: '2026-08-12T11:10:00.000Z',
        sink: async (candidate) => {
          checkpoint = candidate;
          throw new Error('stop-after-negative-history-checkpoint');
        },
      },
    }),
    /stop-after-negative-history-checkpoint/,
  );
  const receipt = await runOperationInvocation({
    resolution: mssql,
    invocation,
    coordinator: createOperationCoordinator(),
    executor: async () => ({ state: 'SUCCEEDED', reasonCode: null, resultSha256: identitySha256('history-negative-ground-truth') }),
    resume: { checkpoint, resumedAt: '2026-08-11T11:11:00.000Z' },
  });
  const history = appendOperationHistory({
    resolution: mssql,
    receipt,
    resumeCheckpoint: checkpoint,
    recordedAt: '2026-08-11T11:12:00.000Z',
    maxEntries: 3,
  });

  const invented = structuredClone(history);
  invented.lastKnownGoodEntrySha256 = null;
  const { historySha256: ignoredInvented, ...inventedBody } = invented;
  invented.historySha256 = identitySha256(inventedBody);
  assert.throws(
    () => selectLastKnownGoodOperation({ history: invented, resolution: mssql }),
    /DB_OPERATION_HISTORY_LAST_KNOWN_GOOD_INVALID/,
  );

  const checkpointDrift = structuredClone(history);
  checkpointDrift.entries[0].receipt.resume.checkpointSha256 = '0'.repeat(64);
  const { receiptSha256: ignoredReceipt, ...receiptBody } = checkpointDrift.entries[0].receipt;
  checkpointDrift.entries[0].receipt.receiptSha256 = identitySha256(receiptBody);
  const { entrySha256: ignoredEntry, ...entryBody } = checkpointDrift.entries[0];
  checkpointDrift.entries[0].entrySha256 = identitySha256(entryBody);
  checkpointDrift.lastKnownGoodEntrySha256 = checkpointDrift.entries[0].entrySha256;
  const { historySha256: ignoredHistory, ...historyBody } = checkpointDrift;
  checkpointDrift.historySha256 = identitySha256(historyBody);
  assert.throws(
    () => validateOperationHistory({ history: checkpointDrift, resolution: mssql }),
    /DB_OPERATION_RECEIPT_CHECKPOINT_INVALID/,
  );
  assert.throws(
    () => validateOperationHistory({ history, resolution: oracle }),
    /DB_OPERATION_HISTORY_FOREIGN|DB_OPERATION_RECEIPT_BINDING_DRIFT/,
  );
  assert.throws(
    () => appendOperationHistory({
      history,
      resolution: mssql,
      receipt,
      resumeCheckpoint: checkpoint,
      recordedAt: '2026-08-11T11:13:00.000Z',
      maxEntries: 4,
    }),
    /DB_OPERATION_HISTORY_POLICY_DRIFT/,
  );
});

async function operationUpgradeScenario(engine) {
  const registry = JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/source-registry-v1.json'), 'utf8'));
  const profileRef = JSON.parse(await readFile(path.resolve(`tests/fixtures/db-analyzer/${engine}-operation-profile-ref-v1.json`), 'utf8'));
  const fromResolution = resolveOperationProfile({ profileRef, registry });
  const upgradedRegistry = structuredClone(registry);
  upgradedRegistry.registryVersion = '1.1.0';
  const pack = upgradedRegistry.capabilityPacks[0];
  pack.capabilityPackVersion = '4.1.0';
  pack.capabilities.push('OPERATION_LIFECYCLE');
  for (const registeredSource of upgradedRegistry.sources) {
    registeredSource.capabilityPackRef.capabilityPackVersion = '4.1.0';
  }
  const source = upgradedRegistry.sources.find((candidate) => candidate.engine === engine);
  source.enabledCapabilities.push('OPERATION_LIFECYCLE');
  source.scope.schemas.push(engine === 'mssql' ? 'analytics' : 'CM_ANALYTICS');
  const upgradedProfileRef = structuredClone(profileRef);
  upgradedProfileRef.expected.scope = structuredClone(source.scope);
  upgradedProfileRef.expected.capabilityPackRef.capabilityPackVersion = '4.1.0';
  const toResolution = resolveOperationProfile({ profileRef: upgradedProfileRef, registry: upgradedRegistry });
  const receipt = await runOperationInvocation({
    resolution: fromResolution,
    invocation: operationInvocation({
      resolution: fromResolution,
      engine,
      kind: 'SCHEDULED',
      invocationId: `${engine}-pre-upgrade-baseline-001`,
    }),
    coordinator: createOperationCoordinator(),
    executor: async () => ({
      state: 'SUCCEEDED',
      reasonCode: null,
      resultSha256: identitySha256({ engine, state: 'pre-upgrade-ground-truth' }),
    }),
  });
  const history = appendOperationHistory({
    resolution: fromResolution,
    receipt,
    recordedAt: '2026-08-11T11:20:00.000Z',
    maxEntries: 3,
  });
  return { fromResolution, toResolution, history };
}

test('Slice 4 Gate 5 emits exact reviewed schema/capability upgrade drift and migration receipts', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const { fromResolution, toResolution, history } = await operationUpgradeScenario(engine);
    const plan = createOperationMigrationPlan({
      fromResolution,
      toResolution,
      requestedAt: '2026-08-11T11:21:00.000Z',
    });
    assert.equal(plan.source.engine, engine);
    assert.equal(plan.drift.registryVersion.before, '1.0.0');
    assert.equal(plan.drift.registryVersion.after, '1.1.0');
    assert.equal(plan.drift.capabilityPack.versionBefore, '4.0.0');
    assert.equal(plan.drift.capabilityPack.versionAfter, '4.1.0');
    assert.deepEqual(plan.drift.capabilityPack.addedCapabilities, ['OPERATION_LIFECYCLE']);
    assert.deepEqual(plan.drift.capabilityPack.removedCapabilities, []);
    assert.deepEqual(
      plan.drift.schemaScope.addedSchemas,
      [engine === 'mssql' ? 'analytics' : 'CM_ANALYTICS'],
    );
    assert.deepEqual(plan.drift.schemaScope.removedSchemas, []);
    assert.deepEqual(plan.reviewBoundary, {
      automaticApplicationAllowed: false,
      reasons: [
        'CAPABILITY_ENABLEMENT_CHANGE',
        'CAPABILITY_PACK_VERSION_CHANGE',
        'REGISTRY_VERSION_CHANGE',
        'SCHEMA_SCOPE_CHANGE',
      ],
      required: true,
      state: 'PENDING',
    });

    const input = {
      plan,
      fromResolution,
      toResolution,
      history,
      review: {
        decision: 'APPROVED',
        reviewedAt: '2026-08-11T11:22:00.000Z',
        reviewerReference: `synthetic-review:${engine}:001`,
        reasonCode: 'SYNTHETIC_CONTROLLED_UPGRADE_APPROVED',
      },
      appliedAt: '2026-08-11T11:23:00.000Z',
    };
    const first = applyOperationMigration(input);
    const second = applyOperationMigration(input);
    assert.deepEqual(first, second);
    assert.equal(first.resolution.resolutionSha256, toResolution.resolutionSha256);
    assert.equal(first.receipt.transition.driftSha256, plan.drift.driftSha256);
    assert.equal(first.receipt.priorHistory.historySha256, history.historySha256);
    assert.equal(first.receipt.rollback.resolutionSha256, fromResolution.resolutionSha256);
    assert.equal(first.receipt.rollback.lastKnownGoodEntrySha256, history.lastKnownGoodEntrySha256);
    assert.equal(first.receipt.outcome.state, 'APPLIED_TO_REGISTRY');
    assert.equal(first.receipt.outcome.newHistoryRequired, true);
    assert.deepEqual(first.receipt.evidenceBoundary, {
      priorHistoryRewritten: false,
      registryPersistenceClaimed: false,
      runtimeValidation: 'SYNTHETIC_UNVALIDATED',
      sourceDatabaseWritten: false,
    });
    assert.deepEqual(first.receipt, validateOperationMigrationReceipt({
      receipt: structuredClone(first.receipt), plan, fromResolution, toResolution, history,
    }));
    assert.doesNotMatch(canonicalJson({ plan, receipt: first.receipt }), /password\s*[=:]|secret\s*[=:]|credentialValue/i);
    assert.throws(
      () => validateOperationHistory({ history, resolution: toResolution }),
      /DB_OPERATION_HISTORY_FOREIGN|DB_OPERATION_RECEIPT_BINDING_DRIFT/,
    );
  }
});

test('Slice 4 Gate 5 denies unreviewed, tampered, replacement and invented-effect migrations', async () => {
  const scenario = await operationUpgradeScenario('mssql');
  const plan = createOperationMigrationPlan({
    fromResolution: scenario.fromResolution,
    toResolution: scenario.toResolution,
    requestedAt: '2026-08-11T11:21:00.000Z',
  });
  const input = {
    ...scenario,
    plan,
    review: {
      decision: 'APPROVED',
      reviewedAt: '2026-08-11T11:22:00.000Z',
      reviewerReference: 'synthetic-review:mssql:negative',
      reasonCode: 'SYNTHETIC_CONTROLLED_UPGRADE_APPROVED',
    },
    appliedAt: '2026-08-11T11:23:00.000Z',
  };
  assert.throws(
    () => applyOperationMigration({ ...input, review: { ...input.review, decision: 'REJECTED' } }),
    /DB_OPERATION_MIGRATION_REVIEW_REQUIRED/,
  );

  const tamperedPlan = structuredClone(plan);
  tamperedPlan.drift.schemaScope.addedSchemas.push('invented_schema');
  assert.throws(
    () => applyOperationMigration({ ...input, plan: tamperedPlan }),
    /DB_OPERATION_MIGRATION_PLAN_TAMPERED/,
  );

  const replacement = structuredClone(scenario.toResolution);
  replacement.source.adapter.host = 'replacement.example.invalid';
  const { resolutionSha256: ignoredResolution, ...replacementBody } = replacement;
  replacement.resolutionSha256 = identitySha256(replacementBody);
  assert.throws(
    () => createOperationMigrationPlan({
      fromResolution: scenario.fromResolution,
      toResolution: replacement,
      requestedAt: '2026-08-11T11:21:00.000Z',
    }),
    /DB_OPERATION_MIGRATION_REPLACEMENT_DENIED/,
  );

  const applied = applyOperationMigration(input);
  const inventedEffect = structuredClone(applied.receipt);
  inventedEffect.evidenceBoundary.sourceDatabaseWritten = true;
  const { receiptSha256: ignoredReceipt, ...receiptBody } = inventedEffect;
  inventedEffect.receiptSha256 = identitySha256(receiptBody);
  assert.throws(
    () => validateOperationMigrationReceipt({
      receipt: inventedEffect,
      plan,
      fromResolution: scenario.fromResolution,
      toResolution: scenario.toResolution,
      history: scenario.history,
    }),
    /DB_OPERATION_MIGRATION_RECEIPT_CLAIM_INVALID/,
  );
});

const lifecycleRecordsFor = ({ resolution, history }) => [
  createOperationLifecycleRecord({
    resolution,
    artifactKind: 'RESOLUTION',
    artifactId: resolution.resolutionSha256,
    payload: resolution,
  }),
  createOperationLifecycleRecord({
    resolution,
    artifactKind: 'HISTORY',
    artifactId: history.historySha256,
    payload: history,
  }),
  createOperationLifecycleRecord({
    resolution,
    artifactKind: 'CHECKPOINT',
    artifactId: 'synthetic-resume-001',
    payload: { state: 'SYNTHETIC_RESUMABLE', historySha256: history.historySha256 },
  }),
  createOperationLifecycleRecord({
    resolution,
    artifactKind: 'EVIDENCE',
    artifactId: 'structure-evidence-001',
    payload: { state: 'RETAINED', sourceId: resolution.source.sourceId },
  }),
  createOperationLifecycleRecord({
    resolution,
    artifactKind: 'KNOWLEDGE',
    artifactId: 'approved-knowledge-001',
    payload: { state: 'APPROVED', sourceId: resolution.source.sourceId },
  }),
  createOperationLifecycleRecord({
    resolution,
    artifactKind: 'SUPERSET',
    artifactId: 'disconnected-superset-001',
    payload: { state: 'DISCONNECTED', sourceId: resolution.source.sourceId },
  }),
];

test('Slice 4 Gate 6 persists marker-scoped backup, reset, restore, removal and rollback symmetrically', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const otherEngine = engine === 'mssql' ? 'oracle' : 'mssql';
    const scenario = await operationUpgradeScenario(engine);
    const unrelatedScenario = await operationUpgradeScenario(otherEngine);
    const records = [
      ...lifecycleRecordsFor({ resolution: scenario.fromResolution, history: scenario.history }),
      ...lifecycleRecordsFor({
        resolution: unrelatedScenario.fromResolution,
        history: unrelatedScenario.history,
      }),
    ];
    const rootDir = await mkdtemp(path.join(tmpdir(), `cm-db-lifecycle-${engine}-`));
    try {
      const initialized = await initializeOperationLifecycleStore({ rootDir, records });
      assert.equal(initialized.revision, 0);
      const markerSha256 = records.find((record) => (
        record.payloadSha256 === identitySha256(scenario.fromResolution)
      )).markerSha256;
      const unrelatedBefore = initialized.records.filter((record) => record.markerSha256 !== markerSha256);
      const backupInput = {
        rootDir,
        resolution: scenario.fromResolution,
        ownerId: `${engine}-lifecycle-owner-001`,
        createdAt: '2026-08-11T11:30:00.000Z',
      };
      const backup = await createOperationLifecycleBackup(backupInput);
      assert.deepEqual(backup, await createOperationLifecycleBackup(backupInput));
      assert.equal(backup.records.length, 6);
      assert.equal(backup.evidenceBoundary.unrelatedRecordsIncluded, false);

      const reset = await applyOperationLifecycleAction({
        ...backupInput,
        action: 'RESET',
        backup,
        performedAt: '2026-08-11T11:31:00.000Z',
      });
      assert.equal(reset.receipt.outcome.state, 'APPLIED');
      assert.deepEqual(
        reset.store.records.filter((record) => record.markerSha256 === markerSha256)
          .map((record) => record.artifactKind),
        ['EVIDENCE', 'KNOWLEDGE', 'RESOLUTION', 'SUPERSET'],
      );
      const repeatedReset = await applyOperationLifecycleAction({
        ...backupInput,
        action: 'RESET',
        backup,
        performedAt: '2026-08-11T11:31:01.000Z',
      });
      assert.equal(repeatedReset.receipt.outcome.state, 'ALREADY_SATISFIED');
      assert.equal(repeatedReset.store.storeSha256, reset.store.storeSha256);

      const restored = await applyOperationLifecycleAction({
        ...backupInput,
        action: 'RESTORE',
        backup,
        performedAt: '2026-08-11T11:32:00.000Z',
      });
      assert.deepEqual(
        restored.store.records.filter((record) => record.markerSha256 === markerSha256),
        backup.records,
      );
      const removed = await applyOperationLifecycleAction({
        ...backupInput,
        action: 'REMOVE',
        backup,
        performedAt: '2026-08-11T11:33:00.000Z',
      });
      assert.equal(removed.store.records.some((record) => record.markerSha256 === markerSha256), false);
      const repeatedRemoval = await applyOperationLifecycleAction({
        ...backupInput,
        action: 'REMOVE',
        backup,
        performedAt: '2026-08-11T11:33:01.000Z',
      });
      assert.equal(repeatedRemoval.receipt.outcome.state, 'ALREADY_SATISFIED');
      assert.equal(repeatedRemoval.store.storeSha256, removed.store.storeSha256);

      const rolledBack = await applyOperationLifecycleAction({
        ...backupInput,
        action: 'ROLLBACK',
        backup,
        performedAt: '2026-08-11T11:34:00.000Z',
      });
      assert.deepEqual(
        rolledBack.store.records.filter((record) => record.markerSha256 === markerSha256),
        backup.records,
      );
      assert.deepEqual(
        rolledBack.store.records.filter((record) => record.markerSha256 !== markerSha256),
        unrelatedBefore,
      );
      assert.equal(rolledBack.receipt.evidenceBoundary.persistenceValidation, 'LOCAL_FILESYSTEM_SYNTHETIC');
      assert.equal(rolledBack.receipt.evidenceBoundary.sourceDatabaseWritten, false);
      assert.equal(rolledBack.receipt.evidenceBoundary.unrelatedRecordsChanged, false);
      assert.deepEqual(
        validateOperationLifecycleReceipt({
          receipt: structuredClone(rolledBack.receipt),
          resolution: scenario.fromResolution,
          backup,
        }),
        rolledBack.receipt,
      );
      assert.doesNotMatch(canonicalJson({ backup, receipt: rolledBack.receipt }), /password\s*[=:]|secret\s*[=:]|credentialValue/i);
      assert.deepEqual(await readOperationLifecycleStore({ rootDir }), rolledBack.store);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  }
});

test('Slice 4 Gate 6 denies secret material, stale backups, tampering and foreign marker ownership', async () => {
  const scenario = await operationUpgradeScenario('mssql');
  assert.throws(
    () => createOperationLifecycleRecord({
      resolution: scenario.fromResolution,
      artifactKind: 'EVIDENCE',
      artifactId: 'secret-negative-001',
      payload: { password: 'denied' },
    }),
    /DB_OPERATION_LIFECYCLE_RECORD_INVALID/,
  );
  const records = lifecycleRecordsFor({ resolution: scenario.fromResolution, history: scenario.history });
  const rootDir = await mkdtemp(path.join(tmpdir(), 'cm-db-lifecycle-negative-'));
  try {
    await initializeOperationLifecycleStore({ rootDir, records });
    const backupInput = {
      rootDir,
      resolution: scenario.fromResolution,
      ownerId: 'mssql-lifecycle-negative-001',
      createdAt: '2026-08-11T11:40:00.000Z',
    };
    const backup = await createOperationLifecycleBackup(backupInput);

    const tamperedBackup = structuredClone(backup);
    tamperedBackup.records[0].artifactId = 'invented-artifact-001';
    await assert.rejects(
      applyOperationLifecycleAction({
        ...backupInput,
        action: 'RESTORE',
        backup: tamperedBackup,
        performedAt: '2026-08-11T11:41:00.000Z',
      }),
      /DB_OPERATION_LIFECYCLE_BACKUP_TAMPERED/,
    );

    const store = await readOperationLifecycleStore({ rootDir });
    const extra = createOperationLifecycleRecord({
      resolution: scenario.fromResolution,
      artifactKind: 'EVIDENCE',
      artifactId: 'newer-evidence-002',
      payload: { state: 'NEWER_THAN_BACKUP' },
    });
    const body = normalizeJsonValue({
      schemaVersion: store.schemaVersion,
      revision: store.revision + 1,
      records: [...store.records, extra].sort((left, right) => (
        `${left.markerSha256}:${left.artifactKind}:${left.artifactId}`
          .localeCompare(`${right.markerSha256}:${right.artifactKind}:${right.artifactId}`)
      )),
    });
    await writeFile(
      path.join(rootDir, 'operation-lifecycle-store.json'),
      `${JSON.stringify({ ...body, storeSha256: identitySha256(body) }, null, 2)}\n`,
      'utf8',
    );
    await assert.rejects(
      applyOperationLifecycleAction({
        ...backupInput,
        action: 'RESET',
        backup,
        performedAt: '2026-08-11T11:42:00.000Z',
      }),
      /DB_OPERATION_LIFECYCLE_BACKUP_STALE/,
    );

    await writeFile(
      path.join(rootDir, '.operation-lifecycle-owner.json'),
      '{"markerSha256":"foreign","ownerId":"foreign-owner"}\n',
      'utf8',
    );
    await assert.rejects(
      createOperationLifecycleBackup({ ...backupInput, createdAt: '2026-08-11T11:43:00.000Z' }),
      /DB_OPERATION_LIFECYCLE_CONCURRENCY_DENIED/,
    );
    await rm(path.join(rootDir, '.operation-lifecycle-owner.json'));

    const restored = await applyOperationLifecycleAction({
      ...backupInput,
      action: 'RESTORE',
      backup,
      performedAt: '2026-08-11T11:44:00.000Z',
    });
    const inventedEffect = structuredClone(restored.receipt);
    inventedEffect.evidenceBoundary.sourceDatabaseWritten = true;
    const { receiptSha256: ignoredReceipt, ...receiptBody } = inventedEffect;
    inventedEffect.receiptSha256 = identitySha256(receiptBody);
    assert.throws(
      () => validateOperationLifecycleReceipt({
        receipt: inventedEffect,
        resolution: scenario.fromResolution,
        backup,
      }),
      /DB_OPERATION_LIFECYCLE_RECEIPT_CLAIM_INVALID/,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('Slice 4 Gate 7 reuses one operation and lifecycle contract for a second database per engine', async () => {
  const groundTruth = JSON.parse(await readFile(path.resolve(
    'tests/fixtures/db-analyzer/operation-second-databases-ground-truth-v1.json',
  ), 'utf8'));
  assert.equal(groundTruth.schemaVersion, 'chimpmaera.db/operation-second-databases-ground-truth/v1');
  for (const fixture of groundTruth.databases) {
    const firstResolution = await loadAndResolveOperationProfile(path.resolve(
      `tests/fixtures/db-analyzer/${fixture.engine}-operation-profile-ref-v1.json`,
    ));
    const secondResolution = await loadAndResolveOperationProfile(path.resolve(
      `tests/fixtures/db-analyzer/${fixture.profileFile}`,
    ));
    assert.equal(secondResolution.source.sourceId, fixture.sourceId);
    assert.deepEqual(secondResolution.source.scope, fixture.scope);
    assert.notEqual(secondResolution.source.sourceId, firstResolution.source.sourceId);
    assert.notEqual(secondResolution.resolutionSha256, firstResolution.resolutionSha256);

    const execute = async (resolution, suffix, syntheticResult) => {
      const receipt = await runOperationInvocation({
        resolution,
        invocation: operationInvocation({
          resolution,
          engine: fixture.engine,
          kind: 'SCHEDULED',
          invocationId: `${fixture.engine}-${suffix}-reuse-001`,
        }),
        coordinator: createOperationCoordinator(),
        executor: async ({ resolution: boundResolution }) => ({
          state: 'SUCCEEDED',
          reasonCode: null,
          resultSha256: identitySha256({
            sourceId: boundResolution.source.sourceId,
            scope: boundResolution.source.scope,
            syntheticResult,
          }),
        }),
      });
      return appendOperationHistory({
        resolution,
        receipt,
        recordedAt: '2026-08-11T11:50:00.000Z',
        maxEntries: 3,
      });
    };
    const firstHistory = await execute(firstResolution, 'unknown-a', {
      coverageState: 'EXISTING_SYNTHETIC_BASELINE',
      rowSamplesIncluded: false,
    });
    const secondHistory = await execute(secondResolution, 'unknown-b', fixture.syntheticResult);
    assert.equal(
      secondHistory.entries[0].receipt.outcome.resultSha256,
      identitySha256({
        sourceId: fixture.sourceId,
        scope: fixture.scope,
        syntheticResult: fixture.syntheticResult,
      }),
    );
    assert.equal(secondHistory.entries[0].receipt.workflow, 'cm db analyze <profile>');

    const firstRecords = lifecycleRecordsFor({ resolution: firstResolution, history: firstHistory });
    const secondRecords = lifecycleRecordsFor({ resolution: secondResolution, history: secondHistory });
    const rootDir = await mkdtemp(path.join(tmpdir(), `cm-db-second-source-${fixture.engine}-`));
    try {
      const initialized = await initializeOperationLifecycleStore({
        rootDir,
        records: [...firstRecords, ...secondRecords],
      });
      const firstMarker = firstRecords[0].markerSha256;
      const secondMarker = secondRecords[0].markerSha256;
      assert.notEqual(firstMarker, secondMarker);
      const firstSourceBefore = initialized.records.filter((record) => record.markerSha256 === firstMarker);
      const backup = await createOperationLifecycleBackup({
        rootDir,
        resolution: secondResolution,
        ownerId: `${fixture.engine}-second-source-owner-001`,
        createdAt: '2026-08-11T11:51:00.000Z',
      });
      const reset = await applyOperationLifecycleAction({
        rootDir,
        resolution: secondResolution,
        ownerId: `${fixture.engine}-second-source-owner-001`,
        action: 'RESET',
        backup,
        performedAt: '2026-08-11T11:52:00.000Z',
      });
      assert.deepEqual(
        reset.store.records.filter((record) => record.markerSha256 === firstMarker),
        firstSourceBefore,
      );
      assert.deepEqual(
        reset.store.records.filter((record) => record.markerSha256 === secondMarker)
          .map((record) => record.artifactKind),
        ['EVIDENCE', 'KNOWLEDGE', 'RESOLUTION', 'SUPERSET'],
      );
      assert.equal(reset.receipt.evidenceBoundary.unrelatedRecordsChanged, false);
      assert.doesNotMatch(
        canonicalJson({ secondResolution, secondHistory, backup, receipt: reset.receipt }),
        /password\s*[=:]|secret\s*[=:]|credentialValue/i,
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  }
});

test('Slice 4 Gate 7 denies cross-source profile and invocation scope drift', async () => {
  const registry = JSON.parse(await readFile(path.resolve(
    'tests/fixtures/db-analyzer/source-registry-v1.json',
  ), 'utf8'));
  for (const engine of ['mssql', 'oracle']) {
    const firstProfile = JSON.parse(await readFile(path.resolve(
      `tests/fixtures/db-analyzer/${engine}-operation-profile-ref-v1.json`,
    ), 'utf8'));
    const secondProfile = JSON.parse(await readFile(path.resolve(
      `tests/fixtures/db-analyzer/${engine}-operation-profile-ref-b-v1.json`,
    ), 'utf8'));
    const scopeSubstitution = structuredClone(secondProfile);
    scopeSubstitution.expected.scope = structuredClone(firstProfile.expected.scope);
    assert.throws(
      () => resolveOperationProfile({ profileRef: scopeSubstitution, registry }),
      /DB_OPERATION_PROFILE_BINDING_DRIFT/,
    );

    const firstResolution = resolveOperationProfile({ profileRef: firstProfile, registry });
    const secondResolution = resolveOperationProfile({ profileRef: secondProfile, registry });
    await assert.rejects(
      runOperationInvocation({
        resolution: secondResolution,
        invocation: operationInvocation({
          resolution: firstResolution,
          engine,
          kind: 'SCHEDULED',
          invocationId: `${engine}-cross-source-denied-001`,
        }),
        coordinator: createOperationCoordinator(),
        executor: async () => ({
          state: 'SUCCEEDED',
          reasonCode: null,
          resultSha256: identitySha256('must-not-run'),
        }),
      }),
      /DB_OPERATION_INVOCATION_INVALID/,
    );
  }
});

test('Slice 4 Gate 8 emits deterministic operational JSON, HTML, knowledge and disconnected Superset results', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const scenario = await operationUpgradeScenario(engine);
    const records = lifecycleRecordsFor({ resolution: scenario.fromResolution, history: scenario.history });
    const lifecycleRoot = await mkdtemp(path.join(tmpdir(), `cm-db-operation-output-store-${engine}-`));
    const outputRoot = await mkdtemp(path.join(tmpdir(), `cm-db-operation-output-files-${engine}-`));
    try {
      const lifecycleStore = await initializeOperationLifecycleStore({ rootDir: lifecycleRoot, records });
      const first = buildOperationOutputBundle({
        resolution: scenario.fromResolution,
        history: scenario.history,
        lifecycleStore,
      });
      const second = buildOperationOutputBundle({
        resolution: scenario.fromResolution,
        history: scenario.history,
        lifecycleStore,
      });
      assert.deepEqual(first, second);
      assert.equal(first.summary.source.engine, engine);
      assert.equal(first.summary.operation.historySha256, scenario.history.historySha256);
      assert.equal(first.summary.operation.lastKnownGoodEntrySha256, scenario.history.lastKnownGoodEntrySha256);
      assert.equal(first.summary.evidenceBoundary.runtimeValidation, 'SYNTHETIC_UNVALIDATED');
      assert.equal(first.summary.evidenceBoundary.productionCompatibilityEstablished, false);
      assert.equal(first.knowledge.claims.derivedFromBoundEvidenceOnly, true);
      assert.equal(first.knowledge.claims.businessSemanticsEstablished, false);
      assert.equal(first.superset.source.directSourceDatabaseConnection, false);
      assert.equal(first.superset.source.sourceConnection, null);
      assert.equal(first.superset.source.sourceSql, null);
      assert.equal(first.superset.dashboard.automaticPublication, false);
      assert.equal(first.superset.dashboard.drillThroughSourceRoute, null);
      assert.match(first.html, /Disconnected, read-only operational evidence/);
      assert.doesNotMatch(
        canonicalJson(first),
        /password\s*[=:]|secret\s*[=:]|credentialValue|CM_DB_|localhost|\.\.\//i,
      );

      const written = await writeOperationOutputBundle({
        rootDir: outputRoot,
        resolution: scenario.fromResolution,
        history: scenario.history,
        lifecycleStore,
      });
      const repeated = await writeOperationOutputBundle({
        rootDir: outputRoot,
        resolution: scenario.fromResolution,
        history: scenario.history,
        lifecycleStore,
      });
      assert.deepEqual(written, repeated);
      assert.equal(written.relativeDirectory, `source-${scenario.history.source.markerSha256}`);
      assert.ok(Object.values(written.relativeFiles).every((file) => !path.isAbsolute(file) && !file.includes('..')));
      for (const [key, file] of Object.entries(written.relativeFiles)) {
        const persisted = await readFile(path.join(outputRoot, written.relativeDirectory, file), 'utf8');
        const expectedKey = key === 'manifestJson' ? 'manifestJson' : key;
        assert.equal(persisted, first[expectedKey]);
      }
    } finally {
      await rm(lifecycleRoot, { recursive: true, force: true });
      await rm(outputRoot, { recursive: true, force: true });
    }
  }
});

test('Slice 4 Gate 8 denies stale ownership, scoped-path drift, leakage and invented evidence', async () => {
  const scenario = await operationUpgradeScenario('mssql');
  const records = lifecycleRecordsFor({ resolution: scenario.fromResolution, history: scenario.history });
  const lifecycleRoot = await mkdtemp(path.join(tmpdir(), 'cm-db-operation-recovery-'));
  try {
    const lifecycleStore = await initializeOperationLifecycleStore({ rootDir: lifecycleRoot, records });
    const markerFile = path.join(lifecycleRoot, '.operation-lifecycle-owner.json');
    const ownership = {
      markerSha256: scenario.history.source.markerSha256,
      ownerId: 'mssql-crashed-owner-001',
      acquiredAt: '2026-08-11T10:00:00.000Z',
    };
    await writeFile(markerFile, `${JSON.stringify(ownership)}\n`, 'utf8');
    await assert.rejects(
      createOperationLifecycleBackup({
        rootDir: lifecycleRoot,
        resolution: scenario.fromResolution,
        ownerId: 'mssql-next-owner-002',
        createdAt: '2026-08-11T12:00:00.000Z',
      }),
      /DB_OPERATION_LIFECYCLE_CONCURRENCY_DENIED/,
    );
    await assert.rejects(
      recoverStaleOperationLifecycleOwnership({
        rootDir: lifecycleRoot,
        resolution: scenario.fromResolution,
        expectedOwnerId: 'foreign-owner-001',
        observedAt: '2026-08-11T12:00:00.000Z',
        staleAfterMs: 60_000,
      }),
      /DB_OPERATION_LIFECYCLE_RECOVERY_FOREIGN_MARKER/,
    );
    const recovery = await recoverStaleOperationLifecycleOwnership({
      rootDir: lifecycleRoot,
      resolution: scenario.fromResolution,
      expectedOwnerId: ownership.ownerId,
      observedAt: '2026-08-11T12:00:00.000Z',
      staleAfterMs: 60_000,
    });
    assert.equal(recovery.outcome.state, 'STALE_MARKER_REMOVED');
    assert.equal(recovery.outcome.retryRequired, true);
    assert.equal(recovery.evidenceBoundary.sourceDatabaseWritten, false);
    assert.equal(recovery.evidenceBoundary.unrelatedMarkersRemoved, false);
    await assert.rejects(stat(markerFile), /ENOENT/);

    const freshOwnership = { ...ownership, acquiredAt: '2026-08-11T11:59:30.001Z' };
    await writeFile(markerFile, `${JSON.stringify(freshOwnership)}\n`, 'utf8');
    await assert.rejects(
      recoverStaleOperationLifecycleOwnership({
        rootDir: lifecycleRoot,
        resolution: scenario.fromResolution,
        expectedOwnerId: freshOwnership.ownerId,
        observedAt: '2026-08-11T12:00:00.000Z',
        staleAfterMs: 60_000,
      }),
      /DB_OPERATION_LIFECYCLE_RECOVERY_MARKER_NOT_STALE/,
    );
    await rm(markerFile);

    await assert.rejects(
      writeOperationOutputBundle({
        rootDir: 'relative-output-root',
        resolution: scenario.fromResolution,
        history: scenario.history,
        lifecycleStore,
      }),
      /DB_OPERATION_OUTPUT_ROOT_INVALID/,
    );
    const tamperedHistory = structuredClone(scenario.history);
    tamperedHistory.entries[0].receipt.outcome.resultSha256 = identitySha256('invented-result');
    assert.throws(
      () => buildOperationOutputBundle({
        resolution: scenario.fromResolution,
        history: tamperedHistory,
        lifecycleStore,
      }),
      /DB_OPERATION_HISTORY_TAMPERED|DB_OPERATION_HISTORY_ENTRY_TAMPERED/,
    );
    const leakingStore = structuredClone(lifecycleStore);
    leakingStore.records[0].payload = { password: 'denied' };
    leakingStore.records[0].payloadSha256 = identitySha256(leakingStore.records[0].payload);
    const { storeSha256: ignoredStoreSha256, ...storeBody } = leakingStore;
    leakingStore.storeSha256 = identitySha256(storeBody);
    assert.throws(
      () => buildOperationOutputBundle({
        resolution: scenario.fromResolution,
        history: scenario.history,
        lifecycleStore: leakingStore,
      }),
      /DB_OPERATION_LIFECYCLE_RECORD_INVALID/,
    );
  } finally {
    await rm(lifecycleRoot, { recursive: true, force: true });
  }
});

async function loadEngine(engine) {
  const directory = path.join(root, engine);
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const fixture = JSON.parse(await readFile(path.resolve(`tests/fixtures/db-analyzer/${engine}-preflight-v1.json`), 'utf8'));
  const sqlByQueryId = Object.fromEntries(await Promise.all(manifest.queries.map(async (query) => [query.id, await readFile(path.join(directory, query.file), 'utf8')])));
  return { directory, manifest, fixture, sqlByQueryId };
}

async function loadProfilingEngine(engine) {
  const directory = path.join(root, engine);
  const manifest = JSON.parse(await readFile(path.join(directory, 'profiling-manifest.json'), 'utf8'));
  const sqlByQueryId = Object.fromEntries(await Promise.all(manifest.queries
    .map(async (query) => [query.id, await readFile(path.join(directory, query.file), 'utf8')])));
  return { directory, manifest, sqlByQueryId };
}

async function loadStoredLogicEngine(engine) {
  const directory = path.join(root, engine);
  const manifest = JSON.parse(await readFile(path.join(directory, 'stored-logic-manifest.json'), 'utf8'));
  const fixture = JSON.parse(await readFile(path.resolve(`tests/fixtures/db-analyzer/${engine}-stored-logic-v1.json`), 'utf8'));
  const sqlByQueryId = Object.fromEntries(await Promise.all(manifest.queries
    .map(async (query) => [query.id, await readFile(path.join(directory, query.file), 'utf8')])));
  return { directory, manifest, fixture, sqlByQueryId };
}

test('MSSQL and Oracle structure manifests are symmetric, provenance-bound and SELECT-only', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const { manifest, sqlByQueryId } = await loadEngine(engine);
    validateQueryManifest(manifest);
    assert.equal(manifest.engine, engine);
    assert.deepEqual(manifest.queries.map((query) => query.category), ['preflight', 'preflight', 'schemas', 'relations', 'columns', 'constraints', 'indexes', 'sequences', 'synonyms']);
    assert.deepEqual(manifest.queries.filter((query) => query.category !== 'preflight').map((query) => query.scopeColumn), ['schema_name', 'schema_name', 'schema_name', 'schema_name', 'schema_name', 'schema_name', 'schema_name']);
    for (const query of manifest.queries) {
      const sql = normalizeSql(sqlByQueryId[query.id]);
      assert.match(sql, /^SELECT\b/i, query.id);
      assert.doesNotMatch(executableSql(sql), forbiddenSql, query.id);
      assert.equal(query.provenance.spdx, 'Apache-2.0');
      assert.equal(query.provenance.copiedCode, false);
    }
  }
});

test('Slice 3 Gate 1 workflow emits symmetric deterministic stored-object inventory hashes and typed coverage', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const input = await loadStoredLogicEngine(engine);
    validateQueryManifest(input.manifest);
    assert.equal(input.manifest.queries.length, 2);
    assert.equal(input.manifest.queries[0].category, 'stored-objects');
    assert.deepEqual(input.manifest.queries.map(({ category }) => category), ['stored-objects', 'stored-dependencies']);
    assert.ok(input.manifest.queries.every(({ provenance }) => provenance.spdx === 'Apache-2.0'));
    const audit = auditQueryPackSafety({ manifest: input.manifest, sqlByQueryId: input.sqlByQueryId });
    assert.equal(audit.queryCount, 2);
    assert.equal(audit.zeroMutatingStatements, true);
    assert.equal(audit.zeroRowSamples, true);

    const profileFile = path.resolve(`tests/fixtures/db-analyzer/${engine}-stored-logic-profile-v1.json`);
    const first = await runAnalyzeProfile(profileFile);
    const second = await runAnalyzeProfile(profileFile);
    assert.deepEqual(first, second);
    assert.equal(first.storedLogic.schemaVersion, 'chimpmaera.db/stored-logic-evidence/v1');
    assert.equal(first.storedLogic.runtimeValidation, 'SYNTHETIC_UNVALIDATED');
    assert.equal(first.storedLogic.coverageLedger.totalQueries, 2);
    assert.equal(first.storedLogic.coverageLedger.stateCounts.SUCCEEDED, 2);
    assert.equal(first.storedLogic.summary.objectCount, 5);
    assert.deepEqual(first.storedLogic.summary.typeCounts, engine === 'mssql'
      ? { FUNCTION: 1, PROCEDURE: 2, TRIGGER: 2 }
      : { FUNCTION: 2, PROCEDURE: 1, TRIGGER: 2 });
    assert.equal(first.storedLogic.summary.rawDefinitionsIncluded, false);
    assert.equal(first.storedLogic.summary.visibleHashedObjects, 4);
    assert.equal(first.storedLogic.summary.encryptedOrInvisibleObjects, 1);
    assert.equal(first.storedLogic.summary.provenNativeDependencyEdges, 3);
    assert.equal(first.storedLogic.summary.provenNativeColumnEdges, engine === 'mssql' ? 1 : 0);
    assert.equal(first.storedLogic.summary.unresolvedNativeDependencyGaps, 1);
    assert.equal(first.storedLogic.objects.filter(({ enablementState }) => enablementState === 'DISABLED').length, 1);
    assert.ok(first.storedLogic.objects.every((object) => /^[a-f0-9]{64}$/.test(object.objectIdentitySha256)
      && /^[a-f0-9]{64}$/.test(object.objectSha256)));
    assert.ok(first.storedLogic.objects.filter(({ definitionVisibility }) => definitionVisibility === 'VISIBLE_HASHED')
      .every((object) => /^[a-f0-9]{64}$/.test(object.definitionFingerprintSha256)));
    assert.ok(first.storedLogic.objects.filter(({ definitionVisibility }) => definitionVisibility === 'ENCRYPTED_OR_INVISIBLE')
      .every((object) => object.definitionFingerprintSha256 === null
        && object.definitionFingerprintAlgorithm === null
        && object.definitionComponentCount === 0));
    assert.equal(verifyStoredLogicEvidence(first.storedLogic), first.storedLogic);
    assert.doesNotMatch(canonicalJson(first.storedLogic), /source_text|definition_text|raw_definition|CREATE\s+(?:PROCEDURE|FUNCTION|TRIGGER)/i);
    assert.match(first.snapshotSha256, /^[a-f0-9]{64}$/);
  }
});

test('Slice 3 Gate 2 stored-object identity, visibility, enablement and hashes fail closed without invention', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const input = await loadStoredLogicEngine(engine);
    const profile = JSON.parse(await readFile(path.resolve(`tests/fixtures/db-analyzer/${engine}-stored-logic-profile-v1.json`), 'utf8'));
    const profileContext = {
      profileId: profile.profileId,
      mode: profile.mode,
      scope: profile.scope,
      policy: profile.policy,
      adapter: profile.adapter.kind,
    };
    const build = (fixture) => buildStoredLogicEvidence({
      ...input,
      resultSets: fixture,
      profileContext,
    });
    const baseline = build(input.fixture);
    verifyStoredLogicEvidence(baseline);

    const reordered = structuredClone(input.fixture);
    reordered.results[`${engine}.stored-logic.objects`].rows.reverse();
    assert.deepEqual(build(reordered), baseline);

    const conflict = structuredClone(input.fixture);
    const conflictRow = structuredClone(conflict.results[`${engine}.stored-logic.objects`].rows[0]);
    conflictRow.native_object_id = `${conflictRow.native_object_id}-conflict`;
    conflict.results[`${engine}.stored-logic.objects`].rows.push(conflictRow);
    assert.throws(() => build(conflict), /DB_STORED_LOGIC_OBJECT_CONFLICT/);

    const crossScope = structuredClone(input.fixture);
    crossScope.results[`${engine}.stored-logic.objects`].rows[0].schema_name = engine === 'mssql' ? 'outside' : 'OUTSIDE';
    assert.throws(() => build(crossScope), /DB_QUERY_RESULT_SCOPE_INVALID/);

    const componentGap = structuredClone(input.fixture);
    componentGap.results[`${engine}.stored-logic.objects`].rows[0].definition_component_ordinal = 2;
    assert.throws(() => build(componentGap), /DB_STORED_LOGIC_DEFINITION_INVALID/);

    const tampered = structuredClone(baseline);
    tampered.objects[0].definitionFingerprintSha256 = '0'.repeat(64);
    assert.throws(() => verifyStoredLogicEvidence(tampered), /DB_STORED_LOGIC_EVIDENCE_TAMPERED/);

    const denied = structuredClone(input.fixture);
    denied.results[`${engine}.stored-logic.objects`] = {
      state: 'DENIED',
      reasonCode: 'DB_METADATA_PERMISSION_DENIED',
      rows: [],
    };
    denied.results[`${engine}.stored-logic.native-dependencies`] = {
      state: 'DENIED',
      reasonCode: 'DB_METADATA_PERMISSION_DENIED',
      rows: [],
    };
    const deniedEvidence = build(denied);
    assert.equal(deniedEvidence.summary.objectCount, 0);
    assert.deepEqual(deniedEvidence.objects, []);
    assert.equal(deniedEvidence.coverageLedger.entries[0].emptyInterpretation, 'NOT_CLAIMED');
    verifyStoredLogicEvidence(deniedEvidence);
  }
});

test('Slice 3 Gate 1 stored-object coverage preserves denial without inventing objects', async () => {
  const input = await loadStoredLogicEngine('oracle');
  const denied = structuredClone(input.fixture);
  denied.results['oracle.stored-logic.objects'] = {
    state: 'DENIED',
    reasonCode: 'DB_METADATA_PERMISSION_DENIED',
    rows: [],
  };
  denied.results['oracle.stored-logic.native-dependencies'] = {
    state: 'DENIED',
    reasonCode: 'DB_METADATA_PERMISSION_DENIED',
    rows: [],
  };
  const evidence = buildStoredLogicEvidence({
    ...input,
    resultSets: denied,
    profileContext: {
      profileId: 'synthetic-oracle-structure-map',
      mode: 'SYNTHETIC',
      scope: { database: 'CMSYN', container: 'CMSYNPDB', schemas: ['CM_APP'] },
      policy: { access: 'READ_ONLY', allowRowSamples: false, maxQueryTimeoutMs: 5000 },
      adapter: 'synthetic',
    },
  });
  assert.equal(evidence.coverageLedger.stateCounts.DENIED, 2);
  assert.equal(evidence.coverageLedger.entries[0].visibility, 'INVISIBLE');
  assert.equal(evidence.coverageLedger.entries[0].emptyInterpretation, 'NOT_CLAIMED');
  assert.equal(evidence.summary.objectCount, 0);
  assert.deepEqual(evidence.objects, []);
});

test('Slice 3 Gate 3 native dependencies produce exact proven edges and explicit unresolved gaps', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const input = await loadStoredLogicEngine(engine);
    const profile = JSON.parse(await readFile(path.resolve(`tests/fixtures/db-analyzer/${engine}-stored-logic-profile-v1.json`), 'utf8'));
    const profileContext = {
      profileId: profile.profileId,
      mode: profile.mode,
      scope: profile.scope,
      policy: profile.policy,
      adapter: profile.adapter.kind,
    };
    const build = (fixture) => buildStoredLogicEvidence({ ...input, resultSets: fixture, profileContext });
    const baseline = build(input.fixture);
    assert.equal(baseline.nativeDependencies.edges.length, 3);
    assert.equal(baseline.nativeDependencies.gaps.length, 1);
    assert.ok(baseline.nativeDependencies.edges.every(({ proofState, edgeSha256, sourceObjectIdentitySha256, targetObjectIdentitySha256 }) =>
      proofState === 'PROVEN_NATIVE'
      && /^[a-f0-9]{64}$/.test(edgeSha256)
      && /^[a-f0-9]{64}$/.test(sourceObjectIdentitySha256)
      && /^[a-f0-9]{64}$/.test(targetObjectIdentitySha256)));
    assert.ok(baseline.nativeDependencies.gaps.every(({ gapState, gapSha256 }) =>
      gapState === 'UNRESOLVED_NATIVE_REFERENCE' && /^[a-f0-9]{64}$/.test(gapSha256)));
    assert.deepEqual(baseline.nativeDependencies.edges.map(({ sourceObjectName, targetObjectName }) =>
      [sourceObjectName, targetObjectName]), engine === 'mssql'
      ? [['cm_customer_risk', 'customers'], ['cm_orders_audit', 'audit_log'], ['cm_refresh_customer_rollup', 'orders']]
      : [['CM_CUSTOMER_RISK', 'CUSTOMERS'], ['CM_ORDERS_AUDIT', 'AUDIT_LOG'], ['CM_REFRESH_CUSTOMER_ROLLUP', 'ORDERS']]);

    const reordered = structuredClone(input.fixture);
    reordered.results[`${engine}.stored-logic.native-dependencies`].rows.reverse();
    assert.deepEqual(build(reordered), baseline);

    const inventedSource = structuredClone(input.fixture);
    inventedSource.results[`${engine}.stored-logic.native-dependencies`].rows[0].source_object_name = engine === 'mssql' ? 'cm_invented' : 'CM_INVENTED';
    assert.throws(() => build(inventedSource), /DB_STORED_LOGIC_DEPENDENCY_SOURCE_INVALID/);

    const contradictory = structuredClone(input.fixture);
    contradictory.results[`${engine}.stored-logic.native-dependencies`].rows[0].resolution_state = 'RESOLVED';
    contradictory.results[`${engine}.stored-logic.native-dependencies`].rows[0].target_server_or_link_name = engine === 'mssql' ? 'CM_LINK' : 'CM_REMOTE_LINK';
    assert.throws(() => build(contradictory), /DB_STORED_LOGIC_DEPENDENCY_INVALID/);

    const tampered = structuredClone(baseline);
    tampered.nativeDependencies.edges[0].targetObjectIdentitySha256 = '0'.repeat(64);
    assert.throws(() => verifyStoredLogicEvidence(tampered), /DB_STORED_LOGIC_EVIDENCE_TAMPERED/);

    const denied = structuredClone(input.fixture);
    denied.results[`${engine}.stored-logic.native-dependencies`] = {
      state: 'DENIED',
      reasonCode: 'DB_METADATA_PERMISSION_DENIED',
      rows: [],
    };
    const deniedEvidence = build(denied);
    assert.deepEqual(deniedEvidence.nativeDependencies, { edges: [], columnEdges: [], gaps: [] });
    assert.equal(deniedEvidence.coverageLedger.entries.find(({ queryId }) => queryId.endsWith('native-dependencies')).emptyInterpretation, 'NOT_CLAIMED');
    verifyStoredLogicEvidence(deniedEvidence);
  }
});

test('Slice 3 Gate 4 optional parser enrichment is pinned, bounded and never promotes inferred edges', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const profileFile = path.resolve(`tests/fixtures/db-analyzer/${engine}-stored-logic-profile-v1.json`);
    const first = await runAnalyzeProfile(profileFile);
    const second = await runAnalyzeProfile(profileFile);
    assert.deepEqual(first, second);
    const enrichment = first.storedLogic.parserEnrichment;
    assert.equal(enrichment.state, 'PARTIAL');
    assert.equal(enrichment.optional, true);
    assert.equal(enrichment.parser.requiredForNativeCollector, false);
    assert.equal(enrichment.parser.promotionPolicy, 'NEVER_PROVEN');
    assert.equal(enrichment.parser.dialectContract, 'COMMON-SELECT-SUBSET/V1');
    assert.equal(enrichment.summary.parsedObjectCount, 1);
    assert.equal(enrichment.summary.inferredEdgeCount, 2);
    assert.equal(enrichment.summary.blindSpotGapCount, 2);
    assert.equal(enrichment.summary.rawDefinitionsIncluded, false);
    assert.ok(enrichment.edges.every(({ proofState }) => proofState === 'INFERRED_PARSER'));
    assert.ok(first.storedLogic.nativeDependencies.edges.every(({ proofState }) => proofState === 'PROVEN_NATIVE'));
    assert.deepEqual(new Set(enrichment.gaps.map(({ gapState }) => gapState)), new Set([
      'DYNAMIC_SQL_BLIND_SPOT',
      'UNSUPPORTED_SYNTAX_BLIND_SPOT',
    ]));
    assert.doesNotMatch(canonicalJson(enrichment), /"(?:sourceText|source_text|rawDefinition|raw_definition)"\s*:/i);
    verifyStoredLogicEvidence(first.storedLogic);

    const tampered = structuredClone(first.storedLogic);
    tampered.parserEnrichment.edges[0].proofState = 'PROVEN_NATIVE';
    assert.throws(() => verifyStoredLogicEvidence(tampered), /DB_STORED_LOGIC_EVIDENCE_TAMPERED|DB_PARSER_EVIDENCE_INVALID/);
  }
});

test('Slice 3 Gate 4 native collection remains runnable when parser enrichment is absent or unavailable', async () => {
  const engine = 'mssql';
  const input = await loadStoredLogicEngine(engine);
  const profile = JSON.parse(await readFile(path.resolve(`tests/fixtures/db-analyzer/${engine}-stored-logic-profile-v1.json`), 'utf8'));
  const native = buildStoredLogicEvidence({
    ...input,
    resultSets: input.fixture,
    profileContext: {
      profileId: profile.profileId,
      mode: profile.mode,
      scope: profile.scope,
      policy: profile.policy,
      adapter: profile.adapter.kind,
    },
  });
  assert.equal(native.parserEnrichment.state, 'NOT_REQUESTED');
  assert.equal(native.nativeDependencies.edges.length, 3);
  verifyStoredLogicEvidence(native);

  const sourceFixture = JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/mssql-parser-enrichment-v1.json'), 'utf8'));
  const lock = JSON.parse(await readFile(path.resolve('query-packs/db-analyzer/v1/stored-logic-provenance-license-lock.json'), 'utf8'));
  const unavailable = await buildOptionalParserEnrichment({
    storedLogicEvidence: native,
    sourceFixture,
    parserLock: lock.parserDependency,
    loadParser: async () => { throw new Error('synthetic parser absence'); },
  });
  assert.equal(unavailable.state, 'UNAVAILABLE');
  const attached = attachParserEnrichmentEvidence(native, unavailable);
  assert.equal(attached.nativeDependencies.edges.length, 3);
  assert.equal(attached.parserEnrichment.summary.inferredEdgeCount, 0);
  verifyStoredLogicEvidence(attached);
});

test('Slice 3 Gate 4 parser provenance binds optional dependency closure and every stored-logic query', async () => {
  const lockPath = path.resolve('query-packs/db-analyzer/v1/stored-logic-provenance-license-lock.json');
  const lock = JSON.parse(await readFile(lockPath, 'utf8'));
  const packageLockText = await readFile(path.resolve('package-lock.json'), 'utf8');
  const packageLock = JSON.parse(packageLockText);
  assert.equal(lock.schemaVersion, 'chimpmaera.db/stored-logic-provenance-license-lock/v1');
  assert.equal(lock.issue, 196);
  assert.equal(lock.parserDependency.packageName, 'node-sql-parser');
  assert.equal(lock.parserDependency.version, '5.4.0');
  assert.equal(lock.parserDependency.spdx, 'Apache-2.0');
  assert.equal(packageLock.packages[''].optionalDependencies['node-sql-parser'], '5.4.0');
  assert.equal(lock.parserDependencyClosure.packageLockSha256, createHash('sha256').update(packageLockText).digest('hex'));
  assert.equal(lock.parserDependencyClosure.requiredForNativeCollector, false);
  assert.equal(lock.parserDependencyClosure.admission, 'OPTIONAL_NON_PROMOTING');
  for (const dependency of lock.parserDependencyClosure.entries) {
    const pinned = packageLock.packages[dependency.packagePath];
    assert.equal(pinned.version, dependency.version);
    assert.equal(pinned.integrity, dependency.integrity);
    assert.equal(pinned.license, dependency.spdx);
    assert.ok(lock.parserDependencyClosure.allowedSpdx.includes(dependency.spdx));
  }
  assert.equal(createHash('sha256').update(canonicalJson(lock.parserDependencyClosure.entries)).digest('hex'), lock.parserDependencyClosure.closureSha256);
  for (const artifact of lock.queryArtifacts) {
    const sql = await readFile(path.resolve(artifact.path), 'utf8');
    assert.equal(createHash('sha256').update(normalizeSql(sql)).digest('hex'), artifact.normalizedSqlSha256);
  }
  assert.equal(lock.queryArtifacts.length, 4);
});

test('Slice 3 Gate 5 keeps proven object and limited-column lineage distinct from inferred, dynamic and unknown classes', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const profileFile = path.resolve(`tests/fixtures/db-analyzer/${engine}-stored-logic-profile-v1.json`);
    const first = await runAnalyzeProfile(profileFile);
    const second = await runAnalyzeProfile(profileFile);
    assert.deepEqual(first, second);
    const { lineage } = first.storedLogic;
    assert.equal(lineage.schemaVersion, 'chimpmaera.db/stored-logic-lineage-evidence/v1');
    assert.equal(lineage.summary.promotionPolicy, 'CLASS_PRESERVING_NO_PROMOTION');
    assert.equal(lineage.summary.relationshipClassCounts.PROVEN_OBJECT_NATIVE, 3);
    assert.equal(lineage.summary.relationshipClassCounts.PROVEN_COLUMN_NATIVE, engine === 'mssql' ? 1 : 0);
    assert.equal(lineage.summary.relationshipClassCounts.INFERRED_OBJECT_PARSER, 2);
    assert.equal(lineage.summary.relationshipCount, engine === 'mssql' ? 6 : 5);
    assert.equal(lineage.summary.blindSpotCount, engine === 'mssql' ? 5 : 6);
    assert.equal(lineage.summary.rawDefinitionsIncluded, false);
    assert.ok(lineage.relationships.every(({ relationshipClass, proofState, relationshipSha256 }) =>
      /^[a-f0-9]{64}$/.test(relationshipSha256)
      && ((relationshipClass === 'PROVEN_OBJECT_NATIVE' && proofState === 'PROVEN_NATIVE')
        || (relationshipClass === 'PROVEN_COLUMN_NATIVE' && proofState === 'PROVEN_NATIVE_COLUMN')
        || (relationshipClass === 'INFERRED_OBJECT_PARSER' && proofState === 'INFERRED_PARSER'))));
    assert.deepEqual(new Set(lineage.blindSpots.map(({ blindSpotClass }) => blindSpotClass)), new Set([
      'COLUMN_RELATIONSHIP_UNKNOWN',
      'DYNAMIC_RELATIONSHIP_UNKNOWN',
      'UNKNOWN_NATIVE_RELATIONSHIP',
      'UNSUPPORTED_RELATIONSHIP_UNKNOWN',
    ]));
    assert.doesNotMatch(canonicalJson(lineage), /source_text|definition_text|raw_definition|CREATE\s+(?:PROCEDURE|FUNCTION|TRIGGER)/i);
    verifyStoredLogicEvidence(first.storedLogic);

    const promoted = structuredClone(first.storedLogic);
    const inferred = promoted.lineage.relationships.find(({ relationshipClass }) => relationshipClass === 'INFERRED_OBJECT_PARSER');
    inferred.relationshipClass = 'PROVEN_OBJECT_NATIVE';
    inferred.proofState = 'PROVEN_NATIVE';
    const { relationshipSha256: ignoredRelationshipSha, ...relationshipBody } = inferred;
    inferred.relationshipSha256 = identitySha256(relationshipBody);
    const { lineageSha256: ignoredLineageSha, ...lineageBody } = promoted.lineage;
    promoted.lineage.lineageSha256 = identitySha256(lineageBody);
    const { storedLogicSha256: ignoredStoredSha, ...storedBody } = promoted;
    promoted.storedLogicSha256 = identitySha256(storedBody);
    assert.throws(() => verifyStoredLogicEvidence(promoted), /DB_STORED_LOGIC_LINEAGE_TAMPERED/);
  }

  const input = await loadStoredLogicEngine('mssql');
  const profile = JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/mssql-stored-logic-profile-v1.json'), 'utf8'));
  const twoColumns = structuredClone(input.fixture);
  const secondColumn = structuredClone(twoColumns.results['mssql.stored-logic.native-dependencies'].rows[0]);
  secondColumn.target_column_name = 'order_id';
  twoColumns.results['mssql.stored-logic.native-dependencies'].rows.push(secondColumn);
  const multiColumnEvidence = buildStoredLogicEvidence({
    ...input,
    resultSets: twoColumns,
    profileContext: {
      profileId: profile.profileId,
      mode: profile.mode,
      scope: profile.scope,
      policy: profile.policy,
      adapter: profile.adapter.kind,
    },
  });
  assert.equal(multiColumnEvidence.nativeDependencies.edges.length, 3);
  assert.equal(multiColumnEvidence.nativeDependencies.columnEdges.length, 2);
  assert.equal(multiColumnEvidence.lineage.summary.relationshipClassCounts.PROVEN_OBJECT_NATIVE, 3);
  assert.equal(multiColumnEvidence.lineage.summary.relationshipClassCounts.PROVEN_COLUMN_NATIVE, 2);
  verifyStoredLogicEvidence(multiColumnEvidence);
});

test('Slice 3 Gate 6 controlled A/B change yields exact affected object and approved BI identities', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const profileFile = path.resolve(`tests/fixtures/db-analyzer/${engine}-stored-logic-profile-v1.json`);
    const before = (await runAnalyzeProfile(profileFile)).storedLogic;
    const input = await loadStoredLogicEngine(engine);
    const profile = JSON.parse(await readFile(profileFile, 'utf8'));
    const change = JSON.parse(await readFile(path.resolve(
      `tests/fixtures/db-analyzer/${engine}-stored-logic-impact-change-v1.json`,
    ), 'utf8'));
    const changedFixture = structuredClone(input.fixture);
    const changedRow = changedFixture.results[`${engine}.stored-logic.objects`].rows.find((row) =>
      row.schema_name === change.object.schemaName
      && row.object_name === change.object.objectName
      && row.object_kind === change.object.objectKind
      && row.definition_component_ordinal === change.object.definitionComponentOrdinal);
    assert.ok(changedRow);
    changedRow.definition_component_hash = change.object.afterDefinitionComponentHash;
    let after = buildStoredLogicEvidence({
      ...input,
      resultSets: changedFixture,
      profileContext: {
        profileId: profile.profileId,
        mode: profile.mode,
        scope: profile.scope,
        policy: profile.policy,
        adapter: profile.adapter.kind,
      },
    });
    const parserFixture = JSON.parse(await readFile(path.resolve(
      `tests/fixtures/db-analyzer/${engine}-parser-enrichment-v1.json`,
    ), 'utf8'));
    const parserLock = JSON.parse(await readFile(path.resolve(
      'query-packs/db-analyzer/v1/stored-logic-provenance-license-lock.json',
    ), 'utf8'));
    after = attachParserEnrichmentEvidence(after, await buildOptionalParserEnrichment({
      storedLogicEvidence: after,
      sourceFixture: parserFixture,
      parserLock: parserLock.parserDependency,
    }));

    const profilingEvidence = await runAnalyzeProfile(path.resolve(
      `tests/fixtures/db-analyzer/${engine}-profiling-profile-v1.json`,
    ));
    const receipt = JSON.parse(await readFile(path.resolve(
      `tests/fixtures/db-analyzer/${engine}-profiling-review-v1.json`,
    ), 'utf8'));
    const knowledgePack = buildProfilingKnowledgePack({ evidence: profilingEvidence, receipt });
    const supersetResult = buildProfilingSupersetResult({ knowledgePack });
    const sources = { before, after, knowledgePack, supersetResult };
    const first = buildStoredLogicImpactReport(sources);
    const second = buildStoredLogicImpactReport(sources);
    assert.deepEqual(first, second);
    assert.equal(first.schemaVersion, 'chimpmaera.db/stored-logic-impact-report/v1');
    assert.equal(first.summary.changedObjectCount, change.expected.changedObjectCount);
    assert.equal(first.changedObjects[0].objectName, change.object.objectName);
    assert.equal(first.changedObjects[0].changeType, 'MODIFIED');
    assert.notEqual(first.changedObjects[0].beforeDefinitionFingerprintSha256,
      first.changedObjects[0].afterDefinitionFingerprintSha256);
    assert.deepEqual(first.affectedBi.map(({ candidateSha256 }) => candidateSha256),
      change.expected.affectedApprovedBiCandidateSha256);
    assert.ok(first.affectedBi.every(({ impactClass, reviewState }) =>
      impactClass === 'POTENTIALLY_AFFECTED_NATIVE_OBJECT'
      && reviewState === 'APPROVED_BY_BOUND_RECEIPT'));
    assert.ok(first.provenNativeRelationships.every(({ relationshipClass }) =>
      ['PROVEN_OBJECT_NATIVE', 'PROVEN_COLUMN_NATIVE'].includes(relationshipClass)));
    assert.equal(first.policy.inferredParserPromotionAllowed, false);
    assert.equal(first.policy.rawDefinitionsIncluded, false);
    assert.equal(first.policy.sourceRoutesIncluded, false);
    assert.equal(first.authority.directSourceDatabaseAccess, false);
    assert.equal(first.source.structureSnapshotSha256, knowledgePack.source.structureSnapshotSha256);
    assert.equal(first.source.knowledgePackSha256, knowledgePack.knowledgePackSha256);
    assert.equal(first.source.supersetResultSha256, supersetResult.supersetResultSha256);
    assert.doesNotMatch(canonicalJson(first),
      /source_text|definition_text|raw_definition|CREATE\s+(?:PROCEDURE|FUNCTION|TRIGGER)|password|credential/i);
    assert.equal(verifyStoredLogicImpactReport(first, sources), first);

    assert.throws(() => buildStoredLogicImpactReport({ ...sources, after: before }),
      /DB_STORED_LOGIC_IMPACT_NO_CHANGE_DENIED/);
    const tamperedKnowledge = structuredClone(knowledgePack);
    tamperedKnowledge.entries[0].target.relationName = `${tamperedKnowledge.entries[0].target.relationName}_invented`;
    assert.throws(() => buildStoredLogicImpactReport({ ...sources, knowledgePack: tamperedKnowledge }),
      /DB_STORED_LOGIC_IMPACT_BI_SOURCE_TAMPERED/);
    const tamperedReport = structuredClone(first);
    tamperedReport.affectedBi = [];
    const { impactReportSha256: ignoredImpactSha, ...impactBody } = tamperedReport;
    tamperedReport.impactReportSha256 = identitySha256(impactBody);
    assert.throws(() => verifyStoredLogicImpactReport(tamperedReport, sources),
      /DB_STORED_LOGIC_IMPACT_REPORT_TAMPERED/);
  }
});

test('Slice 3 Gate 7 fail-closes native coverage, integrity and no-invention probes symmetrically', async () => {
  const matrix = JSON.parse(await readFile(path.resolve(
    'tests/fixtures/db-analyzer/stored-logic-negative-matrix-v1.json',
  ), 'utf8'));
  assert.equal(matrix.schemaVersion, 'chimpmaera.db/stored-logic-negative-matrix/v1');
  assert.deepEqual(matrix.engines, ['mssql', 'oracle']);
  assert.equal(matrix.nativeCoverageCases.length, 3);
  assert.equal(matrix.integrityCases.length, 3);
  assert.equal(matrix.nonInventionCases.length, 4);

  for (const engine of matrix.engines) {
    const input = await loadStoredLogicEngine(engine);
    const profileFile = path.resolve(`tests/fixtures/db-analyzer/${engine}-stored-logic-profile-v1.json`);
    const profile = JSON.parse(await readFile(profileFile, 'utf8'));
    const before = (await runAnalyzeProfile(profileFile)).storedLogic;
    const profileContext = {
      profileId: profile.profileId,
      mode: profile.mode,
      scope: profile.scope,
      policy: profile.policy,
      adapter: profile.adapter.kind,
    };
    const profilingEvidence = await runAnalyzeProfile(path.resolve(
      `tests/fixtures/db-analyzer/${engine}-profiling-profile-v1.json`,
    ));
    const receipt = JSON.parse(await readFile(path.resolve(
      `tests/fixtures/db-analyzer/${engine}-profiling-review-v1.json`,
    ), 'utf8'));
    const knowledgePack = buildProfilingKnowledgePack({ evidence: profilingEvidence, receipt });
    const supersetResult = buildProfilingSupersetResult({ knowledgePack });

    for (const probe of matrix.nativeCoverageCases) {
      const resultSets = structuredClone(input.fixture);
      const queryId = `${engine}.stored-logic.native-dependencies`;
      resultSets.results[queryId] = {
        state: probe.state,
        reasonCode: probe.reasonCode,
        rows: resultSets.results[queryId].rows.slice(0, probe.retainRows),
      };
      const incomplete = buildStoredLogicEvidence({
        ...input,
        resultSets,
        profileContext,
      });
      assert.equal(incomplete.coverageLedger.allComplete, false, `${engine}:${probe.caseId}`);
      assert.equal(incomplete.coverageLedger.entries
        .find(({ queryId: id }) => id === queryId).emptyInterpretation, 'NOT_CLAIMED');
      assert.throws(
        () => buildStoredLogicImpactReport({ before, after: incomplete, knowledgePack, supersetResult }),
        new RegExp(probe.expectedImpactDenial),
        `${engine}:${probe.caseId}`,
      );
    }

    const encrypted = before.objects.find(({ definitionVisibility }) =>
      definitionVisibility === 'ENCRYPTED_OR_INVISIBLE');
    assert.ok(encrypted, `${engine}:encrypted-or-invisible-definition`);
    assert.equal(encrypted.definitionFingerprintSha256, null);
    assert.equal(encrypted.definitionComponentCount, 0);
    assert.ok(before.lineage.blindSpots.some(({ blindSpotClass }) =>
      blindSpotClass === 'UNSUPPORTED_RELATIONSHIP_UNKNOWN'));
    assert.ok(before.lineage.blindSpots.some(({ blindSpotClass }) =>
      blindSpotClass === 'DYNAMIC_RELATIONSHIP_UNKNOWN'));
    assert.ok(before.lineage.relationships
      .filter(({ relationshipClass }) => relationshipClass === 'INFERRED_OBJECT_PARSER')
      .every(({ proofState }) => proofState === 'INFERRED_PARSER'));

    const evidenceTamper = structuredClone(before);
    evidenceTamper.objects[0].definitionFingerprintSha256 = '0'.repeat(64);
    assert.throws(() => verifyStoredLogicEvidence(evidenceTamper), /DB_STORED_LOGIC_EVIDENCE_TAMPERED/);

    const promoted = structuredClone(before);
    const inferred = promoted.lineage.relationships.find(({ relationshipClass }) =>
      relationshipClass === 'INFERRED_OBJECT_PARSER');
    inferred.relationshipClass = 'PROVEN_OBJECT_NATIVE';
    inferred.proofState = 'PROVEN_NATIVE';
    const { relationshipSha256: ignoredRelationshipSha, ...relationshipBody } = inferred;
    inferred.relationshipSha256 = identitySha256(relationshipBody);
    const { lineageSha256: ignoredLineageSha, ...lineageBody } = promoted.lineage;
    promoted.lineage.lineageSha256 = identitySha256(lineageBody);
    const { storedLogicSha256: ignoredStoredSha, ...storedBody } = promoted;
    promoted.storedLogicSha256 = identitySha256(storedBody);
    assert.throws(() => verifyStoredLogicEvidence(promoted), /DB_STORED_LOGIC_LINEAGE_TAMPERED/);
  }
});

test('Slice 3 Gate 8 emits deterministic source-bound JSON, HTML and disconnected Superset projections', async () => {
  const verified = await verifyDbAnalyzerStoredLogicOutputs({ root: path.resolve('.') });
  assert.equal(verified.status, 'PASS');
  assert.equal(verified.deterministic, true);
  assert.equal(verified.exactSourceBinding, true);
  assert.equal(verified.canonicalJson, true);
  assert.equal(verified.html, true);
  assert.equal(verified.disconnectedSupersetProjections, true);
  assert.equal(verified.rawDefinitionsIncluded, false);
  assert.equal(verified.sourceRoutesIncluded, false);
  assert.equal(verified.automaticPublication, false);
  assert.equal(verified.directSourceDatabaseAccess, false);
  assert.equal(verified.denialProbeCount, 4);
  assert.deepEqual(verified.engines.map(({ engine }) => engine), ['mssql', 'oracle']);
  assert.ok(verified.engines.every((engine) => engine.storedObjectCount === 5
    && engine.lineageRelationshipCount >= 5
    && engine.blindSpotCount >= 5
    && engine.impactRowCount === 11
    && engine.reviewRequired === true
    && engine.runtimeValidation === 'SYNTHETIC_UNVALIDATED'));
});

test('Gate 6 static and adversarial matrix proves read-only catalog access and fail-closed outcomes', async () => {
  const evidence = await verifyDbAnalyzerSafety({ root: path.resolve('.') });
  assert.equal(evidence.staticAudit.queryCount, 18);
  assert.equal(evidence.staticAudit.zeroMutatingStatements, true);
  assert.equal(evidence.staticAudit.zeroRowSamples, true);
  assert.equal(evidence.probeCount, 12);
  assert.equal(evidence.passed, 12);
  assert.equal(evidence.failed, 0);
  assert.deepEqual([...new Set(evidence.results.map(({ engine }) => engine))], ['mssql', 'oracle']);
  assert.deepEqual([...new Set(evidence.results.map(({ probeId }) => probeId))], [
    'permission-denied',
    'partial-visibility',
    'timeout',
    'result-tamper',
    'sql-mutation-tamper',
    'row-sample-tamper',
  ]);
});

test('Gate 6 query audit rejects multi-statement writes, source rows and lexical concealment', async () => {
  const input = await loadEngine('mssql');
  const query = input.manifest.queries.find(({ category }) => category === 'schemas');
  assert.throws(
    () => auditCatalogQuery({ engine: 'mssql', queryId: query.id, sql: `${input.sqlByQueryId[query.id]}\nDELETE FROM dbo.customers;` }),
    /DB_QUERY_MULTI_STATEMENT_DENIED|DB_QUERY_MUTATION_DENIED/,
  );
  assert.throws(
    () => auditCatalogQuery({ engine: 'mssql', queryId: query.id, sql: 'SELECT customer_id FROM dbo.customers;' }),
    /DB_QUERY_ROW_SOURCE_DENIED/,
  );
  assert.throws(
    () => auditCatalogQuery({ engine: 'mssql', queryId: query.id, sql: "SELECT name FROM sys.schemas; /* unclosed" }),
    /DB_QUERY_SQL_LEXICAL_INVALID/,
  );
});

test('Gate 6 workflow audits query-pack safety before emitting synthetic evidence', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'cm-db-analyze-safety-'));
  try {
    await cp(path.resolve('query-packs/db-analyzer/v1'), path.join(temporary, 'query-packs/db-analyzer/v1'), { recursive: true });
    const queryPath = path.join(temporary, 'query-packs/db-analyzer/v1/oracle/structure-schemas.sql');
    const query = await readFile(queryPath, 'utf8');
    await writeFile(queryPath, `${query}\nDELETE FROM APP.CUSTOMERS;\n`);
    await assert.rejects(
      () => runAnalyzeProfile(path.resolve('tests/fixtures/db-analyzer/oracle-profile-v1.json'), { repositoryRoot: temporary }),
      /DB_QUERY_MULTI_STATEMENT_DENIED|DB_QUERY_MUTATION_DENIED/,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('Gate 7 double-scan and synthetic A/B drift are exact for both engines', async () => {
  const evidence = await verifyDbAnalyzerDrift({ root: path.resolve('.') });
  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.engines.length, 2);
  assert.equal(evidence.exactExpectedChanges, true);
  assert.equal(evidence.zeroUnexplainedChanges, true);
  for (const engine of evidence.engines) {
    assert.deepEqual(
      { added: engine.summary.added, removed: engine.summary.removed, changed: engine.summary.changed },
      { added: 1, removed: 1, changed: 1 },
    );
    assert.match(engine.unchangedSnapshotSha256, /^[a-f0-9]{64}$/);
    assert.match(engine.unchangedDriftSha256, /^[a-f0-9]{64}$/);
  }
});

test('Gate 7 drift fails closed on incomplete coverage and snapshot tamper', async () => {
  const input = await loadEngine('oracle');
  const baseline = buildPreflightEvidence({ manifest: input.manifest, sqlByQueryId: input.sqlByQueryId, resultSets: input.fixture });
  const partialFixture = structuredClone(input.fixture);
  partialFixture.results['oracle.structure.synonyms'] = {
    state: 'PARTIAL',
    reasonCode: 'DB_METADATA_VISIBILITY_PARTIAL',
    rows: partialFixture.results['oracle.structure.synonyms'].rows,
  };
  const partial = buildPreflightEvidence({ manifest: input.manifest, sqlByQueryId: input.sqlByQueryId, resultSets: partialFixture });
  assert.throws(() => compareStructuralEvidence({ manifest: input.manifest, baseline, current: partial }), /DB_DRIFT_COVERAGE_INCOMPLETE/);

  const tampered = structuredClone(baseline);
  tampered.extracts.find(({ category }) => category === 'columns').rows[0].data_type = 'VARCHAR2';
  assert.throws(() => compareStructuralEvidence({ manifest: input.manifest, baseline, current: tampered }), /DB_DRIFT_SNAPSHOT_TAMPERED/);
});

test('Gate 8 emits deterministic source-bound JSON, navigable HTML and disconnected Superset projections', async () => {
  const verification = await verifyDbAnalyzerOutputs({ root: path.resolve('.') });
  assert.equal(verification.status, 'PASS');
  assert.equal(verification.engines.length, 2);
  assert.equal(verification.supersetProjectionCount, 6);
  assert.equal(verification.directSupersetSourceDatabaseConnection, false);
  for (const engine of verification.engines) {
    assert.ok(engine.inventoryRows > 0);
    assert.ok(engine.relationshipRows > 0);
    assert.equal(engine.coverageRows, 9);
    assert.match(engine.sourceBindingSha256, /^[a-f0-9]{64}$/);
  }
});

test('Gate 8 output binding fails closed on evidence or source-query tamper', async () => {
  const input = await loadEngine('mssql');
  const evidence = buildPreflightEvidence({ manifest: input.manifest, sqlByQueryId: input.sqlByQueryId, resultSets: input.fixture });
  const tamperedEvidence = structuredClone(evidence);
  tamperedEvidence.extracts.find(({ category }) => category === 'relations').rows[0].relation_name = 'invented';
  assert.throws(
    () => buildStructureMapOutputs({ ...input, evidence: tamperedEvidence }),
    /DB_OUTPUT_EVIDENCE_INVALID/,
  );
  const tamperedSql = { ...input.sqlByQueryId, 'mssql.structure.relations': `${input.sqlByQueryId['mssql.structure.relations']}\n-- changed` };
  assert.throws(
    () => buildStructureMapOutputs({ ...input, evidence, sqlByQueryId: tamperedSql }),
    /DB_OUTPUT_QUERY_BINDING_INVALID/,
  );
});

test('cm db analyze writes one private output bundle while keeping canonical JSON on stdout', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'cm-db-analyze-output-'));
  const output = path.join(temporary, 'bundle');
  try {
    const profileFile = path.resolve('tests/fixtures/db-analyzer/oracle-profile-v1.json');
    const { stdout, stderr } = await execFileAsync(process.execPath, ['scripts/cm.mjs', 'db', 'analyze', profileFile, '--output', output]);
    assert.equal(stderr, '');
    const evidence = JSON.parse(stdout);
    const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
    assert.equal(manifest.sourceSnapshotSha256, evidence.snapshotSha256);
    for (const file of ['evidence.json', 'structure-map.json', 'structure-map.html', 'manifest.json', 'superset/inventory.json', 'superset/relationships.json', 'superset/coverage.json']) {
      assert.equal((await stat(path.join(output, file))).mode & 0o777, 0o600, file);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('synthetic preflight evidence is stable across row order and SQL line endings', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const input = await loadEngine(engine);
    const first = buildPreflightEvidence({ manifest: input.manifest, sqlByQueryId: input.sqlByQueryId, resultSets: input.fixture });
    const reordered = structuredClone(input.fixture);
    for (const result of Object.values(reordered.results)) result.rows?.reverse();
    const crlfSql = Object.fromEntries(Object.entries(input.sqlByQueryId).map(([id, sql]) => [id, sql.replace(/\n/g, '\r\n')]));
    const second = buildPreflightEvidence({ manifest: input.manifest, sqlByQueryId: crlfSql, resultSets: reordered });
    assert.equal(canonicalJson(first), canonicalJson(second), engine);
    assert.equal(first.runtimeValidation, 'SYNTHETIC_UNVALIDATED');
    assert.equal(first.coverage.SUCCEEDED, 9);
    assert.equal(first.coverage.DENIED, 0);
  }
});

test('Gate 4 canonical identities are UTF-8/NFC stable and exclude observation timestamps', async () => {
  const input = await loadEngine('mssql');
  const decomposed = structuredClone(input.fixture);
  decomposed.observedAt = '2026-08-10T18:00:00Z';
  decomposed.results['mssql.structure.synonyms'].rows[0].target_reference = 'Re\u0301sume\u0301\r\nView';
  for (const result of Object.values(decomposed.results)) {
    result.rows = result.rows?.reverse().map((row) => Object.fromEntries(Object.entries(row).reverse()));
  }

  const composed = structuredClone(input.fixture);
  composed.observedAt = '2026-08-10T19:00:00Z';
  composed.results['mssql.structure.synonyms'].rows[0].target_reference = 'R\u00e9sum\u00e9\nView';
  const crlfSql = Object.fromEntries(Object.entries(input.sqlByQueryId).map(([id, sql]) => [id, sql.replace(/\n/g, '\r\n')]));

  const first = buildPreflightEvidence({ manifest: input.manifest, sqlByQueryId: input.sqlByQueryId, resultSets: decomposed });
  const second = buildPreflightEvidence({ manifest: input.manifest, sqlByQueryId: crlfSql, resultSets: composed });
  assert.equal(first.identityContract.schemaVersion, IDENTITY_CONTRACT_SCHEMA);
  assert.notEqual(first.observedAt, second.observedAt);
  assert.equal(first.snapshotSha256, second.snapshotSha256);
  assert.deepEqual(
    first.extracts.flatMap((extract) => extract.rows.map((row) => row.objectSha256)),
    second.extracts.flatMap((extract) => extract.rows.map((row) => row.objectSha256)),
  );
  assert.ok(first.extracts.flatMap((extract) => extract.rows).every((row) => /^[a-f0-9]{64}$/.test(row.objectSha256)));
  assert.doesNotMatch(canonicalJson(first), /\r/);
  assert.match(canonicalJson(first), /R\u00e9sum\u00e9\\nView/);
});

test('coverage records denial without rows and rejects invented columns', async () => {
  const input = await loadEngine('oracle');
  const denied = structuredClone(input.fixture);
  denied.results['oracle.preflight.rights'] = { state: 'DENIED', reasonCode: 'DB_METADATA_PERMISSION_DENIED' };
  const evidence = buildPreflightEvidence({ manifest: input.manifest, sqlByQueryId: input.sqlByQueryId, resultSets: denied });
  assert.equal(evidence.coverage.DENIED, 1);
  assert.deepEqual(evidence.extracts.find((entry) => entry.queryId === 'oracle.preflight.rights').rows, []);

  const invented = structuredClone(input.fixture);
  invented.results['oracle.preflight.identity'].rows[0].invented = true;
  assert.throws(
    () => buildPreflightEvidence({ manifest: input.manifest, sqlByQueryId: input.sqlByQueryId, resultSets: invented }),
    /DB_QUERY_RESULT_COLUMNS_INVALID/,
  );
});

test('Gate 5 coverage ledger distinguishes all six states and never treats invisible metadata as empty', async () => {
  const input = await loadEngine('oracle');
  const fixture = structuredClone(input.fixture);
  const queryIds = input.manifest.queries.map((query) => query.id);
  const partialRows = fixture.results[queryIds[1]].rows.slice(0, 1);
  fixture.results[queryIds[0]] = { state: 'SUCCEEDED', rows: [] };
  fixture.results[queryIds[1]] = { state: 'PARTIAL', reasonCode: 'DB_METADATA_VISIBILITY_PARTIAL', rows: partialRows };
  fixture.results[queryIds[2]] = { state: 'DENIED', reasonCode: 'DB_METADATA_PERMISSION_DENIED', rows: [] };
  fixture.results[queryIds[3]] = { state: 'UNSUPPORTED', reasonCode: 'DB_ENGINE_FEATURE_UNSUPPORTED', rows: [] };
  fixture.results[queryIds[4]] = { state: 'TIMEOUT', reasonCode: 'DB_QUERY_TIMEOUT', rows: [] };
  fixture.results[queryIds[5]] = { state: 'ERROR', reasonCode: 'DB_QUERY_DRIVER_ERROR', rows: [] };

  const evidence = buildPreflightEvidence({ manifest: input.manifest, sqlByQueryId: input.sqlByQueryId, resultSets: fixture });
  assert.equal(evidence.coverageLedger.schemaVersion, COVERAGE_LEDGER_SCHEMA);
  assert.deepEqual(evidence.coverageLedger.stateCounts, {
    DENIED: 1,
    ERROR: 1,
    PARTIAL: 1,
    SUCCEEDED: 4,
    TIMEOUT: 1,
    UNSUPPORTED: 1,
  });
  assert.equal(evidence.coverageLedger.totalQueries, 9);
  assert.equal(evidence.coverageLedger.allComplete, false);
  assert.equal(evidence.coverageLedger.verifiedEmptyQueries, 1);
  assert.equal(evidence.coverageLedger.invisibleOrUnknownQueries, 3);
  const byState = Object.fromEntries(evidence.coverageLedger.entries.map((entry) => [entry.state, entry]));
  assert.deepEqual(
    Object.fromEntries(Object.entries(byState).map(([state, entry]) => [state, entry.visibility])),
    {
      DENIED: 'INVISIBLE',
      ERROR: 'UNKNOWN',
      PARTIAL: 'VISIBLE_PARTIAL',
      SUCCEEDED: 'VISIBLE_COMPLETE',
      TIMEOUT: 'UNKNOWN',
      UNSUPPORTED: 'NOT_APPLICABLE',
    },
  );
  assert.equal(byState.DENIED.emptyInterpretation, 'NOT_CLAIMED');
  assert.equal(byState.ERROR.emptyInterpretation, 'NOT_CLAIMED');
  assert.equal(byState.PARTIAL.rowCount, 1);
  assert.equal(byState.PARTIAL.emptyInterpretation, 'NOT_CLAIMED');
  assert.equal(evidence.extracts.find((entry) => entry.state === 'PARTIAL').rows.length, 1);
});

test('Gate 5 coverage input fails closed on tamper, invalid reasons and hidden rows', async () => {
  const input = await loadEngine('mssql');

  const extraQuery = structuredClone(input.fixture);
  extraQuery.results['mssql.structure.injected'] = { state: 'SUCCEEDED', rows: [] };
  assert.throws(
    () => buildPreflightEvidence({ manifest: input.manifest, sqlByQueryId: input.sqlByQueryId, resultSets: extraQuery }),
    /DB_QUERY_RESULT_SET_TAMPERED/,
  );

  const extraField = structuredClone(input.fixture);
  extraField.results['mssql.structure.schemas'].unexpected = true;
  assert.throws(
    () => buildPreflightEvidence({ manifest: input.manifest, sqlByQueryId: input.sqlByQueryId, resultSets: extraField }),
    /DB_QUERY_RESULT_TAMPERED/,
  );

  const missingReason = structuredClone(input.fixture);
  missingReason.results['mssql.structure.schemas'] = { state: 'DENIED', rows: [] };
  assert.throws(
    () => buildPreflightEvidence({ manifest: input.manifest, sqlByQueryId: input.sqlByQueryId, resultSets: missingReason }),
    /DB_QUERY_RESULT_REASON_INVALID/,
  );

  const hiddenRows = structuredClone(input.fixture);
  hiddenRows.results['mssql.structure.schemas'] = {
    state: 'DENIED',
    reasonCode: 'DB_METADATA_PERMISSION_DENIED',
    rows: input.fixture.results['mssql.structure.schemas'].rows,
  };
  assert.throws(
    () => buildPreflightEvidence({ manifest: input.manifest, sqlByQueryId: input.sqlByQueryId, resultSets: hiddenRows }),
    /DB_QUERY_FAILED_STATE_ROWS_DENIED/,
  );
});

test('one profile workflow emits scoped read-only preflight evidence for both engines', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const profileFile = path.resolve(`tests/fixtures/db-analyzer/${engine}-profile-v1.json`);
    const evidence = await runAnalyzeProfile(profileFile);
    assert.equal(evidence.engine, engine);
    assert.equal(evidence.profile.policy.access, 'READ_ONLY');
    assert.equal(evidence.profile.policy.allowRowSamples, false);
    assert.equal(evidence.profile.adapter, 'synthetic');
    assert.equal(evidence.runtimeValidation, 'SYNTHETIC_UNVALIDATED');
    assert.match(evidence.snapshotSha256, /^[a-f0-9]{64}$/);
  }
});

test('Slice 2 profiling policy is opt-in, symmetric, deterministic and emits no row samples', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const profileFile = path.resolve(`tests/fixtures/db-analyzer/${engine}-profiling-profile-v1.json`);
    const first = await runAnalyzeProfile(profileFile);
    const second = await runAnalyzeProfile(profileFile);
    assert.deepEqual(first, second);
    assert.equal(first.profile.policy.profiling.schemaVersion, 'chimpmaera.db/profiling-policy/v1');
    assert.equal(first.profile.policy.profiling.enabled, true);
    assert.equal(first.profile.policy.profiling.disclosure.allowRowSamples, false);
    assert.equal(first.profile.policy.profiling.disclosure.allowLabelDistributions, false);
    assert.equal(first.profiling.runtimeValidation, 'SYNTHETIC_UNVALIDATED');
    assert.equal(first.profiling.factCount, 6);
    assert.equal(first.profiling.queryPack.queryCount, 5);
    assert.equal(first.profiling.queryPack.plannedQueryCount, 6);
    assert.equal(first.profiling.queryPlan.length, 6);
    assert.deepEqual(first.profiling.queryPlan.map((entry) => entry.typeFamily), ['TEMPORAL', 'TEXT', 'BOOLEAN', 'NUMERIC', 'NUMERIC', 'CATEGORY']);
    assert.equal(first.profiling.queryPlan.find((entry) => entry.typeFamily === 'TEMPORAL').outputColumns.join(','), 'rowCount,nullCount,distinctCount,minimum,maximum,freshnessMaximum');
    assert.ok(first.profiling.queryPlan.filter((entry) => entry.typeFamily === 'NUMERIC').every((entry) => entry.outputColumns.join(',') === 'rowCount,nullCount,distinctCount,minimum,maximum'));
    assert.ok(first.profiling.queryPlan.filter((entry) => ['CATEGORY', 'TEXT', 'BOOLEAN'].includes(entry.typeFamily))
      .every((entry) => entry.outputColumns.join(',') === 'rowCount,nullCount,distinctCount'));
    assert.match(first.profiling.policySha256, /^[a-f0-9]{64}$/);
    assert.match(first.profiling.aggregateSha256, /^[a-f0-9]{64}$/);
    assert.equal(first.profiling.candidates.publicationState, 'REVIEW_REQUIRED');
    assert.match(first.profiling.candidates.candidateSetSha256, /^[a-f0-9]{64}$/);
    assert.ok(first.profiling.facts.every((fact) => fact.distribution === null));
    const temporalFact = first.profiling.facts.find((fact) => fact.typeFamily === 'TEMPORAL');
    assert.equal(temporalFact.freshnessMaximum, temporalFact.maximum);
    assert.match(temporalFact.freshnessMaximum, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}$/);
    assert.doesNotMatch(canonicalJson(first.profiling), /rowSample|sampleValue|sample_value/i);
  }
});

test('Slice 2 Gate 4 derives only evidence-bound review candidates for both engines', async () => {
  const evidence = await verifyDbAnalyzerCandidates({ root: path.resolve('.') });
  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.deterministic, true);
  assert.equal(evidence.exactRecomputation, true);
  assert.equal(evidence.applicationSpecificRules, false);
  assert.equal(evidence.inventedSemanticClaims, 0);
  assert.equal(evidence.tamperProbesPassed, 2);
  assert.equal(evidence.engines.length, 2);
  for (const engine of evidence.engines) {
    assert.deepEqual(engine.candidateTypes, ['AMOUNT', 'CATEGORY', 'KEY', 'TIME']);
    assert.equal(engine.semanticCandidateCount, 5);
    assert.equal(engine.qualityCandidateCount, 6);
    assert.match(engine.candidateSetSha256, /^[a-f0-9]{64}$/);
  }
});

test('Slice 2 Gate 4 candidate recomputation denies changed aggregate facts and cannot publish semantic truth', async () => {
  const evidence = await runAnalyzeProfile(path.resolve('tests/fixtures/db-analyzer/mssql-profiling-profile-v1.json'));
  const { candidates, ...aggregate } = evidence.profiling;
  assert.deepEqual(deriveProfilingCandidates(aggregate), candidates);
  const all = [...candidates.semanticCandidates, ...candidates.qualityCandidates];
  assert.ok(all.every((candidate) => candidate.classificationState === 'UNKNOWN'));
  assert.ok(all.every((candidate) => candidate.reviewState === 'REVIEW_REQUIRED'));
  assert.ok(all.every((candidate) => candidate.semanticClaim === 'NOT_ESTABLISHED'));
  const tampered = structuredClone(aggregate);
  tampered.facts.find((fact) => fact.columnName === 'quantity').nullCount = 0;
  assert.throws(() => deriveProfilingCandidates(tampered), /DB_PROFILING_CANDIDATE_SOURCE_TAMPERED/);
});

test('Slice 2 Gate 5 preserves negative coverage and review-required states symmetrically', async () => {
  const evidence = await verifyDbAnalyzerProfilingCoverage({ root: path.resolve('.') });
  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.deterministic, true);
  assert.equal(evidence.unsafeMaterialRetained, false);
  assert.equal(evidence.denialProbeCount, 8);
  assert.deepEqual(evidence.statesPreserved, ['PARTIAL', 'DENIED', 'UNSUPPORTED', 'TIMEOUT', 'TAMPER', 'REVIEW_REQUIRED']);
  for (const engine of evidence.engines) {
    assert.deepEqual(engine.stateCounts, { SUCCEEDED: 1, PARTIAL: 1, DENIED: 1, UNSUPPORTED: 1, TIMEOUT: 1, TAMPER: 1 });
    assert.equal(engine.publicationState, 'REVIEW_REQUIRED');
    assert.equal(engine.deniedDisclosureProbes, 4);
  }
});

test('Slice 2 Gate 5 coverage denies malformed, duplicate and unbound attempts', async () => {
  const profile = validateAnalyzeProfile(JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/mssql-profiling-profile-v1.json'), 'utf8')));
  const target = { schemaName: 'dbo', relationName: 'orders', columnName: 'order_id', typeFamily: 'NUMERIC' };
  const attempt = { ...target, state: 'DENIED', reasonCode: 'DB_PROFILE_PERMISSION_DENIED', factSha256: null };
  const duplicate = [attempt, structuredClone(attempt)];
  assert.throws(() => buildProfilingCoverageLedger({ profile, attempts: duplicate }), /DB_PROFILING_COVERAGE_SCOPE_INVALID/);
  assert.throws(() => buildProfilingCoverageLedger({ profile, attempts: [{ ...attempt, extra: true }] }), /DB_PROFILING_COVERAGE_TAMPERED/);
  assert.throws(() => buildProfilingCoverageLedger({ profile, attempts: [{ ...attempt, state: 'PARTIAL' }] }), /DB_PROFILING_COVERAGE_TAMPERED/);
});

test('Slice 2 Gate 6 binds immutable synthetic human-review receipts for both engines', async () => {
  const evidence = await verifyDbAnalyzerProfilingReview({ root: path.resolve('.') });
  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.deterministic, true);
  assert.equal(evidence.denialProbeCount, 8);
  assert.equal(evidence.analyzerMayIssueReceipt, false);
  assert.equal(evidence.externalPublicationAuthority, false);
  assert.deepEqual(evidence.deniedConditions, ['STALE_ANALYSIS', 'STRUCTURE_DRIFT', 'FOREIGN_SCOPE', 'POST_REVIEW_MUTATION']);
  assert.equal(evidence.engines.length, 2);
  assert.ok(evidence.engines.every((engine) => engine.approvedCandidates === 10
    && engine.rejectedCandidates === 1 && engine.productionAuthority === false));
});

test('Slice 2 Gate 6 rejects incomplete review coverage even with a recomputed receipt digest', async () => {
  const evidence = await runAnalyzeProfile(path.resolve('tests/fixtures/db-analyzer/mssql-profiling-profile-v1.json'));
  const receipt = JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/mssql-profiling-review-v1.json'), 'utf8'));
  receipt.decisions.pop();
  const { receiptSha256: _previous, ...body } = receipt;
  receipt.receiptSha256 = createHash('sha256').update(canonicalJson(body)).digest('hex');
  assert.throws(() => authorizeProfilingProjection({ evidence, receipt }), /DB_PROFILING_REVIEW_DECISIONS_INCOMPLETE/);
});

test('Slice 2 aggregate templates cover supported non-label families symmetrically and identifier-safely', async () => {
  const manifests = [];
  for (const engine of ['mssql', 'oracle']) {
    const { manifest, sqlByQueryId } = await loadProfilingEngine(engine);
    validateProfilingQueryManifest(manifest, sqlByQueryId);
    manifests.push(manifest);
    const plan = compileProfilingQuery({
      manifest,
      sqlByQueryId,
      target: { schemaName: 'scope name', relationName: 'orders; DROP TABLE audit', columnName: 'net]"amount', typeFamily: 'NUMERIC' },
    });
    assert.match(plan.querySha256, /^[a-f0-9]{64}$/);
    assert.equal(plan.timeoutMs, 1000);
    assert.equal(manifest.queries[0].readOnly, true);
    assert.equal(manifest.queries[0].aggregateOnly, true);
    assert.equal(manifest.queries[0].rowSamples, false);
    assert.equal(manifest.queries[0].labelDistributions, false);
    const temporalPlan = compileProfilingQuery({
      manifest,
      sqlByQueryId,
      target: { schemaName: 'scope name', relationName: 'orders; DROP TABLE audit', columnName: 'created]"at', typeFamily: 'TEMPORAL' },
    });
    assert.match(temporalPlan.querySha256, /^[a-f0-9]{64}$/);
    assert.equal(temporalPlan.timeoutMs, 1000);
    assert.deepEqual(temporalPlan.outputColumns, ['rowCount', 'nullCount', 'distinctCount', 'minimum', 'maximum', 'freshnessMaximum']);
    for (const typeFamily of ['CATEGORY', 'TEXT', 'BOOLEAN']) {
      const cardinalityPlan = compileProfilingQuery({
        manifest,
        sqlByQueryId,
        target: { schemaName: 'scope name', relationName: 'orders; DROP TABLE audit', columnName: `${typeFamily.toLowerCase()}]"value`, typeFamily },
      });
      assert.match(cardinalityPlan.querySha256, /^[a-f0-9]{64}$/);
      assert.equal(cardinalityPlan.timeoutMs, 1000);
      assert.deepEqual(cardinalityPlan.outputColumns, ['rowCount', 'nullCount', 'distinctCount']);
    }
  }
  assert.deepEqual(manifests.map(({ queries }) => queries.map(({ typeFamilies }) => typeFamilies)), [
    [['NUMERIC'], ['TEMPORAL'], ['CATEGORY'], ['TEXT'], ['BOOLEAN']],
    [['NUMERIC'], ['TEMPORAL'], ['CATEGORY'], ['TEXT'], ['BOOLEAN']],
  ]);
  assert.deepEqual(manifests.map(({ queries }) => queries.map(({ category }) => category)), [
    ['numeric-aggregate', 'temporal-aggregate', 'category-aggregate', 'text-aggregate', 'boolean-aggregate'],
    ['numeric-aggregate', 'temporal-aggregate', 'category-aggregate', 'text-aggregate', 'boolean-aggregate'],
  ]);
});

test('Slice 2 aggregate query pack fails closed on template tamper and unsupported families', async () => {
  const { manifest, sqlByQueryId } = await loadProfilingEngine('mssql');
  const tampered = structuredClone(sqlByQueryId);
  tampered[manifest.queries[0].id] += '\nDELETE FROM dbo.orders;\n';
  assert.throws(() => validateProfilingQueryManifest(manifest, tampered), /DB_PROFILING_QUERY_TEMPLATE_DENIED/);
  assert.throws(
    () => compileProfilingQuery({
      manifest,
      sqlByQueryId,
      target: { schemaName: 'dbo', relationName: 'orders', columnName: 'payload', typeFamily: 'OTHER' },
    }),
    /DB_PROFILING_TYPE_FAMILY_UNSUPPORTED/,
  );
});

test('Slice 2 profiling policy fails closed on scope, budget, timeout, cancellation and disclosure violations', async () => {
  const base = JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/mssql-profiling-profile-v1.json'), 'utf8'));
  const cases = [
    ['scope', (profile) => { profile.policy.profiling.scope[0].schemaName = 'outside_scope'; }, /DB_PROFILING_SCOPE_INVALID/],
    ['relation budget', (profile) => { profile.policy.profiling.budgets.maxRelations = 0; }, /DB_PROFILING_BUDGET_INVALID/],
    ['column budget', (profile) => { profile.policy.profiling.budgets.maxColumns = 1; }, /DB_PROFILING_BUDGET_INVALID/],
    ['query budget', (profile) => { profile.policy.profiling.budgets.maxQueries = 1; }, /DB_PROFILING_BUDGET_INVALID/],
    ['timeout budget', (profile) => { profile.policy.profiling.budgets.maxQueryTimeoutMs = 5001; }, /DB_PROFILING_BUDGET_INVALID/],
    ['cancellation', (profile) => { profile.policy.profiling.cancellation.onAbort = 'CONTINUE'; }, /DB_PROFILING_CANCELLATION_INVALID/],
    ['row samples', (profile) => { profile.policy.profiling.disclosure.allowRowSamples = true; }, /DB_PROFILING_DISCLOSURE_DENIED/],
    ['label distributions', (profile) => { profile.policy.profiling.disclosure.allowLabelDistributions = true; }, /DB_PROFILING_DISCLOSURE_DENIED/],
    ['write access', (profile) => { profile.policy.access = 'READ_WRITE'; }, /DB_ANALYZE_PROFILE_POLICY_INVALID/],
  ];
  for (const [label, mutate, expected] of cases) {
    const profile = structuredClone(base);
    mutate(profile);
    assert.throws(() => validateAnalyzeProfile(profile), expected, label);
  }
});

test('Slice 2 aggregate ground truth denies cross-scope, budget and distribution leakage', async () => {
  const profile = validateAnalyzeProfile(JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/mssql-profiling-profile-v1.json'), 'utf8')));
  const fixture = JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/mssql-aggregate-results-v1.json'), 'utf8'));
  const { manifest, sqlByQueryId } = await loadProfilingEngine('mssql');
  const build = (resultSets) => buildAggregateProfilingEvidence({
    profile,
    resultSets,
    profilingManifest: manifest,
    profilingSqlByQueryId: sqlByQueryId,
  });
  const crossScope = structuredClone(fixture);
  crossScope.facts[0].schemaName = 'outside_scope';
  assert.throws(() => build(crossScope), /DB_PROFILING_RESULT_INVALID/);
  const overBudget = structuredClone(fixture);
  overBudget.facts.push({ ...overBudget.facts[0], columnName: 'third_column' });
  assert.throws(() => build(overBudget), /DB_PROFILING_BUDGET_EXCEEDED/);
  const leaking = structuredClone(fixture);
  leaking.facts[0].distribution = [{ label: 'customer-value', count: 1 }];
  assert.throws(() => build(leaking), /DB_PROFILING_DISTRIBUTION_DENIED/);
  const unsupported = structuredClone(fixture);
  unsupported.facts[0].typeFamily = 'OTHER';
  assert.throws(() => build(unsupported), /DB_PROFILING_RESULT_INVALID/);
  const inventedFreshness = structuredClone(fixture);
  inventedFreshness.facts.find((fact) => fact.typeFamily === 'TEMPORAL').freshnessMaximum = '2026-08-11T00:00:00.000000000';
  assert.throws(() => build(inventedFreshness), /DB_PROFILING_RESULT_INVALID/);
});

test('Slice 2 runtime profiling fails before credentials or a database connection are used', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'cm-db-profile-runtime-denial-'));
  try {
    const profile = JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/mssql-runtime-wwi-profile-v1.json'), 'utf8'));
    const synthetic = JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/mssql-profiling-profile-v1.json'), 'utf8'));
    profile.policy.profiling = structuredClone(synthetic.policy.profiling);
    profile.policy.profiling.aggregateFixture = null;
    const profileFile = path.join(temporary, 'runtime-profile.json');
    await writeFile(profileFile, canonicalJson(profile));
    await assert.rejects(() => runAnalyzeProfile(profileFile), /DB_PROFILING_RUNTIME_NOT_AUTHORIZED/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('Slice 2 profiling honors fail-closed workflow cancellation', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => runAnalyzeProfile(path.resolve('tests/fixtures/db-analyzer/oracle-profiling-profile-v1.json'), { signal: controller.signal }),
    /DB_ANALYZE_CANCELLED/,
  );
});

test('runtime profile keeps credentials in the environment and fails closed when absent', async () => {
  const profileFile = path.resolve('tests/fixtures/db-analyzer/mssql-runtime-wwi-profile-v1.json');
  const profile = validateAnalyzeProfile(JSON.parse(await readFile(profileFile, 'utf8')));
  assert.equal(profile.mode, 'RUNTIME');
  assert.equal(profile.adapter.kind, 'mssql');
  assert.equal(profile.adapter.passwordEnv, 'CM_DB_PASSWORD');
  assert.equal(Object.hasOwn(profile.adapter, 'password'), false);
  const previous = process.env.CM_DB_PASSWORD;
  delete process.env.CM_DB_PASSWORD;
  try {
    await assert.rejects(() => runAnalyzeProfile(profileFile), /DB_ANALYZE_CREDENTIAL_MISSING/);
  } finally {
    if (previous !== undefined) process.env.CM_DB_PASSWORD = previous;
  }
});

test('cm db analyze is runnable and profile policy fails closed', async () => {
  const profileFile = path.resolve('tests/fixtures/db-analyzer/mssql-profile-v1.json');
  const { stdout, stderr } = await execFileAsync(process.execPath, ['scripts/cm.mjs', 'db', 'analyze', profileFile]);
  assert.equal(stderr, '');
  const evidence = JSON.parse(stdout);
  assert.equal(evidence.profile.profileId, 'synthetic-mssql-structure-map');

  const profile = JSON.parse(await readFile(profileFile, 'utf8'));
  profile.policy.allowRowSamples = true;
  assert.throws(() => validateAnalyzeProfile(profile), /DB_ANALYZE_PROFILE_POLICY_INVALID/);
  profile.policy.allowRowSamples = false;
  profile.adapter.fixture = '../mssql-preflight-v1.json';
  assert.throws(() => validateAnalyzeProfile(profile), /DB_ANALYZE_PROFILE_ADAPTER_INVALID/);
});

test('workflow rejects synthetic identity evidence outside the declared scope', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'cm-db-analyze-scope-'));
  try {
    const profile = JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/oracle-profile-v1.json'), 'utf8'));
    const fixture = JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/oracle-preflight-v1.json'), 'utf8'));
    fixture.results['oracle.preflight.identity'].rows[0].database_name = 'OUTSIDE_SCOPE';
    await writeFile(path.join(temporary, profile.adapter.fixture), canonicalJson(fixture));
    const profileFile = path.join(temporary, 'profile.json');
    await writeFile(profileFile, canonicalJson(profile));
    await assert.rejects(() => runAnalyzeProfile(profileFile), /DB_ANALYZE_SCOPE_MISMATCH/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('schema and relation ground truth is normalized without cross-scope invention', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const profileFile = path.resolve(`tests/fixtures/db-analyzer/${engine}-profile-v1.json`);
    const evidence = await runAnalyzeProfile(profileFile);
    const schemas = evidence.extracts.find((entry) => entry.category === 'schemas');
    const relations = evidence.extracts.find((entry) => entry.category === 'relations');
    assert.equal(schemas.state, 'SUCCEEDED');
    assert.equal(schemas.rows.length, 1);
    assert.deepEqual(relations.rows.map((row) => row.relation_kind).sort(), ['TABLE', 'VIEW']);
    assert.ok(relations.rows.every((row) => evidence.profile.scope.schemas.includes(row.schema_name)));
  }

  const temporary = await mkdtemp(path.join(tmpdir(), 'cm-db-analyze-structure-scope-'));
  try {
    const profile = JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/mssql-profile-v1.json'), 'utf8'));
    const fixture = JSON.parse(await readFile(path.resolve('tests/fixtures/db-analyzer/mssql-preflight-v1.json'), 'utf8'));
    fixture.results['mssql.structure.schemas'].rows[0].schema_name = 'outside_scope';
    await writeFile(path.join(temporary, profile.adapter.fixture), canonicalJson(fixture));
    const profileFile = path.join(temporary, 'profile.json');
    await writeFile(profileFile, canonicalJson(profile));
    await assert.rejects(() => runAnalyzeProfile(profileFile), /DB_QUERY_RESULT_SCOPE_INVALID/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('MSSQL runtime scope semantics ignore undeclared ambient principal schemas and reject genuine scope drift', async () => {
  const captured = JSON.parse(await readFile(path.resolve(
    'tests/fixtures/db-analyzer/mssql-adventureworks-scope-contract-v1.json',
  ), 'utf8'));
  const manifest = JSON.parse(await readFile(path.resolve('query-packs/db-analyzer/v1/mssql/manifest.json'), 'utf8'));
  const sqlByQueryId = Object.fromEntries(await Promise.all(manifest.queries.map(async (query) => [
    query.id,
    await readFile(path.resolve('query-packs/db-analyzer/v1/mssql', query.file), 'utf8'),
  ])));
  const profileContext = {
    profileId: 'runtime-mssql-adventureworks2022',
    mode: 'RUNTIME',
    scope: { database: captured.database, container: null, schemas: captured.declaredSchemas },
    policy: { access: 'READ_ONLY', allowRowSamples: false, maxQueryTimeoutMs: 10000 },
    adapter: 'mssql',
  };
  const profile = { engine: 'mssql', scope: profileContext.scope };
  const results = Object.fromEntries(manifest.queries.map((query) => [
    query.id,
    { state: 'SUCCEEDED', reasonCode: null, rows: [] },
  ]));
  results['mssql.preflight.identity'].rows = [{
    engine: 'mssql',
    engine_version: '16.0.4265.3',
    engine_edition: 'Developer Edition (64-bit)',
    database_name: captured.database,
    container_name: null,
    compatibility_level: 160,
  }];
  results['mssql.structure.schemas'].rows = captured.schemaRows;
  const resultSets = {
    schemaVersion: 'chimpmaera.db/runtime-query-results/v1',
    engine: 'mssql',
    runtimeValidated: true,
    results,
  };

  assert.throws(
    () => buildPreflightEvidence({ manifest, sqlByQueryId, resultSets, profileContext }),
    /DB_QUERY_RESULT_SCOPE_INVALID/,
  );

  const schemaQuery = manifest.queries.find((query) => query.id === 'mssql.structure.schemas');
  const normalized = normalizeMssqlRuntimeScopeResult({
    profile,
    query: schemaQuery,
    result: resultSets.results[schemaQuery.id],
  });
  assert.deepEqual(normalized, normalizeMssqlRuntimeScopeResult({
    profile,
    query: schemaQuery,
    result: resultSets.results[schemaQuery.id],
  }));
  const repairedResultSets = structuredClone(resultSets);
  repairedResultSets.results[schemaQuery.id] = normalized;
  const repaired = buildPreflightEvidence({ manifest, sqlByQueryId, resultSets: repairedResultSets, profileContext });
  assert.deepEqual(
    repaired.extracts.find((entry) => entry.queryId === schemaQuery.id).rows.map((row) => row.schema_name),
    ['HumanResources', 'dbo'],
  );

  const driftedResultSets = structuredClone(resultSets);
  driftedResultSets.results[schemaQuery.id] = normalizeMssqlRuntimeScopeResult({
    profile,
    query: schemaQuery,
    result: {
      ...resultSets.results[schemaQuery.id],
      rows: [...captured.schemaRows, captured.genuinelyOutOfScopeRow],
    },
  });
  assert.throws(
    () => buildPreflightEvidence({ manifest, sqlByQueryId, resultSets: driftedResultSets, profileContext }),
    /DB_QUERY_RESULT_SCOPE_INVALID/,
  );

  const explicitlyDeclared = structuredClone(profile);
  explicitlyDeclared.scope.schemas = captured.capturedExpandedSchemas;
  assert.deepEqual(
    normalizeMssqlRuntimeScopeResult({
      profile: explicitlyDeclared,
      query: schemaQuery,
      result: resultSets.results[schemaQuery.id],
    }).rows,
    captured.schemaRows,
  );
});

test('column ground truth preserves types, defaults and native generated-column evidence', async () => {
  const expectations = {
    mssql: { identity: 'IDENTITY', derived: 'COMPUTED', defaultValue: '((0))' },
    oracle: { identity: 'IDENTITY', derived: 'VIRTUAL', defaultValue: '0' },
  };
  for (const engine of ['mssql', 'oracle']) {
    const profileFile = path.resolve(`tests/fixtures/db-analyzer/${engine}-profile-v1.json`);
    const evidence = await runAnalyzeProfile(profileFile);
    const columns = evidence.extracts.find((entry) => entry.category === 'columns');
    assert.equal(columns.state, 'SUCCEEDED');
    assert.equal(columns.rows.length, 4);
    assert.ok(columns.rows.every((row) => evidence.profile.scope.schemas.includes(row.schema_name)));
    assert.ok(columns.rows.some((row) => row.generation_kind === expectations[engine].identity && row.is_identity === true));
    assert.ok(columns.rows.some((row) => row.generation_kind === expectations[engine].derived && row.generation_expression));
    assert.ok(columns.rows.some((row) => row.default_expression === expectations[engine].defaultValue));
    assert.ok(columns.rows.every((row) => !Object.hasOwn(row, 'sample_value')));
  }
});

test('constraint ground truth preserves keys, relationships, checks and validation state', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const profileFile = path.resolve(`tests/fixtures/db-analyzer/${engine}-profile-v1.json`);
    const evidence = await runAnalyzeProfile(profileFile);
    const constraints = evidence.extracts.find((entry) => entry.category === 'constraints');
    assert.equal(constraints.state, 'SUCCEEDED');
    assert.deepEqual([...new Set(constraints.rows.map((row) => row.constraint_kind))].sort(), ['CHECK', 'FOREIGN_KEY', 'PRIMARY_KEY', 'UNIQUE']);
    assert.ok(constraints.rows.every((row) => evidence.profile.scope.schemas.includes(row.schema_name)));
    const foreignKey = constraints.rows.find((row) => row.constraint_kind === 'FOREIGN_KEY');
    assert.ok(foreignKey.referenced_schema_name);
    assert.ok(foreignKey.referenced_relation_name);
    assert.ok(foreignKey.referenced_column_name);
    assert.equal(foreignKey.is_enabled, true);
    assert.equal(foreignKey.is_validated, true);
    const check = constraints.rows.find((row) => row.constraint_kind === 'CHECK');
    assert.ok(check.check_expression);
    assert.ok(constraints.rows.every((row) => !Object.hasOwn(row, 'sample_value')));
  }
});

test('index ground truth preserves ordered columns, uniqueness and basic partition layout', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const profileFile = path.resolve(`tests/fixtures/db-analyzer/${engine}-profile-v1.json`);
    const evidence = await runAnalyzeProfile(profileFile);
    const indexes = evidence.extracts.find((entry) => entry.category === 'indexes');
    assert.equal(indexes.state, 'SUCCEEDED');
    assert.ok(indexes.rows.every((row) => evidence.profile.scope.schemas.includes(row.schema_name)));
    const partitioned = indexes.rows.find((row) => row.partitioning_kind === 'RANGE');
    assert.equal(partitioned.is_partition_key, true);
    assert.equal(partitioned.partition_ordinal, 1);
    assert.equal(partitioned.partition_count, 4);
    assert.equal(partitioned.is_unique, true);
    assert.equal(partitioned.is_primary_key, true);
    const ordinary = indexes.rows.find((row) => row.partitioning_kind === 'NONE');
    assert.equal(ordinary.partition_count, 1);
    assert.ok(indexes.rows.every((row) => !Object.hasOwn(row, 'sample_value')));
  }
});

test('complete Gate 2 ground truth covers every scoped structural category without invention', async () => {
  const structuralCategories = ['schemas', 'relations', 'columns', 'constraints', 'indexes', 'sequences', 'synonyms'];
  for (const engine of ['mssql', 'oracle']) {
    const profileFile = path.resolve(`tests/fixtures/db-analyzer/${engine}-profile-v1.json`);
    const evidence = await runAnalyzeProfile(profileFile);
    const structure = evidence.extracts.filter((entry) => entry.category !== 'preflight');
    assert.deepEqual(structure.map((entry) => entry.category), structuralCategories);
    assert.ok(structure.every((entry) => entry.state === 'SUCCEEDED' && entry.rows.length > 0));
    assert.ok(structure.flatMap((entry) => entry.rows).every((row) => evidence.profile.scope.schemas.includes(row.schema_name)));

    const sequence = structure.find((entry) => entry.category === 'sequences').rows[0];
    assert.equal(sequence.sequence_name.toLowerCase(), 'order_number_seq');
    assert.equal(sequence.increment_by, '1');
    assert.equal(sequence.is_cycling, false);
    assert.ok(['CURRENT_VALUE', 'LAST_NUMBER'].includes(sequence.observed_value_semantics));

    const synonym = structure.find((entry) => entry.category === 'synonyms').rows[0];
    assert.equal(synonym.synonym_name.toLowerCase(), 'customer_directory');
    assert.ok(synonym.target_reference);
    assert.ok(synonym.target_schema_name);
    assert.ok(synonym.target_object_name);
    assert.ok(structure.flatMap((entry) => entry.rows).every((row) => !Object.hasOwn(row, 'sample_value')));
  }
});

test('Gate 3 provenance and runtime dependency SBOM fail closed on query or license drift', async () => {
  const verified = await verifyDbAnalyzerProvenance({ root: path.resolve('.') });
  assert.equal(verified.status, 'PASS');
  assert.equal(verified.queryArtifactCount, 18);
  assert.equal(verified.runtimeDependencyRootCount, 1);
  assert.equal(verified.runtimeDependencyClosureCount, 72);
  assert.deepEqual(verified.runtimeDependencyLicenses, ['0BSD', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'MIT']);
  assert.equal(verified.copiedOrAdaptedSourceCount, 0);
  assert.equal(verified.oracleRuntimeValidation, 'NOT_CLAIMED');

  const temporary = await mkdtemp(path.join(tmpdir(), 'cm-db-provenance-'));
  try {
    await cp(path.resolve('query-packs/db-analyzer/v1'), path.join(temporary, 'query-packs/db-analyzer/v1'), { recursive: true });
    await mkdir(path.join(temporary, 'scripts/lib/db-analyzer'), { recursive: true });
    await cp(path.resolve('package.json'), path.join(temporary, 'package.json'));
    await cp(path.resolve('package-lock.json'), path.join(temporary, 'package-lock.json'));
    await cp(path.resolve('LICENSE'), path.join(temporary, 'LICENSE'));
    await cp(path.resolve('THIRD_PARTY_NOTICES.md'), path.join(temporary, 'THIRD_PARTY_NOTICES.md'));

    const queryPath = path.join(temporary, 'query-packs/db-analyzer/v1/mssql/preflight-identity.sql');
    const query = await readFile(queryPath, 'utf8');
    await writeFile(queryPath, `${query}\n-- tamper\n`);
    await assert.rejects(
      () => verifyDbAnalyzerProvenance({ root: temporary }),
      /DB_ANALYZER_QUERY_DIGEST_DRIFT_DENIED/,
    );
    await writeFile(queryPath, query);

    const packageLockPath = path.join(temporary, 'package-lock.json');
    const packageLock = JSON.parse(await readFile(packageLockPath, 'utf8'));
    packageLock.packages['node_modules/mssql'].license = 'LicenseRef-Proprietary';
    const packageLockBytes = `${JSON.stringify(packageLock, null, 2)}\n`;
    await writeFile(packageLockPath, packageLockBytes);
    const provenancePath = path.join(temporary, 'query-packs/db-analyzer/v1/provenance-license-lock.json');
    const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
    provenance.runtimeDependencySbom.packageLockSha256 = createHash('sha256').update(packageLockBytes).digest('hex');
    await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
    await assert.rejects(
      () => verifyDbAnalyzerProvenance({ root: temporary }),
      /DB_ANALYZER_RUNTIME_ROOT_DRIFT_DENIED/,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('Slice 2 Gate 3 binds every profiling template to provenance, SELECT-only safety and the permissive dependency closure', async () => {
  const verified = await verifyDbAnalyzerProfilingProvenance({ root: path.resolve('.') });
  assert.equal(verified.status, 'PASS');
  assert.equal(verified.issue, 194);
  assert.equal(verified.queryArtifactCount, 10);
  assert.equal(verified.staticSelectOnlyCount, 10);
  assert.equal(verified.copiedOrAdaptedSourceCount, 0);
  assert.equal(verified.newRequiredRuntimeDependencyCount, 0);
  assert.equal(verified.runtimeDependencyClosureCount, 72);
  assert.deepEqual(verified.runtimeDependencyLicenses, ['0BSD', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'MIT']);
  assert.equal(verified.runtimeValidation, 'NOT_AUTHORIZED');
});

test('Slice 2 Gate 3 fails closed on profiling query tamper and digest-aware sample leakage', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'cm-db-profiling-provenance-'));
  try {
    await cp(path.resolve('query-packs/db-analyzer/v1'), path.join(temporary, 'query-packs/db-analyzer/v1'), { recursive: true });
    await cp(path.resolve('package.json'), path.join(temporary, 'package.json'));
    await cp(path.resolve('package-lock.json'), path.join(temporary, 'package-lock.json'));
    await cp(path.resolve('LICENSE'), path.join(temporary, 'LICENSE'));
    await cp(path.resolve('THIRD_PARTY_NOTICES.md'), path.join(temporary, 'THIRD_PARTY_NOTICES.md'));

    const queryPath = path.join(temporary, 'query-packs/db-analyzer/v1/mssql/profile-category-aggregate.sql');
    const original = await readFile(queryPath, 'utf8');
    await writeFile(queryPath, `${original}\n-- tamper\n`);
    await assert.rejects(
      () => verifyDbAnalyzerProfilingProvenance({ root: temporary }),
      /DB_PROFILING_QUERY_MANIFEST_INVALID|DB_PROFILING_QUERY_TEMPLATE_DENIED|DB_PROFILING_QUERY_COMMENT_DENIED|DB_PROFILING_QUERY_DIGEST_DRIFT_DENIED/,
    );

    const leaking = 'SELECT {{COLUMN}} AS [sampleValue] FROM {{SCHEMA}}.{{RELATION}};\n';
    const digest = createHash('sha256').update(normalizeSql(leaking)).digest('hex');
    await writeFile(queryPath, leaking);
    const manifestPath = path.join(temporary, 'query-packs/db-analyzer/v1/mssql/profiling-manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const entry = manifest.queries.find(({ id }) => id === 'mssql.profiling.category-aggregate');
    entry.templateSha256 = digest;
    entry.outputColumns = ['sampleValue'];
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const lockPath = path.join(temporary, 'query-packs/db-analyzer/v1/profiling-provenance-license-lock.json');
    const lock = JSON.parse(await readFile(lockPath, 'utf8'));
    lock.queryArtifacts.find(({ queryId }) => queryId === entry.id).normalizedSqlSha256 = digest;
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
    await assert.rejects(
      () => verifyDbAnalyzerProfilingProvenance({ root: temporary }),
      /DB_PROFILING_QUERY_MANIFEST_INVALID|DB_PROFILING_QUERY_LEAKAGE_DENIED/,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('Slice 2 Gate 7 emits only exact receipt-approved digests in deterministic non-authoritative knowledge packs', async () => {
  const verified = await verifyDbAnalyzerKnowledge({ root: path.resolve('.') });
  assert.equal(verified.status, 'PASS');
  assert.equal(verified.deterministic, true);
  assert.equal(verified.exactReceiptApprovedDigestsOnly, true);
  assert.equal(verified.inventedSemanticClaims, 0);
  assert.equal(verified.externalPublicationAuthority, false);
  assert.equal(verified.directSourceDatabaseAccess, false);
  assert.equal(verified.denialProbeCount, 4);
  assert.deepEqual(verified.engines.map(({ engine }) => engine), ['mssql', 'oracle']);
  assert.ok(verified.engines.every((engine) => engine.approvedCandidateCount === 10
    && engine.emittedEntryCount === 10
    && engine.rejectedCandidateCount === 1
    && engine.rejectedCandidatesEmitted === 0
    && engine.runtimeValidation === 'SYNTHETIC_UNVALIDATED'));
});

test('Slice 2 Gate 7 binds knowledge content to the exact evidence and immutable review receipt', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const profile = path.resolve(`tests/fixtures/db-analyzer/${engine}-profiling-profile-v1.json`);
    const receipt = JSON.parse(await readFile(path.resolve(`tests/fixtures/db-analyzer/${engine}-profiling-review-v1.json`), 'utf8'));
    const evidence = await runAnalyzeProfile(profile);
    const knowledge = buildProfilingKnowledgePack({ evidence, receipt });
    const approved = receipt.decisions
      .filter((decision) => decision.disposition === 'APPROVED')
      .map((decision) => decision.candidateSha256)
      .sort();
    assert.deepEqual(knowledge.entries.map((entry) => entry.candidateSha256), approved);
    assert.equal(knowledge.source.receiptSha256, receipt.receiptSha256);
    assert.equal(knowledge.authority.productionAuthority, false);
    assert.equal(knowledge.claims.semanticTruthEstablished, false);

    const tampered = structuredClone(receipt);
    tampered.evidence.candidateSetSha256 = '0'.repeat(64);
    assert.throws(
      () => buildProfilingKnowledgePack({ evidence, receipt: tampered }),
      /DB_PROFILING_REVIEW_RECEIPT_INVALID|DB_PROFILING_REVIEW_RECEIPT_TAMPERED/,
    );
  }
});

test('Slice 2 Gate 8 emits deterministic disconnected curated Superset results bound to exact knowledge packs', async () => {
  const verified = await verifyDbAnalyzerSupersetResult({ root: path.resolve('.') });
  assert.equal(verified.status, 'PASS');
  assert.equal(verified.deterministic, true);
  assert.equal(verified.exactKnowledgePackBinding, true);
  assert.equal(verified.embeddedDisconnectedDataset, true);
  assert.equal(verified.automaticPublication, false);
  assert.equal(verified.directSourceDatabaseAccess, false);
  assert.equal(verified.denialProbeCount, 4);
  assert.deepEqual(verified.engines.map(({ engine }) => engine), ['mssql', 'oracle']);
  assert.ok(verified.engines.every((engine) => engine.curatedRowCount === 10
    && engine.chartCount === 2
    && engine.runtimeValidation === 'SYNTHETIC_UNVALIDATED'));
});

test('Slice 2 Gate 8 denies knowledge drift and exposes no source database route', async () => {
  for (const engine of ['mssql', 'oracle']) {
    const profile = path.resolve(`tests/fixtures/db-analyzer/${engine}-profiling-profile-v1.json`);
    const receipt = JSON.parse(await readFile(path.resolve(`tests/fixtures/db-analyzer/${engine}-profiling-review-v1.json`), 'utf8'));
    const evidence = await runAnalyzeProfile(profile);
    const knowledgePack = buildProfilingKnowledgePack({ evidence, receipt });
    const result = buildProfilingSupersetResult({ knowledgePack });
    assert.equal(result.source.knowledgePackSha256, knowledgePack.knowledgePackSha256);
    assert.equal(result.dataset.sourceConnection, null);
    assert.equal(result.dataset.sourceSql, null);
    assert.equal(result.dashboard.drillThrough.sourceRoute, null);
    assert.equal(result.authority.automaticPublication, false);
    assert.equal(result.claims.semanticTruthEstablished, false);

    const tampered = structuredClone(knowledgePack);
    tampered.entries[0].signals.push('POST_APPROVAL_MUTATION');
    assert.throws(
      () => buildProfilingSupersetResult({ knowledgePack: tampered }),
      /DB_PROFILING_SUPERSET_SOURCE_TAMPERED/,
    );
  }
});
