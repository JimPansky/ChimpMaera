#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  attachParserEnrichmentEvidence,
  buildProfilingKnowledgePack,
  buildProfilingSupersetResult,
  buildStoredLogicEvidence,
  canonicalJson,
  identitySha256,
} from './lib/db-analyzer/core.mjs';
import { buildOptionalParserEnrichment } from './lib/db-analyzer/parser-enrichment.mjs';
import {
  buildStoredLogicOutputs,
  verifyStoredLogicOutputs,
} from './lib/db-analyzer/stored-logic-outputs.mjs';
import { runAnalyzeProfile } from './lib/db-analyzer/workflow.mjs';

const deny = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};

async function impactSources(root, engine) {
  const profileFile = path.join(root, `tests/fixtures/db-analyzer/${engine}-stored-logic-profile-v1.json`);
  const profile = JSON.parse(await readFile(profileFile, 'utf8'));
  const before = (await runAnalyzeProfile(profileFile, { repositoryRoot: root })).storedLogic;
  const directory = path.join(root, `query-packs/db-analyzer/v1/${engine}`);
  const manifest = JSON.parse(await readFile(path.join(directory, 'stored-logic-manifest.json'), 'utf8'));
  const fixture = JSON.parse(await readFile(path.join(root, `tests/fixtures/db-analyzer/${engine}-stored-logic-v1.json`), 'utf8'));
  const change = JSON.parse(await readFile(path.join(root, `tests/fixtures/db-analyzer/${engine}-stored-logic-impact-change-v1.json`), 'utf8'));
  const sqlByQueryId = Object.fromEntries(await Promise.all(manifest.queries.map(async (query) => [
    query.id,
    await readFile(path.join(directory, query.file), 'utf8'),
  ])));
  const changedFixture = structuredClone(fixture);
  const changedRow = changedFixture.results[`${engine}.stored-logic.objects`].rows.find((row) =>
    row.schema_name === change.object.schemaName
    && row.object_name === change.object.objectName
    && row.object_kind === change.object.objectKind
    && row.definition_component_ordinal === change.object.definitionComponentOrdinal);
  if (!changedRow) deny('DB_STORED_LOGIC_OUTPUT_CHANGE_FIXTURE_INVALID');
  changedRow.definition_component_hash = change.object.afterDefinitionComponentHash;
  let after = buildStoredLogicEvidence({
    manifest,
    sqlByQueryId,
    resultSets: changedFixture,
    profileContext: {
      profileId: profile.profileId,
      mode: profile.mode,
      scope: profile.scope,
      policy: profile.policy,
      adapter: profile.adapter.kind,
    },
  });
  const parserFixture = JSON.parse(await readFile(path.join(root, `tests/fixtures/db-analyzer/${engine}-parser-enrichment-v1.json`), 'utf8'));
  const parserLock = JSON.parse(await readFile(path.join(root, 'query-packs/db-analyzer/v1/stored-logic-provenance-license-lock.json'), 'utf8'));
  after = attachParserEnrichmentEvidence(after, await buildOptionalParserEnrichment({
    storedLogicEvidence: after,
    sourceFixture: parserFixture,
    parserLock: parserLock.parserDependency,
  }));
  const profilingEvidence = await runAnalyzeProfile(path.join(root, `tests/fixtures/db-analyzer/${engine}-profiling-profile-v1.json`), { repositoryRoot: root });
  const receipt = JSON.parse(await readFile(path.join(root, `tests/fixtures/db-analyzer/${engine}-profiling-review-v1.json`), 'utf8'));
  const knowledgePack = buildProfilingKnowledgePack({ evidence: profilingEvidence, receipt });
  const supersetResult = buildProfilingSupersetResult({ knowledgePack });
  return { before, after, knowledgePack, supersetResult };
}

export async function verifyDbAnalyzerStoredLogicOutputs(options = {}) {
  const root = path.resolve(options.root ?? '.');
  const engines = [];
  let denialProbeCount = 0;
  for (const engine of ['mssql', 'oracle']) {
    const sources = await impactSources(root, engine);
    const first = buildStoredLogicOutputs(sources);
    const second = buildStoredLogicOutputs(sources);
    if (canonicalJson(first) !== canonicalJson(second)
      || first.report.sourceBinding.afterStoredLogicSha256 !== sources.after.storedLogicSha256
      || first.report.sourceBinding.lineageSha256 !== sources.after.lineage.lineageSha256
      || first.report.summary.storedObjectCount !== sources.after.objects.length
      || first.projections.inventory.rows.length !== sources.after.objects.length
      || first.projections.lineage.rows.length !== sources.after.lineage.relationships.length
      || first.projections.blindSpots.rows.length !== sources.after.lineage.blindSpots.length
      || first.projections.impact.reviewRequired !== true
      || Object.values(first.projections).some((projection) => projection.source.sourceConnection !== null
        || projection.source.sourceSql !== null
        || projection.source.sourceRoute !== null
        || projection.source.directSourceDatabaseConnection !== false)
      || first.outputManifest.securityBoundary.rawDefinitions !== false
      || first.outputManifest.securityBoundary.sourceRoutes !== false
      || first.outputManifest.securityBoundary.automaticPublication !== false
      || /source_text|definition_text|raw_definition|CREATE\s+(?:PROCEDURE|FUNCTION|TRIGGER)|password|credential/i.test(first.reportJson)) {
      deny('DB_STORED_LOGIC_OUTPUT_VERIFICATION_INVALID');
    }
    verifyStoredLogicOutputs(first, sources);

    const tamperedProjection = structuredClone(first);
    tamperedProjection.projections.inventory.rows[0].objectName = 'invented_object';
    try {
      verifyStoredLogicOutputs(tamperedProjection, sources);
      deny('DB_STORED_LOGIC_OUTPUT_EXPECTED_DENIAL');
    } catch (error) {
      if (!/^DB_STORED_LOGIC_OUTPUT_TAMPERED$/.test(error.code ?? error.message)) throw error;
      denialProbeCount += 1;
    }

    const tamperedBinding = structuredClone(first);
    tamperedBinding.report.sourceBinding.afterStoredLogicSha256 = '0'.repeat(64);
    const { sourceBindingSha256: ignored, ...bindingBody } = tamperedBinding.report.sourceBinding;
    tamperedBinding.report.sourceBindingSha256 = identitySha256(bindingBody);
    try {
      verifyStoredLogicOutputs(tamperedBinding, sources);
      deny('DB_STORED_LOGIC_OUTPUT_EXPECTED_DENIAL');
    } catch (error) {
      if (!/^DB_STORED_LOGIC_OUTPUT_TAMPERED$/.test(error.code ?? error.message)) throw error;
      denialProbeCount += 1;
    }

    engines.push({
      engine,
      sourceBindingSha256: first.report.sourceBindingSha256,
      reportJsonSha256: first.outputManifest.artifactDigests.reportJsonSha256,
      htmlSha256: first.outputManifest.artifactDigests.htmlSha256,
      storedObjectCount: first.report.summary.storedObjectCount,
      lineageRelationshipCount: first.report.summary.lineageRelationshipCount,
      blindSpotCount: first.report.summary.blindSpotCount,
      impactRowCount: first.projections.impact.rows.length,
      reviewRequired: first.report.summary.reviewRequired,
      runtimeValidation: first.report.runtimeValidation,
    });
  }
  const body = {
    schemaVersion: 'chimpmaera.db/gate-8-stored-logic-output-verification/v1',
    status: 'PASS',
    deterministic: true,
    exactSourceBinding: true,
    canonicalJson: true,
    html: true,
    disconnectedSupersetProjections: true,
    rawDefinitionsIncluded: false,
    sourceRoutesIncluded: false,
    automaticPublication: false,
    directSourceDatabaseAccess: false,
    denialProbeCount,
    engines,
  };
  return { ...body, evidenceSha256: identitySha256(body) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyDbAnalyzerStoredLogicOutputs().then((evidence) => process.stdout.write(canonicalJson(evidence))).catch((error) => {
    process.stderr.write(`${error.code ?? error.message}\n`);
    process.exitCode = 1;
  });
}
