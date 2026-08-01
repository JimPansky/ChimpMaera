import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "demo/managed-skill-lifecycle");
const composePath = path.join(fixture, "compose.yaml");
const upstream = "sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c";
function render(profile = false) {
  const args = ["compose"];
  if (profile) args.push("--profile", "aas037");
  args.push("-f", composePath, "config", "--format", "json");
  return JSON.parse(execFileSync("docker", args, {encoding: "utf8"}));
}

test("AAS-037 runtime is default-off and pins the proven OpenClaw image", () => {
  assert.deepEqual(render().services, {});
  const explicit = render(true);
  assert.deepEqual(Object.keys(explicit.services).sort(), ["openclaw-agent", "skill-manager"]);
  const dockerfile = readFileSync(path.join(fixture, "openclaw.Dockerfile"), "utf8");
  assert.match(dockerfile, new RegExp(`^FROM ghcr\\.io/openclaw/openclaw@${upstream}$`, "m"));
  assert.doesNotMatch(dockerfile, /FROM\s+[^\n]*:(?:latest|main|stable)(?:\s|$)/);
  assert.equal(String(explicit.services["openclaw-agent"].build.provenance), "false");
  assert.equal(String(explicit.services["skill-manager"].build.provenance), "false");
});

test("AAS-037 agent is non-root/read-only with a read-only managed skill volume and one closed network", () => {
  const rendered = render(true);
  for (const [name, service] of Object.entries(rendered.services)) {
    assert.equal(service.read_only, true, name);
    assert.deepEqual(service.cap_drop, ["ALL"], name);
    assert.ok(service.security_opt.includes("no-new-privileges:true"), name);
    assert.equal(service.privileged ?? false, false, name);
    assert.deepEqual(Object.keys(service.networks), ["aas037_gateway_only"], name);
    assert.equal(service.ports, undefined, name);
    assert.equal(service.devices, undefined, name);
    assert.ok(service.volumes.every((mount) => mount.type === "volume"), name);
  }
  assert.equal(rendered.networks.aas037_gateway_only.internal, true);
  const agentSkillMount = rendered.services["openclaw-agent"].volumes.find((mount) => mount.target === "/opt/chimpmaera/workspace/skills");
  const managerSkillMount = rendered.services["skill-manager"].volumes.find((mount) => mount.target === "/var/lib/chimpmaera/skills");
  assert.equal(agentSkillMount.read_only, true);
  assert.notEqual(managerSkillMount.read_only, true);
  const managerDockerfile = readFileSync(path.join(fixture, "manager.Dockerfile"), "utf8");
  assert.match(managerDockerfile, /skills\/\.volume-owner/);
  assert.match(managerDockerfile, /chown -R 10001:10001 \/var\/lib\/chimpmaera/);
});

test("AAS-037 runtime contract binds exact package bytes and honest compatibility", () => {
  const contract = JSON.parse(readFileSync(path.join(fixture, "runtime-contract-v1.json"), "utf8"));
  const bytes = readFileSync(path.join(fixture, "fixtures/zoo-greeter/SKILL.md"), "utf8");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), contract.skill.fileDigest);
  assert.deepEqual(contract.skill.requestedCapabilities, []);
  assert.deepEqual(contract.skill.grantedCapabilities, []);
  assert.equal(contract.compatibility.openclaw.materializer, "PROVEN");
  assert.equal(contract.compatibility.hermes.runtime, "UNPROVEN");
  assert.equal(contract.compatibility.claudeCode.runtime, "UNPROVEN");
  assert.equal(contract.nonClaims.length, 4);
});

test("AAS-037 OpenClaw adapter separates request from activate/use and cannot write its store", () => {
  const plugin = readFileSync(path.join(fixture, "plugin/index.mjs"), "utf8");
  const manifest = JSON.parse(readFileSync(path.join(fixture, "plugin/openclaw.plugin.json"), "utf8"));
  assert.deepEqual(manifest.contracts.tools, ["chimpmaera_skill_request", "chimpmaera_skill_activate_use"]);
  assert.match(plugin, /\/v1\/skills\/request/);
  assert.match(plugin, /\/v1\/skills\/activate/);
  assert.match(plugin, /readFile\("\/opt\/chimpmaera\/workspace\/skills\/zoo-greeter\/SKILL\.md"/);
  assert.doesNotMatch(plugin, /writeFile|rename|rmSync|grantedCapabilities:\s*\[[^\]]+\]/);
  const config = JSON.parse(readFileSync(path.join(fixture, "openclaw.json"), "utf8"));
  assert.deepEqual(config.tools.allow, ["chimpmaera_skill_request", "chimpmaera_skill_activate_use"]);
  assert.equal(config.models.providers["cm-skill-fixture"].baseUrl, "http://skill-manager:8080/v1");
});

test("AAS-037 manager and probes cover atomic activation, replay, tenant, mutation and rollback denials", () => {
  const manager = readFileSync(path.join(fixture, "manager.mjs"), "utf8");
  const probe = readFileSync(path.join(fixture, "fixture-probe.mjs"), "utf8");
  for (const marker of [
    "SKILL_REQUEST_CONTRACT_DENIED", "SKILL_CONCURRENT_INSTALL_THROTTLED", "SKILL_REPLAY_CONFLICT_DENIED",
    "SKILL_ACTIVATION_FAILED_ROLLED_BACK", "WORKLOAD_IDENTITY_DENIED", "requestedCapabilities: []",
    "grantedCapabilities: []", "renameSync", "mutable-source", "digest-swap", "self-approval",
    "cross-tenant", "dependency-confusion", "filesystem", "egress",
  ]) assert.match(`${manager}\n${probe}`, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), marker);
  assert.match(manager, /mkdirSync\(tempDir, \{recursive: false, mode: 0o755\}\)/);
  assert.match(manager, /writeFileSync\(`\$\{tempDir\}\/SKILL\.md`, skillBytes, \{mode: 0o444\}\)/);
  assert.doesNotMatch(manager, /mode: 0o(?:666|777)/);
});

test("AAS-037 setup and purge remain ownership-scoped", () => {
  const setup = readFileSync(path.join(fixture, "setup.sh"), "utf8");
  const reset = readFileSync(path.join(fixture, "reset.sh"), "utf8");
  assert.match(setup, /config --services/);
  assert.match(setup, /--provenance=false/);
  assert.match(setup, /io\.chimpmaera\.fixture\.source-sha256/);
  assert.match(reset, /io\.chimpmaera\.fixture/);
  assert.match(reset, /owned \$kind residue remains after purge/);
  assert.doesNotMatch(`${setup}\n${reset}`, /systemctl|pkill|killall|\/var\/run\/docker\.sock|openclaw gateway --port 18789/);
});
