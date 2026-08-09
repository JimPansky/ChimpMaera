import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyBiFoundation } from '../scripts/verify-bi-foundation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'demo/bi-foundation');
const example = path.join(fixture, 'config.example.json');
const dockerAvailable = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' }).status === 0;
const render = (profile = false) => {
  const args = ['compose']; if (profile) args.push('--profile', 'bi001');
  args.push('-f', path.join(fixture, 'compose.yaml'), 'config', '--format', 'json');
  return JSON.parse(spawnSync('docker', args, { encoding: 'utf8', env: { ...process.env, CM_BI_PORT: '12780' } }).stdout);
};

test('BI-001 provenance closure accepts pinned checked-in inputs', async () => {
  const report = await verifyBiFoundation({ repositoryRoot: root, configPath: example, hostOs: 'Linux', hostArch: 'x86_64' });
  assert.equal(report.status, 'PASS'); assert.equal(report.inputCount, 10); assert.match(report.image, /@sha256:[a-f0-9]{64}$/);
});

test('BI-001 fresh checkout is default-off and containment is explicit', { skip: !dockerAvailable }, () => {
  assert.deepEqual(render().services, {});
  const explicit = render(true); assert.deepEqual(Object.keys(explicit.services).sort(), ['bi-dependency', 'bi-service']);
  for (const service of Object.values(explicit.services)) {
    assert.equal(service.read_only, true); assert.equal(service.user, '10001:10001'); assert.deepEqual(service.cap_drop, ['ALL']);
    assert.ok(service.security_opt.includes('no-new-privileges:true')); assert.ok(service.mem_limit <= 67108864); assert.ok(service.pids_limit <= 32); assert.ok(service.cpus <= 0.25);
    assert.deepEqual(Object.keys(service.networks), ['bi_internal']);
  }
  assert.equal(explicit.networks.bi_internal.internal, true);
  assert.equal(explicit.services['bi-service'].ports[0].host_ip, '127.0.0.1');
  assert.equal(explicit.services['bi-dependency'].ports, undefined);
});

test('BI-001 health is process-up while readiness tracks dependency state', async (t) => {
  const child = spawn(process.execPath, [path.join(fixture, 'service.mjs')], { env: { ...process.env, CM_BI_ROLE: 'service', CM_BI_PORT: '18781', CM_BI_DEPENDENCY_URL: 'http://bi-dependency:8090/healthz' } });
  t.after(() => child.kill()); await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal((await fetch('http://127.0.0.1:18781/healthz')).status, 200);
  const ready = await fetch('http://127.0.0.1:18781/readyz'); assert.equal(ready.status, 503); assert.equal((await ready.json()).dependency, 'UNAVAILABLE');
});

test('BI-001 negative config, platform and mutable input probes deny', async () => {
  await assert.rejects(verifyBiFoundation({ repositoryRoot: root, configPath: '/missing' }), /BI_CONFIG_MISSING/);
  await assert.rejects(verifyBiFoundation({ repositoryRoot: root, configPath: example, hostOs: 'Linux', hostArch: 'aarch64' }), /BI_UNSUPPORTED_HOST/);
  const temp = await mkdtemp(path.join(tmpdir(), 'cm-bi001-')); try {
    await cp(root, temp, { recursive: true, filter: (source) => !source.includes(`${path.sep}.git`) && !source.includes(`${path.sep}node_modules`) });
    const lockPath = path.join(temp, 'demo/manifests/supply-chain/bi-foundation-lock-v1.json'); const lock = JSON.parse(await readFile(lockPath)); lock.baseImage.reference = 'node:latest'; await writeFile(lockPath, JSON.stringify(lock));
    await assert.rejects(verifyBiFoundation({ repositoryRoot: temp }), /BI_MUTABLE_OR_UNVERIFIED_INPUT/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('BI-001 static negative probes cover egress, public bind, writable root and excess resources', { skip: !dockerAvailable }, () => {
  const explicit = render(true); const service = explicit.services['bi-service'];
  assert.equal(explicit.networks.bi_internal.internal, true, 'unexpected egress');
  assert.equal(service.ports[0].host_ip, '127.0.0.1', 'public bind');
  assert.equal(service.read_only, true, 'writable root');
  assert.ok(service.mem_limit <= 67108864 && service.pids_limit <= 32 && service.cpus <= 0.25, 'excess resources');
});

test('BI-001 setup and interrupted reset fail closed before later effects and retry deterministically', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'cm-bi-spy-')); try {
    const bin = path.join(temp, 'bin'); await mkdir(bin); const log = path.join(temp, 'log');
    await writeFile(path.join(bin, 'docker'), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "$CM_BI_SPY_LOG"\ncase "$*" in "info"|"compose version"|*"config --services") exit 0;; *"down --remove-orphans --volumes") [ -f "$CM_BI_FAIL_MARK" ] || { touch "$CM_BI_FAIL_MARK"; exit 75; }; exit 0;; "image inspect chimpmaera/bi001-foundation:local --format {{.Id}}") exit 1;; esac\nexit 90\n`, { mode: 0o755 });
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CM_BI_CONFIG: example, CM_BI_SPY_LOG: log, CM_BI_FAIL_MARK: path.join(temp, 'failed') };
    assert.equal(spawnSync('bash', [path.join(fixture, 'setup.sh')], { env }).status, 0);
    assert.notEqual(spawnSync('bash', [path.join(fixture, 'reset.sh')], { env }).status, 0);
    assert.equal(spawnSync('bash', [path.join(fixture, 'reset.sh')], { env }).status, 0);
    assert.match(await readFile(log, 'utf8'), /down --remove-orphans --volumes/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
