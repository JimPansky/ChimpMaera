import assert from "node:assert/strict";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AdminAiPoc } from "../demo/runtime/admin-ai-poc.mjs";
import {
  DemoMutationGate,
  canonicalJson,
  sha256,
} from "../demo/runtime/enforcement-gate.mjs";
import {
  TRUSTED_POLICY_CONTEXT_SCHEMA,
  createInternalStaticPolicyEvaluator,
} from "../demo/runtime/policy-evaluator.mjs";
import {
  PolicyGenerationFence,
  createLocalOwnerPolicyAuthorization,
  createPolicyActivationCandidate,
} from "../demo/runtime/policy-generation-fence.mjs";

const policyBytesV1 = readFileSync(
  new URL("../demo/manifests/authority/admin-ai-poc-policy-v1.json", import.meta.url),
);
const policy = JSON.parse(policyBytesV1.toString("utf8"));
const policyBytesV2 = Buffer.from(JSON.stringify(policy));
const ownerActivationToken = "o".repeat(64);
const controlToken = "c".repeat(64);
const apiToken = "a".repeat(48);
const expectedOrigin = "http://127.0.0.1:7780";
let sequence = 0;

function tempPath(label) {
  const directory = join(
    tmpdir(),
    `cm-policy-fence-${process.pid}-${sequence++}-${label}`,
  );
  mkdirSync(directory, { recursive: true });
  return { directory, path: join(directory, "activation.json") };
}

function candidate(policyBytes, generation, tenant = "panskys-zoo-demo") {
  return createPolicyActivationCandidate({
    policyBytes,
    generation,
    tenant,
    policyId: "admin-ai-poc-policy-v1",
  });
}

function authorize(value, issuedAtMs = 1_000) {
  return createLocalOwnerPolicyAuthorization({
    candidate: value,
    ownerActivationToken,
    issuedAtMs,
  });
}

function activate(fence, value, issuedAtMs = 1_000) {
  return fence.activate(value, authorize(value, issuedAtMs));
}

function localRequest() {
  return {
    headers: {
      authorization: `Bearer ${apiToken}`,
      host: "127.0.0.1:7780",
      origin: expectedOrigin,
      "x-cm-csrf": "chimpmaera-local-v1",
    },
  };
}

function request(suffix) {
  return {
    schemaVersion: "chimpmaera.demo/admin-ai-request/v1",
    actor: "agent:admin-ai-poc",
    requestKind: "SYNTHETIC_ESPOCRM_CONTACT_CREATE",
    replayKey: `admin-ai:poc:${suffix}`,
  };
}

function effectEnvelope(decision) {
  return {
    action: decision.action,
    actionDigest: decision.actionDigest,
    authority: decision.authority,
  };
}

function runtimeHarness({ fence, active, profileGeneration, label }) {
  let mutations = 0;
  let readbacks = 0;
  const gate = new DemoMutationGate({
    apiToken,
    controlToken,
    expectedOrigin,
    adminAiPolicyId: active.policyId,
    adminAiPolicyDigest: active.policySourceDigest,
    assertPolicyUse: (binding) => fence.assertUseBinding(binding),
    authorityContext: {
      profileId: "SAFE_GUIDED",
      profileGeneration,
      policyGeneration: active.generation,
    },
    receiptPath: join(
      tmpdir(),
      `cm-policy-use-${process.pid}-${sequence++}-${label}.json`,
    ),
    provider: {
      async mutate() {
        mutations += 1;
        return { id: "contact-42" };
      },
      async readback() {
        readbacks += 1;
        return {
          id: "contact-42",
          description: "ChimpMaera Admin AI deterministic PoC contact",
          emailAddress: "admin-ai-poc@example.invalid",
          firstName: "Avery",
          lastName: "Admin AI PoC",
        };
      },
    },
  });
  const evaluator = createInternalStaticPolicyEvaluator({
    policy: active.policy,
    policySourceDigest: active.policySourceDigest,
  });
  const poc = new AdminAiPoc({
    policy: active.policy,
    policyDigest: active.policySourceDigest,
    policyEvaluator: evaluator,
    trustedPolicyContext: {
      schemaVersion: TRUSTED_POLICY_CONTEXT_SCHEMA,
      profileId: "SAFE_GUIDED",
      profileGeneration,
      policyId: active.policyId,
      policyGeneration: active.generation,
      policySourceDigest: active.policySourceDigest,
      policySemanticDigest: evaluator.policySemanticDigest,
    },
    signAuthority: (fields) => gate.agentAuthority(fields),
  });
  return {
    gate,
    poc,
    mutations: () => mutations,
    readbacks: () => readbacks,
  };
}

test("Owner-authorized monotonic activation persists active and explicit last-safe state", () => {
  const target = tempPath("positive");
  try {
    let now = 2_000;
    const fence = new PolicyGenerationFence({
      activationPath: target.path,
      ownerActivationToken,
      now: () => now,
    });
    const first = candidate(policyBytesV1, 1);
    const activeV1 = activate(fence, first);
    assert.equal(activeV1.generation, 1);
    assert.equal(activeV1.dispatchStatus, "ACTIVE");
    assert.equal(activeV1.fallbackGeneration, 1);

    const reloaded = new PolicyGenerationFence({
      activationPath: target.path,
      ownerActivationToken,
    });
    assert.deepEqual(reloaded.activePolicy(), activeV1);

    now = 3_000;
    const second = candidate(policyBytesV2, 2);
    const activeV2 = activate(fence, second, 2_500);
    assert.equal(activeV2.generation, 2);
    assert.equal(activeV2.fallbackGeneration, 1);
    assert.equal(fence.record.lastKnownSafe.generation, 1);
    assert.equal(
      fence.record.lastKnownSafe.policySourceDigest,
      first.policySourceDigest,
    );
    assert.deepEqual(
      fence.record.retiredPolicySourceDigests,
      [first.policySourceDigest],
    );
    assert.equal(fence.record.active.policySourceDigest, second.policySourceDigest);
  } finally {
    rmSync(target.directory, { recursive: true, force: true });
  }
});

test("unsigned, mutated, stale, wrong-tenant, incompatible and downgrade activations preserve the record", () => {
  const target = tempPath("negative");
  try {
    const fence = new PolicyGenerationFence({
      activationPath: target.path,
      ownerActivationToken,
      now: () => 4_000,
    });
    const first = candidate(policyBytesV1, 1);
    const second = candidate(policyBytesV2, 2);
    activate(fence, first);
    activate(fence, second, 2_000);
    const before = readFileSync(target.path);

    const mutated = {
      ...candidate(Buffer.from(`${JSON.stringify(policy)}\n`), 3),
    };
    const originalAuthorization = authorize(candidate(policyBytesV2, 3), 3_000);
    const recomputedUntrusted = {
      ...mutated,
      policySourceDigest: sha256(Buffer.from(mutated.policySourceBase64, "base64")),
      policySemanticDigest: sha256(canonicalJson(policy)),
    };
    const probes = [
      () => fence.activate(mutated, null),
      () => fence.activate(mutated, { actor: "agent:admin-ai-poc" }),
      () => fence.activate(recomputedUntrusted, originalAuthorization),
      () => fence.activate({ ...mutated, extra: true }, authorize(mutated, 3_000)),
      () => fence.activate(candidate(policyBytesV2, 2), authorize(second, 3_000)),
      () => {
        const wrongTenant = candidate(policyBytesV2, 3, "other-tenant");
        return fence.activate(wrongTenant, authorize(wrongTenant, 3_000));
      },
      () => {
        const repackagedOld = candidate(policyBytesV1, 3);
        return fence.activate(repackagedOld, authorize(repackagedOld, 3_000));
      },
      () => createPolicyActivationCandidate({
        policyBytes: Buffer.from(JSON.stringify({ ...policy, extra: true })),
        generation: 3,
        tenant: "panskys-zoo-demo",
        policyId: "admin-ai-poc-policy-v1",
      }),
      () => candidate(policyBytesV2, Number.MAX_SAFE_INTEGER + 1),
    ];
    for (const probe of probes) {
      assert.throws(
        probe,
        /POLICY_ACTIVATION_|POLICY_GENERATION_/,
      );
      assert.deepEqual(readFileSync(target.path), before);
    }

    const edited = JSON.parse(before.toString("utf8"));
    edited.active.generation = 99;
    writeFileSync(target.path, `${JSON.stringify(edited)}\n`);
    assert.throws(
      () => new PolicyGenerationFence({
        activationPath: target.path,
        ownerActivationToken,
      }),
      /POLICY_ACTIVATION_RECORD_INVALID_DENIED/,
    );
  } finally {
    rmSync(target.directory, { recursive: true, force: true });
  }
});

test("generation and digest are fenced at decision and provider use; freeze denies all effects", async () => {
  const target = tempPath("use-time");
  try {
    let now = 5_000;
    const fence = new PolicyGenerationFence({
      activationPath: target.path,
      ownerActivationToken,
      now: () => now,
    });
    const activeV1 = activate(fence, candidate(policyBytesV1, 1));
    const profileGeneration = "policy-fence-profile-v1";
    const staleWorker = runtimeHarness({
      fence,
      active: activeV1,
      profileGeneration,
      label: "stale",
    });
    const staleDecision = staleWorker.poc.decide(request("stale-worker-001")).decision;
    assert.equal(staleDecision.policyId, "admin-ai-poc-policy-v1");
    assert.equal(staleDecision.policyGeneration, 1);
    assert.equal(staleDecision.authority.policyGeneration, 1);

    now = 6_000;
    const activeV2 = activate(fence, candidate(policyBytesV2, 2), 5_500);
    const currentWorker = runtimeHarness({
      fence,
      active: activeV2,
      profileGeneration,
      label: "current",
    });
    await assert.rejects(
      currentWorker.gate.execute(localRequest(), effectEnvelope(staleDecision)),
      /AGENT_AUTHORITY_INVALID_DENIED|POLICY_USE_GENERATION_MISMATCH_DENIED/,
    );
    assert.equal(currentWorker.mutations(), 0);
    assert.equal(currentWorker.readbacks(), 0);

    const currentDecision = currentWorker.poc.decide(
      request("current-worker-001"),
    ).decision;
    const applied = await currentWorker.gate.execute(
      localRequest(),
      effectEnvelope(currentDecision),
    );
    assert.equal(applied.status, "PASS");
    assert.equal(applied.receipt.policyId, activeV2.policyId);
    assert.equal(applied.receipt.policyGeneration, 2);
    assert.equal(applied.receipt.authority.policyGeneration, 2);
    assert.equal(currentWorker.mutations(), 1);
    assert.equal(currentWorker.readbacks(), 1);

    fence.freezeDispatch("WORKER_GENERATION_DIVERGENCE");
    assert.equal(fence.record.dispatch.status, "FROZEN");
    assert.equal(fence.record.dispatch.fallbackGeneration, 1);
    const frozenDecision = currentWorker.poc.decide(
      request("frozen-worker-001"),
    ).decision;
    await assert.rejects(
      currentWorker.gate.execute(localRequest(), effectEnvelope(frozenDecision)),
      /POLICY_DISPATCH_FROZEN_DENIED/,
    );
    assert.equal(currentWorker.mutations(), 1);
    assert.equal(currentWorker.readbacks(), 1);

    rmSync(target.path);
    assert.throws(
      () => fence.assertUseBinding({
        tenant: activeV2.tenant,
        policyId: activeV2.policyId,
        policyGeneration: activeV2.generation,
        policySourceDigest: activeV2.policySourceDigest,
      }),
      /POLICY_ACTIVATION_RECORD_INVALID_DENIED/,
    );
  } finally {
    rmSync(target.directory, { recursive: true, force: true });
  }
});

test("production wiring persists the fence without exposing an Agent activation endpoint", () => {
  const server = readFileSync(
    new URL("../demo/runtime/server.mjs", import.meta.url),
    "utf8",
  );
  const compose = readFileSync(
    new URL("../demo/compose.yaml", import.meta.url),
    "utf8",
  );
  const installer = readFileSync(
    new URL("../demo/install.sh", import.meta.url),
    "utf8",
  );
  assert.match(server, /policy-activation-record\.json/);
  assert.match(server, /assertPolicyUse: \(binding\) => policyFence\.assertUseBinding/);
  assert.match(server, /createLocalOwnerPolicyAuthorization/);
  assert.doesNotMatch(server, /\/api\/.*policy.*activat/i);
  assert.match(compose, /CM_ADMIN_AI_POLICY_GENERATION/);
  assert.match(installer, /admin_ai_policy_generation=1/);
});
