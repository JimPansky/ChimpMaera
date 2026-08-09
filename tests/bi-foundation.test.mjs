import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyBiFoundation } from '../scripts/verify-bi-foundation.mjs';
import { createBiServer } from '../demo/bi-foundation/service.mjs';

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

test('BI-001 health is process-up and readiness proves reachable and unavailable dependency states', async (t) => {
  const server = createBiServer({ role: 'service', dependencyUrl: 'synthetic://dependency' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const address = server.address(); const base = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
  const unavailable = await fetch(`${base}/readyz`); assert.equal(unavailable.status, 503); assert.deepEqual(await unavailable.json(), { status: 'NOT_READY', dependency: 'UNAVAILABLE' });
  const readyServer = createBiServer({ role: 'service', dependencyUrl: 'synthetic://dependency', fetchDependency: async () => new Response(null, { status: 200 }) });
  await new Promise((resolve) => readyServer.listen(0, '127.0.0.1', resolve)); t.after(() => readyServer.close());
  const readyAddress = readyServer.address(); const ready = await fetch(`http://127.0.0.1:${readyAddress.port}/readyz`);
  assert.equal(ready.status, 200); assert.deepEqual(await ready.json(), { status: 'READY', dependency: 'READY' });
});

test('BI-001 lifecycle waits for dependency readiness, not merely process health', { skip: !dockerAvailable }, () => {
  const explicit = render(true); const healthcheck = explicit.services['bi-service'].healthcheck.test.join(' ');
  assert.match(healthcheck, /\/readyz/); assert.doesNotMatch(healthcheck, /\/healthz/);
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

test('BI-001 unowned project resource denies reset before every destructive call', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'cm-bi-spy-')); try {
    const bin = path.join(temp, 'bin'); await mkdir(bin); const log = path.join(temp, 'log');
    await writeFile(path.join(bin, 'docker'), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "$CM_BI_SPY_LOG"\ncase "$*" in "ps -aq --filter "*) printf 'foreign-container\\n';; "container inspect foreign-container "*) printf 'not-owned\\n';; esac\nexit 0\n`, { mode: 0o755 });
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CM_BI_CONFIG: example, CM_BI_SPY_LOG: log };
    const result = spawnSync('bash', [path.join(fixture, 'reset.sh')], { env, encoding: 'utf8' }); assert.notEqual(result.status, 0); assert.doesNotMatch(result.stderr, /foreign-container/);
    const calls = await readFile(log, 'utf8'); assert.doesNotMatch(calls, /compose .* down|image rm/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('BI-001 owned reset is deterministic after interruption and never deletes volumes', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'cm-bi-reset-')); try {
    const bin = path.join(temp, 'bin'); await mkdir(bin); const log = path.join(temp, 'log'); const mark = path.join(temp, 'failed');
    await writeFile(path.join(bin, 'docker'), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "$CM_BI_SPY_LOG"\ncase "$*" in "ps -aq --filter "*) printf 'owned-container\\n';; "network ls -q --filter "*) printf 'owned-network\\n';; "volume ls -q --filter "*) exit 0;; "container inspect owned-container "*|"network inspect owned-network "*) printf 'bi001-foundation-v1\\n';; "image inspect chimpmaera/bi001-foundation:local") exit 1;; *" down") [ -f "$CM_BI_FAIL_MARK" ] || { touch "$CM_BI_FAIL_MARK"; exit 75; };; esac\nexit 0\n`, { mode: 0o755 });
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CM_BI_CONFIG: example, CM_BI_SPY_LOG: log, CM_BI_FAIL_MARK: mark };
    assert.notEqual(spawnSync('bash', [path.join(fixture, 'reset.sh')], { env }).status, 0); assert.equal(spawnSync('bash', [path.join(fixture, 'reset.sh')], { env }).status, 0);
    const calls = await readFile(log, 'utf8'); assert.match(calls, / down$/m); assert.doesNotMatch(calls, /--volumes|--remove-orphans/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('BI-001 source label digest is identical across checkout paths', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'cm-bi-digest-')); try {
    const paths = [path.join(temp, 'checkout-one'), path.join(temp, 'different', 'checkout-two')];
    for (const target of paths) { await mkdir(target, { recursive: true }); for (const name of ['service.mjs', 'service.Dockerfile']) await cp(path.join(fixture, name), path.join(target, name)); }
    const digest = (target) => spawnSync('bash', ['-c', 'source "$1"; cm_bi_source_sha256 "$2"', 'bash', path.join(fixture, 'lib.sh'), target], { encoding: 'utf8' }).stdout.trim();
    assert.match(digest(paths[0]), /^[a-f0-9]{64}$/); assert.equal(digest(paths[0]), digest(paths[1]));
  } finally { await rm(temp, { recursive: true, force: true }); }
});
