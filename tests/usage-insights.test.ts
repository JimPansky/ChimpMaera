import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";

import {
  USAGE_INSIGHTS_CAPABILITY_IDS_V1,
  USAGE_INSIGHTS_CLAIM_BOUNDARY_V1,
  USAGE_INSIGHTS_EVENT_INPUT_SCHEMA_V1,
  USAGE_INSIGHTS_FIELD_CLASSIFICATIONS_V1,
  USAGE_INSIGHTS_LAZY_EXPIRY_MS,
  USAGE_INSIGHTS_LIFECYCLE_OUTCOMES_V1,
  USAGE_INSIGHTS_MAX_EVENT_RECORDS,
  USAGE_INSIGHTS_PRODUCT_IDS_V1,
  USAGE_INSIGHTS_PRODUCT_VERSION_V1,
  USAGE_INSIGHTS_PROHIBITED_FIELDS_V1,
  USAGE_INSIGHTS_ROTATION_INTERVAL_MS,
  UsageInsightsRuntimeV1,
  aggregateUsageInsightsV1,
  canonicalJson,
  renderPublicUsageInsightsDecisionV1,
  usageInsightsEventDigestV1,
  verifyUsageInsightsEventV1,
  type UsageInsightsEventInputV1,
  type UsageInsightsEventRecordV1,
  type UsageInsightsReasonCodeV1,
  type UsageInsightsRuntimeSnapshotV1,
} from "../packages/contracts/src/index.js";

interface NegativeFixture {
  readonly caseId: string;
  readonly operation: "replace" | "add";
  readonly path: string;
  readonly value: unknown;
  readonly expectedReason: UsageInsightsReasonCodeV1;
}

function storedEventFixture(): UsageInsightsEventRecordV1 {
  const raw = JSON.parse(
    readFileSync("tests/fixtures/usage-insights/positive-opted-in-event-v1.json", "utf8"),
  ) as Record<string, unknown>;
  raw.eventDigest = usageInsightsEventDigestV1(raw);
  return raw as unknown as UsageInsightsEventRecordV1;
}

function eventInput(overrides: Partial<UsageInsightsEventInputV1> = {}): UsageInsightsEventInputV1 {
  return {
    schemaVersion: USAGE_INSIGHTS_EVENT_INPUT_SCHEMA_V1,
    productId: "chimpmaera.poc",
    capabilityId: "capability.gateway",
    productVersion: USAGE_INSIGHTS_PRODUCT_VERSION_V1,
    lifecycleOutcome: "INSTALL_SUCCEEDED",
    occurredAtMs: 1_000,
    ...overrides,
  };
}

function installationId(char: string): string {
  return `sha256:${char.repeat(64)}`;
}

function cloneRecordWith(overrides: Partial<Record<string, unknown>>): UsageInsightsEventRecordV1 {
  const record = structuredClone(storedEventFixture()) as unknown as Record<string, unknown>;
  Object.assign(record, overrides);
  record.eventDigest = usageInsightsEventDigestV1(record);
  return record as unknown as UsageInsightsEventRecordV1;
}

function mutateInput(source: UsageInsightsEventInputV1, mutation: NegativeFixture): unknown {
  const result = structuredClone(source) as unknown as Record<string, unknown>;
  const parts = mutation.path.split("/").slice(1);
  const leaf = parts.pop();
  assert.ok(leaf);
  let target = result;
  for (const part of parts) target = target[part] as Record<string, unknown>;
  target[leaf] = mutation.value;
  return result;
}

function redigestSnapshot(snapshot: Record<string, unknown>): void {
  const unsigned = Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== "stateDigest"));
  snapshot.stateDigest = createHash("sha256").update(canonicalJson(unsigned), "utf8").digest("hex");
}

function redigestInnerEvent(snapshot: Record<string, unknown>, index = 0): Record<string, unknown> {
  const events = snapshot.eventRecords as Array<Record<string, unknown>>;
  const event = events[index];
  assert.ok(event);
  event.eventDigest = usageInsightsEventDigestV1(event);
  return event;
}

function oneRuntimeRecord(
  nowMs: number,
  overrides: Partial<UsageInsightsEventInputV1> = {},
): UsageInsightsEventRecordV1 {
  const runtime = new UsageInsightsRuntimeV1(nowMs);
  runtime.optIn(nowMs);
  const decision = runtime.record(eventInput({ occurredAtMs: nowMs, ...overrides }), nowMs);
  assert.equal(decision.outcome, "ACCEPTED");
  const record = runtime.exportState(nowMs).eventRecords[0];
  assert.ok(record);
  return record;
}

test("AWI-INSIGHTS-1 schema fixes opaque identifiers and classifies every retained record field", () => {
  const schema = JSON.parse(
    readFileSync("schemas/contracts/usage-insights-event-v1.schema.json", "utf8"),
  ) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const fixture = storedEventFixture();
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
  assert.match(fixture.eventId, /^event:v1:[a-f0-9]{64}$/);
  assert.equal(validate({ ...fixture, eventId: "awi-insights-event:customer-acme-secret" }), false);
  assert.equal(validate({ ...fixture, eventId: `event:v1:${"a".repeat(63)}z` }), false);
  assert.deepEqual(verifyUsageInsightsEventV1(fixture), {
    outcome: "ACCEPTED",
    reasonCodes: ["USAGE_INSIGHTS_EVENT_VERIFIED"],
    productId: fixture.productId,
    capabilityId: fixture.capabilityId,
    productVersion: fixture.productVersion,
    lifecycleOutcome: fixture.lifecycleOutcome,
  });
  assert.deepEqual(USAGE_INSIGHTS_FIELD_CLASSIFICATIONS_V1.map(([path]) => path), [
    "/schemaVersion", "/eventId", "/installationId", "/productId", "/capabilityId",
    "/productVersion", "/lifecycleOutcome", "/occurredAtMs", "/eventDigest",
  ]);
});

test("AWI-INSIGHTS-1 freezes closed vocabularies and exact product identity", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  assert.equal(USAGE_INSIGHTS_PRODUCT_VERSION_V1, pkg.version);
  for (const allowlist of [
    USAGE_INSIGHTS_PRODUCT_IDS_V1,
    USAGE_INSIGHTS_CAPABILITY_IDS_V1,
    USAGE_INSIGHTS_LIFECYCLE_OUTCOMES_V1,
  ]) {
    assert.ok(allowlist.length > 0);
    assert.equal(new Set(allowlist).size, allowlist.length);
  }
  assert.equal(USAGE_INSIGHTS_PROHIBITED_FIELDS_V1.length, 30);
  const normalized = USAGE_INSIGHTS_PROHIBITED_FIELDS_V1.map(
    (field) => field.replace(/[^a-zA-Z0-9]/g, "").toLowerCase(),
  );
  assert.equal(new Set(normalized).size, normalized.length);
});

test("AWI-INSIGHTS-1 input negative matrix rejects text, identity, covert IDs, and unknown fields", () => {
  const cases = JSON.parse(
    readFileSync("tests/fixtures/usage-insights/negative-matrix-v1.json", "utf8"),
  ) as NegativeFixture[];
  assert.ok(cases.length >= 24);
  for (const negative of cases) {
    const runtime = new UsageInsightsRuntimeV1(0);
    runtime.optIn(0);
    const result = runtime.record(mutateInput(eventInput({ occurredAtMs: 1 }), negative), 1);
    assert.equal(result.outcome, "DENIED", negative.caseId);
    assert.ok(result.reasonCodes.includes(negative.expectedReason), `${negative.caseId}:${result.reasonCodes.join(",")}`);
    assert.equal(runtime.status(1).eventCount, 0, negative.caseId);
  }
});

test("AWI-INSIGHTS-1 descriptor boundary never invokes getters, proxy traps, or coercion hooks", () => {
  let getterCalls = 0;
  const accessor = structuredClone(storedEventFixture()) as unknown as Record<string, unknown>;
  Object.defineProperty(accessor, "eventId", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return `event:v1:${"a".repeat(64)}`;
    },
  });
  assert.deepEqual(verifyUsageInsightsEventV1(accessor), {
    outcome: "DENIED",
    reasonCodes: ["UNSAFE_STRUCTURE_DENIED"],
  });
  assert.throws(() => usageInsightsEventDigestV1(accessor), /UNSAFE_STRUCTURE/);
  assert.equal(getterCalls, 0);

  const runtime = new UsageInsightsRuntimeV1(0);
  runtime.optIn(0);
  const inputAccessor = { ...eventInput({ occurredAtMs: 1 }) } as unknown as Record<string, unknown>;
  Object.defineProperty(inputAccessor, "capabilityId", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "capability.gateway";
    },
  });
  assert.deepEqual(runtime.record(inputAccessor, 1), {
    outcome: "DENIED",
    reasonCodes: ["UNSAFE_STRUCTURE_DENIED"],
  });
  assert.equal(getterCalls, 0);

  let proxyCalls = 0;
  const proxy = new Proxy(storedEventFixture(), {
    ownKeys(target) {
      proxyCalls += 1;
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, key) {
      proxyCalls += 1;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
    get(target, key, receiver) {
      proxyCalls += 1;
      return Reflect.get(target, key, receiver);
    },
  });
  assert.deepEqual(verifyUsageInsightsEventV1(proxy), {
    outcome: "DENIED",
    reasonCodes: ["UNSAFE_STRUCTURE_DENIED"],
  });
  assert.equal(proxyCalls, 0);

  let coercionCalls = 0;
  const coercive = structuredClone(storedEventFixture()) as unknown as Record<PropertyKey, unknown>;
  coercive[Symbol.toPrimitive] = () => {
    coercionCalls += 1;
    return "secret";
  };
  assert.equal(verifyUsageInsightsEventV1(coercive).outcome, "DENIED");
  assert.equal(coercionCalls, 0);
});

test("AWI-INSIGHTS-1 rejects symbols, non-enumerables, dangerous keys, aliases, cycles, exotic objects, and sparse arrays", () => {
  const unsafeValues: unknown[] = [];

  const symbol = structuredClone(storedEventFixture()) as unknown as Record<PropertyKey, unknown>;
  symbol[Symbol("identity")] = "customer-secret";
  unsafeValues.push(symbol);

  const nonEnumerable = structuredClone(storedEventFixture()) as unknown as Record<string, unknown>;
  Object.defineProperty(nonEnumerable, "customer", { value: "secret", enumerable: false });
  unsafeValues.push(nonEnumerable);

  const dangerous = structuredClone(storedEventFixture()) as unknown as Record<string, unknown>;
  Object.defineProperty(dangerous, "constructor", { value: "secret", enumerable: true });
  unsafeValues.push(dangerous);

  const shared = { fixed: true };
  unsafeValues.push({ ...storedEventFixture(), extraOne: shared, extraTwo: shared });

  const cyclic: Record<string, unknown> = { fixed: true };
  cyclic.self = cyclic;
  unsafeValues.push({ ...storedEventFixture(), extra: cyclic });

  unsafeValues.push({ ...storedEventFixture(), extra: Object.create(null) });

  const sparse = new Array(2);
  sparse[1] = "fixed";
  unsafeValues.push({ ...storedEventFixture(), extra: sparse });

  for (const [index, value] of unsafeValues.entries()) {
    assert.deepEqual(verifyUsageInsightsEventV1(value), {
      outcome: "DENIED",
      reasonCodes: ["UNSAFE_STRUCTURE_DENIED"],
    }, String(index));
  }
  assert.throws(() => aggregateUsageInsightsV1(sparse, 1), /INVALID_USAGE_INSIGHTS_AGGREGATION_INPUT/);
});

test("AWI-INSIGHTS-1 is default-off and has no identity before explicit opt-in", () => {
  const runtime = new UsageInsightsRuntimeV1(1_000);
  const status = runtime.status(1_000);
  assert.equal(status.state, "DISABLED");
  assert.equal(status.installationId, null);
  assert.equal(status.eventCount, 0);
  assert.equal(status.deletionMode, "LAZY_ON_ACCESS");
  assert.deepEqual(runtime.record(eventInput(), 1_000), {
    outcome: "DENIED",
    reasonCodes: ["DISABLED_DENIED"],
  });
  assert.equal(runtime.preview(1_000).publishableAggregation.publicationState, "EMPTY");
  assert.throws(() => runtime.exportState(1_000), /NOT_OPTED_IN/);
});

test("AWI-INSIGHTS-1 runtime mints opaque event IDs and never accepts caller identifiers", () => {
  const runtime = new UsageInsightsRuntimeV1(1_000);
  const optedIn = runtime.optIn(1_000);
  assert.match(optedIn.installationId ?? "", /^sha256:[a-f0-9]{64}$/);

  const first = runtime.record(eventInput({ occurredAtMs: 1_001 }), 1_001);
  const second = runtime.record(eventInput({ occurredAtMs: 1_002 }), 1_002);
  assert.equal(first.outcome, "ACCEPTED");
  assert.equal(second.outcome, "ACCEPTED");
  if (first.outcome !== "ACCEPTED" || second.outcome !== "ACCEPTED") return;
  assert.match(first.eventId, /^event:v1:[a-f0-9]{64}$/);
  assert.notEqual(first.eventId, second.eventId);

  const covert = { ...eventInput({ occurredAtMs: 1_003 }), eventId: "customer-acme-secret" };
  assert.deepEqual(runtime.record(covert, 1_003), { outcome: "DENIED", reasonCodes: ["SCHEMA_DENIED"] });
  const exported = runtime.exportState(1_003);
  assert.equal(exported.eventRecords.length, 2);
  assert.equal(exported.eventRecords.every((event) => event.installationId === optedIn.installationId), true);
});

test("AWI-INSIGHTS-1 rejects caller-chosen installation IDs, entropy, and exported deterministic seams", () => {
  assert.throws(
    () => Reflect.construct(UsageInsightsRuntimeV1, [0, { randomSource: () => installationId("a") }]),
    /TEST_SEAM_DENIED/,
  );
  const runtime = new UsageInsightsRuntimeV1(0);
  assert.throws(
    () => Reflect.apply(runtime.optIn, runtime, [0, installationId("a")]),
    /CALLER_INSTALLATION_ID_DENIED/,
  );
  const firstId = runtime.optIn(0).installationId;
  assert.ok(firstId);
  runtime.record(eventInput({ occurredAtMs: 1 }), 1);
  assert.throws(
    () => Reflect.apply(runtime.rotateInstallationId, runtime, [2, installationId("b")]),
    /CALLER_ROTATION_ENTROPY_DENIED/,
  );
  assert.equal(runtime.status(2).installationId, firstId);
  assert.equal(runtime.status(2).eventCount, 1);
});

test("AWI-INSIGHTS-1 rotation uses fresh entropy and erases the old epoch before exposing the new pseudonym", () => {
  const runtime = new UsageInsightsRuntimeV1(0);
  const firstId = runtime.optIn(0).installationId;
  runtime.record(eventInput({ occurredAtMs: 1 }), 1);
  const secondId = runtime.rotateInstallationId(2);
  assert.ok(firstId);
  assert.notEqual(secondId, firstId);
  assert.match(secondId, /^sha256:[a-f0-9]{64}$/);
  const after = runtime.status(2);
  assert.equal(after.epoch, 2);
  assert.equal(after.eventCount, 0);
  assert.equal(runtime.exportState(2).eventRecords.length, 0);

  runtime.record(eventInput({ occurredAtMs: 3 }), 3);
  const automaticAt = 2 + USAGE_INSIGHTS_ROTATION_INTERVAL_MS;
  const thirdId = runtime.status(automaticAt).installationId;
  assert.notEqual(thirdId, secondId);
  assert.equal(runtime.status(automaticAt).epoch, 3);
  assert.equal(runtime.status(automaticAt).eventCount, 0);

  const exactlyDue = new UsageInsightsRuntimeV1(0);
  exactlyDue.optIn(0);
  exactlyDue.record(eventInput({ occurredAtMs: 1 }), 1);
  exactlyDue.rotateInstallationId(USAGE_INSIGHTS_ROTATION_INTERVAL_MS);
  assert.equal(exactlyDue.status(USAGE_INSIGHTS_ROTATION_INTERVAL_MS).epoch, 2, "explicit due rotation occurs once");
});

test("AWI-INSIGHTS-1 bounds each in-memory identity epoch", () => {
  const runtime = new UsageInsightsRuntimeV1(0);
  runtime.optIn(0);
  for (let index = 0; index < USAGE_INSIGHTS_MAX_EVENT_RECORDS; index += 1) {
    assert.equal(runtime.record(eventInput({ occurredAtMs: index }), index).outcome, "ACCEPTED");
  }
  assert.deepEqual(runtime.record(eventInput({ occurredAtMs: USAGE_INSIGHTS_MAX_EVENT_RECORDS }), USAGE_INSIGHTS_MAX_EVENT_RECORDS), {
    outcome: "DENIED",
    reasonCodes: ["CAPACITY_DENIED"],
  });
  assert.equal(runtime.status(USAGE_INSIGHTS_MAX_EVENT_RECORDS).eventCount, USAGE_INSIGHTS_MAX_EVENT_RECORDS);
  runtime.rotateInstallationId(USAGE_INSIGHTS_MAX_EVENT_RECORDS);
  assert.equal(runtime.status(USAGE_INSIGHTS_MAX_EVENT_RECORDS).eventCount, 0);
});

test("AWI-INSIGHTS-1 record timing is bounded to the current epoch and call time", () => {
  const runtime = new UsageInsightsRuntimeV1(100);
  runtime.optIn(100);
  assert.deepEqual(runtime.record(eventInput({ occurredAtMs: 99 }), 101), {
    outcome: "DENIED",
    reasonCodes: ["EVENT_TIME_DENIED"],
  });
  assert.deepEqual(runtime.record(eventInput({ occurredAtMs: 102 }), 101), {
    outcome: "DENIED",
    reasonCodes: ["EVENT_TIME_DENIED"],
  });
  assert.equal(runtime.record(eventInput({ occurredAtMs: 101 }), 101).outcome, "ACCEPTED");
  assert.throws(() => runtime.status(100), /TIME_REGRESSION/);
});

test("AWI-INSIGHTS-1 publishes only cohorts whose every cell has five distinct installations", () => {
  const visible = [0, 1, 2, 3, 4].map((index) => oneRuntimeRecord(1_000 + index));
  const aggregate = aggregateUsageInsightsV1(visible, 2_000);
  assert.equal(aggregate.publicationState, "PUBLISHED");
  assert.equal(aggregate.eventCount, 5);
  assert.equal(aggregate.installationsSeen, 5);
  assert.equal(aggregate.suppressionReason, null);
  assert.deepEqual(aggregate.cells, [{
    productId: "chimpmaera.poc",
    capabilityId: "capability.gateway",
    lifecycleOutcome: "INSTALL_SUCCEEDED",
    count: 5,
    distinctInstallations: 5,
  }]);
});

test("AWI-INSIGHTS-1 suppressed output hides totals, cell count, and suppression multiplicity", () => {
  const oneEvent = [oneRuntimeRecord(1_000)];
  const manySuppressed = [
    ...[0, 1, 2, 3].map((index) => oneRuntimeRecord(1_100 + index)),
    ...[0, 1, 2].map((index) => oneRuntimeRecord(1_200 + index, { capabilityId: "capability.builder" })),
  ];
  const oneCell = aggregateUsageInsightsV1(oneEvent, 3_000);
  const twoCells = aggregateUsageInsightsV1(manySuppressed, 3_000);
  assert.deepEqual(oneCell, twoCells, "suppressed projections must not encode count or multiplicity");
  assert.deepEqual(oneCell, {
    schemaVersion: "chimpmaera.usage-insights/publishable-aggregate/v1",
    cohortLabel: "UNAUTHENTICATED_OPTED_IN_REFERENCE",
    coverageLabel: "PARTIAL_OPT_IN_NON_REPRESENTATIVE",
    suppressionPolicy: "ALL_OR_NOTHING_DISTINCT_INSTALLATIONS_THRESHOLD_5",
    minCellSize: 5,
    publicationState: "SUPPRESSED",
    eventCount: null,
    installationsSeen: null,
    suppressionReason: "ONE_OR_MORE_COHORTS_BELOW_THRESHOLD",
    cells: [],
    generatedAtMs: 3_000,
    aggregationDigest: oneCell.aggregationDigest,
  });
});

test("AWI-INSIGHTS-1 exact local preview is separate from the publishable aggregate", () => {
  const runtime = new UsageInsightsRuntimeV1(0);
  runtime.optIn(0);
  runtime.record(eventInput({ occurredAtMs: 1 }), 1);
  runtime.record(eventInput({ occurredAtMs: 2, lifecycleOutcome: "RUNNING" }), 2);
  const preview = runtime.preview(2);
  assert.equal(preview.eventCount, 2);
  assert.deepEqual(preview.distinctLifecycleOutcomes, ["INSTALL_SUCCEEDED", "RUNNING"]);
  assert.equal(preview.publishableAggregation.publicationState, "SUPPRESSED");
  assert.equal(preview.publishableAggregation.eventCount, null);
  assert.deepEqual(preview.publishableAggregation.cells, []);
});

test("AWI-INSIGHTS-1 aggregation deduplicates exact records and rejects conflicting opaque IDs", () => {
  const record = storedEventFixture();
  assert.equal(aggregateUsageInsightsV1([record, structuredClone(record)], 1).publicationState, "SUPPRESSED");
  const conflict = cloneRecordWith({
    eventId: record.eventId,
    occurredAtMs: record.occurredAtMs + 1,
    lifecycleOutcome: "RUNNING",
  });
  assert.throws(() => aggregateUsageInsightsV1([record, conflict], 2), /CONFLICTING_USAGE_INSIGHTS_EVENT_ID/);
});

test("AWI-INSIGHTS-1 public decision never projects caller or opaque identifiers", () => {
  const record = storedEventFixture();
  const accepted = renderPublicUsageInsightsDecisionV1(record);
  assert.equal(accepted.includes(record.eventId), false);
  assert.equal(accepted.includes(record.installationId), false);
  assert.deepEqual(Object.keys(JSON.parse(accepted)).sort(), [
    "capabilityId", "claimBoundary", "lifecycleOutcome", "outcome", "productId", "reasonCodes", "schemaVersion",
  ]);

  const secret = "customer-acme-secret";
  const rejected = renderPublicUsageInsightsDecisionV1({ ...record, eventId: secret });
  assert.equal(rejected.includes(secret), false);
  assert.equal(rejected.includes(record.installationId), false);
});

test("AWI-INSIGHTS-1 snapshot restore verifies inner digests, bindings, duplicates, and version", () => {
  const runtime = new UsageInsightsRuntimeV1(0);
  runtime.optIn(10);
  runtime.record(eventInput({ occurredAtMs: 12 }), 12);
  const snapshot = runtime.snapshot(20);

  const invalidInner = structuredClone(snapshot) as unknown as Record<string, unknown>;
  (invalidInner.eventRecords as Array<Record<string, unknown>>)[0]!.eventDigest = "f".repeat(64);
  redigestSnapshot(invalidInner);
  assert.throws(() => UsageInsightsRuntimeV1.restore(invalidInner, 20), /INVALID_USAGE_INSIGHTS_RUNTIME_SNAPSHOT/);

  const foreign = structuredClone(snapshot) as unknown as Record<string, unknown>;
  redigestInnerEvent(foreign).installationId = installationId("b");
  redigestInnerEvent(foreign);
  redigestSnapshot(foreign);
  assert.throws(() => UsageInsightsRuntimeV1.restore(foreign, 20), /INVALID_USAGE_INSIGHTS_RUNTIME_SNAPSHOT/);

  const duplicate = structuredClone(snapshot) as unknown as Record<string, unknown>;
  const events = duplicate.eventRecords as Array<Record<string, unknown>>;
  events.push(structuredClone(events[0]!));
  redigestSnapshot(duplicate);
  assert.throws(() => UsageInsightsRuntimeV1.restore(duplicate, 20), /INVALID_USAGE_INSIGHTS_RUNTIME_SNAPSHOT/);

  const drift = structuredClone(snapshot) as unknown as Record<string, unknown>;
  redigestInnerEvent(drift).productVersion = "0.2.0-poc.future";
  redigestInnerEvent(drift);
  redigestSnapshot(drift);
  assert.throws(() => UsageInsightsRuntimeV1.restore(drift, 20), /INVALID_USAGE_INSIGHTS_RUNTIME_SNAPSHOT/);
});

test("AWI-INSIGHTS-1 rejects impossible but coherently redigested snapshot timelines and states", () => {
  const runtime = new UsageInsightsRuntimeV1(0);
  runtime.optIn(10);
  runtime.record(eventInput({ occurredAtMs: 12 }), 12);
  const snapshot = runtime.snapshot(20);

  const mutations: Array<[string, (value: Record<string, unknown>) => void, number]> = [
    ["creation-after-opt-in", (value) => { value.createdAtMs = 11; }, 20],
    ["capture-before-rotation", (value) => { value.capturedAtMs = 9; }, 20],
    ["epoch-one-rotation-drift", (value) => { value.lastRotatedAtMs = 11; }, 20],
    ["restore-before-capture", () => {}, 19],
    ["state-flag-mismatch", (value) => { value.state = "REVOKED"; }, 20],
    ["event-before-current-epoch", (value) => {
      redigestInnerEvent(value).occurredAtMs = 9;
      redigestInnerEvent(value);
    }, 20],
    ["event-after-capture", (value) => {
      redigestInnerEvent(value).occurredAtMs = 21;
      redigestInnerEvent(value);
    }, 21],
  ];
  for (const [name, mutate, restoreAt] of mutations) {
    const impossible = structuredClone(snapshot) as unknown as Record<string, unknown>;
    mutate(impossible);
    redigestSnapshot(impossible);
    assert.throws(
      () => UsageInsightsRuntimeV1.restore(impossible, restoreAt),
      /INVALID_USAGE_INSIGHTS_RUNTIME_SNAPSHOT/,
      name,
    );
  }

  const revokedRuntime = UsageInsightsRuntimeV1.restore(snapshot, 20);
  revokedRuntime.revoke(21);
  const revoked = revokedRuntime.snapshot(22) as unknown as Record<string, unknown>;
  revoked.deleteByMs = (revoked.deleteByMs as number) + 1;
  redigestSnapshot(revoked);
  assert.throws(() => UsageInsightsRuntimeV1.restore(revoked, 22), /INVALID_USAGE_INSIGHTS_RUNTIME_SNAPSHOT/);
});

test("AWI-INSIGHTS-1 restore rejects descriptor hazards and extra deterministic options without invocation", () => {
  const runtime = new UsageInsightsRuntimeV1(0);
  runtime.optIn(0);
  const snapshot = runtime.snapshot(1);
  let calls = 0;
  const accessor = structuredClone(snapshot) as unknown as Record<string, unknown>;
  Object.defineProperty(accessor, "createdAtMs", {
    enumerable: true,
    get() {
      calls += 1;
      return 0;
    },
  });
  assert.throws(() => UsageInsightsRuntimeV1.restore(accessor, 1), /INVALID_USAGE_INSIGHTS_RUNTIME_SNAPSHOT/);
  assert.equal(calls, 0);
  assert.throws(
    () => Reflect.apply(UsageInsightsRuntimeV1.restore, UsageInsightsRuntimeV1, [snapshot, 1, { randomSource: () => "x" }]),
    /TEST_SEAM_DENIED/,
  );
});

test("AWI-INSIGHTS-1 restore retains a valid epoch and rotates lazily when it is due", () => {
  const runtime = new UsageInsightsRuntimeV1(0);
  const currentId = runtime.optIn(0).installationId;
  runtime.record(eventInput({ occurredAtMs: 1 }), 1);
  const snapshot = runtime.snapshot(2);
  const restored = UsageInsightsRuntimeV1.restore(snapshot, 3);
  assert.equal(restored.status(3).installationId, currentId);
  assert.equal(restored.status(3).eventCount, 1);

  const due = USAGE_INSIGHTS_ROTATION_INTERVAL_MS;
  const rotated = UsageInsightsRuntimeV1.restore(snapshot, due);
  assert.notEqual(rotated.status(due).installationId, currentId);
  assert.equal(rotated.status(due).epoch, 2);
  assert.equal(rotated.status(due).eventCount, 0);
});

test("AWI-INSIGHTS-1 revoke denies recording immediately and seven-day expiry is lazy on access", () => {
  const runtime = new UsageInsightsRuntimeV1(0);
  runtime.optIn(0);
  runtime.record(eventInput({ occurredAtMs: 1 }), 1);
  const revoked = runtime.revoke(2);
  assert.equal(revoked.state, "REVOKED");
  assert.equal(revoked.deleteByMs, 2 + USAGE_INSIGHTS_LAZY_EXPIRY_MS);
  assert.deepEqual(runtime.record(eventInput({ occurredAtMs: 3 }), 3), {
    outcome: "DENIED",
    reasonCodes: ["REVOKED_DENIED"],
  });
  assert.equal(runtime.exportState(3).eventRecords.length, 1);

  const snapshot = runtime.snapshot(4);
  const restoredAfterExpiry = UsageInsightsRuntimeV1.restore(snapshot, 2 + USAGE_INSIGHTS_LAZY_EXPIRY_MS + 10);
  const expired = restoredAfterExpiry.status(2 + USAGE_INSIGHTS_LAZY_EXPIRY_MS + 10);
  assert.equal(expired.state, "DELETED");
  assert.equal(expired.eventCount, 0);
  assert.equal(expired.installationId, null);
  assert.equal(expired.deletedAtMs, 2 + USAGE_INSIGHTS_LAZY_EXPIRY_MS + 10, "access time proves lazy expiry");
});

test("AWI-INSIGHTS-1 explicit deletion immediately wipes this runtime object", () => {
  const runtime = new UsageInsightsRuntimeV1(0);
  runtime.optIn(0);
  runtime.record(eventInput({ occurredAtMs: 1 }), 1);
  const erased = runtime.deleteState(2);
  assert.equal(erased.erasedEventCount, 1);
  assert.equal(erased.erasedAtMs, 2);
  assert.match(erased.erasureDigest, /^[a-f0-9]{64}$/);
  assert.equal(runtime.status(2).state, "DELETED");
  assert.equal(runtime.status(2).eventCount, 0);
  assert.throws(() => runtime.exportState(2), /DELETED/);
});

test("AWI-INSIGHTS-1 unkeyed digests detect drift but do not claim authenticity or provenance", () => {
  const runtime = new UsageInsightsRuntimeV1(0);
  runtime.optIn(0);
  const snapshot = runtime.snapshot(1);
  const drifted = structuredClone(snapshot) as unknown as Record<string, unknown>;
  drifted.capturedAtMs = 2;
  assert.throws(() => UsageInsightsRuntimeV1.restore(drifted, 2), /SNAPSHOT_DIGEST_MISMATCH/);

  const docs = readFileSync("docs/USAGE-INSIGHTS-CONTRACT.md", "utf8");
  assert.match(docs, /unkeyed/i);
  assert.match(docs, /not (?:an )?authenticity/i);
  assert.match(docs, /provenance/i);
});

test("AWI-INSIGHTS-1 documentation keeps the whole-Issue and production nonclaims explicit", () => {
  const docs = readFileSync("docs/USAGE-INSIGHTS-CONTRACT.md", "utf8");
  for (const required of [
    /Refs #57/,
    /Issue #57 remains open/,
    /consent UX/,
    /consent profiles/,
    /durable consent/,
    /durable events/,
    /stable ID across restart/,
    /persistence/,
    /automatic\/background deletion/,
    /shared-data deletion/,
    /collector/,
    /transport/,
    /ambient telemetry/,
    /dashboard/,
    /authorization of local-owner/,
    /deployment/,
    /production readiness/,
    /representative installation cohorts/,
    /completion of Issue #57/,
  ]) {
    assert.match(docs, required);
  }
});

test("AWI-INSIGHTS-1 source has no collector, transport, ambient telemetry, or network surface", () => {
  const source = readFileSync("packages/contracts/src/usage-insights.ts", "utf8");
  const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].flatMap((match) => {
    const specifier = match[1];
    return specifier === undefined ? [] : [specifier];
  });
  const allowed = new Set(["node:crypto", "node:util/types", "./canonical-json.js"]);
  for (const specifier of specifiers) {
    assert.ok(!/^node:(?:http|https|net|dns|tls|dgram|http2|worker_threads|child_process)/.test(specifier), specifier);
    assert.ok(!/^https?:\/\//.test(specifier), specifier);
    assert.ok(allowed.has(specifier), `unexpected import: ${specifier}`);
  }
  for (const forbidden of [
    "fetch(", "XMLHttpRequest", "WebSocket", "http.request", "https.request", "net.connect", "node:net", "node:http",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.match(USAGE_INSIGHTS_CLAIM_BOUNDARY_V1, /NO_TRANSPORT/);
  assert.match(USAGE_INSIGHTS_CLAIM_BOUNDARY_V1, /NO_PRODUCTION/);
});
