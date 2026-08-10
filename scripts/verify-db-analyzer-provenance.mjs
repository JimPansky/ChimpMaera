#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson, normalizeSql } from './lib/db-analyzer/core.mjs';

const LOCK_PATH = 'query-packs/db-analyzer/v1/provenance-license-lock.json';
const SHA256 = /^[a-f0-9]{64}$/;
const SHA512_INTEGRITY = /^sha512-[A-Za-z0-9+/]+={0,2}$/;
const COMMIT = /^[a-f0-9]{40}$/;

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
    'DB_ANALYZER_PROVENANCE_PATH_DENIED',
  );
  return value;
}

function dependencyName(packagePath) {
  const marker = 'node_modules/';
  const offset = packagePath.lastIndexOf(marker);
  const suffix = packagePath.slice(offset + marker.length);
  return suffix.startsWith('@') ? suffix.split('/').slice(0, 2).join('/') : suffix.split('/')[0];
}

function resolveDependency(packages, parentPath, name) {
  let cursor = parentPath;
  while (cursor.startsWith('node_modules/')) {
    const candidate = `${cursor}/node_modules/${name}`;
    if (packages[candidate]) return candidate;
    const boundary = cursor.lastIndexOf('/node_modules/');
    if (boundary < 0) break;
    cursor = cursor.slice(0, boundary);
  }
  const topLevel = `node_modules/${name}`;
  if (packages[topLevel]) return topLevel;
  deny('DB_ANALYZER_RUNTIME_DEPENDENCY_MISSING_DENIED');
}

function dependencyClosure(packages, roots, allowedSpdx) {
  const seen = new Set();
  const visit = (packagePath) => {
    if (seen.has(packagePath)) return;
    const entry = packages[packagePath];
    assert(entry && typeof entry === 'object', 'DB_ANALYZER_RUNTIME_DEPENDENCY_MISSING_DENIED');
    assert(typeof entry.version === 'string' && entry.version.length > 0, 'DB_ANALYZER_RUNTIME_DEPENDENCY_VERSION_DENIED');
    assert(SHA512_INTEGRITY.test(entry.integrity ?? ''), 'DB_ANALYZER_RUNTIME_DEPENDENCY_INTEGRITY_DENIED');
    assert(allowedSpdx.has(entry.license), 'DB_ANALYZER_RUNTIME_DEPENDENCY_LICENSE_DENIED');
    seen.add(packagePath);
    for (const name of Object.keys(entry.dependencies ?? {}).sort()) {
      visit(resolveDependency(packages, packagePath, name));
    }
  };
  for (const root of roots) visit(root.packagePath);
  return [...seen].sort().map((packagePath) => {
    const entry = packages[packagePath];
    return {
      packagePath,
      version: entry.version,
      integrity: entry.integrity,
      spdx: entry.license,
    };
  });
}

export async function verifyDbAnalyzerProvenance({ root = process.cwd() } = {}) {
  const resolvedRoot = await realpath(path.resolve(root));
  const read = async (relative) => readFile(path.join(resolvedRoot, safeRelative(relative)));
  const readJson = async (relative) => JSON.parse((await read(relative)).toString('utf8'));
  const lock = await readJson(LOCK_PATH);

  assert(
    lock.schemaVersion === 'chimpmaera.db/provenance-license-lock/v1'
      && lock.issue === 192
      && lock.slice === 'DB-ANALYZER-S1',
    'DB_ANALYZER_PROVENANCE_LOCK_INVALID_DENIED',
  );
  assert(
    lock.projectArtifactLicense?.spdx === 'Apache-2.0'
      && SHA256.test(lock.projectArtifactLicense.sha256 ?? '')
      && sha256(await read(lock.projectArtifactLicense.path)) === lock.projectArtifactLicense.sha256,
    'DB_ANALYZER_PROJECT_LICENSE_DRIFT_DENIED',
  );
  assert(
    lock.sourcePolicy?.queryAuthorship === 'CHIMPMAERA_PROJECT_AUTHORED'
      && lock.sourcePolicy?.officialDocumentationUse === 'REFERENCE_ONLY'
      && Array.isArray(lock.sourcePolicy?.copiedOrAdaptedSources),
    'DB_ANALYZER_SOURCE_POLICY_INVALID_DENIED',
  );

  const lockedQueries = new Map();
  for (const artifact of lock.queryArtifacts ?? []) {
    assert(
      typeof artifact.queryId === 'string'
        && !lockedQueries.has(artifact.queryId)
        && SHA256.test(artifact.normalizedSqlSha256 ?? '')
        && typeof artifact.officialReferenceUrl === 'string',
      'DB_ANALYZER_QUERY_PROVENANCE_ENTRY_INVALID_DENIED',
    );
    safeRelative(artifact.path);
    lockedQueries.set(artifact.queryId, artifact);
  }

  const observedQueries = [];
  for (const engine of ['mssql', 'oracle']) {
    const manifestPath = `query-packs/db-analyzer/v1/${engine}/manifest.json`;
    const manifest = await readJson(manifestPath);
    assert(manifest.engine === engine && Array.isArray(manifest.queries), 'DB_ANALYZER_QUERY_MANIFEST_INVALID_DENIED');
    const termsUrl = lock.officialReferenceTerms?.[engine];
    assert(
      engine === 'mssql'
        ? termsUrl === 'https://learn.microsoft.com/en-us/legal/termsofuse'
        : termsUrl === 'https://www.oracle.com/legal/terms.html',
      'DB_ANALYZER_REFERENCE_TERMS_INVALID_DENIED',
    );
    for (const query of manifest.queries) {
      const artifact = lockedQueries.get(query.id);
      const expectedPath = `query-packs/db-analyzer/v1/${engine}/${query.file}`;
      assert(artifact?.path === expectedPath, 'DB_ANALYZER_QUERY_PROVENANCE_BINDING_DENIED');
      assert(
        query.provenance?.spdx === 'Apache-2.0'
          && query.provenance?.copiedCode === false
          && /CM-authored/.test(query.provenance?.changeMarker ?? '')
          && /no third-party query code copied/.test(query.provenance?.changeMarker ?? '')
          && query.provenance?.url === artifact.officialReferenceUrl,
        'DB_ANALYZER_QUERY_AUTHORSHIP_DENIED',
      );
      const reference = new URL(artifact.officialReferenceUrl);
      assert(
        (engine === 'mssql' && reference.hostname === 'learn.microsoft.com')
          || (engine === 'oracle' && reference.hostname === 'docs.oracle.com'),
        'DB_ANALYZER_QUERY_REFERENCE_ORIGIN_DENIED',
      );
      const sql = (await read(artifact.path)).toString('utf8');
      assert(sha256(normalizeSql(sql)) === artifact.normalizedSqlSha256, 'DB_ANALYZER_QUERY_DIGEST_DRIFT_DENIED');
      observedQueries.push({
        queryId: query.id,
        normalizedSqlSha256: artifact.normalizedSqlSha256,
        officialReferenceUrl: artifact.officialReferenceUrl,
        referenceTermsUrl: termsUrl,
      });
    }
  }
  assert(observedQueries.length === lockedQueries.size, 'DB_ANALYZER_QUERY_PROVENANCE_COVERAGE_DENIED');

  for (const source of lock.sourcePolicy.copiedOrAdaptedSources) {
    assert(
      typeof source.repository === 'string'
        && COMMIT.test(source.commit ?? '')
        && typeof source.spdx === 'string'
        && typeof source.notice === 'string'
        && typeof source.changeMarker === 'string',
      'DB_ANALYZER_ADAPTED_SOURCE_PIN_DENIED',
    );
  }
  assert(lock.sourcePolicy.copiedOrAdaptedSources.length === 0, 'DB_ANALYZER_UNEXPECTED_ADAPTED_SOURCE_DENIED');

  const sbom = lock.runtimeDependencySbom;
  const packageLockBytes = await read(sbom?.packageLockPath);
  assert(
    SHA256.test(sbom?.packageLockSha256 ?? '')
      && sha256(packageLockBytes) === sbom.packageLockSha256,
    'DB_ANALYZER_PACKAGE_LOCK_DRIFT_DENIED',
  );
  const packageLock = JSON.parse(packageLockBytes.toString('utf8'));
  const packageJson = await readJson('package.json');
  assert(packageLock.lockfileVersion === sbom.lockfileVersion && sbom.lockfileVersion === 3, 'DB_ANALYZER_LOCKFILE_VERSION_DENIED');
  const allowedSpdx = new Set(sbom.allowedSpdx ?? []);
  assert(
    canonicalJson([...allowedSpdx].sort()) === canonicalJson(['0BSD', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'MIT']),
    'DB_ANALYZER_LICENSE_ALLOWLIST_INVALID_DENIED',
  );
  assert(Array.isArray(sbom.roots) && sbom.roots.length === 1, 'DB_ANALYZER_RUNTIME_ROOTS_INVALID_DENIED');
  for (const dependency of sbom.roots) {
    const entry = packageLock.packages?.[dependency.packagePath];
    const name = dependencyName(dependency.packagePath);
    assert(
      dependency.engine === 'mssql'
        && name === 'mssql'
        && packageJson.dependencies?.[name] === dependency.version
        && entry?.version === dependency.version
        && entry?.integrity === dependency.integrity
        && entry?.license === dependency.spdx
        && allowedSpdx.has(dependency.spdx),
      'DB_ANALYZER_RUNTIME_ROOT_DRIFT_DENIED',
    );
    const notice = (await read(dependency.noticePath)).toString('utf8');
    assert(notice.includes(`\`${name}\``) && notice.includes(`| ${dependency.version} |`), 'DB_ANALYZER_RUNTIME_NOTICE_MISSING_DENIED');
  }
  const closure = dependencyClosure(packageLock.packages ?? {}, sbom.roots, allowedSpdx);
  assert(
    closure.length === sbom.closureEntryCount
      && SHA256.test(sbom.closureSha256 ?? '')
      && sha256(canonicalJson(closure)) === sbom.closureSha256,
    'DB_ANALYZER_RUNTIME_SBOM_CLOSURE_DRIFT_DENIED',
  );
  assert(
    /synthetic-only/.test(lock.runtimeBoundaries?.oracle ?? '')
      && /no Oracle runtime capability is claimed/.test(lock.runtimeBoundaries.oracle)
      && /not product dependencies or redistributed assets/.test(lock.runtimeBoundaries?.proprietaryTestInfrastructure ?? ''),
    'DB_ANALYZER_RUNTIME_BOUNDARY_INVALID_DENIED',
  );

  return {
    schemaVersion: 'chimpmaera.db/provenance-license-verification/v1',
    status: 'PASS',
    issue: lock.issue,
    queryArtifactCount: observedQueries.length,
    queryBindingSha256: sha256(canonicalJson(observedQueries)),
    runtimeDependencyRootCount: sbom.roots.length,
    runtimeDependencyClosureCount: closure.length,
    runtimeDependencyClosureSha256: sha256(canonicalJson(closure)),
    runtimeDependencyLicenses: [...new Set(closure.map((entry) => entry.spdx))].sort(),
    copiedOrAdaptedSourceCount: lock.sourcePolicy.copiedOrAdaptedSources.length,
    oracleRuntimeValidation: 'NOT_CLAIMED',
  };
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  verifyDbAnalyzerProvenance()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
