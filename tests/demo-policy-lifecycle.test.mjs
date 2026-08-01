import assert from "node:assert/strict";
import {
  generateKeyPairSync,
} from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  PolicyLifecycleManager,
  createLocalOwnerLifecycleApproval,
  createSignedPolicyArtifact,
} from "../demo/management/policy-lifecycle.mjs";
import { PolicyGenerationFence } from "../demo/runtime/policy-generation-fence.mjs";

const policyBytesV1 = readFileSync(
  new URL("../demo/manifests/authority/admin-ai-poc-policy-v1.json", import.meta.url),
);
const policy = JSON.parse(policyBytesV1.toString("utf8"));
const policyBytesV2 = Buffer.from(JSON.stringify(policy));
const ownerApprovalToken = "p".repeat(64);
const ownerActivationToken = "a".repeat(64);
let sequence = 0;

function tempPaths(label) {
  const directory = join(
    tmpdir(),
    `cm-policy-lifecycle-${process.pid}-${sequence++}-${label}`,
  );
  mkdirSync(directory, { recursive: true });
  return {
    directory,
    lifecycle: join(directory, "lifecycle.json"),
    activation: join(directory, "activation.json"),
  };
}

function fixture(label, initialNow = 2_000) {
  const paths = tempPaths(label);
  const issuerKeys = generateKeyPairSync("ed25519");
  const otherKeys = generateKeyPairSync("ed25519");
  let now = initialNow;
  let trust = {
    "issuer.chimpmaera.local": {
      "fixture-key-1": issuerKeys.publicKey.export({ type: "spki", format: "pem" }),
    },
  };
  let activations = 0;
  let useChecks = 0;
  const rawFence = new PolicyGenerationFence({
    activationPath: paths.activation,
    ownerActivationToken,
    now: () => now,
  });
  const fence = {
    activate(...args) {
      activations += 1;
      return rawFence.activate(...args);
    },
    assertUseBinding(...args) {
      useChecks += 1;
      return rawFence.assertUseBinding(...args);
    },
    freezeDispatch(...args) {
      return rawFence.freezeDispatch(...args);
    },
  };
  const manager = new PolicyLifecycleManager({
    recordPath: paths.lifecycle,
    policyFence: fence,
    ownerApprovalToken,
    ownerActivationToken,
    trustStore: () => trust,
    now: () => now,
  });
  return {
    paths,
    issuerKeys,
    otherKeys,
    rawFence,
    fence,
    manager,
    now: () => now,
    setNow(value) { now = value; },
    setTrust(value) { trust = value; },
    trust: () => trust,
    activations: () => activations,
    useChecks: () => useChecks,
  };
}

function artifact(fx, generation, policyBytes = generation === 1 ? policyBytesV1 : policyBytesV2, overrides = {}) {
  return createSignedPolicyArtifact({
    policyBytes,
    generation,
    issuer: "issuer.chimpmaera.local",
    keyId: "fixture-key-1",
    issuedAtMs: 1_000,
    notBeforeMs: 1_000,
    expiresAtMs: 100_000,
    privateKey: fx.issuerKeys.privateKey,
    ...overrides,
  });
}

function entry(manager, generation) {
  return manager.record.entries.find((value) => value.generation === generation);
}

function approval(manager, generation, overrides = {}) {
  const value = entry(manager, generation);
  return createLocalOwnerLifecycleApproval({
    generation,
    artifactDigest: value.artifactDigest,
    diffDigest: value.diffDigest,
    simulationDigest: value.simulationDigest,
    allowWidening: false,
    issuedAtMs: 2_000,
    expiresAtMs: 90_000,
    ownerApprovalToken,
    ...overrides,
  });
}

function reviewToStage(fx, value, prefix) {
  const generation = value.generation;
  fx.manager.draft(value, { operationId: `${prefix}:draft` });
  const checked = fx.manager.validate(generation, {
    operationId: `${prefix}:validate`,
  });
  const simulated = fx.manager.simulate(generation, {
    operationId: `${prefix}:simulate`,
  });
  fx.manager.approve(generation, approval(fx.manager, generation), {
    operationId: `${prefix}:approve`,
  });
  fx.manager.stage(generation, { operationId: `${prefix}:stage` });
  return { checked, simulated };
}

test("signed draft completes validate, simulate, approve, stage, activate, supersede and retire with restart-safe receipts", () => {
  const fx = fixture("positive");
  try {
    const first = artifact(fx, 1);
    const firstReview = reviewToStage(fx, first, "policy-v1");
    assert.equal(firstReview.checked.diff.baseGeneration, null);
    assert.equal(firstReview.checked.diff.authorityWidening, false);
    assert.equal(firstReview.simulated.simulation.outcome, "PASS");
    const firstActivation = fx.manager.activate(1, {
      operationId: "policy-v1:activate",
    });
    assert.equal(firstActivation.active.generation, 1);
    assert.equal(fx.manager.record.dispatch, "ACTIVE");
    assert.equal(fx.manager.record.lastSafeGeneration, 1);
    assert.equal(fx.activations(), 1);

    const second = artifact(fx, 2);
    const secondReview = reviewToStage(fx, second, "policy-v2");
    assert.equal(secondReview.checked.diff.baseGeneration, 1);
    assert.deepEqual(secondReview.checked.diff.changes, []);
    const secondActivation = fx.manager.activate(2, {
      operationId: "policy-v2:activate",
    });
    assert.equal(secondActivation.active.generation, 2);
    assert.equal(entry(fx.manager, 1).state, "SUPERSEDED");
    assert.equal(entry(fx.manager, 2).state, "ACTIVE");
    assert.equal(fx.manager.record.lastSafeGeneration, 1);
    const beforeUnsafeRetire = readFileSync(fx.paths.lifecycle);
    assert.throws(
      () => fx.manager.retire(1, { operationId: "policy-v1:unsafe-retire" }),
      /POLICY_LIFECYCLE_LAST_SAFE_RETIRE_DENIED/,
    );
    assert.deepEqual(readFileSync(fx.paths.lifecycle), beforeUnsafeRetire);
    const convergence = fx.manager.reportRollout(2, [2, 2], {
      operationId: "policy-v2:rollout-confirmed",
    });
    assert.equal(convergence.confirmed, true);
    assert.equal(fx.manager.record.lastSafeGeneration, 2);
    fx.manager.retire(1, { operationId: "policy-v1:retire" });
    assert.equal(entry(fx.manager, 1).state, "RETIRED");
    assert.equal(fx.activations(), 2);

    const reloaded = new PolicyLifecycleManager({
      recordPath: fx.paths.lifecycle,
      policyFence: fx.fence,
      ownerApprovalToken,
      ownerActivationToken,
      trustStore: fx.trust,
      now: fx.now,
    });
    assert.deepEqual(reloaded.record, fx.manager.record);
    assert.equal(reloaded.record.receipts.length, 14);
    assert.deepEqual(
      reloaded.record.receipts.map(({ sequence }) => sequence),
      Array.from({ length: 14 }, (_, index) => index + 1),
    );
    for (let index = 1; index < reloaded.record.receipts.length; index += 1) {
      assert.equal(
        reloaded.record.receipts[index].previousReceiptDigest,
        reloaded.record.receipts[index - 1].receiptDigest,
      );
    }
  } finally {
    rmSync(fx.paths.directory, { recursive: true, force: true });
  }
});

test("unsigned, mutated, unknown-trust, wrong-tenant, expired and incompatible artifacts fail without activation", () => {
  const fx = fixture("artifact-negative");
  try {
    const valid = artifact(fx, 1);
    const probes = [
      () => fx.manager.draft({ ...valid, signature: null }, { operationId: "bad:unsigned" }),
      () => fx.manager.draft({
        ...valid,
        signature: { ...valid.signature, valueBase64: "A".repeat(88) },
      }, { operationId: "bad:signature" }),
      () => fx.manager.draft({ ...valid, keyId: "unknown-key" }, {
        operationId: "bad:key",
      }),
      () => fx.manager.draft(artifact(fx, 1, policyBytesV1, {
        tenant: "other-tenant",
      }), { operationId: "bad:tenant" }),
      () => fx.manager.draft(artifact(fx, 1, policyBytesV1, {
        issuedAtMs: 0,
        notBeforeMs: 0,
        expiresAtMs: 1_500,
      }), { operationId: "bad:expired" }),
    ];
    for (const probe of probes) {
      assert.throws(
        probe,
        /POLICY_LIFECYCLE_(ARTIFACT|SIGNATURE|TRUST|ARTIFACT_TIME)/,
      );
      assert.equal(fx.manager.record, null);
      assert.equal(fx.activations(), 0);
    }

    const incompatible = artifact(fx, 1, policyBytesV1, {
      runtimeApiVersion: "chimpmaera.demo/policy-runtime/v999",
    });
    fx.manager.draft(incompatible, { operationId: "incompatible:draft" });
    const before = readFileSync(fx.paths.lifecycle);
    assert.throws(
      () => fx.manager.validate(1, { operationId: "incompatible:validate" }),
      /POLICY_LIFECYCLE_COMPATIBILITY_INVALID_DENIED/,
    );
    assert.deepEqual(readFileSync(fx.paths.lifecycle), before);
    assert.equal(fx.activations(), 0);
  } finally {
    rmSync(fx.paths.directory, { recursive: true, force: true });
  }
});

test("replay, skipped stages, approval substitution, widening without exact approval, trust drift and expiry preserve state", () => {
  const fx = fixture("transition-negative");
  try {
    fx.manager.draft(artifact(fx, 1), { operationId: "v1:draft" });
    fx.manager.validate(1, { operationId: "v1:validate" });
    const beforeReplay = readFileSync(fx.paths.lifecycle);
    assert.throws(
      () => fx.manager.simulate(1, { operationId: "v1:validate" }),
      /POLICY_LIFECYCLE_OPERATION_REPLAY_DENIED/,
    );
    assert.deepEqual(readFileSync(fx.paths.lifecycle), beforeReplay);
    assert.throws(
      () => fx.manager.activate(1, { operationId: "v1:activate-skipped" }),
      /POLICY_LIFECYCLE_TRANSITION_INVALID_DENIED/,
    );
    fx.manager.simulate(1, { operationId: "v1:simulate" });
    const substituted = approval(fx.manager, 1, {
      diffDigest: "f".repeat(64),
    });
    const beforeSubstitution = readFileSync(fx.paths.lifecycle);
    assert.throws(
      () => fx.manager.approve(1, substituted, { operationId: "v1:bad-approval" }),
      /POLICY_LIFECYCLE_APPROVAL_INVALID_DENIED/,
    );
    assert.deepEqual(readFileSync(fx.paths.lifecycle), beforeSubstitution);
    fx.manager.approve(1, approval(fx.manager, 1), {
      operationId: "v1:approve",
    });

    fx.setTrust({
      "issuer.chimpmaera.local": {
        "fixture-key-1": fx.otherKeys.publicKey.export({ type: "spki", format: "pem" }),
      },
    });
    const beforeDrift = readFileSync(fx.paths.lifecycle);
    assert.throws(
      () => fx.manager.stage(1, { operationId: "v1:stage-drift" }),
      /POLICY_LIFECYCLE_TRUST_DRIFT_DENIED/,
    );
    assert.deepEqual(readFileSync(fx.paths.lifecycle), beforeDrift);
    assert.equal(fx.activations(), 0);
  } finally {
    rmSync(fx.paths.directory, { recursive: true, force: true });
  }

  const wideningFx = fixture("widening-negative");
  try {
    reviewToStage(wideningFx, artifact(wideningFx, 1), "base");
    wideningFx.manager.activate(1, { operationId: "base:activate" });
    const widerPolicy = structuredClone(policy);
    widerPolicy.rules[1] = {
      requestKind: "SYNTHETIC_DOLIBARR_ORDER_CREATE",
      outcome: "AUTO_GRANT",
      reasonCode: "POLICY_SYNTHETIC_ORDER_AUTO_GRANTED",
    };
    const wider = artifact(
      wideningFx,
      2,
      Buffer.from(JSON.stringify(widerPolicy)),
    );
    wideningFx.manager.draft(wider, { operationId: "wider:draft" });
    const validated = wideningFx.manager.validate(2, {
      operationId: "wider:validate",
    });
    assert.equal(validated.diff.authorityWidening, true);
    wideningFx.manager.simulate(2, { operationId: "wider:simulate" });
    const beforeWidening = readFileSync(wideningFx.paths.lifecycle);
    assert.throws(
      () => wideningFx.manager.approve(2, approval(wideningFx.manager, 2), {
        operationId: "wider:approve-denied",
      }),
      /POLICY_LIFECYCLE_WIDENING_APPROVAL_REQUIRED_DENIED/,
    );
    assert.deepEqual(readFileSync(wideningFx.paths.lifecycle), beforeWidening);
    assert.equal(wideningFx.activations(), 1);
  } finally {
    rmSync(wideningFx.paths.directory, { recursive: true, force: true });
  }

  const expiryFx = fixture("approval-expiry");
  try {
    expiryFx.manager.draft(artifact(expiryFx, 1), { operationId: "expiry:draft" });
    expiryFx.manager.validate(1, { operationId: "expiry:validate" });
    expiryFx.manager.simulate(1, { operationId: "expiry:simulate" });
    expiryFx.manager.approve(1, approval(expiryFx.manager, 1, {
      expiresAtMs: 2_500,
    }), { operationId: "expiry:approve" });
    expiryFx.setNow(3_000);
    const beforeExpiry = readFileSync(expiryFx.paths.lifecycle);
    assert.throws(
      () => expiryFx.manager.stage(1, { operationId: "expiry:stage" }),
      /POLICY_LIFECYCLE_APPROVAL_EXPIRED_DENIED/,
    );
    assert.deepEqual(readFileSync(expiryFx.paths.lifecycle), beforeExpiry);
    assert.equal(expiryFx.activations(), 0);
  } finally {
    rmSync(expiryFx.paths.directory, { recursive: true, force: true });
  }
});

test("mixed use generations, partial rollout and active revoke freeze without implicit fallback", () => {
  const fx = fixture("use-freeze");
  try {
    reviewToStage(fx, artifact(fx, 1), "v1");
    const activeV1 = fx.manager.activate(1, { operationId: "v1:activate" }).active;
    reviewToStage(fx, artifact(fx, 2), "v2");
    const activeV2 = fx.manager.activate(2, { operationId: "v2:activate" }).active;
    assert.throws(
      () => fx.manager.assertUseBinding({
        tenant: activeV1.tenant,
        policyId: activeV1.policyId,
        policyGeneration: activeV1.generation,
        policySourceDigest: activeV1.policySourceDigest,
      }),
      /POLICY_LIFECYCLE_USE_GENERATION_MISMATCH_DENIED/,
    );
    assert.equal(fx.useChecks(), 0);
    assert.equal(fx.manager.assertUseBinding({
      tenant: activeV2.tenant,
      policyId: activeV2.policyId,
      policyGeneration: activeV2.generation,
      policySourceDigest: activeV2.policySourceDigest,
    }), true);
    assert.equal(fx.useChecks(), 1);

    const frozen = fx.manager.reportRollout(2, [2, 1, 2], {
      operationId: "v2:rollout-mixed",
    });
    assert.equal(frozen.frozen, true);
    assert.equal(fx.manager.record.dispatch, "FROZEN");
    assert.equal(fx.manager.record.lastSafeGeneration, 1);
    assert.throws(
      () => fx.manager.assertUseBinding({
        tenant: activeV2.tenant,
        policyId: activeV2.policyId,
        policyGeneration: activeV2.generation,
        policySourceDigest: activeV2.policySourceDigest,
      }),
      /POLICY_LIFECYCLE_USE_GENERATION_MISMATCH_DENIED/,
    );
    assert.equal(fx.useChecks(), 1);
    assert.equal(fx.activations(), 2);
  } finally {
    rmSync(fx.paths.directory, { recursive: true, force: true });
  }

  const revokeFx = fixture("active-revoke");
  try {
    reviewToStage(revokeFx, artifact(revokeFx, 1), "revoke-v1");
    revokeFx.manager.activate(1, { operationId: "revoke-v1:activate" });
    revokeFx.manager.revoke(1, {
      operationId: "revoke-v1:revoke",
      reasonCode: "OPERATOR_KEY_COMPROMISE",
    });
    assert.equal(entry(revokeFx.manager, 1).state, "REVOKED");
    assert.equal(revokeFx.manager.record.dispatch, "FROZEN");
    assert.equal(revokeFx.manager.record.activeGeneration, null);
    assert.equal(revokeFx.manager.record.lastSafeGeneration, null);
  } finally {
    rmSync(revokeFx.paths.directory, { recursive: true, force: true });
  }
});

test("post-activation lifecycle persistence failure freezes the generation fence", () => {
  const fx = fixture("activation-convergence");
  try {
    reviewToStage(fx, artifact(fx, 1), "convergence-v1");
    const persistedLifecycle = readFileSync(fx.paths.lifecycle);
    fx.manager._persist = () => {
      throw new Error("synthetic lifecycle persistence failure");
    };
    assert.throws(
      () => fx.manager.activate(1, { operationId: "convergence-v1:activate" }),
      /POLICY_LIFECYCLE_ACTIVATION_CONVERGENCE_FAILED_DENIED/,
    );
    assert.equal(fx.activations(), 1);
    assert.equal(fx.rawFence.record.active.generation, 1);
    assert.equal(fx.rawFence.record.dispatch.status, "FROZEN");
    assert.equal(fx.rawFence.record.dispatch.reasonCode, "ACTIVATION_CONVERGENCE_FAILED");
    assert.deepEqual(readFileSync(fx.paths.lifecycle), persistedLifecycle);
  } finally {
    rmSync(fx.paths.directory, { recursive: true, force: true });
  }
});

test("authenticated lifecycle state and receipt chain reject edits on reload", () => {
  const fx = fixture("record-tamper");
  try {
    fx.manager.draft(artifact(fx, 1), { operationId: "tamper:draft" });
    const edited = JSON.parse(readFileSync(fx.paths.lifecycle, "utf8"));
    edited.receipts[0].transition = "ACTIVATED";
    writeFileSync(fx.paths.lifecycle, `${JSON.stringify(edited)}\n`);
    assert.throws(
      () => new PolicyLifecycleManager({
        recordPath: fx.paths.lifecycle,
        policyFence: fx.fence,
        ownerApprovalToken,
        ownerActivationToken,
        trustStore: fx.trust,
        now: fx.now,
      }),
      /POLICY_LIFECYCLE_RECORD_INVALID_DENIED/,
    );
    assert.equal(fx.activations(), 0);
  } finally {
    rmSync(fx.paths.directory, { recursive: true, force: true });
  }
});
