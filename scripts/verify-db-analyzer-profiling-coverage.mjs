#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildAggregateProfilingEvidence,
  buildProfilingCoverageLedger,
  canonicalJson,
  identitySha256,
  validateAnalyzeProfile,
} from './lib/db-analyzer/core.mjs';
import { runAnalyzeProfile } from './lib/db-analyzer/workflow.mjs';

const deny = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};

const expectedDenial = (run, code) => {
  try {
    run();
  } catch (error) {
    if (error?.code === code || error?.message === code) return true;
    throw error;
  }
  deny(`EXPECTED_${code}`);
};

const targetKey = (value) => `${value.schemaName}\u0000${value.relationName}\u0000${value.columnName}`;

async function loadProfilingPack(root, engine) {
  const directory = path.join(root, 'query-packs/db-analyzer/v1', engine);
  const manifest = JSON.parse(await readFile(path.join(directory, 'profiling-manifest.json'), 'utf8'));
  const sqlByQueryId = Object.fromEntries(await Promise.all(manifest.queries.map(async (query) => [
    query.id,
    await readFile(path.join(directory, query.file), 'utf8'),
  ])));
  return { manifest, sqlByQueryId };
}

export async function verifyDbAnalyzerProfilingCoverage({ root = path.resolve('.') } = {}) {
  const engines = [];
  let denialProbeCount = 0;
  for (const engine of ['mssql', 'oracle']) {
    const profilePath = path.join(root, `tests/fixtures/db-analyzer/${engine}-profiling-profile-v1.json`);
    const fixturePath = path.join(root, `tests/fixtures/db-analyzer/${engine}-aggregate-results-v1.json`);
    const profile = validateAnalyzeProfile(JSON.parse(await readFile(profilePath, 'utf8')));
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
    const { manifest, sqlByQueryId } = await loadProfilingPack(root, engine);
    const first = await runAnalyzeProfile(profilePath, { repositoryRoot: root });
    const second = await runAnalyzeProfile(profilePath, { repositoryRoot: root });
    if (canonicalJson(first) !== canonicalJson(second)) deny('DB_PROFILING_COVERAGE_NOT_DETERMINISTIC');
    if (first.profiling.coverage.publicationState !== 'REVIEW_REQUIRED'
      || first.profiling.coverage.stateCounts.SUCCEEDED !== first.profiling.factCount
      || first.profiling.coverage.entries.some((entry) => entry.reviewState !== 'REVIEW_REQUIRED')) {
      deny('DB_PROFILING_COVERAGE_BINDING_INVALID');
    }

    const facts = new Map(first.profiling.facts.map((fact) => [targetKey(fact), fact]));
    const columns = profile.policy.profiling.scope.flatMap((scope) => scope.columns.map((columnName) => ({
      schemaName: scope.schemaName,
      relationName: scope.relationName,
      columnName,
    })));
    const states = ['SUCCEEDED', 'PARTIAL', 'DENIED', 'UNSUPPORTED', 'TIMEOUT', 'TAMPER'];
    const reasons = [null, 'DB_PROFILE_PARTIAL_VISIBILITY', 'DB_PROFILE_PERMISSION_DENIED', 'DB_PROFILE_TYPE_UNSUPPORTED', 'DB_PROFILE_TIMEOUT', 'DB_PROFILE_RESULT_TAMPERED'];
    const attempts = columns.map((target, index) => {
      const fact = facts.get(targetKey(target));
      const visible = index < 2;
      return {
        ...target,
        typeFamily: fact.typeFamily,
        state: states[index],
        reasonCode: reasons[index],
        factSha256: visible ? fact.objectSha256 : null,
      };
    });
    const negativeLedger = buildProfilingCoverageLedger({ profile, attempts });
    if (states.some((state) => negativeLedger.stateCounts[state] !== 1)
      || negativeLedger.publicationState !== 'REVIEW_REQUIRED'
      || negativeLedger.nonClaimedAttempts !== 5) deny('DB_PROFILING_NEGATIVE_STATE_MATRIX_INVALID');

    const tampered = structuredClone(attempts);
    tampered[0].payload = 'must-not-survive';
    expectedDenial(() => buildProfilingCoverageLedger({ profile, attempts: tampered }), 'DB_PROFILING_COVERAGE_TAMPERED');
    denialProbeCount += 1;
    const crossScope = structuredClone(attempts);
    crossScope[0].schemaName = 'outside_scope';
    expectedDenial(() => buildProfilingCoverageLedger({ profile, attempts: crossScope }), 'DB_PROFILING_COVERAGE_SCOPE_INVALID');
    denialProbeCount += 1;

    const build = (inputProfile, resultSets) => buildAggregateProfilingEvidence({
      profile: inputProfile,
      resultSets,
      profilingManifest: manifest,
      profilingSqlByQueryId: sqlByQueryId,
    });
    const sensitiveProfile = structuredClone(profile);
    sensitiveProfile.policy.profiling.disclosure.sensitiveTargets.push({ ...columns[0], classification: 'SENSITIVE' });
    expectedDenial(() => build(sensitiveProfile, fixture), 'DB_PROFILING_SENSITIVE_TARGET_DENIED');
    denialProbeCount += 1;
    const distribution = structuredClone(fixture);
    distribution.facts[0].distribution = [{ label: 'must-not-survive', count: 1 }];
    expectedDenial(() => build(profile, distribution), 'DB_PROFILING_DISTRIBUTION_DENIED');
    denialProbeCount += 1;

    engines.push({
      engine,
      workflowCoverageSha256: first.profiling.coverage.coverageSha256,
      negativeCoverageSha256: negativeLedger.coverageSha256,
      stateCounts: negativeLedger.stateCounts,
      publicationState: negativeLedger.publicationState,
      deniedDisclosureProbes: 4,
    });
  }
  const body = {
    schemaVersion: 'chimpmaera.db/gate-5-profiling-coverage-verification/v1',
    status: 'PASS',
    deterministic: true,
    statesPreserved: ['PARTIAL', 'DENIED', 'UNSUPPORTED', 'TIMEOUT', 'TAMPER', 'REVIEW_REQUIRED'],
    unsafeMaterialRetained: false,
    denialProbeCount,
    engines,
  };
  return { ...body, evidenceSha256: identitySha256(body) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.stdout.write(canonicalJson(await verifyDbAnalyzerProfilingCoverage()));
}
