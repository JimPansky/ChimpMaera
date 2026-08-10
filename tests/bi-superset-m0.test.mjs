import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyBiSupersetM0 } from '../scripts/verify-bi-superset-m0.mjs';

const fixture = path.resolve('demo/bi-superset');
const dockerAvailable = spawnSync('docker', ['compose', 'version']).status === 0;
const render = (enabled) => {
  const args = ['compose']; if (enabled) args.push('--profile', 'bi-superset-m0');
  args.push('-f', path.join(fixture, 'compose.yaml'), 'config', '--format', 'json');
  const env = { ...process.env, CM_BI_SUPERSET_PORT: '8088' };
  if (enabled) env.COMPOSE_ENV_FILES = path.join(fixture, 'state/runtime.env');
  return spawnSync('docker', args, { encoding: 'utf8', env });
};

test('M0 verifier binds default-off scope, digest image, one dataset and BI-004 truth', async () => {
  assert.deepEqual(await verifyBiSupersetM0(), { status:'PASS', image:'apache/superset:5.0.0@sha256:e51bbaf8b72d7c864d6e1e3e439c476db55481d0eb89e04ac411cc1c5344746c', datasetCount:1 });
});

test('fresh checkout renders no service without explicit profile', { skip: !dockerAvailable }, () => {
  const result = render(false); assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout).services, {});
});

test('explicit profile is localhost-only, internal, bounded and read-only', { skip: !dockerAvailable }, async (t) => {
  const envFile = path.join(fixture, 'state/runtime.env'); await writeFile(envFile, 'SUPERSET_SECRET_KEY=test-only\nCM_BI_ADMIN_PASSWORD=test-only\nCM_BI_ANALYST_PASSWORD=test-only\n'); t.after(() => rm(envFile));
  const result = render(true); assert.equal(result.status, 0, result.stderr); const value = JSON.parse(result.stdout);
  assert.equal(value.networks.superset_internal.internal, true); assert.equal(value.networks.localhost_access.driver_opts['com.docker.network.bridge.enable_ip_masquerade'],'false'); assert.equal(value.services.superset.ports[0].host_ip, '127.0.0.1');
  for (const service of Object.values(value.services)) { assert.equal(service.read_only,true); assert.deepEqual(service.cap_drop,['ALL']); assert.ok(service.security_opt.includes('no-new-privileges:true')); assert.ok(service.mem_limit <= 805306368); assert.ok(service.pids_limit <= 128); }
});

test('security configuration denies anonymous public role, SQL Lab exposure, uploads and unsafe templating', async () => {
  const config = await readFile(path.join(fixture,'runtime/superset_config.py'),'utf8'); const bootstrap = await readFile(path.join(fixture,'runtime/bootstrap.py'),'utf8');
  assert.match(config,/PUBLIC_ROLE_LIKE = None/); assert.match(config,/AUTH_ROLE_PUBLIC = "Public"/); assert.match(config,/"ENABLE_TEMPLATE_PROCESSING": False/); assert.match(config,/ALLOWED_EXTENSIONS = set\(\)/); assert.match(bootstrap,/expose_in_sqllab=False/); assert.match(bootstrap,/deny_permissions\(analyst_role\)/);
});

test('projection invokes the existing BI-004 reconciler and preserves tenant and markings', async () => {
  const source = await readFile(path.join(fixture,'runtime/bootstrap.py'),'utf8'); const renderer = await readFile('scripts/render-bi-superset-projection.mjs','utf8');
  for (const value of ['tenant:synthetic-zoo','LOCAL_SYNTHETIC_NON_PRODUCTION_READ_ONLY_NON_AUTHORITY']) assert.ok(source.includes(value), value);
  assert.match(renderer,/reconcileCrmErpV1/); assert.match(renderer,/positive-reconciliation-v1.json/); assert.match(renderer,/8750000/);
  assert.match(source,/bi004_foreign_tenant_probe/); assert.match(source,/canonical:foreign-denied/);
});

test('reset refuses unmarked state before Docker mutation', async () => {
  const temp = await mkdtemp(path.join(tmpdir(),'cm-ss-spy-')); try { const bin=path.join(temp,'bin'); const state=path.join(temp,'state'); await mkdir(bin); await mkdir(state); const log=path.join(temp,'log'); await writeFile(path.join(bin,'docker'),`#!/bin/sh\nprintf '%s\\n' "$*" >> "$CM_SPY_LOG"\nexit 0\n`,{mode:0o755});
    const result=spawnSync('bash',[path.join(fixture,'reset.sh')],{encoding:'utf8',env:{...process.env,PATH:`${bin}:${process.env.PATH}`,CM_SPY_LOG:log,CM_BI_SUPERSET_STATE:state}}); assert.notEqual(result.status,0); assert.match(result.stderr,/marker missing/); await assert.rejects(readFile(log),/ENOENT/);
  } finally { await rm(temp,{recursive:true,force:true}); }
});

test('backup restore scripts require marker, exact allowlist and stopped service', async () => {
  const backup=await readFile(path.join(fixture,'backup.sh'),'utf8'); const restore=await readFile(path.join(fixture,'restore.sh'),'utf8');
  assert.match(backup,/umask 077/); assert.match(backup,/chmod 0600 "\$destination\.tmp"/); assert.match(backup,/chmod 0600 "\$destination"/); assert.match(backup,/cm_ss_assert_marker/); assert.match(restore,/backup contains unexpected residue/); assert.match(restore,/stop Superset before restore/); assert.match(restore,/cm_ss_assert_resources/);
});

test('backup archive remains mode 0600 under a permissive caller umask', async () => {
  const temp=await mkdtemp(path.join(tmpdir(),'cm-ss-backup-')); try { const state=path.join(temp,'state'); await mkdir(state); await writeFile(path.join(state,'.chimpmaera-bi-superset-m0-owned'),'chimpmaera-bi-superset-m0-v1\n'); for (const name of ['runtime.env','accepted.json','superset.db','semantic.db']) await writeFile(path.join(state,name),'synthetic');
    const archive=path.join(temp,'backup.tar'); const result=spawnSync('bash',['-c','umask 000; exec "$1" "$2"','bash',path.join(fixture,'backup.sh'),archive],{encoding:'utf8',env:{...process.env,CM_BI_SUPERSET_STATE:state}}); assert.equal(result.status,0,result.stderr); assert.equal((await stat(archive)).mode & 0o777,0o600);
  } finally { await rm(temp,{recursive:true,force:true}); }
});

test('start permits absent or exactly owned image tag and denies foreign or ambiguous tag before build', async () => {
  const start=await readFile(path.join(fixture,'start.sh'),'utf8'); assert.ok(start.indexOf('cm_ss_owned_image') < start.indexOf('cm_ss_compose up'));
  for (const mode of ['absent','owned','foreign','ambiguous']) { const temp=await mkdtemp(path.join(tmpdir(),'cm-ss-image-')); try { const bin=path.join(temp,'bin'); await mkdir(bin); const log=path.join(temp,'log'); const first=`sha256:${'a'.repeat(64)}`; const second=`sha256:${'b'.repeat(64)}`;
      await writeFile(path.join(bin,'docker'),`#!/bin/sh\nprintf '%s\\n' "$*" >> "$CM_SPY_LOG"\ncase "$*" in\n  "image ls "*) case "$CM_IMAGE_MODE" in absent) :;; ambiguous) printf '${first}\\n${second}\\n';; *) printf '${first}\\n';; esac;;\n  "image inspect ${first} --format {{.Id}}") printf '${first}\\n';;\n  "image inspect ${first} --format "*) if [ "$CM_IMAGE_MODE" = owned ]; then printf 'bi-superset-m0-v1\\n'; else printf 'foreign-owner\\n'; fi;;\nesac\n`,{mode:0o755});
      const command=`source "${path.join(fixture,'lib.sh')}"; if cm_ss_owned_image >/dev/null; then :; fi; printf 'BUILD_MUTATION\\n' >> "$CM_SPY_LOG"`; const result=spawnSync('bash',['-c',command],{encoding:'utf8',env:{...process.env,PATH:`${bin}:${process.env.PATH}`,CM_SPY_LOG:log,CM_IMAGE_MODE:mode}}); const calls=await readFile(log,'utf8'); if (['absent','owned'].includes(mode)) { assert.equal(result.status,0,mode); assert.match(calls,/BUILD_MUTATION/,mode); } else { assert.notEqual(result.status,0,mode); assert.doesNotMatch(calls,/BUILD_MUTATION/,mode); }
    } finally { await rm(temp,{recursive:true,force:true}); } }
});
