import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "demo/model-access-broker");
const compose = path.join(fixture, "compose.yaml");
const render = (profile = false) => {
  const args = ["compose"];
  if (profile) args.push("--profile", "aas036");
  args.push("-f", compose, "config", "--format", "json");
  return JSON.parse(execFileSync("docker", args, { encoding: "utf8" }));
};

test("AAS-036-6/8 runtime is default-off, pinned, isolated and rollback scoped", () => {
  assert.deepEqual(render().services, {});
  const value = render(true);
  assert.deepEqual(Object.keys(value.services).sort(), ["capability-gateway", "model-access-broker", "openclaw-agent", "synthetic-provider"]);
  assert.equal(value.networks.agent_frontdoor.internal, true);
  assert.equal(value.networks.broker_only.internal, true);
  assert.equal(value.networks.provider_only.internal, true);
  assert.deepEqual(Object.keys(value.services["openclaw-agent"].networks), ["agent_frontdoor"]);
  assert.deepEqual(Object.keys(value.services["capability-gateway"].networks).sort(), ["agent_frontdoor", "broker_only"]);
  assert.deepEqual(Object.keys(value.services["model-access-broker"].networks).sort(), ["broker_only", "provider_only"]);
  assert.deepEqual(Object.keys(value.services["synthetic-provider"].networks), ["provider_only"]);
  for (const [name, service] of Object.entries(value.services)) {
    assert.equal(service.read_only, true, name);
    assert.deepEqual(service.cap_drop, ["ALL"], name);
    assert.ok(service.security_opt.includes("no-new-privileges:true"), name);
    assert.equal(service.privileged ?? false, false, name);
    assert.equal(service.ports, undefined, name);
    assert.equal(service.devices, undefined, name);
    assert.ok((service.volumes ?? []).every((mount) => mount.type === "volume"), name);
    assert.equal(service.build.args.CM_AAS036_SOURCE_SHA256, "unbuilt", name);
  }
  const openclaw = readFileSync(path.join(fixture, "openclaw.Dockerfile"), "utf8");
  assert.match(openclaw, /^FROM ghcr\.io\/openclaw\/openclaw@sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c$/m);
  const reset = readFileSync(path.join(fixture, "reset.sh"), "utf8");
  assert.match(reset, /io\.chimpmaera\.aas036\.fixture=model-broker-v1/);
  assert.doesNotMatch(reset, /systemctl|pkill|killall|gateway --port 18789|\/var\/run\/docker\.sock/);
});

test("AAS-036-6/7 runtime implements closed frontdoor/broker/provider and negative probes", () => {
  const frontdoor = readFileSync(path.join(fixture, "frontdoor.mjs"), "utf8");
  const broker = readFileSync(path.join(fixture, "broker.mjs"), "utf8");
  const provider = readFileSync(path.join(fixture, "provider.mjs"), "utf8");
  const probe = readFileSync(path.join(fixture, "fixture-probe.mjs"), "utf8");
  const contract = JSON.parse(readFileSync(path.join(fixture, "runtime-contract-v1.json"), "utf8"));
  assert.match(frontdoor, /model-access-broker:8081\/v1\/model\/invoke/);
  assert.doesNotMatch(frontdoor, /synthetic-provider:8082/);
  assert.match(broker, /contract\.route\.providerUrl/);
  assert.equal(contract.route.providerUrl, "http://synthetic-provider:8082/v1/chat/completions");
  assert.match(broker, /UNTRUSTED_MODEL_OUTPUT/);
  assert.match(broker, /rawContentStored: false/);
  assert.match(provider, /PROVIDER_CREDENTIAL_DENIED/);
  for (const marker of ["tool-smuggle", "malformed", "oversized", "replay-conflict", "cross-tenant", "unknown-route", "timeout", "direct-paths", "secret-leak", "injection"]) assert.match(probe, new RegExp(marker));
});
