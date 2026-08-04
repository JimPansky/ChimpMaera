import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  AGENT_WORK_EVENT_CLAIM_BOUNDARY_V1,
  AGENT_WORK_EVENT_FIELD_CLASSIFICATIONS_V1,
  AGENT_WORK_EVENT_PROHIBITED_FIELDS_V1,
  agentWorkEventRecordDigestV1,
  evaluateAgentWorkEventV1,
  renderPublicAgentWorkEventDecisionV1,
  type AgentWorkEventOperationV1,
  type AgentWorkEventReasonCodeV1,
  type AgentWorkEventRecordV1,
} from "../packages/contracts/src/index.js";

interface MutationFixture {
  readonly caseId: string;
  readonly operation: "replace" | "replace-no-rehash";
  readonly path: string;
  readonly value: unknown;
  readonly secondaryPath?: string;
  readonly secondaryValue?: unknown;
  readonly evaluatedAtMs?: number;
  readonly expectedReason: AgentWorkEventReasonCodeV1;
}

interface LifecycleFixture {
  readonly caseId: string;
  readonly state: AgentWorkEventRecordV1["lifecycle"]["state"];
  readonly consentStatus?: "WITHDRAWN";
  readonly operation: AgentWorkEventOperationV1;
  readonly evaluatedAtMs: number;
  readonly expectedOutcome: "ACCEPTED" | "DENIED" | "DELETE_REQUIRED" | "TOMBSTONE_CONFIRMED";
  readonly expectedReason: AgentWorkEventReasonCodeV1;
}

function fixture(): AgentWorkEventRecordV1 {
  return JSON.parse(readFileSync(
    "tests/fixtures/agent-work-intelligence/positive-public-event-v1.json",
    "utf8",
  )) as AgentWorkEventRecordV1;
}

function replacePath(target: Record<string, any>, pointer: string, value: unknown): void {
  const parts = pointer.split("/").slice(1);
  const leaf = parts.pop();
  assert.ok(leaf !== undefined);
  let parent: any = target;
  for (const part of parts) parent = parent[part];
  parent[leaf] = value;
}

function rehash(target: Record<string, any>): void {
  target.recordDigest = agentWorkEventRecordDigestV1(target);
}

function reorderKeys(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return value.map((item) => reorderKeys(item, seed + 1));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  const offset = entries.length === 0 ? 0 : seed % entries.length;
  const rotated = [...entries.slice(offset), ...entries.slice(0, offset)].reverse();
  return Object.fromEntries(rotated.map(([key, nested]) => [key, reorderKeys(nested, seed + 1)]));
}

function lifecycleRecord(input: LifecycleFixture): AgentWorkEventRecordV1 {
  const record = structuredClone(fixture()) as unknown as Record<string, any>;
  if (input.caseId === "retention-expired") {
    record.lifecycle.policy = "BOUNDED_30D";
    record.payload.consent.expiresAtMs = 172_801_000;
  }
  if (input.consentStatus) record.payload.consent.status = input.consentStatus;
  if (input.state === "DELETION_REQUESTED") {
    record.lifecycle.state = input.state;
    record.lifecycle.deletionRequestedAtMs = 2_000;
    record.lifecycle.deleteByMs = 3_000;
  }
  if (input.state === "DELETED_TOMBSTONE") {
    record.lifecycle.state = input.state;
    record.lifecycle.deletionRequestedAtMs = 2_000;
    record.lifecycle.deleteByMs = 3_000;
    record.lifecycle.deletedAtMs = 3_500;
    record.payload = null;
    record.tombstone = {
      erasureDigest: "6666666666666666666666666666666666666666666666666666666666666666",
      reason: "OWNER_REQUEST",
    };
  }
  rehash(record);
  return record as unknown as AgentWorkEventRecordV1;
}

test("AWI-01 freezes one closed schema and classifies every retained field", () => {
  const schema = JSON.parse(readFileSync(
    "schemas/contracts/agent-work-event-record-v1.schema.json",
    "utf8",
  )) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const input = fixture();
  assert.equal(validate(input), true, JSON.stringify(validate.errors));
  assert.equal(evaluateAgentWorkEventV1(input, "VALIDATE", 2_000).outcome, "ACCEPTED");

  const classifiedPaths = AGENT_WORK_EVENT_FIELD_CLASSIFICATIONS_V1.map(([path]) => path);
  assert.equal(classifiedPaths.length, 29);
  assert.equal(new Set(classifiedPaths).size, classifiedPaths.length);
  assert.deepEqual(classifiedPaths.slice(0, 8), [
    "/schemaVersion", "/recordId", "/lifecycle/state", "/lifecycle/policy",
    "/lifecycle/retainUntilMs", "/lifecycle/deletionRequestedAtMs", "/lifecycle/deleteByMs", "/lifecycle/deletedAtMs",
  ]);
  assert.deepEqual(classifiedPaths.slice(-4), [
    "/tombstone/erasureDigest", "/tombstone/reason", "/claimBoundary", "/recordDigest",
  ]);
});

test("AWI-01 canonical record digest survives 100 object-key reorderings", () => {
  const input = fixture();
  for (let repetition = 0; repetition < 100; repetition += 1) {
    assert.equal(
      agentWorkEventRecordDigestV1(reorderKeys(input, repetition) as Record<string, unknown>),
      input.recordDigest,
      String(repetition),
    );
  }
});

test("AWI-01 denies every prohibited-field fixture before readback", () => {
  assert.equal(AGENT_WORK_EVENT_PROHIBITED_FIELDS_V1.length, 16);
  for (const field of AGENT_WORK_EVENT_PROHIBITED_FIELDS_V1) {
    const input = structuredClone(fixture()) as unknown as Record<string, any>;
    input.payload.event[field] = "seeded-sensitive-value";
    rehash(input);
    assert.deepEqual(
      evaluateAgentWorkEventV1(input, "PUBLIC_READBACK", 2_000).reasonCodes,
      ["PROHIBITED_FIELD_DENIED"],
      field,
    );
  }
});

test("AWI-01 negative matrix fails closed for identity consent retention schema and digest drift", () => {
  const cases = JSON.parse(readFileSync(
    "tests/fixtures/agent-work-intelligence/negative-matrix-v1.json",
    "utf8",
  )) as MutationFixture[];
  assert.equal(cases.length, 11);
  for (const negative of cases) {
    const input = structuredClone(fixture()) as unknown as Record<string, any>;
    replacePath(input, negative.path, negative.value);
    if (negative.secondaryPath) replacePath(input, negative.secondaryPath, negative.secondaryValue);
    if (negative.operation !== "replace-no-rehash") rehash(input);
    const result = evaluateAgentWorkEventV1(input, "PUBLIC_READBACK", negative.evaluatedAtMs ?? 2_000);
    assert.ok(result.reasonCodes.includes(negative.expectedReason), `${negative.caseId}:${result.reasonCodes.join(",")}`);
    assert.equal(result.outcome, "DENIED", negative.caseId);
  }
});

test("AWI-01 retention deletion tombstone and readback lifecycle is deterministic", () => {
  const cases = JSON.parse(readFileSync(
    "tests/fixtures/agent-work-intelligence/lifecycle-matrix-v1.json",
    "utf8",
  )) as LifecycleFixture[];
  assert.equal(cases.length, 7);
  for (const lifecycle of cases) {
    const result = evaluateAgentWorkEventV1(
      lifecycleRecord(lifecycle),
      lifecycle.operation,
      lifecycle.evaluatedAtMs,
    );
    assert.equal(result.outcome, lifecycle.expectedOutcome, lifecycle.caseId);
    assert.deepEqual(result.reasonCodes, [lifecycle.expectedReason], lifecycle.caseId);
  }
});

test("AWI-01 public projection emits fixed vocabulary and zero seeded disclosure bytes", () => {
  const seeded = [
    "-----BEGIN " + "PRIVATE KEY-----",
    ["", "ho" + "me", "operator", "private", "event.json"].join("/"),
    "gh" + "p_seededNotARealCredential000000000",
    "person@example.invalid",
    "tenant-00000000-0000-0000-0000-000000000000",
  ];
  for (const sensitiveValue of seeded) {
    const input = structuredClone(fixture()) as unknown as Record<string, any>;
    input.payload.event.detail = sensitiveValue;
    rehash(input);
    const publicBytes = renderPublicAgentWorkEventDecisionV1(input, 2_000);
    assert.equal(publicBytes.includes(sensitiveValue), false);
    assert.deepEqual(Object.keys(JSON.parse(publicBytes)).sort(), [
      "claimBoundary", "outcome", "reasonCodes", "schemaVersion",
    ]);
    assert.ok(publicBytes.includes(AGENT_WORK_EVENT_CLAIM_BOUNDARY_V1));
  }
});
