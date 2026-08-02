import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "demo/builder-agent");
const composePath = path.join(fixture, "compose.yaml");
const expectedDigest = "sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function render(profile = false) {
  const args = ["compose"];
  if (profile) args.push("--profile", "bld001");
  args.push("-f", composePath, "config", "--format", "json");
  return JSON.parse(execFileSync("docker", args, { encoding: "utf8" }));
}

test("BLD-001-G6 remains default-off and pins the real OpenClaw fixture image", () => {
  assert.deepEqual(render().services, {});
  const explicit = render(true);
  assert.deepEqual(Object.keys(explicit.services).sort(), ["builder-agent", "builder-gateway"]);
  const dockerfile = readFileSync(path.join(fixture, "openclaw.Dockerfile"), "utf8");
  assert.match(dockerfile, new RegExp(`^FROM ghcr\\.io/openclaw/openclaw@${expectedDigest}$`, "m"));
  assert.doesNotMatch(dockerfile, /FROM\s+[^\n]*:(?:latest|main|stable)(?:\s|$)/);
  assert.equal(String(explicit.services["builder-agent"].build.provenance), "false");
  assert.equal(String(explicit.services["builder-gateway"].build.provenance), "false");
});

test("BLD-001-G6 services are non-root, read-only, unprivileged and closed-network only", () => {
  const rendered = render(true);
  for (const [name, service] of Object.entries(rendered.services)) {
    assert.equal(service.read_only, true, name);
    assert.deepEqual(service.cap_drop, ["ALL"], name);
    assert.ok(service.security_opt.includes("no-new-privileges:true"), name);
    assert.equal(service.privileged ?? false, false, name);
    assert.ok(Number(service.pids_limit) > 0, name);
    assert.ok(Number(service.mem_limit) > 0, name);
    assert.deepEqual(Object.keys(service.networks), ["bld001_gateway_only"], name);
    assert.equal(service.ports, undefined, name);
    assert.equal(service.devices, undefined, name);
    assert.equal(service.pid, undefined, name);
    assert.equal(service.ipc, undefined, name);
    assert.ok(service.volumes.every((mount) => mount.type === "volume"), name);
  }
  assert.equal(rendered.services["builder-agent"].user, "1000:1000");
  assert.equal(rendered.services["builder-gateway"].user, "10001:10001");
  assert.equal(rendered.networks.bld001_gateway_only.internal, true);
});

test("BLD-001-G6 binds owner sovereignty, admitted generic capabilities and recovery", () => {
  const contract = JSON.parse(readFileSync(path.join(fixture, "runtime-contract-v1.json"), "utf8"));
  const profile = contract.builderProfile;
  assert.equal(profile.selected, "SAFE_GUIDED");
  assert.equal(profile.effectiveRightsRule, "HOST_SYSTEM_CEILING_INTERSECT_OWNER_PROFILE_INTERSECT_ASSIGNMENTS_INTERSECT_CURRENT_CONSTRAINTS");
  assert.deepEqual(profile.effectiveRights, ["habitat.setpoint.update", "habitat.temperature.read"]);
  for (const right of profile.effectiveRights) {
    assert.ok(profile.hostSystemCeiling.includes(right));
    assert.ok(profile.ownerProfileRights.includes(right));
    assert.ok(profile.assignments.includes(right));
    assert.ok(profile.currentConstraints.includes(right));
  }
  const read = contract.admittedCapabilities.find(({ capabilityId }) => capabilityId === "habitat.temperature.read");
  const write = contract.admittedCapabilities.find(({ capabilityId }) => capabilityId === "habitat.setpoint.update");
  assert.equal(read.capabilityBindingDigest, "45b5cd2f099919bc57ae4f5b23e6b4b225522ad8d796454f87ce87cce9e3c654");
  assert.equal(read.route, "AUTO_EXECUTE");
  assert.equal(write.route, "OWNER_APPROVAL");
  assert.equal(write.effectClass, "REVERSIBLE_WRITE");
  assert.equal(write.admissionRecord.recovery, "RESTORE_PRIOR_VALUE");
  assert.equal(digest(write.admissionRecord), write.capabilityBindingDigest);
  const approvalCore = structuredClone(contract.syntheticOwnerApprovals[0]);
  delete approvalCore.approvalDigest;
  assert.equal(digest(approvalCore), contract.syntheticOwnerApprovals[0].approvalDigest);
  assert.equal(contract.target.dataClassification, "SYNTHETIC");
  assert.equal(contract.nonClaims.length, 5);
});

test("BLD-001-G6 OpenClaw exposes one generic Builder tool and no direct target route", () => {
  const manifest = JSON.parse(readFileSync(path.join(fixture, "plugin/openclaw.plugin.json"), "utf8"));
  assert.deepEqual(manifest.contracts.tools, ["chimpmaera_builder_request"]);
  const config = JSON.parse(readFileSync(path.join(fixture, "openclaw.json"), "utf8"));
  assert.deepEqual(config.tools.allow, ["chimpmaera_builder_request"]);
  assert.deepEqual(Object.keys(config.models.providers), ["cm-builder-fixture"]);
  assert.equal(config.models.providers["cm-builder-fixture"].baseUrl, "http://builder-gateway:8080/v1");
  const plugin = readFileSync(path.join(fixture, "plugin/index.mjs"), "utf8");
  assert.match(plugin, /SYNTHETIC_READ_NO_CHANGE_VERIFIED/);
  assert.match(plugin, /SYNTHETIC_REVERSIBLE_WRITE_ROLLBACK_VERIFIED/);
  assert.match(plugin, /finalDigest !== receipt\?\.beforeDigest/);
  assert.doesNotMatch(plugin, /systemctl|docker\.sock|child_process|execFile|spawn\(/);
});

test("BLD-001-G6 Gateway performs persisted effect readback before exact rollback", () => {
  const gateway = readFileSync(path.join(fixture, "gateway.mjs"), "utf8");
  const core = readFileSync(path.join(fixture, "builder-core.mjs"), "utf8");
  assert.match(gateway, /createBuilderCore\(\{ contract, workloadIdentity, loadState: load, persistState: persist \}\)/);
  assert.match(core, /state\.target\[adapter\.stateField\] = value\.payload\[adapter\.payloadField\];\n\s+persistState\(state\)/);
  assert.match(core, /effectReadback = loadState\(\)\.target/);
  assert.match(core, /finally \{/);
  assert.match(core, /state\.target\[adapter\.stateField\] = priorValue;\n\s+persistState\(state\)/);
  assert.match(core, /ROLLBACK_MISMATCH_DENIED/);
  assert.match(core, /initialTargetDigest === currentTargetDigest \? 0 : 1/);
  assert.match(core, /CAPABILITY_NOT_ADMITTED_DENIED/);
  assert.match(core, /OWNER_ROUTE_BINDING_DENIED/);
  assert.match(core, /RUNTIME_EFFECTIVE_RIGHTS_INVALID/);
  assert.match(core, /RUNTIME_OWNER_APPROVAL_INVALID/);
});

test("BLD-001-G6 setup, smoke and purge stay ownership-scoped and resumable", () => {
  const setup = readFileSync(path.join(fixture, "setup.sh"), "utf8");
  const reset = readFileSync(path.join(fixture, "reset.sh"), "utf8");
  const smoke = readFileSync(path.join(fixture, "smoke.sh"), "utf8");
  const probe = readFileSync(path.join(fixture, "fixture-probe.mjs"), "utf8");
  assert.match(setup, /config --services/);
  assert.match(setup, /--provenance=false/);
  assert.match(setup, /io\.chimpmaera\.fixture\.source-sha256/);
  assert.match(reset, /refusing to remove unowned image/);
  assert.match(reset, /owned .* residue remains after purge/);
  assert.doesNotMatch(`${setup}\n${reset}`, /systemctl|pkill|killall|docker prune|\/var\/run\/docker\.sock/);
  for (const marker of [
    "wrong-identity", "cross-tenant", "unknown-capability", "binding-tamper",
    "approval-missing", "post-approval-mutation", "route-bypass", "filesystem",
    "egress", "replay", "agent-read-e2e", "agent-write-e2e", "evidence-after-reset",
    "semantic-reset-idempotent", "owner_fingerprint", "ownedRuntimeResidue",
  ]) assert.match(`${smoke}\n${probe}`, new RegExp(marker));
  assert.match(smoke, /reset\.sh" --purge/);
  assert.match(smoke, /receiptDigests \| length == 2/);
  assert.match(smoke, /ownedTargetDrift == 0/);
});
