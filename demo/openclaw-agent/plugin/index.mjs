import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { readFileSync } from "node:fs";
import { createSyntheticIdentity, encodeSyntheticIdentity } from "./identity-v2.mjs";

const workloadContract = JSON.parse(readFileSync("/opt/chimpmaera/gateway-workload-contract-v2.json", "utf8"));

const expected = Object.freeze({
  schemaVersion: "chimpmaera.aas035/typed-capability-request/v1",
  tenant: "tenant:synthetic-zoo",
  purpose: "purpose:synthetic-contact-fixture",
  catalogueDigest: "1454c6bc785bc5185d7e1dc657cd62b620c2e2f9b79a80ac38e87573adf5c387",
  catalogueVersion: "1.0.0",
  adapterId: "espocrm-local-fixture",
  adapterVersion: "1.0.0",
  actionId: "crm.contact.create",
  resource: "espocrm.contact",
  effect: "CREATE",
});

const parameters = {
  type: "object",
  additionalProperties: false,
  required: [...Object.keys(expected), "requestId", "payload"],
  properties: {
    schemaVersion: { const: expected.schemaVersion },
    tenant: { const: expected.tenant },
    purpose: { const: expected.purpose },
    catalogueDigest: { const: expected.catalogueDigest },
    catalogueVersion: { const: expected.catalogueVersion },
    adapterId: { const: expected.adapterId },
    adapterVersion: { const: expected.adapterVersion },
    actionId: { const: expected.actionId },
    resource: { const: expected.resource },
    effect: { const: expected.effect },
    requestId: { type: "string", pattern: "^aas035-[a-z0-9-]{8,48}$" },
    payload: {
      type: "object",
      additionalProperties: false,
      required: ["email", "name"],
      properties: {
        email: { const: "agent.fixture@synthetic.invalid" },
        name: { const: "AAS-035 Synthetic Agent" },
      },
    },
  },
};

function exactRequest(params) {
  const expectedKeys = [...Object.keys(expected), "requestId", "payload"].sort();
  if (JSON.stringify(Object.keys(params).sort()) !== JSON.stringify(expectedKeys)) {
    throw new Error("CM_TYPED_REQUEST_SURFACE_DENIED");
  }
  for (const [key, value] of Object.entries(expected)) {
    if (params[key] !== value) throw new Error("CM_TYPED_REQUEST_BINDING_DENIED");
  }
  if (!/^aas035-[a-z0-9-]{8,48}$/.test(params.requestId)) {
    throw new Error("CM_TYPED_REQUEST_ID_DENIED");
  }
  if (
    JSON.stringify(Object.keys(params.payload ?? {}).sort()) !== JSON.stringify(["email", "name"])
    || params.payload.email !== "agent.fixture@synthetic.invalid"
    || params.payload.name !== "AAS-035 Synthetic Agent"
  ) throw new Error("CM_TYPED_REQUEST_PAYLOAD_DENIED");
}

export default definePluginEntry({
  id: "chimpmaera-capability",
  name: "ChimpMaera AAS-035 Capability Gateway",
  description: "One closed typed request path to the synthetic Capability Gateway.",
  register(api) {
    const config = api.pluginConfig;
    api.registerTool({
      name: "chimpmaera_capability_request",
      description: "Submit the exact synthetic contact request through ChimpMaera Gateway/Broker mediation.",
      parameters,
      async execute(_id, params) {
        exactRequest(params);
        const correlationId = `corr-${params.requestId}`;
        const identity = createSyntheticIdentity(workloadContract, {
          correlationId,
          jti: `jti-${params.requestId}`,
        });
        const response = await fetch(`${config.baseUrl}/v2/broker/capabilities/execute`, {
          method: "POST",
          headers: {
            authorization: `Synthetic ${encodeSyntheticIdentity(identity)}`,
            "content-type": "application/json",
            "x-cm-correlation-id": correlationId,
          },
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(10_000),
        });
        const body = await response.json();
        if (
          !response.ok
          || body.status !== "PASS"
          || body.correlationId !== correlationId
          || body.result?.receipt?.outcome !== "SYNTHETIC_EFFECT_READBACK_VERIFIED"
          || !/^[a-f0-9]{64}$/.test(body.result?.receipt?.receiptDigest ?? "")
        ) throw new Error(`CM_GATEWAY_DENIED_${body.error ?? response.status}`);
        return {
          content: [{ type: "text", text: JSON.stringify(body.result) }],
          details: body,
        };
      },
    });
  },
});
