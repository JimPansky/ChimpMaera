import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";

import Ajv2020 from "ajv/dist/2020.js";

import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  USAGE_INSIGHTS_RECEIVER_ACK_SCHEMA_V1,
  USAGE_INSIGHTS_RETENTION_INTERVAL_MS,
  UsageInsightsLocalServiceV1,
  UsageInsightsLoopbackTransportV1,
  buildUsageInsightsReportV1,
  renderUsageInsightsDashboardV1,
  validateUsageInsightsLoopbackEndpointV1,
  validateUsageInsightsShareEnvelopeV1,
  type UsageInsightsShareEnvelopeV1,
} from "../packages/usage-insights/src/index.js";

const temporaryRoots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "pansphaira-usage-insights-"));
  temporaryRoots.push(root);
  return root;
}

after(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

interface Receiver {
  readonly server: Server;
  readonly endpoint: string;
  readonly envelopes: Map<string, UsageInsightsShareEnvelopeV1>;
  readonly rawBodies: string[];
  readonly deletionRequests: string[];
  postCount: number;
  failFirstAck: boolean;
}

interface StatusView {
  readonly runtime: { readonly installationId: string | null; readonly eventCount: number };
  readonly pendingShare: boolean;
  readonly sharedBatchCount: number;
}

function statusView(value: Readonly<Record<string, unknown>>): StatusView {
  return value as unknown as StatusView;
}

async function startReceiver(failFirstAck = false): Promise<Receiver> {
  const receiver = {
    server: null as unknown as Server,
    endpoint: "",
    envelopes: new Map<string, UsageInsightsShareEnvelopeV1>(),
    rawBodies: [] as string[],
    deletionRequests: [] as string[],
    postCount: 0,
    failFirstAck,
  };
  receiver.server = createServer((request, response) => {
    if (request.method === "POST" && request.url === "/v1/usage-insights") {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        receiver.rawBodies.push(raw);
        receiver.postCount += 1;
        let envelope: UsageInsightsShareEnvelopeV1;
        try { envelope = validateUsageInsightsShareEnvelopeV1(JSON.parse(raw) as unknown); }
        catch {
          response.statusCode = 400;
          response.end();
          return;
        }
        const existing = receiver.envelopes.get(envelope.deletionId);
        if (existing !== undefined && existing.envelopeDigest !== envelope.envelopeDigest) {
          response.statusCode = 409;
          response.end();
          return;
        }
        receiver.envelopes.set(envelope.deletionId, envelope);
        if (receiver.failFirstAck && receiver.postCount === 1) {
          request.socket.destroy();
          return;
        }
        response.statusCode = 202;
        response.setHeader("content-type", "application/json");
        response.end(canonicalJson({
          schemaVersion: USAGE_INSIGHTS_RECEIVER_ACK_SCHEMA_V1,
          accepted: true,
          deletionId: envelope.deletionId,
        }));
      });
      return;
    }
    if (request.method === "DELETE" && request.url?.startsWith("/v1/usage-insights/")) {
      const encoded = request.url.slice("/v1/usage-insights/".length);
      const deletionId = decodeURIComponent(encoded);
      receiver.deletionRequests.push(deletionId);
      receiver.envelopes.delete(deletionId);
      response.statusCode = 204;
      response.end();
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((resolvePromise) => receiver.server.listen(0, "127.0.0.1", resolvePromise));
  const address = receiver.server.address() as AddressInfo;
  receiver.endpoint = `http://127.0.0.1:${address.port}/v1/usage-insights`;
  return receiver;
}

async function closeReceiver(receiver: Receiver): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => receiver.server.close((error) => {
    if (error === undefined) resolvePromise();
    else rejectPromise(error);
  }));
}

function recordDiagnostics(service: UsageInsightsLocalServiceV1, start: number): void {
  const events: Array<[number, string]> = [
    [1, "INSTALL_STARTED"],
    [1_001, "FIRST_SUCCESS"],
    [2_001, "RUNNING"],
    [USAGE_INSIGHTS_RETENTION_INTERVAL_MS + 2_002, "RUNNING"],
    [USAGE_INSIGHTS_RETENTION_INTERVAL_MS + 2_003, "ERROR"],
    [USAGE_INSIGHTS_RETENTION_INTERVAL_MS + 2_004, "DENIED"],
    [USAGE_INSIGHTS_RETENTION_INTERVAL_MS + 2_005, "ROLLBACK_SUCCEEDED"],
  ];
  for (const [offset, lifecycleOutcome] of events) {
    const decision = service.record({ capabilityId: "capability.gateway", lifecycleOutcome }, start + offset);
    assert.equal(decision.outcome, "ACCEPTED", lifecycleOutcome);
  }
}

function redigestEnvelope(value: UsageInsightsShareEnvelopeV1): UsageInsightsShareEnvelopeV1 {
  const record = structuredClone(value) as unknown as Record<string, unknown>;
  const unsigned = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "envelopeDigest"));
  record.envelopeDigest = createHash("sha256").update(canonicalJson(unsigned), "utf8").digest("hex");
  return validateUsageInsightsShareEnvelopeV1(record);
}

test("AWI-INSIGHTS-1 completion defaults to network-off and stays fully useful offline", async () => {
  const receiver = await startReceiver();
  try {
    const store = join(temporaryRoot(), "state.json");
    const service = UsageInsightsLocalServiceV1.open(store, 1_000);
    assert.equal(service.consentStatus(1_000).networkMode, "OFF");
    assert.equal(service.status(1_000).networkDefault, "OFF");
    assert.equal(service.preview(1_000).sharedBatchCount, 0);
    assert.equal(service.localReport(1_000).publicationState, "EMPTY");
    assert.equal(existsSync(store), false, "read-only default does not even create a state file");
    await assert.rejects(() => service.share(new UsageInsightsLoopbackTransportV1(), 1_000), /EXPLICIT_SHARING_CONSENT_REQUIRED/);

    service.grant("basic", 1_001);
    assert.equal(service.record({ capabilityId: "capability.gateway", lifecycleOutcome: "INSTALL_STARTED" }, 1_002).outcome, "ACCEPTED");
    assert.equal((service.preview(1_003).local as { eventCount: number }).eventCount, 1);
    assert.equal((service.exportData(1_004).consent as { networkMode: string }).networkMode, "OFF");
    assert.equal(receiver.postCount, 0);
  } finally {
    await closeReceiver(receiver);
  }
});

test("AWI-INSIGHTS-1 completion provides transparent CLI consent, preview, export, revoke, and deletion", () => {
  const root = temporaryRoot();
  const store = join(root, "state.json");
  const cli = "dist/packages/usage-insights/src/cli.js";
  const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args, "--store", store], {
    cwd: process.cwd(), encoding: "utf8",
  });

  const defaultConsent = run("consent", "show");
  assert.equal(defaultConsent.status, 0, defaultConsent.stderr);
  const defaultValue = JSON.parse(defaultConsent.stdout) as Record<string, unknown>;
  assert.equal(defaultValue.state, "DISABLED");
  assert.equal(defaultValue.networkMode, "OFF");
  assert.match(defaultValue.notice as string, /Default is OFF/);
  assert.match(canonicalJson(defaultValue.prohibitedDataClasses), /prompts\/chats\/payloads/);

  assert.equal(run("consent", "grant", "--profile", "capability").status, 0);
  assert.equal(run("record", "--capability", "capability.gateway", "--outcome", "INSTALL_STARTED").status, 0);
  assert.equal(run("record", "--capability", "capability.gateway", "--outcome", "FIRST_SUCCESS").status, 0);
  const preview = run("preview");
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal((JSON.parse(preview.stdout) as { local: { eventCount: number } }).local.eventCount, 2);
  assert.equal(run("export").status, 0);
  assert.equal(run("revoke").status, 0);
  const denied = run("record", "--capability", "capability.gateway", "--outcome", "RUNNING");
  assert.equal((JSON.parse(denied.stdout) as { outcome: string }).outcome, "DENIED");
  assert.equal(run("delete").status, 0);
  assert.equal(existsSync(store), false);
});

test("AWI-INSIGHTS-1 completion persists bounded state with 0600 mode and reloads deterministically", () => {
  const store = join(temporaryRoot(), "state.json");
  const service = UsageInsightsLocalServiceV1.open(store, 10);
  service.grant("capability", 10);
  service.record({ capabilityId: "capability.builder", lifecycleOutcome: "RUNNING" }, 11);
  const firstId = statusView(service.status(12)).runtime.installationId;
  const reloaded = UsageInsightsLocalServiceV1.open(store, 13);
  assert.equal(statusView(reloaded.status(13)).runtime.installationId, firstId);
  assert.equal((reloaded.preview(13).local as { eventCount: number }).eventCount, 1);
  assert.equal((reloaded.exportData(13).runtimeSnapshot as { eventRecords: unknown[] }).eventRecords.length, 1);
  const mode = statSync(store).mode & 0o777;
  assert.equal(mode, 0o600);
});

test("AWI-INSIGHTS-1 diagnostics consent is mandatory-TTL and expires fail-closed", async () => {
  const store = join(temporaryRoot(), "state.json");
  const service = UsageInsightsLocalServiceV1.open(store, 100);
  assert.throws(() => service.grant("diagnostics", 100), /DIAGNOSTICS_TTL_DENIED/);
  assert.throws(() => service.grant("diagnostics", 100, 86_400_001), /DIAGNOSTICS_TTL_DENIED/);
  service.grant("diagnostics", 100, 10);
  service.enableSharing("http://127.0.0.1:65530/v1/usage-insights", 101);
  const expired = service.consentStatus(110);
  assert.equal(expired.state, "REVOKED");
  assert.equal(expired.networkMode, "OFF");
  assert.equal(service.record({ capabilityId: "capability.gateway", lifecycleOutcome: "ERROR" }, 111).outcome, "DENIED");
  await assert.rejects(() => service.share(undefined, 111), /EXPLICIT_SHARING_CONSENT_REQUIRED/);
  assert.equal(UsageInsightsLocalServiceV1.open(store, 112).consentStatus(112).state, "REVOKED");
});

test("AWI-INSIGHTS-1 profiles admit only their closed lifecycle subsets", () => {
  const root = temporaryRoot();
  const basic = UsageInsightsLocalServiceV1.open(join(root, "basic.json"), 0);
  basic.grant("basic", 0);
  assert.equal(basic.record({ capabilityId: "capability.gateway", lifecycleOutcome: "INSTALL_SUCCEEDED" }, 1).outcome, "ACCEPTED");
  assert.equal(basic.record({ capabilityId: "capability.gateway", lifecycleOutcome: "RUNNING" }, 2).outcome, "DENIED");

  const capability = UsageInsightsLocalServiceV1.open(join(root, "capability.json"), 0);
  capability.grant("capability", 0);
  assert.equal(capability.record({ capabilityId: "capability.gateway", lifecycleOutcome: "FIRST_SUCCESS" }, 1).outcome, "ACCEPTED");
  assert.equal(capability.record({ capabilityId: "capability.gateway", lifecycleOutcome: "ERROR" }, 2).outcome, "DENIED");

  const diagnostics = UsageInsightsLocalServiceV1.open(join(root, "diagnostics.json"), 0);
  diagnostics.grant("diagnostics", 0, 100);
  assert.equal(diagnostics.record({ capabilityId: "capability.gateway", lifecycleOutcome: "ERROR" }, 1).outcome, "ACCEPTED");
});

test("AWI-INSIGHTS-1 outbound envelope matches its public closed JSON Schema", async () => {
  const store = join(temporaryRoot(), "state.json");
  const service = UsageInsightsLocalServiceV1.open(store, 0);
  service.grant("basic", 0);
  service.enableSharing("http://127.0.0.1:18080/v1/usage-insights", 0);
  service.record({ capabilityId: "capability.gateway", lifecycleOutcome: "INSTALL_SUCCEEDED" }, 1);
  let captured: UsageInsightsShareEnvelopeV1 | undefined;
  await service.share({
    async share(_endpoint, envelope): Promise<void> { captured = envelope; },
    async delete(): Promise<void> { throw new Error("UNUSED"); },
  }, 2);
  assert.ok(captured);

  const eventSchema = JSON.parse(readFileSync(
    "schemas/contracts/usage-insights-event-v1.schema.json", "utf8",
  )) as object;
  const envelopeSchema = JSON.parse(readFileSync(
    "schemas/contracts/usage-insights-share-envelope-v1.schema.json", "utf8",
  )) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(eventSchema);
  const validate = ajv.compile(envelopeSchema);
  assert.equal(validate(captured), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...captured, prompt: "covert" }), false);
  assert.equal(validate({ ...captured, deletionId: "tenant-acme" }), false);
});

test("AWI-INSIGHTS-1 endpoint policy rejects SSRF, credentials, redirects, DNS, and ambiguous forms", () => {
  assert.equal(
    validateUsageInsightsLoopbackEndpointV1("http://127.0.0.1:18080/v1/usage-insights"),
    "http://127.0.0.1:18080/v1/usage-insights",
  );
  assert.equal(
    validateUsageInsightsLoopbackEndpointV1("http://[::1]:18080/v1/usage-insights"),
    "http://[::1]:18080/v1/usage-insights",
  );
  for (const endpoint of [
    "https://127.0.0.1:18080/v1/usage-insights",
    "http://localhost:18080/v1/usage-insights",
    "http://127.0.0.2:18080/v1/usage-insights",
    "http://169.254.169.254:18080/v1/usage-insights",
    "http://2130706433:18080/v1/usage-insights",
    `http://${String.fromCharCode(117, 115, 101, 114)}:${String.fromCharCode(112, 97, 115, 115)}@127.0.0.1:18080/v1/usage-insights`,
    "http://127.0.0.1:80/v1/usage-insights",
    "http://127.0.0.1:18080/v1/usage-insights?redirect=http://example.invalid",
    "http://127.0.0.1:18080/v1/usage-insights#fragment",
    "http://127.0.0.1:18080/other",
  ]) assert.throws(() => validateUsageInsightsLoopbackEndpointV1(endpoint), /LOOPBACK_ENDPOINT_DENIED/, endpoint);
});

test("AWI-INSIGHTS-1 hostile inputs cannot invoke accessors or enter outbound envelopes", async () => {
  const store = join(temporaryRoot(), "state.json");
  const service = UsageInsightsLocalServiceV1.open(store, 0);
  service.grant("diagnostics", 0, 10_000);
  service.enableSharing("http://127.0.0.1:18080/v1/usage-insights", 0);
  let getterCalls = 0;
  const hostile: Record<string, unknown> = { lifecycleOutcome: "ERROR" };
  Object.defineProperty(hostile, "capabilityId", {
    enumerable: true,
    get() { getterCalls += 1; return "capability.gateway"; },
  });
  assert.equal(service.record(hostile, 1).outcome, "DENIED");
  assert.equal(getterCalls, 0);
  assert.equal(service.record({
    capabilityId: "capability.gateway",
    lifecycleOutcome: "ERROR",
    prompt: "synthetic-private-text",
  }, 2).outcome, "DENIED");
  assert.equal(service.record({ capabilityId: "capability.gateway", lifecycleOutcome: "ERROR" }, 3).outcome, "ACCEPTED");

  let captured: UsageInsightsShareEnvelopeV1 | null = null;
  const transport = {
    async share(_endpoint: string, envelope: UsageInsightsShareEnvelopeV1): Promise<void> {
      captured = envelope;
      throw new Error("SYNTHETIC_RECEIVER_UNAVAILABLE");
    },
    async delete(): Promise<void> { throw new Error("UNUSED"); },
  };
  await assert.rejects(() => service.share(transport, 4), /SYNTHETIC_RECEIVER_UNAVAILABLE/);
  assert.ok(captured !== null);
  const body = canonicalJson(captured);
  assert.equal(body.includes("synthetic-private-text"), false);
  assert.equal(body.includes("127.0.0.1"), false, "endpoint is local policy state, never payload");
  assert.equal(body.includes("tenantId"), false);

  const withPrompt = { ...(captured as UsageInsightsShareEnvelopeV1), prompt: "covert" };
  assert.throws(() => validateUsageInsightsShareEnvelopeV1(withPrompt), /OUTBOUND_ENVELOPE_DENIED/);
  const withIdentifier = structuredClone(captured as UsageInsightsShareEnvelopeV1) as unknown as Record<string, unknown>;
  (withIdentifier.events as Array<Record<string, unknown>>)[0]!.tenantId = "tenant-acme";
  assert.throws(() => validateUsageInsightsShareEnvelopeV1(withIdentifier), /OUTBOUND_ENVELOPE_DENIED/);

  const accessor = structuredClone(captured as UsageInsightsShareEnvelopeV1) as unknown as Record<string, unknown>;
  Object.defineProperty(accessor, "profile", {
    enumerable: true,
    get() { getterCalls += 1; return "diagnostics"; },
  });
  assert.throws(() => validateUsageInsightsShareEnvelopeV1(accessor), /OUTBOUND_ENVELOPE_DENIED/);
  assert.equal(getterCalls, 0);
});

test("AWI-INSIGHTS-1 pending share retry is replay-stable, rotates erase-before-expose, and deletes shared data", async () => {
  const receiver = await startReceiver(true);
  try {
    const store = join(temporaryRoot(), "state.json");
    let service = UsageInsightsLocalServiceV1.open(store, 1_000);
    service.grant("diagnostics", 1_000, 5_000_000);
    service.enableSharing(receiver.endpoint, 1_000);
    service.record({ capabilityId: "capability.gateway", lifecycleOutcome: "ERROR" }, 1_001);
    const oldId = statusView(service.status(1_002)).runtime.installationId;
    await assert.rejects(() => service.share(new UsageInsightsLoopbackTransportV1(), 1_003), /LOOPBACK_TRANSPORT_FAILED/);
    assert.equal(service.status(1_004).pendingShare, true);
    assert.equal(receiver.envelopes.size, 1);

    service = UsageInsightsLocalServiceV1.open(store, 1_005);
    const receipt = await service.share(new UsageInsightsLoopbackTransportV1(), 1_006);
    assert.equal(receiver.postCount, 2);
    assert.equal(receiver.rawBodies[0], receiver.rawBodies[1], "retry sends the exact atomically persisted batch");
    assert.equal(receipt.oldEpochErasedBeforeNewPseudonymExposed, true);
    const after = statusView(service.status(1_007));
    assert.equal(after.runtime.eventCount, 0);
    assert.notEqual(after.runtime.installationId, oldId);
    assert.equal(after.sharedBatchCount, 1);
    service.revoke(1_008);
    assert.throws(() => service.grant("capability", 1_009), /MANAGED_SHARED_DATA_DELETE_REQUIRED/);
    await assert.rejects(() => service.deleteManagedData(undefined, 1_010), /SHARED_DATA_DELETE_REQUIRED/);
    assert.equal(existsSync(store), true);

    const deletion = await service.deleteManagedData(new UsageInsightsLoopbackTransportV1(), 1_011);
    assert.equal(deletion.localStateDeleted, true);
    assert.equal(deletion.sharedBatchesDeleted, 1);
    assert.equal(receiver.envelopes.size, 0);
    assert.deepEqual(receiver.deletionRequests, [receipt.deletionId]);
    assert.equal(existsSync(store), false);
  } finally {
    await closeReceiver(receiver);
  }
});

test("AWI-INSIGHTS-1 five isolated synthetic installations publish all six report families; four are suppressed", async () => {
  const receiver = await startReceiver();
  const services: UsageInsightsLocalServiceV1[] = [];
  try {
    const start = 10_000;
    for (let index = 0; index < 5; index += 1) {
      const service = UsageInsightsLocalServiceV1.open(join(temporaryRoot(), `tenant-${index}.json`), start);
      service.grant("diagnostics", start, 5_000_000);
      service.enableSharing(receiver.endpoint, start);
      recordDiagnostics(service, start);
      services.push(service);
    }
    const ids = services.map((service) => statusView(
      service.status(start + USAGE_INSIGHTS_RETENTION_INTERVAL_MS + 2_006),
    ).runtime.installationId);
    assert.equal(new Set(ids).size, 5, "isolated stores have unlinkable random pseudonyms");
    for (const service of services) {
      await service.share(new UsageInsightsLoopbackTransportV1(), start + USAGE_INSIGHTS_RETENTION_INTERVAL_MS + 2_007);
    }
    const envelopes = [...receiver.envelopes.values()];
    assert.equal(envelopes.length, 5);
    const suppressed = buildUsageInsightsReportV1(envelopes.slice(0, 4), start + 4_000_000);
    assert.equal(suppressed.publicationState, "SUPPRESSED");
    assert.equal(suppressed.installationsSeen, null);
    assert.equal(suppressed.metrics, null);

    const report = buildUsageInsightsReportV1(envelopes, start + 4_000_000);
    assert.equal(report.publicationState, "PUBLISHED");
    assert.equal(report.installationsSeen, 5);
    assert.equal(report.metrics?.installToFirstSuccess.successfulInstallations, 5);
    assert.equal(report.metrics?.retention.retainedInstallations, 5);
    assert.equal(report.metrics?.errors[0]?.distinctInstallations, 5);
    assert.equal(report.metrics?.denials[0]?.distinctInstallations, 5);
    assert.equal(report.metrics?.rollbacks[0]?.distinctInstallations, 5);
    assert.equal(report.metrics?.versionFragmentation.distinctVersions, 1);
    assert.deepEqual(
      buildUsageInsightsReportV1([...envelopes].reverse(), start + 4_000_000),
      report,
      "report is deterministic across receiver ordering",
    );
    const oneSuccess = envelopes.map((envelope, index) => {
      if (index === 0) return envelope;
      const modified = structuredClone(envelope) as unknown as Record<string, unknown>;
      modified.events = (modified.events as Array<{ lifecycleOutcome: string }>).filter(
        (event) => event.lifecycleOutcome !== "FIRST_SUCCESS",
      );
      return redigestEnvelope(modified as unknown as UsageInsightsShareEnvelopeV1);
    });
    assert.equal(
      buildUsageInsightsReportV1(oneSuccess, start + 4_000_000).publicationState,
      "SUPPRESSED",
      "a one-installation success subgroup stays hidden even when the eligible cohort has five",
    );
    const dashboard = renderUsageInsightsDashboardV1(report);
    for (const label of [
      "Install-to-first-success", "Retention", "Errors", "Denials", "Rollbacks", "Version fragmentation",
      "PARTIAL_NON_REPRESENTATIVE_COHORT", "DOES_NOT_REPRESENT_ALL_INSTALLATIONS",
    ]) assert.match(dashboard, new RegExp(label));
  } finally {
    await closeReceiver(receiver);
  }
});

test("AWI-INSIGHTS-1 local store rejects tamper, broad permissions, symlinks, and oversized state", () => {
  const root = temporaryRoot();
  const store = join(root, "state.json");
  const service = UsageInsightsLocalServiceV1.open(store, 0);
  service.grant("basic", 0);
  const original = readFileSync(store, "utf8");

  writeFileSync(store, original.replace('"sharingEnabled":false', '"sharingEnabled":true'), { mode: 0o600 });
  assert.throws(() => UsageInsightsLocalServiceV1.open(store, 1), /INVALID_USAGE_INSIGHTS_LOCAL_STATE/);
  writeFileSync(store, original, { mode: 0o600 });
  chmodSync(store, 0o644);
  assert.throws(() => UsageInsightsLocalServiceV1.open(store, 1), /STORE_SECURITY_DENIED/);

  const link = join(root, "state-link.json");
  chmodSync(store, 0o600);
  symlinkSync(store, link);
  assert.throws(() => UsageInsightsLocalServiceV1.open(link, 1), /STORE_SECURITY_DENIED/);

  const oversized = join(root, "oversized.json");
  writeFileSync(oversized, "x".repeat(4_194_305), { mode: 0o600 });
  assert.throws(() => UsageInsightsLocalServiceV1.open(oversized, 1), /STORE_SECURITY_DENIED/);
});
