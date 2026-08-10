#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = 'chimpmaera.bi/discovery-s1/v1';
const SOURCE_SCHEMA = 'dolidb';
const COLLECTOR_VERSION = '1.0.0';
const FORBIDDEN_GRANTS = /\b(ALL PRIVILEGES|SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|EXECUTE|FILE|PROCESS|RELOAD|SHUTDOWN|SUPER|GRANT OPTION)\b/i;
const REQUIRED_GRANTS = ['REFERENCES', 'SHOW VIEW', 'TRIGGER', 'EVENT'];
const PACK_FILES = Object.freeze([
  'drift.json',
  'evidence.json',
  'knowledge.json',
  'scan-manifest.json',
  'superset/coverage.json',
  'superset/inventory.json',
  'superset/relationships.json',
]);

const QUERIES = Object.freeze({
  identity: `SELECT JSON_OBJECT('currentUser',CURRENT_USER(),'sessionUser',USER(),'databaseName','${SOURCE_SCHEMA}','engineVersion',VERSION())`,
  tables: `SELECT JSON_OBJECT('schemaName',TABLE_SCHEMA,'name',TABLE_NAME,'tableType',TABLE_TYPE,'engine',ENGINE,'createOptions',CREATE_OPTIONS) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${SOURCE_SCHEMA}' ORDER BY TABLE_NAME`,
  columns: `SELECT JSON_OBJECT('schemaName',TABLE_SCHEMA,'tableName',TABLE_NAME,'name',COLUMN_NAME,'ordinal',ORDINAL_POSITION,'dataType',DATA_TYPE,'columnType',COLUMN_TYPE,'nullable',IS_NULLABLE,'characterLength',CHARACTER_MAXIMUM_LENGTH,'numericPrecision',NUMERIC_PRECISION,'numericScale',NUMERIC_SCALE,'datetimePrecision',DATETIME_PRECISION,'extra',EXTRA) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${SOURCE_SCHEMA}' ORDER BY TABLE_NAME,ORDINAL_POSITION`,
  constraints: `SELECT JSON_OBJECT('schemaName',tc.TABLE_SCHEMA,'tableName',tc.TABLE_NAME,'name',tc.CONSTRAINT_NAME,'constraintType',tc.CONSTRAINT_TYPE,'columnName',kcu.COLUMN_NAME,'ordinal',kcu.ORDINAL_POSITION,'referencedSchema',kcu.REFERENCED_TABLE_SCHEMA,'referencedTable',kcu.REFERENCED_TABLE_NAME,'referencedColumn',kcu.REFERENCED_COLUMN_NAME) FROM information_schema.TABLE_CONSTRAINTS tc LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu ON kcu.CONSTRAINT_SCHEMA=tc.CONSTRAINT_SCHEMA AND kcu.TABLE_NAME=tc.TABLE_NAME AND kcu.CONSTRAINT_NAME=tc.CONSTRAINT_NAME WHERE tc.TABLE_SCHEMA='${SOURCE_SCHEMA}' ORDER BY tc.TABLE_NAME,tc.CONSTRAINT_NAME,kcu.ORDINAL_POSITION`,
  indexes: `SELECT JSON_OBJECT('schemaName',TABLE_SCHEMA,'tableName',TABLE_NAME,'name',INDEX_NAME,'columnName',COLUMN_NAME,'ordinal',SEQ_IN_INDEX,'uniqueIndex',IF(NON_UNIQUE=0,TRUE,FALSE),'indexType',INDEX_TYPE,'nullable',NULLABLE) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='${SOURCE_SCHEMA}' ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX`,
  routines: `SELECT JSON_OBJECT('schemaName',ROUTINE_SCHEMA,'name',ROUTINE_NAME,'routineType',ROUTINE_TYPE,'dataType',DATA_TYPE,'sqlDataAccess',SQL_DATA_ACCESS,'securityType',SECURITY_TYPE) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA='${SOURCE_SCHEMA}' ORDER BY ROUTINE_NAME`,
  triggers: `SELECT JSON_OBJECT('schemaName',TRIGGER_SCHEMA,'name',TRIGGER_NAME,'event',EVENT_MANIPULATION,'tableName',EVENT_OBJECT_TABLE,'timing',ACTION_TIMING) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA='${SOURCE_SCHEMA}' ORDER BY TRIGGER_NAME`,
  events: `SELECT JSON_OBJECT('schemaName',EVENT_SCHEMA,'name',EVENT_NAME,'status',STATUS,'eventType',EVENT_TYPE) FROM information_schema.EVENTS WHERE EVENT_SCHEMA='${SOURCE_SCHEMA}' ORDER BY EVENT_NAME`,
  viewDependencies: `SELECT JSON_OBJECT('schemaName',VIEW_SCHEMA,'viewName',VIEW_NAME,'referencedSchema',TABLE_SCHEMA,'referencedTable',TABLE_NAME) FROM information_schema.VIEW_TABLE_USAGE WHERE VIEW_SCHEMA='${SOURCE_SCHEMA}' ORDER BY VIEW_NAME,TABLE_SCHEMA,TABLE_NAME`,
});

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalize = (value) => Array.isArray(value)
  ? value.map(canonicalize)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
    : value;
const canonical = (value, pretty = false) => `${JSON.stringify(canonicalize(value), null, pretty ? 2 : 0)}\n`;
const id = (kind, ...parts) => `cmdb:${kind}:sha256:${sha256(parts.join('\u001f')).slice(0, 24)}`;
const deny = (code, detail = '') => { const error = new Error(detail ? `${code}:${detail}` : code); error.code = code; throw error; };
const sortById = (values) => values.sort((a, b) => a.id.localeCompare(b.id));
const sanitizeGrant = (grant) => grant.replace(/\b(USING|PASSWORD)\s+'[^']*'/gi, "$1 '[REDACTED]'");

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help') parsed.help = true;
    else if (token === '--verify') parsed.verify = argv[++index];
    else if (['--input','--output','--compare','--controlled-drift','--ground-truth','--demo-root'].includes(token)) parsed[token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++index];
    else deny('BI_DISCOVERY_ARGUMENT_DENIED', token);
  }
  return parsed;
}

function dockerQuery(demoRoot, query, password) {
  const config = path.join(demoRoot, '.chimpmaera-demo/config.env');
  const compose = path.join(demoRoot, 'demo/compose.yaml');
  const args = ['compose','--env-file',config,'--file',compose,'exec','-T','-e','MYSQL_PWD','doli-db','mariadb','--batch','--raw','--skip-column-names','--user=cm_discovery_s1','--database=information_schema','--execute',query];
  const configuredTimeout = Number(process.env.CM_BI_DISCOVERY_QUERY_TIMEOUT_MS || 30_000);
  if (!Number.isInteger(configuredTimeout) || configuredTimeout < 1 || configuredTimeout > 30_000) deny('BI_DISCOVERY_TIMEOUT_CONFIG_INVALID');
  const result = spawnSync('docker', args, { encoding:'utf8', timeout:configuredTimeout, maxBuffer:64 * 1024 * 1024, env:{...process.env, MYSQL_PWD:password} });
  if (result.error?.code === 'ETIMEDOUT') deny('BI_DISCOVERY_SOURCE_TIMEOUT');
  if (result.error?.code === 'ENOENT') deny('BI_DISCOVERY_SOURCE_UNAVAILABLE');
  const failure = (result.stderr || '').trim().slice(0, 240);
  if (result.status !== 0 && /(cannot connect|connection refused|is not running|no such service|no configuration file|env file .* not found)/i.test(failure)) deny('BI_DISCOVERY_SOURCE_UNAVAILABLE', failure);
  if (result.status !== 0) deny('BI_DISCOVERY_SOURCE_QUERY_DENIED', failure);
  return result.stdout.trim() ? result.stdout.trim().split('\n') : [];
}

async function liveExtracts(demoRoot) {
  const state = path.resolve(process.env.CM_BI_DISCOVERY_STATE || path.join(ROOT, 'demo/bi-discovery/state'));
  const marker = await readFile(path.join(state, '.chimpmaera-bi-discovery-s1-owned'), 'utf8').catch(() => deny('BI_DISCOVERY_MARKER_MISSING'));
  if (marker.trim() !== 'chimpmaera-bi-discovery-s1-v1') deny('BI_DISCOVERY_MARKER_INVALID');
  const password = (await readFile(path.join(state, 'discovery-password'), 'utf8').catch(() => deny('BI_DISCOVERY_CREDENTIAL_MISSING'))).trim();
  if (!/^[a-f0-9]{48}$/.test(password)) deny('BI_DISCOVERY_CREDENTIAL_INVALID');
  const grants = dockerQuery(demoRoot, 'SHOW GRANTS FOR CURRENT_USER', password);
  const extracts = { grants };
  for (const [name, query] of Object.entries(QUERIES)) {
    try { extracts[name] = dockerQuery(demoRoot, query, password).map((line) => JSON.parse(line)); }
    catch (error) {
      if (name === 'viewDependencies' && String(error.message).includes('SOURCE_QUERY_DENIED')) { extracts[name] = []; extracts[`${name}Unsupported`] = true; }
      else throw error;
    }
  }
  return extracts;
}

function validateExtracts(extracts) {
  const required = ['identity','grants','tables','columns','constraints','indexes','routines','triggers','events','viewDependencies'];
  for (const name of required) if (!Array.isArray(extracts[name])) deny('BI_DISCOVERY_INCOMPLETE_VISIBILITY', name);
  if (extracts.identity.length !== 1) deny('BI_DISCOVERY_SOURCE_IDENTITY_AMBIGUOUS');
  const identity = extracts.identity[0];
  if (identity.databaseName !== SOURCE_SCHEMA) deny('BI_DISCOVERY_FOREIGN_SCOPE', identity.databaseName);
  if (/^(root|admin)(@|$)/i.test(identity.currentUser || '') || identity.currentUser === identity.sessionUser && /^root/i.test(identity.sessionUser || '')) deny('BI_DISCOVERY_PRIVILEGED_IDENTITY_DENIED');
  const grantText = extracts.grants.join('\n');
  if (FORBIDDEN_GRANTS.test(grantText)) deny('BI_DISCOVERY_EXCESSIVE_RIGHTS');
  for (const privilege of REQUIRED_GRANTS) if (!grantText.toUpperCase().includes(privilege)) deny('BI_DISCOVERY_INSUFFICIENT_RIGHTS', privilege);
  for (const [name, rows] of Object.entries(extracts)) {
    if (!Array.isArray(rows) || name === 'identity' || name === 'grants') continue;
    for (const row of rows) {
      const scopes = [row.schemaName, row.referencedSchema].filter(Boolean);
      if (scopes.some((scope) => scope !== SOURCE_SCHEMA)) deny('BI_DISCOVERY_FOREIGN_SCOPE', `${name}:${scopes.join(',')}`);
    }
  }
}

function applyControlledDrift(extracts, drift) {
  if (drift.schemaName !== SOURCE_SCHEMA || drift.sourceMutation !== false) deny('BI_DISCOVERY_CONTROLLED_DRIFT_DENIED');
  const copy = structuredClone(extracts);
  copy.tables.push(...drift.tables); copy.columns.push(...drift.columns); copy.indexes.push(...drift.indexes);
  return copy;
}

function buildEvidence(extracts) {
  if (Array.isArray(extracts.grants)) extracts={...extracts,grants:extracts.grants.map(sanitizeGrant)};
  validateExtracts(extracts);
  const extractEvidence = Object.entries(extracts).filter(([, value]) => Array.isArray(value)).map(([name, rows]) => {
    const digest = sha256(canonical(rows));
    return { id:`extract:${name}:sha256:${digest}`, name, rowCount:rows.length, sha256:digest, classification:'METADATA_ONLY_NO_SOURCE_ROWS_NO_STORED_CODE' };
  }).sort((a,b) => a.name.localeCompare(b.name));
  const evidenceId = (name) => extractEvidence.find((entry) => entry.name === name).id;
  const inventory = [];
  inventory.push({ id:id('schema',SOURCE_SCHEMA), kind:'SCHEMA', schemaName:SOURCE_SCHEMA, name:SOURCE_SCHEMA, evidenceIds:[evidenceId('tables')] });
  for (const row of extracts.tables) inventory.push({ id:id(row.tableType === 'VIEW' ? 'view':'table',row.schemaName,row.name), kind:row.tableType === 'VIEW' ? 'VIEW':'TABLE', schemaName:row.schemaName, name:row.name, tableType:row.tableType, engine:row.engine || null, createOptions:row.createOptions || '', evidenceIds:[evidenceId('tables')] });
  for (const row of extracts.columns) inventory.push({ id:id('column',row.schemaName,row.tableName,row.name), kind:'COLUMN', schemaName:row.schemaName, parentName:row.tableName, name:row.name, ordinal:Number(row.ordinal), dataType:row.dataType, columnType:row.columnType, nullable:row.nullable === 'YES', characterLength:row.characterLength ?? null, numericPrecision:row.numericPrecision ?? null, numericScale:row.numericScale ?? null, datetimePrecision:row.datetimePrecision ?? null, extra:row.extra || '', evidenceIds:[evidenceId('columns')] });
  const groupedConstraints = Map.groupBy(extracts.constraints, (row) => `${row.schemaName}\u001f${row.tableName}\u001f${row.name}`);
  for (const rows of groupedConstraints.values()) {
    const row = rows[0]; const kind = row.constraintType === 'PRIMARY KEY' ? 'PRIMARY_KEY' : row.constraintType === 'FOREIGN KEY' ? 'FOREIGN_KEY' : 'CONSTRAINT';
    inventory.push({ id:id(kind.toLowerCase(),row.schemaName,row.tableName,row.name), kind, schemaName:row.schemaName, parentName:row.tableName, name:row.name, constraintType:row.constraintType, evidenceIds:[evidenceId('constraints')] });
  }
  const groupedIndexes = Map.groupBy(extracts.indexes, (row) => `${row.schemaName}\u001f${row.tableName}\u001f${row.name}`);
  for (const rows of groupedIndexes.values()) { const row=rows[0]; inventory.push({ id:id('index',row.schemaName,row.tableName,row.name), kind:'INDEX', schemaName:row.schemaName, parentName:row.tableName, name:row.name, unique:Boolean(row.uniqueIndex), indexType:row.indexType, evidenceIds:[evidenceId('indexes')] }); }
  for (const row of extracts.routines) inventory.push({ id:id('routine',row.schemaName,row.name), kind:'ROUTINE', schemaName:row.schemaName, name:row.name, routineType:row.routineType, dataType:row.dataType, sqlDataAccess:row.sqlDataAccess, securityType:row.securityType, evidenceIds:[evidenceId('routines')] });
  for (const row of extracts.triggers) inventory.push({ id:id('trigger',row.schemaName,row.name), kind:'TRIGGER', schemaName:row.schemaName, parentName:row.tableName, name:row.name, event:row.event, timing:row.timing, evidenceIds:[evidenceId('triggers')] });
  for (const row of extracts.events) inventory.push({ id:id('event',row.schemaName,row.name), kind:'EVENT', schemaName:row.schemaName, name:row.name, status:row.status, eventType:row.eventType, evidenceIds:[evidenceId('events')] });

  const edges = [];
  const relationKinds=new Map(extracts.tables.map((row)=>[`${row.schemaName}\u001f${row.name}`,row.tableType==='VIEW' ? 'view':'table']));
  for (const row of extracts.columns) { const relationKind=relationKinds.get(`${row.schemaName}\u001f${row.tableName}`); if (!relationKind) deny('BI_DISCOVERY_INCOMPLETE_VISIBILITY',`columns:${row.tableName}`); const edgeKind=relationKind==='view' ? 'VIEW_HAS_COLUMN':'TABLE_HAS_COLUMN'; edges.push({ id:id('edge',edgeKind,row.schemaName,row.tableName,row.name), kind:edgeKind, fromId:id(relationKind,row.schemaName,row.tableName), toId:id('column',row.schemaName,row.tableName,row.name), ordinal:Number(row.ordinal), evidenceIds:[evidenceId('columns')] }); }
  for (const row of extracts.constraints.filter((entry) => entry.columnName)) {
    const constraintKind = row.constraintType === 'PRIMARY KEY' ? 'primary_key' : row.constraintType === 'FOREIGN KEY' ? 'foreign_key' : 'constraint';
    edges.push({ id:id('edge','CONSTRAINT_HAS_COLUMN',row.schemaName,row.tableName,row.name,row.columnName,String(row.ordinal)), kind:'CONSTRAINT_HAS_COLUMN', fromId:id(constraintKind,row.schemaName,row.tableName,row.name), toId:id('column',row.schemaName,row.tableName,row.columnName), ordinal:Number(row.ordinal), evidenceIds:[evidenceId('constraints')] });
    if (row.constraintType === 'FOREIGN KEY' && row.referencedTable && row.referencedColumn) edges.push({ id:id('edge','FOREIGN_KEY_REFERENCES',row.schemaName,row.tableName,row.name,row.referencedTable,row.referencedColumn), kind:'FOREIGN_KEY_REFERENCES', fromId:id('foreign_key',row.schemaName,row.tableName,row.name), toId:id('column',row.referencedSchema,row.referencedTable,row.referencedColumn), evidenceIds:[evidenceId('constraints')] });
  }
  for (const row of extracts.indexes) edges.push({ id:id('edge','INDEX_HAS_COLUMN',row.schemaName,row.tableName,row.name,row.columnName,String(row.ordinal)), kind:'INDEX_HAS_COLUMN', fromId:id('index',row.schemaName,row.tableName,row.name), toId:id('column',row.schemaName,row.tableName,row.columnName), ordinal:Number(row.ordinal), evidenceIds:[evidenceId('indexes')] });
  for (const row of extracts.viewDependencies) { const targetKind=relationKinds.get(`${row.referencedSchema}\u001f${row.referencedTable}`); if (!targetKind) deny('BI_DISCOVERY_INCOMPLETE_VISIBILITY',`viewDependencies:${row.referencedTable}`); edges.push({ id:id('edge','VIEW_DEPENDS_ON',row.schemaName,row.viewName,row.referencedSchema,row.referencedTable), kind:'VIEW_DEPENDS_ON', fromId:id('view',row.schemaName,row.viewName), toId:id(targetKind,row.referencedSchema,row.referencedTable), evidenceIds:[evidenceId('viewDependencies')] }); }

  const inventoryIds=new Set(inventory.map((item)=>item.id));
  for (const edge of edges) if (!inventoryIds.has(edge.fromId) || !inventoryIds.has(edge.toId)) deny('BI_DISCOVERY_INCOMPLETE_VISIBILITY',`dangling-edge:${edge.kind}`);

  const coverage = [
    ...extractEvidence.map((entry) => ({ id:id('coverage',entry.name), subject:entry.name, status:'COVERED', classification:'NATIVE_INFORMATION_SCHEMA', evidenceIds:[entry.id] })),
    { id:id('coverage','row-data'), subject:'row-data', status:'EXCLUDED', classification:'SECURITY_BOUNDARY', detail:'No row samples or profiling were queried.' },
    { id:id('coverage','stored-code-body'), subject:'stored-code-body', status:'BLIND_SPOT', classification:'INTENTIONALLY_INVISIBLE', detail:'Stored object names and native attributes are inventoried; SQL/code bodies are excluded.' },
    { id:id('coverage','dynamic-sql-lineage'), subject:'dynamic-sql-lineage', status:'BLIND_SPOT', classification:'UNSUPPORTED_DYNAMIC_FACT', detail:'Dynamic and undeclared dependencies are not guessed.' },
    { id:id('coverage','routine-table-usage'), subject:'routine-table-usage', status:'BLIND_SPOT', classification:'ENGINE_METADATA_LIMIT', detail:'MariaDB Stage 1 does not expose a complete body-free native routine dependency relation.' },
    { id:id('coverage','routine-object-visibility'), subject:'routine-object-visibility', status:'BLIND_SPOT', classification:'SAFE_PRIVILEGE_LIMIT', detail:'Stage 1 does not grant EXECUTE or source-table access merely to expand routine visibility; only objects natively visible to the metadata-only principal are reported.' },
  ];
  if (extracts.viewDependenciesUnsupported) coverage.push({ id:id('coverage','view-dependencies-unsupported'), subject:'view-dependencies', status:'BLIND_SPOT', classification:'ENGINE_METADATA_UNAVAILABLE', detail:'VIEW_TABLE_USAGE was unavailable; no view dependency was guessed.' });
  const sourceDigest = sha256(canonical(extractEvidence.map(({id:_,...entry}) => entry)));
  return { schemaVersion:CONTRACT, layer:'EVIDENCE', source:{ application:'Dolibarr', applicationVersion:'22.0.3', engine:'MariaDB', database:SOURCE_SCHEMA, engineVersion:extracts.identity[0].engineVersion, principalClassification:'DEDICATED_METADATA_ONLY_READ_ONLY' }, sourceDigest, extracts:extractEvidence, inventory:sortById(inventory), edges:sortById(edges), coverage:sortById(coverage) };
}

function buildGroundTruth(evidence, truth) {
  if (!truth) return { status:'NOT_EVALUATED', mandatoryObjects:{found:0,total:0}, mandatoryEdges:{found:0,total:0}, inventedObjects:0, inventedEdges:0 };
  const inventoryKeys = new Set(evidence.inventory.map((item) => [item.kind,item.schemaName,item.parentName || '',item.name].join('|')));
  const edgeKeys = new Set(evidence.edges.map((edge) => [edge.kind,edge.fromId,edge.toId].join('|')));
  const objectFound = truth.mandatoryObjects.filter((key) => inventoryKeys.has(key)).length;
  const resolvedEdges = truth.mandatoryEdges.map((edge) => [edge.kind,id(...edge.from),id(...edge.to)].join('|'));
  const edgeFound = resolvedEdges.filter((key) => edgeKeys.has(key)).length;
  const result = { status:objectFound === truth.mandatoryObjects.length && edgeFound === resolvedEdges.length ? 'PASS':'FAIL', mandatoryObjects:{found:objectFound,total:truth.mandatoryObjects.length}, mandatoryEdges:{found:edgeFound,total:resolvedEdges.length}, inventedObjects:0, inventedEdges:0, scope:'CURATED_MANDATORY_SUBSET_NOT_FULL_DOLIBARR_SEMANTICS' };
  if (result.status !== 'PASS') deny('BI_DISCOVERY_GROUND_TRUTH_MISMATCH', canonical(result).trim());
  return result;
}

function buildKnowledge(evidence) {
  const count = (kind) => evidence.inventory.filter((item) => item.kind === kind).length;
  const fact = (name, statement, evidenceIds, classification='DIRECT_TECHNICAL_FACT', confidence='HIGH') => ({ id:id('knowledge',name,evidence.sourceDigest), name, statement, evidenceIds:[...new Set(evidenceIds)].sort(), confidence, classification, sourceDigest:evidence.sourceDigest });
  const tableExtract = evidence.extracts.find((entry) => entry.name === 'tables').id;
  const constraintExtract = evidence.extracts.find((entry) => entry.name === 'constraints').id;
  const storedEvidence = ['routines','triggers','events'].map((name) => evidence.extracts.find((entry) => entry.name === name).id);
  return { schemaVersion:CONTRACT, layer:'KNOWLEDGE', sourceDigest:evidence.sourceDigest, facts:sortById([
    fact('inventory-summary', `Schema ${SOURCE_SCHEMA} exposes ${count('TABLE')} tables, ${count('VIEW')} views and ${count('COLUMN')} columns.`, [tableExtract,evidence.extracts.find((entry)=>entry.name==='columns').id]),
    fact('declared-keys', `Native metadata exposes ${count('PRIMARY_KEY')} primary keys and ${count('FOREIGN_KEY')} declared foreign keys.`, [constraintExtract]),
    fact('visible-stored-objects', `Visible metadata exposes ${count('ROUTINE')} routines, ${count('TRIGGER')} triggers and ${count('EVENT')} events; bodies are excluded.`, storedEvidence),
    fact('blind-spots', `Dynamic SQL, undeclared semantics and stored-code bodies remain explicit blind spots and were not inferred.`, evidence.coverage.filter((item)=>item.status==='BLIND_SPOT').flatMap((item)=>item.evidenceIds || []), 'BOUNDARY_FACT', 'HIGH'),
  ]) };
}

function buildDrift(evidence, baseline) {
  if (!baseline) return { schemaVersion:CONTRACT, status:'BASELINE', baselineSourceDigest:null, currentSourceDigest:evidence.sourceDigest, added:[], removed:[], changed:[] };
  if (baseline.schemaVersion !== CONTRACT || baseline.layer !== 'EVIDENCE') deny('BI_DISCOVERY_BASELINE_INVALID');
  const project = (value) => new Map([...value.inventory,...value.edges].map((item) => {
    const structural = { ...item }; delete structural.evidenceIds;
    return [item.id, sha256(canonical(structural))];
  }));
  const before=project(baseline), after=project(evidence); const added=[],removed=[],changed=[];
  for (const [key,digest] of after) if (!before.has(key)) added.push(key); else if (before.get(key)!==digest) changed.push(key);
  for (const key of before.keys()) if (!after.has(key)) removed.push(key);
  return { schemaVersion:CONTRACT, status:added.length || removed.length || changed.length ? 'DRIFT':'UNCHANGED', baselineSourceDigest:baseline.sourceDigest, currentSourceDigest:evidence.sourceDigest, added:added.sort(), removed:removed.sort(), changed:changed.sort() };
}

function buildProjections(evidence) {
  return {
    inventory:{ schemaVersion:CONTRACT, projection:'inventory', sourceDigest:evidence.sourceDigest, rows:evidence.inventory.map((item)=>({ objectId:item.id,kind:item.kind,schemaName:item.schemaName,name:item.name,parentName:item.parentName || null,type:item.dataType || item.tableType || item.routineType || item.eventType || null,classification:'DIRECT_NATIVE_METADATA' })) },
    relationships:{ schemaVersion:CONTRACT, projection:'relationships-dependencies', sourceDigest:evidence.sourceDigest, rows:evidence.edges.map((edge)=>({ edgeId:edge.id,kind:edge.kind,fromId:edge.fromId,toId:edge.toId,classification:'DECLARED_OR_NATIVE_METADATA' })) },
    coverage:{ schemaVersion:CONTRACT, projection:'coverage-blind-spots', sourceDigest:evidence.sourceDigest, rows:evidence.coverage.map((item)=>({ coverageId:item.id,subject:item.subject,status:item.status,classification:item.classification,detail:item.detail || null })) },
  };
}

async function atomicJson(destination, value) {
  const temporary=`${destination}.${process.pid}.tmp`; await writeFile(temporary,canonical(value,true),{mode:0o600}); await chmod(temporary,0o600); await rename(temporary,destination);
}

async function writePack(output, pack) {
  await mkdir(path.join(output,'superset'),{recursive:true,mode:0o700});
  const files = { 'scan-manifest.json':pack.manifest, 'evidence.json':pack.evidence, 'knowledge.json':pack.knowledge, 'drift.json':pack.drift, 'superset/inventory.json':pack.projections.inventory, 'superset/relationships.json':pack.projections.relationships, 'superset/coverage.json':pack.projections.coverage };
  for (const [name,value] of Object.entries(files)) await atomicJson(path.join(output,name),value);
  const sums=[]; for (const name of Object.keys(files).sort()) sums.push(`${sha256(await readFile(path.join(output,name)))}  ${name}`);
  const temporary=path.join(output,`.SHA256SUMS.${process.pid}.tmp`); await writeFile(temporary,`${sums.join('\n')}\n`,{mode:0o600}); await chmod(temporary,0o600); await rename(temporary,path.join(output,'SHA256SUMS'));
}

async function verifyPack(output) {
  const sums=(await readFile(path.join(output,'SHA256SUMS'),'utf8')).trim().split('\n');
  const parsed=sums.map((line)=>{ const match=/^([a-f0-9]{64})  ([A-Za-z0-9._/-]+)$/.exec(line); if (!match) deny('BI_DISCOVERY_CHECKSUM_FORMAT'); return {sha256:match[1],name:match[2]}; });
  if (canonical(parsed.map((entry)=>entry.name).sort()) !== canonical(PACK_FILES)) deny('BI_DISCOVERY_ARTIFACT_SET_MISMATCH');
  for (const entry of parsed) if (sha256(await readFile(path.join(output,entry.name)))!==entry.sha256) deny('BI_DISCOVERY_TAMPERED_ARTIFACT',entry.name);
  const evidence=JSON.parse(await readFile(path.join(output,'evidence.json'),'utf8')); const knowledge=JSON.parse(await readFile(path.join(output,'knowledge.json'),'utf8')); const manifest=JSON.parse(await readFile(path.join(output,'scan-manifest.json'),'utf8'));
  if (evidence.schemaVersion!==CONTRACT || knowledge.sourceDigest!==evidence.sourceDigest || manifest.sourceDigest!==evidence.sourceDigest) deny('BI_DISCOVERY_PROVENANCE_MISMATCH');
  const sourceDigest=sha256(canonical(evidence.extracts.map(({id:_,...entry})=>entry)));
  if (sourceDigest!==evidence.sourceDigest || evidence.extracts.some((entry)=>entry.id!==`extract:${entry.name}:sha256:${entry.sha256}`)) deny('BI_DISCOVERY_EVIDENCE_DIGEST_MISMATCH');
  const artifacts={evidence,knowledge,drift:JSON.parse(await readFile(path.join(output,'drift.json'),'utf8')),inventoryProjection:JSON.parse(await readFile(path.join(output,'superset/inventory.json'),'utf8')),relationshipsProjection:JSON.parse(await readFile(path.join(output,'superset/relationships.json'),'utf8')),coverageProjection:JSON.parse(await readFile(path.join(output,'superset/coverage.json'),'utf8'))};
  for (const [name,value] of Object.entries(artifacts)) if (manifest.artifactDigests[name]!==sha256(canonical(value,true))) deny('BI_DISCOVERY_MANIFEST_DIGEST_MISMATCH',name);
  const knownEvidenceIds=new Set(evidence.extracts.map((entry)=>entry.id));
  if (knowledge.facts.some((fact)=>fact.sourceDigest!==evidence.sourceDigest || fact.evidenceIds.some((id)=>!knownEvidenceIds.has(id)))) deny('BI_DISCOVERY_KNOWLEDGE_EVIDENCE_MISMATCH');
  for (const name of ['inventoryProjection','relationshipsProjection','coverageProjection']) if (artifacts[name].sourceDigest!==evidence.sourceDigest) deny('BI_DISCOVERY_PROJECTION_PROVENANCE_MISMATCH',name);
  return { status:'PASS', files:parsed.length, sourceDigest:evidence.sourceDigest, scanId:manifest.scanId };
}

async function main() {
  const args=parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write('Usage: collect-bi-discovery-s1.mjs (--input FILE | --demo-root DIR) --output DIR [--ground-truth FILE] [--compare EVIDENCE] [--controlled-drift FILE]\n       collect-bi-discovery-s1.mjs --verify DIR\n'); return; }
  if (args.verify) { process.stdout.write(`${JSON.stringify(await verifyPack(path.resolve(args.verify)))}\n`); return; }
  if ((!args.input && !args.demoRoot) || (args.input && args.demoRoot) || !args.output) deny('BI_DISCOVERY_ARGUMENTS_INCOMPLETE');
  let extracts=args.input ? JSON.parse(await readFile(path.resolve(args.input),'utf8')) : await liveExtracts(path.resolve(args.demoRoot));
  if (args.controlledDrift) extracts=applyControlledDrift(extracts,JSON.parse(await readFile(path.resolve(args.controlledDrift),'utf8')));
  const evidence=buildEvidence(extracts);
  const truth=args.groundTruth ? JSON.parse(await readFile(path.resolve(args.groundTruth),'utf8')) : null;
  const groundTruth=buildGroundTruth(evidence,truth); const knowledge=buildKnowledge(evidence);
  const baseline=args.compare ? JSON.parse(await readFile(path.resolve(args.compare),'utf8')) : null; const drift=buildDrift(evidence,baseline); const projections=buildProjections(evidence);
  const querySetDigest=sha256(canonical(QUERIES)); const collectorDigest=sha256(canonical({contract:CONTRACT,version:COLLECTOR_VERSION,querySetDigest}));
  const manifest={ schemaVersion:CONTRACT, scanId:id('scan',evidence.sourceDigest,collectorDigest), sourceDigest:evidence.sourceDigest, sourceIdentity:evidence.source, collectorIdentity:{name:'ChimpMaera BI Discovery S1 collector',version:COLLECTOR_VERSION,contract:CONTRACT,querySetDigest,collectorDigest}, groundTruth, artifactDigests:{evidence:sha256(canonical(evidence,true)),knowledge:sha256(canonical(knowledge,true)),drift:sha256(canonical(drift,true)),inventoryProjection:sha256(canonical(projections.inventory,true)),relationshipsProjection:sha256(canonical(projections.relationships,true)),coverageProjection:sha256(canonical(projections.coverage,true))}, securityBoundary:{rowData:false,rowProfiling:false,credentials:false,rawStoredCode:false,dynamicFactsGuessed:false,supersetSourceRoute:false} };
  const output=path.resolve(args.output); await rm(output,{recursive:true,force:true}); await writePack(output,{manifest,evidence,knowledge,drift,projections});
  const verified=await verifyPack(output); process.stdout.write(`${JSON.stringify({...verified,groundTruth,drift:drift.status})}\n`);
}

main().catch((error)=>{ process.stderr.write(`${error.code || 'BI_DISCOVERY_FAILED'}: ${error.message}\n`); process.exitCode=1; });
