import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createInvocationIdentity, createSyntheticIdentity, encodeSyntheticIdentity } from "./identity-v2.mjs";

const mode = process.argv[2] ?? "";
const base = "http://capability-gateway:8080";
const identity = "workload:aas035-openclaw-agent-v1";
const headers = { "content-type": "application/json", "x-cm-workload-identity": identity };
const workloadContract = JSON.parse(await readFile("/opt/chimpmaera/gateway-workload-contract-v2.json", "utf8"));
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

function v2Options(label, overrides = {}, correlationId = `corr-aas035-${label}-0001`) {
  const assertion = createSyntheticIdentity(workloadContract, {
    correlationId,
    jti: `jti-aas035-${label}-0001`,
    overrides,
  });
  return {
    method: "POST",
    headers: {
      authorization: `Synthetic ${encodeSyntheticIdentity(assertion)}`,
      "content-type": "application/json",
      "x-cm-correlation-id": correlationId,
    },
    body: JSON.stringify(typed),
  };
}

async function expectV2Deny(options, code, route = workloadContract.identity.route) {
  const { response, value } = await parsed(await request(route, options));
  if (response.status !== 403 || value.status !== "DENY" || value.code !== code) {
    throw new Error(`EXPECTED_V2_DENY_${code}_${response.status}_${JSON.stringify(value)}`);
  }
  if (JSON.stringify(value).includes("proof") || JSON.stringify(value).includes("authorization")) {
    throw new Error("UNSANITIZED_V2_DENIAL");
  }
  return value;
}

function v2SmokeProbe(probeMode) {
  const probe = workloadContract.smokeProbes?.find((candidate) => candidate.mode === probeMode);
  if (!probe
    || probe.route !== workloadContract.identity.route
    || !/^[A-Z0-9_]+_DENIED$/.test(probe.expectedCode)
    || probe.identityOverrides === null
    || typeof probe.identityOverrides !== "object"
    || probe.bodyOverrides === null
    || typeof probe.bodyOverrides !== "object") {
    throw new Error("SMOKE_PROBE_CONTRACT_DENIED");
  }
  const correlationId = `corr-aas035-${probe.mode}-0001`;
  const assertion = createSyntheticIdentity(workloadContract, {
    correlationId,
    jti: `jti-aas035-${probe.mode}-0001`,
    overrides: probe.identityOverrides,
  });
  return {
    route: probe.route,
    expectedCode: probe.expectedCode,
    options: {
      method: "POST",
      headers: {
        authorization: `Synthetic ${encodeSyntheticIdentity(assertion)}`,
        "content-type": "application/json",
        "x-cm-correlation-id": correlationId,
      },
      body: JSON.stringify({ ...typed, ...probe.bodyOverrides }),
    },
  };
}

function freshV2Options() {
  const invocation = createInvocationIdentity(workloadContract, {
    requestId: typed.requestId,
    invocationId: randomUUID(),
  });
  return {
    method: "POST",
    headers: {
      authorization: `Synthetic ${encodeSyntheticIdentity(invocation.identity)}`,
      "content-type": "application/json",
      "x-cm-correlation-id": invocation.correlationId,
    },
    body: JSON.stringify(typed),
  };
}

let result;
switch (mode) {
  case "gateway-v2": {
    const correlationId = "corr-aas035-gateway-v2-0001";
    const { response, value } = await parsed(await request(
      workloadContract.identity.route,
      v2Options("gateway-v2", {}, correlationId),
    ));
    if (!response.ok || value.status !== "PASS" || value.correlationId !== correlationId
      || value.authorization?.correlationId !== correlationId
      || value.result?.receipt?.outcome !== "SYNTHETIC_EFFECT_READBACK_VERIFIED") {
      throw new Error("GATEWAY_V2_EXPECTED_ALLOW_FAILED");
    }
    result = {
      schemaVersion: value.schemaVersion,
      status: value.status,
      correlationId: value.correlationId,
      identity: value.authorization.identity,
      network: value.authorization.network,
      receiptDigest: value.result.receipt.receiptDigest,
    };
    break;
  }
  case "identity-missing":
    result = await expectV2Deny({ method: "POST", headers: { "content-type": "application/json", "x-cm-correlation-id": "corr-aas035-missing-0001" }, body: JSON.stringify(typed) }, "IDENTITY_MISSING_DENIED");
    break;
  case "identity-expired":
    result = await expectV2Deny(v2Options("expired", { expiresAt: workloadContract.clock.now }), "IDENTITY_EXPIRED_DENIED");
    break;
  case "identity-wrong-audience":
    result = await expectV2Deny(v2Options("audience", { audience: "chimpmaera://unexpected.invalid/denied" }), "IDENTITY_AUDIENCE_DENIED");
    break;
  case "identity-wrong-tenant":
    result = await expectV2Deny(v2Options("tenant", { tenant: "tenant:foreign" }), "IDENTITY_TENANT_DENIED");
    break;
  case "identity-replay": {
    const options = v2Options("replay");
    const first = await parsed(await request(workloadContract.identity.route, options));
    if (!first.response.ok || first.value.status !== "PASS") throw new Error("IDENTITY_REPLAY_FIRST_USE_FAILED");
    result = await expectV2Deny(options, "IDENTITY_REPLAY_DENIED");
    break;
  }
  case "mind-write":
    result = await expectPass("/v1/mind/entries", { method: "POST", headers, body: JSON.stringify(mind) });
    break;
  case "mind-read": {
    const query = new URLSearchParams({ tenant: mind.tenant, purpose: mind.purpose, trust: mind.trust, key: mind.key });
    result = await expectPass(`/v1/mind/entries?${query}`, { headers });
    break;
  }
  case "replay": {
    const first = await parsed(await request(workloadContract.identity.route, freshV2Options()));
    const second = await parsed(await request(workloadContract.identity.route, freshV2Options()));
    if (!first.response.ok || !second.response.ok
      || first.value.result.receipt.receiptDigest !== second.value.result.receipt.receiptDigest
      || second.value.result.replayState !== "REPLAY_SAME_RECEIPT") {
      throw new Error("REPLAY_NOT_EXACTLY_ONCE");
    }
    result = {
      status: "PASS",
      receiptDigest: first.value.result.receipt.receiptDigest,
      replayState: second.value.result.replayState,
    };
    break;
  }
  case "cross-tenant": {
    const foreign = { ...mind, tenant: "tenant:foreign" };
    result = await expectDeny("/v1/mind/entries", { method: "POST", headers, body: JSON.stringify(foreign) }, "MIND_CONTRACT_DENIED");
    break;
  }
  case "wrong-identity":
  case "unknown-action": {
    const probe = v2SmokeProbe(mode);
    result = await expectV2Deny(probe.options, probe.expectedCode, probe.route);
    break;
  }
  case "replay-conflict":
    result = await expectDeny("/v1/capabilities/execute", { method: "POST", headers, body: JSON.stringify({ ...typed, payload: { ...typed.payload, name: "Changed" } }) }, "TYPED_REQUEST_PAYLOAD_DENIED");
    break;
  case "oversize":
    result = await expectDeny("/v1/mind/entries", { method: "POST", headers, body: JSON.stringify({ ...mind, value: "x".repeat(2049) }) }, "MIND_CONTRACT_DENIED");
    break;
  case "route-bypass":
    result = await expectDeny("/v1/providers/direct", { method: "POST", headers, body: "{}" }, "ROUTE_DENIED");
    break;
  case "legacy-capability-bypass":
    result = await expectDeny("/v1/capabilities/execute", { method: "POST", headers, body: JSON.stringify(typed) }, "LEGACY_CAPABILITY_ROUTE_DENIED");
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
