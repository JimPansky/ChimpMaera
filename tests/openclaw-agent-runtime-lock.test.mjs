import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { verifyOpenClawAgentRuntimeLock } from
  "../scripts/verify-openclaw-agent-runtime-lock.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = "demo/manifests/supply-chain/openclaw-agent-runtime-lock-v1.json";

test("AAS-035 prerequisite lock binds official Docker, source, image and licence evidence", async () => {
  const report = await verifyOpenClawAgentRuntimeLock({ root });
  assert.equal(report.status, "PASS");
  assert.equal(report.version, "2026.7.1");
  assert.equal(report.commit, "2d2ddc43d0dcf71f31283d780f9fe9ff4cc04fe4");
  assert.equal(
    report.image,
    "ghcr.io/openclaw/openclaw@sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c",
  );
  assert.equal(report.checks.length, 4);
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
