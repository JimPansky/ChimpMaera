import { readFile } from "node:fs/promises";

const mode = process.argv[2] ?? "";
const base = "http://127.0.0.1:8080";
const contract = JSON.parse(await readFile("./runtime-contract-v1.json", "utf8"));
const headers = { "content-type": "application/json", authorization: "Bearer synthetic-workload-routing-marker-not-a-secret" };
const tool = { type: "function", function: { name: "crm.contact.create", description: "Propose a contact candidate", parameters: { type: "object", properties: { name: { type: "string" } } } } };
const chat = (text, user) => ({ model: "cm-agent-v1", messages: [{ role: "user", content: text }], tools: [tool], stream: false, user });
const brokerRequest = (text, operationId) => ({
  schemaVersion: "chimpmaera.model/model-request/v1",
  workloadIdentity: contract.workloadIdentity,
  userIdentity: contract.userIdentity,
  tenant: contract.tenant,
  purpose: contract.purpose,
  delegationDigest: contract.delegationDigest,
  operationId,
  correlationId: `correlation:${operationId.slice("operation:".length)}`,
  routeId: contract.route.routeId,
  provider: contract.route.provider,
  model: contract.route.model,
  protocol: contract.route.protocol,
  dataClassification: "INTERNAL",
  trustClass: "UNTRUSTED_AGENT_INPUT",
  text,
  attachments: [],
  tools: [{ name: "crm.contact.create", description: "Propose a contact candidate", inputSchema: { type: "object" } }],
  structuredOutput: null,
  optionalFields: {},
  budget: { maxInputBytes: 65536, maxOutputBytes: 65536, maxTokens: 4096, maxCostMicros: 100000, maxRequests: 32, timeoutMs: 30000 },
});
async function call(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, signal: AbortSignal.timeout(35000) });
  return { response, value: await response.json() };
}
async function expectPass(text, user) {
  const { response, value } = await call("/v1/chat/completions", { method: "POST", headers, body: JSON.stringify(chat(text, user)) });
  if (!response.ok || !value.choices) throw new Error(`EXPECTED_PASS_${response.status}_${JSON.stringify(value)}`);
  return value;
}
async function expectDeny(text, user, code) {
  const { response, value } = await call("/v1/chat/completions", { method: "POST", headers, body: JSON.stringify(chat(text, user)) });
  if (response.status !== 403 || value.status !== "DENY" || !String(value.error).includes(code)) throw new Error(`EXPECTED_DENY_${code}_${response.status}_${JSON.stringify(value)}`);
  return value;
}
async function directBroker(value) {
  const response = await fetch("http://model-access-broker:8081/v1/model/invoke", {
    method: "POST",
    headers: { "content-type": "application/json", "x-cm-frontdoor-identity": contract.frontdoorIdentity },
    body: JSON.stringify(value),
    signal: AbortSignal.timeout(35000),
  });
  return { response, value: await response.json() };
}
async function expectBrokerDeny(value, codePattern) {
  const result = await directBroker(value);
  if (result.response.status !== 403 || result.value.outcome !== "DENY" || !codePattern.test(String(result.value.error))) throw new Error(`EXPECTED_BROKER_DENY_${codePattern}_${result.response.status}_${JSON.stringify(result.value)}`);
  return result.value;
}
let result;
switch (mode) {
  case "text":
    result = await expectPass("Return one broker mediated sentence.", "runtime-text");
    if (!JSON.stringify(result).includes("broker-mediated synthetic model response")) throw new Error("TEXT_RESPONSE_MISSING");
    break;
  case "tool-candidate":
    result = await expectPass("[fixture:tool-candidate]", "runtime-tool");
    if (result.choices[0].finish_reason !== "tool_calls" || result.choices[0].message.tool_calls[0].function.name !== "crm.contact.create") throw new Error("TOOL_CANDIDATE_MISSING");
    break;
  case "secret-leak":
    result = await expectPass("[fixture:secret-leak]", "runtime-secret");
    if (!JSON.stringify(result).includes("REDACTED_MODEL_OUTPUT") || JSON.stringify(result).includes("providersecret12345")) throw new Error("SECRET_NOT_REDACTED");
    break;
  case "injection":
    result = await expectPass("[fixture:injection]", "runtime-injection");
    if (!JSON.stringify(result).includes("UNTRUSTED_MODEL_INSTRUCTION") || /ignore all previous|mint authority/i.test(JSON.stringify(result))) throw new Error("INJECTION_NOT_LABELLED");
    break;
  case "tool-smuggle":
    result = await expectDeny("[fixture:tool-smuggle]", "runtime-smuggle", "MODEL_TOOL_SMUGGLING_QUARANTINED");
    break;
  case "malformed":
    result = await expectDeny("[fixture:malformed]", "runtime-malformed", "MODEL_RESPONSE_SCHEMA_QUARANTINED");
    break;
  case "oversized":
    result = await expectDeny("[fixture:oversized]", "runtime-oversized", "MODEL_RESPONSE_SIZE_QUARANTINED");
    break;
  case "timeout": {
    const request = brokerRequest("[fixture:timeout]", "operation:runtime-timeout");
    request.budget.timeoutMs = 50;
    result = await expectBrokerDeny(request, /timeout|abort|fetch failed/i);
    break;
  }
  case "replay": {
    const first = await expectPass("replay stable", "runtime-replay");
    const second = await expectPass("replay stable", "runtime-replay");
    if (first.id !== second.id) throw new Error("REPLAY_RECEIPT_CHANGED");
    result = { status: "PASS", id: first.id };
    break;
  }
  case "replay-conflict":
    await expectPass("replay base", "runtime-conflict");
    result = await expectDeny("replay changed", "runtime-conflict", "MODEL_REPLAY_CONFLICT_DENIED");
    break;
  case "cross-tenant": {
    const request = brokerRequest("cross tenant", "operation:runtime-cross-tenant");
    request.tenant = "tenant:foreign";
    result = await expectBrokerDeny(request, /MODEL_AUTHORITY_BINDING_DENIED/);
    break;
  }
  case "unknown-route": {
    const request = brokerRequest("unknown route", "operation:runtime-unknown-route");
    request.routeId = "route:arbitrary-http";
    result = await expectBrokerDeny(request, /MODEL_ROUTE_CLOSED_DENIED/);
    break;
  }
  case "direct-paths": {
    const denied = [];
    for (const target of ["http://synthetic-provider:8082/healthz", "https://example.com", "http://169.254.169.254/latest/meta-data/"]) {
      try { await fetch(target, { signal: AbortSignal.timeout(1000) }); throw new Error(`DIRECT_PATH_REACHABLE_${target}`); }
      catch (error) { if (String(error).includes("DIRECT_PATH_REACHABLE")) throw error; denied.push(target); }
    }
    const forbidden = Object.keys(process.env).filter((name) => /(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AWS_|AZURE_|GOOGLE_)/i.test(name));
    if (forbidden.length > 0) throw new Error(`AMBIENT_CREDENTIAL_${forbidden.join(",")}`);
    for (const path of ["/var/run/docker.sock", "/proc/1/root/etc/shadow"]) {
      try { await readFile(path); throw new Error(`FILESYSTEM_PATH_REACHABLE_${path}`); }
      catch (error) { if (String(error).includes("FILESYSTEM_PATH_REACHABLE")) throw error; denied.push(path); }
    }
    result = { status: "PASS", denied, forbidden };
    break;
  }
  case "evidence": {
    const { response, value } = await call("/v1/evidence", { headers });
    if (!response.ok || value.status !== "PASS") throw new Error(`EVIDENCE_DENIED_${JSON.stringify(value)}`);
    result = value;
    break;
  }
  default:
    throw new Error(`UNKNOWN_PROBE_${mode}`);
}
process.stdout.write(`${JSON.stringify(result)}\n`);
