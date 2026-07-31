import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AdminAiPoc } from "../demo/runtime/admin-ai-poc.mjs";
import { canonicalJson, sha256 } from "../demo/runtime/enforcement-gate.mjs";
import {
  POLICY_EVALUATION_INPUT_SCHEMA,
  TRUSTED_POLICY_CONTEXT_SCHEMA,
  createInternalStaticPolicyEvaluator,
  validatePolicyDecision,
  validatePolicyEvaluationInput,
} from "../demo/runtime/policy-evaluator.mjs";

const policyBytes = readFileSync(
  new URL("../demo/manifests/authority/admin-ai-poc-policy-v1.json", import.meta.url),
);
const policy = JSON.parse(policyBytes);
const policyDigest = sha256(policyBytes);

function input(capability = "customer.contact.create") {
  const hasAction = capability !== "request.undeclared";
  return {
    schemaVersion: POLICY_EVALUATION_INPUT_SCHEMA,
    actor: "agent:admin-ai-poc",
    capability,
    operation: hasAction ? "CREATE_IF_ABSENT" : "UNDECLARED_REQUEST",
    resource: capability === "sales.order.create"
      ? "SalesOrder"
      : hasAction ? "CustomerContact" : "UndeclaredRequest",
    tenant: "panskys-zoo-demo",
    materiality: capability === "sales.order.create"
      ? "MATERIAL_SYNTHETIC"
      : hasAction ? "LOW_SYNTHETIC" : "UNDECLARED",
    adapter: {
      adapterId: capability === "sales.order.create"
        ? "dolibarr-order"
        : hasAction ? "espocrm-contact" : "deny-only",
      adapterVersion: "1.0.0",
    },
    actionDigest: hasAction ? "a".repeat(64) : null,
    scopeDigest: hasAction ? "b".repeat(64) : null,
    replayKey: "admin-ai:poc:policy-evaluator-001",
    requestDigest: "c".repeat(64),
  };
}

function context(evaluator) {
  return {
    schemaVersion: TRUSTED_POLICY_CONTEXT_SCHEMA,
    profileId: "SAFE_GUIDED",
    profileGeneration: "test-generation-v1",
    policyId: "admin-ai-poc-policy-v1",
    policyGeneration: 1,
    policySourceDigest: policyDigest,
    policySemanticDigest: evaluator.policySemanticDigest,
  };
}

function request(kind, suffix = "policy-evaluator-001") {
  return {
    schemaVersion: "chimpmaera.demo/admin-ai-request/v1",
    actor: "agent:admin-ai-poc",
    requestKind: kind,
    replayKey: `admin-ai:poc:${suffix}`,
  };
}

test("internal provider evaluates neutral intents deterministically without authority", () => {
  const evaluator = createInternalStaticPolicyEvaluator({
    policy,
    policySourceDigest: policyDigest,
  });
  const trusted = context(evaluator);
  const decisions = [
    input("customer.contact.create"),
    input("sales.order.create"),
    input("request.undeclared"),
  ].map((value) => evaluator.evaluate(value, trusted));

  assert.deepEqual(
    decisions.map(({ outcome }) => outcome),
    ["AUTO_GRANT", "OWNER_ESCALATION", "DENY"],
  );
  assert.deepEqual(
    decisions.map(({ constraints }) => constraints.authorityIssuer),
    ["CHIMPMAERA_GATE_ONLY", "CHIMPMAERA_GATE_ONLY", "CHIMPMAERA_GATE_ONLY"],
  );
  assert.ok(decisions.every((decision) => !Object.hasOwn(decision, "authority")));
  assert.deepEqual(
    evaluator.evaluate(input(), trusted),
    evaluator.evaluate(input(), trusted),
  );
});

test("input, trusted context and decision bindings fail closed on tamper", () => {
  const evaluator = createInternalStaticPolicyEvaluator({
    policy,
    policySourceDigest: policyDigest,
  });
  const trusted = context(evaluator);
  const value = input();
  const decision = evaluator.evaluate(value, trusted);

  for (const mutated of [
    { ...value, extra: true },
    { ...value, actionDigest: null },
    { ...value, replayKey: "https://attacker.invalid/" },
    { ...value, adapter: { ...value.adapter, adapterId: "../escape" } },
  ]) assert.throws(
    () => validatePolicyEvaluationInput(mutated),
    /POLICY_EVALUATION_INPUT_INVALID_DENIED/,
  );

  for (const mutated of [
    { ...decision, extra: true },
    { ...decision, inputDigest: "0".repeat(64) },
    { ...decision, outcome: "ALLOW" },
    { ...decision, authority: { kind: "forged" } },
  ]) assert.throws(
    () => validatePolicyDecision(mutated, value, trusted),
    /POLICY_DECISION_INVALID_DENIED/,
  );
  assert.throws(
    () => evaluator.evaluate(value, {
      ...trusted,
      policySourceDigest: "0".repeat(64),
    }),
    /POLICY_PROVIDER_CONTEXT_MISMATCH_DENIED/,
  );
});

test("Admin AI has no grant fallback for malformed, throwing or overbroad evaluators", () => {
  const base = createInternalStaticPolicyEvaluator({
    policy,
    policySourceDigest: policyDigest,
  });
  let signatures = 0;
  const makePoc = (evaluate) => new AdminAiPoc({
    policy,
    policyDigest,
    policyEvaluator: {
      providerId: "test-provider",
      providerVersion: "1.0.0",
      policySemanticDigest: base.policySemanticDigest,
      evaluate,
    },
    signAuthority: () => {
      signatures += 1;
      return { forged: true };
    },
  });

  assert.throws(
    () => makePoc(() => { throw new Error("provider unavailable"); }).decide(
      request("SYNTHETIC_ESPOCRM_CONTACT_CREATE", "throwing-001"),
    ),
    /provider unavailable/,
  );
  assert.throws(
    () => makePoc((policyInput, trusted) => ({
      ...base.evaluate(policyInput, trusted),
      authority: { kind: "forged" },
    })).decide(request("SYNTHETIC_ESPOCRM_CONTACT_CREATE", "extra-001")),
    /POLICY_DECISION_INVALID_DENIED/,
  );
  assert.throws(
    () => makePoc((policyInput, trusted) => {
      const original = base.evaluate(policyInput, trusted);
      const core = {
        ...original,
        outcome: "AUTO_GRANT",
        reasonCodes: ["POLICY_SYNTHETIC_CONTACT_AUTO_GRANTED"],
        constraints: { ...original.constraints, maximumEffects: 1 },
      };
      delete core.decisionDigest;
      return { ...core, decisionDigest: sha256(canonicalJson(core)) };
    }).decide(request("SYNTHETIC_DOLIBARR_ORDER_CREATE", "ceiling-001")),
    /POLICY_DECISION_EXCEEDS_ADAPTER_CEILING_DENIED/,
  );
  assert.equal(signatures, 0);
});

