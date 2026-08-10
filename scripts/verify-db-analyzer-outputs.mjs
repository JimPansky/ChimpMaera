#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { canonicalJson, sha256 } from './lib/db-analyzer/core.mjs';
import { buildStructureMapOutputs } from './lib/db-analyzer/outputs.mjs';
import { runAnalyzeProfile } from './lib/db-analyzer/workflow.mjs';

async function load(root, engine) {
  const directory = path.join(root, 'query-packs', 'db-analyzer', 'v1', engine);
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const sqlByQueryId = Object.fromEntries(await Promise.all(manifest.queries.map(async (query) => [query.id, await readFile(path.join(directory, query.file), 'utf8')])));
  const profile = path.join(root, 'tests', 'fixtures', 'db-analyzer', `${engine}-profile-v1.json`);
  const evidence = await runAnalyzeProfile(profile, { repositoryRoot: root });
  return { evidence, manifest, sqlByQueryId };
}

export async function verifyDbAnalyzerOutputs(options = {}) {
  const root = path.resolve(options.root ?? '.');
  const engines = [];
  for (const engine of ['mssql', 'oracle']) {
    const input = await load(root, engine);
    const first = buildStructureMapOutputs(input);
    const second = buildStructureMapOutputs(input);
    if (canonicalJson(first.outputManifest) !== canonicalJson(second.outputManifest) || first.html !== second.html) throw new Error('DB_OUTPUT_NOT_DETERMINISTIC');
    for (const projection of Object.values(first.projections)) {
      if (projection.source.directSourceDatabaseConnection !== false || projection.readOnly !== true
        || projection.source.snapshotSha256 !== input.evidence.snapshotSha256) throw new Error('DB_OUTPUT_SOURCE_BOUNDARY_INVALID');
      if (projection.rows.some((row) => Object.keys(row).some((key) => /sample|password|credential/i.test(key)))) throw new Error('DB_OUTPUT_FORBIDDEN_FIELD');
    }
    if (first.outputManifest.queryBindings.length !== input.manifest.queries.length
      || first.projections.inventory.rows.length === 0
      || first.projections.relationships.rows.length === 0
      || first.projections.coverage.rows.length !== input.manifest.queries.length) throw new Error('DB_OUTPUT_ACCEPTANCE_INCOMPLETE');
    if (!first.html.includes('<nav aria-label="Structure map">')
      || !first.html.includes(input.evidence.snapshotSha256)
      || !first.html.includes('Superset receives these files only')) throw new Error('DB_OUTPUT_HTML_INCOMPLETE');
    engines.push({
      engine,
      snapshotSha256: input.evidence.snapshotSha256,
      sourceBindingSha256: first.outputManifest.sourceBindingSha256,
      inventoryRows: first.projections.inventory.rows.length,
      relationshipRows: first.projections.relationships.rows.length,
      coverageRows: first.projections.coverage.rows.length,
      artifactDigests: first.outputManifest.artifactDigests,
    });
  }
  return {
    schemaVersion: 'chimpmaera.db/gate-8-output-verification/v1',
    status: 'PASS',
    engines,
    canonicalJson: true,
    navigableHtml: true,
    supersetProjectionCount: 6,
    directSupersetSourceDatabaseConnection: false,
    evidenceSha256: sha256(engines),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyDbAnalyzerOutputs().then((evidence) => process.stdout.write(canonicalJson(evidence))).catch((error) => {
    process.stderr.write(`${error.code ?? error.message}\n`);
    process.exitCode = 1;
  });
}
