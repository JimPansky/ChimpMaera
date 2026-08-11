#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson, normalizeSql, validateProfilingQueryManifest } from './lib/db-analyzer/core.mjs';
import { verifyDbAnalyzerProvenance } from './verify-db-analyzer-provenance.mjs';

const LOCK_PATH = 'query-packs/db-analyzer/v1/profiling-provenance-license-lock.json';
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const FORBIDDEN_SQL = /\b(?:ALTER|CREATE|DELETE|DROP|EXEC(?:UTE)?|GRANT|INSERT|INTO|MERGE|REVOKE|TRUNCATE|UNION|UPDATE)\b/i;
const SENSITIVE = /\b(?:credential|password|secret|token|connection[_ -]?string|sample[_ -]?(?:row|value)|label[_ -]?distribution)\b/i;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const deny = (code) => { throw new Error(code); };
const assert = (condition, code) => { if (!condition) deny(code); };

function safeRelative(value) {
  assert(
    typeof value === 'string'
      && value.length > 0
      && !path.isAbsolute(value)
      && !value.includes('\\')
      && value === value.normalize('NFC')
      && !value.split('/').some((part) => ['', '.', '..'].includes(part)),
    'DB_PROFILING_PROVENANCE_PATH_DENIED',
  );
  return value;
}

function auditTemplate(sql, query) {
  const normalized = normalizeSql(sql);
  const statement = normalized.trim();
  const placeholders = [...statement.matchAll(/\{\{([A-Z]+)\}\}/g)].map((match) => match[1]);
  const aliases = [...statement.matchAll(/\bAS\s+(?:\[([^\]]+)\]|"([^"]+)")/gi)]
    .map((match) => match[1] ?? match[2]);
  assert(/^SELECT\b/i.test(statement), 'DB_PROFILING_QUERY_NOT_SELECT_DENIED');
  assert((statement.match(/;/g) ?? []).length === 1 && statement.endsWith(';'), 'DB_PROFILING_QUERY_MULTI_STATEMENT_DENIED');
  assert(!/(?:--|\/\*)/.test(statement), 'DB_PROFILING_QUERY_COMMENT_DENIED');
  assert(!FORBIDDEN_SQL.test(statement), 'DB_PROFILING_QUERY_MUTATION_DENIED');
  assert(!SENSITIVE.test(statement), 'DB_PROFILING_QUERY_LEAKAGE_DENIED');
  assert(canonicalJson([...new Set(placeholders)].sort()) === canonicalJson(['COLUMN', 'RELATION', 'SCHEMA']), 'DB_PROFILING_QUERY_PLACEHOLDER_DENIED');
  assert(/\bFROM\s+\{\{SCHEMA\}\}\.\{\{RELATION\}\};$/i.test(statement), 'DB_PROFILING_QUERY_SOURCE_DENIED');
  assert(canonicalJson(aliases) === canonicalJson(query.outputColumns), 'DB_PROFILING_QUERY_OUTPUT_DRIFT_DENIED');
  assert(query.readOnly === true && query.aggregateOnly === true && query.rowSamples === false && query.labelDistributions === false, 'DB_PROFILING_QUERY_DISCLOSURE_DENIED');
  return { normalizedSqlSha256: sha256(normalized), outputColumns: aliases };
}

export async function verifyDbAnalyzerProfilingProvenance({ root = process.cwd() } = {}) {
  const resolvedRoot = await realpath(path.resolve(root));
  const read = async (relative) => readFile(path.join(resolvedRoot, safeRelative(relative)));
  const readJson = async (relative) => JSON.parse((await read(relative)).toString('utf8'));
  const lock = await readJson(LOCK_PATH);

  assert(
    lock.schemaVersion === 'chimpmaera.db/profiling-provenance-license-lock/v1'
      && lock.issue === 194
      && lock.slice === 'DB-ANALYZER-S2',
    'DB_PROFILING_PROVENANCE_LOCK_INVALID_DENIED',
  );
  assert(
    lock.projectArtifactLicense?.spdx === 'Apache-2.0'
      && SHA256.test(lock.projectArtifactLicense.sha256 ?? '')
      && sha256(await read(lock.projectArtifactLicense.path)) === lock.projectArtifactLicense.sha256,
    'DB_PROFILING_PROJECT_LICENSE_DRIFT_DENIED',
  );
  assert(
    lock.sourcePolicy?.queryAuthorship === 'CHIMPMAERA_PROJECT_AUTHORED'
      && lock.sourcePolicy?.officialDocumentationUse === 'REFERENCE_ONLY'
      && Array.isArray(lock.sourcePolicy?.copiedOrAdaptedSources),
    'DB_PROFILING_SOURCE_POLICY_INVALID_DENIED',
  );
  for (const source of lock.sourcePolicy.copiedOrAdaptedSources) {
    assert(
      typeof source.repository === 'string'
        && COMMIT.test(source.commit ?? '')
        && typeof source.spdx === 'string'
        && typeof source.notice === 'string'
        && typeof source.changeMarker === 'string',
      'DB_PROFILING_ADAPTED_SOURCE_PIN_DENIED',
    );
  }
  assert(lock.sourcePolicy.copiedOrAdaptedSources.length === 0, 'DB_PROFILING_UNEXPECTED_ADAPTED_SOURCE_DENIED');

  const lockedQueries = new Map();
  for (const artifact of lock.queryArtifacts ?? []) {
    assert(
      typeof artifact.queryId === 'string'
        && !lockedQueries.has(artifact.queryId)
        && SHA256.test(artifact.normalizedSqlSha256 ?? '')
        && typeof artifact.officialReferenceUrl === 'string',
      'DB_PROFILING_QUERY_PROVENANCE_ENTRY_INVALID_DENIED',
    );
    safeRelative(artifact.path);
    lockedQueries.set(artifact.queryId, artifact);
  }

  const observedQueries = [];
  for (const engine of ['mssql', 'oracle']) {
    const directory = `query-packs/db-analyzer/v1/${engine}`;
    const manifest = await readJson(`${directory}/profiling-manifest.json`);
    const sqlByQueryId = Object.fromEntries(await Promise.all(manifest.queries.map(async (query) => [query.id, (await read(`${directory}/${query.file}`)).toString('utf8')])));
    validateProfilingQueryManifest(manifest, sqlByQueryId);
    assert(manifest.engine === engine && manifest.queries.length === 5, 'DB_PROFILING_QUERY_MANIFEST_INVALID_DENIED');
    const termsUrl = lock.officialReferenceTerms?.[engine];
    assert(
      engine === 'mssql'
        ? termsUrl === 'https://learn.microsoft.com/en-us/legal/termsofuse'
        : termsUrl === 'https://www.oracle.com/legal/terms.html',
      'DB_PROFILING_REFERENCE_TERMS_INVALID_DENIED',
    );
    for (const query of manifest.queries) {
      const artifact = lockedQueries.get(query.id);
      const expectedPath = `${directory}/${query.file}`;
      assert(artifact?.path === expectedPath, 'DB_PROFILING_QUERY_PROVENANCE_BINDING_DENIED');
      assert(
        query.provenance?.spdx === 'Apache-2.0'
          && query.provenance?.copiedCode === false
          && /CM-authored/.test(query.provenance?.changeMarker ?? '')
          && /no third-party query code copied/.test(query.provenance?.changeMarker ?? '')
          && query.provenance?.url === artifact.officialReferenceUrl,
        'DB_PROFILING_QUERY_AUTHORSHIP_DENIED',
      );
      const reference = new URL(artifact.officialReferenceUrl);
      assert(
        (engine === 'mssql' && reference.hostname === 'learn.microsoft.com')
          || (engine === 'oracle' && reference.hostname === 'docs.oracle.com'),
        'DB_PROFILING_QUERY_REFERENCE_ORIGIN_DENIED',
      );
      const audit = auditTemplate(sqlByQueryId[query.id], query);
      assert(audit.normalizedSqlSha256 === artifact.normalizedSqlSha256 && query.templateSha256 === artifact.normalizedSqlSha256, 'DB_PROFILING_QUERY_DIGEST_DRIFT_DENIED');
      observedQueries.push({
        queryId: query.id,
        normalizedSqlSha256: audit.normalizedSqlSha256,
        officialReferenceUrl: artifact.officialReferenceUrl,
        referenceTermsUrl: termsUrl,
        outputColumns: audit.outputColumns,
      });
    }
  }
  assert(observedQueries.length === 10 && observedQueries.length === lockedQueries.size, 'DB_PROFILING_QUERY_PROVENANCE_COVERAGE_DENIED');

  const dependency = lock.dependencyEvidence;
  assert(
    SHA256.test(dependency?.baseLockSha256 ?? '')
      && sha256(await read(dependency.baseLockPath)) === dependency.baseLockSha256
      && Array.isArray(dependency.newRequiredRuntimeDependencies)
      && dependency.newRequiredRuntimeDependencies.length === 0,
    'DB_PROFILING_DEPENDENCY_EVIDENCE_DRIFT_DENIED',
  );
  const base = await verifyDbAnalyzerProvenance({ root: resolvedRoot });
  assert(
    base.status === 'PASS'
      && base.queryBindingSha256 === dependency.queryBindingSha256
      && base.runtimeDependencyRootCount === dependency.runtimeDependencyRootCount
      && base.runtimeDependencyClosureCount === dependency.runtimeDependencyClosureCount
      && base.runtimeDependencyClosureSha256 === dependency.runtimeDependencyClosureSha256
      && canonicalJson(base.runtimeDependencyLicenses) === canonicalJson(dependency.runtimeDependencyLicenses),
    'DB_PROFILING_DEPENDENCY_EVIDENCE_DRIFT_DENIED',
  );
  assert(
    /denied for Slice 2/.test(lock.runtimeBoundaries?.profiling ?? '')
      && /No Oracle runtime capability/.test(lock.runtimeBoundaries?.oracle ?? '')
      && /No credentials, connection strings, row samples or label distributions/.test(lock.runtimeBoundaries?.disclosure ?? ''),
    'DB_PROFILING_RUNTIME_BOUNDARY_INVALID_DENIED',
  );

  return {
    schemaVersion: 'chimpmaera.db/profiling-provenance-license-verification/v1',
    status: 'PASS',
    issue: lock.issue,
    queryArtifactCount: observedQueries.length,
    staticSelectOnlyCount: observedQueries.length,
    queryBindingSha256: sha256(canonicalJson(observedQueries)),
    copiedOrAdaptedSourceCount: lock.sourcePolicy.copiedOrAdaptedSources.length,
    newRequiredRuntimeDependencyCount: dependency.newRequiredRuntimeDependencies.length,
    runtimeDependencyClosureCount: base.runtimeDependencyClosureCount,
    runtimeDependencyClosureSha256: base.runtimeDependencyClosureSha256,
    runtimeDependencyLicenses: base.runtimeDependencyLicenses,
    runtimeValidation: 'NOT_AUTHORIZED',
  };
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  verifyDbAnalyzerProfilingProvenance()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
