#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPreflightEvidence, canonicalJson, sha256, validateAnalyzeProfile } from './lib/db-analyzer/core.mjs';
import { compareStructuralEvidence } from './lib/db-analyzer/drift.mjs';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASE_SCHEMA = 'chimpmaera.db/synthetic-drift-case/v1';

const fail = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const locateRow = (rows, key) => rows.findIndex((row) => Object.entries(key).every(([field, value]) => canonicalJson(row[field]) === canonicalJson(value)));

function applyCase(baseline, driftCase) {
  if (driftCase.schemaVersion !== CASE_SCHEMA || driftCase.engine !== baseline.engine || !Array.isArray(driftCase.mutations)) {
    fail('DB_DRIFT_CASE_INVALID');
  }
  const current = structuredClone(baseline);
  current.observedAt = driftCase.observedAt;
  for (const mutation of driftCase.mutations) {
    const result = current.results[mutation.queryId];
    if (!result || result.state !== 'SUCCEEDED') fail('DB_DRIFT_CASE_QUERY_INVALID');
    if (mutation.operation === 'ADD_ROW') {
      if (locateRow(result.rows, mutation.key) !== -1) fail('DB_DRIFT_CASE_ADD_COLLISION');
      result.rows.push(mutation.row);
      continue;
    }
    const index = locateRow(result.rows, mutation.key);
    if (index === -1) fail('DB_DRIFT_CASE_TARGET_MISSING');
    if (mutation.operation === 'REMOVE_ROW') {
      result.rows.splice(index, 1);
    } else if (mutation.operation === 'CHANGE_FIELD') {
      if (canonicalJson(result.rows[index][mutation.field]) !== canonicalJson(mutation.before)) fail('DB_DRIFT_CASE_BEFORE_MISMATCH');
      result.rows[index][mutation.field] = mutation.after;
    } else fail('DB_DRIFT_CASE_OPERATION_INVALID');
  }
  for (const result of Object.values(current.results)) result.rows?.reverse();
  return current;
}

const projection = (entry) => ({ queryId: entry.queryId, key: entry.key });

export async function verifyDbAnalyzerDrift({ root = DEFAULT_ROOT } = {}) {
  const results = [];
  for (const engine of ['mssql', 'oracle']) {
    const packDirectory = path.join(root, 'query-packs/db-analyzer/v1', engine);
    const manifest = await readJson(path.join(packDirectory, 'manifest.json'));
    const sqlByQueryId = Object.fromEntries(await Promise.all(manifest.queries.map(async (query) => [
      query.id,
      await readFile(path.join(packDirectory, query.file), 'utf8'),
    ])));
    const baselineFixture = await readJson(path.join(root, `tests/fixtures/db-analyzer/${engine}-preflight-v1.json`));
    const profile = validateAnalyzeProfile(await readJson(path.join(root, `tests/fixtures/db-analyzer/${engine}-profile-v1.json`)));
    const driftCase = await readJson(path.join(root, `tests/fixtures/db-analyzer/${engine}-drift-b-v1.json`));
    const context = {
      profileId: profile.profileId,
      mode: profile.mode,
      scope: profile.scope,
      policy: profile.policy,
      adapter: profile.adapter.kind,
    };
    const baseline = buildPreflightEvidence({ manifest, sqlByQueryId, resultSets: baselineFixture, profileContext: context });
    const replayFixture = structuredClone(baselineFixture);
    replayFixture.observedAt = driftCase.observedAt;
    for (const result of Object.values(replayFixture.results)) result.rows?.reverse();
    const replay = buildPreflightEvidence({ manifest, sqlByQueryId, resultSets: replayFixture, profileContext: context });
    const unchanged = compareStructuralEvidence({ manifest, baseline, current: replay });
    if (unchanged.status !== 'UNCHANGED' || unchanged.baselineSnapshotSha256 !== unchanged.currentSnapshotSha256
      || unchanged.accounting.zeroUnexplainedChanges !== true) fail('DB_DRIFT_DOUBLE_SCAN_INVALID');

    const current = buildPreflightEvidence({ manifest, sqlByQueryId, resultSets: applyCase(baselineFixture, driftCase), profileContext: context });
    const drift = compareStructuralEvidence({ manifest, baseline, current });
    const actual = {
      status: drift.status,
      summary: drift.summary,
      added: drift.added.map(projection),
      removed: drift.removed.map(projection),
      changed: drift.changed.map(projection),
      zeroUnexplainedChanges: drift.accounting.zeroUnexplainedChanges,
    };
    if (canonicalJson(actual) !== canonicalJson(driftCase.expected)) fail('DB_DRIFT_EXPECTATION_MISMATCH');
    results.push({
      engine,
      unchangedSnapshotSha256: baseline.snapshotSha256,
      unchangedDriftSha256: unchanged.driftSha256,
      changedSnapshotSha256: current.snapshotSha256,
      changedDriftSha256: drift.driftSha256,
      structuralObjectCount: drift.accounting.baselineObjects,
      summary: drift.summary,
      zeroUnexplainedChanges: drift.accounting.zeroUnexplainedChanges,
    });
  }
  const body = {
    schemaVersion: 'chimpmaera.verification/db-analyzer-gate-7/v1',
    status: 'PASS',
    engines: results,
    exactExpectedChanges: results.every(({ summary }) => summary.added === 1 && summary.removed === 1 && summary.changed === 1),
    zeroUnexplainedChanges: results.every((result) => result.zeroUnexplainedChanges),
  };
  return { ...body, evidenceSha256: sha256(body) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyDbAnalyzerDrift().then((evidence) => process.stdout.write(canonicalJson(evidence))).catch((error) => {
    process.stderr.write(`${error.code ?? error.message}\n`);
    process.exitCode = 1;
  });
}
