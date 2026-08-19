import { readFile } from "node:fs/promises";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const packageDigest = "faf26ff2d3176a0a05e427bfe1fdcead61f9017856c6a335bc13abcd6294b927";
const requestParameters = {
  type: "object", additionalProperties: false, required: ["requestId"],
  properties: {requestId: {type: "string", const: "aas037-openclaw-install-0001"}},
};
const activateParameters = {
  type: "object", additionalProperties: false, required: ["requestId"],
  properties: {requestId: {type: "string", const: "aas037-openclaw-activate-0001"}},
};

async function post(config, path, body) {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {"content-type": "application/json", "x-cm-workload-identity": config.workloadIdentity},
    body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
  });
  const value = await response.json();
  if (!response.ok || value.status !== "PASS") throw new Error(`CM_SKILL_LIFECYCLE_DENIED_${value.error ?? response.status}`);
  return value;
}

export default definePluginEntry({
  id: "chimpmaera-skill-lifecycle",
  name: "PanSphaira AAS-037 Managed Skill Lifecycle",
  description: "Request admission, then separately activate and read one digest-bound skill.",
  register(api) {
    const config = api.pluginConfig;
    api.registerTool({
      name: "chimpmaera_skill_request",
      description: "Request installation of the exact immutable Zoo Greeter skill without granting capabilities.",
      parameters: requestParameters,
      async execute(_id, params) {
        if (params.requestId !== "aas037-openclaw-install-0001") throw new Error("CM_SKILL_REQUEST_ID_DENIED");
        const value = await post(config, "/v1/skills/request", {
          schemaVersion: "chimpmaera.aas037/skill-request/v1",
          operationId: params.requestId,
          tenant: "tenant:panskys-zoo",
          requester: "workload:openclaw-agent",
          source: {kind: "LOCAL_CONTENT", locator: `skill+sha256:${packageDigest}`, version: "1.0.0", digest: packageDigest, mutable: false},
          skill: {id: "skill:zoo-greeter", version: "1.0.0", fileDigest: "4a16a8e922db2a196bb47b7806dee7e777f116e99a25c9eb76e88b79ac4867a7"},
          requestedCapabilities: [],
        });
        return {content: [{type: "text", text: JSON.stringify(value)}], details: value};
      },
    });
    api.registerTool({
      name: "chimpmaera_skill_activate_use",
      description: "Separately activate the already installed skill and read its managed read-only SKILL.md.",
      parameters: activateParameters,
      async execute(_id, params) {
        if (params.requestId !== "aas037-openclaw-activate-0001") throw new Error("CM_SKILL_ACTIVATION_ID_DENIED");
        const value = await post(config, "/v1/skills/activate", {
          schemaVersion: "chimpmaera.aas037/skill-activation/v1", operationId: params.requestId,
          tenant: "tenant:panskys-zoo", skillId: "skill:zoo-greeter", packageDigest,
        });
        const skill = await readFile("/opt/chimpmaera/workspace/skills/zoo-greeter/SKILL.md", "utf8");
        const greeting = skill.match(/`([^`]+)`/)?.[1];
        if (greeting !== "Hello from the Zoo") throw new Error("CM_SKILL_USE_READBACK_DENIED");
        const result = {...value, greeting, authority: "NONE", storeAccess: "READ_ONLY"};
        return {content: [{type: "text", text: JSON.stringify(result)}], details: result};
      },
    });
  },
});
