import { createHash } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const contract = JSON.parse(readFileSync("./runtime-contract-v1.json", "utf8"));
const statePath = "/var/lib/chimpmaera/state.json";
const modelMarker = "synthetic-builder-routing-marker-not-a-secret";
const workloadIdentity = "workload:bld001-builder-agent-g6-v1";
const requestKeys = [
  "approvalDigest",
  "capabilityBindingDigest",
  "operationId",
  "payload",
  "requestId",
  "schemaVersion",
  "systemId",
  "tenant",
].sort();

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

function exactObject(value, keys) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function validateContract() {
  const profile = contract.builderProfile;
  const rightsInputs = [
    profile.hostSystemCeiling,
    profile.ownerProfileRights,
    profile.assignments,
    profile.currentConstraints,
  ];
  if (
    profile.selected !== "SAFE_GUIDED"
    || rightsInputs.some((rights) => !Array.isArray(rights) || new Set(rights).size !== rights.length)
  ) throw new Error("RUNTIME_CONTRACT_INVALID");
  const intersection = [...new Set(rightsInputs[0])]
    .filter((right) => rightsInputs.slice(1).every((rights) => rights.includes(right)))
    .sort();
  if (canonical(intersection) !== canonical([...profile.effectiveRights].sort())) {
    throw new Error("RUNTIME_EFFECTIVE_RIGHTS_INVALID");
  }
  const write = contract.admittedCapabilities.find(
    (entry) => entry.capabilityId === "habitat.setpoint.update",
  );
  if (
    contract.admittedCapabilities.length !== 2
    || write?.effectClass !== "REVERSIBLE_WRITE"
    || write?.route !== "OWNER_APPROVAL"
    || digest(write.admissionRecord) !== write.capabilityBindingDigest
  ) throw new Error("RUNTIME_ADMISSION_INVALID");
  const approvalCore = { ...contract.syntheticOwnerApproval };
  delete approvalCore.approvalDigest;
  if (digest(approvalCore) !== contract.syntheticOwnerApproval.approvalDigest) {
    throw new Error("RUNTIME_OWNER_APPROVAL_INVALID");
  }
}

validateContract();

function initialState() {
  return {
    schemaVersion: "chimpmaera.builder/runtime-state/v1",
    target: structuredClone(contract.target.initialState),
    receipts: {},
    counters: { modelCalls: 0, readAttempts: 0, reads: 0, writeAttempts: 0, writes: 0, denials: 0 },
  };
}

function persist(value) {
  const temporary = `${statePath}.tmp`;
  writeFileSync(temporary, `${canonical(value)}\n`, { mode: 0o600 });
  renameSync(temporary, statePath);
}

function loadState() {
  try {
    const value = JSON.parse(readFileSync(statePath, "utf8"));
    if (
      value?.schemaVersion !== "chimpmaera.builder/runtime-state/v1"
      || !exactObject(value.target, ["setpointC", "temperatureC"])
      || typeof value.receipts !== "object"
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

let state = loadState();

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

function capability(operationId) {
  return contract.admittedCapabilities.find((entry) => entry.capabilityId === operationId);
}

function requestTemplate(operationId) {
  const admitted = capability(operationId);
  if (admitted === undefined) throw new Error("CAPABILITY_NOT_ADMITTED_DENIED");
  const read = operationId === "habitat.temperature.read";
  return {
    schemaVersion: "chimpmaera.builder/runtime-request/v1",
    tenant: contract.target.tenant,
    systemId: contract.target.systemId,
    operationId,
    requestId: read ? "bld001-g6-read-0001" : "bld001-g6-write-0001",
    capabilityBindingDigest: admitted.capabilityBindingDigest,
    approvalDigest: read ? null : contract.syntheticOwnerApproval.approvalDigest,
    payload: read
      ? { habitatId: contract.target.habitatId }
      : { habitatId: contract.target.habitatId, setpointC: contract.syntheticOwnerApproval.approvedSetpointC },
  };
}

function validateRequest(value) {
  if (
    !exactObject(value, requestKeys)
    || value.schemaVersion !== "chimpmaera.builder/runtime-request/v1"
    || value.tenant !== contract.target.tenant
    || value.systemId !== contract.target.systemId
    || !/^bld001-g6-(?:read|write)-[0-9]{4}$/.test(value.requestId)
  ) throw new Error("BUILDER_REQUEST_BINDING_DENIED");
  const expected = requestTemplate(value.operationId);
  if (
    value.capabilityBindingDigest !== expected.capabilityBindingDigest
    || value.approvalDigest !== expected.approvalDigest
    || canonical(value.payload) !== canonical(expected.payload)
  ) throw new Error("BUILDER_REQUEST_CAPABILITY_OR_PAYLOAD_DENIED");
  const effectiveRights = contract.builderProfile.effectiveRights;
  if (!effectiveRights.includes(value.operationId)) throw new Error("EFFECTIVE_RIGHTS_DENIED");
  const admitted = capability(value.operationId);
  if (admitted.route !== contract.builderProfile.routes[value.operationId]) {
    throw new Error("OWNER_ROUTE_BINDING_DENIED");
  }
  return admitted;
}

function receiptCore(value, admitted, outcome, beforeDigest, effectDigest, readbackDigest, finalDigest) {
  return {
    schemaVersion: "chimpmaera.builder/runtime-receipt/v1",
    issueId: "BLD-001",
    claimId: "BLD-001-G6",
    workloadIdentity,
    tenant: value.tenant,
    systemId: value.systemId,
    operationId: value.operationId,
    requestId: value.requestId,
    requestDigest: digest(value),
    selectedProfile: contract.builderProfile.selected,
    effectiveRightsDigest: digest(contract.builderProfile.effectiveRights),
    capabilityBindingDigest: admitted.capabilityBindingDigest,
    route: admitted.route,
    approvalDigest: value.approvalDigest,
    beforeDigest,
    effectDigest,
    readbackDigest,
    finalDigest,
    outcome,
  };
}

function executeBuilder(value) {
  const admitted = validateRequest(value);
  const requestDigest = digest(value);
  const prior = state.receipts[value.requestId];
  if (prior !== undefined) {
    if (prior.requestDigest !== requestDigest) throw new Error("REPLAY_CONFLICT_DENIED");
    return { status: "PASS", replayState: "REPLAY_SAME_RECEIPT", receipt: prior };
  }

  const beforeDigest = digest(state.target);
  let effectDigest;
  let readback;
  let outcome;
  if (value.operationId === "habitat.temperature.read") {
    state.counters.readAttempts += 1;
    readback = {
      habitatId: value.payload.habitatId,
      temperatureC: state.target.temperatureC,
    };
    effectDigest = beforeDigest;
    outcome = "SYNTHETIC_READ_NO_CHANGE_VERIFIED";
    state.counters.reads += 1;
  } else if (value.operationId === "habitat.setpoint.update") {
    state.counters.writeAttempts += 1;
    const priorSetpointC = state.target.setpointC;
    let effectReadback;
    try {
      state.target.setpointC = value.payload.setpointC;
      persist(state);
      effectReadback = JSON.parse(readFileSync(statePath, "utf8")).target;
      if (effectReadback.setpointC !== value.payload.setpointC) {
        throw new Error("WRITE_READBACK_MISMATCH_DENIED");
      }
    } finally {
      state.target.setpointC = priorSetpointC;
      persist(state);
    }
    effectDigest = digest(effectReadback);
    readback = {
      habitatId: value.payload.habitatId,
      priorSetpointC,
      appliedSetpointC: effectReadback.setpointC,
    };
    const rollbackReadback = JSON.parse(readFileSync(statePath, "utf8")).target;
    if (digest(rollbackReadback) !== beforeDigest) throw new Error("ROLLBACK_MISMATCH_DENIED");
    outcome = "SYNTHETIC_REVERSIBLE_WRITE_ROLLBACK_VERIFIED";
    state.counters.writes += 1;
  } else {
    throw new Error("CAPABILITY_NOT_ADMITTED_DENIED");
  }
  const finalDigest = digest(state.target);
  const readbackDigest = digest(readback);
  const core = receiptCore(
    value,
    admitted,
    outcome,
    beforeDigest,
    effectDigest,
    readbackDigest,
    finalDigest,
  );
  const receipt = { ...core, receiptDigest: digest(core) };
  state.receipts[value.requestId] = receipt;
  persist(state);
  return { status: "PASS", replayState: "FIRST_EXECUTION", readback, receipt };
}

function requestedOperation(messages) {
  const userText = messages
    .filter((message) => message.role === "user")
    .map((message) => typeof message.content === "string" ? message.content : canonical(message.content))
    .join("\n")
    .toLowerCase();
  if (userText.includes("reversible") || userText.includes("setpoint")) {
    return "habitat.setpoint.update";
  }
  if (userText.includes("temperature") || userText.includes("read")) {
    return "habitat.temperature.read";
  }
  throw new Error("MODEL_INTENT_UNRESOLVED_DENIED");
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
          id: operationId === "habitat.temperature.read" ? "call_bld001_read_0001" : "call_bld001_write_0001",
          type: "function",
          function: {
            name: "chimpmaera_builder_request",
            arguments: JSON.stringify(requestTemplate(operationId)),
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
      persist(state);
      json(response, 200, { status: "PASS", contractDigest: digest(contract) });
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
      state.counters.modelCalls += 1;
      persist(state);
      sendCompletion(response, value, modelResult(value.messages));
      return;
    }
    if (request.method === "POST" && request.url === "/v1/builder/execute") {
      requireWorkload(request);
      json(response, 200, executeBuilder(await body(request)));
      return;
    }
    if (request.method === "GET" && request.url === "/v1/evidence") {
      requireWorkload(request);
      const initialTargetDigest = digest(contract.target.initialState);
      const currentTargetDigest = digest(state.target);
      json(response, 200, {
        status: "PASS",
        contractDigest: digest(contract),
        selectedProfile: contract.builderProfile.selected,
        effectiveRights: contract.builderProfile.effectiveRights,
        counters: state.counters,
        initialTargetDigest,
        currentTargetDigest,
        ownedTargetDrift: initialTargetDigest === currentTargetDigest ? 0 : 1,
        receiptDigests: Object.values(state.receipts).map((entry) => entry.receiptDigest).sort(),
        outcomes: Object.values(state.receipts).map((entry) => entry.outcome).sort(),
      });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/reset") {
      requireWorkload(request);
      const value = await body(request);
      if (
        !exactObject(value, ["systemId", "tenant"])
        || value.tenant !== contract.target.tenant
        || value.systemId !== contract.target.systemId
      ) throw new Error("RESET_SCOPE_DENIED");
      const retainedReceiptDigests = Object.values(state.receipts).map((entry) => entry.receiptDigest).sort();
      state = initialState();
      persist(state);
      json(response, 200, { status: "PASS", retainedReceiptDigests, ownedTargetDrift: 0 });
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
