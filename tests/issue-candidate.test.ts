import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

import {
  approveIssueCandidateV1, canonicalJson, classifyIssueCandidateV1, deduplicateIssueCandidateV1,
  draftIssueCandidateV1, linkIssueCandidateV1, observeIssueCandidateV1, previewIssueCandidateV1,
  readbackIssueCandidateV1, resolveAmbiguousDuplicateV1, resolveIssueCandidateV1,
  sanitizeIssueCandidateV1, submitIssueCandidateV1, verifyIssueCandidateHistoryV1,
  type IssueCandidateV1, type IssueDuplicateSearchAdapterV1, type IssueReadbackV1,
  type IssueSubmitAdapterV1, type IssueSubmitReceiptV1,
} from "../packages/contracts/src/index.js";

const sha = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");
const fixture = JSON.parse(readFileSync("tests/fixtures/issue-candidate/positive-v1.json", "utf8")) as {
  candidateId: string; destination: string; content: { title: string; body: string };
};

function throughClassified(): IssueCandidateV1 {
  let candidate = observeIssueCandidateV1({ candidateId: fixture.candidateId, content: fixture.content, observedAtMs: 1000 });
  candidate = draftIssueCandidateV1(candidate, fixture.content, 1001);
  candidate = sanitizeIssueCandidateV1(candidate, 1002);
  return classifyIssueCandidateV1(candidate, "PUBLIC", 1003);
}

const search = (matches: readonly { remoteId: string; contentDigest: string; similarityPermille: number }[] = []): IssueDuplicateSearchAdapterV1 => ({
  adapterId: "adapter:synthetic-search-v1",
  async search(input) { return { searchedAtMs: 1004, destination: input.destination, queryDigest: input.contentDigest, matches }; },
});

function submitAdapter(mode: "ok" | "timeout" | "partial" | "tamper" | "mismatch" | "missing" | "ambiguous" = "ok"):
IssueSubmitAdapterV1 & { calls: { submit: number; read: number } } {
  const calls = { submit: 0, read: 0 };
  let accepted: Parameters<IssueSubmitAdapterV1["submit"]>[0] | undefined;
  let remote: { id: string; url: string } | undefined;
  return {
    adapterId: "adapter:synthetic-submit-v1", declaredCapabilities: ["CREATE_ISSUE", "READ_ISSUE_BY_IDEMPOTENCY"], calls,
    async submit(input) {
      calls.submit += 1; accepted = input; remote = { id: "issue:synthetic-46", url: "https://example.invalid/issues/synthetic-46" };
      if (mode === "timeout") throw new Error("synthetic timeout");
      const unsigned: Omit<IssueSubmitReceiptV1, "receiptDigest"> = {
        schemaVersion: "cm.issue-submit-receipt/v1", status: mode === "partial" ? "PARTIAL" : "ACCEPTED",
        attemptId: input.attemptId, idempotencyKey: input.idempotencyKey, candidateId: input.candidateId,
        contentDigest: input.contentDigest, approvalDigest: input.approvalDigest, destination: input.destination,
        remoteId: remote.id, remoteUrl: remote.url,
      };
      return { ...unsigned, receiptDigest: mode === "tamper" ? "0".repeat(64) : sha(unsigned) };
    },
    async readByIdempotency(input) {
      calls.read += 1;
      if (!accepted || !remote) throw new Error("no attempt");
      const status = mode === "missing" ? "MISSING" : mode === "ambiguous" ? "AMBIGUOUS" : "FOUND";
      const unsigned: Omit<IssueReadbackV1, "readbackDigest"> = {
        schemaVersion: "cm.issue-readback/v1", status, attemptId: accepted.attemptId, idempotencyKey: input.idempotencyKey,
        remoteId: mode === "mismatch" ? "issue:different" : remote.id, remoteUrl: remote.url,
        content: status === "FOUND" ? accepted.content : null,
      };
      return { ...unsigned, readbackDigest: sha(unsigned) };
    },
  };
}

async function approved(): Promise<{ candidate: IssueCandidateV1; approval: ReturnType<typeof approveIssueCandidateV1>["approval"] }> {
  const deduped = await deduplicateIssueCandidateV1(throughClassified(), fixture.destination, search());
  const preview = previewIssueCandidateV1(deduped, fixture.destination);
  assert.deepEqual(preview.content, fixture.content);
  assert.equal(preview.contentDigest, deduped.contentDigest);
  return approveIssueCandidateV1(deduped, fixture.destination, {
    approvalId: "approval:synthetic-46", nonce: "nonce-synthetic-0001", issuedAtMs: 1005, expiresAtMs: 2000,
  });
}

test("INTAKE-001 legal positive lifecycle requires dedupe, exact preview, approval, one submit, and exact readback", async () => {
  const ready = await approved(); const adapter = submitAdapter();
  let candidate = await submitIssueCandidateV1(ready.candidate, fixture.destination, ready.approval, adapter, 1006);
  assert.equal(candidate.state, "submitted"); assert.equal(adapter.calls.submit, 1);
  candidate = await readbackIssueCandidateV1(candidate, fixture.destination, adapter, 1007);
  assert.equal(candidate.state, "readback_confirmed"); assert.equal(adapter.calls.read, 1);
  candidate = linkIssueCandidateV1(candidate, 39, 1008);
  candidate = resolveIssueCandidateV1(candidate, 1009);
  assert.equal(candidate.state, "resolved"); assert.equal(candidate.publicBytesEmitted, Buffer.byteLength(canonicalJson(fixture.content)));
  assert.equal(verifyIssueCandidateHistoryV1(candidate), true);
  assert.deepEqual(candidate.history.map(({ state }) => state), [
    "observed", "drafted", "sanitized", "classified", "deduplicated", "owner_reviewed",
    "submitted", "readback_confirmed", "linked", "resolved",
  ]);
});

test("INTAKE-001 default behavior has no ambient public-write capability", async () => {
  const classified = throughClassified();
  await assert.rejects(deduplicateIssueCandidateV1(classified, fixture.destination, undefined), /ADAPTER_DENIED/);
  const ready = await approved();
  await assert.rejects(submitIssueCandidateV1(ready.candidate, fixture.destination, ready.approval, undefined, 1006), /ADAPTER_DENIED/);
  assert.equal(ready.candidate.publicBytesEmitted, 0);
});

test("INTAKE-001 security/private/adversarial fixtures quarantine with zero public bytes", () => {
  const cases = JSON.parse(readFileSync("tests/fixtures/issue-candidate/quarantine-v1.json", "utf8")) as Array<{ caseId: string; text: string }>;
  assert.equal(cases.length, 7);
  for (const item of cases) {
    const body = item.text === "PRIVATE_PATH_PROBE"
      ? ["Observed at ", "/", "home", "/example/private/report.txt"].join("") : item.text;
    let candidate = observeIssueCandidateV1({ candidateId: `candidate:${item.caseId}`, content: { title: "Synthetic report", body }, observedAtMs: 1 });
    candidate = draftIssueCandidateV1(candidate, candidate.content, 2);
    candidate = sanitizeIssueCandidateV1(candidate, 3);
    assert.equal(candidate.state, "quarantined", item.caseId); assert.equal(candidate.publicBytesEmitted, 0, item.caseId);
    assert.ok(candidate.route === "SECURITY_POLICY" || candidate.route === "PRIVATE_REVIEW", item.caseId);
  }
  let privateCandidate = observeIssueCandidateV1({ candidateId: "candidate:private-class", content: fixture.content, observedAtMs: 1 });
  privateCandidate = sanitizeIssueCandidateV1(draftIssueCandidateV1(privateCandidate, fixture.content, 2), 3);
  privateCandidate = classifyIssueCandidateV1(privateCandidate, "PRIVATE", 4);
  assert.equal(privateCandidate.state, "quarantined"); assert.equal(privateCandidate.publicBytesEmitted, 0);
});

test("INTAKE-001 exact and ambiguous duplicates never cause an uncontrolled write", async () => {
  const exact = await deduplicateIssueCandidateV1(throughClassified(), fixture.destination,
    search([{ remoteId: "issue:existing", contentDigest: throughClassified().contentDigest, similarityPermille: 1000 }]));
  assert.equal(exact.state, "duplicate_blocked"); assert.throws(() => previewIssueCandidateV1(exact, fixture.destination), /TRANSITION_DENIED/);
  let ambiguous = await deduplicateIssueCandidateV1(throughClassified(), fixture.destination,
    search([{ remoteId: "issue:similar", contentDigest: "a".repeat(64), similarityPermille: 701 }]));
  assert.equal(ambiguous.state, "review_required");
  ambiguous = resolveAmbiguousDuplicateV1(ambiguous, "PROCEED", 1005);
  assert.equal(ambiguous.state, "deduplicated"); assert.match(ambiguous.duplicateSearchDigest ?? "", /^[a-f0-9]{64}$/);
});

test("INTAKE-001 stale, reused, and mismatched approvals deny before adapter invocation", async () => {
  const ready = await approved();
  for (const [name, approval, destination, now] of [
    ["stale", ready.approval, fixture.destination, 2001],
    ["mismatch", { ...ready.approval, contentDigest: "f".repeat(64) }, fixture.destination, 1006],
    ["destination", ready.approval, "repo:different", 1006],
  ] as const) {
    const adapter = submitAdapter();
    await assert.rejects(submitIssueCandidateV1(ready.candidate, destination, approval, adapter, now), /APPROVAL_DENIED/, name);
    assert.equal(adapter.calls.submit, 0, name);
  }
  const adapter = submitAdapter();
  const submitted = await submitIssueCandidateV1(ready.candidate, fixture.destination, ready.approval, adapter, 1006);
  await assert.rejects(submitIssueCandidateV1(submitted, fixture.destination, ready.approval, adapter, 1007), /TRANSITION_DENIED/);
  assert.equal(adapter.calls.submit, 1);
});

test("INTAKE-001 uncertain, partial, tampered, mismatched, missing, and ambiguous outcomes preserve explicit recovery evidence", async () => {
  for (const mode of ["timeout", "partial", "tamper", "mismatch", "missing", "ambiguous"] as const) {
    const ready = await approved(); const adapter = submitAdapter(mode);
    let candidate = await submitIssueCandidateV1(ready.candidate, fixture.destination, ready.approval, adapter, 1006);
    if (candidate.state === "submitted") candidate = await readbackIssueCandidateV1(candidate, fixture.destination, adapter, 1007);
    assert.equal(candidate.state, "recovery_required", mode); assert.notEqual(candidate.recoveryCode, null, mode);
    assert.equal(adapter.calls.submit, 1, mode); assert.equal(verifyIssueCandidateHistoryV1(candidate), true, mode);
    await assert.rejects(submitIssueCandidateV1(candidate, fixture.destination, ready.approval, adapter, 1008), /TRANSITION_DENIED/);
    assert.equal(adapter.calls.submit, 1, mode);
  }
});

test("INTAKE-001 immutable history detects tampering and retains all binding identities", async () => {
  const ready = await approved(); const adapter = submitAdapter();
  const submitted = await submitIssueCandidateV1(ready.candidate, fixture.destination, ready.approval, adapter, 1006);
  const confirmed = await readbackIssueCandidateV1(submitted, fixture.destination, adapter, 1007);
  assert.ok(confirmed.history.every((event) => event.candidateId === confirmed.candidateId && event.contentDigest === confirmed.contentDigest));
  assert.equal(confirmed.history.at(-1)?.approvalDigest, ready.approval.approvalDigest);
  const tampered = { ...confirmed, history: confirmed.history.map((event, index) => index === 0 ? { ...event, code: "ALTERED" } : event) };
  assert.equal(verifyIssueCandidateHistoryV1(tampered), false);
});

test("INTAKE-001 final candidate conforms to the closed public JSON Schema", async () => {
  const ready = await approved(); const adapter = submitAdapter();
  const submitted = await submitIssueCandidateV1(ready.candidate, fixture.destination, ready.approval, adapter, 1006);
  const confirmed = await readbackIssueCandidateV1(submitted, fixture.destination, adapter, 1007);
  const schema = JSON.parse(readFileSync("schemas/contracts/issue-candidate-v1.schema.json", "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(confirmed), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...confirmed, ambientToken: "denied" }), false);
});
