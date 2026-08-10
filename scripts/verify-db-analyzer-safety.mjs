#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { buildPreflightEvidence, canonicalJson, sha256 } from './lib/db-analyzer/core.mjs';
import { auditCatalogQuery, auditQueryPackSafety } from './lib/db-analyzer/query-safety.mjs';

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

const observedError = (operation) => {
  try {
    operation();
    return null;
  } catch (error) {
    return error?.code ?? error?.message ?? 'UNKNOWN_ERROR';
  }
};

export async function verifyDbAnalyzerSafety({ root = path.resolve('.') } = {}) {
  const matrix = await readJson(path.join(root, 'verification/db-analyzer/gate-6-adversarial-matrix-v1.json'));
  if (matrix.schemaVersion !== 'chimpmaera.db/gate-6-adversarial-matrix/v1'
    || canonicalJson(matrix.engines) !== canonicalJson(['mssql', 'oracle'])
    || matrix.probes.length !== 6) throw new Error('DB_QUERY_SAFETY_MATRIX_INVALID');

  const results = [];
  const audits = [];
  for (const engine of matrix.engines) {
    const packDirectory = path.join(root, 'query-packs/db-analyzer/v1', engine);
    const manifest = await readJson(path.join(packDirectory, 'manifest.json'));
    const fixture = await readJson(path.join(root, `tests/fixtures/db-analyzer/${engine}-preflight-v1.json`));
    const sqlByQueryId = Object.fromEntries(await Promise.all(manifest.queries.map(async (query) => [query.id, await readFile(path.join(packDirectory, query.file), 'utf8')])));
    audits.push(auditQueryPackSafety({ manifest, sqlByQueryId }));
    const target = manifest.queries.find((query) => query.category === 'schemas');

    for (const probe of matrix.probes) {
      const input = structuredClone(fixture);
      let observed;
      if (probe.id === 'permission-denied') {
        input.results[target.id] = { state: 'DENIED', reasonCode: 'DB_METADATA_PERMISSION_DENIED', rows: [] };
      } else if (probe.id === 'partial-visibility') {
        input.results[target.id] = { state: 'PARTIAL', reasonCode: 'DB_METADATA_VISIBILITY_PARTIAL', rows: input.results[target.id].rows.slice(0, 1) };
      } else if (probe.id === 'timeout') {
        input.results[target.id] = { state: 'TIMEOUT', reasonCode: 'DB_QUERY_TIMEOUT', rows: [] };
      } else if (probe.id === 'result-tamper') {
        input.results[target.id].unexpected = true;
      }

      if (['permission-denied', 'partial-visibility', 'timeout'].includes(probe.id)) {
        const evidence = buildPreflightEvidence({ manifest, sqlByQueryId, resultSets: input });
        const entry = evidence.coverageLedger.entries.find(({ queryId }) => queryId === target.id);
        observed = { state: entry.state, visibility: entry.visibility, emptyInterpretation: entry.emptyInterpretation };
      } else if (probe.id === 'result-tamper') {
        observed = { error: observedError(() => buildPreflightEvidence({ manifest, sqlByQueryId, resultSets: input })) };
      } else if (probe.id === 'sql-mutation-tamper') {
        observed = { error: observedError(() => auditCatalogQuery({ engine, queryId: target.id, sql: `${sqlByQueryId[target.id]}\nDELETE FROM customer_data;` })) };
      } else if (probe.id === 'row-sample-tamper') {
        const sampleSource = engine === 'mssql' ? 'dbo.customers' : 'APP.CUSTOMERS';
        observed = { error: observedError(() => auditCatalogQuery({ engine, queryId: target.id, sql: `SELECT customer_id FROM ${sampleSource};` })) };
      }

      const expected = probe.expectedError
        ? { error: probe.expectedError }
        : { state: probe.expectedState, visibility: probe.expectedVisibility, emptyInterpretation: probe.expectedEmpty };
      if (canonicalJson(observed) !== canonicalJson(expected)) throw new Error(`DB_QUERY_SAFETY_PROBE_FAILED:${engine}:${probe.id}`);
      results.push({ engine, probeId: probe.id, status: 'PASS', observed });
    }
  }

  const body = {
    schemaVersion: 'chimpmaera.db/gate-6-safety-evidence/v1',
    matrixSha256: sha256(matrix),
    engines: matrix.engines,
    staticAudit: {
      queryCount: audits.reduce((total, audit) => total + audit.queryCount, 0),
      zeroMutatingStatements: audits.every((audit) => audit.zeroMutatingStatements),
      zeroRowSamples: audits.every((audit) => audit.zeroRowSamples),
    },
    probeCount: results.length,
    passed: results.filter(({ status }) => status === 'PASS').length,
    failed: results.filter(({ status }) => status !== 'PASS').length,
    results,
  };
  return { ...body, evidenceSha256: sha256(body) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(canonicalJson(await verifyDbAnalyzerSafety()));
}
