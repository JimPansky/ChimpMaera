#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const SCHEMA_PATH = join(REPO_ROOT, "schemas", "daily-poc-manifest-v1.schema.json");
const COMPILER_VERSION = "chimpmaera.daily-poc-compiler/v1";
const STATE_FILE = ".daily-poc-state.json";
const MATURITY = [
  "DESIGNED",
  "LOCALLY_VALIDATED",
  "CI_VALIDATED",
  "MERGED",
  "RELEASED",
  "PRODUCTION_VALIDATED",
];

class PipelineError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function sortById(values) {
  return [...values].sort((left, right) => left.id.localeCompare(right.id, "en"));
}

function parseArgs(argv) {
  const args = {
    command: argv[0],
    renderVideo: false,
    stopAfter: null,
  };
  if (!["prepare", "verify", "snapshot-digest"].includes(args.command)) {
    throw new PipelineError("USAGE", "command must be prepare, verify, or snapshot-digest");
  }
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--render-video") {
      args.renderVideo = true;
      continue;
    }
    const key = {
      "--manifest": "manifestPath",
      "--output": "outputPath",
      "--source-repo": "sourceRepo",
      "--local-render-approval": "localRenderApproval",
      "--video-renderer": "videoRenderer",
      "--stop-after": "stopAfter",
      "--snapshot": "snapshotPath",
    }[token];
    if (!key || index + 1 >= argv.length) throw new PipelineError("USAGE", `invalid option: ${token}`);
    args[key] = argv[index + 1];
    index += 1;
  }
  if (args.stopAfter !== null) {
    args.stopAfter = Number(args.stopAfter);
    if (!Number.isInteger(args.stopAfter) || args.stopAfter < 1) {
      throw new PipelineError("USAGE", "--stop-after must be a positive integer");
    }
  }
  return args;
}

function git(repo, args, allowFailure = false) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    throw new PipelineError("GIT_COMMAND_FAILED", `${args.join(" ")}: ${result.stderr.trim()}`);
  }
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function loadManifest(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    throw new PipelineError("MANIFEST_UNREADABLE", error.message);
  }
  try {
    return { manifest: JSON.parse(raw), raw, digest: sha256(raw) };
  } catch (error) {
    throw new PipelineError("MANIFEST_INVALID_JSON", error.message);
  }
}

function validateSchema(manifest) {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (validate(manifest)) return [];
  return validate.errors.map(
    (error) => `SCHEMA_INVALID:${error.instancePath || "/"}:${error.message}`,
  );
}

function dateToken(date) {
  return date.replaceAll("-", "");
}

function versionLine(version) {
  const match = /^v([0-9]+)\.([0-9]+)\.([0-9]+)(?:-|$)/.exec(version);
  return match ? `${match[1]}.${match[2]}` : null;
}

function stringValues(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringValues);
  return [];
}

function uniqueIds(values, label) {
  const seen = new Set();
  const issues = [];
  for (const value of values) {
    if (seen.has(value.id)) issues.push(`DUPLICATE_ID:${label}:${value.id}`);
    seen.add(value.id);
  }
  return issues;
}

function snapshotPayload(snapshot) {
  const { snapshotDigest: ignored, ...payload } = snapshot;
  return payload;
}

function verifyHistory(manifest) {
  const issues = [];
  const targetLine = versionLine(manifest.targetVersion);
  for (const snapshot of manifest.history) {
    const observed = sha256(canonicalJson(snapshotPayload(snapshot)));
    if (observed !== snapshot.snapshotDigest) {
      issues.push(`TAMPERED_PRIOR_SNAPSHOT:${snapshot.version}`);
    }
    if (snapshot.date === manifest.date && snapshot.sequence === manifest.sequence) {
      issues.push(`DUPLICATE_DAILY_SEQUENCE:${manifest.date}:${manifest.sequence}`);
    }
    const targetCore = manifest.targetVersion.split("-poc.", 1)[0];
    const expectedVersion = targetLine
      ? `${targetCore}-poc.${dateToken(snapshot.date)}.${snapshot.sequence}`
      : null;
    if (versionLine(snapshot.version) !== targetLine) {
      issues.push(`HISTORY_RELEASE_LINE_MISMATCH:${snapshot.version}:${manifest.targetVersion}`);
    } else if (snapshot.version !== expectedVersion) {
      issues.push(`HISTORY_VERSION_DATE_OR_SEQUENCE_MISMATCH:${snapshot.version}`);
    }
    if (`${snapshot.date}:${String(snapshot.sequence).padStart(10, "0")}` >= `${manifest.date}:${String(manifest.sequence).padStart(10, "0")}`) {
      issues.push(`HISTORY_NOT_PREDECESSOR:${snapshot.version}`);
    }
  }
  const ordered = [...manifest.history].sort((left, right) =>
    `${left.date}:${String(left.sequence).padStart(10, "0")}`.localeCompare(
      `${right.date}:${String(right.sequence).padStart(10, "0")}`,
      "en",
    ),
  );
  const previous = ordered.at(-1) ?? null;
  if (previous && previous.sourceHead !== manifest.source.base) {
    issues.push(`PREVIOUS_SNAPSHOT_BASE_MISMATCH:${previous.sourceHead}:${manifest.source.base}`);
  }
  return { issues, previous };
}

function resolveRepoPath(repo, repoPath) {
  if (isAbsolute(repoPath) || repoPath.includes("\\")) {
    throw new PipelineError("UNSAFE_REPO_PATH", repoPath);
  }
  const root = realpathSync(repo);
  const candidate = resolve(root, repoPath);
  const rel = relative(root, candidate);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new PipelineError("UNSAFE_REPO_PATH", repoPath);
  }
  if (!existsSync(candidate)) throw new PipelineError("MISSING_EVIDENCE", repoPath);
  const metadata = lstatSync(candidate);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new PipelineError("UNSAFE_EVIDENCE_TYPE", repoPath);
  }
  const resolved = realpathSync(candidate);
  const resolvedRel = relative(root, resolved);
  if (resolvedRel === ".." || resolvedRel.startsWith(`..${sep}`) || isAbsolute(resolvedRel)) {
    throw new PipelineError("EVIDENCE_PATH_ESCAPE", repoPath);
  }
  return resolved;
}

function sourceFacts(manifest, sourceRepo) {
  const issues = [];
  const repo = realpathSync(sourceRepo);
  if (git(repo, ["rev-parse", "--is-inside-work-tree"], true).stdout !== "true") {
    return { issues: ["SOURCE_NOT_GIT_WORKTREE"], changedFiles: [], commits: [] };
  }
  const observedHead = git(repo, ["rev-parse", "HEAD"]).stdout;
  if (observedHead !== manifest.source.head) {
    issues.push(`SOURCE_HEAD_MISMATCH:${observedHead}:${manifest.source.head}`);
  }
  const dirty = git(repo, ["status", "--porcelain"]).stdout;
  if (dirty) issues.push("SOURCE_WORKTREE_DIRTY");
  for (const commit of [manifest.source.base, manifest.source.head]) {
    if (git(repo, ["cat-file", "-e", `${commit}^{commit}`], true).status !== 0) {
      issues.push(`SOURCE_COMMIT_MISSING:${commit}`);
    }
  }
  if (issues.some((issue) => issue.startsWith("SOURCE_COMMIT_MISSING"))) {
    return { issues, changedFiles: [], commits: [] };
  }
  if (git(repo, ["merge-base", "--is-ancestor", manifest.source.base, manifest.source.head], true).status !== 0) {
    issues.push("SOURCE_BASE_NOT_ANCESTOR");
  }
  const changedFiles = git(repo, ["diff", "--name-only", `${manifest.source.base}..${manifest.source.head}`]).stdout
    .split("\n")
    .filter(Boolean)
    .sort();
  const commits = git(repo, ["log", "--reverse", "--format=%H%x09%s", `${manifest.source.base}..${manifest.source.head}`]).stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [id, ...subject] = line.split("\t");
      return { id, subject: subject.join("\t") };
    });
  return { issues, changedFiles, commits };
}

function scanUnsafe(value, label) {
  const text = typeof value === "string" ? value : canonicalJson(value);
  const patterns = [
    ["PRIVATE_KEY", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["GITHUB_TOKEN", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
    ["GITLAB_TOKEN", /\bglpat-[A-Za-z0-9_-]{20,}\b/],
    ["OPENAI_KEY", /\bsk-[A-Za-z0-9_-]{20,}\b/],
    ["HUGGINGFACE_TOKEN", /\bhf_[A-Za-z0-9]{20,}\b/],
    ["TELEGRAM_TOKEN", /\b[0-9]{8,12}:[A-Za-z0-9_-]{30,}\b/],
    ["AWS_KEY", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
    ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
    ["CREDENTIAL_URL", /https?:\/\/[^/\s:@]+:[^/\s@]+@/],
    ["INTERNAL_HOME_PATH", /\/home\/[A-Za-z0-9._-]+(?:\/|\b)/],
    ["INTERNAL_MOUNT_PATH", /\/mnt\/[A-Za-z0-9._-]+(?:\/|\b)/],
    ["SESSION_IDENTIFIER", /\bagent:[A-Za-z0-9._-]+:[A-Za-z0-9._:-]+\b/],
  ];
  return patterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => `UNSAFE_CONTENT:${name}:${label}`);
}

function semanticIssues(manifest, sourceRepo, facts) {
  const issues = [
    ...uniqueIds(manifest.highlights, "highlight"),
    ...uniqueIds(manifest.useCases, "useCase"),
    ...uniqueIds(manifest.controls, "control"),
    ...uniqueIds(manifest.evidence, "evidence"),
    ...uniqueIds(manifest.claims, "claim"),
    ...uniqueIds(manifest.video.segments, "videoSegment"),
    ...uniqueIds(manifest.video.assets, "videoAsset"),
    ...scanUnsafe(manifest, "manifest"),
  ];
  const expectedVersion = new RegExp(`^v(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)-poc\\.${dateToken(manifest.date)}\\.${manifest.sequence}$`);
  if (!expectedVersion.test(manifest.targetVersion)) issues.push("VERSION_DATE_OR_SEQUENCE_MISMATCH");
  const targetLine = versionLine(manifest.targetVersion);
  const { history: ignoredHistory, ...currentManifest } = manifest;
  for (const value of stringValues(currentManifest)) {
    for (const match of value.matchAll(/\bv([0-9]+)\.([0-9]+)(?:\.[0-9]+)?\b/g)) {
      const observedLine = `${match[1]}.${match[2]}`;
      if (
        observedLine !== targetLine &&
        !/\b(?:histor(?:y|ical)|predecessor|provenance|current public release|stable)\b/i.test(value)
      ) {
        issues.push(`UNMARKED_MIXED_RELEASE_LINE:v${observedLine}`);
      }
    }
  }
  if (manifest.video.title !== `PanSphaira POC Daily — ${manifest.date}`) {
    issues.push("CURRENT_DAILY_TITLE_MISMATCH");
  }
  if (manifest.source.base === manifest.source.head && facts.changedFiles.length !== 0) {
    issues.push("SOURCE_DIFF_CONTRADICTION");
  }

  const changed = new Set(facts.changedFiles);
  const commitIds = new Set(facts.commits.map((commit) => commit.id));
  for (const highlight of manifest.highlights) {
    for (const file of highlight.fileRefs) {
      if (!changed.has(file)) issues.push(`HIGHLIGHT_FILE_NOT_CHANGED:${highlight.id}:${file}`);
    }
    for (const commit of highlight.commitIds) {
      if (!commitIds.has(commit)) issues.push(`HIGHLIGHT_COMMIT_OUTSIDE_RANGE:${highlight.id}:${commit}`);
    }
  }
  if (facts.changedFiles.length > 0 && manifest.highlights.length === 0) issues.push("MATERIAL_CHANGE_WITHOUT_HIGHLIGHT");

  try {
    const readme = readFileSync(resolveRepoPath(sourceRepo, "README.md"), "utf8");
    const heading = readme.match(/^# (.+)$/m)?.[1] ?? null;
    if (heading !== "PanSphaira") issues.push("README_CURRENT_IDENTITY_MUST_BE_TIMELESS");
    const activeReleaseSection = readme.split(/^## /m).find((value) => value.startsWith("Releases")) ?? "";
    const stableReleaseLinks = [
      "](https://github.com/JoFe2/PANSPHAIRA/releases/latest)",
      "](https://github.com/JoFe2/PANSPHAIRA/releases)",
      "](https://github.com/JoFe2/PANSPHAIRA/releases.atom)",
    ];
    if (!stableReleaseLinks.every((link) => activeReleaseSection.includes(link)) || /\breleases\/tag\//i.test(activeReleaseSection)) {
      issues.push("README_PUBLIC_RELEASE_STATUS_MISSING_OR_INVALID");
    }
    if (/Today's Daily|Previous Daily|POC Daily|Daily snapshot/i.test(activeReleaseSection)) {
      issues.push("README_CALENDAR_RELEASE_IDENTITY_DENIED");
    }
  } catch (error) {
    issues.push(`${error.code ?? "README_STATUS_ERROR"}:README.md:${error.message}`);
  }

  const evidence = new Map(manifest.evidence.map((item) => [item.id, item]));
  const claims = new Map(manifest.claims.map((item) => [item.id, item]));
  const useCases = new Map(manifest.useCases.map((item) => [item.id, item]));
  const validateRefs = (owner, refs) => {
    for (const ref of refs) if (!evidence.has(ref)) issues.push(`MISSING_EVIDENCE_REF:${owner}:${ref}`);
  };
  for (const item of manifest.evidence) {
    try {
      const path = resolveRepoPath(sourceRepo, item.path);
      const observed = sha256File(path);
      if (observed !== item.sha256) issues.push(`EVIDENCE_HASH_MISMATCH:${item.id}`);
      if (item.validUntil < manifest.date) issues.push(`STALE_EVIDENCE:${item.id}`);
      if (item.sourceCommit !== manifest.source.head) issues.push(`EVIDENCE_SOURCE_MISMATCH:${item.id}`);
    } catch (error) {
      issues.push(`${error.code ?? "EVIDENCE_ERROR"}:${item.id}:${error.message}`);
    }
  }
  for (const claim of manifest.claims) {
    validateRefs(claim.id, claim.evidenceRefs);
    const claimRank = MATURITY.indexOf(claim.maturity);
    for (const ref of claim.evidenceRefs) {
      const item = evidence.get(ref);
      if (item && MATURITY.indexOf(item.maturity) < claimRank) {
        issues.push(`CLAIM_EXCEEDS_EVIDENCE_MATURITY:${claim.id}:${ref}`);
      }
    }
    const claimEvidence = claim.evidenceRefs.map((ref) => evidence.get(ref)).filter(Boolean);
    if (claim.maturity === "LOCALLY_VALIDATED" && !claimEvidence.some((item) => ["TEST", "NEGATIVE_PROBE"].includes(item.kind))) {
      issues.push(`LOCAL_VALIDATION_EVIDENCE_MISSING:${claim.id}`);
    }
    if (claim.maturity === "CI_VALIDATED" && !claimEvidence.some((item) => item.kind === "CI")) {
      issues.push(`CI_VALIDATION_EVIDENCE_MISSING:${claim.id}`);
    }
    if (claim.maturity === "MERGED") {
      const merged = git(sourceRepo, ["merge-base", "--is-ancestor", manifest.source.head, "refs/remotes/origin/main"], true).status === 0;
      if (!merged) issues.push(`MERGED_SOURCE_NOT_ON_ORIGIN_MAIN:${claim.id}`);
    }
    if (claim.maturity === "RELEASED") {
      const tags = git(sourceRepo, ["tag", "--contains", manifest.source.head], true).stdout;
      if (!tags || !claimEvidence.some((item) => item.kind === "RELEASE_ATTESTATION")) {
        issues.push(`RELEASE_EVIDENCE_MISSING:${claim.id}`);
      }
    }
    if (claim.maturity === "PRODUCTION_VALIDATED" && !claimEvidence.some((item) => item.kind === "PRODUCTION_RECORD")) {
      issues.push(`PRODUCTION_EVIDENCE_MISSING:${claim.id}`);
    }
    if (/\breleased\b|\bpublished\b/i.test(claim.statement) && claimRank < MATURITY.indexOf("RELEASED")) {
      issues.push(`UNSAFE_RELEASE_WORDING:${claim.id}`);
    }
    if (/\bproduction[- ]validated\b|\bin production\b/i.test(claim.statement) && claimRank < MATURITY.indexOf("PRODUCTION_VALIDATED")) {
      issues.push(`UNSAFE_PRODUCTION_WORDING:${claim.id}`);
    }
    for (const nonClaim of claim.nonClaims) {
      if (nonClaim.contradictsClaimIds.includes(claim.id)) {
        issues.push(`CONTRADICTORY_CLAIM_NON_CLAIM:${claim.id}:${nonClaim.id}`);
      }
      if (nonClaim.statement.trim().toLowerCase() === claim.statement.trim().toLowerCase()) {
        issues.push(`CONTRADICTORY_CLAIM_TEXT:${claim.id}:${nonClaim.id}`);
      }
    }
  }
  for (const useCase of manifest.useCases) validateRefs(useCase.id, useCase.evidenceRefs);
  for (const check of [...manifest.tests, ...manifest.negativeProbes]) validateRefs(check.id, check.evidenceRefs);

  const orders = new Set();
  for (const segment of manifest.video.segments) {
    if (orders.has(segment.order)) issues.push(`NONDETERMINISTIC_VIDEO_ORDER:${segment.order}`);
    orders.add(segment.order);
    for (const ref of segment.claimRefs) {
      if (!claims.has(ref)) issues.push(`VIDEO_UNKNOWN_CLAIM:${segment.id}:${ref}`);
      const claim = claims.get(ref);
      if (claim && /\breleased\b|\bpublished\b/i.test(segment.narration) && MATURITY.indexOf(claim.maturity) < MATURITY.indexOf("RELEASED")) {
        issues.push(`LOCAL_CLAIM_NARRATED_AS_RELEASED:${segment.id}:${ref}`);
      }
    }
    for (const ref of segment.useCaseRefs) if (!useCases.has(ref)) issues.push(`VIDEO_UNKNOWN_USE_CASE:${segment.id}:${ref}`);
  }
  for (const asset of manifest.video.assets) {
    if (asset.status === "ACCEPTED" && (!asset.path || !asset.sha256)) issues.push(`ACCEPTED_VIDEO_ASSET_INCOMPLETE:${asset.id}`);
    if (asset.role === "SHOT" && asset.segmentRef && !manifest.video.segments.some((segment) => segment.id === asset.segmentRef)) {
      issues.push(`VIDEO_ASSET_UNKNOWN_SEGMENT:${asset.id}:${asset.segmentRef}`);
    }
  }
  if (
    manifest.publication.githubPrerelease ||
    manifest.publication.youtubeUpload ||
    manifest.publication.readmeMutation
  ) {
    issues.push("PUBLICATION_REQUEST_WITHOUT_SEPARATE_AUTHORIZED_STAGE");
  }
  return issues;
}

function markdownList(items, render) {
  return items.length ? items.map((item) => `- ${render(item)}`).join("\n") : "- None";
}

function incrementCandidateTitle(manifest) {
  const functionalName = manifest.highlights[0]?.title ?? "Functional product change";
  return `PanSphaira — ${functionalName} (Increment Candidate)`;
}

function buildCoreArtifacts(manifest, manifestDigest, facts, previous, videoStatus) {
  const highlights = sortById(manifest.highlights);
  const claims = sortById(manifest.claims);
  const useCases = sortById(manifest.useCases);
  const evidence = sortById(manifest.evidence);
  const segments = [...manifest.video.segments].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id, "en"));
  const releaseTitle = incrementCandidateTitle(manifest);

  const trace = (item) => {
    const issueIds = item.issueIds.length ? item.issueIds.join(", ") : "none";
    return `issues: ${issueIds}; PR: pending candidate branch; cases: ${item.caseIds.join(", ")}`;
  };
  const securityClaims = claims.filter((claim) => claim.category === "SECURITY");
  const plannedClaims = claims.filter((claim) => claim.maturity === "DESIGNED");
  const provenClaims = claims.filter((claim) => claim.maturity !== "DESIGNED");
  const nonClaims = claims.flatMap((claim) => claim.nonClaims.map((item) => ({ ...item, claimId: claim.id })));
  const releaseNotes = `# ${releaseTitle}\n\nCandidate version: \`${manifest.targetVersion}\`\n\nSource: \`${manifest.source.base}\` → \`${manifest.source.head}\`\n\nThis deterministic package records the prepublication candidate gate. It does not itself push, merge, tag, release, upload, or mutate external state; current public status is established only by GitHub readback.\n\n## Added\n\n${markdownList(highlights, (item) => `**${item.id} — ${item.title}.** ${item.description} (${trace(item)}; files: ${item.fileRefs.join(", ")})`)}\n\n## Changed\n\n- Frozen cumulative source range: \`${manifest.source.base}\` → \`${manifest.source.head}\`.\n- Material files in range: ${facts.changedFiles.length}.\n- Candidate evidence remains locally scoped; later release status requires independent public verification.\n\n## Security\n\n${markdownList(securityClaims, (claim) => `**${claim.id} [${claim.maturity}]** ${claim.statement} Evidence: ${claim.evidenceRefs.join(", ")}.`)}\n\n## Evidence\n\n### PROVEN IN THIS SNAPSHOT\n\n${markdownList(provenClaims, (claim) => `**${claim.id} [${claim.maturity}]** ${claim.statement} Evidence: ${claim.evidenceRefs.join(", ")}.`)}\n\n### LOCALLY VALIDATED AT CANDIDATE BUILD TIME\n\n- The exact candidate source and evidence were locally validated before the publication workflow. This artifact alone does not prove merge, tag, release, deployment, upload, or production status.\n\n### PLANNED / IN PROGRESS\n\n${markdownList(plannedClaims, (claim) => `**${claim.id} [${claim.maturity}]** ${claim.statement} Evidence: ${claim.evidenceRefs.join(", ")}.`)}\n\n### NOT CLAIMED / EXTERNAL GATES\n\n${markdownList(nonClaims, (item) => `**${item.id}** (${item.claimId}) ${item.statement}`)}\n\n${markdownList(manifest.externalGates, (item) => item)}\n\n### Evidence index\n\n${markdownList(evidence, (item) => `**${item.id} [${item.maturity}]** \`${item.path}\` at \`${item.sourceCommit}\`, SHA-256 \`${item.sha256}\`.`)}\n\n## Known limitations\n\n${markdownList(manifest.knownLimitations, (item) => item)}\n\n## Planned next at candidate build time\n\n${markdownList(manifest.externalGates, (item) => item)}\n`;

  const demoGuide = `# Daily POC demo guide\n\nVersion: \`${manifest.targetVersion}\`\n\n${useCases.map((useCase) => `## ${useCase.id} — ${useCase.title}\n\nInputs:\n\n${markdownList(useCase.inputs, (item) => item)}\n\nSteps:\n\n${useCase.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n\nExpected outcomes:\n\n${markdownList(useCase.expectedOutcomes, (item) => item)}\n\nDemo utility: ${useCase.demoUtility}\n\nEvidence: ${useCase.evidenceRefs.join(", ")}\n`).join("\n")}\n## Reproduction\n\n${manifest.reproductionCommands.map((command) => `- \`${command}\``).join("\n")}\n`;

  const evidenceSummary = `${`# Evidence summary\n\nCandidate: \`${manifest.targetVersion}\`\n\n${evidence.map((item) => `## ${item.id}\n\n- Kind: ${item.kind}\n- Maturity: ${item.maturity}\n- Status: ${item.status}\n- Source commit: \`${item.sourceCommit}\`\n- Repository path: \`${item.path}\`\n- SHA-256: \`${item.sha256}\`\n- Validity: ${item.observedOn} through ${item.validUntil}\n`).join("\n")}`.trimEnd()}\n`;

  const knownLimitations = `# Known limitations and non-claims\n\n${markdownList(manifest.knownLimitations, (item) => item)}\n\n## External gates\n\n${markdownList(manifest.externalGates, (item) => item)}\n\n## Publication state\n\n- GitHub prerelease: disabled\n- YouTube upload: disabled\n- README mutation: disabled\n`;

  const narration = `# Video narration\n\nTitle: ${manifest.video.title}\n\nCandidate: \`${manifest.targetVersion}\`\n\n${segments.map((segment) => `## ${segment.order}. ${segment.title}\n\n${segment.narration}\n\n${segment.claimRefs.map((ref) => {
    const claim = claims.find((item) => item.id === ref);
    return `Claim ${claim.id} [${claim.maturity}]: ${claim.statement}`;
  }).join("\n")}\n`).join("\n")}\nFinal disclosure: this deterministic video package records prepublication preparation. Verify any later publication status independently.\n`;

  const readmePointer = `## Product increment candidate package\n\n[${releaseTitle}](./release-notes.md) — \`${manifest.targetVersion}\` — deterministic candidate evidence; consult anonymous GitHub release readback for current public status.\n`;

  const videoBrief = {
    schemaVersion: "chimpmaera.daily-poc-video-brief/v1",
    candidateVersion: manifest.targetVersion,
    title: manifest.video.title,
    description: manifest.video.description,
    language: manifest.video.language,
    sourceManifestSha256: manifestDigest,
    claims: claims.map(({ id, maturity, statement, evidenceRefs }) => ({ id, maturity, statement, evidenceRefs })),
    useCases: useCases.map(({ id, title, demoUtility }) => ({ id, title, demoUtility })),
    segments,
    publication: { youtubeUpload: false },
  };

  const storyboard = {
    schemaVersion: "chimpmaera.daily-poc-storyboard/v1",
    candidateVersion: manifest.targetVersion,
    sourceManifestSha256: manifestDigest,
    segments: segments.map((segment) => ({
      id: segment.id,
      order: segment.order,
      durationSeconds: segment.durationSeconds,
      title: segment.title,
      purpose: segment.purpose,
      visuals: segment.visuals,
      claimFacts: segment.claimRefs.map((ref) => {
        const claim = claims.find((item) => item.id === ref);
        return { id: claim.id, maturity: claim.maturity, statement: claim.statement };
      }),
      useCaseRefs: segment.useCaseRefs,
    })),
  };

  const videoAdapter = {
    schemaVersion: "chimpmaera.daily-poc-video-adapter/v1",
    candidateVersion: manifest.targetVersion,
    sourceManifestSha256: manifestDigest,
    targetContract: manifest.video.rendererContract,
    adapter: "external cm.video/v1 artifact",
    renderDefault: false,
    publicActions: "forbidden",
    status: videoStatus,
    requiredStages: [
      "manifest_validate",
      "scene_plan",
      "narration_and_storyboard",
      "evidence_claim_crosscheck",
      "draft_render",
      "technical_and_claim_qc",
      "publishable_asset_staging",
    ],
    prerequisites: manifest.video.prerequisites,
    assets: sortById(manifest.video.assets),
    invocationPolicy: {
      localRenderFlag: "--render-video",
      approvalBinding: `LOCAL_RENDER:${manifest.targetVersion}`,
      publicationAvailable: false,
      overwrite: false,
    },
  };

  const evidenceIndex = {
    schemaVersion: "chimpmaera.daily-poc-evidence-index/v1",
    candidateVersion: manifest.targetVersion,
    source: manifest.source,
    previousVerifiedSnapshot: previous,
    evidence,
    claims: claims.map(({ id, category, maturity, evidenceRefs }) => ({ id, category, maturity, evidenceRefs })),
    tests: sortById(manifest.tests),
    negativeProbes: sortById(manifest.negativeProbes),
  };

  const provenance = {
    schemaVersion: "chimpmaera.daily-poc-provenance/v1",
    candidateVersion: manifest.targetVersion,
    compiler: COMPILER_VERSION,
    manifestSha256: manifestDigest,
    source: manifest.source,
    materialChange: {
      changedFiles: facts.changedFiles,
      commits: facts.commits,
    },
    publicationEffects: [],
  };

  const sbom = {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `PanSphaira-${manifest.targetVersion}-daily-poc-inputs`,
    documentNamespace: `https://chimpmaera.local/spdx/${manifest.targetVersion}`,
    creationInfo: {
      created: `${manifest.date}T00:00:00Z`,
      creators: [`Tool: ${COMPILER_VERSION}`],
      comment: "Timestamp is deterministically derived from the canonical manifest date.",
    },
    packages: [{
      SPDXID: "SPDXRef-Package-ChimpMaera",
      name: "PanSphaira",
      versionInfo: manifest.targetVersion,
      downloadLocation: "NOASSERTION",
      filesAnalyzed: false,
      externalRefs: [{
        referenceCategory: "OTHER",
        referenceType: "gitCommit",
        referenceLocator: manifest.source.head,
      }],
    }],
    annotations: evidence.map((item) => ({
      annotationType: "OTHER",
      annotator: `Tool: ${COMPILER_VERSION}`,
      annotationDate: `${manifest.date}T00:00:00Z`,
      comment: `${item.id} ${item.path} sha256:${item.sha256}`,
    })),
  };

  return new Map([
    ["demo-guide.md", demoGuide],
    ["evidence-index.json", canonicalJson(evidenceIndex)],
    ["evidence-summary.md", evidenceSummary],
    ["known-limitations.md", knownLimitations],
    ["provenance.json", canonicalJson(provenance)],
    ["readme-pointer.md", readmePointer],
    ["release-notes.md", releaseNotes],
    ["sbom.spdx.json", canonicalJson(sbom)],
    ["video-adapter.json", canonicalJson(videoAdapter)],
    ["video-brief.json", canonicalJson(videoBrief)],
    ["video-narration.md", narration],
    ["video-storyboard.json", canonicalJson(storyboard)],
  ]);
}

function videoPreflight(manifest, renderRequested, approval, rendererPath) {
  const assetsReady = manifest.video.assets.length > 0 && manifest.video.assets.every(
    (asset) => asset.status === "ACCEPTED" && asset.path && asset.sha256,
  );
  if (!renderRequested) return { status: "DISABLED_DEFAULT", issues: [] };
  const issues = [];
  if (approval !== `LOCAL_RENDER:${manifest.targetVersion}`) issues.push("LOCAL_VIDEO_RENDER_APPROVAL_MISSING");
  if (!assetsReady) issues.push("VIDEO_RENDERER_PREREQUISITES_UNSATISFIED");
  if (!rendererPath || !existsSync(rendererPath)) {
    issues.push("VIDEO_RENDERER_UNAVAILABLE");
  }
  return { status: issues.length ? "BLOCKED" : "READY_FOR_CLOSED_ADAPTER", issues };
}

function safeOutput(outputPath) {
  const output = resolve(outputPath);
  if (output === resolve(sep) || output === REPO_ROOT) throw new PipelineError("UNSAFE_OUTPUT", output);
  return output;
}

function atomicWrite(path, content, mode = 0o644) {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    if (!statSync(path).isFile()) throw new PipelineError("OUTPUT_PATH_NOT_FILE", path);
    if (readFileSync(path).equals(Buffer.from(content))) return;
    throw new PipelineError("OWNED_OUTPUT_TAMPER_OR_DRIFT", path);
  }
  const temporary = `${path}.partial`;
  if (existsSync(temporary)) {
    if (!statSync(temporary).isFile()) throw new PipelineError("UNSAFE_PARTIAL_OUTPUT", temporary);
    if (!readFileSync(temporary).equals(Buffer.from(content))) throw new PipelineError("PARTIAL_OUTPUT_COLLISION", temporary);
  } else {
    writeFileSync(temporary, content, { encoding: typeof content === "string" ? "utf8" : undefined, mode });
    chmodSync(temporary, mode);
  }
  renameSync(temporary, path);
}

function stateContent({ manifestDigest, manifest, phase, completedFiles, verdict, reasons, revision }) {
  return canonicalJson({
    schemaVersion: "chimpmaera.daily-poc-run-state/v1",
    manifestSha256: manifestDigest,
    candidateVersion: manifest?.targetVersion ?? null,
    phase,
    revision,
    completedFiles: [...completedFiles].sort(),
    verdict,
    reasons: [...reasons].sort(),
    resumable: phase !== "complete",
  });
}

function initializeOutput(output, manifestDigest, manifest) {
  if (existsSync(output)) {
    if (!statSync(output).isDirectory()) throw new PipelineError("OUTPUT_NOT_DIRECTORY", output);
    const statePath = join(output, STATE_FILE);
    if (!existsSync(statePath)) throw new PipelineError("OUTPUT_NOT_OWNED", output);
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    if (state.manifestSha256 !== manifestDigest) throw new PipelineError("RESUME_MANIFEST_MISMATCH", output);
    return state;
  }
  mkdirSync(output, { recursive: true, mode: 0o755 });
  atomicWrite(
    join(output, STATE_FILE),
    stateContent({ manifestDigest, manifest, phase: "initialized", completedFiles: [], verdict: null, reasons: [], revision: 0 }),
  );
  return { completedFiles: [] };
}

function overwriteState(output, content) {
  const path = join(output, STATE_FILE);
  const temporary = `${path}.next`;
  writeFileSync(temporary, content, { encoding: "utf8", mode: 0o644 });
  renameSync(temporary, path);
}

function blockedReport(manifest, manifestDigest, reasons) {
  return canonicalJson({
    schemaVersion: "chimpmaera.daily-poc-candidate-report/v1",
    candidateVersion: manifest?.targetVersion ?? null,
    manifestSha256: manifestDigest ?? null,
    verdict: "BLOCKED",
    reasons: [...new Set(reasons)].sort(),
    publicationEffects: [],
  });
}

function writeBlocked(outputPath, manifest, manifestDigest, reasons) {
  const output = safeOutput(outputPath);
  initializeOutput(output, manifestDigest ?? sha256("unreadable-manifest"), manifest);
  atomicWrite(join(output, "candidate-report.json"), blockedReport(manifest, manifestDigest, reasons));
  overwriteState(
    output,
    stateContent({
      manifestDigest: manifestDigest ?? sha256("unreadable-manifest"),
      manifest,
      phase: "blocked",
      completedFiles: ["candidate-report.json"],
      verdict: "BLOCKED",
      reasons,
      revision: 1,
    }),
  );
}

function prepare(args) {
  if (!args.manifestPath || !args.outputPath || !args.sourceRepo) {
    throw new PipelineError("USAGE", "prepare requires --manifest, --output, and --source-repo");
  }
  const loaded = loadManifest(resolve(args.manifestPath));
  const { manifest, digest: manifestDigest } = loaded;
  const schemaIssues = validateSchema(manifest);
  if (schemaIssues.length) {
    writeBlocked(args.outputPath, manifest, manifestDigest, schemaIssues);
    return { verdict: "BLOCKED", reasons: schemaIssues, exitCode: 2 };
  }
  const output = safeOutput(args.outputPath);
  const sourceRoot = realpathSync(args.sourceRepo);
  const outputInsideSource = relative(sourceRoot, output);
  if (!outputInsideSource || (!outputInsideSource.startsWith(`..${sep}`) && outputInsideSource !== ".." && !isAbsolute(outputInsideSource))) {
    const outputIssues = ["OUTPUT_INSIDE_FROZEN_SOURCE"];
    return { verdict: "BLOCKED", reasons: outputIssues, exitCode: 2 };
  }
  const history = verifyHistory(manifest);
  let facts;
  try {
    facts = sourceFacts(manifest, args.sourceRepo);
  } catch (error) {
    facts = { issues: [`${error.code ?? "SOURCE_ERROR"}:${error.message}`], changedFiles: [], commits: [] };
  }
  const video = videoPreflight(manifest, args.renderVideo, args.localRenderApproval, args.videoRenderer);
  const issues = [
    ...history.issues,
    ...facts.issues,
    ...semanticIssues(manifest, args.sourceRepo, facts),
    ...video.issues,
  ];
  if (issues.length) {
    writeBlocked(args.outputPath, manifest, manifestDigest, issues);
    return { verdict: "BLOCKED", reasons: [...new Set(issues)].sort(), exitCode: 2 };
  }
  initializeOutput(output, manifestDigest, manifest);

  if (facts.changedFiles.length === 0) {
    const report = canonicalJson({
      schemaVersion: "chimpmaera.daily-poc-candidate-report/v1",
      candidateVersion: manifest.targetVersion,
      manifestSha256: manifestDigest,
      verdict: "NO_MATERIAL_CHANGE",
      reasons: ["SOURCE_BASE_EQUALS_HEAD_OR_DIFF_EMPTY"],
      generatedReleaseArtifacts: [],
      publicationEffects: [],
    });
    atomicWrite(join(output, "candidate-report.json"), report);
    overwriteState(
      output,
      stateContent({ manifestDigest, manifest, phase: "complete", completedFiles: ["candidate-report.json"], verdict: "NO_MATERIAL_CHANGE", reasons: ["SOURCE_BASE_EQUALS_HEAD_OR_DIFF_EMPTY"], revision: 1 }),
    );
    return { verdict: "NO_MATERIAL_CHANGE", reasons: ["SOURCE_BASE_EQUALS_HEAD_OR_DIFF_EMPTY"], exitCode: 0 };
  }

  const artifacts = buildCoreArtifacts(manifest, manifestDigest, facts, history.previous, video.status);
  const coreDigests = [...artifacts.entries()].map(([path, content]) => ({ path, sha256: sha256(content), size: Buffer.byteLength(content) }));
  const artifactManifest = canonicalJson({
    schemaVersion: "chimpmaera.daily-poc-artifacts/v1",
    candidateVersion: manifest.targetVersion,
    manifestSha256: manifestDigest,
    artifacts: coreDigests.sort((a, b) => a.path.localeCompare(b.path, "en")),
  });
  artifacts.set("artifact-manifest.json", artifactManifest);
  const artifactManifestSha256 = sha256(artifactManifest);

  const runReport = canonicalJson({
    schemaVersion: "chimpmaera.daily-poc-run-report/v1",
    candidateVersion: manifest.targetVersion,
    manifestSha256: manifestDigest,
    run_duration: { unit: "logical_gate_steps", value: 8 },
    gate_durations: Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`gate_${index + 1}`, 1])),
    failed_gates: [],
    retries: 0,
    manual_interventions: 0,
    claim_evidence_deviations: [],
    render_results: { status: video.status, rendered: false },
    qc_results: { secretScan: "PASS", internalPathScan: "PASS", claimScan: "PASS" },
    artifact_sha256_digests: Object.fromEntries(coreDigests.map((item) => [item.path, item.sha256])),
    timingNote: "Logical durations keep normalized candidate outputs reproducible; workflow wall time is observed outside the package.",
  });
  artifacts.set("run-report.json", runReport);

  const snapshotBase = {
    date: manifest.date,
    sequence: manifest.sequence,
    version: manifest.targetVersion,
    sourceHead: manifest.source.head,
    manifestSha256: manifestDigest,
    artifactManifestSha256,
  };
  const snapshot = canonicalJson({ ...snapshotBase, snapshotDigest: sha256(canonicalJson(snapshotBase)) });
  artifacts.set("snapshot.json", snapshot);

  const candidateReport = canonicalJson({
    schemaVersion: "chimpmaera.daily-poc-candidate-report/v1",
    candidateVersion: manifest.targetVersion,
    releaseTitle: incrementCandidateTitle(manifest),
    manifestSha256: manifestDigest,
    artifactManifestSha256,
    verdict: "READY_CANDIDATE",
    reasons: [],
    materialChange: { commitCount: facts.commits.length, changedFiles: facts.changedFiles },
    video: { status: video.status, rendered: false },
    publication: { githubPrerelease: false, youtubeUpload: false, readmeMutation: false },
    publicationEffects: [],
  });
  artifacts.set("candidate-report.json", candidateReport);

  const generatedScanIssues = [];
  for (const [name, content] of artifacts) generatedScanIssues.push(...scanUnsafe(content, name));
  if (generatedScanIssues.length) {
    writeBlocked(args.outputPath, manifest, manifestDigest, generatedScanIssues);
    return { verdict: "BLOCKED", reasons: generatedScanIssues, exitCode: 2 };
  }

  const checksums = [...artifacts.entries()]
    .map(([name, content]) => `${sha256(content)}  ${name}`)
    .sort()
    .join("\n") + "\n";
  artifacts.set("SHA256SUMS", checksums);

  let written = 0;
  const completed = [];
  for (const [name, content] of [...artifacts.entries()].sort(([a], [b]) => a.localeCompare(b, "en"))) {
    atomicWrite(join(output, name), content);
    completed.push(name);
    written += 1;
    overwriteState(
      output,
      stateContent({ manifestDigest, manifest, phase: "generating", completedFiles: completed, verdict: null, reasons: [], revision: written }),
    );
    if (args.stopAfter === written) {
      return { verdict: "PARTIAL", reasons: ["INTENTIONAL_TEST_STOP"], exitCode: 75 };
    }
  }
  overwriteState(
    output,
    stateContent({ manifestDigest, manifest, phase: "complete", completedFiles: completed, verdict: "READY_CANDIDATE", reasons: [], revision: artifacts.size }),
  );
  return { verdict: "READY_CANDIDATE", reasons: [], output, exitCode: 0 };
}

function verify(args) {
  if (!args.manifestPath || !args.outputPath || !args.sourceRepo) {
    throw new PipelineError("USAGE", "verify requires --manifest, --output, and --source-repo");
  }
  const temporaryRoot = mkdtempSync(join(tmpdir(), "cm-daily-poc-verify-"));
  const temporary = join(temporaryRoot, "candidate");
  try {
    const result = prepare({ ...args, command: "prepare", outputPath: temporary, stopAfter: null });
    if (result.verdict !== "READY_CANDIDATE") return { ...result, exitCode: 2 };
    const expectedFiles = JSON.parse(readFileSync(join(temporary, STATE_FILE), "utf8")).completedFiles;
    const issues = [];
    for (const name of expectedFiles) {
      const expected = join(temporary, name);
      const actual = join(resolve(args.outputPath), name);
      if (!existsSync(actual)) issues.push(`OUTPUT_MISSING:${name}`);
      else if (sha256File(expected) !== sha256File(actual)) issues.push(`OUTPUT_DRIFT:${name}`);
    }
    if (issues.length) return { verdict: "BLOCKED", reasons: issues, exitCode: 2 };
    return { verdict: "READY_CANDIDATE", reasons: [], verifiedByteIdentical: true, exitCode: 0 };
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: false });
  }
}

function snapshotDigestCommand(args) {
  if (!args.snapshotPath) throw new PipelineError("USAGE", "snapshot-digest requires --snapshot");
  const snapshot = JSON.parse(readFileSync(resolve(args.snapshotPath), "utf8"));
  return { snapshotDigest: sha256(canonicalJson(snapshotPayload(snapshot))), exitCode: 0 };
}

function main() {
  let result;
  try {
    const args = parseArgs(process.argv.slice(2));
    result = args.command === "prepare" ? prepare(args) : args.command === "verify" ? verify(args) : snapshotDigestCommand(args);
  } catch (error) {
    result = { verdict: "BLOCKED", reasons: [`${error.code ?? "UNEXPECTED"}:${error.message}`], exitCode: 2 };
  }
  process.stdout.write(canonicalJson(Object.fromEntries(Object.entries(result).filter(([key]) => key !== "exitCode"))));
  process.exitCode = result.exitCode;
}

main();
