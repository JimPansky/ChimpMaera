import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildAggregateProfilingEvidence,
  buildPreflightEvidence,
  canonicalJson,
  validateAnalyzeProfile,
  validateProfilingQueryManifest,
  validateQueryManifest,
} from './core.mjs';
import { auditQueryPackSafety } from './query-safety.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const fail = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

async function runMssqlQueries({ profile, manifest, entries }) {
  const password = process.env[profile.adapter.passwordEnv];
  if (!password) fail('DB_ANALYZE_CREDENTIAL_MISSING');
  const { default: sql } = await import('mssql');
  const pool = await sql.connect({
    server: profile.adapter.host,
    port: profile.adapter.port,
    user: profile.adapter.user,
    password,
    database: profile.scope.database,
    connectionTimeout: profile.policy.maxQueryTimeoutMs,
    requestTimeout: profile.policy.maxQueryTimeoutMs,
    options: {
      encrypt: profile.adapter.encrypt,
      trustServerCertificate: profile.adapter.trustServerCertificate,
      readOnlyIntent: true,
      enableArithAbort: true,
    },
  });
  try {
    const results = {};
    for (const query of manifest.queries) {
      const statement = entries.find(([id]) => id === query.id)?.[1];
      if (typeof statement !== 'string' || !/^\s*SELECT\b/i.test(statement)) fail('DB_ANALYZE_PACK_POLICY_DENIED');
      try {
        const response = await pool.request().query(statement);
        results[query.id] = { state: 'SUCCEEDED', reasonCode: null, rows: response.recordset };
      } catch (error) {
        results[query.id] = {
          state: error?.code === 'ETIMEOUT' ? 'TIMEOUT' : error?.number === 229 ? 'DENIED' : 'ERROR',
          reasonCode: error?.code ?? `MSSQL_${error?.number ?? 'QUERY_FAILED'}`,
          rows: [],
        };
      }
    }
    return { schemaVersion: 'chimpmaera.db/runtime-query-results/v1', engine: 'mssql', runtimeValidated: true, results };
  } finally {
    await pool.close();
  }
}

function assertScope(profile, evidence) {
  const identity = evidence.extracts.find((entry) => entry.queryId === `${profile.engine}.preflight.identity`);
  if (identity?.state !== 'SUCCEEDED' || identity.rows.length === 0) fail('DB_ANALYZE_SCOPE_UNVERIFIED');
  for (const row of identity.rows) {
    if (row.engine !== profile.engine || typeof row.engine_version !== 'string' || row.engine_version.length === 0
      || row.database_name !== profile.scope.database) fail('DB_ANALYZE_SCOPE_MISMATCH');
    if (profile.scope.container !== null && row.container_name !== profile.scope.container) fail('DB_ANALYZE_SCOPE_MISMATCH');
  }
}

export async function runAnalyzeProfile(profileFile, options = {}) {
  if (options.signal !== undefined && typeof options.signal?.aborted !== 'boolean') fail('DB_ANALYZE_CANCELLATION_INVALID');
  const assertActive = () => {
    if (options.signal?.aborted) fail('DB_ANALYZE_CANCELLED');
  };
  assertActive();
  const repositoryRoot = path.resolve(options.repositoryRoot ?? REPOSITORY_ROOT);
  const resolvedProfile = path.resolve(profileFile);
  const profile = validateAnalyzeProfile(await readJson(resolvedProfile));
  assertActive();
  if (profile.mode === 'RUNTIME' && profile.policy.profiling !== undefined) fail('DB_PROFILING_RUNTIME_NOT_AUTHORIZED');
  const packDirectory = path.join(repositoryRoot, 'query-packs', 'db-analyzer', profile.queryPack.version, profile.engine);
  const manifest = validateQueryManifest(await readJson(path.join(packDirectory, 'manifest.json')));
  if (manifest.engine !== profile.engine || manifest.queries.some((query) => query.timeoutMs > profile.policy.maxQueryTimeoutMs)) fail('DB_ANALYZE_PACK_POLICY_DENIED');

  const entries = await Promise.all(manifest.queries.map(async (query) => [query.id, await readFile(path.join(packDirectory, query.file), 'utf8')]));
  auditQueryPackSafety({ manifest, sqlByQueryId: Object.fromEntries(entries) });
  const resultSets = profile.mode === 'SYNTHETIC'
    ? await readJson(path.join(path.dirname(resolvedProfile), profile.adapter.fixture))
    : await runMssqlQueries({ profile, manifest, entries });
  assertActive();
  let profilingEvidence;
  if (profile.policy.profiling !== undefined) {
    const profilingManifest = validateProfilingQueryManifest(await readJson(path.join(packDirectory, 'profiling-manifest.json')));
    const profilingEntries = await Promise.all(profilingManifest.queries
      .map(async (query) => [query.id, await readFile(path.join(packDirectory, query.file), 'utf8')]));
    const profilingSqlByQueryId = Object.fromEntries(profilingEntries);
    validateProfilingQueryManifest(profilingManifest, profilingSqlByQueryId);
    profilingEvidence = buildAggregateProfilingEvidence({
      profile,
      profilingManifest,
      profilingSqlByQueryId,
      resultSets: await readJson(path.join(path.dirname(resolvedProfile), profile.policy.profiling.aggregateFixture)),
    });
  }
  assertActive();
  const evidence = buildPreflightEvidence({
    manifest,
    sqlByQueryId: Object.fromEntries(entries),
    resultSets,
    profilingEvidence,
    profileContext: {
      profileId: profile.profileId,
      mode: profile.mode,
      scope: profile.scope,
      policy: profile.policy,
      adapter: profile.adapter.kind,
    },
  });
  assertScope(profile, evidence);
  return evidence;
}

export const renderAnalyzeEvidence = (evidence) => canonicalJson(evidence);
