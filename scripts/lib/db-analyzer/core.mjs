import { createHash } from 'node:crypto';

export const QUERY_MANIFEST_SCHEMA = 'chimpmaera.db/query-manifest/v1';
export const PREFLIGHT_EVIDENCE_SCHEMA = 'chimpmaera.db/preflight-evidence/v1';
export const ANALYZE_PROFILE_SCHEMA = 'chimpmaera.db/analyze-profile/v1';
export const PROFILING_POLICY_SCHEMA = 'chimpmaera.db/profiling-policy/v1';
export const PROFILING_QUERY_MANIFEST_SCHEMA = 'chimpmaera.db/profiling-query-manifest/v1';
export const SYNTHETIC_AGGREGATE_RESULTS_SCHEMA = 'chimpmaera.db/synthetic-aggregate-results/v1';
export const AGGREGATE_EVIDENCE_SCHEMA = 'chimpmaera.db/aggregate-evidence/v1';
export const PROFILING_CANDIDATE_SET_SCHEMA = 'chimpmaera.db/profiling-candidate-set/v1';
export const PROFILING_COVERAGE_LEDGER_SCHEMA = 'chimpmaera.db/profiling-coverage-ledger/v1';
export const PROFILING_REVIEW_RECEIPT_SCHEMA = 'chimpmaera.db/profiling-review-receipt/v1';
export const PROFILING_KNOWLEDGE_PACK_SCHEMA = 'chimpmaera.db/profiling-knowledge-pack/v1';
export const PROFILING_SUPERSET_RESULT_SCHEMA = 'chimpmaera.db/profiling-superset-result/v1';
export const PROFILING_COVERAGE_STATES = Object.freeze([
  'SUCCEEDED',
  'PARTIAL',
  'DENIED',
  'UNSUPPORTED',
  'TIMEOUT',
  'TAMPER',
]);
export const IDENTITY_CONTRACT_SCHEMA = 'chimpmaera.db/canonical-identity/v1';
export const IDENTITY_CONTRACT = Object.freeze({
  schemaVersion: IDENTITY_CONTRACT_SCHEMA,
  algorithm: 'SHA-256',
  encoding: 'UTF-8',
  stringNormalization: 'NFC',
  lineEndings: 'LF',
  excludedObservationFields: Object.freeze(['observationTimestamp', 'observation_timestamp', 'observedAt']),
});
export const COVERAGE_STATES = Object.freeze([
  'SUCCEEDED',
  'PARTIAL',
  'DENIED',
  'UNSUPPORTED',
  'TIMEOUT',
  'ERROR',
]);
export const COVERAGE_LEDGER_SCHEMA = 'chimpmaera.db/coverage-ledger/v1';
const COVERAGE_VISIBILITY = Object.freeze({
  SUCCEEDED: 'VISIBLE_COMPLETE',
  PARTIAL: 'VISIBLE_PARTIAL',
  DENIED: 'INVISIBLE',
  UNSUPPORTED: 'NOT_APPLICABLE',
  TIMEOUT: 'UNKNOWN',
  ERROR: 'UNKNOWN',
});
const QUERY_CATEGORIES = new Set(['preflight', 'schemas', 'relations', 'columns', 'constraints', 'indexes', 'sequences', 'synonyms']);

const fail = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};

const invalidUnicode = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const normalizeString = (value) => {
  if (invalidUnicode.test(value)) fail('DB_CANONICAL_UNICODE_INVALID');
  return value.replace(/\r\n?/g, '\n').normalize('NFC');
};

export const normalizeJsonValue = (value) => {
  if (typeof value === 'string') return normalizeString(value);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('DB_CANONICAL_NUMBER_INVALID');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) fail('DB_CANONICAL_VALUE_INVALID');
  const entries = Object.keys(value).map((key) => [normalizeString(key), normalizeJsonValue(value[key])]);
  if (new Set(entries.map(([key]) => key)).size !== entries.length) fail('DB_CANONICAL_KEY_COLLISION');
  return Object.fromEntries(entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
};

export const canonicalJson = (value) => `${JSON.stringify(normalizeJsonValue(value))}\n`;
export const sha256 = (value) => createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
export const normalizeSql = (sql) => `${normalizeString(sql).trim()}\n`;

const withoutObservationFields = (value) => Array.isArray(value)
  ? value.map(withoutObservationFields)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value)
      .filter(([key]) => !IDENTITY_CONTRACT.excludedObservationFields.includes(key))
      .map(([key, entry]) => [key, withoutObservationFields(entry)]))
    : value;

export const identitySha256 = (value) => sha256(withoutObservationFields(value));

const hasExactKeys = (value, expected) => value
  && typeof value === 'object'
  && !Array.isArray(value)
  && canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort());

const validScopedName = (value) => typeof value === 'string'
  && value.length > 0
  && value.length <= 128
  && value === value.normalize('NFC')
  && !invalidUnicode.test(value)
  && !/[\u0000-\u001f\u007f]/.test(value);

const PROFILING_OUTPUT_COLUMNS = Object.freeze({
  NUMERIC: Object.freeze(['rowCount', 'nullCount', 'distinctCount', 'minimum', 'maximum']),
  TEMPORAL: Object.freeze(['rowCount', 'nullCount', 'distinctCount', 'minimum', 'maximum', 'freshnessMaximum']),
  CATEGORY: Object.freeze(['rowCount', 'nullCount', 'distinctCount']),
  TEXT: Object.freeze(['rowCount', 'nullCount', 'distinctCount']),
  BOOLEAN: Object.freeze(['rowCount', 'nullCount', 'distinctCount']),
});
const PROFILING_TEMPLATE_MARKERS = Object.freeze(['SCHEMA', 'RELATION', 'COLUMN']);
const PROFILING_FORBIDDEN_SQL = /\b(?:ALTER|CREATE|DELETE|DROP|EXEC(?:UTE)?|GRANT|INSERT|MERGE|REVOKE|TRUNCATE|UPDATE)\b/i;

export function validateProfilingQueryManifest(manifest, sqlByQueryId) {
  if (!hasExactKeys(manifest, ['schemaVersion', 'packId', 'packVersion', 'engine', 'queries'])
    || manifest.schemaVersion !== PROFILING_QUERY_MANIFEST_SCHEMA
    || !['mssql', 'oracle'].includes(manifest.engine)
    || typeof manifest.packId !== 'string' || manifest.packId.length === 0
    || typeof manifest.packVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(manifest.packVersion)
    || !Array.isArray(manifest.queries) || manifest.queries.length === 0) fail('DB_PROFILING_QUERY_MANIFEST_INVALID');
  const ids = new Set();
  const families = new Set();
  for (const query of manifest.queries) {
    if (!hasExactKeys(query, ['id', 'category', 'file', 'templateSha256', 'typeFamilies', 'nativeTypes', 'outputColumns', 'sortKeys', 'readOnly', 'aggregateOnly', 'rowSamples', 'labelDistributions', 'cost', 'timeoutMs', 'privilege', 'fallback', 'provenance'])
      || typeof query.id !== 'string' || ids.has(query.id)
      || !['numeric-aggregate', 'temporal-aggregate', 'category-aggregate', 'text-aggregate', 'boolean-aggregate'].includes(query.category)
      || typeof query.file !== 'string' || pathLike(query.file)
      || typeof query.templateSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(query.templateSha256)
      || !Array.isArray(query.typeFamilies) || query.typeFamilies.length !== 1
      || !Object.hasOwn(PROFILING_OUTPUT_COLUMNS, query.typeFamilies[0])
      || query.category !== `${query.typeFamilies[0].toLowerCase()}-aggregate`
      || query.typeFamilies.some((family) => families.has(family))
      || !Array.isArray(query.nativeTypes) || query.nativeTypes.length === 0
      || query.nativeTypes.some((type) => typeof type !== 'string' || type.length === 0)
      || canonicalJson(query.outputColumns) !== canonicalJson(PROFILING_OUTPUT_COLUMNS[query.typeFamilies[0]])
      || canonicalJson(query.sortKeys) !== canonicalJson([])
      || query.readOnly !== true || query.aggregateOnly !== true
      || query.rowSamples !== false || query.labelDistributions !== false
      || query.cost !== 'BOUNDED_SCAN' || !Number.isInteger(query.timeoutMs) || query.timeoutMs < 1
      || typeof query.privilege?.minimum !== 'string' || query.privilege.minimum.length === 0
      || typeof query.fallback?.onDenied !== 'string' || query.fallback.onDenied.length === 0
      || query.provenance?.sourceType !== 'OFFICIAL_AGGREGATE_API_REFERENCE'
      || typeof query.provenance?.url !== 'string' || query.provenance.spdx !== 'Apache-2.0'
      || query.provenance.copiedCode !== false
      || !/CM-authored/.test(query.provenance.changeMarker ?? '')) fail('DB_PROFILING_QUERY_MANIFEST_INVALID');
    ids.add(query.id);
    query.typeFamilies.forEach((family) => families.add(family));
    if (sqlByQueryId !== undefined) {
      const sql = sqlByQueryId[query.id];
      const markers = [...(sql?.matchAll(/\{\{([A-Z]+)\}\}/g) ?? [])].map((match) => match[1]);
      const executable = sql?.replace(/'(?:''|[^'])*'/g, "''") ?? '';
      const semicolons = executable.match(/;/g) ?? [];
      if (typeof sql !== 'string' || sha256(normalizeSql(sql)) !== query.templateSha256
        || !/^SELECT\b/i.test(normalizeSql(sql))
        || PROFILING_FORBIDDEN_SQL.test(executable)
        || /\b(?:TOP|SAMPLE|FETCH)\b/i.test(executable)
        || /SELECT\s+\*/i.test(executable)
        || (executable.match(/\bSELECT\b/gi) ?? []).length !== 1
        || (executable.match(/\bFROM\b/gi) ?? []).length !== 1
        || semicolons.length !== 1 || !/;\s*$/.test(executable)
        || /--|\/\*/.test(executable)
        || markers.some((marker) => !PROFILING_TEMPLATE_MARKERS.includes(marker))
        || !PROFILING_TEMPLATE_MARKERS.every((marker) => markers.includes(marker))) fail('DB_PROFILING_QUERY_TEMPLATE_DENIED');
    }
  }
  if (sqlByQueryId !== undefined
    && canonicalJson(Object.keys(sqlByQueryId).sort()) !== canonicalJson([...ids].sort())) fail('DB_PROFILING_QUERY_TEMPLATE_DENIED');
  return manifest;
}

const quoteProfilingIdentifier = (engine, value) => {
  if (!validScopedName(value)) fail('DB_PROFILING_QUERY_SCOPE_INVALID');
  return engine === 'mssql' ? `[${value.replaceAll(']', ']]')}]` : `"${value.replaceAll('"', '""')}"`;
};

export function compileProfilingQuery({ manifest, sqlByQueryId, target }) {
  validateProfilingQueryManifest(manifest, sqlByQueryId);
  if (!hasExactKeys(target, ['schemaName', 'relationName', 'columnName', 'typeFamily'])) fail('DB_PROFILING_QUERY_TARGET_INVALID');
  const query = manifest.queries.find((entry) => entry.typeFamilies.includes(target.typeFamily));
  if (!query) fail('DB_PROFILING_TYPE_FAMILY_UNSUPPORTED');
  const replacements = {
    SCHEMA: quoteProfilingIdentifier(manifest.engine, target.schemaName),
    RELATION: quoteProfilingIdentifier(manifest.engine, target.relationName),
    COLUMN: quoteProfilingIdentifier(manifest.engine, target.columnName),
  };
  const sql = normalizeSql(sqlByQueryId[query.id].replace(/\{\{([A-Z]+)\}\}/g, (_match, marker) => replacements[marker]));
  if (/\{\{/.test(sql)) fail('DB_PROFILING_QUERY_TEMPLATE_DENIED');
  return normalizeJsonValue({
    queryId: query.id,
    schemaName: target.schemaName,
    relationName: target.relationName,
    columnName: target.columnName,
    typeFamily: target.typeFamily,
    timeoutMs: query.timeoutMs,
    outputColumns: query.outputColumns,
    querySha256: sha256(sql),
  });
}

function validateProfilingPolicy(profile) {
  const profiling = profile.policy.profiling;
  if (!hasExactKeys(profiling, ['schemaVersion', 'enabled', 'scope', 'budgets', 'disclosure', 'cancellation', 'aggregateFixture'])
    || profiling.schemaVersion !== PROFILING_POLICY_SCHEMA
    || profiling.enabled !== true
    || !Array.isArray(profiling.scope) || profiling.scope.length === 0) fail('DB_PROFILING_POLICY_INVALID');
  const targets = new Set();
  let columnCount = 0;
  for (const target of profiling.scope) {
    if (!hasExactKeys(target, ['schemaName', 'relationName', 'columns'])
      || !profile.scope.schemas.includes(target.schemaName)
      || !validScopedName(target.relationName)
      || !Array.isArray(target.columns) || target.columns.length === 0
      || target.columns.some((column) => !validScopedName(column))
      || new Set(target.columns).size !== target.columns.length) fail('DB_PROFILING_SCOPE_INVALID');
    const targetKey = `${target.schemaName}\u0000${target.relationName}`;
    if (targets.has(targetKey)) fail('DB_PROFILING_SCOPE_INVALID');
    targets.add(targetKey);
    columnCount += target.columns.length;
  }
  const budgets = profiling.budgets;
  if (!hasExactKeys(budgets, ['maxRelations', 'maxColumns', 'maxQueries', 'maxDistributionBuckets', 'maxQueryTimeoutMs'])
    || !Object.values(budgets).every(Number.isInteger)
    || budgets.maxRelations < profiling.scope.length
    || budgets.maxColumns < columnCount
    || budgets.maxQueries < columnCount
    || budgets.maxDistributionBuckets < 0
    || budgets.maxQueryTimeoutMs < 1
    || budgets.maxQueryTimeoutMs > profile.policy.maxQueryTimeoutMs) fail('DB_PROFILING_BUDGET_INVALID');
  if (!hasExactKeys(profiling.disclosure, ['allowRowSamples', 'allowLabelDistributions', 'maxLabelCardinality', 'sensitiveTargets'])
    || profiling.disclosure.allowRowSamples !== false
    || profiling.disclosure.allowLabelDistributions !== false
    || profiling.disclosure.maxLabelCardinality !== 0
    || !Array.isArray(profiling.disclosure.sensitiveTargets)
    || budgets.maxDistributionBuckets !== 0) fail('DB_PROFILING_DISCLOSURE_DENIED');
  const sensitiveTargets = new Set();
  const allowedColumns = new Set(profiling.scope.flatMap((target) => target.columns
    .map((columnName) => `${target.schemaName}\u0000${target.relationName}\u0000${columnName}`)));
  for (const target of profiling.disclosure.sensitiveTargets) {
    if (!hasExactKeys(target, ['schemaName', 'relationName', 'columnName', 'classification'])
      || target.classification !== 'SENSITIVE') fail('DB_PROFILING_DISCLOSURE_DENIED');
    const key = `${target.schemaName}\u0000${target.relationName}\u0000${target.columnName}`;
    if (!allowedColumns.has(key) || sensitiveTargets.has(key)) fail('DB_PROFILING_DISCLOSURE_DENIED');
    sensitiveTargets.add(key);
  }
  if (!hasExactKeys(profiling.cancellation, ['onTimeout', 'onAbort'])
    || profiling.cancellation.onTimeout !== 'FAIL_CLOSED'
    || profiling.cancellation.onAbort !== 'FAIL_CLOSED') fail('DB_PROFILING_CANCELLATION_INVALID');
  if (profile.mode === 'SYNTHETIC') {
    if (typeof profiling.aggregateFixture !== 'string' || pathLike(profiling.aggregateFixture)) fail('DB_PROFILING_FIXTURE_INVALID');
  } else if (profiling.aggregateFixture !== null) fail('DB_PROFILING_FIXTURE_INVALID');
  return profiling;
}

export function validateAnalyzeProfile(profile) {
  if (profile?.schemaVersion !== ANALYZE_PROFILE_SCHEMA) fail('DB_ANALYZE_PROFILE_SCHEMA_INVALID');
  if (!hasExactKeys(profile, ['schemaVersion', 'profileId', 'engine', 'mode', 'queryPack', 'scope', 'policy', 'adapter'])) fail('DB_ANALYZE_PROFILE_FIELDS_INVALID');
  if (typeof profile.profileId !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(profile.profileId)) fail('DB_ANALYZE_PROFILE_ID_INVALID');
  if (!['mssql', 'oracle'].includes(profile.engine)) fail('DB_ANALYZE_PROFILE_ENGINE_INVALID');
  if (!['SYNTHETIC', 'RUNTIME'].includes(profile.mode)) fail('DB_ANALYZE_PROFILE_MODE_UNSUPPORTED');
  if (!hasExactKeys(profile.queryPack, ['version']) || profile.queryPack.version !== 'v1') fail('DB_ANALYZE_PROFILE_PACK_INVALID');
  if (!hasExactKeys(profile.scope, ['database', 'container', 'schemas'])
    || typeof profile.scope.database !== 'string' || profile.scope.database.length === 0
    || !(profile.scope.container === null || typeof profile.scope.container === 'string')
    || !Array.isArray(profile.scope.schemas) || profile.scope.schemas.length === 0
    || profile.scope.schemas.some((schema) => typeof schema !== 'string' || schema.length === 0)
    || new Set(profile.scope.schemas).size !== profile.scope.schemas.length) fail('DB_ANALYZE_PROFILE_SCOPE_INVALID');
  const policyKeys = profile.policy && Object.hasOwn(profile.policy, 'profiling')
    ? ['access', 'allowRowSamples', 'maxQueryTimeoutMs', 'profiling']
    : ['access', 'allowRowSamples', 'maxQueryTimeoutMs'];
  if (!hasExactKeys(profile.policy, policyKeys)
    || profile.policy.access !== 'READ_ONLY' || profile.policy.allowRowSamples !== false
    || !Number.isInteger(profile.policy.maxQueryTimeoutMs) || profile.policy.maxQueryTimeoutMs < 1) fail('DB_ANALYZE_PROFILE_POLICY_INVALID');
  if (Object.hasOwn(profile.policy, 'profiling')) validateProfilingPolicy(profile);
  if (profile.mode === 'SYNTHETIC') {
    if (!hasExactKeys(profile.adapter, ['kind', 'fixture']) || profile.adapter.kind !== 'synthetic'
      || typeof profile.adapter.fixture !== 'string' || pathLike(profile.adapter.fixture)) fail('DB_ANALYZE_PROFILE_ADAPTER_INVALID');
  } else if (!hasExactKeys(profile.adapter, ['kind', 'host', 'port', 'user', 'passwordEnv', 'encrypt', 'trustServerCertificate'])
    || profile.engine !== 'mssql' || profile.adapter.kind !== 'mssql'
    || typeof profile.adapter.host !== 'string' || profile.adapter.host.length === 0
    || !Number.isInteger(profile.adapter.port) || profile.adapter.port < 1 || profile.adapter.port > 65535
    || typeof profile.adapter.user !== 'string' || profile.adapter.user.length === 0
    || typeof profile.adapter.passwordEnv !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(profile.adapter.passwordEnv)
    || typeof profile.adapter.encrypt !== 'boolean' || typeof profile.adapter.trustServerCertificate !== 'boolean') {
    fail('DB_ANALYZE_PROFILE_ADAPTER_INVALID');
  }
  return profile;
}

const pathLike = (value) => value !== value.split(/[\\/]/).at(-1) || value === '.' || value === '..';

const profilingTarget = (value) => ({
  schemaName: value.schemaName,
  relationName: value.relationName,
  columnName: value.columnName,
});

const profilingTargetKey = (value) => `${value.schemaName}\u0000${value.relationName}\u0000${value.columnName}`;

export function buildProfilingCoverageLedger({ profile, attempts }) {
  const profiling = validateProfilingPolicy(profile);
  if (!Array.isArray(attempts) || attempts.length === 0 || attempts.length > profiling.budgets.maxQueries) {
    fail('DB_PROFILING_COVERAGE_INVALID');
  }
  const allowed = new Set(profiling.scope.flatMap((target) => target.columns
    .map((columnName) => `${target.schemaName}\u0000${target.relationName}\u0000${columnName}`)));
  const seen = new Set();
  const entries = attempts.map((attempt) => {
    if (!hasExactKeys(attempt, ['schemaName', 'relationName', 'columnName', 'typeFamily', 'state', 'reasonCode', 'factSha256'])
      || !Object.hasOwn(PROFILING_OUTPUT_COLUMNS, attempt.typeFamily)
      || !PROFILING_COVERAGE_STATES.includes(attempt.state)) fail('DB_PROFILING_COVERAGE_TAMPERED');
    const key = profilingTargetKey(attempt);
    if (!allowed.has(key) || seen.has(key)) fail('DB_PROFILING_COVERAGE_SCOPE_INVALID');
    seen.add(key);
    const visible = attempt.state === 'SUCCEEDED' || attempt.state === 'PARTIAL';
    if ((attempt.state === 'SUCCEEDED' && attempt.reasonCode !== null)
      || (attempt.state !== 'SUCCEEDED' && (typeof attempt.reasonCode !== 'string' || !/^[A-Z][A-Z0-9_]{2,127}$/.test(attempt.reasonCode)))
      || (visible && !/^[a-f0-9]{64}$/.test(attempt.factSha256 ?? ''))
      || (!visible && attempt.factSha256 !== null)) fail('DB_PROFILING_COVERAGE_TAMPERED');
    return normalizeJsonValue({
      target: profilingTarget(attempt),
      typeFamily: attempt.typeFamily,
      state: attempt.state,
      reasonCode: attempt.reasonCode,
      visibility: visible ? (attempt.state === 'SUCCEEDED' ? 'VISIBLE_COMPLETE' : 'VISIBLE_PARTIAL') : 'NOT_VISIBLE',
      factSha256: attempt.factSha256,
      reviewState: 'REVIEW_REQUIRED',
    });
  }).sort((left, right) => compareRows(['schemaName', 'relationName', 'columnName'])(left.target, right.target));
  const stateCounts = Object.fromEntries(PROFILING_COVERAGE_STATES.map((state) => [state, entries.filter((entry) => entry.state === state).length]));
  const body = normalizeJsonValue({
    schemaVersion: PROFILING_COVERAGE_LEDGER_SCHEMA,
    publicationState: 'REVIEW_REQUIRED',
    totalAttempts: entries.length,
    stateCounts,
    completeAttempts: stateCounts.SUCCEEDED,
    partialAttempts: stateCounts.PARTIAL,
    nonClaimedAttempts: entries.length - stateCounts.SUCCEEDED,
    entries,
  });
  return { ...body, coverageSha256: identitySha256(body) };
}

const candidateEntry = ({ aggregateSha256, fact, plan, candidateType, ruleId, signals }) => {
  const body = normalizeJsonValue({
    candidateType,
    classificationState: 'UNKNOWN',
    reviewState: 'REVIEW_REQUIRED',
    semanticClaim: 'NOT_ESTABLISHED',
    target: profilingTarget(fact),
    ruleId,
    metrics: {
      rowCount: fact.rowCount,
      nullCount: fact.nullCount,
      distinctCount: fact.distinctCount,
    },
    signals,
    evidenceRefs: {
      aggregateSha256,
      factSha256: fact.objectSha256,
      querySha256: plan.querySha256,
    },
  });
  return { ...body, candidateSha256: identitySha256(body) };
};

export function deriveProfilingCandidates(aggregateEvidence) {
  if (!hasExactKeys(aggregateEvidence, [
    'schemaVersion', 'engine', 'runtimeValidation', 'policySha256', 'queryPack', 'queryPlan', 'coverage', 'factCount', 'facts', 'aggregateSha256',
  ]) || aggregateEvidence.schemaVersion !== AGGREGATE_EVIDENCE_SCHEMA
    || !['mssql', 'oracle'].includes(aggregateEvidence.engine)
    || aggregateEvidence.runtimeValidation !== 'SYNTHETIC_UNVALIDATED'
    || !Array.isArray(aggregateEvidence.facts)
    || !Array.isArray(aggregateEvidence.queryPlan)
    || aggregateEvidence.factCount !== aggregateEvidence.facts.length) fail('DB_PROFILING_CANDIDATE_SOURCE_INVALID');
  const { aggregateSha256, ...aggregateBody } = aggregateEvidence;
  if (identitySha256(aggregateBody) !== aggregateSha256) fail('DB_PROFILING_CANDIDATE_SOURCE_TAMPERED');
  const plans = new Map(aggregateEvidence.queryPlan.map((plan) => [profilingTargetKey(plan), plan]));
  if (plans.size !== aggregateEvidence.queryPlan.length) fail('DB_PROFILING_CANDIDATE_SOURCE_INVALID');

  const semanticCandidates = [];
  const qualityCandidates = [];
  for (const fact of aggregateEvidence.facts) {
    const { objectSha256, ...factBody } = fact;
    if (identitySha256({ engine: aggregateEvidence.engine, fact: factBody }) !== objectSha256) fail('DB_PROFILING_CANDIDATE_SOURCE_TAMPERED');
    const plan = plans.get(profilingTargetKey(fact));
    if (!plan || plan.typeFamily !== fact.typeFamily || !/^[a-f0-9]{64}$/.test(plan.querySha256 ?? '')) fail('DB_PROFILING_CANDIDATE_SOURCE_INVALID');
    const nonNullCount = fact.rowCount - fact.nullCount;
    const isUniqueComplete = fact.rowCount > 0 && fact.nullCount === 0 && fact.distinctCount === fact.rowCount;
    const common = { aggregateSha256, fact, plan };
    if (isUniqueComplete) {
      semanticCandidates.push(candidateEntry({ ...common, candidateType: 'KEY', ruleId: 'UNIQUE_COMPLETE_AGGREGATE_V1', signals: ['ALL_ROWS_NON_NULL', 'ALL_ROWS_DISTINCT'] }));
    } else if (fact.typeFamily === 'NUMERIC') {
      semanticCandidates.push(candidateEntry({ ...common, candidateType: 'AMOUNT', ruleId: 'NON_UNIQUE_NUMERIC_FAMILY_V1', signals: ['NUMERIC_TYPE_FAMILY', 'NOT_UNIQUE_COMPLETE'] }));
    }
    if (fact.typeFamily === 'TEMPORAL') {
      semanticCandidates.push(candidateEntry({ ...common, candidateType: 'TIME', ruleId: 'TEMPORAL_FAMILY_V1', signals: ['TEMPORAL_TYPE_FAMILY'] }));
    }
    if (['CATEGORY', 'BOOLEAN'].includes(fact.typeFamily)) {
      semanticCandidates.push(candidateEntry({ ...common, candidateType: 'CATEGORY', ruleId: 'BOUNDED_CARDINALITY_FAMILY_V1', signals: [`${fact.typeFamily}_TYPE_FAMILY`] }));
    }
    qualityCandidates.push(candidateEntry({
      ...common,
      candidateType: 'QUALITY',
      ruleId: 'NULL_AND_DISTINCT_OBSERVATION_V1',
      signals: [
        fact.nullCount === 0 ? 'NO_NULLS_OBSERVED' : 'NULLS_OBSERVED',
        nonNullCount > 0 && fact.distinctCount === nonNullCount ? 'ALL_NON_NULL_VALUES_DISTINCT' : 'REPEATED_NON_NULL_VALUES',
      ],
    }));
  }
  const compareCandidates = compareRows(['schemaName', 'relationName', 'columnName', 'candidateType']);
  const sortCandidate = (left, right) => compareCandidates(
    { ...left.target, candidateType: left.candidateType },
    { ...right.target, candidateType: right.candidateType },
  );
  semanticCandidates.sort(sortCandidate);
  qualityCandidates.sort(sortCandidate);
  const body = normalizeJsonValue({
    schemaVersion: PROFILING_CANDIDATE_SET_SCHEMA,
    publicationState: 'REVIEW_REQUIRED',
    source: {
      engine: aggregateEvidence.engine,
      runtimeValidation: aggregateEvidence.runtimeValidation,
      aggregateSha256,
      policySha256: aggregateEvidence.policySha256,
      manifestSha256: aggregateEvidence.queryPack.manifestSha256,
    },
    summary: {
      semanticCandidateCount: semanticCandidates.length,
      qualityCandidateCount: qualityCandidates.length,
      unknownClassificationCount: semanticCandidates.length + qualityCandidates.length,
      reviewRequiredCount: semanticCandidates.length + qualityCandidates.length,
    },
    semanticCandidates,
    qualityCandidates,
  });
  return { ...body, candidateSetSha256: identitySha256(body) };
}

export function buildAggregateProfilingEvidence({ profile, resultSets, profilingManifest, profilingSqlByQueryId }) {
  const profiling = profile?.policy?.profiling;
  if (!profiling) return undefined;
  validateProfilingPolicy(profile);
  if (!hasExactKeys(resultSets, ['schemaVersion', 'engine', 'runtimeValidated', 'facts'])
    || resultSets.schemaVersion !== SYNTHETIC_AGGREGATE_RESULTS_SCHEMA
    || resultSets.engine !== profile.engine
    || resultSets.runtimeValidated !== false
    || !Array.isArray(resultSets.facts)) fail('DB_PROFILING_RESULT_CONTRACT_INVALID');
  if (resultSets.facts.length > profiling.budgets.maxQueries) fail('DB_PROFILING_BUDGET_EXCEEDED');
  const allowed = new Set(profiling.scope.flatMap((target) => target.columns
    .map((column) => `${target.schemaName}\u0000${target.relationName}\u0000${column}`)));
  const sensitive = new Set(profiling.disclosure.sensitiveTargets.map(profilingTargetKey));
  const seen = new Set();
  const facts = resultSets.facts.map((fact) => {
    const factKeys = {
      NUMERIC: ['schemaName', 'relationName', 'columnName', 'typeFamily', 'rowCount', 'nullCount', 'distinctCount', 'minimum', 'maximum', 'distribution'],
      TEMPORAL: ['schemaName', 'relationName', 'columnName', 'typeFamily', 'rowCount', 'nullCount', 'distinctCount', 'minimum', 'maximum', 'freshnessMaximum', 'distribution'],
      CATEGORY: ['schemaName', 'relationName', 'columnName', 'typeFamily', 'rowCount', 'nullCount', 'distinctCount', 'distribution'],
      TEXT: ['schemaName', 'relationName', 'columnName', 'typeFamily', 'rowCount', 'nullCount', 'distinctCount', 'distribution'],
      BOOLEAN: ['schemaName', 'relationName', 'columnName', 'typeFamily', 'rowCount', 'nullCount', 'distinctCount', 'distribution'],
    }[fact?.typeFamily];
    if (!factKeys || !hasExactKeys(fact, factKeys)
      || !allowed.has(`${fact.schemaName}\u0000${fact.relationName}\u0000${fact.columnName}`)
      || !Object.hasOwn(PROFILING_OUTPUT_COLUMNS, fact.typeFamily)
      || ![fact.rowCount, fact.nullCount, fact.distinctCount].every(Number.isInteger)
      || fact.rowCount < 0 || fact.nullCount < 0 || fact.nullCount > fact.rowCount
      || fact.distinctCount < 0 || fact.distinctCount > fact.rowCount - fact.nullCount
      || (Object.hasOwn(fact, 'minimum') && !([null, 'string'].includes(fact.minimum === null ? null : typeof fact.minimum)))
      || (Object.hasOwn(fact, 'maximum') && !([null, 'string'].includes(fact.maximum === null ? null : typeof fact.maximum)))
      || (fact.typeFamily === 'TEMPORAL'
        && (!([null, 'string'].includes(fact.freshnessMaximum === null ? null : typeof fact.freshnessMaximum))
          || fact.freshnessMaximum !== fact.maximum))
      ) fail('DB_PROFILING_RESULT_INVALID');
    const key = `${fact.schemaName}\u0000${fact.relationName}\u0000${fact.columnName}`;
    if (sensitive.has(key)) fail('DB_PROFILING_SENSITIVE_TARGET_DENIED');
    if (fact.distribution !== null) fail('DB_PROFILING_DISTRIBUTION_DENIED');
    if (seen.has(key)) fail('DB_PROFILING_RESULT_INVALID');
    seen.add(key);
    const normalized = normalizeJsonValue(fact);
    return { ...normalized, objectSha256: identitySha256({ engine: profile.engine, fact: normalized }) };
  }).sort(compareRows(['schemaName', 'relationName', 'columnName']));
  validateProfilingQueryManifest(profilingManifest, profilingSqlByQueryId);
  if (profilingManifest.engine !== profile.engine
    || profilingManifest.queries.some((query) => query.timeoutMs > profiling.budgets.maxQueryTimeoutMs)) fail('DB_PROFILING_QUERY_POLICY_DENIED');
  const queryPlan = facts.map((fact) => compileProfilingQuery({
    manifest: profilingManifest,
    sqlByQueryId: profilingSqlByQueryId,
    target: {
      schemaName: fact.schemaName,
      relationName: fact.relationName,
      columnName: fact.columnName,
      typeFamily: fact.typeFamily,
    },
  }));
  const policySha256 = identitySha256(profiling);
  const coverage = buildProfilingCoverageLedger({
    profile,
    attempts: facts.map((fact) => ({
      ...profilingTarget(fact),
      typeFamily: fact.typeFamily,
      state: 'SUCCEEDED',
      reasonCode: null,
      factSha256: fact.objectSha256,
    })),
  });
  const body = normalizeJsonValue({
    schemaVersion: AGGREGATE_EVIDENCE_SCHEMA,
    engine: profile.engine,
    runtimeValidation: 'SYNTHETIC_UNVALIDATED',
    policySha256,
    queryPack: {
      packId: profilingManifest.packId,
      packVersion: profilingManifest.packVersion,
      manifestSha256: identitySha256(profilingManifest),
      queryCount: profilingManifest.queries.length,
      plannedQueryCount: queryPlan.length,
    },
    queryPlan,
    coverage,
    factCount: facts.length,
    facts,
  });
  const aggregate = { ...body, aggregateSha256: identitySha256(body) };
  return { ...aggregate, candidates: deriveProfilingCandidates(aggregate) };
}

const profilingReviewBinding = (evidence) => {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)
    || typeof evidence.snapshotSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(evidence.snapshotSha256)
    || !['mssql', 'oracle'].includes(evidence.engine)
    || !evidence.profile || !evidence.profiling) fail('DB_PROFILING_REVIEW_SOURCE_INVALID');
  const { snapshotSha256, ...analysisBody } = evidence;
  if (identitySha256(analysisBody) !== snapshotSha256) fail('DB_PROFILING_REVIEW_SOURCE_TAMPERED');
  const { candidates, ...aggregate } = evidence.profiling;
  if (canonicalJson(deriveProfilingCandidates(aggregate)) !== canonicalJson(candidates)) {
    fail('DB_PROFILING_REVIEW_SOURCE_TAMPERED');
  }
  const profile = evidence.profile;
  if (typeof profile.profileId !== 'string' || profile.profileId.length === 0
    || !profile.scope || typeof profile.scope.database !== 'string'
    || !(profile.scope.container === null || typeof profile.scope.container === 'string')
    || !Array.isArray(profile.scope.schemas) || profile.scope.schemas.length === 0) {
    fail('DB_PROFILING_REVIEW_SOURCE_INVALID');
  }
  const structureSnapshotSha256 = identitySha256({
    engine: evidence.engine,
    runtimeValidation: evidence.runtimeValidation,
    packId: evidence.packId,
    packVersion: evidence.packVersion,
    coverageLedger: evidence.coverageLedger,
    extracts: evidence.extracts,
  });
  return normalizeJsonValue({
    scope: {
      profileId: profile.profileId,
      engine: evidence.engine,
      database: profile.scope.database,
      container: profile.scope.container,
      schemas: profile.scope.schemas,
    },
    evidence: {
      analysisSnapshotSha256: snapshotSha256,
      structureSnapshotSha256,
      profilingPolicySha256: aggregate.policySha256,
      queryManifestSha256: aggregate.queryPack.manifestSha256,
      aggregateSha256: aggregate.aggregateSha256,
      candidateSetSha256: candidates.candidateSetSha256,
    },
  });
};

export function buildProfilingReviewBinding(evidence) {
  return profilingReviewBinding(evidence);
}

export function authorizeProfilingProjection({ evidence, receipt }) {
  const binding = profilingReviewBinding(evidence);
  if (!hasExactKeys(receipt, [
    'schemaVersion', 'receiptId', 'authority', 'reviewedAt', 'scope', 'evidence', 'decisions', 'projectionDecision', 'receiptSha256',
  ]) || receipt.schemaVersion !== PROFILING_REVIEW_RECEIPT_SCHEMA
    || typeof receipt.receiptId !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,127}$/.test(receipt.receiptId)
    || !hasExactKeys(receipt.authority, ['type', 'reviewerId', 'identityAssurance', 'analyzerMayIssue', 'productionAuthority'])
    || receipt.authority.type !== 'SYNTHETIC_HUMAN_REVIEW_FIXTURE'
    || typeof receipt.authority.reviewerId !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,127}$/.test(receipt.authority.reviewerId)
    || receipt.authority.identityAssurance !== 'TEST_FIXTURE_ONLY'
    || receipt.authority.analyzerMayIssue !== false
    || receipt.authority.productionAuthority !== false
    || typeof receipt.reviewedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(receipt.reviewedAt)
    || Number.isNaN(Date.parse(receipt.reviewedAt))
    || canonicalJson(receipt.scope) !== canonicalJson(binding.scope)
    || canonicalJson(receipt.evidence) !== canonicalJson(binding.evidence)
    || !hasExactKeys(receipt.projectionDecision, ['state', 'externalPublicationAuthority', 'directSourceDatabaseAccess'])
    || receipt.projectionDecision.state !== 'APPROVED_FOR_CURATED_PROJECTION'
    || receipt.projectionDecision.externalPublicationAuthority !== false
    || receipt.projectionDecision.directSourceDatabaseAccess !== false
    || !Array.isArray(receipt.decisions) || receipt.decisions.length === 0) {
    fail('DB_PROFILING_REVIEW_RECEIPT_INVALID');
  }
  const { receiptSha256, ...receiptBody } = receipt;
  if (!/^[a-f0-9]{64}$/.test(receiptSha256 ?? '') || identitySha256(receiptBody) !== receiptSha256) {
    fail('DB_PROFILING_REVIEW_RECEIPT_TAMPERED');
  }
  const candidates = [...evidence.profiling.candidates.semanticCandidates, ...evidence.profiling.candidates.qualityCandidates];
  const candidateBySha = new Map(candidates.map((candidate) => [candidate.candidateSha256, candidate]));
  const seen = new Set();
  for (const decision of receipt.decisions) {
    if (!hasExactKeys(decision, ['candidateSha256', 'candidateType', 'target', 'disposition', 'reasonCode'])
      || !['APPROVED', 'REJECTED'].includes(decision.disposition)
      || typeof decision.reasonCode !== 'string' || !/^[A-Z][A-Z0-9_]{2,127}$/.test(decision.reasonCode)
      || seen.has(decision.candidateSha256)) fail('DB_PROFILING_REVIEW_DECISIONS_INVALID');
    const candidate = candidateBySha.get(decision.candidateSha256);
    if (!candidate || decision.candidateType !== candidate.candidateType
      || canonicalJson(decision.target) !== canonicalJson(candidate.target)) fail('DB_PROFILING_REVIEW_DECISIONS_INVALID');
    seen.add(decision.candidateSha256);
  }
  if (seen.size !== candidateBySha.size || receipt.decisions.every((decision) => decision.disposition !== 'APPROVED')) {
    fail('DB_PROFILING_REVIEW_DECISIONS_INCOMPLETE');
  }
  const approvedCandidateSha256 = receipt.decisions
    .filter((decision) => decision.disposition === 'APPROVED')
    .map((decision) => decision.candidateSha256)
    .sort();
  return normalizeJsonValue({
    schemaVersion: 'chimpmaera.db/profiling-projection-authorization/v1',
    state: 'CURATED_PROJECTION_AUTHORIZED',
    authority: 'SYNTHETIC_FIXTURE_ONLY',
    productionAuthority: false,
    receiptSha256,
    candidateSetSha256: binding.evidence.candidateSetSha256,
    approvedCandidateSha256,
  });
}

export function buildProfilingKnowledgePack({ evidence, receipt }) {
  const authorization = authorizeProfilingProjection({ evidence, receipt });
  const binding = profilingReviewBinding(evidence);
  const candidates = [
    ...evidence.profiling.candidates.semanticCandidates,
    ...evidence.profiling.candidates.qualityCandidates,
  ];
  const candidateBySha = new Map(candidates.map((candidate) => [candidate.candidateSha256, candidate]));
  const approved = new Set(authorization.approvedCandidateSha256);
  if (candidateBySha.size !== candidates.length
    || approved.size !== authorization.approvedCandidateSha256.length
    || [...approved].some((candidateSha256) => !candidateBySha.has(candidateSha256))) {
    fail('DB_PROFILING_KNOWLEDGE_SOURCE_INVALID');
  }
  const entries = authorization.approvedCandidateSha256.map((candidateSha256) => {
    const candidate = candidateBySha.get(candidateSha256);
    return normalizeJsonValue({
      candidateSha256,
      candidateType: candidate.candidateType,
      target: candidate.target,
      classificationState: candidate.classificationState,
      semanticClaim: candidate.semanticClaim,
      reviewState: 'APPROVED_BY_BOUND_RECEIPT',
      signals: candidate.signals,
      metrics: candidate.metrics,
      evidenceRefs: candidate.evidenceRefs,
      receiptSha256: authorization.receiptSha256,
    });
  });
  if (entries.some((entry) => !approved.has(entry.candidateSha256)
    || entry.classificationState !== 'UNKNOWN'
    || entry.semanticClaim !== 'NOT_ESTABLISHED')) {
    fail('DB_PROFILING_KNOWLEDGE_INVENTION_DENIED');
  }
  const body = normalizeJsonValue({
    schemaVersion: PROFILING_KNOWLEDGE_PACK_SCHEMA,
    state: 'CURATED_SYNTHETIC_FIXTURE',
    scope: binding.scope,
    source: {
      ...binding.evidence,
      receiptSha256: authorization.receiptSha256,
      runtimeValidation: evidence.runtimeValidation,
      profilingCoverageSha256: evidence.profiling.coverage.coverageSha256,
    },
    authority: {
      reviewAuthority: authorization.authority,
      productionAuthority: false,
      externalPublicationAuthority: false,
      directSourceDatabaseAccess: false,
    },
    claims: {
      semanticTruthEstablished: false,
      runtimeProfilingValidated: false,
      rowSamplesIncluded: false,
    },
    summary: {
      approvedCandidateCount: entries.length,
      knowledgeEntryCount: entries.length,
    },
    entries,
  });
  return { ...body, knowledgePackSha256: identitySha256(body) };
}

export function buildProfilingSupersetResult({ knowledgePack }) {
  if (!hasExactKeys(knowledgePack, [
    'schemaVersion', 'state', 'scope', 'source', 'authority', 'claims', 'summary', 'entries', 'knowledgePackSha256',
  ]) || knowledgePack.schemaVersion !== PROFILING_KNOWLEDGE_PACK_SCHEMA
    || knowledgePack.state !== 'CURATED_SYNTHETIC_FIXTURE'
    || !/^[a-f0-9]{64}$/.test(knowledgePack.knowledgePackSha256 ?? '')) {
    fail('DB_PROFILING_SUPERSET_SOURCE_INVALID');
  }
  const { knowledgePackSha256, ...knowledgeBody } = knowledgePack;
  if (identitySha256(knowledgeBody) !== knowledgePackSha256
    || knowledgePack.authority?.productionAuthority !== false
    || knowledgePack.authority?.externalPublicationAuthority !== false
    || knowledgePack.authority?.directSourceDatabaseAccess !== false
    || knowledgePack.claims?.semanticTruthEstablished !== false
    || knowledgePack.claims?.rowSamplesIncluded !== false
    || !Array.isArray(knowledgePack.entries)
    || knowledgePack.entries.length !== knowledgePack.summary?.knowledgeEntryCount) {
    fail('DB_PROFILING_SUPERSET_SOURCE_TAMPERED');
  }
  const candidateSha256 = new Set();
  const rows = knowledgePack.entries.map((entry) => {
    if (!hasExactKeys(entry, [
      'candidateSha256', 'candidateType', 'target', 'classificationState', 'semanticClaim', 'reviewState',
      'signals', 'metrics', 'evidenceRefs', 'receiptSha256',
    ]) || !/^[a-f0-9]{64}$/.test(entry.candidateSha256 ?? '')
      || candidateSha256.has(entry.candidateSha256)
      || entry.classificationState !== 'UNKNOWN'
      || entry.semanticClaim !== 'NOT_ESTABLISHED'
      || entry.reviewState !== 'APPROVED_BY_BOUND_RECEIPT'
      || !['KEY', 'TIME', 'AMOUNT', 'CATEGORY', 'QUALITY'].includes(entry.candidateType)) {
      fail('DB_PROFILING_SUPERSET_ENTRY_INVALID');
    }
    candidateSha256.add(entry.candidateSha256);
    return normalizeJsonValue({
      candidateSha256: entry.candidateSha256,
      candidateType: entry.candidateType,
      schemaName: entry.target.schemaName,
      relationName: entry.target.relationName,
      columnName: entry.target.columnName,
      classificationState: entry.classificationState,
      semanticClaim: entry.semanticClaim,
      reviewState: entry.reviewState,
      rowCount: entry.metrics.rowCount,
      distinctCount: entry.metrics.distinctCount,
      nullCount: entry.metrics.nullCount,
      signals: entry.signals,
      evidenceRefs: entry.evidenceRefs,
    });
  });
  const countsByType = Object.fromEntries(['AMOUNT', 'CATEGORY', 'KEY', 'QUALITY', 'TIME']
    .map((candidateType) => [candidateType, rows.filter((row) => row.candidateType === candidateType).length]));
  const body = normalizeJsonValue({
    schemaVersion: PROFILING_SUPERSET_RESULT_SCHEMA,
    state: 'CURATED_SYNTHETIC_FIXTURE',
    scope: knowledgePack.scope,
    source: {
      knowledgePackSha256,
      receiptSha256: knowledgePack.source.receiptSha256,
      runtimeValidation: knowledgePack.source.runtimeValidation,
    },
    authority: {
      productionAuthority: false,
      externalPublicationAuthority: false,
      automaticPublication: false,
      directSourceDatabaseAccess: false,
    },
    dataset: {
      datasetId: `${knowledgePack.scope.profileId}-curated-profile`,
      materialization: 'CONTENT_ADDRESSED_EMBEDDED_JSON',
      sourceConnection: null,
      sourceSql: null,
      rowSamplesIncluded: false,
      rowCount: rows.length,
      rows,
    },
    dashboard: {
      dashboardId: `${knowledgePack.scope.profileId}-data-understanding`,
      publicationState: 'DISCONNECTED_REVIEW_FIXTURE',
      charts: [
        { chartId: 'candidate-count-by-type', visualization: 'BAR', metric: 'candidateCount', values: countsByType },
        { chartId: 'null-observation-summary', visualization: 'TABLE', metric: 'nullCount', candidateSha256: rows.map((row) => row.candidateSha256) },
      ],
      drillThrough: {
        target: 'EMBEDDED_CURATED_DATASET',
        key: 'candidateSha256',
        sourceRoute: null,
      },
    },
    claims: {
      semanticTruthEstablished: false,
      runtimeProfilingValidated: false,
      supersetRuntimeValidated: false,
      rowSamplesIncluded: false,
    },
    summary: {
      curatedRowCount: rows.length,
      candidateCountsByType: countsByType,
    },
  });
  if (/sampleValue|sample_value|password|credential/i.test(canonicalJson(body))) {
    fail('DB_PROFILING_SUPERSET_UNSAFE_MATERIAL_DENIED');
  }
  return { ...body, supersetResultSha256: identitySha256(body) };
}

export function validateQueryManifest(manifest) {
  if (manifest?.schemaVersion !== QUERY_MANIFEST_SCHEMA) fail('DB_QUERY_MANIFEST_SCHEMA_INVALID');
  if (!['mssql', 'oracle'].includes(manifest.engine)) fail('DB_QUERY_MANIFEST_ENGINE_INVALID');
  if (!manifest.packId || !manifest.packVersion || !Array.isArray(manifest.queries) || manifest.queries.length === 0) fail('DB_QUERY_MANIFEST_INCOMPLETE');
  const ids = new Set();
  for (const query of manifest.queries) {
    if (!query.id || ids.has(query.id)) fail('DB_QUERY_MANIFEST_QUERY_ID_INVALID');
    ids.add(query.id);
    if (!QUERY_CATEGORIES.has(query.category) || query.readOnly !== true || !query.file) fail('DB_QUERY_MANIFEST_QUERY_BOUNDARY_INVALID');
    if (!Array.isArray(query.outputColumns) || query.outputColumns.length === 0 || new Set(query.outputColumns).size !== query.outputColumns.length) fail('DB_QUERY_MANIFEST_OUTPUT_INVALID');
    if (!Array.isArray(query.sortKeys) || query.sortKeys.some((key) => !query.outputColumns.includes(key))) fail('DB_QUERY_MANIFEST_SORT_KEY_INVALID');
    if (!(query.scopeColumn === null || query.outputColumns.includes(query.scopeColumn))) fail('DB_QUERY_MANIFEST_SCOPE_INVALID');
    if (!Number.isInteger(query.timeoutMs) || query.timeoutMs < 1 || !['LOW', 'BOUNDED'].includes(query.cost)) fail('DB_QUERY_MANIFEST_BUDGET_INVALID');
    if (!query.privilege?.minimum || !query.fallback?.onDenied || !query.provenance?.url || query.provenance.copiedCode !== false) fail('DB_QUERY_MANIFEST_PROVENANCE_INVALID');
  }
  return manifest;
}

function compareRows(keys) {
  return (left, right) => {
    for (const key of keys) {
      const comparison = Buffer.compare(Buffer.from(String(left[key] ?? ''), 'utf8'), Buffer.from(String(right[key] ?? ''), 'utf8'));
      if (comparison !== 0) return comparison;
    }
    return Buffer.compare(Buffer.from(canonicalJson(left), 'utf8'), Buffer.from(canonicalJson(right), 'utf8'));
  };
}

function normalizeRows(query, rows) {
  return rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) fail('DB_QUERY_RESULT_ROW_INVALID');
    const actual = Object.keys(row).sort();
    const expected = [...query.outputColumns].sort();
    if (canonicalJson(actual) !== canonicalJson(expected)) fail('DB_QUERY_RESULT_COLUMNS_INVALID');
    const normalized = normalizeJsonValue(Object.fromEntries(query.outputColumns.map((column) => [column, row[column]])));
    return { ...normalized, objectSha256: identitySha256({ queryId: query.id, object: normalized }) };
  }).sort(compareRows(query.sortKeys));
}

const hasAllowedKeys = (value, allowed) => value
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.keys(value).every((key) => allowed.includes(key));

function normalizeQueryResult(query, result) {
  if (!hasAllowedKeys(result, ['state', 'reasonCode', 'rows']) || !COVERAGE_STATES.includes(result.state)) {
    fail('DB_QUERY_RESULT_TAMPERED');
  }
  const hasVisibleRows = result.state === 'SUCCEEDED' || result.state === 'PARTIAL';
  if (hasVisibleRows && !Array.isArray(result.rows)) fail('DB_QUERY_RESULT_ROWS_MISSING');
  if (!hasVisibleRows && Array.isArray(result.rows) && result.rows.length > 0) fail('DB_QUERY_FAILED_STATE_ROWS_DENIED');
  if (result.state === 'SUCCEEDED' && ![undefined, null].includes(result.reasonCode)) fail('DB_QUERY_RESULT_REASON_INVALID');
  if (result.state !== 'SUCCEEDED'
    && (typeof result.reasonCode !== 'string' || !/^[A-Z][A-Z0-9_]{2,127}$/.test(result.reasonCode))) {
    fail('DB_QUERY_RESULT_REASON_INVALID');
  }
  const rows = hasVisibleRows ? normalizeRows(query, result.rows) : [];
  return {
    state: result.state,
    reasonCode: result.reasonCode ?? null,
    rows,
    visibility: COVERAGE_VISIBILITY[result.state],
    emptyInterpretation: result.state === 'SUCCEEDED' && rows.length === 0 ? 'VERIFIED_EMPTY' : 'NOT_CLAIMED',
  };
}

function buildCoverageLedger(extracts) {
  const stateCounts = Object.fromEntries(COVERAGE_STATES.map((state) => [state, extracts.filter((entry) => entry.state === state).length]));
  const entries = extracts.map((entry) => ({
    queryId: entry.queryId,
    category: entry.category,
    state: entry.state,
    reasonCode: entry.reasonCode,
    visibility: entry.visibility,
    rowCount: entry.rows.length,
    emptyInterpretation: entry.emptyInterpretation,
  }));
  return {
    schemaVersion: COVERAGE_LEDGER_SCHEMA,
    totalQueries: extracts.length,
    stateCounts,
    completeQueries: stateCounts.SUCCEEDED,
    partialQueries: stateCounts.PARTIAL,
    invisibleOrUnknownQueries: stateCounts.DENIED + stateCounts.TIMEOUT + stateCounts.ERROR,
    verifiedEmptyQueries: entries.filter((entry) => entry.emptyInterpretation === 'VERIFIED_EMPTY').length,
    allComplete: stateCounts.SUCCEEDED === extracts.length,
    entries,
  };
}

export function buildPreflightEvidence({ manifest, sqlByQueryId, resultSets, profileContext, profilingEvidence }) {
  validateQueryManifest(manifest);
  const synthetic = resultSets?.schemaVersion === 'chimpmaera.db/synthetic-query-results/v1' && resultSets.runtimeValidated === false;
  const runtime = resultSets?.schemaVersion === 'chimpmaera.db/runtime-query-results/v1' && resultSets.runtimeValidated === true;
  if ((!synthetic && !runtime) || resultSets.engine !== manifest.engine
    || !hasAllowedKeys(resultSets, ['schemaVersion', 'engine', 'runtimeValidated', 'observedAt', 'results'])
    || !resultSets.results || typeof resultSets.results !== 'object' || Array.isArray(resultSets.results)) {
    fail('DB_QUERY_RESULT_CONTRACT_INVALID');
  }
  const expectedQueryIds = manifest.queries.map((query) => query.id).sort();
  if (canonicalJson(Object.keys(resultSets.results).sort()) !== canonicalJson(expectedQueryIds)) fail('DB_QUERY_RESULT_SET_TAMPERED');
  const extracts = manifest.queries.map((query) => {
    const sql = sqlByQueryId[query.id];
    const result = resultSets.results?.[query.id];
    if (typeof sql !== 'string' || !result) fail('DB_QUERY_RESULT_MISSING');
    const normalizedResult = normalizeQueryResult(query, result);
    const { rows } = normalizedResult;
    if (query.scopeColumn && profileContext
      && rows.some((row) => !profileContext.scope.schemas.includes(row[query.scopeColumn]))) fail('DB_QUERY_RESULT_SCOPE_INVALID');
    return {
      queryId: query.id,
      category: query.category,
      querySha256: sha256(normalizeSql(sql)),
      ...normalizedResult,
    };
  });
  const coverageLedger = buildCoverageLedger(extracts);
  const body = normalizeJsonValue({
    schemaVersion: PREFLIGHT_EVIDENCE_SCHEMA,
    packId: manifest.packId,
    packVersion: manifest.packVersion,
    engine: manifest.engine,
    runtimeValidation: runtime ? 'RUNTIME_VALIDATED' : 'SYNTHETIC_UNVALIDATED',
    identityContract: IDENTITY_CONTRACT,
    ...(resultSets.observedAt === undefined ? {} : { observedAt: resultSets.observedAt }),
    ...(profileContext === undefined ? {} : { profile: profileContext }),
    ...(profilingEvidence === undefined ? {} : { profiling: profilingEvidence }),
    coverage: coverageLedger.stateCounts,
    coverageLedger,
    extracts,
  });
  return { ...body, snapshotSha256: identitySha256(body) };
}
