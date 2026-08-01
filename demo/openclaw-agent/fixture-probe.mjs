import { readFile, writeFile } from "node:fs/promises";

const mode = process.argv[2] ?? "";
const base = "http://capability-gateway:8080";
const identity = "workload:aas035-openclaw-agent-v1";
const headers = { "content-type": "application/json", "x-cm-workload-identity": identity };
const mind = {
  tenant: "tenant:synthetic-zoo",
  purpose: "purpose:synthetic-contact-fixture",
  trust: "SYNTHETIC_UNTRUSTED_AGENT_MEMORY",
  key: "aas035.memory",
  value: "bounded durable synthetic mind entry",
};
const typed = {
  schemaVersion: "chimpmaera.aas035/typed-capability-request/v1",
  tenant: "tenant:synthetic-zoo",
  purpose: "purpose:synthetic-contact-fixture",
  catalogueDigest: "1454c6bc785bc5185d7e1dc657cd62b620c2e2f9b79a80ac38e87573adf5c387",
  catalogueVersion: "1.0.0",
  adapterId: "espocrm-local-fixture",
  adapterVersion: "1.0.0",
  actionId: "crm.contact.create",
  resource: "espocrm.contact",
  effect: "CREATE",
  requestId: "aas035-openclaw-e2e-0001",
  payload: { email: "agent.fixture@synthetic.invalid", name: "AAS-035 Synthetic Agent" },
};

async function request(path, options = {}) {
  return fetch(`${base}${path}`, { ...options, signal: AbortSignal.timeout(10_000) });
}

async function parsed(response) {
  const value = await response.json();
  return { response, value };
}

async function expectPass(path, options) {
  const { response, value } = await parsed(await request(path, options));
  if (!response.ok || value.status !== "PASS") throw new Error(JSON.stringify(value));
  return value;
}

async function expectDeny(path, options, code) {
  const { response, value } = await parsed(await request(path, options));
  if (response.status !== 403 || value.status !== "DENY" || (code && value.error !== code)) {
    throw new Error(`EXPECTED_DENY_${code}_${response.status}_${JSON.stringify(value)}`);
  }
  return value;
}

let result;
switch (mode) {
  case "mind-write":
    result = await expectPass("/v1/mind/entries", { method: "POST", headers, body: JSON.stringify(mind) });
    break;
  case "mind-read": {
    const query = new URLSearchParams({ tenant: mind.tenant, purpose: mind.purpose, trust: mind.trust, key: mind.key });
    result = await expectPass(`/v1/mind/entries?${query}`, { headers });
    break;
  }
  case "replay": {
    const first = await expectPass("/v1/capabilities/execute", { method: "POST", headers, body: JSON.stringify(typed) });
    const second = await expectPass("/v1/capabilities/execute", { method: "POST", headers, body: JSON.stringify(typed) });
    if (first.receipt.receiptDigest !== second.receipt.receiptDigest || second.replayState !== "REPLAY_SAME_RECEIPT") {
      throw new Error("REPLAY_NOT_EXACTLY_ONCE");
    }
    result = { status: "PASS", receiptDigest: first.receipt.receiptDigest, replayState: second.replayState };
    break;
  }
  case "cross-tenant": {
    const foreign = { ...mind, tenant: "tenant:foreign" };
    result = await expectDeny("/v1/mind/entries", { method: "POST", headers, body: JSON.stringify(foreign) }, "MIND_CONTRACT_DENIED");
    break;
  }
  case "wrong-identity":
    result = await expectDeny("/v1/capabilities/execute", { method: "POST", headers: { ...headers, "x-cm-workload-identity": "workload:foreign" }, body: JSON.stringify(typed) }, "WORKLOAD_IDENTITY_DENIED");
    break;
  case "unknown-action":
    result = await expectDeny("/v1/capabilities/execute", { method: "POST", headers, body: JSON.stringify({ ...typed, actionId: "raw.shell.execute" }) }, "TYPED_REQUEST_BINDING_DENIED");
    break;
  case "replay-conflict":
    result = await expectDeny("/v1/capabilities/execute", { method: "POST", headers, body: JSON.stringify({ ...typed, payload: { ...typed.payload, name: "Changed" } }) }, "TYPED_REQUEST_PAYLOAD_DENIED");
    break;
  case "oversize":
    result = await expectDeny("/v1/mind/entries", { method: "POST", headers, body: JSON.stringify({ ...mind, value: "x".repeat(2049) }) }, "MIND_CONTRACT_DENIED");
    break;
  case "route-bypass":
    result = await expectDeny("/v1/providers/direct", { method: "POST", headers, body: "{}" }, "ROUTE_DENIED");
    break;
  case "egress": {
    const targets = [
      "https://example.com",
      "http://169.254.169.254/latest/meta-data/",
      "http://host.docker.internal:18789/healthz",
      "http://api.openai.com/v1/models",
      "http://erp.invalid/",
      "http://crm.invalid/",
    ];
    const denied = [];
    for (const target of targets) {
      try {
        await fetch(target, { signal: AbortSignal.timeout(1500), redirect: "manual" });
        throw new Error(`EGRESS_UNEXPECTEDLY_REACHABLE_${target}`);
      } catch (error) {
        if (String(error).startsWith("Error: EGRESS_UNEXPECTEDLY_REACHABLE_")) throw error;
        denied.push(target);
      }
    }
    result = { status: "PASS", denied };
    break;
  }
  case "filesystem": {
    const denied = [];
    const targets = [
      { path: "/opt/chimpmaera/write-denied", operation: "write" },
      { path: "/etc/write-denied", operation: "write" },
      { path: "/var/run/docker.sock", operation: "read" },
      { path: "/proc/1/root/etc/shadow", operation: "read" },
    ];
    for (const target of targets) {
      try {
        if (target.operation === "write") await writeFile(target.path, "denied");
        else await readFile(target.path);
        throw new Error(`AUTHORITY_UNEXPECTEDLY_AVAILABLE_${target.path}`);
      } catch (error) {
        if (String(error).startsWith("Error: AUTHORITY_UNEXPECTEDLY_AVAILABLE_")) throw error;
        denied.push(target.path);
      }
    }
    const environment = Object.keys(process.env).sort();
    const forbidden = environment.filter((name) => /(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AWS_|AZURE_|GOOGLE_)/i.test(name));
    if (forbidden.length > 0) throw new Error(`AMBIENT_CREDENTIAL_ENV_${forbidden.join(",")}`);
    const config = await readFile("/opt/chimpmaera/openclaw.json", "utf8");
    if (/sk-[A-Za-z0-9]|AKIA[A-Z0-9]|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/.test(config)) {
      throw new Error("EMBEDDED_CREDENTIAL_PATTERN");
    }
    result = { status: "PASS", denied, environment };
    break;
  }
  case "evidence":
    result = await expectPass("/v1/evidence", { headers });
    break;
  case "reset":
    result = await expectPass("/v1/reset", { method: "POST", headers, body: JSON.stringify({ tenant: mind.tenant, purpose: mind.purpose }) });
    break;
  default:
    throw new Error(`UNKNOWN_PROBE_${mode}`);
}
process.stdout.write(`${JSON.stringify(result)}\n`);
