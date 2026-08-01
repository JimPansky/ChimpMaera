#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCK_PATH = "demo/manifests/supply-chain/openclaw-agent-runtime-lock-v1.json";
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SHA256 = /^[a-f0-9]{64}$/;

function deny(code) {
  throw new Error(code);
}

function assert(condition, code) {
  if (!condition) deny(code);
}

export async function verifyOpenClawAgentRuntimeLock({ root } = {}) {
  const repositoryRoot = root ?? path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const lock = JSON.parse(await readFile(path.join(repositoryRoot, LOCK_PATH), "utf8"));
  assert(
    lock.schemaVersion === "chimpmaera.demo/openclaw-agent-runtime-lock/v1"
    && lock.status === "SELECTED_FOR_ISOLATED_LOCAL_FIXTURE_ONLY",
    "OPENCLAW_RUNTIME_LOCK_SCHEMA_DENIED",
  );
  assert(
    lock.upstream.repository === "https://github.com/openclaw/openclaw"
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
    lock.image.tagReference === `ghcr.io/openclaw/openclaw:${lock.upstream.version}`
    && DIGEST.test(lock.image.indexDigest)
    && lock.image.indexReference
      === `ghcr.io/openclaw/openclaw@${lock.image.indexDigest}`
    && DIGEST.test(lock.image.platformManifestDigest)
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
    distributionMode: lock.license.distributionMode,
    checks: [
      "OFFICIAL_UPSTREAM_DOCKER_SUPPORT_BOUND",
      "SOURCE_VERSION_AND_IMAGE_DIGESTS_BOUND",
      "LICENSE_AND_REFERENCE_ONLY_DISTRIBUTION_BOUNDARY_DECLARED",
      "DEFAULT_OFF_ZERO_AMBIENT_AUTHORITY_SELECTION_POLICY_BOUND",
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await verifyOpenClawAgentRuntimeLock(), null, 2));
}
