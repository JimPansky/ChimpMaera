import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PROTECTED_AUDIT_CHECKPOINT_SCHEMA_V1,
  PROTECTED_AUDIT_ENVELOPE_SCHEMA_V1,
  PROTECTED_AUDIT_EVENT_SCHEMA_V1,
  createProtectedAuditEnvelopeV1,
  explainProtectedAuditTimelineV1,
  protectedAuditEnvelopeDigestV1,
  protectedAuditEventDigestV1,
  syntheticProtectedAuditTimelineV1,
  validateProtectedAuditEventV1,
  verifyProtectedAuditTimelineV1,
  type ProtectedAuditCheckpointV1,
  type ProtectedAuditEnvelopeV1,
  type ProtectedAuditEventV1,
  type ProtectedAuditTrustPolicyV1,
} from "../packages/contracts/src/index.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assertUnverifiable(
  envelopes: readonly unknown[],
  checkpoint: unknown,
  trust: ProtectedAuditTrustPolicyV1,
  issue: string,
): void {
  const verification = verifyProtectedAuditTimelineV1(envelopes, checkpoint, trust);
  assert.equal(verification.outcome, "UNVERIFIABLE", issue);
  if (verification.outcome === "UNVERIFIABLE") assert.ok(verification.issues.includes(issue), verification.issues.join(","));
  const explanation = explainProtectedAuditTimelineV1(envelopes, checkpoint, trust);
  assert.equal(explanation.status, "UNVERIFIABLE");
  assert.deepEqual(explanation.stages, []);
  assert.doesNotMatch(explanation.summary, /^VERIFIED_SUCCESS/);
}

test("AAS-023-1 closed event/checkpoint contracts bind metadata and exclude raw secrets", () => {
  const fixture = syntheticProtectedAuditTimelineV1();
  const first = fixture.envelopes[0];
  assert.ok(first);
  assert.equal(first.event.schemaVersion, PROTECTED_AUDIT_EVENT_SCHEMA_V1);
  assert.equal(first.schemaVersion, PROTECTED_AUDIT_ENVELOPE_SCHEMA_V1);
  assert.equal(fixture.checkpoint.schemaVersion, PROTECTED_AUDIT_CHECKPOINT_SCHEMA_V1);
  assert.equal(validateProtectedAuditEventV1(first.event).outcome, "ALLOW");

  const rawSecret = { ...clone(first.event), rawPrompt: "sk-live-secret" };
  const rawSecretResult = validateProtectedAuditEventV1(rawSecret);
  assert.equal(rawSecretResult.outcome, "DENY");
  if (rawSecretResult.outcome === "DENY") assert.deepEqual(rawSecretResult.issues, ["AUDIT_EVENT_SCHEMA_DENIED"]);

  const nestedSecret = clone(first.event) as unknown as Record<string, any>;
  nestedSecret.facts.secret = "provider-token";
  const nestedSecretResult = validateProtectedAuditEventV1(nestedSecret);
  assert.equal(nestedSecretResult.outcome, "DENY");
  if (nestedSecretResult.outcome === "DENY") assert.deepEqual(nestedSecretResult.issues, ["AUDIT_EVENT_FACTS_DENIED"]);

  const unknownReference = clone(first.event) as unknown as Record<string, any>;
  unknownReference.references.rawContentDigest = "a".repeat(64);
  const referenceResult = validateProtectedAuditEventV1(unknownReference);
  assert.equal(referenceResult.outcome, "DENY");
});

test("AAS-023-2 writer signs ordered facts, exact head/count and idempotent replay", () => {
  const fixture = syntheticProtectedAuditTimelineV1();
  const verified = verifyProtectedAuditTimelineV1(fixture.envelopes, fixture.checkpoint, fixture.trust);
  assert.equal(verified.outcome, "VERIFIED");
  if (verified.outcome !== "VERIFIED") return;
  assert.equal(verified.facts.length, 8);
  assert.deepEqual(verified.facts.map(({ eventKind }) => eventKind), [
    "IDENTITY", "INTENT", "PLAN", "POLICY", "APPROVAL", "BUDGET", "EFFECT", "READBACK",
  ]);
  assert.equal(verified.facts[7]?.references.effect, verified.facts[6]?.eventDigest);
  assert.equal(fixture.checkpoint.eventCount, fixture.envelopes.length);
  assert.equal(
    fixture.checkpoint.headEnvelopeDigest,
    protectedAuditEnvelopeDigestV1(fixture.envelopes.at(-1) as ProtectedAuditEnvelopeV1),
  );

  const firstEvent = fixture.envelopes[0]?.event;
  assert.ok(firstEvent);
  assert.equal(fixture.writer.append(firstEvent, fixture.envelopes.at(-1)!.signedAtMs + 1).replay, "SAME_ENVELOPE");
  const conflict: ProtectedAuditEventV1 = {
    ...clone(firstEvent),
    facts: { ...firstEvent.facts, outcome: "DENY", reasonCodes: ["AAS023_REPLAY_CONFLICT"] },
  };
  assert.throws(
    () => fixture.writer.append(conflict, fixture.envelopes.at(-1)!.signedAtMs + 2),
    /AUDIT_EVENT_REPLAY_CONFLICT_DENIED/,
  );
});

test("AAS-023-3 explanation derives only from verified joined facts", () => {
  const fixture = syntheticProtectedAuditTimelineV1();
  const explanation = explainProtectedAuditTimelineV1(fixture.envelopes, fixture.checkpoint, fixture.trust);
  assert.equal(explanation.status, "VERIFIED_SUCCESS");
  assert.equal(explanation.stages.length, 8);
  assert.match(explanation.summary, /^VERIFIED_SUCCESS READBACK COMMITTED; 8 protected facts; checkpoint [a-f0-9]{64}$/);
  for (const stage of explanation.stages.slice(1)) {
    assert.notEqual(stage.references.identity, null);
  }

  const changed = clone(fixture.envelopes) as unknown as Record<string, any>[];
  const last = changed.at(-1)!;
  last.event.facts.outcome = "FAILED";
  last.eventDigest = protectedAuditEventDigestV1(last.event);
  assertUnverifiable(changed, fixture.checkpoint, fixture.trust, "AUDIT_ENVELOPE_SIGNATURE_DENIED");
});

test("AAS-023-4 tamper, loss, order, fork, signer, clock, link and scope matrix fails closed", () => {
  const fixture = syntheticProtectedAuditTimelineV1();
  const original = fixture.envelopes;

  const editAndRehash = clone(original) as unknown as Record<string, any>[];
  editAndRehash[3]!.event.facts.reasonCodes = ["AAS023_EDITED_AND_REHASHED"];
  editAndRehash[3]!.eventDigest = protectedAuditEventDigestV1(editAndRehash[3]!.event);
  assertUnverifiable(editAndRehash, fixture.checkpoint, fixture.trust, "AUDIT_ENVELOPE_SIGNATURE_DENIED");

  const deleted = original.filter((_, index) => index !== 4);
  assertUnverifiable(deleted, fixture.checkpoint, fixture.trust, "AUDIT_CHECKPOINT_COUNT_MISMATCH_DENIED");
  assertUnverifiable(original.slice(0, -2), fixture.checkpoint, fixture.trust, "AUDIT_CHECKPOINT_HEAD_MISMATCH_DENIED");

  const reordered = clone([...original]) as ProtectedAuditEnvelopeV1[];
  [reordered[2], reordered[3]] = [reordered[3]!, reordered[2]!];
  assertUnverifiable(reordered, fixture.checkpoint, fixture.trust, "AUDIT_SEQUENCE_DENIED");
  assertUnverifiable([...original, clone(original.at(-1)!)], fixture.checkpoint, fixture.trust, "AUDIT_EVENT_REPLAY_DUPLICATE_DENIED");

  const last = original.at(-1)!;
  const previous = original.at(-2)!;
  const forkEvent: ProtectedAuditEventV1 = {
    ...clone(last.event),
    eventId: "event:fork-0008",
    facts: { ...last.event.facts, reasonCodes: ["AAS023_FORKED_READBACK"] },
  };
  const forkEnvelope = createProtectedAuditEnvelopeV1(
    forkEvent,
    protectedAuditEnvelopeDigestV1(previous),
    fixture.signer,
    last.signedAtMs + 1,
  );
  assertUnverifiable([...original.slice(0, -1), forkEnvelope], fixture.checkpoint, fixture.trust, "AUDIT_CHECKPOINT_HEAD_MISMATCH_DENIED");

  const missingLinkEvent: ProtectedAuditEventV1 = {
    ...clone(last.event),
    eventId: "event:missing-link-0008",
    references: { ...last.event.references, effect: null },
  };
  const missingLinkEnvelope = createProtectedAuditEnvelopeV1(
    missingLinkEvent,
    protectedAuditEnvelopeDigestV1(previous),
    fixture.signer,
    last.signedAtMs + 1,
  );
  assertUnverifiable([...original.slice(0, -1), missingLinkEnvelope], fixture.checkpoint, fixture.trust, "AUDIT_CAUSAL_LINK_MISSING_DENIED");

  const clockRollbackEvent: ProtectedAuditEventV1 = {
    ...clone(last.event),
    eventId: "event:clock-rollback-0008",
    occurredAtMs: previous.event.occurredAtMs - 1,
    observedAtMs: last.event.observedAtMs,
  };
  const clockRollbackEnvelope = createProtectedAuditEnvelopeV1(
    clockRollbackEvent,
    protectedAuditEnvelopeDigestV1(previous),
    fixture.signer,
    last.signedAtMs + 1,
  );
  assertUnverifiable([...original.slice(0, -1), clockRollbackEnvelope], fixture.checkpoint, fixture.trust, "AUDIT_CLOCK_ROLLBACK_DENIED");

  const staleTrust: ProtectedAuditTrustPolicyV1 = { ...fixture.trust, minimumGeneration: fixture.signer.generation + 1 };
  assertUnverifiable(original, fixture.checkpoint, staleTrust, "AUDIT_SIGNER_GENERATION_STALE_DENIED");
  assertUnverifiable(original, fixture.checkpoint, { ...fixture.trust, keys: [] }, "AUDIT_SIGNER_UNKNOWN_DENIED");

  const changedSignature = clone(original) as unknown as Record<string, any>[];
  changedSignature[0]!.signatureBase64 = `${changedSignature[0]!.signatureBase64.slice(0, -2)}AA`;
  assertUnverifiable(changedSignature, fixture.checkpoint, fixture.trust, "AUDIT_ENVELOPE_SIGNATURE_DENIED");

  const wrongScope = { ...clone(fixture.checkpoint), tenant: "tenant:foreign" } as ProtectedAuditCheckpointV1;
  assertUnverifiable(original, wrongScope, fixture.trust, "AUDIT_CHECKPOINT_SCOPE_DENIED");
  assertUnverifiable(original, { ...clone(fixture.checkpoint), eventCount: 99 }, fixture.trust, "AUDIT_CHECKPOINT_COUNT_MISMATCH_DENIED");
  assertUnverifiable(original, { ...clone(fixture.checkpoint), headEnvelopeDigest: "a".repeat(64) }, fixture.trust, "AUDIT_CHECKPOINT_HEAD_MISMATCH_DENIED");
});
