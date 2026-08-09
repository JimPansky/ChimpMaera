import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { verifyOpenClawAgentRuntimeLock } from
  "../scripts/verify-openclaw-agent-runtime-lock.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = "demo/manifests/supply-chain/openclaw-agent-runtime-lock-v1.json";

async function materializeFixtureRoot() {
  const target = await mkdtemp(path.join(tmpdir(), "cm-openclaw-m11-"));
  await cp(path.join(root, "demo/openclaw-agent"), path.join(target, "demo/openclaw-agent"), { recursive: true });
  await mkdir(path.join(target, "demo/manifests/supply-chain"), { recursive: true });
  await cp(path.join(root, lockPath), path.join(target, lockPath));
  await mkdir(path.join(target, "scripts"), { recursive: true });
  await cp(
    path.join(root, "scripts/verify-openclaw-agent-runtime-lock.mjs"),
    path.join(target, "scripts/verify-openclaw-agent-runtime-lock.mjs"),
  );
  return target;
}

async function installSpies(target, architecture = "x86_64") {
  const bin = path.join(target, "spy-bin");
  const log = path.join(target, "runtime-invocations.log");
  await mkdir(bin);
  await writeFile(
    path.join(bin, "docker"),
    "#!/usr/bin/env bash\nprintf '%s\\n' \"$*\" >> \"$CM_OPENCLAW_SPY_LOG\"\n",
    { mode: 0o755 },
  );
  await writeFile(
    path.join(bin, "uname"),
    `#!/usr/bin/env bash\n[ \"\${1:-}\" != -s ] || { printf 'Linux\\n'; exit; }\n[ \"\${1:-}\" != -m ] || { printf '${architecture}\\n'; exit; }\nexit 2\n`,
    { mode: 0o755 },
  );
  return { bin, log };
}

test("AAS-035 prerequisite lock binds official Docker, source, image and licence evidence", async () => {
  const report = await verifyOpenClawAgentRuntimeLock({ root });
  assert.equal(report.status, "PASS");
  assert.equal(report.version, "2026.7.1");
  assert.equal(report.commit, "2d2ddc43d0dcf71f31283d780f9fe9ff4cc04fe4");
  assert.equal(
    report.image,
    "ghcr.io/openclaw/openclaw@sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c",
  );
  assert.equal(report.platform, "linux/amd64");
  assert.equal(report.host, "Linux/x86_64");
  assert.equal(report.artifactCount, 17);
  assert.equal(report.checks.length, 5);
});

test("OPENCLAW-M1.1 setup rejects required provenance probes before any Docker invocation", async () => {
  const probes = [
    ["mutable tag", (value) => { value.image.tagReference = "ghcr.io/openclaw/openclaw:latest"; }],
    ["missing digest", (value) => { delete value.image.indexDigest; }],
    ["provenance mismatch", (value) => {
      value.image.ociLabels["org.opencontainers.image.revision"] = "0".repeat(40);
    }],
  ];
  for (const [label, mutate] of probes) {
    const target = await materializeFixtureRoot();
    try {
      const lock = JSON.parse(await readFile(path.join(target, lockPath), "utf8"));
      mutate(lock);
      await writeFile(path.join(target, lockPath), JSON.stringify(lock));
      const spy = await installSpies(target);
      const result = spawnSync("bash", [path.join(target, "demo/openclaw-agent/setup.sh")], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${spy.bin}:${process.env.PATH}`,
          CM_OPENCLAW_SPY_LOG: spy.log,
        },
      });
      assert.notEqual(result.status, 0, label);
      await assert.rejects(readFile(spy.log, "utf8"), /ENOENT/, `${label}: Docker was invoked`);
    } finally {
      await rm(target, { recursive: true, force: true });
    }
  }
});

test("OPENCLAW-M1.1 missing/altered material and unsupported architecture fail before Docker", async () => {
  for (const [label, prepare, architecture] of [
    ["missing lock", (target) => unlink(path.join(target, lockPath)), "x86_64"],
    ["altered local input", async (target) => {
      await writeFile(path.join(target, "demo/openclaw-agent/gateway.mjs"), "altered\n");
    }, "x86_64"],
    ["unsupported architecture", async () => {}, "aarch64"],
  ]) {
    const target = await materializeFixtureRoot();
    try {
      await prepare(target);
      const spy = await installSpies(target, architecture);
      const result = spawnSync("bash", [path.join(target, "demo/openclaw-agent/setup.sh")], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${spy.bin}:${process.env.PATH}`,
          CM_OPENCLAW_SPY_LOG: spy.log,
        },
      });
      assert.notEqual(result.status, 0, label);
      await assert.rejects(readFile(spy.log, "utf8"), /ENOENT/, `${label}: Docker was invoked`);
    } finally {
      await rm(target, { recursive: true, force: true });
    }
  }
});

test("OPENCLAW-M1.1 reset after interruption is idempotent, default-off and ownership-scoped", async () => {
  const target = await materializeFixtureRoot();
  try {
    const spy = await installSpies(target);
    const options = {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${spy.bin}:${process.env.PATH}`,
        CM_OPENCLAW_SPY_LOG: spy.log,
      },
    };
    const first = spawnSync("bash", [path.join(target, "demo/openclaw-agent/reset.sh"), "--purge"], options);
    const second = spawnSync("bash", [path.join(target, "demo/openclaw-agent/reset.sh"), "--purge"], options);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    const calls = await readFile(spy.log, "utf8");
    assert.equal((calls.match(/ down --remove-orphans --volumes/g) ?? []).length, 2);
    assert.equal((calls.match(/label=io\.chimpmaera\.fixture=aas035-openclaw-agent-v1/g) ?? []).length, 6);
    assert.doesNotMatch(calls, /\b(?:up|start|run)\b|systemctl/);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("AAS-035 prerequisite lock rejects mutable, mismatched and overclaimed selection", async () => {
  const baseline = JSON.parse(await readFile(path.join(root, lockPath), "utf8"));
  const probes = [
    ["mutable tag", (value) => { value.image.tagReference = "ghcr.io/openclaw/openclaw:latest"; }],
    ["source", (value) => { value.image.ociLabels["org.opencontainers.image.revision"] = "0".repeat(40); }],
    ["digest", (value) => { value.image.indexDigest = "sha256:unknown"; }],
    ["platform", (value) => { value.image.platform = "linux/386"; }],
    ["licence", (value) => { value.license.projectSpdx = "UNKNOWN"; }],
    ["redistribution", (value) => { value.license.imageBytesBundledByChimpMaera = true; }],
    ["socket", (value) => { value.selectionPolicy.hostOrDockerSocketMountsAllowed = true; }],
    ["egress", (value) => { value.selectionPolicy.directProviderOrInternetPathAllowed = true; }],
    ["claim", (value) => { value.nonClaims.pop(); }],
  ];
  for (const [label, mutate] of probes) {
    const target = await mkdtemp(path.join(tmpdir(), "cm-aas035-lock-"));
    try {
      const destination = path.join(target, lockPath);
      await mkdir(path.dirname(destination), { recursive: true });
      const changed = structuredClone(baseline);
      mutate(changed);
      await writeFile(destination, JSON.stringify(changed));
      await assert.rejects(
        verifyOpenClawAgentRuntimeLock({ root: target }),
        /OPENCLAW_RUNTIME_/,
        label,
      );
    } finally {
      await rm(target, { recursive: true, force: true });
    }
  }
});
