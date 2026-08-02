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
const EXAMPLE = join(ROOT, "examples", "daily-poc", "v0.2.0-poc.20260802.2", "manifest.json");
const TARGET_VERSION = "v0.2.0-poc.20260802.2";
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

function strings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
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
  const predecessorVersion = manifest.history.at(-1)?.version ?? "v0.2.0-poc.20260802.1";
  mkdirSync(join(source, "tools", "video-production-reference", "schemas"), { recursive: true });
  mkdirSync(join(source, "tools", "video-production-reference", "tests"), { recursive: true });
  writeFileSync(join(source, "README.md"), "# ChimpMaera\n\nBase.\n", "utf8");
  writeFileSync(join(source, "SHA256SUMS"), "fixture checksum evidence\n", "utf8");
  writeFileSync(join(source, "package.json"), "{\"name\":\"chimpmaera-fixture\",\"private\":true}\n", "utf8");
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
  writeFileSync(join(source, "package.json"), "{\"name\":\"chimpmaera-fixture\",\"private\":true,\"description\":\"current\"}\n", "utf8");
  writeFileSync(
    join(source, "README.md"),
    `# ChimpMaera\n\nBase.\n\n## Release status\n\n- **Current public release:** v0.1.0 — published; stable predecessor.\n- **Today's Daily:** [\`${TARGET_VERSION}\`](https://github.com/JimPansky/ChimpMaera/releases/tag/${TARGET_VERSION}) — Daily snapshot dated 2026-08-02.\n- **Previous Daily provenance:** \`${predecessorVersion}\` — predecessor provenance only.\n\n## Videos\n\nCurrent overview.\n`,
    "utf8",
  );
  git(source, "add", "README.md", "package.json");
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
    case "UNMARKED_V01_MIX":
      manifest.knownLimitations.push("The v0.1 candidate is today's current identity.");
      break;
    case "VERSIONED_README_IDENTITY":
      writeFileSync(
        join(fx.source, "README.md"),
        readFileSync(join(fx.source, "README.md"), "utf8").replace("# ChimpMaera\n", "# ChimpMaera v0.1\n"),
        "utf8",
      );
      break;
    case "PRIOR_DAY_CURRENT_FIELD":
      writeFileSync(
        join(fx.source, "README.md"),
        readFileSync(join(fx.source, "README.md"), "utf8").replace(TARGET_VERSION, "v0.2.0-poc.20260801.1"),
        "utf8",
      );
      break;
    case "DAILY_RELEASE_LINK_MISMATCH":
      writeFileSync(
        join(fx.source, "README.md"),
        readFileSync(join(fx.source, "README.md"), "utf8").replace(`/tag/${TARGET_VERSION}`, "/tag/v0.2.0-poc.20260801.1"),
        "utf8",
      );
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

test("current example rejects stale video IDs and mixed daily identity", () => {
  const manifest = JSON.parse(readFileSync(EXAMPLE, "utf8"));
  const manifestText = JSON.stringify(manifest);
  for (const stale of ["8mB7O81Y2xA", "8lj5nd-LJa4", "mxN9biyelZ0"]) {
    assert.equal(manifestText.includes(stale), false, stale);
  }
  const v01References = strings({ ...manifest, history: [] }).filter((value) => /\bv0\.1(?:\.0)?\b/.test(value));
  assert.ok(v01References.length > 0);
  for (const value of v01References) {
    assert.match(value, /\b(?:current public release|stable predecessor|historical predecessor)\b/i);
  }
  assert.equal(manifest.date, "2026-08-02");
  assert.equal(manifest.targetVersion, "v0.2.0-poc.20260802.2");
  assert.equal(manifest.video.title, "ChimpMaera POC Daily — 2026-08-02");
  assert.deepEqual(
    manifest.history.map(({ date, version }) => ({ date, version })),
    [{ date: "2026-08-02", version: "v0.2.0-poc.20260802.1" }],
  );

  const fx = fixture();
  const { output } = run(fx, { outputName: "current-identity", expectedStatus: 0 });
  const state = JSON.parse(readFileSync(join(output, ".daily-poc-state.json"), "utf8"));
  const texts = new Map(state.completedFiles.map((name) => [name, readFileSync(join(output, name), "utf8")]));
  const combined = [...texts.values()].join("\n");
  for (const stale of ["8mB7O81Y2xA", "8lj5nd-LJa4", "mxN9biyelZ0", "ChimpMaera POC Daily — 2026-08-01"]) {
    assert.equal(combined.includes(stale), false, stale);
  }
  for (const text of texts.values()) {
    for (const line of text.split("\n").filter((item) => /\bv0\.1(?:\.0)?\b/.test(item))) {
      assert.match(line, /\b(?:current public release|stable predecessor|historical predecessor)\b/i);
    }
  }
  const predecessorFiles = [...texts]
    .filter(([, text]) => text.includes("v0.2.0-poc.20260802.1"))
    .map(([name]) => name);
  assert.deepEqual(predecessorFiles, ["evidence-index.json"]);
  assert.equal(manifest.publication.youtubeUpload, false);
  const videoAdapter = JSON.parse(texts.get("video-adapter.json"));
  assert.equal(videoAdapter.invocationPolicy.publicationAvailable, false);
  assert.equal(videoAdapter.publicActions, "forbidden");
  assert.equal(JSON.parse(texts.get("candidate-report.json")).releaseTitle, "ChimpMaera POC Daily — 2026-08-02");
  assert.equal(JSON.parse(texts.get("snapshot.json")).version, "v0.2.0-poc.20260802.2");
  assert.equal(JSON.parse(texts.get("run-report.json")).candidateVersion, "v0.2.0-poc.20260802.2");
});

test("v0.1 public staging excludes repository-only daily pipeline surfaces", () => {
  const publicManifest = readFileSync(join(ROOT, "release", "public-files.manifest"), "utf8");
  assert.equal(publicManifest.includes("daily-poc"), false);
  assert.equal(publicManifest.includes("DAILY-POC"), false);
});
