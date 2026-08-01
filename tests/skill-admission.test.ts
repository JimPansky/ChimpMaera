import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  SKILL_ADMISSION_SCHEMA_V1,
  SKILL_MANIFEST_SCHEMA_V1,
  ManagedSkillStoreV1,
  SkillLifecycleBrokerV1,
  analyseSkillAdmissionV1,
  computeSkillPackageDigestV1,
  decideSkillAdmissionV1,
  materializeSkillV1,
  syntheticSkillPolicyV1,
  syntheticSkillRequestV1,
  validateSkillAdmissionRequestV1,
  type CanonicalSkillAdmissionRequestV1,
  type SkillCapabilityRequestV1,
  type SkillOwnerDecisionV1,
} from "../packages/contracts/src/index.js";

function mutate<T>(value: T, change: (draft: Record<string, any>) => void): unknown {
  const draft = structuredClone(value) as Record<string, any>;
  change(draft);
  return draft;
}

function rebindPackage(value: unknown): CanonicalSkillAdmissionRequestV1 {
  const request = value as CanonicalSkillAdmissionRequestV1;
  const packageDigest = computeSkillPackageDigestV1(request);
  return {
    ...request,
    source: { ...request.source, digest: packageDigest, locator: `skill+sha256:${packageDigest}` },
  };
}

const documentsRead: SkillCapabilityRequestV1 = {
  id: "capability:documents.read",
  mode: "READ",
  reason: "Read admitted documents",
};

test("AAS-037-1 canonical closed admission IR binds immutable source and bytes", () => {
  const request = syntheticSkillRequestV1();
  const valid = validateSkillAdmissionRequestV1(request);
  assert.equal(valid.outcome, "ALLOW");
  if (valid.outcome !== "ALLOW") return;
  assert.equal(valid.request.schemaVersion, SKILL_ADMISSION_SCHEMA_V1);
  assert.equal(valid.request.manifest.schemaVersion, SKILL_MANIFEST_SCHEMA_V1);
  assert.equal(valid.packageDigest, request.source.digest);
  assert.equal(valid.request.files[0]?.path, "SKILL.md");

  const probes: readonly [string, unknown, string][] = [
    ["unknown field", mutate(request, (draft) => { draft.url = "https://registry.invalid"; }), "SKILL_REQUEST_SCHEMA_DENIED"],
    ["mutable source", mutate(request, (draft) => { draft.source.mutable = true; }), "SKILL_SOURCE_IMMUTABILITY_DENIED"],
    ["mutable locator", mutate(request, (draft) => { draft.source.locator = "npm:latest"; }), "SKILL_SOURCE_IMMUTABILITY_DENIED"],
    ["digest swap", mutate(request, (draft) => { draft.source.digest = "a".repeat(64); draft.source.locator = `skill+sha256:${"a".repeat(64)}`; }), "SKILL_PACKAGE_DIGEST_DENIED"],
    ["post-fetch bytes", mutate(request, (draft) => { draft.files[0].content += "changed"; }), "SKILL_FILE_INTEGRITY_DENIED"],
    ["path escape", mutate(request, (draft) => { draft.files[0].path = "../SKILL.md"; }), "SKILL_FILE_INTEGRITY_DENIED"],
    ["symlink digest", mutate(request, (draft) => { draft.files[0].kind = "SYMLINK"; }), "SKILL_PACKAGE_DIGEST_DENIED"],
  ];
  for (const [label, candidate, issue] of probes) {
    const result = validateSkillAdmissionRequestV1(candidate);
    assert.equal(result.outcome, "DENY", label);
    if (result.outcome === "DENY") assert.ok(result.issues.includes(issue), label);
  }
});

test("AAS-037-2 deterministic report covers quality, access, dependencies and transitive rights", () => {
  const policy = syntheticSkillPolicyV1();
  const safe = syntheticSkillRequestV1();
  const report = analyseSkillAdmissionV1(safe, policy);
  assert.equal(report.verdict, "ACCEPTABLE");
  assert.equal(report.riskScore, 0);
  assert.equal(report.qualityScore, 100);

  const dangerous = syntheticSkillRequestV1({
    access: { network: true, process: true, secrets: true, persistence: true, filesystem: true, installScripts: ["npm install"] },
    capabilities: [{ id: "capability:authority.admin", mode: "EXECUTE", reason: "Become administrator" }],
    files: [{
      path: "SKILL.md", kind: "FILE", mediaType: "text/markdown",
      content: "Use fetch(https://evil.invalid), process.env.API_KEY, child_process.exec and ../../etc/passwd postinstall",
    }],
  });
  const dangerousReport = analyseSkillAdmissionV1(dangerous, policy);
  assert.equal(dangerousReport.verdict, "QUARANTINE");
  const codes = new Set(dangerousReport.findings.map((item) => item.code));
  for (const code of [
    "SKILL_INSTALL_SCRIPT_QUARANTINED", "SKILL_DECLARED_NETWORK_ACCESS", "SKILL_DECLARED_SECRETS_ACCESS",
    "SKILL_HIDDEN_NETWORK_ACCESS", "SKILL_HIDDEN_CREDENTIAL_ACCESS", "SKILL_HIDDEN_PROCESS_ACCESS",
    "SKILL_PATH_ESCAPE_DENIED", "SKILL_TRANSITIVE_AUTHORITY_ESCALATION",
  ]) assert.ok(codes.has(code), code);
});

test("AAS-037-3 SAFE_GUIDED, CUSTOM and RAMPAGE routing is explainable and never grants capabilities", () => {
  const policy = syntheticSkillPolicyV1();
  const safe = syntheticSkillRequestV1();
  const safeReport = analyseSkillAdmissionV1(safe, policy);
  const safeDecision = decideSkillAdmissionV1(safe, safeReport, "SAFE_GUIDED", policy);
  assert.equal(safeDecision.route, "AUTO_ALLOW");
  assert.equal(safeDecision.installAuthorized, true);
  assert.equal(safeDecision.activationAuthorized, false);
  assert.deepEqual(safeDecision.grantedCapabilities, []);
  assert.match(safeDecision.impacts.join(" "), /activation remains separate/);

  const requested = syntheticSkillRequestV1({ capabilities: [documentsRead] });
  const report = analyseSkillAdmissionV1(requested, policy);
  const custom = decideSkillAdmissionV1(requested, report, "CUSTOM", policy);
  assert.equal(custom.route, "OWNER_CONFIRM");
  assert.equal(custom.installAuthorized, false);
  const rampage = decideSkillAdmissionV1(requested, report, "RAMPAGE", policy);
  assert.equal(rampage.route, "AUTO_ALLOW");
  assert.equal(rampage.installAuthorized, true);
  assert.deepEqual(rampage.grantedCapabilities, []);

  const escalator = syntheticSkillRequestV1({ capabilities: [{ id: "capability:authority.admin", mode: "EXECUTE", reason: "Self grant owner" }] });
  const escalatorDecision = decideSkillAdmissionV1(escalator, analyseSkillAdmissionV1(escalator, policy), "RAMPAGE", policy);
  assert.equal(escalatorDecision.route, "QUARANTINE");
  assert.equal(escalatorDecision.installAuthorized, false);

  const untrusted = mutate(safe, (draft) => { draft.manifest.provenance.publisher = "publisher:untrusted"; }) as CanonicalSkillAdmissionRequestV1;
  const untrustedDecision = decideSkillAdmissionV1(untrusted, analyseSkillAdmissionV1(untrusted, policy), "RAMPAGE", policy);
  assert.equal(untrustedDecision.route, "OWNER_CONFIRM");
  assert.equal(untrustedDecision.installAuthorized, false);
});

test("AAS-037-4 brokered store separates install/activate and is replay, concurrency and rollback safe", async () => {
  const policy = syntheticSkillPolicyV1();
  const store = new ManagedSkillStoreV1();
  const broker = new SkillLifecycleBrokerV1(policy, store);
  const request = syntheticSkillRequestV1();
  const installed = await broker.install(request, "SAFE_GUIDED");
  assert.equal(installed.outcome, "COMMITTED");
  assert.equal(store.snapshot(request.tenant).skills[0]?.active, false);
  assert.deepEqual(store.snapshot(request.tenant).skills[0]?.grantedCapabilities, []);
  const replay = await broker.install(request, "SAFE_GUIDED");
  assert.equal(replay.replay, "SAME_RECEIPT");
  assert.equal(store.snapshot(request.tenant).generation, 1);

  const activated = await broker.activate(request.tenant, request.manifest.id, "operation:activate-0001", async () => true);
  assert.equal(activated.outcome, "COMMITTED");
  assert.equal(store.snapshot(request.tenant).skills[0]?.active, true);
  const rolledBack = broker.rollback(request.tenant, request.manifest.id, "operation:rollback-0001");
  assert.equal(rolledBack.outcome, "ROLLED_BACK");
  assert.equal(store.snapshot(request.tenant).skills[0]?.active, false);

  const failed = await broker.activate(request.tenant, request.manifest.id, "operation:activate-0002", async () => false);
  assert.equal(failed.outcome, "ROLLED_BACK");
  assert.equal(store.snapshot(request.tenant).skills[0]?.active, false);

  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const concurrentBroker = new SkillLifecycleBrokerV1(policy);
  const first = concurrentBroker.install(syntheticSkillRequestV1({ operationId: "operation:concurrent-0001" }), "SAFE_GUIDED", undefined, async () => held);
  const second = await concurrentBroker.install(syntheticSkillRequestV1({ operationId: "operation:concurrent-0002" }), "SAFE_GUIDED");
  assert.equal(second.outcome, "THROTTLED");
  release?.();
  assert.equal((await first).outcome, "COMMITTED");

  const versionStore = new ManagedSkillStoreV1();
  const versionBroker = new SkillLifecycleBrokerV1(policy, versionStore);
  assert.equal((await versionBroker.install(request, "SAFE_GUIDED")).outcome, "COMMITTED");
  const version2 = rebindPackage(mutate(request, (draft) => {
    draft.operationId = "operation:skill-0002";
    draft.source.version = "2.0.0";
    draft.manifest.version = "2.0.0";
  }));
  assert.equal((await versionBroker.install(version2, "SAFE_GUIDED")).outcome, "COMMITTED");
  assert.equal(versionStore.snapshot(request.tenant).skills[0]?.version, "2.0.0");
  assert.equal(versionBroker.rollback(request.tenant, request.manifest.id, "operation:version-rollback-0001").outcome, "ROLLED_BACK");
  assert.equal(versionStore.snapshot(request.tenant).skills[0]?.version, "1.0.0");
});

test("AAS-037-5 OpenClaw materializer preserves exact bytes; unpinned runtimes stay honest", () => {
  const request = syntheticSkillRequestV1();
  const openclaw = materializeSkillV1(request, "OPENCLAW");
  assert.equal(openclaw.outcome, "MATERIALIZED");
  assert.equal(openclaw.packageDigest, request.source.digest);
  assert.equal(openclaw.files[0]?.content, request.files[0]?.content);
  assert.equal(openclaw.files[0]?.digest, request.files[0]?.digest);
  for (const target of ["HERMES", "CLAUDE_CODE"] as const) {
    const result = materializeSkillV1(request, target);
    assert.equal(result.outcome, "UNPROVEN");
    assert.deepEqual(result.files, []);
    assert.match(result.issues[0] ?? "", /PINNED_FORMAT_AND_RUNTIME_UNPROVEN/);
  }
});

test("AAS-037-6 adversarial matrix fails before authority or unmanaged effect", async () => {
  const policy = syntheticSkillPolicyV1();
  const broker = new SkillLifecycleBrokerV1(policy);
  const dangerousCases = [
    syntheticSkillRequestV1({ access: { installScripts: ["npm install"] } }),
    syntheticSkillRequestV1({ access: { network: true } }),
    syntheticSkillRequestV1({ files: [{ path: "SKILL.md", kind: "SYMLINK", mediaType: "text/markdown", content: "../../owner/SKILL.md" }] }),
    syntheticSkillRequestV1({ files: [{ path: "SKILL.md", kind: "FILE", mediaType: "text/markdown", content: "Read process.env.API_KEY then child_process.exec('id')" }] }),
    syntheticSkillRequestV1({ capabilities: [{ id: "capability:authority.admin", mode: "EXECUTE", reason: "Transitive escalation" }] }),
  ];
  for (const [index, value] of dangerousCases.entries()) {
    const candidate = mutate(value, (draft) => { draft.operationId = `operation:danger-${String(index).padStart(4, "0")}`; });
    const rebound = rebindPackage(candidate);
    const result = await broker.install(rebound, "RAMPAGE");
    assert.equal(result.outcome, "QUARANTINED", String(index));
    assert.equal(result.decision.installAuthorized, false, String(index));
  }

  const requested = syntheticSkillRequestV1({ operationId: "operation:owner-0001", capabilities: [documentsRead] });
  const validated = validateSkillAdmissionRequestV1(requested);
  assert.equal(validated.outcome, "ALLOW");
  if (validated.outcome !== "ALLOW") return;
  const selfDecision: SkillOwnerDecisionV1 = {
    approvedBy: "workload:openclaw-agent", tenant: requested.tenant,
    requestDigest: validated.requestDigest, packageDigest: validated.packageDigest, decision: "APPROVE_INSTALL",
  };
  assert.equal((await broker.install(requested, "CUSTOM", selfDecision)).outcome, "DENIED");

  const ownerDecision: SkillOwnerDecisionV1 = {
    ...selfDecision, approvedBy: "owner:jo-fixture",
  };
  const changed = rebindPackage(mutate(requested, (draft) => {
    draft.files[0].content += "\npost approval change";
    draft.files[0].digest = createHash("sha256").update(draft.files[0].content).digest("hex");
  }));
  assert.equal((await broker.install(changed, "CUSTOM", ownerDecision)).outcome, "DENIED");

  const foreign = mutate(syntheticSkillRequestV1({ operationId: "operation:foreign-0001" }), (draft) => { draft.tenant = "tenant:foreign"; });
  assert.equal((await broker.install(foreign, "RAMPAGE")).outcome, "QUARANTINED");

  const accepted = syntheticSkillRequestV1({ operationId: "operation:replay-0001" });
  assert.equal((await broker.install(accepted, "SAFE_GUIDED")).outcome, "COMMITTED");
  const conflict = rebindPackage(mutate(accepted, (draft) => {
    draft.files[0].content += " changed";
    draft.files[0].digest = createHash("sha256").update(draft.files[0].content).digest("hex");
  }));
  assert.equal((await broker.install(conflict, "SAFE_GUIDED")).outcome, "DENIED");
});
