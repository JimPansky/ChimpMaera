import { readFile, writeFile } from "node:fs/promises";

const base = "http://skill-manager:8080";
const identity = "workload:openclaw-agent";
const headers = {"content-type": "application/json", "x-cm-workload-identity": identity};
const packageDigest = "faf26ff2d3176a0a05e427bfe1fdcead61f9017856c6a335bc13abcd6294b927";
const installRequest = {
  schemaVersion: "chimpmaera.aas037/skill-request/v1",
  operationId: "aas037-openclaw-install-0001",
  tenant: "tenant:panskys-zoo",
  requester: identity,
  source: {kind: "LOCAL_CONTENT", locator: `skill+sha256:${packageDigest}`, version: "1.0.0", digest: packageDigest, mutable: false},
  skill: {id: "skill:zoo-greeter", version: "1.0.0", fileDigest: "4a16a8e922db2a196bb47b7806dee7e777f116e99a25c9eb76e88b79ac4867a7"},
  requestedCapabilities: [],
};
const activationRequest = {schemaVersion: "chimpmaera.aas037/skill-activation/v1", operationId: "aas037-openclaw-activate-0001", tenant: "tenant:panskys-zoo", skillId: "skill:zoo-greeter", packageDigest};

async function request(path, options = {}) { return fetch(`${base}${path}`, {...options, signal: AbortSignal.timeout(10_000)}); }
async function parse(response) { return {response, value: await response.json()}; }
async function pass(path, options) {
  const {response, value} = await parse(await request(path, options));
  if (!response.ok || value.status !== "PASS") throw new Error(`EXPECTED_PASS_${response.status}_${JSON.stringify(value)}`);
  return value;
}
async function deny(path, options, code, expectedStatus = 403) {
  const {response, value} = await parse(await request(path, options));
  if (response.status !== expectedStatus || !["DENY", "THROTTLE", "ROLLBACK"].includes(value.status) || value.error !== code) {
    throw new Error(`EXPECTED_DENY_${code}_${response.status}_${JSON.stringify(value)}`);
  }
  return value;
}

let result;
switch (process.argv[2] ?? "") {
  case "mutable-source":
    result = await deny("/v1/skills/request", {method: "POST", headers, body: JSON.stringify({...installRequest, source: {...installRequest.source, mutable: true}})}, "SKILL_REQUEST_CONTRACT_DENIED"); break;
  case "digest-swap":
    result = await deny("/v1/skills/request", {method: "POST", headers, body: JSON.stringify({...installRequest, source: {...installRequest.source, digest: "a".repeat(64), locator: `skill+sha256:${"a".repeat(64)}`}})}, "SKILL_REQUEST_CONTRACT_DENIED"); break;
  case "self-approval":
    result = await deny("/v1/skills/request", {method: "POST", headers, body: JSON.stringify({...installRequest, ownerDecision: {approvedBy: identity}})}, "SKILL_REQUEST_CONTRACT_DENIED"); break;
  case "cross-tenant":
    result = await deny("/v1/skills/request", {method: "POST", headers, body: JSON.stringify({...installRequest, tenant: "tenant:foreign"})}, "SKILL_REQUEST_CONTRACT_DENIED"); break;
  case "dependency-confusion":
    result = await deny("/v1/skills/request", {method: "POST", headers, body: JSON.stringify({...installRequest, dependencies: [{name: "greeter", version: "latest"}]})}, "SKILL_REQUEST_CONTRACT_DENIED"); break;
  case "unknown-field":
    result = await deny("/v1/skills/request", {method: "POST", headers, body: JSON.stringify({...installRequest, url: "https://registry.invalid"})}, "SKILL_REQUEST_CONTRACT_DENIED"); break;
  case "wrong-identity":
    result = await deny("/v1/skills/request", {method: "POST", headers: {...headers, "x-cm-workload-identity": "workload:foreign"}, body: JSON.stringify(installRequest)}, "WORKLOAD_IDENTITY_DENIED"); break;
  case "concurrent": {
    const first = request("/v1/skills/request", {method: "POST", headers: {...headers, "x-cm-test-hold-ms": "100"}, body: JSON.stringify(installRequest)});
    await new Promise((resolve) => setTimeout(resolve, 20));
    const competing = await deny("/v1/skills/request", {method: "POST", headers, body: JSON.stringify(installRequest)}, "SKILL_CONCURRENT_INSTALL_THROTTLED", 429);
    const firstValue = await parse(await first);
    if (!firstValue.response.ok || firstValue.value.status !== "PASS") throw new Error("FIRST_CONCURRENT_INSTALL_FAILED");
    result = {status: "PASS", first: firstValue.value, competing};
    break;
  }
  case "replay": {
    const replay = await pass("/v1/skills/request", {method: "POST", headers, body: JSON.stringify(installRequest)});
    if (replay.replay !== "SAME_RECEIPT") throw new Error("INSTALL_REPLAY_NOT_IDEMPOTENT");
    result = replay; break;
  }
  case "activation-failure":
    result = await deny("/v1/skills/activate", {method: "POST", headers: {...headers, "x-cm-test-activation-failure": "true"}, body: JSON.stringify(activationRequest)}, "SKILL_ACTIVATION_FAILED_ROLLED_BACK", 409); break;
  case "readback":
    result = await pass("/v1/skills/readback", {headers}); break;
  case "rollback":
    result = await pass("/v1/skills/rollback", {method: "POST", headers, body: JSON.stringify({schemaVersion: "chimpmaera.aas037/skill-rollback/v1", operationId: "aas037-openclaw-rollback-0001", tenant: "tenant:panskys-zoo", skillId: "skill:zoo-greeter"})}); break;
  case "evidence":
    result = await pass("/v1/evidence", {headers}); break;
  case "reset":
    result = await pass("/v1/reset", {method: "POST", headers, body: "{}"}); break;
  case "filesystem": {
    const denied = [];
    for (const target of ["/opt/chimpmaera/workspace/skills/direct-write", "/opt/chimpmaera/write-denied", "/etc/write-denied"]) {
      try { await writeFile(target, "denied"); throw new Error(`WRITE_AVAILABLE_${target}`); }
      catch (error) { if (String(error).startsWith("Error: WRITE_AVAILABLE_")) throw error; denied.push(target); }
    }
    for (const target of ["/var/run/docker.sock", "/proc/1/root/etc/shadow"]) {
      try { await readFile(target); throw new Error(`READ_AVAILABLE_${target}`); }
      catch (error) { if (String(error).startsWith("Error: READ_AVAILABLE_")) throw error; denied.push(target); }
    }
    const forbidden = Object.keys(process.env).filter((name) => /(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AWS_|AZURE_|GOOGLE_)/i.test(name));
    if (forbidden.length > 0) throw new Error(`AMBIENT_CREDENTIAL_ENV_${forbidden.join(",")}`);
    result = {status: "PASS", denied, forbidden}; break;
  }
  case "egress": {
    const denied = [];
    for (const target of ["https://example.com", "http://169.254.169.254/latest/meta-data/", "http://host.docker.internal:18789/healthz", "http://api.openai.com/v1/models", "http://erp.invalid/"]) {
      try { await fetch(target, {signal: AbortSignal.timeout(1500), redirect: "manual"}); throw new Error(`EGRESS_AVAILABLE_${target}`); }
      catch (error) { if (String(error).startsWith("Error: EGRESS_AVAILABLE_")) throw error; denied.push(target); }
    }
    result = {status: "PASS", denied}; break;
  }
  default: throw new Error("UNKNOWN_PROBE");
}
process.stdout.write(`${JSON.stringify(result)}\n`);
