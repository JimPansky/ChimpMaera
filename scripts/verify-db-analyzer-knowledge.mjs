#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildProfilingKnowledgePack,
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
    if (/^DB_PROFILING_(?:REVIEW|KNOWLEDGE)_/.test(error?.code ?? error?.message ?? '')) return true;
    throw error;
  }
  deny('DB_PROFILING_KNOWLEDGE_EXPECTED_DENIAL');
};

const allCandidates = (evidence) => [
  ...evidence.profiling.candidates.semanticCandidates,
  ...evidence.profiling.candidates.qualityCandidates,
];

export async function verifyDbAnalyzerKnowledge(options = {}) {
  const root = path.resolve(options.root ?? '.');
  const engines = [];
  let denialProbeCount = 0;
  for (const engine of ['mssql', 'oracle']) {
    const profile = path.join(root, `tests/fixtures/db-analyzer/${engine}-profiling-profile-v1.json`);
    const receiptFile = path.join(root, `tests/fixtures/db-analyzer/${engine}-profiling-review-v1.json`);
    const receipt = JSON.parse(await readFile(receiptFile, 'utf8'));
    const evidence = await runAnalyzeProfile(profile, { repositoryRoot: root });
    const first = buildProfilingKnowledgePack({ evidence, receipt });
    const second = buildProfilingKnowledgePack({ evidence, receipt });
    const { knowledgePackSha256, ...knowledgeBody } = first;
    if (canonicalJson(first) !== canonicalJson(second)
      || identitySha256(knowledgeBody) !== knowledgePackSha256) {
      deny('DB_PROFILING_KNOWLEDGE_NOT_DETERMINISTIC');
    }

    const approved = receipt.decisions
      .filter((decision) => decision.disposition === 'APPROVED')
      .map((decision) => decision.candidateSha256)
      .sort();
    const rejected = new Set(receipt.decisions
      .filter((decision) => decision.disposition === 'REJECTED')
      .map((decision) => decision.candidateSha256));
    const emitted = first.entries.map((entry) => entry.candidateSha256);
    const candidates = new Map(allCandidates(evidence).map((candidate) => [candidate.candidateSha256, candidate]));
    if (canonicalJson(emitted) !== canonicalJson(approved)
      || emitted.some((candidateSha256) => rejected.has(candidateSha256) || !candidates.has(candidateSha256))
      || first.entries.some((entry) => entry.classificationState !== 'UNKNOWN'
        || entry.semanticClaim !== 'NOT_ESTABLISHED'
        || entry.reviewState !== 'APPROVED_BY_BOUND_RECEIPT'
        || entry.receiptSha256 !== receipt.receiptSha256)
      || first.authority.productionAuthority !== false
      || first.authority.externalPublicationAuthority !== false
      || first.authority.directSourceDatabaseAccess !== false
      || first.claims.semanticTruthEstablished !== false
      || first.claims.runtimeProfilingValidated !== false
      || first.claims.rowSamplesIncluded !== false
      || /sampleValue|sample_value|password|credential/i.test(canonicalJson(first))) {
      deny('DB_PROFILING_KNOWLEDGE_CONTENT_INVALID');
    }

    const receiptTamper = structuredClone(receipt);
    receiptTamper.decisions.find((decision) => decision.disposition === 'REJECTED').disposition = 'APPROVED';
    expectedDenial(() => buildProfilingKnowledgePack({ evidence, receipt: receiptTamper }));
    denialProbeCount += 1;

    const evidenceTamper = structuredClone(evidence);
    evidenceTamper.profiling.candidates.semanticCandidates[0].signals.push('INVENTED_SIGNAL');
    expectedDenial(() => buildProfilingKnowledgePack({ evidence: evidenceTamper, receipt }));
    denialProbeCount += 1;

    engines.push({
      engine,
      knowledgePackSha256: first.knowledgePackSha256,
      receiptSha256: receipt.receiptSha256,
      approvedCandidateCount: approved.length,
      emittedEntryCount: emitted.length,
      rejectedCandidateCount: rejected.size,
      rejectedCandidatesEmitted: 0,
      runtimeValidation: first.source.runtimeValidation,
    });
  }
  const body = {
    schemaVersion: 'chimpmaera.db/gate-7-knowledge-verification/v1',
    status: 'PASS',
    deterministic: true,
    exactReceiptApprovedDigestsOnly: true,
    inventedSemanticClaims: 0,
    externalPublicationAuthority: false,
    directSourceDatabaseAccess: false,
    denialProbeCount,
    engines,
  };
  return { ...body, evidenceSha256: identitySha256(body) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyDbAnalyzerKnowledge().then((evidence) => process.stdout.write(canonicalJson(evidence))).catch((error) => {
    process.stderr.write(`${error.code ?? error.message}\n`);
    process.exitCode = 1;
  });
}
