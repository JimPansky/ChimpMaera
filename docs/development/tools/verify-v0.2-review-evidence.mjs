#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_INDEX = "docs/development/evidence/v0.2-review-readiness-20260801.json";
const EXPECTED_PHASES = [
  "approval_workbench",
  "provider_neutral_policy_contract",
  "paperless_zoo_adapter",
  "community_supply_chain_hardening",
  "post_wave_path_integrity",
];

function deny(code) {
  throw new Error(code);
}

function assert(condition, code) {
  if (!condition) deny(code);
}

function safeRelative(value) {
  assert(
    typeof value === "string"
      && value.length > 0
      && !path.isAbsolute(value)
      && !value.includes("\\")
      && !value.includes("\0")
      && value === value.normalize("NFC")
      && !value.split("/").some((part) => ["", ".", ".."].includes(part)),
    "REVIEW_INDEX_PATH_INVALID_DENIED",
  );
  return value;
}

function git(root, args, options = {}) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    }).trim();
  } catch {
    deny("REVIEW_INDEX_GIT_REFERENCE_INVALID_DENIED");
  }
}

function fullCommit(root, value) {
  assert(typeof value === "string" && /^[a-f0-9]{7,40}$/.test(value), "REVIEW_INDEX_COMMIT_INVALID_DENIED");
  return git(root, ["rev-parse", "--verify", `${value}^{commit}`]);
}

function changedPaths(root, commit) {
  return new Set(git(root, ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", commit]).split("\n"));
}

function pathAtCommit(root, commit, relative) {
  safeRelative(relative);
  const entry = git(root, ["ls-tree", commit, "--", relative]);
  assert(/^100(?:644|755) blob [a-f0-9]{40}\t/.test(entry), "REVIEW_INDEX_EVIDENCE_PATH_MISSING_DENIED");
}

async function safeLocalFile(root, relative) {
  const checked = safeRelative(relative);
  let cursor = root;
  for (const part of checked.split("/")) {
    cursor = path.join(cursor, part);
    let metadata;
    try {
      metadata = await lstat(cursor);
    } catch {
      deny("REVIEW_INDEX_EVIDENCE_PATH_MISSING_DENIED");
    }
    assert(!metadata.isSymbolicLink(), "REVIEW_INDEX_SYMLINK_PATH_DENIED");
  }
  const canonical = await realpath(cursor);
  const fromRoot = path.relative(root, canonical);
  assert(fromRoot !== ".." && !fromRoot.startsWith(`..${path.sep}`) && !path.isAbsolute(fromRoot), "REVIEW_INDEX_PATH_ESCAPE_DENIED");
  return cursor;
}

function manifestSources(text) {
  return new Set(text.split("\n").filter((line) => line && !line.startsWith("#")).map((line) => line.split("\t")[0]));
}

function countDiffStatuses(text) {
  const result = { files: 0, added: 0, modified: 0, deleted: 0 };
  for (const line of text.split("\n").filter(Boolean)) {
    const status = line.split("\t")[0];
    result.files += 1;
    if (status === "A") result.added += 1;
    else if (status === "M") result.modified += 1;
    else if (status === "D") result.deleted += 1;
    else deny("REVIEW_DIFF_STATUS_UNEXPECTED_DENIED");
  }
  return result;
}

function diffCheckCount(root, range) {
  const result = spawnSync("git", ["diff", "--check", range], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert([0, 2].includes(result.status), "REVIEW_DIFF_CHECK_EXECUTION_DENIED");
  return result.stdout.split("\n").filter((line) => /: (?:trailing whitespace|new blank line at EOF)\.$/.test(line)).length;
}

export async function verifyReviewEvidence({ root = process.cwd(), indexPath = DEFAULT_INDEX } = {}) {
  const canonicalRoot = await realpath(path.resolve(root));
  const indexFile = await safeLocalFile(canonicalRoot, indexPath);
  const index = JSON.parse(await readFile(indexFile, "utf8"));

  assert(index.schemaVersion === "chimpmaera.development/review-readiness-evidence/v1", "REVIEW_INDEX_SCHEMA_INVALID_DENIED");
  assert(index.scope === "LOCAL_V02_REVIEW_CANDIDATE_ONLY", "REVIEW_INDEX_SCOPE_INVALID_DENIED");
  assert(index.metric?.passed === 4 && index.metric?.total === 4 && index.metric?.status === "PASS", "REVIEW_INDEX_METRIC_INVALID_DENIED");

  const baseline = fullCommit(canonicalRoot, index.source?.baselineCommit);
  const audited = fullCommit(canonicalRoot, index.source?.auditedCommit);
  const packet = fullCommit(canonicalRoot, index.source?.validatedReviewPacketCommit);
  assert(git(canonicalRoot, ["merge-base", baseline, audited]) === baseline, "REVIEW_INDEX_BASELINE_ANCESTRY_DENIED");
  assert(git(canonicalRoot, ["merge-base", audited, packet]) === audited, "REVIEW_INDEX_PACKET_ANCESTRY_DENIED");
  const currentImplementationTip = git(canonicalRoot, ["log", "-1", "--format=%H", "HEAD", "--", ".", ":(exclude)docs/development/**"]);
  assert(currentImplementationTip === audited, "REVIEW_INDEX_STALE_AUDITED_COMMIT_DENIED");

  assert(Array.isArray(index.evidenceIndex), "REVIEW_INDEX_PHASES_INVALID_DENIED");
  assert(JSON.stringify(index.evidenceIndex.map(({ phase }) => phase)) === JSON.stringify(EXPECTED_PHASES), "REVIEW_INDEX_PHASES_INVALID_DENIED");
  const publicManifest = manifestSources(await readFile(await safeLocalFile(canonicalRoot, "release/public-files.manifest"), "utf8"));
  for (const phase of index.evidenceIndex) {
    const implementationCommit = fullCommit(canonicalRoot, phase.implementationCommit);
    assert(git(canonicalRoot, ["merge-base", baseline, implementationCommit]) === baseline, "REVIEW_INDEX_IMPLEMENTATION_ANCESTRY_DENIED");
    assert(git(canonicalRoot, ["merge-base", implementationCommit, audited]) === implementationCommit, "REVIEW_INDEX_IMPLEMENTATION_ANCESTRY_DENIED");
    const changed = changedPaths(canonicalRoot, implementationCommit);
    assert(Array.isArray(phase.implementationPaths) && phase.implementationPaths.length > 0, "REVIEW_INDEX_IMPLEMENTATION_PATHS_MISSING_DENIED");
    for (const relative of phase.implementationPaths) {
      pathAtCommit(canonicalRoot, audited, relative);
      assert(changed.has(relative), "REVIEW_INDEX_IMPLEMENTATION_COMMIT_MISMATCH_DENIED");
      assert(publicManifest.has(relative), "REVIEW_INDEX_PUBLIC_CLOSURE_MISMATCH_DENIED");
    }
    for (const relative of [phase.plan, phase.checkpoint, ...(phase.tests ?? []), phase.smokeEvidence, phase.integratedSmokeEvidence].filter(Boolean)) {
      pathAtCommit(canonicalRoot, packet, relative);
    }
    if (phase.checkpointCommit) fullCommit(canonicalRoot, phase.checkpointCommit);
  }

  assert(Array.isArray(index.claimAudit) && index.claimAudit.length === 4, "REVIEW_CLAIM_AUDIT_INCOMPLETE_DENIED");
  for (const claim of index.claimAudit) {
    pathAtCommit(canonicalRoot, audited, claim.surface);
    const surface = git(canonicalRoot, ["show", `${audited}:${safeRelative(claim.surface)}`]);
    assert(Array.isArray(claim.requiredFragments) && claim.requiredFragments.length > 0, "REVIEW_CLAIM_FRAGMENTS_MISSING_DENIED");
    for (const fragment of claim.requiredFragments) {
      assert(typeof fragment === "string" && fragment.length > 0 && surface.includes(fragment), "REVIEW_CLAIM_SURFACE_MISMATCH_DENIED");
    }
    assert(Array.isArray(claim.evidencePaths) && claim.evidencePaths.length > 0, "REVIEW_CLAIM_EVIDENCE_MISSING_DENIED");
    for (const relative of claim.evidencePaths) pathAtCommit(canonicalRoot, audited, relative);
  }

  const diff = index.diffAudit;
  assert(diff?.range === `${baseline}..${audited}`, "REVIEW_DIFF_RANGE_MISMATCH_DENIED");
  const statusCounts = countDiffStatuses(git(canonicalRoot, ["diff", "--name-status", "--no-renames", diff.range]));
  for (const key of ["files", "added", "modified", "deleted"]) {
    assert(statusCounts[key] === diff[key], "REVIEW_DIFF_COUNTS_MISMATCH_DENIED");
  }
  const shortStat = git(canonicalRoot, ["diff", "--shortstat", diff.range]);
  assert(shortStat.includes(`${diff.insertions} insertions(+)`) && shortStat.includes(`${diff.deletions} deletions(-)`), "REVIEW_DIFF_LINE_COUNTS_MISMATCH_DENIED");
  assert(diffCheckCount(canonicalRoot, diff.range) === diff.diffCheckFindings, "REVIEW_DIFF_CHECK_DRIFT_DENIED");
  assert(diff.deleted === 0 && diff.diffCheckClassification === "NON_FUNCTIONAL_SOURCE_HYGIENE_FOLLOW_UP", "REVIEW_DIFF_CLASSIFICATION_INVALID_DENIED");

  const profiles = index.rollbackAudit?.profiles;
  assert(Array.isArray(profiles) && profiles.length === 5, "REVIEW_ROLLBACK_PROFILES_INCOMPLETE_DENIED");
  for (const profile of profiles) {
    assert(Array.isArray(profile.revertOrder) && profile.revertOrder.length > 0, "REVIEW_ROLLBACK_ORDER_INVALID_DENIED");
    for (const commit of profile.revertOrder) fullCommit(canonicalRoot, commit);
    assert(profile.testsFailed === 0 && profile.testsPassed > 0, "REVIEW_ROLLBACK_TEST_EVIDENCE_INVALID_DENIED");
  }
  const allV02 = profiles.find(({ name }) => name === "all_v02");
  const baselineTree = git(canonicalRoot, ["rev-parse", `${baseline}^{tree}`]);
  assert(allV02?.baselineEquivalent === true && allV02.tree === baselineTree && allV02.baselineTree === baselineTree, "REVIEW_ROLLBACK_BASELINE_MISMATCH_DENIED");
  assert(profiles.find(({ name }) => name === "stability_only_emergency")?.safety === "UNSAFE_FOR_NORMAL_USE_REOPENS_KNOWN_PATH_ESCAPE", "REVIEW_ROLLBACK_UNSAFE_BOUNDARY_MISSING_DENIED");
  assert(/no remote review, release, provenance, security certification, live provider or live Paperless compatibility claim/.test(index.claimBoundary), "REVIEW_CLAIM_BOUNDARY_INVALID_DENIED");

  return {
    schemaVersion: "chimpmaera.development/adversarial-review-report/v1",
    status: "PASS",
    auditedCommit: audited,
    gates: [
      "CLAIM_CODE_EVIDENCE_RECONCILED",
      "REVIEW_INDEX_INTEGRITY_VERIFIED",
      "BASELINE_CANDIDATE_DIFF_AUDITED",
      "ROLLBACK_AND_CLAIM_BOUNDARIES_VERIFIED",
    ],
    diff: { ...statusCounts, diffCheckFindings: diff.diffCheckFindings },
    claimBoundary: index.claimBoundary,
  };
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invoked === fileURLToPath(import.meta.url)) {
  const report = await verifyReviewEvidence({ indexPath: process.argv[2] ?? DEFAULT_INDEX });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
