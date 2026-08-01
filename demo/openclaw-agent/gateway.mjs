import { createHash } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const contract = JSON.parse(readFileSync("./runtime-contract-v1.json", "utf8"));
const statePath = "/var/lib/chimpmaera/state.json";
const modelMarker = "synthetic-workload-routing-marker-not-a-secret";
const requestTemplate = Object.freeze({
  schemaVersion: "chimpmaera.aas035/typed-capability-request/v1",
  tenant: contract.workload.tenant,
  purpose: contract.workload.purpose,
  catalogueDigest: contract.workload.catalogueDigest,
  catalogueVersion: contract.workload.catalogueVersion,
  adapterId: contract.workload.adapterId,
  adapterVersion: contract.workload.adapterVersion,
  actionId: contract.workload.actionId,
  resource: "espocrm.contact",
  effect: "CREATE",
  requestId: "aas035-openclaw-e2e-0001",
  payload: {
    email: "agent.fixture@synthetic.invalid",
    name: "AAS-035 Synthetic Agent",
  },
});
const expectedRequestKeys = Object.keys(requestTemplate).sort();
const expectedPayloadKeys = Object.keys(requestTemplate.payload).sort();
const policy = Object.freeze({
  policyId: "aas035-synthetic-policy-v1",
  generation: 1,
  workloadIdentity: contract.workload.identity,
  tenant: contract.workload.tenant,
  purpose: contract.workload.purpose,
  catalogueDigest: contract.workload.catalogueDigest,
  actionId: contract.workload.actionId,
  maxEffects: 32,
});
const authority = Object.freeze({
  authorityId: "aas035-synthetic-authority-v1",
  policyDigest: digest(policy),
  workloadIdentity: contract.workload.identity,
  tenant: contract.workload.tenant,
  purpose: contract.workload.purpose,
  actionId: contract.workload.actionId,
});

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonical(value[key])}`,
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function initialState() {
  return {
    schemaVersion: "chimpmaera.aas035/gateway-state/v1",
    effects: {},
    mind: {},
    counters: { modelCalls: 0, effectAttempts: 0, effects: 0, denials: 0 },
  };
}

function loadState() {
  try {
    const value = JSON.parse(readFileSync(statePath, "utf8"));
    if (
      value?.schemaVersion !== "chimpmaera.aas035/gateway-state/v1"
      || typeof value.effects !== "object"
      || typeof value.mind !== "object"
      || typeof value.counters !== "object"
    ) throw new Error("STATE_INVALID");
    return value;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const value = initialState();
    persist(value);
    return value;
  }
}

function persist(value) {
  const temporary = `${statePath}.tmp`;
  writeFileSync(temporary, `${canonical(value)}\n`, { mode: 0o600 });
  renameSync(temporary, statePath);
}

let state = loadState();

function exactObject(value, keys) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys);
}

function json(response, status, body) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json",
    "x-content-type-options": "nosniff",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

async function body(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 64 * 1024) throw new Error("REQUEST_TOO_LARGE_DENIED");
    chunks.push(chunk);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("REQUEST_INVALID_DENIED");
  }
  return value;
}

function workload(request) {
  if (request.headers["x-cm-workload-identity"] !== contract.workload.identity) {
    throw new Error("WORKLOAD_IDENTITY_DENIED");
  }
}

function validateTypedRequest(value) {
  if (!exactObject(value, expectedRequestKeys)) throw new Error("TYPED_REQUEST_SURFACE_DENIED");
  for (const [key, expected] of Object.entries(requestTemplate)) {
    if (key === "requestId" || key === "payload") continue;
    if (value[key] !== expected) throw new Error("TYPED_REQUEST_BINDING_DENIED");
  }
  if (!/^aas035-[a-z0-9-]{8,48}$/.test(value.requestId)) {
    throw new Error("TYPED_REQUEST_ID_DENIED");
  }
  if (
    !exactObject(value.payload, expectedPayloadKeys)
    || value.payload.email !== requestTemplate.payload.email
    || value.payload.name !== requestTemplate.payload.name
  ) throw new Error("TYPED_REQUEST_PAYLOAD_DENIED");
}

function executeCapability(value) {
  state.counters.effectAttempts += 1;
  validateTypedRequest(value);
  const requestDigest = digest(value);
  const prior = state.effects[value.requestId];
  if (prior !== undefined) {
    if (prior.requestDigest !== requestDigest) throw new Error("REPLAY_CONFLICT_DENIED");
    persist(state);
    return { status: "PASS", replayState: "REPLAY_SAME_RECEIPT", ...prior };
  }
  if (state.counters.effects >= policy.maxEffects) throw new Error("EFFECT_BUDGET_DENIED");
  const providerResult = {
    fixture: "synthetic-contact-store",
    objectReference: `contact:${requestDigest.slice(0, 16)}`,
    ...value.payload,
  };
  const readback = structuredClone(providerResult);
  const core = {
    schemaVersion: "chimpmaera.aas035/effect-receipt/v1",
    workloadIdentity: contract.workload.identity,
    tenant: value.tenant,
    purpose: value.purpose,
    catalogueDigest: value.catalogueDigest,
    catalogueVersion: value.catalogueVersion,
    adapterId: value.adapterId,
    adapterVersion: value.adapterVersion,
    actionId: value.actionId,
    requestId: value.requestId,
    requestDigest,
    policyDigest: digest(policy),
    authorityDigest: digest(authority),
    effectDigest: digest(providerResult),
    readbackDigest: digest(readback),
    outcome: "SYNTHETIC_EFFECT_READBACK_VERIFIED",
  };
  const receipt = { ...core, receiptDigest: digest(core) };
  const record = { requestDigest, providerResult, readback, receipt };
  state.effects[value.requestId] = record;
  state.counters.effects += 1;
  persist(state);
  return { status: "PASS", replayState: "FIRST_EXECUTION", ...record };
}

function mindKey(value) {
  if (
    !exactObject(value, ["key", "purpose", "tenant", "trust", "value"])
    || value.tenant !== contract.workload.tenant
    || value.purpose !== contract.workload.purpose
    || value.trust !== contract.mindStore.trust
    || !/^[a-z][a-z0-9.-]{2,48}$/.test(value.key)
    || typeof value.value !== "string"
    || Buffer.byteLength(value.value) > contract.mindStore.maxValueBytes
  ) throw new Error("MIND_CONTRACT_DENIED");
  return `${value.tenant}\n${value.purpose}\n${value.key}`;
}

function writeMind(value) {
  const key = mindKey(value);
  const next = { ...state.mind, [key]: { ...value, valueDigest: digest(value.value) } };
  if (Object.keys(next).length > contract.mindStore.maxEntries) {
    throw new Error("MIND_ENTRY_QUOTA_DENIED");
  }
  const total = Object.values(next).reduce((sum, entry) => sum + Buffer.byteLength(entry.value), 0);
  if (total > contract.mindStore.maxTotalBytes) throw new Error("MIND_TOTAL_QUOTA_DENIED");
  state.mind = next;
  persist(state);
  return { status: "PASS", entry: state.mind[key], contract: contract.mindStore };
}

function readMind(url) {
  const query = new URL(url, "http://capability-gateway").searchParams;
  const value = {
    tenant: query.get("tenant"),
    purpose: query.get("purpose"),
    trust: query.get("trust"),
    key: query.get("key"),
    value: "",
  };
  const key = mindKey(value);
  const entry = state.mind[key];
  if (entry === undefined) throw new Error("MIND_ENTRY_NOT_FOUND_DENIED");
  return { status: "PASS", entry, contract: contract.mindStore };
}

function toolCallResponse(messages) {
  const toolResult = messages.findLast?.((message) => message.role === "tool")
    ?? [...messages].reverse().find((message) => message.role === "tool");
  if (toolResult === undefined) {
    return {
      finishReason: "tool_calls",
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{
          id: "call_aas035_gateway_0001",
          type: "function",
          function: {
            name: "chimpmaera_capability_request",
            arguments: JSON.stringify(requestTemplate),
          },
        }],
      },
    };
  }
  let digestText = "unknown";
  try {
    const outer = JSON.parse(toolResult.content);
    const text = outer?.content?.[0]?.text ?? toolResult.content;
    const parsed = typeof text === "string" ? JSON.parse(text) : text;
    digestText = parsed?.receipt?.receiptDigest ?? "unknown";
  } catch {
    const match = String(toolResult.content).match(/[a-f0-9]{64}/);
    digestText = match?.[0] ?? "unknown";
  }
  return {
    finishReason: "stop",
    message: {
      role: "assistant",
      content: `ChimpMaera Gateway mediation passed. receiptDigest=${digestText}`,
    },
  };
}

function sendCompletion(response, request, result) {
  const created = Math.floor(Date.now() / 1000);
  if (request.stream === true) {
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "text/event-stream",
      "x-content-type-options": "nosniff",
    });
    const delta = result.finishReason === "tool_calls"
      ? { role: "assistant", content: null, tool_calls: result.message.tool_calls.map((tool, index) => ({ index, ...tool })) }
      : { role: "assistant", content: result.message.content };
    response.write(`data: ${JSON.stringify({ id: "chatcmpl-aas035", object: "chat.completion.chunk", created, model: "cm-agent-v1", choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`);
    response.write(`data: ${JSON.stringify({ id: "chatcmpl-aas035", object: "chat.completion.chunk", created, model: "cm-agent-v1", choices: [{ index: 0, delta: {}, finish_reason: result.finishReason }] })}\n\n`);
    response.end("data: [DONE]\n\n");
    return;
  }
  json(response, 200, {
    id: "chatcmpl-aas035",
    object: "chat.completion",
    created,
    model: "cm-agent-v1",
    choices: [{ index: 0, message: result.message, finish_reason: result.finishReason }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
}

const server = createServer((request, response) => {
  const run = async () => {
    if (request.method === "GET" && request.url === "/healthz") {
      json(response, 200, { status: "PASS", role: "capability-gateway" });
      return;
    }
    if (request.method === "GET" && request.url === "/readyz") {
      persist(state);
      json(response, 200, { status: "PASS", policyDigest: digest(policy) });
      return;
    }
    if (request.method === "GET" && request.url === "/v1/models") {
      if (request.headers.authorization !== `Bearer ${modelMarker}`) throw new Error("MODEL_ROUTE_IDENTITY_DENIED");
      json(response, 200, { object: "list", data: [{ id: "cm-agent-v1", object: "model", owned_by: "chimpmaera-fixture" }] });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/chat/completions") {
      if (request.headers.authorization !== `Bearer ${modelMarker}`) throw new Error("MODEL_ROUTE_IDENTITY_DENIED");
      const value = await body(request);
      if (value.model !== "cm-agent-v1" || !Array.isArray(value.messages)) throw new Error("MODEL_REQUEST_DENIED");
      state.counters.modelCalls += 1;
      persist(state);
      sendCompletion(response, value, toolCallResponse(value.messages));
      return;
    }
    if (request.method === "POST" && request.url === "/v1/capabilities/execute") {
      workload(request);
      json(response, 200, executeCapability(await body(request)));
      return;
    }
    if (request.method === "POST" && request.url === "/v1/mind/entries") {
      workload(request);
      json(response, 200, writeMind(await body(request)));
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/v1/mind/entries?")) {
      workload(request);
      json(response, 200, readMind(request.url));
      return;
    }
    if (request.method === "GET" && request.url === "/v1/evidence") {
      workload(request);
      json(response, 200, {
        status: "PASS",
        contract,
        policyDigest: digest(policy),
        authorityDigest: digest(authority),
        stateDigest: digest(state),
        counters: state.counters,
        effectReceiptDigests: Object.values(state.effects).map((entry) => entry.receipt.receiptDigest).sort(),
        mindEntryDigests: Object.values(state.mind).map((entry) => entry.valueDigest).sort(),
      });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/reset") {
      workload(request);
      const value = await body(request);
      if (!exactObject(value, ["purpose", "tenant"]) || value.tenant !== contract.workload.tenant || value.purpose !== contract.workload.purpose) {
        throw new Error("RESET_SCOPE_DENIED");
      }
      const receipts = Object.values(state.effects).map((entry) => entry.receipt.receiptDigest).sort();
      state = initialState();
      persist(state);
      json(response, 200, { status: "PASS", reset: contract.mindStore.reset, retainedReceiptDigests: receipts });
      return;
    }
    throw new Error("ROUTE_DENIED");
  };
  run().catch((error) => {
    state.counters.denials += 1;
    persist(state);
    json(response, 403, { status: "DENY", error: error instanceof Error ? error.message : "REQUEST_DENIED" });
  });
});

server.listen(8080, "0.0.0.0");
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
