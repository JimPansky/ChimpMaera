import { readFile, writeFile } from "node:fs/promises";

const mode = process.argv[2] ?? "";
const base = "http://builder-gateway:8080";
const identity = "workload:bld001-builder-agent-g6-v1";
const headers = { "content-type": "application/json", "x-cm-workload-identity": identity };
const readRequest = {
  schemaVersion: "chimpmaera.builder/runtime-request/v1",
  tenant: "synthetic-zoo",
  systemId: "unknown-habitat-001",
  operationId: "habitat.temperature.read",
  requestId: "bld001-g6-read-0001",
  capabilityBindingDigest: "45b5cd2f099919bc57ae4f5b23e6b4b225522ad8d796454f87ce87cce9e3c654",
  approvalDigest: null,
  payload: { habitatId: "habitat-7" },
};
const writeRequest = {
  schemaVersion: "chimpmaera.builder/runtime-request/v1",
  tenant: "synthetic-zoo",
  systemId: "unknown-habitat-001",
  operationId: "habitat.setpoint.update",
  requestId: "bld001-g6-write-0001",
  capabilityBindingDigest: "504d48c16a6b6306dce47680cca88d8bc75dff6b14c2c5da6699d2fff857eb68",
  approvalDigest: "5d472c30165820995d3a9519e3e9dfe08f167c8623bcbc98c103ab92be8f15bd",
  payload: { habitatId: "habitat-7", setpointC: 23 },
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
  case "evidence":
    result = await expectPass("/v1/evidence", { headers });
    break;
  case "reset":
    result = await expectPass("/v1/reset", {
      method: "POST",
      headers,
      body: JSON.stringify({ tenant: "synthetic-zoo", systemId: "unknown-habitat-001" }),
    });
    break;
  case "replay": {
    const first = await expectPass("/v1/builder/execute", { method: "POST", headers, body: JSON.stringify(readRequest) });
    const second = await expectPass("/v1/builder/execute", { method: "POST", headers, body: JSON.stringify(readRequest) });
    if (first.receipt.receiptDigest !== second.receipt.receiptDigest || second.replayState !== "REPLAY_SAME_RECEIPT") {
      throw new Error("REPLAY_NOT_EXACTLY_ONCE");
    }
    result = { status: "PASS", receiptDigest: first.receipt.receiptDigest, replayState: second.replayState };
    break;
  }
  case "wrong-identity":
    result = await expectDeny("/v1/builder/execute", {
      method: "POST",
      headers: { ...headers, "x-cm-workload-identity": "workload:foreign" },
      body: JSON.stringify(readRequest),
    }, "WORKLOAD_IDENTITY_DENIED");
    break;
  case "cross-tenant":
    result = await expectDeny("/v1/builder/execute", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...readRequest, tenant: "foreign" }),
    }, "BUILDER_REQUEST_BINDING_DENIED");
    break;
  case "unknown-capability":
    result = await expectDeny("/v1/builder/execute", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...readRequest, operationId: "raw.shell.execute" }),
    }, "CAPABILITY_NOT_ADMITTED_DENIED");
    break;
  case "binding-tamper":
    result = await expectDeny("/v1/builder/execute", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...readRequest, capabilityBindingDigest: "0".repeat(64) }),
    }, "BUILDER_REQUEST_CAPABILITY_OR_PAYLOAD_DENIED");
    break;
  case "approval-missing":
    result = await expectDeny("/v1/builder/execute", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...writeRequest, approvalDigest: null }),
    }, "BUILDER_REQUEST_CAPABILITY_OR_PAYLOAD_DENIED");
    break;
  case "post-approval-mutation":
    result = await expectDeny("/v1/builder/execute", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...writeRequest, payload: { ...writeRequest.payload, setpointC: 24 } }),
    }, "BUILDER_REQUEST_CAPABILITY_OR_PAYLOAD_DENIED");
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
      "http://habitat.invalid/",
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
  default:
    throw new Error(`UNKNOWN_PROBE_${mode}`);
}
process.stdout.write(`${JSON.stringify(result)}\n`);
