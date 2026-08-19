import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  createInvocationIdentity,
  encodeSyntheticIdentity,
  sanitizedGatewayDenialMessage,
} from "./identity-v2.mjs";
import { syntheticOpenClawM14Request } from "../capability-m1-4-adapter.mjs";
import { validateOpenClawM14GatewayResponse } from "./response-v1.mjs";

const workloadContract = JSON.parse(readFileSync("/opt/chimpmaera/gateway-workload-contract-v2.json", "utf8"));

const parameterTemplate = syntheticOpenClawM14Request({
  correlationId: ["corr", "aas035", "openclaw", "m14", "parameter", "template"].join("-"),
  workloadIdentity: workloadContract.identity.subject,
});
const { correlationId: _generatedCorrelation, ...parameterSurface } = parameterTemplate;
const expected = Object.freeze(parameterSurface);
const parameters = {
  type: "object",
  additionalProperties: false,
  required: Object.keys(expected),
  properties: {
    schemaVersion: { const: expected.schemaVersion },
    catalogueVersion: { const: expected.catalogueVersion },
    catalogueDigest: { const: expected.catalogueDigest },
    actionId: { const: expected.actionId },
    actionVersion: { const: expected.actionVersion },
    actionDigest: { const: expected.actionDigest },
    resource: { const: expected.resource },
    tenant: { const: expected.tenant },
    workloadIdentity: { const: expected.workloadIdentity },
    userIdentity: { const: expected.userIdentity },
    policyDigest: { const: expected.policyDigest },
    requestId: { type: "string", pattern: "^request:openclaw-m14-[a-z0-9-]{4,40}$" },
    evidenceSink: {
      type: "object",
      additionalProperties: false,
      required: ["type", "sinkId"],
      properties: {
        type: { const: expected.evidenceSink.type },
        sinkId: { const: expected.evidenceSink.sinkId },
      },
    },
    request: {
      type: "object",
      additionalProperties: false,
      required: ["email", "name"],
      properties: {
        email: { const: "alex@example.test" },
        name: { const: "Alex Example" },
      },
    },
  },
};

function exactRequest(params) {
  const expectedKeys = Object.keys(expected).sort();
  if (JSON.stringify(Object.keys(params).sort()) !== JSON.stringify(expectedKeys)) {
    throw new Error("CM_TYPED_REQUEST_SURFACE_DENIED");
  }
  for (const [key, value] of Object.entries(expected)) {
    if (["requestId", "request", "evidenceSink"].includes(key)) continue;
    if (params[key] !== value) throw new Error("CM_TYPED_REQUEST_BINDING_DENIED");
  }
  if (!/^request:openclaw-m14-[a-z0-9-]{4,40}$/.test(params.requestId)) {
    throw new Error("CM_TYPED_REQUEST_ID_DENIED");
  }
  if (
    JSON.stringify(Object.keys(params.evidenceSink ?? {}).sort()) !== JSON.stringify(["sinkId", "type"])
    || params.evidenceSink.type !== expected.evidenceSink.type
    || params.evidenceSink.sinkId !== expected.evidenceSink.sinkId
  ) throw new Error("CM_TYPED_EVIDENCE_SINK_DENIED");
  if (
    JSON.stringify(Object.keys(params.request ?? {}).sort()) !== JSON.stringify(["email", "name"])
    || params.request.email !== "alex@example.test"
    || params.request.name !== "Alex Example"
  ) throw new Error("CM_TYPED_REQUEST_PAYLOAD_DENIED");
}

export default definePluginEntry({
  id: "chimpmaera-capability",
  name: "PanSphaira OPENCLAW-M1.4 Capability Gateway",
  description: "One closed schema-validated synthetic CRM request path to the Capability Gateway.",
  register(api) {
    const config = api.pluginConfig;
    api.registerTool({
      name: "chimpmaera_capability_request",
      description: "Submit the exact synthetic contact request through PanSphaira Gateway/Broker mediation.",
      parameters,
      async execute(_id, params) {
        exactRequest(params);
        const { correlationId, identity } = createInvocationIdentity(workloadContract, {
          requestId: params.requestId,
          invocationId: randomUUID(),
        });
        const request = { ...params, correlationId };
        const response = await fetch(`${config.baseUrl}/v2/broker/capabilities/execute`, {
          method: "POST",
          headers: {
            authorization: `Synthetic ${encodeSyntheticIdentity(identity)}`,
            "content-type": "application/json",
            "x-cm-correlation-id": correlationId,
            "x-cm-request-schema": request.schemaVersion,
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(10_000),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(sanitizedGatewayDenialMessage(body, response.status));
        const validated = validateOpenClawM14GatewayResponse(body, {
          correlationId, requestId: params.requestId, workloadContract,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(validated.result) }],
          details: validated,
        };
      },
    });
  },
});
