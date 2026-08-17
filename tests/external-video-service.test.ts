import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  assertExternalVideoServiceRequestV1,
  configureExternalVideoServiceV1,
  EXTERNAL_VIDEO_SERVICE_MIN_CONTRACT_VERSION_V1,
  EXTERNAL_VIDEO_SERVICE_MIN_PRODUCT_VERSION_V1,
  probeExternalVideoServiceV1,
  type ExternalVideoServiceConfigDecisionV1,
} from "../packages/contracts/src/index.js";

const artifact = "portable-video-reference-archive";
const artifactSha256 = createHash("sha256").update(Buffer.from(artifact)).digest("hex");

const goodEnv = {
  CM_VIDEO_REFERENCE_ARTIFACT_URL: "https://github.com/JimPansky/PANSPHAIRA/releases/download/v0.2.0-poc.20260814.1/chimpmaera-video-reference-2026.08.02-v2.tar.gz",
  CM_VIDEO_REFERENCE_ARTIFACT_SHA256: artifactSha256,
  CM_VIDEO_REFERENCE_VERSION: EXTERNAL_VIDEO_SERVICE_MIN_PRODUCT_VERSION_V1,
  CM_VIDEO_REFERENCE_CONTRACT_VERSION: EXTERNAL_VIDEO_SERVICE_MIN_CONTRACT_VERSION_V1,
  CM_VIDEO_REFERENCE_TIMEOUT_MS: "5000",
};

function verified(): ExternalVideoServiceConfigDecisionV1 {
  const decision = configureExternalVideoServiceV1(goodEnv);
  assert.equal(decision.outcome, "VERIFIED");
  return decision;
}

function fakeFetch(options: {
  readonly body?: Uint8Array;
  readonly status?: number;
  readonly capture?: RequestInit[];
} = {}): typeof fetch {
  return (async (_input: string | URL | Request, init?: RequestInit) => {
    options.capture?.push(init ?? {});
    return new Response(Buffer.from(options.body ?? artifact), { status: options.status ?? 200 });
  }) as typeof fetch;
}

test("external video service config is disabled until an artifact URL and digest are configured", () => {
  assert.deepEqual(configureExternalVideoServiceV1({}), {
    outcome: "DISABLED",
    reasonCodes: ["EXTERNAL_VIDEO_SERVICE_NOT_CONFIGURED"],
    config: {
      schemaVersion: "chimpmaera.external-video-service/config/v1",
      enabled: false,
      artifactUrl: null,
      artifactSha256: null,
      expectedProductVersion: "2026.08.02-v2",
      minContractVersion: "cm.video/v1",
      timeoutMs: 5000,
      allowedCapabilities: ["artifact.download", "artifact.sha256", "docker.smoke.external"],
    },
  });
});

test("external video service config accepts only pinned safe archive URLs", () => {
  const decision = configureExternalVideoServiceV1(goodEnv);
  assert.equal(decision.outcome, "VERIFIED");
  if (decision.outcome === "VERIFIED") {
    assert.equal(decision.config.artifactSha256, artifactSha256);
    assert.equal(decision.config.expectedProductVersion, "2026.08.02-v2");
  }
});

test("negative config probes deny unsafe URLs, missing digests, timeout and version drift", () => {
  const cases = [
    [{ ...goodEnv, CM_VIDEO_REFERENCE_ARTIFACT_URL: "file:///tmp/video.tar.gz" }, "EXTERNAL_VIDEO_SERVICE_URL_DENIED"],
    [{ ...goodEnv, CM_VIDEO_REFERENCE_ARTIFACT_URL: ["https:/", "/user:pass@example.test/video.tar.gz"].join("") }, "EXTERNAL_VIDEO_SERVICE_URL_DENIED"],
    [{ ...goodEnv, CM_VIDEO_REFERENCE_ARTIFACT_URL: "http://169.254.169.254/video.tar.gz" }, "EXTERNAL_VIDEO_SERVICE_URL_DENIED"],
    [{ ...goodEnv, CM_VIDEO_REFERENCE_ARTIFACT_URL: "https://127.0.0.1/video.tar.gz" }, "EXTERNAL_VIDEO_SERVICE_URL_DENIED"],
    [{ ...goodEnv, CM_VIDEO_REFERENCE_ARTIFACT_URL: "https://192.168.1.10/video.tar.gz" }, "EXTERNAL_VIDEO_SERVICE_URL_DENIED"],
    [{ ...goodEnv, CM_VIDEO_REFERENCE_ARTIFACT_URL: "https://example.test/video.zip" }, "EXTERNAL_VIDEO_SERVICE_URL_DENIED"],
    [{ ...goodEnv, CM_VIDEO_REFERENCE_ARTIFACT_SHA256: "latest" }, "EXTERNAL_VIDEO_SERVICE_SHA256_DENIED"],
    [{ ...goodEnv, CM_VIDEO_REFERENCE_TIMEOUT_MS: "50" }, "EXTERNAL_VIDEO_SERVICE_TIMEOUT_DENIED"],
    [{ ...goodEnv, CM_VIDEO_REFERENCE_VERSION: "latest" }, "EXTERNAL_VIDEO_SERVICE_VERSION_DENIED"],
    [{ ...goodEnv, CM_VIDEO_REFERENCE_CONTRACT_VERSION: "cm.video/v2" }, "EXTERNAL_VIDEO_SERVICE_VERSION_DENIED"],
  ] as const;
  for (const [env, code] of cases) {
    const decision = configureExternalVideoServiceV1(env);
    assert.equal(decision.outcome, "DENIED", code);
    if (decision.outcome === "DENIED") assert.ok(decision.reasonCodes.includes(code));
  }
});

test("probe verifies external artifact bytes by SHA-256 without credential headers", async () => {
  const capture: RequestInit[] = [];
  const result = await probeExternalVideoServiceV1(verified(), fakeFetch({ capture }));
  assert.equal(result.outcome, "VERIFIED");
  if (result.outcome === "VERIFIED") {
    assert.equal(result.readback.artifactSha256, artifactSha256);
    assert.equal(result.readback.dockerOwnedByCm, false);
    assert.equal(result.readback.renderEndpointsExposedByCm, false);
    assert.equal(result.readback.uploadEndpointsExposedByCm, false);
  }
  for (const init of capture) {
    assert.equal(JSON.stringify(init.headers ?? {}).toLowerCase().includes("authorization"), false);
    assert.equal(JSON.stringify(init.headers ?? {}).toLowerCase().includes("token"), false);
  }
});

test("negative probe readbacks fail closed for unavailable or tampered artifacts", async () => {
  const unavailable = await probeExternalVideoServiceV1(verified(), fakeFetch({ status: 404 }));
  assert.equal(unavailable.outcome, "UNAVAILABLE");
  if (unavailable.outcome === "UNAVAILABLE") {
    assert.ok(unavailable.reasonCodes.includes("EXTERNAL_VIDEO_SERVICE_ARTIFACT_UNAVAILABLE"));
  }

  const tampered = await probeExternalVideoServiceV1(verified(), fakeFetch({ body: Buffer.from("tampered") }));
  assert.equal(tampered.outcome, "DENIED");
  if (tampered.outcome === "DENIED") {
    assert.ok(tampered.reasonCodes.includes("EXTERNAL_VIDEO_SERVICE_ARTIFACT_DIGEST_MISMATCH"));
  }
});

test("CM exposes only artifact readback and validate-job intent, not render or publication authority", () => {
  assert.deepEqual(assertExternalVideoServiceRequestV1({ action: "artifactReadback" }), []);
  assert.deepEqual(assertExternalVideoServiceRequestV1({ action: "validateJob", jobDigest: artifactSha256 }), []);
  assert.deepEqual(assertExternalVideoServiceRequestV1({ action: "render" }), ["EXTERNAL_VIDEO_SERVICE_RENDER_DENIED"]);
  assert.deepEqual(assertExternalVideoServiceRequestV1({ action: "validate-and-render" }), ["EXTERNAL_VIDEO_SERVICE_RENDER_DENIED"]);
  assert.deepEqual(assertExternalVideoServiceRequestV1({ action: "upload" }), ["EXTERNAL_VIDEO_SERVICE_PUBLICATION_DENIED"]);
  assert.deepEqual(assertExternalVideoServiceRequestV1({ action: "youtube" }), ["EXTERNAL_VIDEO_SERVICE_PUBLICATION_DENIED"]);
  assert.deepEqual(assertExternalVideoServiceRequestV1({ action: "validateJob", jobDigest: "latest" }), ["EXTERNAL_VIDEO_SERVICE_UNSAFE_REQUEST_DENIED"]);
});
