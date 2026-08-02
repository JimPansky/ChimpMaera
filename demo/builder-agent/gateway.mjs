import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { canonical, createBuilderCore } from "./builder-core.mjs";

const contract = JSON.parse(readFileSync("./runtime-contract-v1.json", "utf8"));
const statePath = "/var/lib/chimpmaera/state.json";
const modelMarker = "synthetic-builder-routing-marker-not-a-secret";
const workloadIdentity = "workload:bld001-builder-agent-g6-v1";

function persist(value) {
  const temporary = `${statePath}.tmp`;
  writeFileSync(temporary, `${canonical(value)}\n`, { mode: 0o600 });
  renameSync(temporary, statePath);
}

function load() {
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

const core = createBuilderCore({ contract, workloadIdentity, loadState: load, persistState: persist });

function json(response, status, value) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json",
    "x-content-type-options": "nosniff",
  });
  response.end(`${JSON.stringify(value)}\n`);
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

function requireWorkload(request) {
  if (request.headers["x-cm-workload-identity"] !== workloadIdentity) {
    throw new Error("WORKLOAD_IDENTITY_DENIED");
  }
}

function requestedOperation(messages) {
  const userText = messages
    .filter((message) => message.role === "user")
    .map((message) => typeof message.content === "string" ? message.content : canonical(message.content))
    .join("\n")
    .toLowerCase();
  const ranked = contract.admittedCapabilities
    .map((entry) => ({
      entry,
      matches: entry.intentTerms.filter((term) => userText.includes(term.toLowerCase())).length,
    }))
    .sort((left, right) => right.matches - left.matches);
  if (ranked[0].matches === 0 || ranked[0].matches === ranked[1]?.matches) {
    throw new Error("MODEL_INTENT_UNRESOLVED_DENIED");
  }
  return ranked[0].entry.capabilityId;
}

function parseToolResult(toolResult) {
  const outer = JSON.parse(toolResult.content);
  const text = outer?.content?.[0]?.text ?? toolResult.content;
  const parsed = typeof text === "string" ? JSON.parse(text) : text;
  if (parsed?.status !== "PASS" || !/^[a-f0-9]{64}$/.test(parsed?.receipt?.receiptDigest ?? "")) {
    throw new Error("MODEL_TOOL_RESULT_INVALID_DENIED");
  }
  return parsed;
}

function modelResult(messages) {
  const operationId = requestedOperation(messages);
  const toolResult = messages.findLast?.((message) => message.role === "tool")
    ?? [...messages].reverse().find((message) => message.role === "tool");
  if (toolResult === undefined) {
    return {
      finishReason: "tool_calls",
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{
          id: operationId.includes("read") ? "call_bld001_read_0001" : "call_bld001_write_0001",
          type: "function",
          function: {
            name: "chimpmaera_builder_request",
            arguments: JSON.stringify(core.requestTemplate(operationId)),
          },
        }],
      },
    };
  }
  const parsed = parseToolResult(toolResult);
  if (parsed.receipt.operationId !== operationId) throw new Error("MODEL_TOOL_OPERATION_MISMATCH_DENIED");
  return {
    finishReason: "stop",
    message: {
      role: "assistant",
      content: `Builder mediation passed. operationId=${operationId} outcome=${parsed.receipt.outcome} receiptDigest=${parsed.receipt.receiptDigest}`,
    },
  };
}

function sendCompletion(response, request, result) {
  const created = Math.floor(Date.now() / 1000);
  if (request.stream === true) {
    const delta = result.finishReason === "tool_calls"
      ? { role: "assistant", content: null, tool_calls: result.message.tool_calls.map((tool, index) => ({ index, ...tool })) }
      : { role: "assistant", content: result.message.content };
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "text/event-stream",
      "x-content-type-options": "nosniff",
    });
    response.write(`data: ${JSON.stringify({ id: "chatcmpl-bld001", object: "chat.completion.chunk", created, model: "cm-builder-v1", choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`);
    response.write(`data: ${JSON.stringify({ id: "chatcmpl-bld001", object: "chat.completion.chunk", created, model: "cm-builder-v1", choices: [{ index: 0, delta: {}, finish_reason: result.finishReason }] })}\n\n`);
    response.end("data: [DONE]\n\n");
    return;
  }
  json(response, 200, {
    id: "chatcmpl-bld001",
    object: "chat.completion",
    created,
    model: "cm-builder-v1",
    choices: [{ index: 0, message: result.message, finish_reason: result.finishReason }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
}

const server = createServer((request, response) => {
  const run = async () => {
    if (request.method === "GET" && request.url === "/healthz") {
      json(response, 200, { status: "PASS", role: "builder-gateway" });
      return;
    }
    if (request.method === "GET" && request.url === "/readyz") {
      json(response, 200, { status: "PASS", contractDigest: core.evidence().contractDigest });
      return;
    }
    if (request.method === "GET" && request.url === "/v1/models") {
      if (request.headers.authorization !== `Bearer ${modelMarker}`) throw new Error("MODEL_ROUTE_IDENTITY_DENIED");
      json(response, 200, { object: "list", data: [{ id: "cm-builder-v1", object: "model", owned_by: "chimpmaera-fixture" }] });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/chat/completions") {
      if (request.headers.authorization !== `Bearer ${modelMarker}`) throw new Error("MODEL_ROUTE_IDENTITY_DENIED");
      const value = await body(request);
      if (value.model !== "cm-builder-v1" || !Array.isArray(value.messages)) throw new Error("MODEL_REQUEST_DENIED");
      core.recordModelCall();
      sendCompletion(response, value, modelResult(value.messages));
      return;
    }
    if (request.method === "POST" && request.url === "/v1/builder/execute") {
      requireWorkload(request);
      json(response, 200, core.execute(await body(request)));
      return;
    }
    if (request.method === "GET" && request.url === "/v1/evidence") {
      requireWorkload(request);
      json(response, 200, core.evidence());
      return;
    }
    if (request.method === "POST" && request.url === "/v1/reset") {
      requireWorkload(request);
      json(response, 200, core.reset(await body(request)));
      return;
    }
    throw new Error("ROUTE_DENIED");
  };
  run().catch((error) => {
    core.recordDenial();
    json(response, 403, { status: "DENY", error: error instanceof Error ? error.message : "REQUEST_DENIED" });
  });
});

server.listen(8080, "0.0.0.0");
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
