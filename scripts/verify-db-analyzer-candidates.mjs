#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { canonicalJson, deriveProfilingCandidates, sha256 } from './lib/db-analyzer/core.mjs';
import { runAnalyzeProfile } from './lib/db-analyzer/workflow.mjs';

const deny = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};

const targetKey = (value) => `${value.schemaName}\u0000${value.relationName}\u0000${value.columnName}`;

export async function verifyDbAnalyzerCandidates(options = {}) {
  const root = path.resolve(options.root ?? '.');
  const engines = [];
  for (const engine of ['mssql', 'oracle']) {
    const profile = path.join(root, 'tests', 'fixtures', 'db-analyzer', `${engine}-profiling-profile-v1.json`);
    const first = await runAnalyzeProfile(profile, { repositoryRoot: root });
    const second = await runAnalyzeProfile(profile, { repositoryRoot: root });
    if (canonicalJson(first.profiling.candidates) !== canonicalJson(second.profiling.candidates)) deny('DB_PROFILING_CANDIDATES_NOT_DETERMINISTIC');
    const { candidates, ...aggregate } = first.profiling;
    if (canonicalJson(deriveProfilingCandidates(aggregate)) !== canonicalJson(candidates)) deny('DB_PROFILING_CANDIDATES_NOT_RECOMPUTABLE');
    const factDigests = new Set(aggregate.facts.map((fact) => fact.objectSha256));
    const queryDigests = new Set(aggregate.queryPlan.map((query) => query.querySha256));
    const all = [...candidates.semanticCandidates, ...candidates.qualityCandidates];
    if (candidates.publicationState !== 'REVIEW_REQUIRED'
      || candidates.source.aggregateSha256 !== aggregate.aggregateSha256
      || candidates.summary.unknownClassificationCount !== all.length
      || candidates.summary.reviewRequiredCount !== all.length
      || all.some((candidate) => candidate.classificationState !== 'UNKNOWN'
        || candidate.reviewState !== 'REVIEW_REQUIRED'
        || candidate.semanticClaim !== 'NOT_ESTABLISHED'
        || !factDigests.has(candidate.evidenceRefs.factSha256)
        || !queryDigests.has(candidate.evidenceRefs.querySha256)
        || candidate.evidenceRefs.aggregateSha256 !== aggregate.aggregateSha256)) deny('DB_PROFILING_CANDIDATE_BINDING_INVALID');
    const types = [...new Set(candidates.semanticCandidates.map((candidate) => candidate.candidateType))].sort();
    if (canonicalJson(types) !== canonicalJson(['AMOUNT', 'CATEGORY', 'KEY', 'TIME'])) deny('DB_PROFILING_CANDIDATE_COVERAGE_INCOMPLETE');
    if (candidates.qualityCandidates.length !== aggregate.facts.length
      || new Set(candidates.qualityCandidates.map((candidate) => targetKey(candidate.target))).size !== aggregate.facts.length
      || /rowSample|sampleValue|sample_value|password|credential/i.test(canonicalJson(candidates))) deny('DB_PROFILING_CANDIDATE_DISCLOSURE_INVALID');
    const tampered = structuredClone(aggregate);
    tampered.facts[0].distinctCount -= 1;
    let tamperDenied = false;
    try {
      deriveProfilingCandidates(tampered);
    } catch (error) {
      tamperDenied = error.code === 'DB_PROFILING_CANDIDATE_SOURCE_TAMPERED';
    }
    if (!tamperDenied) deny('DB_PROFILING_CANDIDATE_TAMPER_NOT_DENIED');
    engines.push({
      engine,
      aggregateSha256: aggregate.aggregateSha256,
      candidateSetSha256: candidates.candidateSetSha256,
      semanticCandidateCount: candidates.semanticCandidates.length,
      qualityCandidateCount: candidates.qualityCandidates.length,
      candidateTypes: types,
    });
  }
  if (canonicalJson(engines[0].candidateTypes) !== canonicalJson(engines[1].candidateTypes)
    || engines[0].semanticCandidateCount !== engines[1].semanticCandidateCount
    || engines[0].qualityCandidateCount !== engines[1].qualityCandidateCount) deny('DB_PROFILING_CANDIDATE_ENGINE_ASYMMETRY');
  const body = {
    schemaVersion: 'chimpmaera.db/gate-4-candidate-verification/v1',
    status: 'PASS',
    engines,
    deterministic: true,
    exactRecomputation: true,
    applicationSpecificRules: false,
    inventedSemanticClaims: 0,
    tamperProbesPassed: 2,
  };
  return { ...body, evidenceSha256: sha256(body) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyDbAnalyzerCandidates().then((evidence) => process.stdout.write(canonicalJson(evidence))).catch((error) => {
    process.stderr.write(`${error.code ?? error.message}\n`);
    process.exitCode = 1;
  });
}
