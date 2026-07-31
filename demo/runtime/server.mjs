import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import {
  buildPocGuidedDemoSetupPlanV1,
  expectedPocGuidedDemoTemplatesV1,
} from "./dist/packages/contracts/src/index.js";
import {
  PocEarlyAdminCoordinatorV1,
  createPocEarlyAdminDashboardServerV1,
} from "./dist/packages/setup-coordinator/src/index.js";
import {
  DemoMutationGate,
  authorizeLocalRequest,
  createHttpProvider,
} from "./enforcement-gate.mjs";
import { AdminAiPoc, validateAdminAiPocPolicy } from "./admin-ai-poc.mjs";
import { ApprovalWorkbench } from "./approval-workbench.mjs";

const authorityProfile = process.env.CM_AUTHORITY_PROFILE ?? "SAFE_GUIDED";
const authorityManifestId = process.env.CM_AUTHORITY_MANIFEST_ID
  ?? `${authorityProfile}-v1`;
if (!/^(?:SAFE_GUIDED|RAMPAGE)-v1$/.test(authorityManifestId)) {
  throw new Error("UNKNOWN_AUTHORITY_MANIFEST_DENIED");
}
const authorityManifestBytes = readFileSync(
  `./manifests/authority/${authorityManifestId}.json`,
);
const authorityManifestSha256 = createHash("sha256")
  .update(authorityManifestBytes)
  .digest("hex");
if (
  !/^[a-f0-9]{64}$/.test(process.env.CM_AUTHORITY_MANIFEST_SHA256 ?? "")
  || process.env.CM_AUTHORITY_MANIFEST_SHA256 !== authorityManifestSha256
) {
  throw new Error("AUTHORITY_MANIFEST_DIGEST_MISMATCH_DENIED");
}
const authorityManifest = JSON.parse(authorityManifestBytes.toString("utf8"));
const manifestShapeValid =
  authorityManifest.schemaVersion === "chimpmaera.demo/authority-manifest/v1"
  && authorityManifest.manifestId === authorityManifestId
  && authorityManifest.selectedProfile === authorityProfile
  && authorityManifest.isolation?.composeProjectOnly === true
  && authorityManifest.isolation?.loopbackOnly === true
  && authorityManifest.isolation?.dockerSocketMounted === false
  && authorityManifest.isolation?.hostPrivilegeGranted === false
  && authorityManifest.isolation?.foreignResourceAccess === "DENIED";
if (!manifestShapeValid) {
  throw new Error("AUTHORITY_MANIFEST_INVALID_DENIED");
}
const expectedChimpMaeraProfile = authorityProfile === "SAFE_GUIDED"
  ? "SAFE_GUIDED"
  : authorityProfile === "RAMPAGE"
    ? "FULL_CONTROL_LAB"
    : null;
if (
  expectedChimpMaeraProfile === null
  || authorityManifest.chimpMaeraProfileId !== expectedChimpMaeraProfile
) {
  throw new Error("AUTHORITY_PROFILE_MAPPING_INVALID_DENIED");
}

const adminAiPolicyId = process.env.CM_ADMIN_AI_POLICY_ID
  ?? "admin-ai-poc-policy-v1";
if (adminAiPolicyId !== "admin-ai-poc-policy-v1") {
  throw new Error("UNKNOWN_ADMIN_AI_POLICY_DENIED");
}
const adminAiPolicyBytes = readFileSync(
  `./manifests/authority/${adminAiPolicyId}.json`,
);
const adminAiPolicySha256 = createHash("sha256")
  .update(adminAiPolicyBytes)
  .digest("hex");
if (
  !/^[a-f0-9]{64}$/.test(process.env.CM_ADMIN_AI_POLICY_SHA256 ?? "")
  || process.env.CM_ADMIN_AI_POLICY_SHA256 !== adminAiPolicySha256
) throw new Error("ADMIN_AI_POLICY_DIGEST_MISMATCH_DENIED");
const adminAiPolicy = validateAdminAiPocPolicy(
  JSON.parse(adminAiPolicyBytes.toString("utf8")),
);

const catalogManifestId = process.env.CM_CATALOG_MANIFEST_ID
  ?? "crm-erp-playable-v1";
if (catalogManifestId !== "crm-erp-playable-v1") {
  throw new Error("UNKNOWN_CATALOG_MANIFEST_DENIED");
}
const catalogManifestBytes = readFileSync(
  `./manifests/catalog/${catalogManifestId}.json`,
);
const catalogManifestSha256 = createHash("sha256")
  .update(catalogManifestBytes)
  .digest("hex");
if (
  !/^[a-f0-9]{64}$/.test(process.env.CM_CATALOG_MANIFEST_SHA256 ?? "")
  || process.env.CM_CATALOG_MANIFEST_SHA256 !== catalogManifestSha256
) {
  throw new Error("CATALOG_MANIFEST_DIGEST_MISMATCH_DENIED");
}
const catalogManifest = JSON.parse(catalogManifestBytes.toString("utf8"));
const catalogCounts = {
  templates: catalogManifest.templates?.length,
  useCases: catalogManifest.useCases?.length,
  metadataRecords: catalogManifest.metadata?.length,
};
if (
  catalogManifest.schemaVersion !== "chimpmaera.demo/catalog-bundle/v1"
  || catalogManifest.bundleId !== catalogManifestId
  || catalogManifest.catalogVersion !== "1.0.0"
  || JSON.stringify(catalogCounts)
    !== JSON.stringify(catalogManifest.expectedCounts)
  || new Set(catalogManifest.templates?.map(({ templateId }) => templateId))
    .size !== catalogCounts.templates
  || new Set(catalogManifest.useCases?.map(({ useCaseId }) => useCaseId))
    .size !== catalogCounts.useCases
  || new Set(catalogManifest.metadata?.map(({ metadataId }) => metadataId))
    .size !== catalogCounts.metadataRecords
) {
  throw new Error("CATALOG_MANIFEST_INVALID_DENIED");
}
const apiToken = readFileSync("/run/secrets/api_token", "utf8").trim();
if (apiToken.length < 32) {
  throw new Error("CHIMPMAERA_API_TOKEN_INVALID_DENIED");
}
const controlToken = readFileSync("/run/secrets/control_token", "utf8").trim();
const ownerAuthorityKeyPath = "/var/lib/chimpmaera/owner-authority.key";
let ownerAuthorityToken;
try {
  ownerAuthorityToken = readFileSync(ownerAuthorityKeyPath, "utf8").trim();
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  ownerAuthorityToken = randomBytes(48).toString("hex");
  try {
    writeFileSync(ownerAuthorityKeyPath, ownerAuthorityToken + "\n", {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (writeError) {
    if (writeError?.code !== "EEXIST") throw writeError;
    ownerAuthorityToken = readFileSync(ownerAuthorityKeyPath, "utf8").trim();
  }
}
if (ownerAuthorityToken.length < 64) {
  throw new Error("OWNER_AUTHORITY_KEY_INVALID_DENIED");
}
const espoPassword = readFileSync("/run/secrets/espo_admin", "utf8").trim();
const doliApiKey = readFileSync("/run/secrets/doli_api_key", "utf8").trim();
const expectedOrigin = process.env.CM_PUBLIC_ORIGIN ?? "";
if (!/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(expectedOrigin)) {
  throw new Error("CHIMPMAERA_PUBLIC_ORIGIN_INVALID_DENIED");
}
const provider = createHttpProvider({ espoPassword, doliApiKey });
const mutationGate = new DemoMutationGate({
  apiToken,
  controlToken,
  ownerAuthorityToken,
  expectedOrigin,
  receiptPath: "/var/lib/chimpmaera/effect-store.json",
  provider,
  adminAiPolicyDigest: adminAiPolicySha256,
});
const adminAiPoc = new AdminAiPoc({
  policy: adminAiPolicy,
  policyDigest: adminAiPolicySha256,
  signAuthority: (fields) => mutationGate.agentAuthority(fields),
});
const approvalWorkbench = new ApprovalWorkbench({
  receiptPath: "/var/lib/chimpmaera/approval-workbench-store.json",
  issueAuthority: (fields) => mutationGate.ownerAuthority(fields),
  policyDigest: adminAiPolicySha256,
  policyGeneration: mutationGate.authorityContext.policyGeneration,
  profileId: mutationGate.authorityContext.profileId,
  profileGeneration: mutationGate.authorityContext.profileGeneration,
});

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 256 * 1024) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(chunk);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("REQUEST_INVALID");
  }
  return value;
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json",
    "x-content-type-options": "nosniff",
  });
  response.end(`${JSON.stringify(value)}\n`);
}

const showcase = JSON.parse(
  readFileSync("./examples/poc-release/showcase-v1.json", "utf8"),
);
const plan = buildPocGuidedDemoSetupPlanV1(
  showcase,
  expectedPocGuidedDemoTemplatesV1(),
  { templateId: process.env.CM_TEMPLATE_ID ?? "quick-tour" },
);
const coordinator = new PocEarlyAdminCoordinatorV1(
  plan,
  "/var/lib/chimpmaera",
  { resume: true },
);
if (authorityManifest.chimpMaeraProfileId === "FULL_CONTROL_LAB") {
  coordinator.activateAuthority({
    requestedProfileId: "FULL_CONTROL_LAB",
    source: "OWNER",
    contextId: coordinator.status().sessionId,
    explicitOwnerConfirmation:
      `I ACCEPT FULL_CONTROL_LAB RISK FOR ${coordinator.status().sessionId}`,
  });
}
if (coordinator.status().health.status !== "PASS") {
  coordinator.runSyntheticSetup();
}

// The actual Stage-A server deliberately accepts loopback clients only. A
// same-container proxy exposes it to the Compose network while preserving that
// invariant: the application itself still observes 127.0.0.1 as its peer.
const application = createPocEarlyAdminDashboardServerV1(
  coordinator,
  "127.0.0.1",
);
await new Promise((resolve, reject) => {
  application.once("error", reject);
  application.listen(4173, "127.0.0.1", resolve);
});

const proxy = createServer((incoming, outgoing) => {
  const run = async () => {
  if (incoming.url === "/api/demo/catalog") {
    const presented = incoming.headers.authorization?.replace(/^Bearer /, "")
      ?? "";
    const presentedBytes = Buffer.from(presented);
    const expectedBytes = Buffer.from(apiToken);
    if (
      presentedBytes.length !== expectedBytes.length
      || !timingSafeEqual(presentedBytes, expectedBytes)
    ) {
      outgoing.writeHead(401, {
        "content-type": "application/json",
        "www-authenticate": "Bearer",
      });
      outgoing.end('{"error":"AUTHENTICATION_REQUIRED"}\n');
      return;
    }
    outgoing.writeHead(200, { "content-type": "application/json" });
    outgoing.end(`${JSON.stringify({
      status: "PASS",
      bundle: {
        bundleId: catalogManifest.bundleId,
        catalogVersion: catalogManifest.catalogVersion,
        sha256: catalogManifestSha256,
      },
      templates: catalogManifest.templates,
      useCases: catalogManifest.useCases,
      metadata: catalogManifest.metadata,
      exactCounts: catalogCounts,
    })}\n`);
    return;
  }
  if (
    incoming.method === "POST"
    && incoming.url === "/api/demo/admin-ai/request"
  ) {
    authorizeLocalRequest(incoming, {
      apiToken,
      expectedOrigin,
    });
    if (authorityProfile !== "SAFE_GUIDED") {
      throw new Error("ADMIN_AI_POC_SAFE_GUIDED_REQUIRED");
    }
    const result = adminAiPoc.decide(await readJson(incoming));
    sendJson(outgoing, 200, {
      ...result,
      ...(result.decision.outcome === "OWNER_ESCALATION"
        ? { proposal: approvalWorkbench.register(result.decision) }
        : {}),
    });
    return;
  }
  if (
    incoming.method === "POST"
    && incoming.url === "/api/demo/admin-ai/owner-decision"
  ) {
    authorizeLocalRequest(incoming, {
      apiToken,
      expectedOrigin,
    });
    if (authorityProfile !== "SAFE_GUIDED") {
      throw new Error("ADMIN_AI_POC_SAFE_GUIDED_REQUIRED");
    }
    const body = await readJson(incoming);
    if (
      JSON.stringify(Object.keys(body).sort())
        !== JSON.stringify(["decisionDigest", "ownerDecision"])
    ) throw new Error("OWNER_DECISION_INVALID_DENIED");
    sendJson(outgoing, 200, approvalWorkbench.decide({
      ...body,
      ownerActor: "owner:local-demo",
    }));
    return;
  }
  if (
    incoming.method === "POST"
    && incoming.url === "/api/demo/effects"
  ) {
    const result = await mutationGate.execute(incoming, await readJson(incoming));
    sendJson(outgoing, 200, result);
    return;
  }
  if (
    incoming.method === "POST"
    && incoming.url === "/api/demo/provider-read"
  ) {
    authorizeLocalRequest(incoming, {
      apiToken,
      expectedOrigin,
    });
    const body = await readJson(incoming);
    const allowed = body.provider === "espocrm"
      ? /^\/(?:Account|Contact|Opportunity)(?:\/[A-Za-z0-9_-]+)?$/
      : body.provider === "dolibarr"
        ? /^\/(?:setup\/company|thirdparties|orders)(?:\/[A-Za-z0-9_-]+)?$/
        : null;
    if (
      allowed === null
      || typeof body.path !== "string"
      || !allowed.test(body.path)
      || body.query === null
      || typeof (body.query ?? {}) !== "object"
      || Array.isArray(body.query)
    ) throw new Error("PROVIDER_READ_SCOPE_DENIED");
    sendJson(
      outgoing,
      200,
      { status: "PASS", value: await provider.read(
        body.provider,
        body.path,
        body.query ?? {},
      ) },
    );
    return;
  }
  if (
    incoming.method === "GET"
    && incoming.url?.startsWith(
      "/api/demo/admin-ai/owner-decision-receipt?",
    )
  ) {
    authorizeLocalRequest(incoming, {
      apiToken,
      expectedOrigin,
      requireCsrf: false,
    });
    const digest = new URL(incoming.url, expectedOrigin)
      .searchParams.get("decisionDigest");
    sendJson(outgoing, 200, approvalWorkbench.readDecision(digest ?? ""));
    return;
  }
  if (
    incoming.method === "GET"
    && incoming.url?.startsWith("/api/demo/effect-receipt?")
  ) {
    authorizeLocalRequest(incoming, {
      apiToken,
      expectedOrigin,
      requireCsrf: false,
    });
    const key = new URL(incoming.url, expectedOrigin).searchParams.get("replayKey");
    const record = mutationGate.state.effects[key ?? ""];
    if (record === undefined) throw new Error("EFFECT_RECEIPT_NOT_FOUND");
    sendJson(outgoing, 200, { status: "PASS", receipt: record.receipt });
    return;
  }
  if (incoming.method === "POST" && incoming.url?.startsWith("/api/")) {
    authorizeLocalRequest(incoming, {
      apiToken,
      expectedOrigin,
    });
  }
  const upstream = httpRequest({
    host: "127.0.0.1",
    port: 4173,
    method: incoming.method,
    path: incoming.url,
    headers: incoming.headers,
  }, (response) => {
    outgoing.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(outgoing);
  });
  upstream.on("error", () => {
    if (!outgoing.headersSent) {
      outgoing.writeHead(502, { "content-type": "application/json" });
    }
    outgoing.end('{"error":"CHIMPMAERA_UPSTREAM_UNAVAILABLE"}\n');
  });
  incoming.pipe(upstream);
  };
  run().catch((error) => {
    if (!outgoing.headersSent) {
      const code = error instanceof Error ? error.message : "REQUEST_FAILED";
      sendJson(outgoing, 403, { error: code });
    } else {
      outgoing.end();
    }
  });
});
await new Promise((resolve, reject) => {
  proxy.once("error", reject);
  proxy.listen(8080, "0.0.0.0", resolve);
});

const close = () => {
  proxy.close(() => application.close());
};
process.once("SIGINT", close);
process.once("SIGTERM", close);
