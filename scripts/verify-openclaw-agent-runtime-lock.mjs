#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCK_PATH = "demo/manifests/supply-chain/openclaw-agent-runtime-lock-v1.json";
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const EXPECTED = Object.freeze({
  lockId: "openclaw-agent-runtime-2026.7.1-linux-amd64",
  version: "2026.7.1",
  commit: "2d2ddc43d0dcf71f31283d780f9fe9ff4cc04fe4",
  imageDigest: "sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c",
  platformDigest: "sha256:165b4992f1b4b74ffdd7a02c887ba006f9f5dc951eca420eef573a8b233b543f",
  gatewayBase: "docker.io/library/node:24.14.1-bookworm-slim@sha256:e484ae3f1e3c378021c967fd42254f343c302a9263e412280eac32bf5bca7008",
});
const EXPECTED_ARTIFACTS = [
  "demo/openclaw-agent/compose.yaml",
  "demo/openclaw-agent/fixture-probe.mjs",
  "demo/openclaw-agent/gateway.Dockerfile",
  "demo/openclaw-agent/gateway.mjs",
  "demo/openclaw-agent/openclaw.Dockerfile",
  "demo/openclaw-agent/openclaw.json",
  "demo/openclaw-agent/plugin/index.mjs",
  "demo/openclaw-agent/plugin/openclaw.plugin.json",
  "demo/openclaw-agent/plugin/package.json",
  "demo/openclaw-agent/runtime-contract-v1.json",
  "demo/openclaw-agent/workspace/AGENTS.md",
  "demo/openclaw-agent/workspace/HEARTBEAT.md",
  "demo/openclaw-agent/workspace/IDENTITY.md",
  "demo/openclaw-agent/workspace/SOUL.md",
  "demo/openclaw-agent/workspace/TOOLS.md",
  "demo/openclaw-agent/workspace/USER.md",
  "demo/openclaw-agent/workspace/openclaw-workspace-state.json",
];

function deny(code) {
  throw new Error(code);
}

function assert(condition, code) {
  if (!condition) deny(code);
}

async function read(repositoryRoot, relativePath, code) {
  try {
    return await readFile(path.join(repositoryRoot, relativePath));
  } catch {
    deny(code);
  }
}

export async function verifyOpenClawAgentRuntimeLock({ root, hostOs, hostArch } = {}) {
  const repositoryRoot = root ?? path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  let lock;
  try {
    lock = JSON.parse((await read(repositoryRoot, LOCK_PATH, "OPENCLAW_RUNTIME_LOCK_MISSING_DENIED")).toString("utf8"));
  } catch (error) {
    if (error.message?.startsWith("OPENCLAW_RUNTIME_")) throw error;
    deny("OPENCLAW_RUNTIME_LOCK_PARSE_DENIED");
  }
  assert(
    lock.schemaVersion === "chimpmaera.demo/openclaw-agent-runtime-lock/v1"
    && lock.status === "SELECTED_FOR_ISOLATED_LOCAL_FIXTURE_ONLY"
    && lock.lockId === EXPECTED.lockId,
    "OPENCLAW_RUNTIME_LOCK_SCHEMA_DENIED",
  );
  assert(
    lock.upstream.version === EXPECTED.version
    && lock.upstream.commit === EXPECTED.commit
    && lock.upstream.repository === "https://github.com/openclaw/openclaw"
    && lock.upstream.tag === `v${lock.upstream.version}`
    && /^[a-f0-9]{40}$/.test(lock.upstream.commit)
    && lock.upstream.dockerDocumentation.includes(lock.upstream.commit)
    && lock.upstream.dockerfile.includes(lock.upstream.commit)
    && SHA256.test(lock.upstream.dockerDocumentationSha256)
    && SHA256.test(lock.upstream.dockerfileSha256)
    && lock.upstream.upstreamComposeReuse === false
    && lock.upstream.upstreamDockerSupport
      === "OFFICIAL_DOCKERFILE_COMPOSE_DOCUMENTATION_AND_RELEASE_IMAGE",
    "OPENCLAW_RUNTIME_UPSTREAM_PROVENANCE_DENIED",
  );
  assert(
    lock.image.tagReference === `ghcr.io/openclaw/openclaw:${EXPECTED.version}`
    && lock.image.indexDigest === EXPECTED.imageDigest
    && DIGEST.test(lock.image.indexDigest)
    && lock.image.indexReference
      === `ghcr.io/openclaw/openclaw@${lock.image.indexDigest}`
    && lock.image.platformManifestDigest === EXPECTED.platformDigest
    && lock.image.platformManifestReference
      === `ghcr.io/openclaw/openclaw@${lock.image.platformManifestDigest}`
    && lock.image.platform === "linux/amd64"
    && /@sha256:[a-f0-9]{64}$/.test(lock.image.baseReference),
    "OPENCLAW_RUNTIME_IMAGE_PIN_DENIED",
  );
  const labels = lock.image.ociLabels;
  assert(
    lock.image.user === "node"
    && labels["org.opencontainers.image.source"] === lock.upstream.repository
    && labels["org.opencontainers.image.revision"] === lock.upstream.commit
    && labels["org.opencontainers.image.version"] === lock.upstream.version
    && labels["org.opencontainers.image.licenses"] === "MIT"
    && Array.isArray(lock.image.embeddedCredentialEnvironment)
    && lock.image.embeddedCredentialEnvironment.length === 0,
    "OPENCLAW_RUNTIME_IMAGE_METADATA_DENIED",
  );
  assert(
    lock.releaseEvidence.releaseManifestSha256
      === "8be7423d343ce50cce75a3b16f007d42c9a87c2f25a66cd56b7a81ff79f8f715"
    && lock.releaseEvidence.postpublishEvidenceSha256
      === "32355b81b529a9051a101d9ba4338f7ff6a45f21704847dc406a23f7bfc16711"
    && lock.releaseEvidence.dependencyEvidenceSha256
      === "51bdbe7b8d90c3aaf5e7252d2cf583b63a7435330294c556852bed59a285618b",
    "OPENCLAW_RUNTIME_RELEASE_EVIDENCE_DENIED",
  );
  assert(
    lock.license.projectSpdx === "MIT"
    && SHA256.test(lock.license.projectLicenseSha256)
    && lock.license.distributionMode
      === "EXTERNAL_DIGEST_REFERENCE_ONLY_NO_IMAGE_BYTES_BUNDLED"
    && lock.license.imageBytesBundledByChimpMaera === false
    && lock.license.compatibilityDecision
      === "LOCAL_PULL_BUILD_TEST_AND_REFERENCE_PERMITTED_IMAGE_REDISTRIBUTION_NOT_CLAIMED",
    "OPENCLAW_RUNTIME_LICENSE_BOUNDARY_DENIED",
  );
  assert(
    lock.selectionPolicy.defaultOff === true
    && lock.selectionPolicy.mutableTagsAllowed === false
    && lock.selectionPolicy.sourceBuild === false
    && lock.selectionPolicy.browserVariant === false
    && lock.selectionPolicy.dockerCliVariant === false
    && lock.selectionPolicy.hostOrDockerSocketMountsAllowed === false
    && lock.selectionPolicy.directProviderOrInternetPathAllowed === false
    && lock.selectionPolicy.requiredNetwork === "CHIMPMAERA_INTERNAL_GATEWAY_ONLY"
    && lock.selectionPolicy.requiredRuntimeRole
      === "UNTRUSTED_AGENT_NOT_DECISION_POLICY_AUTHORITY_OR_EFFECT_PLANE",
    "OPENCLAW_RUNTIME_SELECTION_POLICY_DENIED",
  );
  const fixture = lock.fixtureBuild;
  assert(
    fixture?.supportedHost?.os === "Linux"
    && fixture.supportedHost.architecture === "x86_64"
    && fixture.supportedHost.platform === lock.image.platform
    && fixture.gatewayBaseReference === EXPECTED.gatewayBase
    && fixture.openclawBaseReference === lock.image.indexReference
    && fixture.pluginPeerVersion === lock.upstream.version,
    "OPENCLAW_RUNTIME_FIXTURE_INPUT_DENIED",
  );
  if (hostOs !== undefined || hostArch !== undefined) {
    assert(
      hostOs === fixture.supportedHost.os
      && hostArch === fixture.supportedHost.architecture,
      "OPENCLAW_RUNTIME_HOST_PLATFORM_DENIED",
    );
  }
  const artifacts = fixture.artifactSha256;
  const artifactPaths = Object.keys(artifacts ?? {}).sort();
  assert(
    artifacts
    && artifactPaths.join("\n") === EXPECTED_ARTIFACTS.join("\n")
    && Object.values(artifacts).every((digest) => SHA256.test(digest)),
    "OPENCLAW_RUNTIME_ARTIFACT_SET_DENIED",
  );
  for (const [relativePath, expectedDigest] of Object.entries(artifacts)) {
    assert(
      relativePath.startsWith("demo/openclaw-agent/")
      && !relativePath.includes(".."),
      "OPENCLAW_RUNTIME_ARTIFACT_PATH_DENIED",
    );
    const bytes = await read(repositoryRoot, relativePath, "OPENCLAW_RUNTIME_ARTIFACT_MISSING_DENIED");
    const actualDigest = createHash("sha256").update(bytes).digest("hex");
    assert(actualDigest === expectedDigest, "OPENCLAW_RUNTIME_ARTIFACT_MISMATCH_DENIED");
  }
  assert(
    JSON.stringify(lock).includes(":latest") === false
    && JSON.stringify(lock).includes(":main") === false
    && JSON.stringify(lock).includes("docker.sock") === false,
    "OPENCLAW_RUNTIME_AMBIENT_AUTHORITY_DENIED",
  );
  const requiredNonClaims = [
    "NO_COMPLETE_SBOM_CVE_OR_THIRD_PARTY_LICENSE_AUDIT",
    "NO_IMAGE_BYTE_REDISTRIBUTION_BY_CHIMPMAERA",
    "NO_PRODUCTION_SANDBOX_OR_LIVE_PROVIDER_CLAIM",
    "NO_REGISTRY_SIGNATURE_VERIFICATION",
  ];
  assert(
    Array.isArray(lock.nonClaims)
    && lock.nonClaims.length === requiredNonClaims.length
    && [...lock.nonClaims].sort().join("\n") === requiredNonClaims.sort().join("\n"),
    "OPENCLAW_RUNTIME_NON_CLAIMS_DENIED",
  );
  return {
    schemaVersion: "chimpmaera.demo/openclaw-agent-runtime-lock-verification/v1",
    status: "PASS",
    lockId: lock.lockId,
    version: lock.upstream.version,
    commit: lock.upstream.commit,
    image: lock.image.indexReference,
    platformImage: lock.image.platformManifestReference,
    platform: fixture.supportedHost.platform,
    host: `${fixture.supportedHost.os}/${fixture.supportedHost.architecture}`,
    gatewayBase: fixture.gatewayBaseReference,
    artifactCount: artifactPaths.length,
    distributionMode: lock.license.distributionMode,
    checks: [
      "OFFICIAL_UPSTREAM_DOCKER_SUPPORT_BOUND",
      "SOURCE_VERSION_AND_IMAGE_DIGESTS_BOUND",
      "LICENSE_AND_REFERENCE_ONLY_DISTRIBUTION_BOUNDARY_DECLARED",
      "DEFAULT_OFF_ZERO_AMBIENT_AUTHORITY_SELECTION_POLICY_BOUND",
      "SUPPORTED_HOST_AND_LOCAL_BUILD_INPUTS_BOUND",
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let hostOs;
  let hostArch;
  while (args.length > 0) {
    const option = args.shift();
    if (option === "--host-os" && args.length > 0) hostOs = args.shift();
    else if (option === "--host-arch" && args.length > 0) hostArch = args.shift();
    else deny("OPENCLAW_RUNTIME_VERIFIER_ARGUMENT_DENIED");
  }
  console.log(JSON.stringify(await verifyOpenClawAgentRuntimeLock({ hostOs, hostArch }), null, 2));
}
