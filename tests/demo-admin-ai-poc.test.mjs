import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AdminAiPoc } from "../demo/runtime/admin-ai-poc.mjs";
import {
  DemoMutationGate,
  canonicalJson,
  sha256,
} from "../demo/runtime/enforcement-gate.mjs";

const apiToken = "a".repeat(48);
const controlToken = "b".repeat(48);
const expectedOrigin = "http://127.0.0.1:7780";
const policyBytes = readFileSync(
  new URL("../demo/manifests/authority/admin-ai-poc-policy-v1.json", import.meta.url),
);
const policy = JSON.parse(policyBytes.toString("utf8"));
const policyDigest = sha256(policyBytes);
let sequence = 0;

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

function policyRequest(requestKind, replaySuffix) {
  return {
    schemaVersion: "chimpmaera.demo/admin-ai-request/v1",
    actor: "agent:admin-ai-poc",
    requestKind,
    replayKey: `admin-ai:poc:${replaySuffix}`,
  };
}

function harness() {
  let mutations = 0;
  let readbacks = 0;
  const gate = new DemoMutationGate({
    apiToken,
    controlToken,
    expectedOrigin,
    adminAiPolicyDigest: policyDigest,
    receiptPath: join(
      tmpdir(),
      `cm-admin-ai-test-${process.pid}-${sequence++}.json`,
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
          description: "PANSPHAIRA Admin AI deterministic PoC contact",
          emailAddress: "admin-ai-poc@example.invalid",
          firstName: "Avery",
          lastName: "Admin AI PoC",
        };
      },
    },
  });
  const poc = new AdminAiPoc({
    policy,
    policyDigest,
    signAuthority: (fields) => gate.agentAuthority(fields),
  });
  return {
    gate,
    poc,
    mutations: () => mutations,
    readbacks: () => readbacks,
  };
}

function effectEnvelope(decision) {
  return {
    action: decision.action,
    actionDigest: decision.actionDigest,
    authority: decision.authority,
  };
}

test("policy has exactly three deterministic outcomes and only auto-grant has authority", () => {
  const { poc } = harness();
  const auto = poc.decide(policyRequest(
    "SYNTHETIC_ESPOCRM_CONTACT_CREATE",
    "contact:outcomes-001",
  )).decision;
  const escalation = poc.decide(policyRequest(
    "SYNTHETIC_DOLIBARR_ORDER_CREATE",
    "order:outcomes-001",
  )).decision;
  const denied = poc.decide(policyRequest(
    "UNDECLARED_PROVIDER_DELETE",
    "unknown:outcomes-001",
  )).decision;

  assert.deepEqual(
    [auto.outcome, escalation.outcome, denied.outcome],
    ["AUTO_GRANT", "OWNER_ESCALATION", "DENY"],
  );
  assert.deepEqual(
    [auto.reasonCodes, escalation.reasonCodes, denied.reasonCodes],
    [
      ["POLICY_SYNTHETIC_CONTACT_AUTO_GRANTED"],
      ["POLICY_ORDER_REQUIRES_OWNER"],
      ["POLICY_REQUEST_NOT_ALLOWED"],
    ],
  );
  assert.equal(auto.action.scope.provider, "espocrm");
  assert.equal(auto.action.scope.entity, "Contact");
  assert.equal(auto.authority.kind, "ADMIN_AI_POC_HMAC_V1");
  assert.equal(escalation.action.scope.provider, "dolibarr");
  assert.equal(escalation.action.scope.entity, "Order");
  assert.match(escalation.actionDigest, /^[a-f0-9]{64}$/);
  assert.equal(escalation.authority, null);
  assert.equal(denied.action, null);
  assert.equal(denied.actionDigest, null);
  assert.equal(denied.authority, null);
  assert.ok([auto, escalation, denied].every((value) =>
    value.policyDigest === policyDigest
    && /^[a-f0-9]{64}$/.test(value.decisionDigest)
  ));
  assert.deepEqual(
    poc.decide(policyRequest(
      "SYNTHETIC_ESPOCRM_CONTACT_CREATE",
      "contact:outcomes-001",
    )).decision,
    auto,
  );
});

test("AUTO_GRANT reaches the provider once and returns readback plus bound receipt", async () => {
  const { gate, poc, mutations, readbacks } = harness();
  const decision = poc.decide(policyRequest(
    "SYNTHETIC_ESPOCRM_CONTACT_CREATE",
    "contact:happy-001",
  )).decision;
  const result = await gate.execute(localRequest(), effectEnvelope(decision));

  assert.equal(result.status, "PASS");
  assert.equal(result.replayed, false);
  assert.equal(mutations(), 1);
  assert.equal(readbacks(), 1);
  assert.equal(result.readback.id, "contact-42");
  assert.equal(result.receipt.authority.kind, "ADMIN_AI_POC_HMAC_V1");
  assert.equal(result.receipt.decisionDigest, decision.decisionDigest);
  assert.equal(result.receipt.policyDigest, policyDigest);
  assert.equal(result.receipt.actionDigest, decision.actionDigest);
  assert.match(result.receipt.receiptDigest, /^[a-f0-9]{64}$/);
  const { receiptDigest, ...receiptCore } = result.receipt;
  assert.equal(receiptDigest, sha256(canonicalJson(receiptCore)));
  assert.deepEqual(
    gate.state.effects[decision.replayKey].receipt,
    result.receipt,
  );
});

test("OWNER_ESCALATION and DENY carry no executable authority", async () => {
  for (const [requestKind, suffix] of [
    ["SYNTHETIC_DOLIBARR_ORDER_CREATE", "order:not-executable-001"],
    ["UNDECLARED_PROVIDER_DELETE", "unknown:not-executable-001"],
  ]) {
    const { gate, poc, mutations, readbacks } = harness();
    const decision = poc.decide(policyRequest(requestKind, suffix)).decision;
    assert.equal(decision.authority, null);
    await assert.rejects(
      gate.execute(localRequest(), effectEnvelope(decision)),
      /AGENT_ACTION_SCOPE_DENIED|ACTION_INVALID/,
    );
    assert.equal(mutations(), 0);
    assert.equal(readbacks(), 0);
  }
});

test("allowed contact effect without authority fails closed", async () => {
  const { gate, poc, mutations, readbacks } = harness();
  const decision = poc.decide(policyRequest(
    "SYNTHETIC_ESPOCRM_CONTACT_CREATE",
    "contact:no-authority-001",
  )).decision;
  await assert.rejects(
    gate.execute(localRequest(), {
      ...effectEnvelope(decision),
      authority: null,
    }),
    /AGENT_AUTHORITY_INVALID_DENIED/,
  );
  assert.equal(mutations(), 0);
  assert.equal(readbacks(), 0);
});

test("tampered authority and action/decision/policy digests fail before provider access", async () => {
  const mutations = [
    (envelope) => ({ ...envelope, actionDigest: "0".repeat(64) }),
    (envelope) => ({
      ...envelope,
      authority: { ...envelope.authority, actionDigest: "0".repeat(64) },
    }),
    (envelope) => ({
      ...envelope,
      authority: { ...envelope.authority, decisionDigest: "0".repeat(64) },
    }),
    (envelope) => ({
      ...envelope,
      authority: { ...envelope.authority, policyDigest: "0".repeat(64) },
    }),
    (envelope) => ({
      ...envelope,
      authority: { ...envelope.authority, binding: "0".repeat(64) },
    }),
    (envelope) => {
      const action = structuredClone(envelope.action);
      action.payload.body.firstName = "Mallory";
      return { ...envelope, action, actionDigest: sha256(canonicalJson(action)) };
    },
  ];
  for (const mutate of mutations) {
    const current = harness();
    const decision = current.poc.decide(policyRequest(
      "SYNTHETIC_ESPOCRM_CONTACT_CREATE",
      `contact:tamper-${sequence}`,
    )).decision;
    await assert.rejects(
      current.gate.execute(localRequest(), mutate(effectEnvelope(decision))),
      /ACTION_DIGEST_MISMATCH_DENIED|AGENT_AUTHORITY_INVALID_DENIED|AGENT_ACTION_SCOPE_DENIED/,
    );
    assert.equal(current.mutations(), 0);
    assert.equal(current.readbacks(), 0);
  }
});

test("identical valid replay retains existing idempotent one-provider-call semantics", async () => {
  const { gate, poc, mutations, readbacks } = harness();
  const decision = poc.decide(policyRequest(
    "SYNTHETIC_ESPOCRM_CONTACT_CREATE",
    "contact:replay-001",
  )).decision;
  const first = await gate.execute(localRequest(), effectEnvelope(decision));
  const replay = await gate.execute(localRequest(), effectEnvelope(decision));

  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.replayState, "REPLAY_NO_DUPLICATE");
  assert.equal(replay.receipt.receiptDigest, first.receipt.receiptDigest);
  assert.equal(mutations(), 1);
  assert.equal(readbacks(), 1);
});
