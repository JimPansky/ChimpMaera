import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const contract = JSON.parse(readFileSync("./runtime-contract-v1.json", "utf8"));
const audits = [];
const receipts = new Map();
let providerCalls = 0;
let denials = 0;
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const digest = (value) => createHash("sha256").update(canonical(value)).digest("hex");
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const json = (response, status, value) => {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  response.end(`${JSON.stringify(value)}\n`);
};
async function body(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > contract.budgets.maxInputBytes) throw new Error("MODEL_REQUEST_SIZE_DENIED");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
function validate(value) {
  const keys = ["schemaVersion", "workloadIdentity", "userIdentity", "tenant", "purpose", "delegationDigest", "operationId", "correlationId", "routeId", "provider", "model", "protocol", "dataClassification", "trustClass", "text", "attachments", "tools", "structuredOutput", "optionalFields", "budget"];
  if (!exact(value, keys) || value.schemaVersion !== "chimpmaera.model/model-request/v1") throw new Error("MODEL_REQUEST_SCHEMA_DENIED");
  for (const key of ["workloadIdentity", "userIdentity", "tenant", "purpose", "delegationDigest"]) if (value[key] !== contract[key]) throw new Error("MODEL_AUTHORITY_BINDING_DENIED");
  for (const key of ["routeId", "provider", "model", "protocol"]) if (value[key] !== contract.route[key]) throw new Error("MODEL_ROUTE_CLOSED_DENIED");
  if (value.dataClassification === "SECRET") throw new Error("MODEL_SECRET_OWNER_ESCALATION");
  if (value.trustClass !== "UNTRUSTED_AGENT_INPUT" || typeof value.text !== "string") throw new Error("MODEL_TRUST_DENIED");
  if (!exact(value.budget, Object.keys(contract.budgets))) throw new Error("MODEL_BUDGET_DENIED");
  for (const [key, ceiling] of Object.entries(contract.budgets)) if (!Number.isSafeInteger(value.budget[key]) || value.budget[key] < 1 || value.budget[key] > ceiling) throw new Error("MODEL_BUDGET_DENIED");
  if (!Array.isArray(value.attachments) || !Array.isArray(value.tools) || !exact(value.optionalFields, [])) throw new Error("MODEL_FEATURE_SURFACE_DENIED");
}
function guardResponse(value, request, providerRequestDigest) {
  if (!value || value.object !== "chat.completion" || !Array.isArray(value.choices) || !value.usage) throw new Error("MODEL_RESPONSE_SCHEMA_QUARANTINED");
  const message = value.choices[0]?.message;
  if (!message || !["stop", "tool_calls"].includes(value.choices[0]?.finish_reason)) throw new Error("MODEL_RESPONSE_SCHEMA_QUARANTINED");
  const candidates = [];
  for (const tool of message.tool_calls ?? []) {
    let args;
    try { args = JSON.parse(tool.function?.arguments); } catch { throw new Error("MODEL_TOOL_INCOMPLETE_QUARANTINED"); }
    if (!request.tools.some((item) => item.name === tool.function?.name) || ["authority", "approval", "credentialHandle", "execute", "tenant"].some((key) => Object.hasOwn(args, key))) throw new Error("MODEL_TOOL_SMUGGLING_QUARANTINED");
    candidates.push({ id: tool.id, name: tool.function.name, arguments: args, trust: "UNTRUSTED_MODEL_OUTPUT", authority: "NONE" });
  }
  let text = String(message.content ?? "");
  text = text.replace(/(?:api[_-]?key|access[_-]?token)\s*[:=]\s*\S{8,}/gi, "[REDACTED_MODEL_OUTPUT]");
  text = text.replace(/ignore (?:all )?(?:previous|system) instructions|mint authority|execute tool now/gi, "[UNTRUSTED_MODEL_INSTRUCTION]");
  if (Buffer.byteLength(text) > request.budget.maxOutputBytes) throw new Error("MODEL_RESPONSE_SIZE_QUARANTINED");
  return {
    schemaVersion: "chimpmaera.model/model-response/v1",
    operationId: request.operationId,
    correlationId: request.correlationId,
    provider: request.provider,
    model: request.model,
    protocol: request.protocol,
    trust: "UNTRUSTED_MODEL_OUTPUT",
    contentType: "text/plain",
    text,
    structuredOutput: null,
    toolCallCandidates: candidates,
    provenance: { routeId: request.routeId, providerRequestDigest, providerResponseDigest: digest(value) },
    usage: { inputTokens: value.usage.prompt_tokens, outputTokens: value.usage.completion_tokens, costMicros: value.usage.cost_micros },
  };
}
async function invoke(value) {
  validate(value);
  const requestDigest = digest(value);
  const previous = receipts.get(value.operationId);
  if (previous) {
    if (previous.requestDigest !== requestDigest) throw new Error("MODEL_REPLAY_CONFLICT_DENIED");
    return { ...previous.result, replay: "SAME_RECEIPT" };
  }
  const providerRequest = { model: value.model, messages: [{ role: "user", content: value.text }], max_tokens: value.budget.maxTokens, tools: value.tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.inputSchema } })) };
  providerCalls += 1;
  const providerRequestDigest = digest(providerRequest);
  const response = await fetch(contract.route.providerUrl, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${contract.route.credentialHandle}` },
    body: JSON.stringify(providerRequest),
    signal: AbortSignal.timeout(value.budget.timeoutMs),
  });
  if (!response.ok) throw new Error("MODEL_PROVIDER_UNAVAILABLE_QUARANTINED");
  const guarded = guardResponse(await response.json(), value, providerRequestDigest);
  const audit = { schemaVersion: "chimpmaera.model/model-audit/v1", operationId: value.operationId, correlationId: value.correlationId, tenantDigest: digest(value.tenant), purposeDigest: digest(value.purpose), requestDigest, responseDigest: digest(guarded), decision: "ALLOW", usage: guarded.usage, issues: [] };
  audits.push(audit);
  const result = { outcome: "ALLOW", response: guarded, audit, replay: "FIRST" };
  receipts.set(value.operationId, { requestDigest, result });
  return result;
}
createServer((request, response) => {
  const run = async () => {
    if (request.method === "GET" && request.url === "/healthz") return json(response, 200, { status: "PASS", role: "model-access-broker" });
    if (request.method === "GET" && request.url === "/readyz") return json(response, 200, { status: "PASS", routeDigest: digest(contract.route) });
    if (request.headers["x-cm-frontdoor-identity"] !== contract.frontdoorIdentity) throw new Error("MODEL_FRONTDOOR_IDENTITY_DENIED");
    if (request.method === "GET" && request.url === "/v1/evidence") return json(response, 200, { status: "PASS", providerCalls, denials, auditCount: audits.length, audits, rawContentStored: false, receiptCount: receipts.size });
    if (request.method === "POST" && request.url === "/v1/model/invoke") return json(response, 200, await invoke(await body(request)));
    throw new Error("MODEL_BROKER_ROUTE_DENIED");
  };
  run().catch((error) => { denials += 1; json(response, 403, { outcome: "DENY", response: null, error: error instanceof Error ? error.message : "DENY" }); });
}).listen(8081, "0.0.0.0");
