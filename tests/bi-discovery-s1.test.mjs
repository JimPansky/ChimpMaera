import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const collector=path.resolve('scripts/collect-bi-discovery-s1.mjs');
const fixture=path.resolve('tests/fixtures/bi-discovery-s1/metadata-subset-v1.json');
const truth=path.resolve('tests/fixtures/bi-discovery-s1/ground-truth-v1.json');
const driftFixture=path.resolve('tests/fixtures/bi-discovery-s1/controlled-drift-v1.json');
const digest=(value)=>createHash('sha256').update(value).digest('hex');
const run=(args)=>spawnSync(process.execPath,[collector,...args],{encoding:'utf8',timeout:30_000});
const scan=(output,extra=[])=>run(['--input',fixture,'--ground-truth',truth,'--output',output,...extra]);
const load=async (directory,name)=>JSON.parse(await readFile(path.join(directory,name),'utf8'));

test('curated Dolibarr ground truth is complete without invented objects or edges', async (t)=>{
  const temp=await mkdtemp(path.join(tmpdir(),'cm-bi-discovery-truth-')); t.after(()=>rm(temp,{recursive:true,force:true}));
  const result=scan(temp); assert.equal(result.status,0,result.stderr); const manifest=await load(temp,'scan-manifest.json');
  assert.deepEqual(manifest.groundTruth,{status:'PASS',mandatoryObjects:{found:10,total:10},mandatoryEdges:{found:3,total:3},inventedObjects:0,inventedEdges:0,scope:'CURATED_MANDATORY_SUBSET_NOT_FULL_DOLIBARR_SEMANTICS'});
});

test('view columns and dependencies resolve to stable visible object IDs without dangling edges', async (t)=>{
  const temp=await mkdtemp(path.join(tmpdir(),'cm-bi-discovery-view-')); t.after(()=>rm(temp,{recursive:true,force:true})); const value=JSON.parse(await readFile(fixture,'utf8'));
  value.tables.push({schemaName:'dolidb',name:'llx_order_view',tableType:'VIEW',engine:null,createOptions:''}); value.columns.push({schemaName:'dolidb',tableName:'llx_order_view',name:'rowid',ordinal:1,dataType:'bigint',columnType:'bigint(20)',nullable:'NO',characterLength:null,numericPrecision:19,numericScale:0,datetimePrecision:null,extra:''}); value.viewDependencies.push({schemaName:'dolidb',viewName:'llx_order_view',referencedSchema:'dolidb',referencedTable:'llx_commande'});
  const input=path.join(temp,'input.json'); await writeFile(input,JSON.stringify(value)); const output=path.join(temp,'output'); const result=run(['--input',input,'--ground-truth',truth,'--output',output]); assert.equal(result.status,0,result.stderr); const evidence=await load(output,'evidence.json'); const ids=new Set(evidence.inventory.map((item)=>item.id));
  assert.ok(evidence.edges.some((edge)=>edge.kind==='VIEW_HAS_COLUMN')); assert.ok(evidence.edges.some((edge)=>edge.kind==='VIEW_DEPENDS_ON')); assert.ok(evidence.edges.every((edge)=>ids.has(edge.fromId)&&ids.has(edge.toId)));
});

test('unchanged rescan preserves scan identity, evidence, knowledge and curated projections', async (t)=>{
  const temp=await mkdtemp(path.join(tmpdir(),'cm-bi-discovery-rescan-')); t.after(()=>rm(temp,{recursive:true,force:true})); const first=path.join(temp,'first'),second=path.join(temp,'second');
  assert.equal(scan(first).status,0); const result=scan(second,['--compare',path.join(first,'evidence.json')]); assert.equal(result.status,0,result.stderr);
  for (const name of ['evidence.json','knowledge.json','superset/inventory.json','superset/relationships.json','superset/coverage.json']) assert.equal(digest(await readFile(path.join(first,name))),digest(await readFile(path.join(second,name))),name);
  assert.equal((await load(first,'scan-manifest.json')).scanId,(await load(second,'scan-manifest.json')).scanId);
  assert.equal((await load(second,'drift.json')).status,'UNCHANGED');
});

test('credential verifier rotation cannot perturb metadata evidence identity', async (t)=>{
  const temp=await mkdtemp(path.join(tmpdir(),'cm-bi-discovery-credential-')); t.after(()=>rm(temp,{recursive:true,force:true})); const original=JSON.parse(await readFile(fixture,'utf8'));
  const scanWithVerifier=async (name,verifier)=>{ const value=structuredClone(original); value.grants[0]+=` IDENTIFIED BY PASSWORD '${verifier}'`; const input=path.join(temp,`${name}.json`); await writeFile(input,JSON.stringify(value)); const output=path.join(temp,name); const result=run(['--input',input,'--ground-truth',truth,'--output',output]); assert.equal(result.status,0,result.stderr); return load(output,'evidence.json'); };
  const first=await scanWithVerifier('first','*AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'); const second=await scanWithVerifier('second','*BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
  assert.equal(first.sourceDigest,second.sourceDigest); assert.equal(first.extracts.find((entry)=>entry.name==='grants').sha256,second.extracts.find((entry)=>entry.name==='grants').sha256);
});

test('controlled source-free overlay yields the exact seven additions and no false changes', async (t)=>{
  const temp=await mkdtemp(path.join(tmpdir(),'cm-bi-discovery-drift-')); t.after(()=>rm(temp,{recursive:true,force:true})); const baseline=path.join(temp,'baseline'),changed=path.join(temp,'changed'); const sourceBefore=digest(await readFile(fixture));
  assert.equal(scan(baseline).status,0); const result=scan(changed,['--compare',path.join(baseline,'evidence.json'),'--controlled-drift',driftFixture]); assert.equal(result.status,0,result.stderr);
  const drift=await load(changed,'drift.json'); assert.deepEqual({status:drift.status,added:drift.added.length,removed:drift.removed.length,changed:drift.changed.length},{status:'DRIFT',added:7,removed:0,changed:0}); assert.equal(digest(await readFile(fixture)),sourceBefore);
});

test('knowledge facts and all three projections remain evidence-bound and metadata-only', async (t)=>{
  const temp=await mkdtemp(path.join(tmpdir(),'cm-bi-discovery-knowledge-')); t.after(()=>rm(temp,{recursive:true,force:true})); assert.equal(scan(temp).status,0);
  const evidence=await load(temp,'evidence.json'),knowledge=await load(temp,'knowledge.json'),manifest=await load(temp,'scan-manifest.json');
  assert.equal(knowledge.sourceDigest,evidence.sourceDigest); assert.ok(knowledge.facts.every((fact)=>fact.sourceDigest===evidence.sourceDigest && fact.evidenceIds.every((id)=>id.startsWith('extract:')) && fact.confidence));
  assert.deepEqual(manifest.securityBoundary,{rowData:false,rowProfiling:false,credentials:false,rawStoredCode:false,dynamicFactsGuessed:false,supersetSourceRoute:false});
  for (const name of ['inventory','relationships','coverage']) { const projection=await load(temp,`superset/${name}.json`); assert.equal(projection.sourceDigest,evidence.sourceDigest); assert.ok(projection.rows.length>0); }
  assert.doesNotMatch(await readFile(path.join(temp,'evidence.json'),'utf8'),/(password|action_statement|routine_definition|view_definition|row_sample)/i);
});

test('negative rights, scope, identity and visibility matrix fails closed with typed errors', async (t)=>{
  const temp=await mkdtemp(path.join(tmpdir(),'cm-bi-discovery-negative-')); t.after(()=>rm(temp,{recursive:true,force:true})); const original=JSON.parse(await readFile(fixture,'utf8'));
  const cases=[
    ['insufficient-rights',(value)=>{value.grants=value.grants.map((entry)=>entry.replace('REFERENCES, ',''));},'BI_DISCOVERY_INSUFFICIENT_RIGHTS'],
    ['excessive-rights',(value)=>{value.grants.push('GRANT SELECT ON `dolidb`.* TO `cm_discovery_s1`@`%`');},'BI_DISCOVERY_EXCESSIVE_RIGHTS'],
    ['privileged-identity',(value)=>{value.identity[0].currentUser='root@localhost';},'BI_DISCOVERY_PRIVILEGED_IDENTITY_DENIED'],
    ['foreign-scope',(value)=>{value.tables[0].schemaName='foreign_db';},'BI_DISCOVERY_FOREIGN_SCOPE'],
    ['incomplete-visibility',(value)=>{delete value.columns;},'BI_DISCOVERY_INCOMPLETE_VISIBILITY'],
  ];
  for (const [name,mutate,code] of cases) { const value=structuredClone(original); mutate(value); const input=path.join(temp,`${name}.json`); await writeFile(input,JSON.stringify(value)); const result=run(['--input',input,'--output',path.join(temp,`${name}-out`)]); assert.notEqual(result.status,0,name); assert.match(result.stderr,new RegExp(code),name); }
  const state=path.join(temp,'state'); await mkdir(state); await writeFile(path.join(state,'.chimpmaera-bi-discovery-s1-owned'),'chimpmaera-bi-discovery-s1-v1\n'); await writeFile(path.join(state,'discovery-password'),`${'a'.repeat(48)}\n`);
  const unavailable=spawnSync(process.execPath,[collector,'--demo-root',temp,'--output',path.join(temp,'unavailable-out')],{encoding:'utf8',env:{...process.env,CM_BI_DISCOVERY_STATE:state,PATH:path.join(temp,'missing-path')}});
  assert.notEqual(unavailable.status,0); assert.match(unavailable.stderr,/BI_DISCOVERY_SOURCE_UNAVAILABLE/);
  const fakeBin=path.join(temp,'bin'); await mkdir(fakeBin); const fakeDocker=path.join(fakeBin,'docker'); await writeFile(fakeDocker,'#!/bin/sh\nsleep 1\n'); await chmod(fakeDocker,0o700);
  const timeout=spawnSync(process.execPath,[collector,'--demo-root',temp,'--output',path.join(temp,'timeout-out')],{encoding:'utf8',env:{...process.env,CM_BI_DISCOVERY_STATE:state,CM_BI_DISCOVERY_QUERY_TIMEOUT_MS:'20',PATH:`${fakeBin}:${process.env.PATH}`}});
  assert.notEqual(timeout.status,0); assert.match(timeout.stderr,/BI_DISCOVERY_SOURCE_TIMEOUT/);
});

test('tampered artifact verification fails closed', async (t)=>{
  const temp=await mkdtemp(path.join(tmpdir(),'cm-bi-discovery-tamper-')); t.after(()=>rm(temp,{recursive:true,force:true})); assert.equal(scan(temp).status,0); const target=path.join(temp,'knowledge.json'); await writeFile(target,`${await readFile(target,'utf8')} `); const result=run(['--verify',temp]); assert.notEqual(result.status,0); assert.match(result.stderr,/BI_DISCOVERY_TAMPERED_ARTIFACT/);
});

test('artifact verification rejects checksum path traversal and manifest rebinding', async (t)=>{
  const temp=await mkdtemp(path.join(tmpdir(),'cm-bi-discovery-pack-')); t.after(()=>rm(temp,{recursive:true,force:true})); assert.equal(scan(temp).status,0);
  const sums=await readFile(path.join(temp,'SHA256SUMS'),'utf8'); await writeFile(path.join(temp,'SHA256SUMS'),`${sums}${'0'.repeat(64)}  ../foreign.json\n`);
  let result=run(['--verify',temp]); assert.notEqual(result.status,0); assert.match(result.stderr,/BI_DISCOVERY_ARTIFACT_SET_MISMATCH/);
  assert.equal(scan(temp).status,0); const manifest=await load(temp,'scan-manifest.json'); manifest.artifactDigests.knowledge='0'.repeat(64); await writeFile(path.join(temp,'scan-manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);
  const manifestDigest=digest(await readFile(path.join(temp,'scan-manifest.json'))); const lines=(await readFile(path.join(temp,'SHA256SUMS'),'utf8')).split('\n').map((line)=>line.endsWith('  scan-manifest.json') ? `${manifestDigest}  scan-manifest.json` : line); await writeFile(path.join(temp,'SHA256SUMS'),lines.join('\n'));
  result=run(['--verify',temp]); assert.notEqual(result.status,0); assert.match(result.stderr,/BI_DISCOVERY_MANIFEST_DIGEST_MISMATCH/);
});

test('lifecycle is explicit, marker-scoped and gives Superset no MariaDB route', async ()=>{
  const config=JSON.parse(await readFile('demo/bi-discovery/config.example.json','utf8')); assert.equal(config.enabled,false); assert.equal(config.supersetDirectSourceAccess,false);
  const setup=await readFile('demo/bi-discovery/setup.sh','utf8'),lib=await readFile('demo/bi-discovery/lib.sh','utf8'),reset=await readFile('demo/bi-discovery/reset.sh','utf8'),supersetCompose=await readFile('demo/bi-superset/compose.yaml','utf8');
  assert.match(setup,/cm_bd_provision_principal/); assert.doesNotMatch(setup,/root_sql.*IDENTIFIED BY/); assert.match(lib,/GRANT EVENT, REFERENCES, SHOW VIEW, TRIGGER/); assert.doesNotMatch(lib,/GRANT SELECT|GRANT ALL|GRANT EXECUTE/);
  assert.match(reset,/ambiguous Superset projection ownership/); assert.match(reset,/DROP USER IF EXISTS/); assert.match(reset,/tampered Superset projection denied/); assert.doesNotMatch(supersetCompose,/doli_db_net|doli-db|dolidb|MARIADB/);
});

test('Superset bootstrap owns exactly three discovery datasets and preserves M0 default path', async ()=>{
  const bootstrap=await readFile('demo/bi-superset/runtime/bootstrap.py','utf8'),readiness=await readFile('demo/bi-superset/runtime/readiness.py','utf8');
  for (const table of ['cm_discovery_inventory','cm_discovery_relationships','cm_discovery_coverage']) { assert.ok(bootstrap.includes(table)); assert.ok(readiness.includes(table)); }
  assert.match(bootstrap,/DISCOVERY_DATASETS = \[/); assert.match(bootstrap,/no ERP row data, credentials or stored code/i); assert.match(readiness,/datasetCount.*discoveryProjectionCount/);
});
