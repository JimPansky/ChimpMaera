import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function equalSecret(presented, expected) {
  const left = Buffer.from(presented ?? "");
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function authorizeLocalRequest(request, {
  apiToken,
  expectedOrigin,
  requireCsrf = true,
}) {
  const bearer = request.headers.authorization?.replace(/^Bearer /, "") ?? "";
  if (!equalSecret(bearer, apiToken)) throw new Error("AUTHENTICATION_REQUIRED");
  if (request.headers.origin !== expectedOrigin) {
    throw new Error("SAME_ORIGIN_REQUIRED");
  }
  if (request.headers.host !== new URL(expectedOrigin).host) {
    throw new Error("CANONICAL_HOST_REQUIRED");
  }
  if (requireCsrf && request.headers["x-cm-csrf"] !== "chimpmaera-local-v1") {
    throw new Error("CSRF_TOKEN_REQUIRED");
  }
}

function validateActionShape(action) {
  if (action === null || typeof action !== "object" || Array.isArray(action)) {
    throw new Error("ACTION_INVALID");
  }
  const allowedTop = ["actionType", "actor", "payload", "replayKey", "scope"];
  if (
    JSON.stringify(Object.keys(action).sort()) !== JSON.stringify(allowedTop)
    || action.actionType !== "PROVIDER_MUTATION"
    || !["installer:seed-and-flow", "agent:admin-ai-poc"].includes(action.actor)
    || typeof action.replayKey !== "string"
    || !/^[a-zA-Z0-9:._-]{8,180}$/.test(action.replayKey)
    || action.scope === null
    || typeof action.scope !== "object"
    || Array.isArray(action.scope)
    || action.payload === null
    || typeof action.payload !== "object"
    || Array.isArray(action.payload)
  ) throw new Error("UNKNOWN_ACTION_DENIED");
}

function validateAdminAiAction(action) {
  const expected = {
    actionType: "PROVIDER_MUTATION",
    actor: "agent:admin-ai-poc",
    payload: {
      body: {
        description: "ChimpMaera Admin AI deterministic PoC contact",
        emailAddress: "admin-ai-poc@example.invalid",
        firstName: "Avery",
        lastName: "Admin AI PoC",
      },
      method: "POST",
      path: "/Contact",
    },
    replayKey: action.replayKey,
    scope: {
      actor: "agent:admin-ai-poc",
      entity: "Contact",
      operation: "CREATE_IF_ABSENT",
      provider: "espocrm",
      tenant: "panskys-zoo-demo",
    },
  };
  if (
    !/^admin-ai:poc:[a-zA-Z0-9:._-]{8,140}$/.test(action.replayKey)
    || canonicalJson(action) !== canonicalJson(expected)
  ) throw new Error("AGENT_ACTION_SCOPE_DENIED");
}

function validateMutationScope(action) {
  const { scope, payload } = action;
  if (
    scope.tenant !== "panskys-zoo-demo"
    || payload.method !== "POST"
    || typeof payload.path !== "string"
    || payload.body === null
    || typeof payload.body !== "object"
    || Array.isArray(payload.body)
  ) throw new Error("SCOPE_MISMATCH_DENIED");

  const allowed = scope.provider === "espocrm"
    ? {
      Account: /^\/Account$/,
      Contact: /^\/Contact$/,
      Opportunity: /^\/Opportunity$/,
    }[scope.entity]
    : scope.provider === "dolibarr"
      ? {
        ThirdParty: /^\/thirdparties$/,
        Order: /^\/orders$/,
        OrderLine: /^\/orders\/[1-9][0-9]*\/lines$/,
      }[scope.entity]
      : undefined;
  if (
    allowed === undefined
    || scope.operation !== "CREATE_IF_ABSENT"
    || !allowed.test(payload.path)
  ) throw new Error("SCOPE_MISMATCH_DENIED");
}

function receiptCore(action, actionDigest, providerResult, readback, authority) {
  return {
    schemaVersion: "chimpmaera.demo/effect-receipt/v1",
    actionDigest,
    actor: action.actor,
    scope: action.scope,
    replayKey: action.replayKey,
    provider: {
      objectType: action.scope.entity,
      objectReference: String(
        readback?.id ?? providerResult?.id ?? providerResult,
      ),
    },
    outcome: "PROVIDER_MUTATION_READBACK_VERIFIED",
    replayState: "FIRST_EXECUTION",
    readbackDigest: sha256(canonicalJson(readback)),
    ...(authority === undefined ? {} : {
      authority: { kind: authority.kind },
      decisionDigest: authority.decisionDigest,
      policyDigest: authority.policyDigest,
    }),
  };
}

export class DemoMutationGate {
  constructor({
    apiToken,
    controlToken,
    expectedOrigin,
    receiptPath,
    provider,
    adminAiPolicyDigest,
  }) {
    if (apiToken.length < 32 || controlToken.length < 32) {
      throw new Error("GATE_SECRET_INVALID");
    }
    this.apiToken = apiToken;
    this.controlToken = controlToken;
    this.expectedOrigin = expectedOrigin;
    this.receiptPath = receiptPath;
    this.provider = provider;
    this.adminAiPolicyDigest = adminAiPolicyDigest;
    this.state = { schemaVersion: "chimpmaera.demo/effect-store/v1", effects: {} };
    try {
      this.state = JSON.parse(readFileSync(receiptPath, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  authorize(request) {
    authorizeLocalRequest(request, {
      apiToken: this.apiToken,
      expectedOrigin: this.expectedOrigin,
    });
  }

  approvalBinding(actionDigest, action) {
    const scopeDigest = sha256(canonicalJson(action.scope));
    return createHmac("sha256", this.controlToken)
      .update(`${actionDigest}\n${action.actor}\n${scopeDigest}\n${action.replayKey}`)
      .digest("hex");
  }

  agentAuthority(fields) {
    const core = {
      kind: "ADMIN_AI_POC_HMAC_V1",
      actor: fields.actor,
      scope: fields.scope,
      actionDigest: fields.actionDigest,
      replayKey: fields.replayKey,
      policyDigest: fields.policyDigest,
      decisionDigest: fields.decisionDigest,
    };
    return {
      ...core,
      binding: createHmac("sha256", this.controlToken)
        .update(`admin-ai-poc-authority-v1\n${canonicalJson(core)}`)
        .digest("hex"),
    };
  }

  validateAgentAuthority(authority, action, computedDigest) {
    if (
      authority === null
      || typeof authority !== "object"
      || Array.isArray(authority)
      || JSON.stringify(Object.keys(authority).sort()) !== JSON.stringify([
        "actionDigest",
        "actor",
        "binding",
        "decisionDigest",
        "kind",
        "policyDigest",
        "replayKey",
        "scope",
      ])
      || authority.kind !== "ADMIN_AI_POC_HMAC_V1"
      || typeof authority.actor !== "string"
      || typeof authority.actionDigest !== "string"
      || typeof authority.replayKey !== "string"
      || typeof authority.policyDigest !== "string"
      || typeof authority.decisionDigest !== "string"
      || typeof authority.binding !== "string"
      || authority.scope === null
      || typeof authority.scope !== "object"
      || Array.isArray(authority.scope)
      || !/^[a-f0-9]{64}$/.test(authority.actionDigest)
      || !/^[a-f0-9]{64}$/.test(authority.decisionDigest ?? "")
      || !/^[a-f0-9]{64}$/.test(authority.policyDigest ?? "")
      || !/^[a-f0-9]{64}$/.test(authority.binding)
      || !equalSecret(authority.policyDigest, this.adminAiPolicyDigest ?? "")
      || !equalSecret(authority.actor, action.actor)
      || canonicalJson(authority.scope) !== canonicalJson(action.scope)
      || !equalSecret(authority.actionDigest, computedDigest)
      || !equalSecret(authority.replayKey, action.replayKey)
    ) throw new Error("AGENT_AUTHORITY_INVALID_DENIED");
    const expected = this.agentAuthority({
      actor: action.actor,
      scope: action.scope,
      actionDigest: computedDigest,
      replayKey: action.replayKey,
      policyDigest: authority.policyDigest,
      decisionDigest: authority.decisionDigest,
    });
    if (!equalSecret(authority.binding, expected.binding)) {
      throw new Error("AGENT_AUTHORITY_INVALID_DENIED");
    }
  }

  persist() {
    mkdirSync(dirname(this.receiptPath), { recursive: true });
    const temp = `${this.receiptPath}.tmp`;
    writeFileSync(temp, `${JSON.stringify(this.state, null, 2)}\n`, {
      mode: 0o600,
    });
    renameSync(temp, this.receiptPath);
  }

  async execute(request, envelope) {
    this.authorize(request);
    const { action, actionDigest, approval, authority } = envelope ?? {};
    validateActionShape(action);
    if (action.scope.actor !== action.actor) {
      throw new Error("IDENTITY_MISMATCH_DENIED");
    }
    validateMutationScope(action);
    const computedDigest = sha256(canonicalJson(action));
    if (!equalSecret(actionDigest, computedDigest)) {
      throw new Error("ACTION_DIGEST_MISMATCH_DENIED");
    }
    if (action.actor === "agent:admin-ai-poc") {
      validateAdminAiAction(action);
      this.validateAgentAuthority(authority, action, computedDigest);
    } else if (
      approval?.decision !== "APPROVE"
      || approval?.approver !== "owner:local-demo"
      || !equalSecret(approval?.actionDigest, computedDigest)
      || !equalSecret(
        approval?.binding,
        this.approvalBinding(computedDigest, action),
      )
    ) throw new Error("APPROVAL_BINDING_INVALID_DENIED");

    const prior = this.state.effects[action.replayKey];
    if (prior !== undefined) {
      if (prior.actionDigest !== computedDigest) {
        throw new Error("REPLAY_KEY_CONFLICT_DENIED");
      }
      if (
        action.actor === "agent:admin-ai-poc"
        && (
          !equalSecret(prior.receipt.decisionDigest, authority.decisionDigest)
          || !equalSecret(prior.receipt.policyDigest, authority.policyDigest)
        )
      ) throw new Error("REPLAY_AUTHORITY_CONFLICT_DENIED");
      return {
        status: "PASS",
        replayed: true,
        replayState: "REPLAY_NO_DUPLICATE",
        providerResult: prior.providerResult,
        readback: prior.readback,
        receipt: prior.receipt,
      };
    }

    const providerResult = await this.provider.mutate(action);
    const readback = await this.provider.readback(action, providerResult);
    if (
      readback === null
      || typeof readback !== "object"
      || Array.isArray(readback)
    ) throw new Error("PROVIDER_READBACK_REQUIRED");
    const core = receiptCore(
      action,
      computedDigest,
      providerResult,
      readback,
      action.actor === "agent:admin-ai-poc" ? authority : undefined,
    );
    const receipt = {
      ...core,
      receiptDigest: sha256(canonicalJson(core)),
    };
    this.state.effects[action.replayKey] = {
      actionDigest: computedDigest,
      providerResult,
      readback,
      receipt,
    };
    this.persist();
    return {
      status: "PASS",
      replayed: false,
      providerResult,
      readback,
      receipt,
    };
  }
}

export function createHttpProvider({
  espoPassword,
  doliApiKey,
  fetchImpl = fetch,
}) {
  const base = {
    espocrm: "http://espocrm/api/v1",
    dolibarr: "http://dolibarr/api/index.php",
  };
  const headersFor = (provider, json = false) => ({
    ...(provider === "espocrm"
      ? {
        authorization:
          `Basic ${Buffer.from(`admin:${espoPassword}`).toString("base64")}`,
      }
      : { DOLAPIKEY: doliApiKey }),
    ...(json ? { "content-type": "application/json" } : {}),
  });
  const call = async (provider, path, options = {}) => {
    const response = await fetchImpl(`${base[provider]}${path}`, options);
    const text = await response.text();
    if (!response.ok) throw new Error(`PROVIDER_${response.status}_DENIED`);
    try {
      return JSON.parse(text);
    } catch {
      return text.trim();
    }
  };
  return {
    async read(provider, path, query = {}) {
      if (
        !["espocrm", "dolibarr"].includes(provider)
        || typeof path !== "string"
        || !/^\/[A-Za-z0-9/_-]+$/.test(path)
      ) throw new Error("PROVIDER_READ_SCOPE_DENIED");
      const url = new URL(`${base[provider]}${path}`);
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.append(key, String(value));
      }
      const response = await fetchImpl(url, {
        headers: headersFor(provider),
      });
      const text = await response.text();
      if (response.status === 404 && provider === "dolibarr") return [];
      if (!response.ok) throw new Error(`PROVIDER_${response.status}_DENIED`);
      return JSON.parse(text);
    },
    async mutate(action) {
      return call(action.scope.provider, action.payload.path, {
        method: "POST",
        headers: headersFor(action.scope.provider, true),
        body: JSON.stringify(action.payload.body),
      });
    },
    async readback(action, result) {
      const id = typeof result === "object" && result !== null
        ? result.id
        : result;
      if (action.scope.provider === "espocrm") {
        return call("espocrm", `${action.payload.path}/${id}`, {
          headers: headersFor("espocrm"),
        });
      }
      if (action.scope.entity === "OrderLine") {
        const orderPath = action.payload.path.replace(/\/lines$/, "");
        const order = await call("dolibarr", orderPath, {
          headers: headersFor("dolibarr"),
        });
        const matching = (order.lines ?? []).filter((line) =>
          line.desc === action.payload.body.desc
        );
        if (matching.length !== 1) throw new Error("PROVIDER_READBACK_REQUIRED");
        return { ...matching[0], parentOrderId: order.id };
      }
      return call("dolibarr", `${action.payload.path}/${id}`, {
        headers: headersFor("dolibarr"),
      });
    },
  };
}
