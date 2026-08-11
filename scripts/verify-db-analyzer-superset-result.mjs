#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildProfilingKnowledgePack,
  buildProfilingSupersetResult,
  canonicalJson,
  identitySha256,
} from './lib/db-analyzer/core.mjs';
import { runAnalyzeProfile } from './lib/db-analyzer/workflow.mjs';

const deny = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};

const expectedDenial = (run) => {
  try {
    run();
  } catch (error) {
    if (/^DB_PROFILING_SUPERSET_/.test(error?.code ?? error?.message ?? '')) return;
    throw error;
  }
  deny('DB_PROFILING_SUPERSET_EXPECTED_DENIAL');
};

export async function verifyDbAnalyzerSupersetResult(options = {}) {
  const root = path.resolve(options.root ?? '.');
  const engines = [];
  let denialProbeCount = 0;
  for (const engine of ['mssql', 'oracle']) {
    const profile = path.join(root, `tests/fixtures/db-analyzer/${engine}-profiling-profile-v1.json`);
    const receipt = JSON.parse(await readFile(path.join(root, `tests/fixtures/db-analyzer/${engine}-profiling-review-v1.json`), 'utf8'));
    const evidence = await runAnalyzeProfile(profile, { repositoryRoot: root });
    const knowledgePack = buildProfilingKnowledgePack({ evidence, receipt });
    const first = buildProfilingSupersetResult({ knowledgePack });
    const second = buildProfilingSupersetResult({ knowledgePack });
    const { supersetResultSha256, ...resultBody } = first;
    if (canonicalJson(first) !== canonicalJson(second)
      || identitySha256(resultBody) !== supersetResultSha256
      || first.source.knowledgePackSha256 !== knowledgePack.knowledgePackSha256
      || first.dataset.rows.map(({ candidateSha256 }) => candidateSha256).join(',')
        !== knowledgePack.entries.map(({ candidateSha256 }) => candidateSha256).join(',')
      || first.dataset.sourceConnection !== null
      || first.dataset.sourceSql !== null
      || first.dashboard.drillThrough.sourceRoute !== null
      || first.authority.automaticPublication !== false
      || first.authority.directSourceDatabaseAccess !== false
      || first.claims.supersetRuntimeValidated !== false
      || /sampleValue|sample_value|password|credential/i.test(canonicalJson(first))) {
      deny('DB_PROFILING_SUPERSET_RESULT_INVALID');
    }

    const tamperedKnowledge = structuredClone(knowledgePack);
    tamperedKnowledge.entries[0].metrics.nullCount += 1;
    expectedDenial(() => buildProfilingSupersetResult({ knowledgePack: tamperedKnowledge }));
    denialProbeCount += 1;

    const inventedKnowledge = structuredClone(knowledgePack);
    inventedKnowledge.entries[0].semanticClaim = 'BUSINESS_TRUTH';
    const { knowledgePackSha256: ignored, ...inventedBody } = inventedKnowledge;
    inventedKnowledge.knowledgePackSha256 = identitySha256(inventedBody);
    expectedDenial(() => buildProfilingSupersetResult({ knowledgePack: inventedKnowledge }));
    denialProbeCount += 1;

    engines.push({
      engine,
      knowledgePackSha256: knowledgePack.knowledgePackSha256,
      supersetResultSha256,
      curatedRowCount: first.dataset.rowCount,
      chartCount: first.dashboard.charts.length,
      runtimeValidation: first.source.runtimeValidation,
    });
  }
  const body = {
    schemaVersion: 'chimpmaera.db/gate-8-superset-result-verification/v1',
    status: 'PASS',
    deterministic: true,
    exactKnowledgePackBinding: true,
    embeddedDisconnectedDataset: true,
    automaticPublication: false,
    directSourceDatabaseAccess: false,
    denialProbeCount,
    engines,
  };
  return { ...body, evidenceSha256: identitySha256(body) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyDbAnalyzerSupersetResult().then((evidence) => process.stdout.write(canonicalJson(evidence))).catch((error) => {
    process.stderr.write(`${error.code ?? error.message}\n`);
    process.exitCode = 1;
  });
}
