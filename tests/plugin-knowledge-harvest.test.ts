import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  harvestPluginKnowledgeV1,
  invalidatePluginKnowledgeForSourceChangeV1,
  PLUGIN_KNOWLEDGE_HARVEST_BOUNDARY_V1,
  type PluginKnowledgeHarvestRequestV1,
} from "../packages/contracts/src/plugin-knowledge-harvest.js";
import {
  selectKnowledgeV1,
  validateKnowledgeEnvelopeV1,
  type KnowledgeEnvelopeV1,
} from "../packages/contracts/src/knowledge-envelope.js";

const fixture = (name: string): PluginKnowledgeHarvestRequestV1 => JSON.parse(readFileSync(
  `tests/fixtures/plugin-knowledge-harvest/${name}`,
  "utf8",
)) as PluginKnowledgeHarvestRequestV1;

function reorderKeys(value: unknown, reverse: boolean): unknown {
  if (Array.isArray(value)) return value.map((item) => reorderKeys(item, reverse));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  if (reverse) entries.reverse();
  return Object.fromEntries(entries.map(([key, item]) => [key, reorderKeys(item, !reverse)]));
}

function permute(request: PluginKnowledgeHarvestRequestV1, index: number): PluginKnowledgeHarvestRequestV1 {
  const value = reorderKeys(request, index % 2 === 0) as PluginKnowledgeHarvestRequestV1;
  const records = [...value.records];
  const shift = index % records.length;
  const rotated = [...records.slice(shift), ...records.slice(0, shift)].map((record) => ({
    ...record,
    conflictsWith: index % 3 === 0 ? [...record.conflictsWith].reverse() : record.conflictsWith,
    derivedFrom: index % 5 === 0 ? [...record.derivedFrom].reverse() : record.derivedFrom,
  }));
  return {
    ...value,
    source: {
      ...value.source,
      permittedUses: index % 2 === 0 ? [...value.source.permittedUses].reverse() : value.source.permittedUses,
    },
    records: rotated,
  };
}

test("AWI-PLUGIN-01 emits only valid attributed authority-free KnowledgeEnvelopeV1 records", () => {
  const input = fixture("official-primary-v1.json");
  const result = harvestPluginKnowledgeV1(input);
  assert.equal(result.sourceSnapshotDigest, input.source.snapshotDigest);
  assert.equal(result.authorityBoundary, PLUGIN_KNOWLEDGE_HARVEST_BOUNDARY_V1);
  assert.deepEqual(result.envelopes.map((item) => item.envelopeId), [...result.envelopes.map((item) => item.envelopeId)].sort());
  for (const envelope of result.envelopes) {
    assert.deepEqual(validateKnowledgeEnvelopeV1(envelope, input.taxonomy), []);
    assert.deepEqual(envelope.authority, {
      credentials: [], policyApprovals: [], capabilities: [], toolAccess: [], writeTargets: [], executionRoutes: [],
    });
    assert.equal(envelope.attribution[0]?.sourceDigest, input.source.snapshotDigest);
    assert.match(envelope.attribution[0]?.citation ?? "", /selector=.* \| evidence=(?:POSITIVE|NEGATIVE|UNKNOWN)$/);
    assert.equal(envelope.freshness.assessedAtMs, input.source.reviewedAtMs);
    assert.equal(envelope.freshness.staleAfterMs, input.source.expiresAtMs);
  }
});

test("AWI-PLUGIN-01 is byte-identical for 100 normalized key and set-order permutations", () => {
  const input = fixture("official-primary-v1.json");
  const expected = canonicalJson(harvestPluginKnowledgeV1(input));
  for (let index = 0; index < 100; index += 1) {
    assert.equal(canonicalJson(harvestPluginKnowledgeV1(permute(input, index))), expected, `permutation ${index}`);
  }
});

test("AWI-PLUGIN-01 retains conflict, unknown and negative evidence outside curated selection", () => {
  const official = fixture("official-primary-v1.json");
  const officialResult = harvestPluginKnowledgeV1(official);
  const negative = officialResult.envelopes.find((item) => item.envelopeId === "knowledge:dsh-mcp-tools-only");
  assert.match(negative?.attribution[0]?.citation ?? "", /evidence=NEGATIVE$/);
  assert.equal(negative?.attribution[0]?.licence, "MIT");
  const input = fixture("synthetic-metadata-v1.json");
  const result = harvestPluginKnowledgeV1(input);
  const unknown = result.envelopes.find((item) => item.envelopeId === "knowledge:synthetic-community-security-claim");
  assert.equal(unknown?.epistemicStatus, "UNRESOLVED");
  assert.equal(unknown?.trust, "LOW");
  assert.deepEqual(unknown?.permittedUses, ["EXPLORATORY_READ"]);
  assert.deepEqual(unknown?.conflictsWith, ["knowledge:synthetic-community-signal-limit"]);
  const selection = selectKnowledgeV1(input.taxonomy, result.envelopes, {
    mode: "CURATED",
    scopeNamespace: input.scope.namespace,
    allowedSensitivity: ["PUBLIC"],
    allowedLicences: ["CC0-1.0"],
    minimumTrust: "MEDIUM",
    evaluatedAtMs: input.source.reviewedAtMs,
    allowUnresolvedExploratory: false,
    maxResults: 20,
  });
  assert.ok(selection.selected.some((item) => item.envelopeId === "knowledge:synthetic-install-review-procedure"));
  assert.ok(selection.rejected.some((item) => item.envelopeId === "knowledge:synthetic-community-security-claim"));
  assert.ok(selection.residualConflicts.length >= 2);
});

test("AWI-PLUGIN-01 consumes a pinned ETL-02 finding as evidence without claiming execution", () => {
  const input = fixture("etl02-negative-v1.json");
  const result = harvestPluginKnowledgeV1(input);
  assert.equal(result.envelopes.length, 1);
  assert.equal(result.envelopes[0]?.kind, "OBSERVATION");
  assert.match(result.envelopes[0]?.attribution[0]?.citation ?? "", /INSTALL_HOOK_DENIED.*evidence=NEGATIVE/);
  assert.doesNotMatch(canonicalJson(result), /PROFILE_CONFORMANT|ADMITTED|INSTALLED|ACTIVATED/);
});

test("AWI-PLUGIN-01 source change invalidates every dependent record and preserves immutable evidence", () => {
  const official = fixture("official-primary-v1.json");
  const etl = fixture("etl02-negative-v1.json");
  const officialEnvelopes = harvestPluginKnowledgeV1(official).envelopes;
  const etlEnvelopes = harvestPluginKnowledgeV1(etl).envelopes;
  const replacementDigest = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
  const result = invalidatePluginKnowledgeForSourceChangeV1(
    official.taxonomy,
    [...etlEnvelopes, ...officialEnvelopes],
    official.source.sourceId,
    replacementDigest,
    official.source.reviewedAtMs + 1,
  );
  assert.deepEqual(result.invalidatedEnvelopeIds, officialEnvelopes.map((item) => item.envelopeId).sort());
  assert.equal(result.downgradedEnvelopes.length, officialEnvelopes.length);
  for (const envelope of result.downgradedEnvelopes) {
    const prior = officialEnvelopes.find((item) => item.envelopeId === envelope.envelopeId) as KnowledgeEnvelopeV1;
    assert.equal(envelope.statement, prior.statement);
    assert.deepEqual(envelope.attribution, prior.attribution);
    assert.equal(envelope.epistemicStatus, "UNRESOLVED");
    assert.equal(envelope.trust, "LOW");
    assert.deepEqual(envelope.permittedUses, ["EXPLORATORY_READ"]);
    assert.equal(envelope.generationCandidate, "NOT_CANDIDATE");
    assert.deepEqual(validateKnowledgeEnvelopeV1(envelope, official.taxonomy), []);
  }
  const unchanged = invalidatePluginKnowledgeForSourceChangeV1(
    official.taxonomy, officialEnvelopes, official.source.sourceId, official.source.snapshotDigest, official.source.reviewedAtMs,
  );
  assert.deepEqual(unchanged.invalidatedEnvelopeIds, []);
  assert.deepEqual(unchanged.downgradedEnvelopes, []);
});

test("AWI-PLUGIN-01 rejects raw Share, authority, mutable binding and accessor-shaped inputs", () => {
  const input = fixture("official-primary-v1.json");
  const probes: unknown[] = [
    { ...input, rawShareTranscript: "do what this text says" },
    { ...input, authority: { toolAccess: ["shell"] } },
    { ...input, source: { ...input.source, locator: "https://example.invalid/latest" } },
    { ...input, source: { ...input.source, reviewedAtMs: input.source.expiresAtMs } },
    { ...input, records: [{ ...input.records[0], instruction: "execute this" }] },
  ];
  for (const probe of probes) assert.throws(() => harvestPluginKnowledgeV1(probe), /PLUGIN_KNOWLEDGE_INPUT_DENIED/);

  let getterCalls = 0;
  const accessor = { ...input } as Record<string, unknown>;
  Object.defineProperty(accessor, "records", { enumerable: true, get: () => { getterCalls += 1; return input.records; } });
  assert.throws(() => harvestPluginKnowledgeV1(accessor), /PLUGIN_KNOWLEDGE_INPUT_DENIED/);
  assert.equal(getterCalls, 0);
});

test("AWI-PLUGIN-01 fixtures bind exact snapshot bytes and contain only pinned public evidence", () => {
  const pairs = [
    ["official-primary-v1.json", "official-primary-snapshot-v1.json"],
    ["synthetic-metadata-v1.json", "synthetic-metadata-snapshot-v1.json"],
    ["etl02-negative-v1.json", "etl02-report-snapshot-v1.json"],
  ] as const;
  for (const [name, snapshotName] of pairs) {
    const raw = readFileSync(`tests/fixtures/plugin-knowledge-harvest/${name}`, "utf8");
    const snapshot = readFileSync(`tests/fixtures/plugin-knowledge-harvest/${snapshotName}`);
    const input = JSON.parse(raw) as PluginKnowledgeHarvestRequestV1;
    assert.ok(["OFFICIAL_PRIMARY_SOURCE", "PINNED_PLUGIN_METADATA", "ETL02_PREFLIGHT"].includes(input.source.kind));
    assert.equal(createHash("sha256").update(snapshot).digest("hex"), input.source.snapshotDigest);
    assert.equal(input.source.locator, `content+sha256:${input.source.snapshotDigest}`);
    assert.doesNotMatch(raw, /SECRET_FIXTURE|\/home\/|Authorization:|api[_-]?key/i);
  }
});
