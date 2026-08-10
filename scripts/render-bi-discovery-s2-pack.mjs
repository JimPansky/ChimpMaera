#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { approveProfile, buildProfile, buildProjection, reviewProfile, sha256 } from './lib/bi-discovery-s2/core.mjs';
import { deriveDolibarrKnowledge, dolibarr2203, dolibarrProjectionSpec } from './lib/bi-discovery-s2/dolibarr-fixture.mjs';
import { normalizeMariaDbProfile } from './lib/bi-discovery-s2/mariadb-adapter.mjs';
import { createSupersetBundle } from './lib/bi-discovery-s2/superset-consumer.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'knowledge/bi-discovery/dolibarr-22.0.3-mariadb-s2');
const fixturePath = path.join(root, 'tests/fixtures/bi-discovery-s2/dolibarr-mariadb-profile-v1.json');
const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])) : value;
const canonical = (value, pretty = false) => `${JSON.stringify(canonicalize(value), null, pretty ? 2 : 0)}\n`;
const digest = (value) => createHash('sha256').update(value).digest('hex');
const writeJson = async (file, value) => {
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, canonical(value, true), { mode:0o600 });
  await rename(tmp, file);
};

async function buildPack() {
  const normalized = normalizeMariaDbProfile(dolibarr2203.request, dolibarr2203.bindings, JSON.parse(await readFile(fixturePath, 'utf8')));
  const profile = buildProfile(dolibarr2203.request, normalized);
  const columns = profile.facts.map(({ objectRef, columnRef }) => ({
    objectRef,
    columnRef,
    disposition:['net_amount', 'tax_amount', 'gross_amount'].includes(columnRef) ? 'APPROVED_AGGREGATE' : 'REVIEW_REQUIRED',
  }));
  const review = reviewProfile(profile, { profileDigest:profile.profileDigest, scopeDigest:sha256(profile.scope), columns });
  const approved = approveProfile(profile, review);
  const recomputation = {
    orders:{ recordCount:3, netAmount:600, taxAmount:114, grossAmount:714 },
    invoices:{ recordCount:2, netAmount:300, taxAmount:57, grossAmount:357 },
  };
  const knowledge = deriveDolibarrKnowledge(approved, recomputation);
  const projection = buildProjection(approved, dolibarrProjectionSpec(approved, recomputation));
  const superset = createSupersetBundle(approved, projection, { datasetName:'cm_discovery_s2_sales_profile', title:'ChimpMaera Dolibarr sales profile starter' });
  const manifest = {
    schemaVersion:'chimpmaera.bi/discovery-s2-pack/v1',
    stage1SourceDigest:dolibarr2203.request.scope.sourceDigest,
    stage1ScanId:dolibarr2203.request.scope.scanId,
    domain:dolibarr2203.domain,
    profileDigest:profile.profileDigest,
    approvalId:approved.approvalId,
    rowSamples:false,
    directSupersetSourceRoute:false,
    artifactDigests:{
      normalized:digest(canonical(normalized, true)),
      profile:digest(canonical(profile, true)),
      review:digest(canonical(review, true)),
      approval:digest(canonical(approved, true)),
      knowledge:digest(canonical(knowledge, true)),
      projection:digest(canonical(projection, true)),
      superset:digest(canonical(superset, true)),
    },
    nonClaims:['single Dolibarr sales orders/invoices domain only', 'aggregate approved projection only', 'no row samples', 'no production readiness'],
  };
  return { normalized, profile, review, approved, knowledge, projection, superset, manifest };
}

async function writePack(pack) {
  await rm(outDir, { recursive:true, force:true });
  await mkdir(path.join(outDir, 'superset'), { recursive:true, mode:0o700 });
  const files = {
    'scan-manifest.json':pack.manifest,
    'normalized-profile.json':pack.normalized,
    'profile.json':pack.profile,
    'review.json':pack.review,
    'approval.json':pack.approved,
    'knowledge.json':pack.knowledge,
    'superset/sales_profile.json':pack.projection,
    'superset/dashboard.json':pack.superset,
  };
  for (const [name, value] of Object.entries(files)) await writeJson(path.join(outDir, name), value);
  const sums = [];
  for (const name of Object.keys(files).sort()) sums.push(`${digest(await readFile(path.join(outDir, name)))}  ${name}`);
  await writeFile(path.join(outDir, 'SHA256SUMS'), `${sums.join('\n')}\n`, { mode:0o600 });
}

async function verifyPack() {
  const pack = await buildPack();
  const manifest = JSON.parse(await readFile(path.join(outDir, 'scan-manifest.json'), 'utf8'));
  if (canonical(manifest) !== canonical(pack.manifest)) throw new Error('BI_DISCOVERY_S2_PACK_MANIFEST_STALE');
  const sums = (await readFile(path.join(outDir, 'SHA256SUMS'), 'utf8')).trim().split('\n');
  for (const line of sums) {
    const match = /^([a-f0-9]{64})  ([A-Za-z0-9._/-]+)$/.exec(line);
    if (!match) throw new Error('BI_DISCOVERY_S2_PACK_CHECKSUM_FORMAT');
    if (digest(await readFile(path.join(outDir, match[2]))) !== match[1]) throw new Error('BI_DISCOVERY_S2_PACK_TAMPERED');
  }
  return { status:'PASS', profileDigest:manifest.profileDigest, approvalId:manifest.approvalId };
}

if (process.argv.includes('--check')) {
  console.log(JSON.stringify(await verifyPack()));
} else {
  await writePack(await buildPack());
  console.log(JSON.stringify(await verifyPack()));
}
