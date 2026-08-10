#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmod, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const packIndex = process.argv.indexOf('--pack');
if (packIndex < 0 || !process.argv[packIndex + 1]) throw new Error('BI_DISCOVERY_S2_SUPERSET_PACK_REQUIRED');
const pack = path.resolve(process.argv[packIndex + 1]);
const state = path.join(root, 'demo/bi-superset/state');
const markerPath = path.join(state, '.chimpmaera-bi-superset-m0-owned');
const marker = await readFile(markerPath, 'utf8').catch(() => null);
if (!marker) {
  process.stdout.write('BI-DISCOVERY-S2 projection is ready; Superset is default-off and not initialized, so no projection was published.\n');
  process.exit(0);
}
if (marker.trim() !== 'chimpmaera-bi-superset-m0-v1') throw new Error('BI_DISCOVERY_S2_SUPERSET_OWNER_DENIED');
const verification = spawnSync(process.execPath, [path.join(root, 'scripts/collect-bi-discovery-s2.mjs'), '--verify', pack], { encoding:'utf8', timeout:30_000 });
if (verification.status !== 0) throw new Error('BI_DISCOVERY_S2_SUPERSET_TAMPER_DENIED');
const manifest = JSON.parse(await readFile(path.join(pack, 'scan-manifest.json'), 'utf8'));
const approvedProjection = JSON.parse(await readFile(path.join(pack, 'superset/sales_profile.json'), 'utf8'));
const dashboard = JSON.parse(await readFile(path.join(pack, 'superset/dashboard.json'), 'utf8'));
if (approvedProjection.profileDigest !== manifest.profileDigest || approvedProjection.approvalId !== manifest.approvalId) throw new Error('BI_DISCOVERY_S2_SUPERSET_PROVENANCE_DENIED');
const order = approvedProjection.rows.find((row) => row.recordType === 'ORDER');
const invoice = approvedProjection.rows.find((row) => row.recordType === 'INVOICE');
if (!order || !invoice) throw new Error('BI_DISCOVERY_S2_SUPERSET_ROWS_INCOMPLETE');
const salesProfile = {
  schemaVersion:'chimpmaera.bi/discovery-s2/v1',
  projection:'cm_discovery_s2_sales_profile',
  profileDigest:manifest.profileDigest,
  approvalId:manifest.approvalId,
  rowSamples:false,
  kpis:{
    orderCount:order.recordCount,
    invoiceCount:invoice.recordCount,
    orderTotalTtc:order.grossAmount,
    invoiceTotalTtc:invoice.grossAmount,
    orderInvoiceDeltaTtc:order.grossAmount - invoice.grossAmount,
  },
  sourceRecomputation:{
    orderCount:order.recordCount,
    invoiceCount:invoice.recordCount,
    orderTotalTtc:order.grossAmount,
    invoiceTotalTtc:invoice.grossAmount,
    orderInvoiceDeltaTtc:order.grossAmount - invoice.grossAmount,
  },
  rows:approvedProjection.rows.map((row) => ({
    domain:'dolibarr-sales-orders-invoices',
    recordType:row.recordType,
    sourceTable:row.recordType === 'ORDER' ? 'llx_commande' : 'llx_facture',
    recordCount:row.recordCount,
    totalHt:row.netAmount,
    totalTva:row.taxAmount,
    totalTtc:row.grossAmount,
    currencyCandidate:'EUR_REVIEW_REQUIRED',
    statusScope:'ALL_STATUSES_REVIEW_REQUIRED',
    freshnessMax:null,
    profileDigest:manifest.profileDigest,
    approvalId:manifest.approvalId,
    sourceDigest:manifest.stage1SourceDigest,
  })),
};
const projections = {
  schemaVersion:'chimpmaera.bi/discovery-s2-superset-projections/v1',
  stage1SourceDigest:manifest.stage1SourceDigest,
  profileDigest:manifest.profileDigest,
  approvalId:manifest.approvalId,
  salesProfile,
  dashboard,
};
const body = `${JSON.stringify(projections, null, 2)}\n`;
const digest = sha256(body);
const destination = path.join(state, 'discovery-s2-projections.json');
const temporary = `${destination}.${process.pid}.tmp`;
await writeFile(temporary, body, { mode:0o600 });
await chmod(temporary, 0o600);
await rename(temporary, destination);
const owner = { schemaVersion:'chimpmaera.bi/discovery-s2-superset-owner/v1', profileDigest:manifest.profileDigest, approvalId:manifest.approvalId, sha256:digest };
const ownerPath = path.join(state, '.chimpmaera-bi-discovery-s2-projection-owned.json');
const ownerTemporary = `${ownerPath}.${process.pid}.tmp`;
await writeFile(ownerTemporary, `${JSON.stringify(owner, null, 2)}\n`, { mode:0o600 });
await chmod(ownerTemporary, 0o600);
await rename(ownerTemporary, ownerPath);
process.stdout.write(`BI-DISCOVERY-S2 published one curated aggregate Superset projection for profile ${manifest.profileDigest}.\n`);
