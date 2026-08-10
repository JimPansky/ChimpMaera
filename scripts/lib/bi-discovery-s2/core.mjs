import { createHash } from 'node:crypto';

export const CONTRACT = 'chimpmaera.bi/approved-profile/v1';
export const ADAPTER_CONTRACT = 'chimpmaera.bi/normalized-profile-observations/v1';
export const sha256 = (value) => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
export const canonical = (value) => `${JSON.stringify(sort(value))}\n`;
const sort = (value) => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])])) : value;
const fail = (code) => { const error = new Error(code); error.code = code; throw error; };

export function validateRequest(request) {
  if (request?.schemaVersion !== 'chimpmaera.bi/profile-request/v1') fail('PROFILE_REQUEST_CONTRACT_INVALID');
  if (!request.scope?.tenantId || !request.scope?.sourceId || !request.scope?.scanId || !request.scope?.sourceDigest) fail('PROFILE_SCOPE_INCOMPLETE');
  if (!Array.isArray(request.selection?.objects) || request.selection.objects.length === 0) fail('PROFILE_SELECTION_EMPTY');
  if (request.selection.objects.length > request.budgets?.maxObjects) fail('PROFILE_OBJECT_BUDGET_EXCEEDED');
  const columns = request.selection.objects.flatMap((object) => object.columns || []);
  if (columns.length > request.budgets?.maxColumns) fail('PROFILE_COLUMN_BUDGET_EXCEEDED');
  if (request.budgets.rowSamples !== false || request.selection.rowSamples !== false) fail('PROFILE_ROW_SAMPLES_DISABLED');
  if (!Number.isInteger(request.budgets.maxQueries) || request.budgets.maxQueries < 1 || !Number.isInteger(request.budgets.timeoutMs) || request.budgets.timeoutMs < 1) fail('PROFILE_BUDGET_INVALID');
  return request;
}

export function validateNormalizedObservations(value, request) {
  validateRequest(request);
  if (value?.schemaVersion !== ADAPTER_CONTRACT) fail('PROFILE_ADAPTER_CONTRACT_INVALID');
  if (canonical(value.scope) !== canonical(request.scope)) fail('PROFILE_FOREIGN_SCOPE');
  if (value.execution?.readOnly !== true || value.execution?.cancelSafe !== true || value.execution?.rowSamples !== false) fail('PROFILE_EXECUTION_BOUNDARY_INVALID');
  if (value.execution.queryCount > request.budgets.maxQueries) fail('PROFILE_QUERY_BUDGET_EXCEEDED');
  if (value.execution.elapsedMs > request.budgets.timeoutMs) fail('PROFILE_TIMEOUT');
  const allowed = new Set(request.selection.objects.flatMap((object) => object.columns.map((column) => `${object.objectRef}\u001f${column}`)));
  const observed = new Set();
  for (const observation of value.columns || []) {
    const key = `${observation.objectRef}\u001f${observation.columnRef}`;
    if (!allowed.has(key)) fail('PROFILE_OBSERVATION_NOT_SELECTED');
    if (observed.has(key)) fail('PROFILE_DUPLICATE_OBSERVATION');
    observed.add(key);
    if (!observation.evidenceRef || !Number.isInteger(observation.rowCount) || !Number.isInteger(observation.nullCount) || observation.nullCount > observation.rowCount) fail('PROFILE_OBSERVATION_INVALID');
    if (observation.distribution && observation.distribution.length > request.budgets.maxDistributionBuckets) fail('PROFILE_DISTRIBUTION_BUDGET_EXCEEDED');
  }
  if (observed.size !== allowed.size) fail('PROFILE_OBSERVATION_INCOMPLETE');
  return value;
}

function candidate(observation) {
  if (observation.typeFamily === 'TEMPORAL') return 'TEMPORAL_CANDIDATE';
  if (observation.typeFamily === 'NUMERIC' && observation.distinctCount === observation.rowCount - observation.nullCount) return 'UNIQUE_VALUE_CANDIDATE';
  if (observation.distinctCount != null && observation.distinctCount <= 20) return 'LOW_CARDINALITY_CANDIDATE';
  return 'UNKNOWN_REVIEW_REQUIRED';
}

export function buildProfile(request, normalized) {
  validateNormalizedObservations(normalized, request);
  const facts = normalized.columns.map((item) => ({
    objectRef:item.objectRef, columnRef:item.columnRef, evidenceRef:item.evidenceRef, typeFamily:item.typeFamily,
    rowCount:item.rowCount, nullCount:item.nullCount, nullRatio:item.rowCount ? item.nullCount / item.rowCount : 0,
    distinctCount:item.distinctCount ?? null, minimum:item.minimum ?? null, maximum:item.maximum ?? null,
    freshnessMaximum:item.freshnessMaximum ?? null, distribution:item.distribution ?? [], candidate: candidate(item),
  })).sort((a,b) => `${a.objectRef}.${a.columnRef}`.localeCompare(`${b.objectRef}.${b.columnRef}`));
  const body = { schemaVersion:'chimpmaera.bi/profile-result/v1', scope:request.scope, selection:request.selection, budgets:request.budgets, execution:normalized.execution, facts };
  return { ...body, profileDigest:sha256(body) };
}

export function reviewProfile(profile, decision) {
  if (decision.profileDigest !== profile.profileDigest || decision.scopeDigest !== sha256(profile.scope)) fail('PROFILE_REVIEW_REBINDING_DENIED');
  const byKey = new Map(profile.facts.map((fact) => [`${fact.objectRef}\u001f${fact.columnRef}`, fact]));
  const reviewed = decision.columns.map((item) => {
    const fact = byKey.get(`${item.objectRef}\u001f${item.columnRef}`);
    if (!fact) fail('PROFILE_REVIEW_UNKNOWN_COLUMN');
    if (!['APPROVED_AGGREGATE','EXCLUDED_SENSITIVE','REVIEW_REQUIRED'].includes(item.disposition)) fail('PROFILE_REVIEW_DISPOSITION_INVALID');
    return { ...item, evidenceRef:fact.evidenceRef };
  });
  const body = { schemaVersion:'chimpmaera.bi/profile-review/v1', profileDigest:profile.profileDigest, scopeDigest:decision.scopeDigest, columns:reviewed };
  return { ...body, reviewDigest:sha256(body) };
}

export function approveProfile(profile, review) {
  if (review.profileDigest !== profile.profileDigest || review.scopeDigest !== sha256(profile.scope)) fail('PROFILE_APPROVAL_REBINDING_DENIED');
  const body = { schemaVersion:CONTRACT, scope:profile.scope, profileDigest:profile.profileDigest, reviewDigest:review.reviewDigest, facts:profile.facts, decisions:review.columns };
  return { ...body, approvalId:`approved:sha256:${sha256(body)}` };
}

export function buildProjection(approved, specification) {
  if (specification.approvalId !== approved.approvalId) fail('PROFILE_PROJECTION_TAMPERING_DENIED');
  const permitted = new Set(approved.decisions.filter((item) => item.disposition === 'APPROVED_AGGREGATE').map((item) => `${item.objectRef}\u001f${item.columnRef}`));
  for (const field of specification.fields) if (!permitted.has(`${field.objectRef}\u001f${field.columnRef}`)) fail('PROFILE_SENSITIVE_PROJECTION_DENIED');
  return { schemaVersion:'chimpmaera.bi/curated-projection/v1', approvalId:approved.approvalId, profileDigest:approved.profileDigest, fields:specification.fields, rows:specification.rows };
}
