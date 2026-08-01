import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const contract = JSON.parse(readFileSync("./runtime-contract-v1.json", "utf8"));
const skillBytes = readFileSync("./fixture/SKILL.md", "utf8");
const statePath = "/var/lib/chimpmaera/state/state.json";
const skillRoot = "/var/lib/chimpmaera/skills";
const activeDir = `${skillRoot}/zoo-greeter`;
const modelMarker = "synthetic-workload-routing-marker-not-a-secret";
const expectedIdentity = contract.workload.identity;
const expectedRequest = Object.freeze({
  schemaVersion: "chimpmaera.aas037/skill-request/v1",
  operationId: "aas037-openclaw-install-0001",
  tenant: contract.workload.tenant,
  requester: expectedIdentity,
  source: {
    kind: "LOCAL_CONTENT",
    locator: `skill+sha256:${contract.skill.packageDigest}`,
    version: contract.skill.version,
    digest: contract.skill.packageDigest,
    mutable: false,
  },
  skill: {id: contract.skill.id, version: contract.skill.version, fileDigest: contract.skill.fileDigest},
  requestedCapabilities: [],
});
const expectedActivation = Object.freeze({
  schemaVersion: "chimpmaera.aas037/skill-activation/v1",
  operationId: "aas037-openclaw-activate-0001",
  tenant: contract.workload.tenant,
  skillId: contract.skill.id,
  packageDigest: contract.skill.packageDigest,
});

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}
function digest(value) { return createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex"); }
function exact(value, expected) { return canonical(value) === canonical(expected); }
function initialState() {
  return {schemaVersion: "chimpmaera.aas037/manager-state/v1", installed: null, active: false, receipts: [], counters: {modelCalls: 0, installAttempts: 0, installs: 0, activations: 0, denials: 0, rollbacks: 0}};
}
function loadState() {
  try {
    const value = JSON.parse(readFileSync(statePath, "utf8"));
    return value?.schemaVersion === "chimpmaera.aas037/manager-state/v1" ? value : initialState();
  } catch { return initialState(); }
}
let state = loadState();
let busy = false;

function persist() {
  mkdirSync("/var/lib/chimpmaera/state", {recursive: true});
  const temp = `${statePath}.tmp`;
  writeFileSync(temp, `${JSON.stringify(state)}\n`, {mode: 0o600});
  renameSync(temp, statePath);
}
function receipt(action, operationId, outcome, issues = []) {
  const value = {
    schemaVersion: "chimpmaera.aas037/lifecycle-receipt/v1", action, operationId,
    tenant: contract.workload.tenant, skillId: contract.skill.id,
    packageDigest: contract.skill.packageDigest, requestedCapabilities: [], grantedCapabilities: [],
    outcome, issues, generation: state.receipts.length + 1,
  };
  const result = {...value, receiptDigest: digest(value)};
  state.receipts.push(result);
  return result;
}
function json(response, status, value) {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(status, {"content-type": "application/json", "content-length": Buffer.byteLength(body), "cache-control": "no-store", "x-content-type-options": "nosniff"});
  response.end(body);
}
async function body(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 32 * 1024) throw new Error("REQUEST_OVERSIZED");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new Error("REQUEST_JSON_DENIED"); }
}
function workload(request) {
  if (request.headers["x-cm-workload-identity"] !== expectedIdentity) throw new Error("WORKLOAD_IDENTITY_DENIED");
}
function finalMessage(messages) {
  const tools = messages.filter((message) => message.role === "tool");
  if (tools.length === 0) return {
    finishReason: "tool_calls",
    message: {role: "assistant", content: null, tool_calls: [{id: "call_aas037_install_0001", type: "function", function: {name: "chimpmaera_skill_request", arguments: JSON.stringify({requestId: "aas037-openclaw-install-0001"})}}]},
  };
  if (tools.length === 1) return {
    finishReason: "tool_calls",
    message: {role: "assistant", content: null, tool_calls: [{id: "call_aas037_activate_0001", type: "function", function: {name: "chimpmaera_skill_activate_use", arguments: JSON.stringify({requestId: "aas037-openclaw-activate-0001"})}}]},
  };
  const texts = tools.map((tool) => {
    let text = String(tool.content ?? "");
    try {
      const outer = JSON.parse(text);
      const inner = outer?.content?.[0]?.text ?? outer;
      text = typeof inner === "string" ? inner : JSON.stringify(inner);
    } catch { /* pattern checks below fail closed */ }
    return text;
  });
  const combined = texts.join("\n");
  const greeting = combined.match(/Hello from the Zoo/)?.[0] ?? "missing";
  const receipts = [...combined.matchAll(/"receiptDigest":"([a-f0-9]{64})"/g)].map((match) => match[1]);
  return {finishReason: "stop", message: {role: "assistant", content: `skillGreeting=${greeting} installReceipt=${receipts[0] ?? "missing"} activationReceipt=${receipts.at(-1) ?? "missing"} authority=NONE`}};
}
function sendCompletion(response, request, result) {
  const created = Math.floor(Date.now() / 1000);
  if (request.stream === true) {
    response.writeHead(200, {"content-type": "text/event-stream", "cache-control": "no-store"});
    const delta = result.finishReason === "tool_calls"
      ? {role: "assistant", content: null, tool_calls: result.message.tool_calls.map((tool, index) => ({index, ...tool}))}
      : {role: "assistant", content: result.message.content};
    response.write(`data: ${JSON.stringify({id: "chatcmpl-aas037", object: "chat.completion.chunk", created, model: "cm-agent-v1", choices: [{index: 0, delta, finish_reason: null}]})}\n\n`);
    response.write(`data: ${JSON.stringify({id: "chatcmpl-aas037", object: "chat.completion.chunk", created, model: "cm-agent-v1", choices: [{index: 0, delta: {}, finish_reason: result.finishReason}]})}\n\n`);
    response.end("data: [DONE]\n\n");
    return;
  }
  json(response, 200, {id: "chatcmpl-aas037", object: "chat.completion", created, model: "cm-agent-v1", choices: [{index: 0, message: result.message, finish_reason: result.finishReason}], usage: {prompt_tokens: 1, completion_tokens: 1, total_tokens: 2}});
}
async function install(request, value) {
  workload(request);
  state.counters.installAttempts += 1;
  if (!exact(value, expectedRequest)) throw new Error("SKILL_REQUEST_CONTRACT_DENIED");
  if (busy) {
    state.counters.denials += 1; persist();
    return {statusCode: 429, value: {status: "THROTTLE", error: "SKILL_CONCURRENT_INSTALL_THROTTLED"}};
  }
  if (state.installed) {
    if (state.installed.requestDigest === digest(value)) return {statusCode: 200, value: {status: "PASS", replay: "SAME_RECEIPT", receipt: state.installed.receipt}};
    throw new Error("SKILL_REPLAY_CONFLICT_DENIED");
  }
  busy = true;
  try {
    const hold = Math.min(Number(request.headers["x-cm-test-hold-ms"] ?? 0), 500);
    if (hold > 0) await new Promise((resolve) => setTimeout(resolve, hold));
    const installReceipt = receipt("INSTALL", value.operationId, "COMMITTED");
    state.installed = {requestDigest: digest(value), packageDigest: value.source.digest, active: false, receipt: installReceipt};
    state.counters.installs += 1;
    persist();
    return {statusCode: 200, value: {status: "PASS", replay: "FIRST", installed: true, active: false, grantedCapabilities: [], receipt: installReceipt}};
  } finally { busy = false; }
}
function activate(request, value) {
  workload(request);
  if (!exact(value, expectedActivation) || state.installed?.packageDigest !== value.packageDigest) throw new Error("SKILL_ACTIVATION_BINDING_DENIED");
  const tempDir = `${skillRoot}/.zoo-greeter-${process.pid}.tmp`;
  rmSync(tempDir, {recursive: true, force: true});
  mkdirSync(tempDir, {recursive: false, mode: 0o755});
  writeFileSync(`${tempDir}/SKILL.md`, skillBytes, {mode: 0o444});
  if (digest(readFileSync(`${tempDir}/SKILL.md`, "utf8")) !== contract.skill.fileDigest) throw new Error("SKILL_ACTIVATION_READBACK_DENIED");
  if (request.headers["x-cm-test-activation-failure"] === "true") {
    rmSync(tempDir, {recursive: true, force: true});
    state.active = false;
    state.counters.rollbacks += 1;
    const rollbackReceipt = receipt("ROLLBACK", value.operationId, "ROLLED_BACK", ["SKILL_ACTIVATION_FAILED_ROLLED_BACK"]);
    persist();
    return {statusCode: 409, value: {status: "ROLLBACK", error: "SKILL_ACTIVATION_FAILED_ROLLED_BACK", receipt: rollbackReceipt}};
  }
  rmSync(activeDir, {recursive: true, force: true});
  renameSync(tempDir, activeDir);
  state.active = true;
  state.installed.active = true;
  state.counters.activations += 1;
  const activationReceipt = receipt("ACTIVATE", value.operationId, "COMMITTED");
  persist();
  return {statusCode: 200, value: {status: "PASS", installed: true, active: true, grantedCapabilities: [], receipt: activationReceipt}};
}
function rollback(request, value) {
  workload(request);
  const expected = {schemaVersion: "chimpmaera.aas037/skill-rollback/v1", operationId: "aas037-openclaw-rollback-0001", tenant: contract.workload.tenant, skillId: contract.skill.id};
  if (!exact(value, expected)) throw new Error("SKILL_ROLLBACK_BINDING_DENIED");
  rmSync(activeDir, {recursive: true, force: true});
  state.active = false;
  if (state.installed) state.installed.active = false;
  state.counters.rollbacks += 1;
  const rollbackReceipt = receipt("ROLLBACK", value.operationId, "ROLLED_BACK");
  persist();
  return {status: "PASS", active: false, receipt: rollbackReceipt};
}

if (digest(skillBytes) !== contract.skill.fileDigest) throw new Error("FIXTURE_SKILL_DIGEST_MISMATCH");
const server = createServer((request, response) => {
  const run = async () => {
    if (request.method === "GET" && ["/healthz", "/readyz"].includes(request.url)) { persist(); json(response, 200, {status: "PASS", role: "managed-skill-broker"}); return; }
    if (request.method === "GET" && request.url === "/v1/models") {
      if (request.headers.authorization !== `Bearer ${modelMarker}`) throw new Error("MODEL_ROUTE_IDENTITY_DENIED");
      json(response, 200, {object: "list", data: [{id: "cm-agent-v1", object: "model", owned_by: "chimpmaera-fixture"}]}); return;
    }
    if (request.method === "POST" && request.url === "/v1/chat/completions") {
      if (request.headers.authorization !== `Bearer ${modelMarker}`) throw new Error("MODEL_ROUTE_IDENTITY_DENIED");
      const value = await body(request);
      if (value.model !== "cm-agent-v1" || !Array.isArray(value.messages)) throw new Error("MODEL_REQUEST_DENIED");
      state.counters.modelCalls += 1; persist(); sendCompletion(response, value, finalMessage(value.messages)); return;
    }
    if (request.method === "POST" && request.url === "/v1/skills/request") {
      const result = await install(request, await body(request)); json(response, result.statusCode, result.value); return;
    }
    if (request.method === "POST" && request.url === "/v1/skills/activate") {
      const result = activate(request, await body(request)); json(response, result.statusCode, result.value); return;
    }
    if (request.method === "POST" && request.url === "/v1/skills/rollback") { json(response, 200, rollback(request, await body(request))); return; }
    if (request.method === "GET" && request.url === "/v1/skills/readback") {
      workload(request); json(response, 200, {status: "PASS", installed: state.installed !== null, active: state.active, packageDigest: state.installed?.packageDigest ?? null, grantedCapabilities: [], materialized: existsSync(`${activeDir}/SKILL.md`), receipts: state.receipts}); return;
    }
    if (request.method === "GET" && request.url === "/v1/evidence") { workload(request); json(response, 200, {status: "PASS", ...state.counters, receiptDigests: state.receipts.map((item) => item.receiptDigest), installed: state.installed !== null, active: state.active}); return; }
    if (request.method === "POST" && request.url === "/v1/reset") {
      workload(request); rmSync(activeDir, {recursive: true, force: true}); state = initialState(); persist(); json(response, 200, {status: "PASS", reset: true}); return;
    }
    throw new Error("ROUTE_DENIED");
  };
  run().catch((error) => {
    state.counters.denials += 1;
    try { persist(); } catch { /* response still fails closed */ }
    const code = String(error?.message ?? error);
    const status = code.includes("CONCURRENT") ? 429 : 403;
    json(response, status, {status: "DENY", error: code});
  });
});
server.listen(8080, "0.0.0.0");
