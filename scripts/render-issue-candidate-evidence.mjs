#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const paths = ["packages/contracts/src/issue-candidate.ts", "schemas/contracts/issue-candidate-v1.schema.json",
  "tests/fixtures/issue-candidate/positive-v1.json", "tests/fixtures/issue-candidate/quarantine-v1.json",
  "tests/issue-candidate.test.ts", "docs/ISSUE-CANDIDATE-OPERATOR-GUIDE.md", "docs/development/intake-001-issue-46-pdca.md"];
const report = {
  schemaVersion: "chimpmaera.verification/local-synthetic-report/v1", evidenceId: "evidence:intake-001-issue-candidate-v1",
  issue: "#46", parentIssue: "#39", separateUncompletedIssue: "#52", evidenceClass: "LOCAL_SYNTHETIC",
  commitBinding: "CONTAINING_DCO_SIGNED_COMMIT", futureCommitClaimed: false,
  objectiveCounts: { focusedTests: 8, positiveCompleteLifecycles: 1, quarantineFixtures: 7, classificationDenials: 1,
    duplicateOutcomes: 2, approvalDenials: 4, recoveryOutcomes: 6, historyTamperProbes: 1,
    defaultAmbientCapabilities: 0, realPublicWrites: 0 },
  negativeEvidenceStates: ["quarantined", "duplicate_blocked", "review_required", "recovery_required"],
  sanitization: { rawSecrets: false, personalData: false, privatePaths: false, privateInfrastructure: false, exploitDetails: false },
  claims: ["STRICT_LOCAL_ISSUE_CANDIDATE_V1_LIFECYCLE", "DETERMINISTIC_FAIL_CLOSED_SANITIZATION",
    "MANDATORY_DEDUPE_BEFORE_SUBMIT", "EXACT_ACTION_CONTENT_DESTINATION_APPROVAL", "INJECTED_LEAST_PRIVILEGE_ADAPTER_ONLY",
    "SINGLE_IDEMPOTENT_ATTEMPT", "EXACT_RECEIPT_AND_READBACK_BINDING", "IMMUTABLE_HASH_CHAINED_RECOVERY_EVIDENCE"],
  nonClaims: ["AUTONOMOUS_OR_REAL_PUBLIC_WRITE", "PUBLIC_SECURITY_DISCLOSURE", "AUTOMATIC_REMOTE_ISSUE_CLOSURE",
    "ISSUE_52_CONTRIBUTION_CONTROL_PLANE", "THIRD_PARTY_SOCIAL_POSTING", "LIVE_CREDENTIALS_DATA_OR_PROVIDERS",
    "DEPLOYMENT", "PRODUCTION_ACTIVATION", "INFRASTRUCTURE_MUTATION", "MERGED_OR_RELEASED"],
  artifacts: Object.fromEntries(paths.map((path) => [path, { sha256: sha256(path) }])),
  verification: { focusedCommand: "npm run issue-candidate:test", authoritativeCommand: "npm test" },
  rollback: "Disable only intake profile/route, restore exact last accepted v1 contract, retain receipts and quarantine evidence append-only, and use a protected revert after merge."
};
const bytes = `${JSON.stringify(report, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync("verification/intake-001-evidence-v1.json", "utf8") !== bytes) throw new Error("INTAKE_001_EVIDENCE_STALE");
} else writeFileSync("verification/intake-001-evidence-v1.json", bytes);
console.log(JSON.stringify({ status: "PASS", artifactCount: paths.length, reportSha256: createHash("sha256").update(bytes).digest("hex") }));
