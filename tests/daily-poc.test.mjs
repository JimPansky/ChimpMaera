import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const CLI = join(ROOT, "scripts", "daily-poc.mjs");
const EXAMPLE = join(ROOT, "examples", "daily-poc", "v0.2.0-poc.20260801.1", "manifest.json");
const MATRIX = JSON.parse(readFileSync(join(ROOT, "tests", "fixtures", "daily-poc", "negative-matrix.json"), "utf8"));

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function git(repo, ...args) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "cm-daily-poc-test-"));
  const source = join(root, "source");
  const manifest = JSON.parse(readFileSync(EXAMPLE, "utf8"));
  mkdirSync(join(source, "tools", "video-production-reference", "schemas"), { recursive: true });
  mkdirSync(join(source, "tools", "video-production-reference", "tests"), { recursive: true });
  writeFileSync(join(source, "README.md"), "# ChimpMaera\n\nBase.\n", "utf8");
  writeFileSync(join(source, "tools", "video-production-reference", "README.md"), "# Video\n\nPublic actions forbidden.\n", "utf8");
  writeFileSync(join(source, "tools", "video-production-reference", "schemas", "video-job.schema.json"), "{\"publicActions\":\"forbidden\"}\n", "utf8");
  writeFileSync(join(source, "tools", "video-production-reference", "tests", "test_cm_video.py"), "def test_public_actions(): pass\n", "utf8");
  for (const evidence of manifest.evidence) {
    const target = join(source, evidence.path);
    if (existsSync(target)) continue;
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(ROOT, evidence.path), target);
  }
  git(source, "init", "-q");
  git(source, "config", "user.name", "Daily POC Test");
  git(source, "config", "user.email", "daily-poc@example.invalid");
  git(source, "branch", "-M", "main");
  git(source, "add", ".");
  git(source, "commit", "-q", "-m", "base");
  const base = git(source, "rev-parse", "HEAD");
  writeFileSync(join(source, "README.md"), "# ChimpMaera\n\nBase.\n\n## Videos\n\nCurrent overview.\n", "utf8");
  git(source, "add", "README.md");
  git(source, "commit", "-q", "-m", "docs: add videos");
  const head = git(source, "rev-parse", "HEAD");
  git(source, "remote", "add", "origin", source);
  git(source, "fetch", "-q", "origin", "main:refs/remotes/origin/main");

  manifest.source = { repository: "local-test", base, head };
  for (const highlight of manifest.highlights) {
    highlight.commitIds = [head];
    highlight.fileRefs = ["README.md"];
  }
  if (manifest.history.length === 0) {
    manifest.history.push({
      date: "2026-07-31",
      sequence: 1,
      version: "v0.1.0-poc.20260731.1",
      sourceHead: base,
      manifestSha256: "0".repeat(64),
      artifactManifestSha256: "1".repeat(64),
      snapshotDigest: "0".repeat(64),
    });
  }
  manifest.history[0].sourceHead = base;
  const historyPayload = { ...manifest.history[0] };
  delete historyPayload.snapshotDigest;
  manifest.history[0].snapshotDigest = sha256(canonicalJson(historyPayload));
  for (const evidence of manifest.evidence) {
    evidence.sourceCommit = head;
    evidence.sha256 = sha256(readFileSync(join(source, evidence.path)));
  }
  return { root, source, manifest };
}

function writeManifest(fx, manifest = fx.manifest, name = "manifest.json") {
  const path = join(fx.root, name);
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return path;
}

function run(fx, { manifest = fx.manifest, outputName = "output", extraArgs = [], expectedStatus } = {}) {
  const manifestPath = writeManifest(fx, manifest, `${outputName}-manifest.json`);
  const output = join(fx.root, outputName);
  const result = spawnSync(process.execPath, [
    CLI,
    "prepare",
    "--manifest",
    manifestPath,
    "--source-repo",
    fx.source,
    "--output",
    output,
    ...extraArgs,
  ], { encoding: "utf8" });
  if (expectedStatus !== undefined) assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
  return { result, output, stdout: JSON.parse(result.stdout) };
}

function reasons(output) {
  return JSON.parse(readFileSync(join(output, "candidate-report.json"), "utf8")).reasons;
}

function mutate(fx, kind) {
  const manifest = structuredClone(fx.manifest);
  switch (kind) {
    case "INVALID_VERSION":
      manifest.targetVersion = "v0_2_0_poc_20260801_1";
      break;
    case "DUPLICATE_SEQUENCE": {
      const duplicate = {
        date: manifest.date,
        sequence: manifest.sequence,
        version: manifest.targetVersion,
        sourceHead: manifest.source.base,
        manifestSha256: "2".repeat(64),
        artifactManifestSha256: "3".repeat(64),
      };
      duplicate.snapshotDigest = sha256(canonicalJson(duplicate));
      manifest.history.push(duplicate);
      break;
    }
    case "MISMATCHED_HEAD":
      manifest.source.head = "0".repeat(40);
      break;
    case "DIRTY_SOURCE":
      writeFileSync(join(fx.source, "README.md"), `${readFileSync(join(fx.source, "README.md"), "utf8")}dirty\n`, "utf8");
      break;
    case "MISSING_EVIDENCE":
      manifest.claims[0].evidenceRefs = ["EVID-NOT-PRESENT"];
      break;
    case "STALE_EVIDENCE":
      manifest.evidence[0].validUntil = "2026-07-31";
      break;
    case "LOCAL_NARRATED_RELEASED":
      manifest.claims[0].maturity = "LOCALLY_VALIDATED";
      manifest.video.segments[0].narration = "This local-only claim was released to everyone.";
      break;
    case "CONTRADICTORY_NONCLAIM":
      manifest.claims[0].nonClaims[0].contradictsClaimIds = [manifest.claims[0].id];
      break;
    case "MISSING_OUTCOME":
      manifest.useCases[0].expectedOutcomes = [];
      break;
    case "SECRET_CONTENT":
      manifest.knownLimitations.push(["sk", "A".repeat(24)].join("-"));
      break;
    case "INTERNAL_PATH":
      manifest.knownLimitations.push(["", "home", "alice", "private", "fixture.json"].join("/"));
      break;
    case "DUPLICATE_VIDEO_ORDER":
      manifest.video.segments[1].order = manifest.video.segments[0].order;
      break;
    case "NONDETERMINISTIC_TIMESTAMP":
      manifest.generatedAt = "2026-08-01T14:09:00Z";
      break;
    case "TAMPER_PRIOR_SNAPSHOT":
      manifest.history[0].manifestSha256 = "9".repeat(64);
      break;
    case "PUBLICATION_ENABLED":
      manifest.publication.githubPrerelease = true;
      manifest.publication.approvals = ["not-a-separate-stage"];
      break;
    case "RENDERER_UNAVAILABLE":
      break;
    default:
      throw new Error(`unknown mutation ${kind}`);
  }
  return manifest;
}

test("realistic manifest prepares a READY_CANDIDATE with checksum-valid artifacts", () => {
  const fx = fixture();
  const { output, stdout } = run(fx, { expectedStatus: 0 });
  assert.equal(stdout.verdict, "READY_CANDIDATE");
  const checks = spawnSync("sha256sum", ["-c", "SHA256SUMS"], { cwd: output, encoding: "utf8" });
  assert.equal(checks.status, 0, checks.stderr);
  const report = JSON.parse(readFileSync(join(output, "candidate-report.json"), "utf8"));
  assert.deepEqual(report.publication, { githubPrerelease: false, readmeMutation: false, youtubeUpload: false });
  assert.equal(report.video.status, "DISABLED_DEFAULT");
});

test("adversarial negative manifest matrix fails closed with machine-readable reasons", async (t) => {
  for (const entry of MATRIX.cases) {
    await t.test(entry.id, () => {
      const fx = fixture();
      const manifest = mutate(fx, entry.mutation);
      const extraArgs = entry.mutation === "RENDERER_UNAVAILABLE"
        ? ["--render-video", "--local-render-approval", `LOCAL_RENDER:${manifest.targetVersion}`, "--video-renderer", join(fx.root, "missing-renderer")]
        : [];
      const { output } = run(fx, { manifest, outputName: `negative-${entry.id}`, extraArgs, expectedStatus: 2 });
      assert.ok(reasons(output).some((reason) => reason.includes(entry.expectedReason)), `${entry.id}: ${reasons(output).join(", ")}`);
    });
  }
});

test("no material change returns NO_MATERIAL_CHANGE without fake release artifacts", () => {
  const fx = fixture();
  const manifest = structuredClone(fx.manifest);
  manifest.source.base = manifest.source.head;
  manifest.history = [];
  manifest.highlights = [];
  const { output, stdout } = run(fx, { manifest, outputName: "no-change", expectedStatus: 0 });
  assert.equal(stdout.verdict, "NO_MATERIAL_CHANGE");
  assert.throws(() => readFileSync(join(output, "release-notes.md")));
});

test("release-note or video drift is detected by deterministic verify", () => {
  const fx = fixture();
  const { output } = run(fx, { outputName: "drift", expectedStatus: 0 });
  writeFileSync(join(output, "video-narration.md"), "tampered\n", "utf8");
  const result = spawnSync(process.execPath, [
    CLI,
    "verify",
    "--manifest",
    join(fx.root, "drift-manifest.json"),
    "--source-repo",
    fx.source,
    "--output",
    output,
  ], { encoding: "utf8" });
  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.ok(JSON.parse(result.stdout).reasons.includes("OUTPUT_DRIFT:video-narration.md"));
});

test("partial run resumes idempotently and converges to byte-identical final state", () => {
  const fx = fixture();
  const partial = run(fx, { outputName: "partial", extraArgs: ["--stop-after", "3"], expectedStatus: 75 });
  assert.equal(partial.stdout.verdict, "PARTIAL");
  const resumed = run(fx, { outputName: "partial", expectedStatus: 0 });
  assert.equal(resumed.stdout.verdict, "READY_CANDIDATE");
  const fresh = run(fx, { outputName: "fresh", expectedStatus: 0 });
  const state = JSON.parse(readFileSync(join(resumed.output, ".daily-poc-state.json"), "utf8"));
  for (const name of [...state.completedFiles, ".daily-poc-state.json"]) {
    assert.deepEqual(readFileSync(join(resumed.output, name)), readFileSync(join(fresh.output, name)), name);
  }
});

test("two fixed-input builds are byte-identical", () => {
  const fx = fixture();
  const first = run(fx, { outputName: "first", expectedStatus: 0 });
  const second = run(fx, { outputName: "second", expectedStatus: 0 });
  const state = JSON.parse(readFileSync(join(first.output, ".daily-poc-state.json"), "utf8"));
  for (const name of [...state.completedFiles, ".daily-poc-state.json"]) {
    assert.deepEqual(readFileSync(join(first.output, name)), readFileSync(join(second.output, name)), name);
  }
});
