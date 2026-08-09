import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "demo/openclaw-agent");
const composePath = path.join(fixture, "compose.yaml");
const expectedDigest = "sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c";

function render(profile = false, environment = process.env) {
  const args = ["compose"];
  if (profile) args.push("--profile", "aas035");
  args.push("-f", composePath, "config", "--format", "json");
  return JSON.parse(execFileSync("docker", args, { encoding: "utf8", env: environment }));
}

test("AAS-035 default-off profile and immutable OpenClaw image lock", () => {
  assert.deepEqual(render().services, {});
  const explicit = render(true);
  assert.deepEqual(Object.keys(explicit.services).sort(), ["capability-gateway", "openclaw-agent"]);
  const dockerfile = readFileSync(path.join(fixture, "openclaw.Dockerfile"), "utf8");
  assert.match(dockerfile, new RegExp(`^FROM ghcr\\.io/openclaw/openclaw@${expectedDigest}$`, "m"));
  assert.doesNotMatch(dockerfile, /FROM\s+[^\n]*:(?:latest|main|stable)(?:\s|$)/);
  assert.equal(String(explicit.services["openclaw-agent"].build.provenance), "false");
  assert.equal(String(explicit.services["capability-gateway"].build.provenance), "false");
  assert.equal(explicit.services["openclaw-agent"].platform, "linux/amd64");
  assert.equal(explicit.services["capability-gateway"].platform, "linux/amd64");
  const conflicting = render(true, { ...process.env, DOCKER_DEFAULT_PLATFORM: "linux/arm64" });
  assert.equal(conflicting.services["openclaw-agent"].platform, "linux/amd64");
  assert.equal(conflicting.services["capability-gateway"].platform, "linux/amd64");
});

test("AAS-035 non-root read-only bounded posture has one closed network", () => {
  const rendered = render(true);
  for (const [name, service] of Object.entries(rendered.services)) {
    assert.equal(service.read_only, true, name);
    assert.deepEqual(service.cap_drop, ["ALL"], name);
    assert.ok(service.security_opt.includes("no-new-privileges:true"), name);
    assert.equal(service.privileged ?? false, false, name);
    assert.ok(Number(service.pids_limit) > 0, name);
    assert.ok(Number(service.mem_limit) > 0, name);
    assert.deepEqual(Object.keys(service.networks), ["aas035_gateway_only"], name);
    assert.equal(service.ports, undefined, name);
    assert.equal(service.devices, undefined, name);
    assert.equal(service.pid, undefined, name);
    assert.equal(service.ipc, undefined, name);
    assert.ok(service.volumes.every((mount) => mount.type === "volume"), name);
  }
  assert.equal(rendered.services["openclaw-agent"].user, "1000:1000");
  assert.equal(rendered.services["capability-gateway"].user, "10001:10001");
  assert.equal(rendered.networks.aas035_gateway_only.internal, true);
});

test("AAS-035 identity, managed mind and typed tool surfaces are finite", () => {
  const contract = JSON.parse(readFileSync(path.join(fixture, "runtime-contract-v1.json"), "utf8"));
  assert.equal(contract.workload.identity, "workload:aas035-openclaw-agent-v1");
  assert.equal(contract.runtime.network, "aas035_gateway_only");
  assert.equal(contract.mindStore.maxEntries, 16);
  assert.equal(contract.mindStore.maxValueBytes, 2048);
  assert.equal(contract.mindStore.maxTotalBytes, 16384);
  assert.equal(contract.nonClaims.length, 4);
  const workloadContract = JSON.parse(readFileSync(path.join(fixture, "gateway-workload-contract-v2.json"), "utf8"));
  assert.equal(workloadContract.schemaVersion, "chimpmaera.openclaw/gateway-workload-contract/v2");
  assert.equal(workloadContract.clock.maxTtlSeconds, 60);
  assert.equal(workloadContract.networkPolicy.default, "DENY");
  assert.equal(workloadContract.networkPolicy.egress.allow.length, 1);
  assert.deepEqual(workloadContract.identity.scope, ["capability:crm.contact.create"]);
  assert.equal(workloadContract.credentialPolicy.liveCredentials, false);
  const manifest = JSON.parse(readFileSync(path.join(fixture, "plugin/openclaw.plugin.json"), "utf8"));
  assert.deepEqual(manifest.contracts.tools, ["chimpmaera_capability_request"]);
  const config = JSON.parse(readFileSync(path.join(fixture, "openclaw.json"), "utf8"));
  assert.deepEqual(config.tools.allow, ["chimpmaera_capability_request"]);
  assert.deepEqual(Object.keys(config.models.providers), ["cm-fixture"]);
  assert.equal(config.models.providers["cm-fixture"].baseUrl, "http://capability-gateway:8080/v1");
  const workspaceState = JSON.parse(readFileSync(path.join(fixture, "workspace/openclaw-workspace-state.json"), "utf8"));
  assert.equal(workspaceState.version, 1);
  assert.match(workspaceState.setupCompletedAt, /^2026-08-01T/);
  for (const name of ["AGENTS.md", "SOUL.md", "TOOLS.md", "IDENTITY.md", "USER.md", "HEARTBEAT.md"]) {
    assert.ok(readFileSync(path.join(fixture, `workspace/${name}`), "utf8").length > 20, name);
  }
});

test("AAS-035 setup and rollback stay ownership-scoped", () => {
  const setup = readFileSync(path.join(fixture, "setup.sh"), "utf8");
  const reset = readFileSync(path.join(fixture, "reset.sh"), "utf8");
  assert.match(setup, /config --services/);
  assert.match(setup, /verify-openclaw-agent-runtime-lock\.mjs/);
  assert.ok(
    setup.indexOf("verify-openclaw-agent-runtime-lock.mjs") < setup.indexOf("docker info"),
    "offline provenance verification must precede Docker runtime access",
  );
  assert.ok(
    setup.indexOf("verify-openclaw-agent-runtime-lock.mjs") < setup.indexOf('source "$cm_aas035_setup_dir/lib.sh"'),
    "offline provenance verification must precede executable fixture helper loading",
  );
  assert.match(setup, /cm_aas035_verified_root="\$\(cd -- "\$cm_aas035_setup_dir\/\.\.\/\.\." && pwd\)"/);
  assert.match(setup, /verified repository root changed while loading fixture helper/);
  assert.match(setup, /--provenance=false/);
  assert.match(setup, /--platform "\$cm_aas035_platform"/);
  assert.match(setup, /conflicting DOCKER_DEFAULT_PLATFORM denied/);
  assert.match(setup, /io\.chimpmaera\.fixture\.source-sha256/);
  assert.match(setup, /io\.chimpmaera\.upstream\.index-digest/);
  assert.match(reset, /io\.chimpmaera\.fixture/);
  assert.match(reset, /owned .* residue remains after purge/);
  assert.doesNotMatch(`${setup}\n${reset}`, /openclaw gateway --port 18789|systemctl|pkill|killall|\/var\/run\/docker\.sock/);
});

test("AAS-035 smoke records the complete denial and lifecycle matrix", () => {
  const smoke = readFileSync(path.join(fixture, "smoke.sh"), "utf8");
  const probe = readFileSync(path.join(fixture, "fixture-probe.mjs"), "utf8");
  for (const marker of [
    "wrong-identity", "unknown-action", "route-bypass", "cross-tenant",
    "oversize", "filesystem", "egress", "replay", "mind-write", "mind-read",
    "gateway-v2", "identity-missing", "identity-expired", "identity-wrong-audience",
    "identity-wrong-tenant", "identity-replay", "semantic-reset-idempotent",
    "owner_fingerprint", "ownedRuntimeResidue",
  ]) assert.match(`${smoke}\n${probe}`, new RegExp(marker));
  assert.match(smoke, /for index in 1 2 3 4/);
  assert.match(smoke, /fixture-probe\.mjs replay/);
  assert.match(smoke, /idempotent setup recreated the OpenClaw container/);
  assert.match(smoke, /effects == 1/);
  assert.match(smoke, /reset\.sh" --purge/);
});
