#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  authorizeProfilingProjection,
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
    if (/^DB_PROFILING_REVIEW_/.test(error?.code ?? error?.message ?? '')) return true;
    throw error;
  }
  deny('DB_PROFILING_REVIEW_EXPECTED_DENIAL');
};

const rehash = (receipt) => {
  const { receiptSha256: _previous, ...body } = receipt;
  return { ...body, receiptSha256: identitySha256(body) };
};

export async function verifyDbAnalyzerProfilingReview(options = {}) {
  const root = path.resolve(options.root ?? '.');
  const engines = [];
  let denialProbeCount = 0;
  for (const engine of ['mssql', 'oracle']) {
    const profile = path.join(root, `tests/fixtures/db-analyzer/${engine}-profiling-profile-v1.json`);
    const receiptFile = path.join(root, `tests/fixtures/db-analyzer/${engine}-profiling-review-v1.json`);
    const receipt = JSON.parse(await readFile(receiptFile, 'utf8'));
    const evidence = await runAnalyzeProfile(profile, { repositoryRoot: root });
    const first = authorizeProfilingProjection({ evidence, receipt });
    const second = authorizeProfilingProjection({ evidence, receipt });
    if (canonicalJson(first) !== canonicalJson(second)
      || first.state !== 'CURATED_PROJECTION_AUTHORIZED'
      || first.authority !== 'SYNTHETIC_FIXTURE_ONLY'
      || first.productionAuthority !== false
      || first.approvedCandidateSha256.length !== 10) deny('DB_PROFILING_REVIEW_AUTHORIZATION_INVALID');

    const stale = structuredClone(receipt);
    stale.evidence.analysisSnapshotSha256 = '0'.repeat(64);
    expectedDenial(() => authorizeProfilingProjection({ evidence, receipt: rehash(stale) }));
    denialProbeCount += 1;

    const drifted = structuredClone(receipt);
    drifted.evidence.structureSnapshotSha256 = '1'.repeat(64);
    expectedDenial(() => authorizeProfilingProjection({ evidence, receipt: rehash(drifted) }));
    denialProbeCount += 1;

    const foreignScope = structuredClone(receipt);
    foreignScope.scope.database = 'FOREIGN_DATABASE';
    expectedDenial(() => authorizeProfilingProjection({ evidence, receipt: rehash(foreignScope) }));
    denialProbeCount += 1;

    const postReviewMutation = structuredClone(receipt);
    postReviewMutation.decisions[0].disposition = 'REJECTED';
    expectedDenial(() => authorizeProfilingProjection({ evidence, receipt: postReviewMutation }));
    denialProbeCount += 1;

    engines.push({
      engine,
      receiptSha256: first.receiptSha256,
      candidateSetSha256: first.candidateSetSha256,
      approvedCandidates: first.approvedCandidateSha256.length,
      rejectedCandidates: receipt.decisions.filter((decision) => decision.disposition === 'REJECTED').length,
      productionAuthority: first.productionAuthority,
    });
  }
  const body = {
    schemaVersion: 'chimpmaera.db/gate-6-profiling-review-verification/v1',
    status: 'PASS',
    deterministic: true,
    immutableReceiptBindings: [
      'STRUCTURE_SNAPSHOT',
      'PROFILING_POLICY',
      'QUERY_MANIFEST',
      'AGGREGATE_EVIDENCE',
      'CANDIDATE_SET',
    ],
    deniedConditions: ['STALE_ANALYSIS', 'STRUCTURE_DRIFT', 'FOREIGN_SCOPE', 'POST_REVIEW_MUTATION'],
    denialProbeCount,
    analyzerMayIssueReceipt: false,
    externalPublicationAuthority: false,
    engines,
  };
  return { ...body, evidenceSha256: identitySha256(body) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyDbAnalyzerProfilingReview().then((evidence) => process.stdout.write(canonicalJson(evidence))).catch((error) => {
    process.stderr.write(`${error.code ?? error.message}\n`);
    process.exitCode = 1;
  });
}
