import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('persisted S2 knowledge pack is provenance-bound and row-sample free', async () => {
  const result = spawnSync(process.execPath, ['scripts/render-bi-discovery-s2-pack.mjs', '--check'], { encoding:'utf8', timeout:30_000 });
  assert.equal(result.status, 0, result.stderr);
  const readback = JSON.parse(result.stdout);
  assert.equal(readback.status, 'PASS');
  const manifest = JSON.parse(await readFile('knowledge/bi-discovery/dolibarr-22.0.3-mariadb-s2/scan-manifest.json', 'utf8'));
  const approval = JSON.parse(await readFile('knowledge/bi-discovery/dolibarr-22.0.3-mariadb-s2/approval.json', 'utf8'));
  const projection = JSON.parse(await readFile('knowledge/bi-discovery/dolibarr-22.0.3-mariadb-s2/superset/sales_profile.json', 'utf8'));
  assert.equal(manifest.stage1SourceDigest, '95fac104078380fe407a55d13f7f724920af0148b721c131d4405a55c6e318b9');
  assert.equal(manifest.stage1ScanId, 'cmdb:scan:sha256:a6ee331b9b864d675b9f4f5a');
  assert.equal(approval.approvalId, manifest.approvalId);
  assert.equal(projection.approvalId, approval.approvalId);
  assert.equal(manifest.rowSamples, false);
  assert.equal(manifest.directSupersetSourceRoute, false);
  assert.doesNotMatch(await readFile('knowledge/bi-discovery/dolibarr-22.0.3-mariadb-s2/normalized-profile.json', 'utf8'), /llx_|dolidb|SELECT |row_sample/i);
});

test('S2 aggregate projection remains source-route free and external BI publication is non-mutating', async () => {
  const result = spawnSync(process.execPath, ['scripts/publish-bi-discovery-s2-superset.mjs', '--pack', 'knowledge/bi-discovery/dolibarr-22.0.3-mariadb-s2'], { encoding:'utf8', timeout:30_000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CM no longer owns a Superset runtime/);
  const external = await readFile('docs/EXTERNAL-BI-SERVICE.md', 'utf8');
  assert.match(external, /Superset_BI_Agent/);
  assert.doesNotMatch(external, /doli_db_net|doli-db|dolidb|MARIADB/);
});
