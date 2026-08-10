import { createHash } from 'node:crypto';

export const QUERY_MANIFEST_SCHEMA = 'chimpmaera.db/query-manifest/v1';
export const PREFLIGHT_EVIDENCE_SCHEMA = 'chimpmaera.db/preflight-evidence/v1';
export const ANALYZE_PROFILE_SCHEMA = 'chimpmaera.db/analyze-profile/v1';
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
  if (!hasExactKeys(profile.policy, ['access', 'allowRowSamples', 'maxQueryTimeoutMs'])
    || profile.policy.access !== 'READ_ONLY' || profile.policy.allowRowSamples !== false
    || !Number.isInteger(profile.policy.maxQueryTimeoutMs) || profile.policy.maxQueryTimeoutMs < 1) fail('DB_ANALYZE_PROFILE_POLICY_INVALID');
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

export function buildPreflightEvidence({ manifest, sqlByQueryId, resultSets, profileContext }) {
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
    coverage: coverageLedger.stateCounts,
    coverageLedger,
    extracts,
  });
  return { ...body, snapshotSha256: identitySha256(body) };
}
