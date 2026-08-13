#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const packIndex=process.argv.indexOf('--pack');
if (packIndex<0 || !process.argv[packIndex+1]) throw new Error('BI_DISCOVERY_SUPERSET_PACK_REQUIRED');
const pack=path.resolve(process.argv[packIndex+1]);
const verification=spawnSync(process.execPath,[path.join(root,'scripts/collect-bi-discovery-s1.mjs'),'--verify',pack],{encoding:'utf8',timeout:30_000});
if (verification.status!==0) throw new Error('BI_DISCOVERY_SUPERSET_TAMPER_DENIED');
process.stdout.write('BI-DISCOVERY-S1 projections verified. CM no longer owns a Superset runtime; publish through the external Superset_BI_Agent service boundary.\n');
