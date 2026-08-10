#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmod, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha256=(value)=>createHash('sha256').update(value).digest('hex');
const packIndex=process.argv.indexOf('--pack');
if (packIndex<0 || !process.argv[packIndex+1]) throw new Error('BI_DISCOVERY_SUPERSET_PACK_REQUIRED');
const pack=path.resolve(process.argv[packIndex+1]);
const state=path.join(root,'demo/bi-superset/state');
const markerPath=path.join(state,'.chimpmaera-bi-superset-m0-owned');
const marker=await readFile(markerPath,'utf8').catch(()=>null);
if (!marker) { process.stdout.write('BI-DISCOVERY-S1 projections are ready; Superset is default-off and not initialized, so no projection was published.\n'); process.exit(0); }
if (marker.trim()!=='chimpmaera-bi-superset-m0-v1') throw new Error('BI_DISCOVERY_SUPERSET_OWNER_DENIED');
const verification=spawnSync(process.execPath,[path.join(root,'scripts/collect-bi-discovery-s1.mjs'),'--verify',pack],{encoding:'utf8',timeout:30_000});
if (verification.status!==0) throw new Error('BI_DISCOVERY_SUPERSET_TAMPER_DENIED');
const evidence=JSON.parse(await readFile(path.join(pack,'evidence.json'),'utf8'));
const projections={
  schemaVersion:'chimpmaera.bi/discovery-s1-superset-projections/v1',
  sourceDigest:evidence.sourceDigest,
  inventory:JSON.parse(await readFile(path.join(pack,'superset/inventory.json'),'utf8')),
  relationships:JSON.parse(await readFile(path.join(pack,'superset/relationships.json'),'utf8')),
  coverage:JSON.parse(await readFile(path.join(pack,'superset/coverage.json'),'utf8')),
};
for (const value of Object.values(projections).filter((item)=>item && typeof item==='object' && 'sourceDigest' in item)) if (value.sourceDigest!==evidence.sourceDigest) throw new Error('BI_DISCOVERY_SUPERSET_PROVENANCE_DENIED');
const body=`${JSON.stringify(projections,null,2)}\n`; const digest=sha256(body);
const destination=path.join(state,'discovery-projections.json'); const temporary=`${destination}.${process.pid}.tmp`;
await writeFile(temporary,body,{mode:0o600}); await chmod(temporary,0o600); await rename(temporary,destination);
const owner={schemaVersion:'chimpmaera.bi/discovery-s1-superset-owner/v1',sourceDigest:evidence.sourceDigest,sha256:digest};
const ownerPath=path.join(state,'.chimpmaera-bi-discovery-s1-projection-owned.json'); const ownerTemporary=`${ownerPath}.${process.pid}.tmp`;
await writeFile(ownerTemporary,`${JSON.stringify(owner,null,2)}\n`,{mode:0o600}); await chmod(ownerTemporary,0o600); await rename(ownerTemporary,ownerPath);
process.stdout.write(`BI-DISCOVERY-S1 published three curated owned Superset projections for source ${evidence.sourceDigest}.\n`);
