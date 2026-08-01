import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { verifyReviewEvidence } from "./verify-v0.2-review-evidence.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const INDEX = "docs/development/evidence/v0.2-review-readiness-20260801.json";

async function mutatedIndex(mutate) {
  const directory = await mkdtemp(path.join(ROOT, ".chimpmaera-review-index-"));
  const index = JSON.parse(await readFile(path.join(ROOT, INDEX), "utf8"));
  mutate(index);
  const relative = path.relative(ROOT, path.join(directory, "index.json"));
  return { directory, index, relative };
}

async function expectDenied(mutate, code) {
  const { directory, index, relative } = await mutatedIndex(mutate);
  try {
    await writeFile(path.join(directory, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
    await assert.rejects(verifyReviewEvidence({ root: ROOT, indexPath: relative }), new RegExp(code));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("committed review index reconciles claims, commits, diff and rollback boundaries", async () => {
  const report = await verifyReviewEvidence({ root: ROOT, indexPath: INDEX });
  assert.equal(report.status, "PASS");
  assert.deepEqual(report.diff, { files: 45, added: 26, modified: 19, deleted: 0, diffCheckFindings: 32 });
  assert.equal(report.gates.length, 4);
});

test("stale audited commit is denied", async () => {
  await expectDenied((index) => {
    index.source.auditedCommit = index.source.baselineCommit;
    index.diffAudit.range = `${index.source.baselineCommit}..${index.source.baselineCommit}`;
  }, "REVIEW_INDEX_STALE_AUDITED_COMMIT_DENIED");
});

test("missing evidence path is denied", async () => {
  await expectDenied((index) => {
    index.evidenceIndex[0].tests[0] = "tests/missing-review-evidence.test.mjs";
  }, "REVIEW_INDEX_EVIDENCE_PATH_MISSING_DENIED");
});

test("mismatched implementation commit is denied", async () => {
  await expectDenied((index) => {
    index.evidenceIndex[1].implementationCommit = index.evidenceIndex[2].implementationCommit;
  }, "REVIEW_INDEX_IMPLEMENTATION_COMMIT_MISMATCH_DENIED");
});

test("claim-surface drift is denied", async () => {
  await expectDenied((index) => {
    index.claimAudit[2].requiredFragments[0] = "Paperless is enabled in the stock installer";
  }, "REVIEW_CLAIM_SURFACE_MISMATCH_DENIED");
});
