import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  DemoMutationGate,
  authorizeLocalRequest,
  canonicalJson,
  sha256,
} from "../demo/runtime/enforcement-gate.mjs";

const apiToken = "a".repeat(48);
const controlToken = "b".repeat(48);
const expectedOrigin = "http://127.0.0.1:7780";
let sequence = 0;

function request(overrides = {}) {
  return {
    headers: {
      authorization: `Bearer ${apiToken}`,
      host: "127.0.0.1:7780",
      origin: expectedOrigin,
      "x-cm-csrf": "chimpmaera-local-v1",
      ...overrides,
    },
  };
}

function harness({ readback = { id: "42", ref_client: "CM-DEMO-OPP-001" } } = {}) {
  let mutations = 0;
  const gate = new DemoMutationGate({
    apiToken,
    controlToken,
    expectedOrigin,
    receiptPath: join(tmpdir(), `cm-effect-test-${process.pid}-${sequence++}.json`),
    provider: {
      async mutate() {
        mutations += 1;
        return "42";
      },
      async readback() {
        return readback;
      },
    },
  });
  return { gate, mutations: () => mutations };
}

function action(overrides = {}) {
  const base = {
    actionType: "PROVIDER_MUTATION",
    actor: "installer:seed-and-flow",
    payload: {
      body: {
        date: 1767225600,
        ref_client: "CM-DEMO-OPP-001",
        socid: 7,
      },
      method: "POST",
      path: "/orders",
    },
    replayKey: "seed:dolibarr:order:CM-DEMO-OPP-001",
    scope: {
      actor: "installer:seed-and-flow",
      entity: "Order",
      operation: "CREATE_IF_ABSENT",
      provider: "dolibarr",
      tenant: "panskys-zoo-demo",
    },
  };
  return {
    ...base,
    ...overrides,
    payload: { ...base.payload, ...(overrides.payload ?? {}) },
    scope: { ...base.scope, ...(overrides.scope ?? {}) },
  };
}

function envelope(gate, actionValue, overrides = {}) {
  const actionDigest = sha256(canonicalJson(actionValue));
  return {
    action: actionValue,
    actionDigest,
    approval: {
      actionDigest,
      approver: "owner:local-demo",
      binding: gate.approvalBinding(actionDigest, actionValue),
      decision: "APPROVE",
    },
    ...overrides,
  };
}

test("positive CRM-to-ERP provider effect is gate-enforced and receipt-bound", async () => {
  const { gate, mutations } = harness();
  const value = action();
  const result = await gate.execute(request(), envelope(gate, value));
  assert.equal(result.status, "PASS");
  assert.equal(result.replayed, false);
  assert.equal(mutations(), 1);
  assert.equal(
    result.receipt.actionDigest,
    "596668159a24a01edb3a225ca70df4e5439e559b87d4b74bf2bf7c2ef1d54c44",
  );
  assert.equal(
    gate.approvalBinding(result.receipt.actionDigest, value),
    "a8d2db95c7dbbf8c8b8aba0dc60e75d8890e9abff3baaec9218698e2e0637f43",
  );
  assert.equal(result.receipt.actionDigest, sha256(canonicalJson(value)));
  assert.equal(result.receipt.actor, value.actor);
  assert.deepEqual(result.receipt.scope, value.scope);
  assert.equal(result.receipt.provider.objectReference, "42");
  assert.equal(result.receipt.outcome, "PROVIDER_MUTATION_READBACK_VERIFIED");
  assert.equal(result.receipt.replayState, "FIRST_EXECUTION");
  assert.equal(
    result.receipt.receiptDigest,
    "c30859bb8a60aa54ba230ff807ca68a950eb83e1bc32e913b4ed67b67f163ba5",
  );
  assert.equal(result.receipt.authority, undefined);
  assert.equal(result.receipt.decisionDigest, undefined);
  assert.equal(result.receipt.policyDigest, undefined);
});

test("missing and invalid caller auth are denied before provider access", async () => {
  for (const authorization of [undefined, "Bearer wrong"]) {
    const { gate, mutations } = harness();
    const value = action();
    await assert.rejects(
      gate.execute(request({ authorization }), envelope(gate, value)),
      /AUTHENTICATION_REQUIRED/,
    );
    assert.equal(mutations(), 0);
  }
});

test("client ownerConfirmed cannot forge authorization", async () => {
  const { gate, mutations } = harness();
  const value = action();
  await assert.rejects(
    gate.execute(
      request({ authorization: undefined }),
      { ...envelope(gate, value), ownerConfirmed: true },
    ),
    /AUTHENTICATION_REQUIRED/,
  );
  assert.equal(mutations(), 0);
});

test("digest mismatch is denied", async () => {
  const { gate, mutations } = harness();
  const value = action();
  await assert.rejects(
    gate.execute(request(), {
      ...envelope(gate, value),
      actionDigest: "0".repeat(64),
    }),
    /ACTION_DIGEST_MISMATCH_DENIED/,
  );
  assert.equal(mutations(), 0);
});

test("scope mismatch and identity mismatch are denied", async () => {
  {
    const { gate, mutations } = harness();
    const value = action({ scope: { entity: "Invoice" } });
    await assert.rejects(
      gate.execute(request(), envelope(gate, value)),
      /SCOPE_MISMATCH_DENIED/,
    );
    assert.equal(mutations(), 0);
  }
  {
    const { gate, mutations } = harness();
    const value = action({ scope: { actor: "attacker:forged" } });
    await assert.rejects(
      gate.execute(request(), envelope(gate, value)),
      /IDENTITY_MISMATCH_DENIED/,
    );
    assert.equal(mutations(), 0);
  }
});

test("unknown action is denied", async () => {
  const { gate, mutations } = harness();
  const value = action({ actionType: "RAW_PROVIDER_CALL" });
  await assert.rejects(
    gate.execute(request(), envelope(gate, value)),
    /UNKNOWN_ACTION_DENIED/,
  );
  assert.equal(mutations(), 0);
});

test("replay key is idempotent and cannot produce a duplicate", async () => {
  const { gate, mutations } = harness();
  const value = action();
  const first = await gate.execute(request(), envelope(gate, value));
  const replay = await gate.execute(request(), envelope(gate, value));
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.replayState, "REPLAY_NO_DUPLICATE");
  assert.equal(replay.receipt.receiptDigest, first.receipt.receiptDigest);
  assert.equal(mutations(), 1);
});

test("readback is mandatory and no success receipt is persisted without it", async () => {
  const { gate } = harness({ readback: null });
  const value = action();
  await assert.rejects(
    gate.execute(request(), envelope(gate, value)),
    /PROVIDER_READBACK_REQUIRED/,
  );
  assert.deepEqual(gate.state.effects, {});
});

test("all coordinator control POSTs require bearer auth, canonical host, origin and CSRF", () => {
  for (const headers of [
    {},
    { authorization: `Bearer ${apiToken}` },
    {
      authorization: `Bearer ${apiToken}`,
      host: "localhost:7780",
      origin: expectedOrigin,
      "x-cm-csrf": "chimpmaera-local-v1",
    },
    {
      authorization: `Bearer ${apiToken}`,
      host: "127.0.0.1:7780",
      origin: "http://evil.example",
      "x-cm-csrf": "chimpmaera-local-v1",
    },
  ]) {
    assert.throws(
      () => authorizeLocalRequest(
        { headers },
        { apiToken, expectedOrigin },
      ),
      /AUTHENTICATION_REQUIRED|CANONICAL_HOST_REQUIRED|SAME_ORIGIN_REQUIRED/,
    );
  }
  assert.doesNotThrow(() => authorizeLocalRequest(request(), {
    apiToken,
    expectedOrigin,
  }));
});

test("direct installer provider mutation and credentials are absent from seed path", () => {
  const seed = readFileSync(
    new URL("../demo/seed-and-flow.sh", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(seed, /secrets\/(?:espo-admin|doli-api-key)/);
  assert.doesNotMatch(seed, /\$espo_base|\$doli_base|DOLAPIKEY|admin:\$espo/);
  assert.match(seed, /\/api\/demo\/effects/);
  assert.match(seed, /\/api\/demo\/provider-read/);

  const runtime = readFileSync(
    new URL("../demo/runtime/server.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    runtime,
    /incoming\.method === "POST" && incoming\.url\?\.startsWith\("\/api\/"\)/,
  );
  assert.match(runtime, /authorizeLocalRequest\(incoming/);
});
