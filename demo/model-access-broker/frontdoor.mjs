import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const contract = JSON.parse(readFileSync("./runtime-contract-v1.json", "utf8"));
const workloadMarker = "synthetic-workload-routing-marker-not-a-secret";
let decisions = 0;
let denials = 0;
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const json = (response, status, value) => { response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" }); response.end(`${JSON.stringify(value)}\n`); };
async function body(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) { bytes += chunk.length; if (bytes > contract.budgets.maxInputBytes) throw new Error("FRONTDOOR_REQUEST_SIZE_DENIED"); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
function workload(request) {
  if (request.headers.authorization !== `Bearer ${workloadMarker}`) throw new Error("FRONTDOOR_WORKLOAD_DENIED");
}
function canonical(value) {
  if (value.model !== "cm-agent-v1" || !Array.isArray(value.messages) || ![true, false, undefined].includes(value.stream)) throw new Error("FRONTDOOR_MODEL_SCHEMA_DENIED");
  const operationId = `operation:${String(value.user ?? randomUUID()).replace(/[^a-z0-9._-]/gi, "-").toLowerCase().slice(0, 56)}`;
  const text = value.messages.map((message) => String(message.content ?? "")).join("\n");
  return {
    schemaVersion: "chimpmaera.model/model-request/v1",
    workloadIdentity: contract.workloadIdentity,
    userIdentity: contract.userIdentity,
    tenant: contract.tenant,
    purpose: contract.purpose,
    delegationDigest: contract.delegationDigest,
    operationId,
    correlationId: `correlation:${digest({ operationId, text }).slice(0, 32)}`,
    routeId: contract.route.routeId,
    provider: contract.route.provider,
    model: contract.route.model,
    protocol: contract.route.protocol,
    dataClassification: "INTERNAL",
    trustClass: "UNTRUSTED_AGENT_INPUT",
    text,
    attachments: [],
    tools: Array.isArray(value.tools) ? value.tools.map((tool) => ({ name: tool.function?.name, description: tool.function?.description ?? "", inputSchema: tool.function?.parameters ?? {} })) : [],
    structuredOutput: null,
    optionalFields: {},
    budget: { maxInputBytes: 65536, maxOutputBytes: 65536, maxTokens: 4096, maxCostMicros: 100000, maxRequests: 32, timeoutMs: 30000 },
  };
}
async function broker(value) {
  decisions += 1;
  const response = await fetch("http://model-access-broker:8081/v1/model/invoke", { method: "POST", headers: { "content-type": "application/json", "x-cm-frontdoor-identity": contract.frontdoorIdentity }, body: JSON.stringify(value), signal: AbortSignal.timeout(value.budget.timeoutMs + 1000) });
  const result = await response.json();
  if (!response.ok || result.outcome !== "ALLOW") throw new Error(result.error ?? "MODEL_BROKER_DENIED");
  return result;
}
function openAiResponse(result) {
  const candidate = result.response.toolCallCandidates[0];
  const message = candidate ? { role: "assistant", content: null, tool_calls: [{ id: candidate.id, type: "function", function: { name: candidate.name, arguments: JSON.stringify(candidate.arguments) } }] } : { role: "assistant", content: result.response.text };
  return { id: `chatcmpl-${result.audit.responseDigest.slice(0, 16)}`, object: "chat.completion", created: 1785588720, model: "cm-agent-v1", choices: [{ index: 0, message, finish_reason: candidate ? "tool_calls" : "stop" }], usage: { prompt_tokens: result.response.usage.inputTokens, completion_tokens: result.response.usage.outputTokens, total_tokens: result.response.usage.inputTokens + result.response.usage.outputTokens } };
}
function stream(response, value) {
  response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  const message = value.choices[0].message;
  const delta = message.tool_calls ? { role: "assistant", tool_calls: message.tool_calls.map((tool, index) => ({ index, ...tool })) } : { role: "assistant", content: message.content };
  response.write(`data: ${JSON.stringify({ id: value.id, object: "chat.completion.chunk", created: value.created, model: value.model, choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`);
  response.write(`data: ${JSON.stringify({ id: value.id, object: "chat.completion.chunk", created: value.created, model: value.model, choices: [{ index: 0, delta: {}, finish_reason: value.choices[0].finish_reason }] })}\n\n`);
  response.end("data: [DONE]\n\n");
}
createServer((request, response) => {
  const run = async () => {
    if (request.method === "GET" && request.url === "/healthz") return json(response, 200, { status: "PASS", role: "capability-frontdoor" });
    if (request.method === "GET" && request.url === "/readyz") return json(response, 200, { status: "PASS", policyDigest: digest(contract) });
    workload(request);
    if (request.method === "GET" && request.url === "/v1/models") return json(response, 200, { object: "list", data: [{ id: "cm-agent-v1", object: "model", owned_by: "chimpmaera-broker" }] });
    if (request.method === "GET" && request.url === "/v1/evidence") {
      const brokerEvidence = await fetch("http://model-access-broker:8081/v1/evidence", { headers: { "x-cm-frontdoor-identity": contract.frontdoorIdentity } }).then((value) => value.json());
      return json(response, 200, { status: "PASS", decisions, denials, broker: brokerEvidence });
    }
    if (request.method === "POST" && request.url === "/v1/chat/completions") {
      const input = await body(request);
      const output = openAiResponse(await broker(canonical(input)));
      if (input.stream === true) return stream(response, output);
      return json(response, 200, output);
    }
    throw new Error("FRONTDOOR_ROUTE_DENIED");
  };
  run().catch((error) => { denials += 1; json(response, 403, { status: "DENY", error: error instanceof Error ? error.message : "DENY" }); });
}).listen(8080, "0.0.0.0");
