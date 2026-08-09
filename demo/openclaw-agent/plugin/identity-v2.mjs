import { createHash } from "node:crypto";

const PROOF_DOMAIN = "chimpmaera-public-synthetic-identity-v2-not-a-secret";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function deny(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exactKeys(value, keys) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).sort().join("\n") === [...keys].sort().join("\n");
}

function proofFor(claims) {
  return sha256(`${PROOF_DOMAIN}\n${canonical(claims)}`);
}

export function createSyntheticIdentity(contract, {
  correlationId,
  jti,
  issuedAt = contract.clock.now,
  expiresAt,
  overrides = {},
} = {}) {
  const issued = Date.parse(issuedAt);
  const expiry = expiresAt ?? new Date(issued + contract.clock.maxTtlSeconds * 1000).toISOString();
  const claims = {
    schemaVersion: contract.identity.schemaVersion,
    subject: contract.identity.subject,
    audience: contract.identity.audience,
    tenant: contract.identity.tenant,
    scope: [...contract.identity.scope],
    route: contract.identity.route,
    correlationId,
    jti,
    issuedAt,
    expiresAt: expiry,
    ...overrides,
  };
  return { claims, proof: proofFor(claims) };
}

export function createInvocationIdentity(contract, { requestId, invocationId } = {}) {
  if (!/^aas035-[a-z0-9-]{8,48}$/.test(requestId ?? "")
    || typeof invocationId !== "string"
    || !/^[a-zA-Z0-9-]{8,128}$/.test(invocationId)) {
    deny("IDENTITY_INVOCATION_DENIED");
  }
  const invocationDigest = sha256(`chimpmaera-synthetic-invocation-v2\n${invocationId}`).slice(0, 12);
  const correlationId = `corr-${requestId}-${invocationDigest}`;
  return {
    correlationId,
    identity: createSyntheticIdentity(contract, {
      correlationId,
      jti: `jti-${requestId}-${invocationDigest}`,
    }),
  };
}

export function encodeSyntheticIdentity(identity) {
  return Buffer.from(canonical(identity)).toString("base64url");
}

export function decodeSyntheticIdentity(value) {
  if (typeof value !== "string" || !value.startsWith("Synthetic ")) deny("IDENTITY_MISSING_DENIED");
  try {
    const decoded = JSON.parse(Buffer.from(value.slice(10), "base64url").toString("utf8"));
    if (!exactKeys(decoded, ["claims", "proof"]) || typeof decoded.proof !== "string") {
      deny("IDENTITY_FORMAT_DENIED");
    }
    return decoded;
  } catch (error) {
    if (error?.code) throw error;
    deny("IDENTITY_FORMAT_DENIED");
  }
}

export function authorizeGatewayRequest(contract, request, { now = contract.clock.now, replayIds = new Set() } = {}) {
  const allowed = contract.networkPolicy.egress.allow;
  if (!Array.isArray(allowed) || allowed.length !== 1 || contract.networkPolicy.default !== "DENY") {
    deny("NETWORK_POLICY_INVALID_DENIED");
  }
  const path = request.path;
  const target = allowed[0];
  if (request.protocol !== target.protocol) deny("PROTOCOL_DENIED");
  if (request.dnsTarget !== contract.networkPolicy.dns.allow[0]) deny("DNS_TARGET_DENIED");
  if (request.host !== target.host || request.port !== target.port) deny("DESTINATION_DENIED");
  if (request.method !== target.method || path !== target.path) deny("ROUTE_DENIED");

  const identity = decodeSyntheticIdentity(request.authorization);
  const claims = identity.claims;
  const claimKeys = [
    "audience", "correlationId", "expiresAt", "issuedAt", "jti", "route",
    "schemaVersion", "scope", "subject", "tenant",
  ];
  if (!exactKeys(claims, claimKeys) || identity.proof !== proofFor(claims)) deny("IDENTITY_PROOF_DENIED");
  if (claims.schemaVersion !== contract.identity.schemaVersion || claims.subject !== contract.identity.subject) {
    deny("IDENTITY_SUBJECT_DENIED");
  }
  if (claims.audience !== contract.identity.audience) deny("IDENTITY_AUDIENCE_DENIED");
  if (claims.tenant !== contract.identity.tenant) deny("IDENTITY_TENANT_DENIED");
  if (canonical(claims.scope) !== canonical(contract.identity.scope)) deny("IDENTITY_SCOPE_DENIED");
  if (claims.route !== target.path) deny("IDENTITY_ROUTE_DENIED");
  if (claims.correlationId !== request.correlationId || !/^corr-aas035-[a-z0-9-]{8,64}$/.test(claims.correlationId ?? "")) {
    deny("IDENTITY_CORRELATION_DENIED");
  }
  if (!/^jti-aas035-[a-z0-9-]{8,64}$/.test(claims.jti ?? "")) deny("IDENTITY_JTI_DENIED");
  const issued = Date.parse(claims.issuedAt);
  const expires = Date.parse(claims.expiresAt);
  const current = Date.parse(now);
  if (![issued, expires, current].every(Number.isFinite) || issued > current) deny("IDENTITY_TIME_DENIED");
  if (expires <= current) deny("IDENTITY_EXPIRED_DENIED");
  if (expires - issued > contract.clock.maxTtlSeconds * 1000 || expires <= issued) deny("IDENTITY_TTL_DENIED");
  if (replayIds.has(claims.jti)) deny("IDENTITY_REPLAY_DENIED");
  if (!Number.isInteger(contract.identity.replayCacheMaxEntries)
    || contract.identity.replayCacheMaxEntries < 1
    || replayIds.size >= contract.identity.replayCacheMaxEntries) {
    deny("IDENTITY_REPLAY_CACHE_FULL_DENIED");
  }
  replayIds.add(claims.jti);

  return {
    schemaVersion: "chimpmaera.openclaw/gateway-authorization-result/v2",
    status: "ALLOW",
    correlationId: claims.correlationId,
    identity: {
      subject: claims.subject,
      audience: claims.audience,
      tenant: claims.tenant,
      scope: claims.scope,
      issuedAt: claims.issuedAt,
      expiresAt: claims.expiresAt,
    },
    network: { protocol: target.protocol, host: target.host, port: target.port, method: target.method, path: target.path },
  };
}

export function sanitizedDenial(error, correlationId = null) {
  const candidate = typeof error?.code === "string" ? error.code : error?.message;
  const code = typeof candidate === "string" && /^[A-Z0-9_]+_DENIED$/.test(candidate)
    ? candidate
    : "REQUEST_DENIED";
  return {
    schemaVersion: "chimpmaera.openclaw/gateway-denial/v2",
    status: "DENY",
    correlationId: typeof correlationId === "string" && /^corr-aas035-[a-z0-9-]{8,64}$/.test(correlationId)
      ? correlationId
      : null,
    code,
  };
}
