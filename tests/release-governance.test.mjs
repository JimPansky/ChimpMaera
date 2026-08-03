import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { validateRepository } from "../scripts/verify-release-governance.mjs";

const ROOT = resolve(import.meta.dirname, "..");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "cm-release-governance-"));
  cpSync(ROOT, root, {
    recursive: true,
    filter: (source) => !source.includes("node_modules") && !source.includes("/.git") && !source.includes("/dist")
  });
  return root;
}

function replace(root, path, before, after) {
  const file = join(root, path);
  writeFileSync(file, readFileSync(file, "utf8").replace(before, after));
}

test("repository release governance passes", () => {
  assert.deepEqual(validateRepository(ROOT), []);
});

test("release governance negative probes fail closed", async (t) => {
  const probes = [
    ["README stale tag", "README_CURRENT_RELEASE_MISMATCH", (root) => replace(root, "README.md", "v0.2.0-poc.20260803.1", "v0.1.0")],
    ["README Daily identity", "README_ACTIVE_DAILY_IDENTITY_DENIED", (root) => replace(root, "README.md", "Authority-Bounded Integration Contracts Increment", "Today's Daily snapshot")],
    ["stale Security claim", "SECURITY_STALE_RELEASE_CLAIM_DENIED", (root) => replace(root, "docs/SECURITY-ASSURANCE.md", "## Claim maturity", "v0.1.0 remains the only tagged and published release.\n\n## Claim maturity")],
    ["stale limitation version", "LIMITATIONS_STALE_V01_BINDING_DENIED", (root) => replace(root, "docs/KNOWN-LIMITATIONS.md", "The current local demo", "The v0.1 demo")],
    ["withdrawn video", "WITHDRAWN_ACTIVE_VIDEO_DENIED:Dq_XLEzh5I8", (root) => replace(root, "README.md", "Current overview videos are temporarily unavailable", "https://youtu.be/Dq_XLEzh5I8")],
    ["missing non-claim", "NON_CLAIMS_MISSING:CM-REL-001", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); j.claimEvidence[0].nonClaims = []; writeFileSync(p, JSON.stringify(j)); }],
    ["missing evidence path", "CLAIM_EVIDENCE_MISSING:CM-REL-001:docs/missing.md", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); j.claimEvidence[0].evidencePaths.push("docs/missing.md"); writeFileSync(p, JSON.stringify(j)); }],
    ["missing grouped component evidence", "RELEASE_COMPONENT_EVIDENCE_MISSING:Verification Fabric", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); j.claimEvidence = j.claimEvidence.filter((claim) => claim.component !== "Verification Fabric"); writeFileSync(p, JSON.stringify(j)); }],
    ["component byte not in public manifest", "COMPONENT_PATH_UNMANIFESTED:CM-REL-004:packages/contracts/src/verification-fabric.ts", (root) => replace(root, "release/public-files.manifest", "packages/contracts/src/verification-fabric.ts\tpackages/contracts/src/verification-fabric.ts\t0644\n", "")],
    ["asset hash removed", "ASSET_INVENTORY_INVALID", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); j.currentRelease.assets[0].sha256 = "unknown"; writeFileSync(p, JSON.stringify(j)); }],
    ["private path leak", "LEAK_PRIVATE_HOME_PATH:README.md", (root) => replace(root, "README.md", "Current overview videos are temporarily unavailable", ["Current files: ", "home", "alice", "private", ""].join("/"))],
    ["calendar generator title", "GENERATOR_CALENDAR_RELEASE_TITLE_DENIED", (root) => replace(root, "scripts/daily-poc.mjs", "const releaseTitle = incrementCandidateTitle(manifest);", "const releaseTitle = `ChimpMaera POC Daily — ${manifest.date}`;")]
  ];
  for (const [name, expected, mutate] of probes) {
    await t.test(name, () => {
      const root = fixture();
      mutate(root);
      assert.ok(validateRepository(root).some((value) => value.includes(expected)), validateRepository(root).join("\n"));
    });
  }
});
