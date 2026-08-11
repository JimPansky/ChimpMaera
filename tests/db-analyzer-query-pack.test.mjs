import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import {
  buildPreflightEvidence,
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
  normalizeSql,
  validateAnalyzeProfile,
  validateProfilingQueryManifest,
  validateQueryManifest,
} from '../scripts/lib/db-analyzer/core.mjs';
import { runAnalyzeProfile } from '../scripts/lib/db-analyzer/workflow.mjs';
import { auditCatalogQuery } from '../scripts/lib/db-analyzer/query-safety.mjs';
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
import { verifyDbAnalyzerProvenance } from '../scripts/verify-db-analyzer-provenance.mjs';
import { verifyDbAnalyzerSafety } from '../scripts/verify-db-analyzer-safety.mjs';

const execFileAsync = promisify(execFile);

const root = path.resolve('query-packs/db-analyzer/v1');
const forbiddenSql = /\b(?:ALTER|CREATE|DELETE|DROP|EXEC(?:UTE)?|GRANT|INSERT|MERGE|REVOKE|TRUNCATE|UPDATE)\b/i;
const executableSql = (sql) => sql.replace(/'(?:''|[^'])*'/g, "''");

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
