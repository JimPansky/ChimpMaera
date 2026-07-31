import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AdminAiPoc } from "../demo/runtime/admin-ai-poc.mjs";
import { ApprovalWorkbench } from "../demo/runtime/approval-workbench.mjs";
import {
  DemoMutationGate,
  canonicalJson,
  sha256,
} from "../demo/runtime/enforcement-gate.mjs";

const apiToken = "a".repeat(48);
const controlToken = "b".repeat(48);
const ownerAuthorityToken = "c".repeat(48);
const expectedOrigin = "http://127.0.0.1:7780";
const policyBytes = readFileSync(
  new URL(
    "../demo/manifests/authority/admin-ai-poc-policy-v1.json",
    import.meta.url,
  ),
);
const policy = JSON.parse(policyBytes.toString("utf8"));
const policyDigest = sha256(policyBytes);
const authorityContext = {
  profileId: "SAFE_GUIDED",
  profileGeneration: "test-generation-0001",
  policyGeneration: 1,
};
let sequence = 0;

function localRequest() {
  return {
    headers: {
      authorization: "Bearer " + apiToken,
      host: "127.0.0.1:7780",
      origin: expectedOrigin,
      "x-cm-csrf": "chimpmaera-local-v1",
    },
  };
}

function policyRequest(suffix) {
  return {
    schemaVersion: "chimpmaera.demo/admin-ai-request/v1",
    actor: "agent:admin-ai-poc",
    requestKind: "SYNTHETIC_DOLIBARR_ORDER_CREATE",
    replayKey: "admin-ai:poc:order:" + suffix,
  };
}

function harness({
  nowMs = 1_000_000,
  mutate,
  readback,
  root,
} = {}) {
  const clock = { value: nowMs };
  const dir = root ?? mkdtempSync(join(tmpdir(), "cm-approval-workbench-"));
  let mutations = 0;
  let readbacks = 0;
  const gate = new DemoMutationGate({
    apiToken,
    controlToken,
    ownerAuthorityToken,
    expectedOrigin,
    receiptPath: join(dir, "effects.json"),
    provider: {
      async mutate(action) {
        mutations += 1;
        return mutate === undefined ? { id: "order-42" } : mutate(action);
      },
      async readback(action, result) {
        readbacks += 1;
        return readback === undefined
          ? {
            id: result.id,
            date: action.payload.body.date,
            ref_client: action.payload.body.ref_client,
            socid: action.payload.body.socid,
          }
          : readback(action, result);
      },
    },
    adminAiPolicyDigest: policyDigest,
    now: () => clock.value,
    authorityContext,
  });
  const poc = new AdminAiPoc({
    policy,
    policyDigest,
    signAuthority: (fields) => gate.agentAuthority(fields),
  });
  const workbench = new ApprovalWorkbench({
    receiptPath: join(dir, "approvals.json"),
    issueAuthority: (fields) => gate.ownerAuthority(fields),
    now: () => clock.value,
    leaseTtlMs: 30_000,
    policyDigest,
    policyGeneration: authorityContext.policyGeneration,
    profileId: authorityContext.profileId,
    profileGeneration: authorityContext.profileGeneration,
  });
  return {
    clock,
    dir,
    gate,
    poc,
    workbench,
    mutations: () => mutations,
    readbacks: () => readbacks,
  };
}

function escalation(current, suffix = "case-" + sequence++) {
  const decision = current.poc.decide(policyRequest(suffix)).decision;
  const proposal = current.workbench.register(decision);
  return { decision, proposal };
}

function ownerDecision(current, decision, value) {
  return current.workbench.decide({
    decisionDigest: decision.decisionDigest,
    ownerDecision: value,
    ownerActor: "owner:local-demo",
  });
}

function effectEnvelope(decision, authority) {
  return {
    action: decision.action,
    actionDigest: decision.actionDigest,
    businessDiff: decision.businessDiff,
    businessDiffDigest: decision.businessDiffDigest,
    authority,
  };
}

test("readable business diff is decision-bound and approved order acts once with receipts and readback", async () => {
  const current = harness();
  const { decision, proposal } = escalation(current, "white-001");
  assert.equal(decision.outcome, "OWNER_ESCALATION");
  assert.equal(
    decision.businessDiff.summary,
    "Create one synthetic Dolibarr sales order if absent.",
  );
  assert.deepEqual(
    decision.businessDiff.changes.map(({ field, after }) => [field, after]),
    [
      ["customerReference", "CM-ADMIN-AI-ESCALATION-001"],
      ["customerId", 7],
      ["orderDateEpoch", 1767225600],
    ],
  );
  assert.equal(
    decision.businessDiffDigest,
    sha256(canonicalJson(decision.businessDiff)),
  );
  assert.equal(proposal.businessDiffDigest, decision.businessDiffDigest);

  const approved = ownerDecision(current, decision, "APPROVE");
  assert.equal(approved.status, "PASS");
  assert.equal(
    approved.decisionReceipt.outcome,
    "OWNER_APPROVED_AUTHORITY_ISSUED",
  );
  assert.equal(approved.authority.kind, "OWNER_ESCALATION_LEASE_HMAC_V1");
  assert.equal(approved.authority.maxUses, 1);
  assert.equal(
    approved.authority.ownerDecisionReceiptDigest,
    approved.decisionReceipt.receiptDigest,
  );
  assert.equal(approved.authority.profileId, "SAFE_GUIDED");
  assert.equal(approved.authority.expiresAtMs - approved.authority.issuedAtMs, 30_000);

  const result = await current.gate.execute(
    localRequest(),
    effectEnvelope(decision, approved.authority),
  );
  assert.equal(result.status, "PASS");
  assert.equal(result.replayed, false);
  assert.equal(current.mutations(), 1);
  assert.equal(current.readbacks(), 1);
  assert.equal(result.readback.ref_client, "CM-ADMIN-AI-ESCALATION-001");
  assert.equal(
    result.receipt.ownerDecisionReceiptDigest,
    approved.decisionReceipt.receiptDigest,
  );
  assert.equal(result.receipt.authority.leaseId, approved.authority.leaseId);
  assert.equal(result.receipt.businessDiffDigest, decision.businessDiffDigest);
  assert.deepEqual(
    current.workbench.readDecision(decision.decisionDigest),
    {
      status: "PASS",
      receipt: approved.decisionReceipt,
      authority: approved.authority,
    },
  );
  assert.deepEqual(
    current.gate.state.effects[decision.replayKey].receipt,
    result.receipt,
  );
});

test("rejected escalation is terminal, has no authority and cannot act", async () => {
  const current = harness();
  const { decision } = escalation(current, "reject-001");
  const rejected = ownerDecision(current, decision, "REJECT");
  assert.equal(rejected.authority, null);
  assert.equal(
    rejected.decisionReceipt.outcome,
    "OWNER_REJECTED_NO_AUTHORITY",
  );
  await assert.rejects(
    current.gate.execute(
      localRequest(),
      effectEnvelope(decision, rejected.authority),
    ),
    /AGENT_ACTION_SCOPE_DENIED/,
  );
  assert.throws(
    () => ownerDecision(current, decision, "APPROVE"),
    /OWNER_DECISION_ALREADY_FINAL_DENIED/,
  );
  assert.equal(current.mutations(), 0);
  assert.equal(current.readbacks(), 0);
});

test("tampered action, scope, diff, policy, profile, receipt and HMAC cannot act", async () => {
  const cases = [
    (envelope) => ({ ...envelope, unexpected: true }),
    (envelope) => ({ ...envelope, actionDigest: "0".repeat(64) }),
    (envelope) => {
      const action = structuredClone(envelope.action);
      action.scope.entity = "Invoice";
      return {
        ...envelope,
        action,
        actionDigest: sha256(canonicalJson(action)),
      };
    },
    (envelope) => {
      const businessDiff = structuredClone(envelope.businessDiff);
      businessDiff.changes[0].after = "TAMPERED";
      return { ...envelope, businessDiff };
    },
    (envelope) => ({
      ...envelope,
      authority: { ...envelope.authority, policyDigest: "0".repeat(64) },
    }),
    (envelope) => ({
      ...envelope,
      authority: { ...envelope.authority, profileGeneration: "other-generation" },
    }),
    (envelope) => ({
      ...envelope,
      authority: {
        ...envelope.authority,
        ownerDecisionReceiptDigest: "0".repeat(64),
      },
    }),
    (envelope) => ({
      ...envelope,
      authority: { ...envelope.authority, binding: "0".repeat(64) },
    }),
  ];
  for (const mutateEnvelope of cases) {
    const current = harness();
    const { decision } = escalation(current);
    const approved = ownerDecision(current, decision, "APPROVE");
    await assert.rejects(
      current.gate.execute(
        localRequest(),
        mutateEnvelope(effectEnvelope(decision, approved.authority)),
      ),
      /OWNER_EFFECT_ENVELOPE_INVALID_DENIED|ACTION_DIGEST_MISMATCH_DENIED|SCOPE_MISMATCH_DENIED|AGENT_ACTION_SCOPE_DENIED|OWNER_AUTHORITY_INVALID_DENIED/,
    );
    assert.equal(current.mutations(), 0);
    assert.equal(current.readbacks(), 0);
  }
});

test("not-yet-valid and expired leases fail before provider access", async () => {
  {
    const current = harness({ nowMs: 50_000 });
    const { decision } = escalation(current, "future-001");
    const approved = ownerDecision(current, decision, "APPROVE");
    current.clock.value = approved.authority.notBeforeMs - 1;
    await assert.rejects(
      current.gate.execute(
        localRequest(),
        effectEnvelope(decision, approved.authority),
      ),
      /AUTHORITY_NOT_YET_VALID_DENIED/,
    );
    assert.equal(current.mutations(), 0);
  }
  {
    const current = harness({ nowMs: 60_000 });
    const { decision } = escalation(current, "expired-001");
    const approved = ownerDecision(current, decision, "APPROVE");
    current.clock.value = approved.authority.expiresAtMs;
    await assert.rejects(
      current.gate.execute(
        localRequest(),
        effectEnvelope(decision, approved.authority),
      ),
      /AUTHORITY_EXPIRED_DENIED/,
    );
    assert.equal(current.mutations(), 0);
  }
});

test("consumed authority replay cannot act a second time", async () => {
  const current = harness();
  const { decision } = escalation(current, "replay-001");
  const approved = ownerDecision(current, decision, "APPROVE");
  const envelope = effectEnvelope(decision, approved.authority);
  await current.gate.execute(localRequest(), envelope);
  await assert.rejects(
    current.gate.execute(localRequest(), envelope),
    /AUTHORITY_LEASE_REPLAY_DENIED/,
  );
  assert.equal(current.mutations(), 1);
  assert.equal(current.readbacks(), 1);
});

test("concurrent and restart replay see the durable EXECUTING reservation", async () => {
  let releaseMutation;
  const mutationBarrier = new Promise((resolve) => {
    releaseMutation = resolve;
  });
  const current = harness({
    mutate: async () => {
      await mutationBarrier;
      return { id: "order-concurrent" };
    },
  });
  const { decision } = escalation(current, "concurrent-001");
  const approved = ownerDecision(current, decision, "APPROVE");
  const envelope = effectEnvelope(decision, approved.authority);
  const first = current.gate.execute(localRequest(), envelope);

  await assert.rejects(
    current.gate.execute(localRequest(), envelope),
    /AUTHORITY_LEASE_REPLAY_DENIED/,
  );
  const restarted = harness({ root: current.dir });
  await assert.rejects(
    restarted.gate.execute(localRequest(), envelope),
    /AUTHORITY_LEASE_REPLAY_DENIED/,
  );
  assert.equal(current.mutations(), 1);
  assert.equal(restarted.mutations(), 0);
  releaseMutation();
  await first;
});

test("semantic readback mismatch records ambiguity and no success receipt", async () => {
  const current = harness({
    readback: async () => ({
      id: "order-wrong",
      date: 1767225600,
      ref_client: "WRONG",
      socid: 7,
    }),
  });
  const { decision } = escalation(current, "readback-001");
  const approved = ownerDecision(current, decision, "APPROVE");
  await assert.rejects(
    current.gate.execute(
      localRequest(),
      effectEnvelope(decision, approved.authority),
    ),
    /PROVIDER_READBACK_MISMATCH_DENIED/,
  );
  assert.equal(current.mutations(), 1);
  assert.equal(current.readbacks(), 1);
  assert.equal(current.gate.state.effects[decision.replayKey], undefined);
  assert.equal(
    current.gate.state.reservations[decision.replayKey].status,
    "AMBIGUOUS",
  );
});

test("tampered persisted approval and effect stores refuse startup", async () => {
  {
    const current = harness();
    const { decision } = escalation(current, "store-approval-001");
    ownerDecision(current, decision, "APPROVE");
    const path = join(current.dir, "approvals.json");
    const value = JSON.parse(readFileSync(path, "utf8"));
    value.decisions[decision.decisionDigest].receipt.outcome = "TAMPERED";
    writeFileSync(path, JSON.stringify(value));
    assert.throws(
      () => harness({ root: current.dir }),
      /OWNER_DECISION_RECEIPT_INVALID_DENIED/,
    );
  }
  {
    const current = harness();
    const { decision } = escalation(current, "store-effect-001");
    const approved = ownerDecision(current, decision, "APPROVE");
    await current.gate.execute(
      localRequest(),
      effectEnvelope(decision, approved.authority),
    );
    const path = join(current.dir, "effects.json");
    const value = JSON.parse(readFileSync(path, "utf8"));
    value.effects[decision.replayKey].receipt.outcome = "TAMPERED";
    writeFileSync(path, JSON.stringify(value));
    assert.throws(
      () => harness({ root: current.dir }),
      /EFFECT_STORE_INVALID_DENIED/,
    );
  }
});

test("production server wires authenticated owner decision and receipt readback endpoints", () => {
  const server = readFileSync(
    new URL("../demo/runtime/server.mjs", import.meta.url),
    "utf8",
  );
  assert.match(server, /\/api\/demo\/admin-ai\/owner-decision/);
  assert.match(server, /\/api\/demo\/admin-ai\/owner-decision-receipt\?/);
  assert.match(server, /ownerActor: "owner:local-demo"/);
  assert.match(server, /authorizeLocalRequest\(incoming/);
  assert.doesNotMatch(server, /ownerActor: body\./);
  assert.match(server, /\/var\/lib\/chimpmaera\/owner-authority\.key/);
  const seed = readFileSync(
    new URL("../demo/seed-and-flow.sh", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(seed, /owner[_-]authority|chimp-owner-authority-token/);
  const smoke = readFileSync(
    new URL("../demo/approval-workbench-smoke.sh", import.meta.url),
    "utf8",
  );
  const acceptance = readFileSync(
    new URL("../demo/acceptance.sh", import.meta.url),
    "utf8",
  );
  assert.match(smoke, /OWNER_APPROVED_AUTHORITY_ISSUED/);
  assert.match(smoke, /OWNER_REJECTED_NO_AUTHORITY/);
  assert.match(smoke, /AUTHORITY_LEASE_REPLAY_DENIED/);
  assert.match(smoke, /owner-decision-receipt/);
  assert.match(acceptance, /approval-workbench-smoke\.sh/);
});
