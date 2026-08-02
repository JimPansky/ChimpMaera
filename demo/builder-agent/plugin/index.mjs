import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const templates = Object.freeze({
  "habitat.temperature.read": Object.freeze({
    schemaVersion: "chimpmaera.builder/runtime-request/v1",
    tenant: "synthetic-zoo",
    systemId: "unknown-habitat-001",
    operationId: "habitat.temperature.read",
    requestId: "bld001-g6-read-0001",
    capabilityBindingDigest: "45b5cd2f099919bc57ae4f5b23e6b4b225522ad8d796454f87ce87cce9e3c654",
    approvalDigest: null,
    payload: { habitatId: "habitat-7" },
  }),
  "habitat.setpoint.update": Object.freeze({
    schemaVersion: "chimpmaera.builder/runtime-request/v1",
    tenant: "synthetic-zoo",
    systemId: "unknown-habitat-001",
    operationId: "habitat.setpoint.update",
    requestId: "bld001-g6-write-0001",
    capabilityBindingDigest: "504d48c16a6b6306dce47680cca88d8bc75dff6b14c2c5da6699d2fff857eb68",
    approvalDigest: "5d472c30165820995d3a9519e3e9dfe08f167c8623bcbc98c103ab92be8f15bd",
    payload: { habitatId: "habitat-7", setpointC: 23 },
  }),
});

const parameters = {
  type: "object",
  additionalProperties: false,
  required: [
    "approvalDigest",
    "capabilityBindingDigest",
    "operationId",
    "payload",
    "requestId",
    "schemaVersion",
    "systemId",
    "tenant",
  ],
  properties: {
    schemaVersion: { const: "chimpmaera.builder/runtime-request/v1" },
    tenant: { const: "synthetic-zoo" },
    systemId: { const: "unknown-habitat-001" },
    operationId: { enum: Object.keys(templates) },
    requestId: { type: "string", pattern: "^bld001-g6-(?:read|write)-[0-9]{4}$" },
    capabilityBindingDigest: { type: "string", pattern: "^[a-f0-9]{64}$" },
    approvalDigest: { anyOf: [{ type: "null" }, { type: "string", pattern: "^[a-f0-9]{64}$" }] },
    payload: {
      type: "object",
      additionalProperties: false,
      required: ["habitatId"],
      properties: {
        habitatId: { const: "habitat-7" },
        setpointC: { const: 23 },
      },
    },
  },
};

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function exactRequest(params) {
  const expected = templates[params.operationId];
  if (expected === undefined || canonical(params) !== canonical(expected)) {
    throw new Error("CM_BUILDER_REQUEST_BINDING_DENIED");
  }
  return expected;
}

function validReceipt(body, expected) {
  const receipt = body.receipt;
  if (
    body.status !== "PASS"
    || receipt?.operationId !== expected.operationId
    || receipt?.requestId !== expected.requestId
    || receipt?.capabilityBindingDigest !== expected.capabilityBindingDigest
    || !/^[a-f0-9]{64}$/.test(receipt?.receiptDigest ?? "")
    || receipt?.finalDigest !== receipt?.beforeDigest
  ) return false;
  if (expected.operationId === "habitat.temperature.read") {
    return receipt.outcome === "SYNTHETIC_READ_NO_CHANGE_VERIFIED"
      && receipt.effectDigest === receipt.beforeDigest
      && receipt.route === "AUTO_EXECUTE"
      && receipt.approvalDigest === null;
  }
  return receipt.outcome === "SYNTHETIC_REVERSIBLE_WRITE_ROLLBACK_VERIFIED"
    && receipt.effectDigest !== receipt.beforeDigest
    && receipt.route === "OWNER_APPROVAL"
    && receipt.approvalDigest === expected.approvalDigest;
}

export default definePluginEntry({
  id: "chimpmaera-builder",
  name: "ChimpMaera BLD-001 Builder Gateway",
  description: "Two closed typed requests through the isolated synthetic Builder Gateway/Broker.",
  register(api) {
    const config = api.pluginConfig;
    api.registerTool({
      name: "chimpmaera_builder_request",
      description: "Execute one admitted synthetic Builder operation through Gateway/Broker mediation.",
      parameters,
      async execute(_id, params) {
        const expected = exactRequest(params);
        const response = await fetch(`${config.baseUrl}/v1/builder/execute`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-cm-workload-identity": config.workloadIdentity,
          },
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(10_000),
        });
        const body = await response.json();
        if (!response.ok || !validReceipt(body, expected)) {
          throw new Error(`CM_BUILDER_GATEWAY_DENIED_${body.error ?? response.status}`);
        }
        return {
          content: [{ type: "text", text: JSON.stringify(body) }],
          details: body,
        };
      },
    });
  },
});
