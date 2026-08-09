import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { authorizeGatewayRequest, sanitizedDenial } from "./plugin/identity-v2.mjs";
import {
  canonicalGatewayJson as canonical,
  gatewayDigest as digest,
  loadGatewayState,
  MAX_GATEWAY_COUNTER,
  persistGatewayState,
  validateGatewayState,
} from "./gateway-state.mjs";
import {
  digest as mindDigest,
  mindStatus,
  readMind as managedReadMind,
  resetMind,
  scopeId,
  writeMind as managedWriteMind,
} from "./mind-store.mjs";
import {
  OPENCLAW_M14_DENIAL_SCHEMA,
  OPENCLAW_M14_REQUEST_SCHEMA,
  executeOpenClawM14Capability,
  sanitizedOpenClawM14Denial,
  syntheticOpenClawM14Request,
} from "./capability-m1-4-adapter.mjs";

const contract = JSON.parse(readFileSync(new URL("./runtime-contract-v1.json", import.meta.url), "utf8"));
const workloadContract = JSON.parse(readFileSync(new URL("./gateway-workload-contract-v2.json", import.meta.url), "utf8"));
const statePath = process.env.CM_AAS035_STATE_PATH ?? "/var/lib/chimpmaera/state.json";
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
const openClawM14RequestWithCorrelation = syntheticOpenClawM14Request({
  correlationId: ["corr", "aas035", "openclaw", "m14", "template", "0001"].join("-"),
  workloadIdentity: workloadContract.identity.subject,
});
const { correlationId: _pluginGeneratedCorrelation, ...openClawM14ParameterTemplate } = openClawM14RequestWithCorrelation;
const openClawM14RequestTemplate = Object.freeze(openClawM14ParameterTemplate);
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

const gatewayStateContext = Object.freeze({
  runtimeContract: contract,
  workloadContract,
  policy,
  authority,
  requestTemplate,
  openClawM14RequestTemplate,
});
const loadedState = loadGatewayState({
  statePath,
  context: gatewayStateContext,
  nowMs: Date.now(),
});
let state = loadedState.state;
const recovery = loadedState.recovery;

function incrementCounter(name) {
  if (state.counters[name] >= MAX_GATEWAY_COUNTER) {
    throw new Error("GATEWAY_COUNTER_EXHAUSTED_DENIED");
  }
  state.counters[name] += 1;
}

function recordDenial() {
  if (state.counters.denials < MAX_GATEWAY_COUNTER) state.counters.denials += 1;
}

function persist(value) {
  validateGatewayState(value, gatewayStateContext);
  persistGatewayState(statePath, value);
}

function persistAcceptedReplayIds(replayIds) {
  const merged = new Set(state.identityReplay ?? []);
  for (const replayId of replayIds) merged.add(replayId);
  if (merged.size > workloadContract.identity.replayCacheMaxEntries) {
    throw new Error("IDENTITY_REPLAY_CACHE_FULL_DENIED");
  }
  state.identityReplay = [...merged].sort();
  persist(state);
}

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
  incrementCounter("effectAttempts");
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
  incrementCounter("effects");
  persist(state);
  return { status: "PASS", replayState: "FIRST_EXECUTION", ...record };
}

function executeOpenClawM14(value, authorization) {
  incrementCounter("effectAttempts");
  const result = executeOpenClawM14Capability(
    state, value, authorization, workloadContract, () => persist(state),
  );
  if (result.schemaVersion === OPENCLAW_M14_DENIAL_SCHEMA) {
    recordDenial();
    persist(state);
    return { statusCode: 403, body: result };
  }
  persist(state);
  return { statusCode: 200, body: result };
}

function writeMind(value) {
  return {
    ...managedWriteMind(state.mind, contract, value, { nowMs: Date.now(), persist: () => persist(state) }),
    contract: contract.mindStore,
  };
}

function readMind(url) {
  const query = new URL(url, "http://capability-gateway").searchParams;
  const value = {
    workloadIdentity: query.get("workloadIdentity"),
    tenant: query.get("tenant"),
    purpose: query.get("purpose"),
    generation: Number(query.get("generation")),
    key: query.get("key"),
  };
  return {
    ...managedReadMind(state.mind, contract, value, { nowMs: Date.now(), persist: () => persist(state) }),
    contract: contract.mindStore,
  };
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
            arguments: JSON.stringify(openClawM14RequestTemplate),
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
    digestText = parsed?.receipt?.receiptDigest ?? parsed?.receiptDigest ?? parsed?.result?.receiptDigest ?? "unknown";
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

export function gatewayHandler(request, response) {
  const run = async () => {
    if (request.method === "GET" && request.url === "/healthz") {
      json(response, 200, { status: "PASS", role: "capability-gateway", lifecycle: "LIVE" });
      return;
    }
    if (request.method === "GET" && request.url === "/readyz") {
      validateGatewayState(state, gatewayStateContext);
      const status = mindStatus(state.mind, contract);
      if (status.phase !== "READY") throw new Error("MIND_NOT_READY_DENIED");
      persist(state);
      json(response, 200, { status: "PASS", lifecycle: "READY", generation: status.generation, policyDigest: digest(policy) });
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
      incrementCounter("modelCalls");
      persist(state);
      sendCompletion(response, value, toolCallResponse(value.messages));
      return;
    }
    if (request.method === "POST" && request.url === "/v1/capabilities/execute") {
      throw new Error("LEGACY_CAPABILITY_ROUTE_DENIED");
    }
    if (request.method === "POST" && request.url === workloadContract.identity.route) {
      const correlationId = request.headers["x-cm-correlation-id"];
      const transportSchema = request.headers["x-cm-request-schema"];
      const transportIsM14 = transportSchema === OPENCLAW_M14_REQUEST_SCHEMA;
      const transportIsM14Family = typeof transportSchema === "string"
        && transportSchema.startsWith("chimpmaera.security/capability-execution-request/");
      const replayIds = new Set(state.identityReplay ?? []);
      let value;
      let useOpenClawM14Denial = transportIsM14Family;
      try {
        const host = new URL(`http://${request.headers.host ?? "invalid"}`).hostname;
        const authorization = authorizeGatewayRequest(workloadContract, {
          protocol: "http:",
          dnsTarget: host,
          host,
          port: 8080,
          method: request.method,
          path: request.url,
          authorization: request.headers.authorization,
          correlationId,
        }, { replayIds });
        persistAcceptedReplayIds(replayIds);
        value = await body(request);
        const bodyIsM14 = value.schemaVersion === OPENCLAW_M14_REQUEST_SCHEMA;
        const bodyIsM14Family = typeof value.schemaVersion === "string"
          && value.schemaVersion.startsWith("chimpmaera.security/capability-execution-request/");
        useOpenClawM14Denial = transportIsM14Family || bodyIsM14Family;
        if (useOpenClawM14Denial && (!transportIsM14 || !bodyIsM14)) {
          throw new Error("REQUEST_SCHEMA_MISMATCH_DENIED");
        }
        if (transportIsM14 && bodyIsM14) {
          const { statusCode, body: responseBody } = executeOpenClawM14(value, authorization);
          json(response, statusCode, responseBody);
          return;
        }
        json(response, 200, {
          schemaVersion: "chimpmaera.openclaw/gateway-broker-response/v2",
          status: "PASS",
          correlationId: authorization.correlationId,
          authorization,
          result: executeCapability(value),
        });
      } catch (error) {
        recordDenial();
        persist(state);
        json(response, 403, useOpenClawM14Denial
          ? sanitizedOpenClawM14Denial(error, correlationId)
          : sanitizedDenial(error, correlationId));
      }
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
        lifecycle: {
          health: "LIVE",
          readiness: mindStatus(state.mind, contract),
          startupMigration: loadedState.migration,
          startupRecovery: recovery.status,
          expiredEntriesPurged: loadedState.expiredEntriesPurged,
        },
        counters: state.counters,
        effectReceiptDigests: Object.values(state.effects).map((entry) => entry.receipt.receiptDigest).sort(),
        openClawM14ReceiptDigests: Object.values(state.openclawM14Effects).map((entry) => entry.receipt.receiptDigest).sort(),
        openClawM14EffectCount: Object.values(state.openclawM14Effects).filter((entry) => entry.receipt.effectState === "CONFIRMED_ONE").length,
        mindEntryDigests: Object.values(state.mind.scopes).flatMap((scope) => Object.values(scope.entries).map((entry) => entry.valueDigest)).sort(),
        foreignScopeDigest: mindDigest(Object.fromEntries(Object.entries(state.mind.scopes).filter(([key]) => key !== scopeId({ workloadIdentity: contract.workload.identity, tenant: contract.workload.tenant, purpose: contract.workload.purpose })))),
      });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/reset") {
      workload(request);
      const value = await body(request);
      const receipts = Object.values(state.effects).map((entry) => entry.receipt.receiptDigest).sort();
      const result = resetMind(state.mind, contract, value, { persist: () => persist(state) });
      json(response, 200, { ...result, retainedReceiptDigests: receipts });
      return;
    }
    throw new Error("ROUTE_DENIED");
  };
  run().catch((error) => {
    recordDenial();
    persist(state);
    json(response, 403, { status: "DENY", error: error instanceof Error ? error.message : "REQUEST_DENIED" });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const server = createServer(gatewayHandler);
  const listenPort = Number(process.env.CM_AAS035_PORT ?? "8080");
  const listenHost = process.env.CM_AAS035_LISTEN_HOST ?? "0.0.0.0";
  server.listen(listenPort, listenHost);
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => server.close(() => process.exit(0)));
  }
}
