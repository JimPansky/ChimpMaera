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

test('BI-002 foundation declaration keeps the CRM connector explicitly off and bounded', async () => {
  const config = JSON.parse(await readFile(example, 'utf8'));
  assert.deepEqual(config.crmConnector, { enabled: false, adapter: 'SUPPORTED_EXPORT_API_SHAPED', tenantId: 'tenant:synthetic-zoo', scope: 'crm.synthetic.bi.read' });
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

test('BI-001 clean image absence resets deterministically after interruption and never deletes volumes', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'cm-bi-reset-')); try {
    const bin = path.join(temp, 'bin'); await mkdir(bin); const log = path.join(temp, 'log'); const mark = path.join(temp, 'failed');
    await writeFile(path.join(bin, 'docker'), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "$CM_BI_SPY_LOG"\ncase "$*" in "ps -aq --filter "*) printf 'owned-container\\n';; "network ls -q --filter "*) printf 'owned-network\\n';; "volume ls -q --filter "*) exit 0;; "container inspect owned-container "*|"network inspect owned-network "*) printf 'bi001-foundation-v1\\n';; "image inspect chimpmaera/bi001-foundation:local") exit 1;; *" down") [ -f "$CM_BI_FAIL_MARK" ] || { touch "$CM_BI_FAIL_MARK"; exit 75; };; esac\nexit 0\n`, { mode: 0o755 });
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CM_BI_CONFIG: example, CM_BI_SPY_LOG: log, CM_BI_FAIL_MARK: mark };
    assert.notEqual(spawnSync('bash', [path.join(fixture, 'reset.sh')], { env }).status, 0); assert.equal(spawnSync('bash', [path.join(fixture, 'reset.sh')], { env }).status, 0);
    const calls = await readFile(log, 'utf8'); assert.match(calls, / down$/m); assert.doesNotMatch(calls, /--volumes|--remove-orphans/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('BI-001 image inventory and metadata failures deny without lifecycle mutation or success', async () => {
  const imageId = `sha256:${'a'.repeat(64)}`;
  for (const mode of ['list-failure', 'multiple-images', 'inspect-failure', 'label-failure']) {
    const temp = await mkdtemp(path.join(tmpdir(), 'cm-bi-image-deny-')); try {
      const bin = path.join(temp, 'bin'); await mkdir(bin); const log = path.join(temp, 'log');
      await writeFile(path.join(bin, 'docker'), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "$CM_BI_SPY_LOG"\nif [ "$1 $2" = "image ls" ]; then case "$CM_BI_IMAGE_MODE" in list-failure) exit 70;; multiple-images) printf '${imageId}\\nsha256:${'b'.repeat(64)}\\n';; *) printf '${imageId}\\n';; esac; exit 0; fi\nif [ "$1 $2 $3" = "image inspect ${imageId}" ]; then [ "$CM_BI_IMAGE_MODE" != inspect-failure ] || exit 71; case "$5" in '{{.Id}}') printf '${imageId}\\n';; *source-sha256*) printf '${'d'.repeat(64)}\\n';; *io.chimpmaera.fixture*) [ "$CM_BI_IMAGE_MODE" != label-failure ] || exit 71; printf 'bi001-foundation-v1\\n';; *) exit 90;; esac; exit 0; fi\ncase "$*" in "ps -aq --filter "*|"network ls -q --filter "*|"volume ls -q --filter "*) exit 0;; esac\nexit 90\n`, { mode: 0o755 });
      const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CM_BI_CONFIG: example, CM_BI_SPY_LOG: log, CM_BI_IMAGE_MODE: mode };
      const result = spawnSync('bash', [path.join(fixture, 'reset.sh')], { env, encoding: 'utf8' }); assert.notEqual(result.status, 0, mode); assert.doesNotMatch(result.stdout, /reset|READY/i, mode);
      const calls = await readFile(log, 'utf8'); assert.doesNotMatch(calls, /docker build|compose .* (?:down|up)|image rm| down$| up /m, mode);
    } finally { await rm(temp, { recursive: true, force: true }); }
  }
});

test('BI-001 start inventory failure cannot build, run Compose up, or claim READY', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'cm-bi-start-image-deny-')); try {
    const bin = path.join(temp, 'bin'); await mkdir(bin); const log = path.join(temp, 'log');
    await writeFile(path.join(bin, 'docker'), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "$CM_BI_SPY_LOG"\ncase "$*" in "info"|"compose version"|*"config --services"|"ps -aq --filter "*|"network ls -q --filter "*|"volume ls -q --filter "*) exit 0;; esac\nif [ "$1 $2" = "image ls" ]; then exit 70; fi\nexit 90\n`, { mode: 0o755 });
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CM_BI_CONFIG: example, CM_BI_SPY_LOG: log };
    const result = spawnSync('bash', [path.join(fixture, 'start.sh')], { env, encoding: 'utf8' }); assert.notEqual(result.status, 0); assert.doesNotMatch(result.stdout, /READY/);
    const calls = await readFile(log, 'utf8'); assert.doesNotMatch(calls, /^build | up /m);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('BI-001 tag remap cannot redirect removal away from the validated owned image ID', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'cm-bi-image-owned-')); try {
    const bin = path.join(temp, 'bin'); await mkdir(bin); const log = path.join(temp, 'log'); const imageId = `sha256:${'c'.repeat(64)}`; const foreignId = `sha256:${'e'.repeat(64)}`; const source = 'd'.repeat(64);
    await writeFile(path.join(bin, 'docker'), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "$CM_BI_SPY_LOG"\nif [ "$1 $2" = "image ls" ]; then printf '${imageId}\\n'; exit 0; fi\nif [ "$1 $2 $3" = "image inspect ${imageId}" ]; then case "$5" in '{{.Id}}') printf '${imageId}\\n';; *source-sha256*) printf '${source}\\n';; *io.chimpmaera.fixture*) printf 'bi001-foundation-v1\\n';; *) exit 90;; esac; exit 0; fi\ncase "$*" in "ps -aq --filter "*|"network ls -q --filter "*|"volume ls -q --filter "*) exit 0;; *" down") exit 0;; "image rm ${imageId}") exit 0;; "image rm chimpmaera/bi001-foundation:local"|"image rm ${foreignId}") exit 91;; esac\nexit 90\n`, { mode: 0o755 });
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CM_BI_CONFIG: example, CM_BI_SPY_LOG: log };
    const result = spawnSync('bash', [path.join(fixture, 'reset.sh')], { env, encoding: 'utf8' }); assert.equal(result.status, 0, `${result.stderr}\n${await readFile(log, 'utf8')}`); assert.match(result.stdout, /owned resources reset/);
    const calls = await readFile(log, 'utf8'); assert.equal((calls.match(/image ls --quiet/g) ?? []).length, 2); assert.match(calls, new RegExp(`image rm ${imageId}`)); assert.doesNotMatch(calls, new RegExp(`image rm (?:chimpmaera/bi001-foundation:local|${foreignId})`));
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('BI-001 immutable image removal failure denies reset success', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'cm-bi-image-rm-deny-')); try {
    const bin = path.join(temp, 'bin'); await mkdir(bin); const log = path.join(temp, 'log'); const imageId = `sha256:${'f'.repeat(64)}`; const source = 'a'.repeat(64);
    await writeFile(path.join(bin, 'docker'), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "$CM_BI_SPY_LOG"\nif [ "$1 $2" = "image ls" ]; then printf '${imageId}\\n'; exit 0; fi\nif [ "$1 $2 $3" = "image inspect ${imageId}" ]; then case "$5" in '{{.Id}}') printf '${imageId}\\n';; *source-sha256*) printf '${source}\\n';; *io.chimpmaera.fixture*) printf 'bi001-foundation-v1\\n';; esac; exit 0; fi\ncase "$*" in "ps -aq --filter "*|"network ls -q --filter "*|"volume ls -q --filter "*|*" down") exit 0;; "image rm ${imageId}") exit 73;; esac\nexit 90\n`, { mode: 0o755 });
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CM_BI_CONFIG: example, CM_BI_SPY_LOG: log };
    const result = spawnSync('bash', [path.join(fixture, 'reset.sh')], { env, encoding: 'utf8' }); assert.notEqual(result.status, 0); assert.doesNotMatch(result.stdout, /reset|READY/i); assert.match(result.stderr, /validated local image removal failed/); assert.doesNotMatch(result.stderr, new RegExp(imageId));
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('BI-001 post-down image inventory failure cannot remove an image or claim reset success', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'cm-bi-image-post-down-')); try {
    const bin = path.join(temp, 'bin'); await mkdir(bin); const log = path.join(temp, 'log'); const count = path.join(temp, 'inventory-count');
    await writeFile(path.join(bin, 'docker'), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "$CM_BI_SPY_LOG"\nif [ "$1 $2" = "image ls" ]; then if [ -f "$CM_BI_COUNT" ]; then exit 72; else touch "$CM_BI_COUNT"; exit 0; fi; fi\ncase "$*" in "ps -aq --filter "*|"network ls -q --filter "*|"volume ls -q --filter "*) exit 0;; *" down") exit 0;; esac\nexit 90\n`, { mode: 0o755 });
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CM_BI_CONFIG: example, CM_BI_SPY_LOG: log, CM_BI_COUNT: count };
    const result = spawnSync('bash', [path.join(fixture, 'reset.sh')], { env, encoding: 'utf8' }); assert.notEqual(result.status, 0); assert.doesNotMatch(result.stdout, /reset|READY/i);
    const calls = await readFile(log, 'utf8'); assert.match(calls, / down$/m); assert.doesNotMatch(calls, /image rm/);
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
