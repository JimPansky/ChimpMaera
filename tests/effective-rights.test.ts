import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compileEffectiveRightsV1,
  renderPermissionXrayV1,
  syntheticEffectiveRightsInputV1,
  verifyEffectiveRightsResultV1,
  verifyPermissionXrayParityV1,
  type EffectiveRightsInputV1,
  type EffectiveRightsIssueCodeV1,
} from "../packages/contracts/src/index.js";

function mutate(
  input: EffectiveRightsInputV1,
  change: (value: Record<string, any>) => void,
): unknown {
  const value = structuredClone(input) as Record<string, any>;
  change(value);
  return value;
}

test("AAS-003-1 exact typed operands deny missing, unknown, stale and conflicting facts", () => {
  const valid = syntheticEffectiveRightsInputV1();
  const probes: readonly [
    string,
    unknown,
    EffectiveRightsIssueCodeV1,
  ][] = [
    [
      "missing profile",
      mutate(valid, (value) => {
        value.operands = value.operands.filter(({ kind }: { kind: string }) =>
          kind !== "PROFILE");
      }),
      "EFFECTIVE_RIGHTS_OPERAND_MISSING_DENIED",
    ],
    [
      "unknown operand kind",
      mutate(valid, (value) => {
        value.operands[0].kind = "IMPLIED_ROLE";
      }),
      "EFFECTIVE_RIGHTS_OPERAND_KIND_UNKNOWN_DENIED",
    ],
    [
      "stale assignment profile generation",
      mutate(valid, (value) => {
        value.operands.find(({ kind }: { kind: string }) =>
          kind === "PROFILE").profileGeneration = 2;
      }),
      "EFFECTIVE_RIGHTS_OPERAND_GENERATION_STALE_DENIED",
    ],
    [
      "duplicate profile",
      mutate(valid, (value) => {
        value.operands.push(structuredClone(value.operands[0]));
      }),
      "EFFECTIVE_RIGHTS_OPERAND_DUPLICATE_DENIED",
    ],
    [
      "unknown top-level field",
      mutate(valid, (value) => {
        value.impliedAuthority = true;
      }),
      "EFFECTIVE_RIGHTS_INPUT_SCHEMA_DENIED",
    ],
    [
      "unknown operand field",
      mutate(valid, (value) => {
        value.operands[0].hiddenGrant = true;
      }),
      "EFFECTIVE_RIGHTS_OPERAND_SCHEMA_DENIED",
    ],
    [
      "wrong tenant binding",
      mutate(valid, (value) => {
        value.operands[1].tenant = "foreign-tenant";
      }),
      "EFFECTIVE_RIGHTS_BINDING_MISMATCH_DENIED",
    ],
    [
      "unknown action",
      mutate(valid, (value) => {
        value.operands[2].scope.actions = ["shell.exec"];
      }),
      "EFFECTIVE_RIGHTS_SCOPE_UNKNOWN_DENIED",
    ],
    [
      "duplicate scope entry",
      mutate(valid, (value) => {
        value.operands[3].scope.actions = [
          "crm.contact.create",
          "crm.contact.create",
        ];
      }),
      "EFFECTIVE_RIGHTS_OPERAND_CONFLICT_DENIED",
    ],
  ];
  for (const [label, input, issue] of probes) {
    const result = compileEffectiveRightsV1(input);
    assert.equal(result.outcome, "DENY", label);
    assert.ok(result.issues.includes(issue), label);
    assert.equal(result.informationalOnly, true, label);
  }
});

test("AAS-003-2 canonical least-permissive intersection is stable and digest-bound", () => {
  const input = syntheticEffectiveRightsInputV1();
  const allowed = compileEffectiveRightsV1(input);
  assert.equal(allowed.outcome, "ALLOW");
  assert.deepEqual(allowed.effectiveScope, {
    actions: ["crm.contact.create"],
    resources: ["espocrm.contact"],
    fields: ["email", "name"],
    purposes: ["synthetic.demo"],
    effects: ["CREATE"],
  });
  assert.deepEqual(
    allowed.ceilings.map(({ kind }) => kind),
    ["ASSIGNMENT", "CAPABILITY", "CONSTRAINT", "PROFILE"],
  );
  assert.equal(allowed.ceilings.length, 4);

  const escalated = compileEffectiveRightsV1(
    syntheticEffectiveRightsInputV1({ CONSTRAINT: "ESCALATE" }),
  );
  assert.equal(escalated.outcome, "ESCALATE");
  assert.equal(escalated.issues.length, 0);
  const denied = compileEffectiveRightsV1(
    syntheticEffectiveRightsInputV1({ CONSTRAINT: "DENY" }),
  );
  assert.equal(denied.outcome, "DENY");
  assert.ok(denied.issues.includes("EFFECTIVE_RIGHTS_EXPLICIT_DENY"));

  const reordered = mutate(input, (value) => {
    value.operands.reverse();
    value.operands[3].scope.actions.reverse();
  });
  const same = compileEffectiveRightsV1(reordered);
  assert.equal(same.inputDigest, allowed.inputDigest);
  assert.equal(same.resultDigest, allowed.resultDigest);
  assert.notEqual(escalated.resultDigest, allowed.resultDigest);
  assert.equal(verifyEffectiveRightsResultV1(allowed).resultDigest, allowed.resultDigest);
});

test("AAS-003-3 permission X-ray renders every machine fact with exact parity", () => {
  const result = compileEffectiveRightsV1(
    syntheticEffectiveRightsInputV1({ ASSIGNMENT: "ESCALATE" }),
  );
  const view = renderPermissionXrayV1(result);
  assert.equal(verifyPermissionXrayParityV1(view, result), true);
  assert.equal(view.sourceResultDigest, result.resultDigest);
  assert.deepEqual(view.effectiveScope, result.effectiveScope);
  assert.deepEqual(view.ceilings, result.ceilings);
  assert.deepEqual(view.reasonFacts, result.reasonFacts);
  assert.deepEqual(view.issues, result.issues);

  const omittedCeiling = structuredClone(view) as Record<string, any>;
  omittedCeiling.ceilings.pop();
  assert.equal(verifyPermissionXrayParityV1(omittedCeiling, result), false);
  const weakenedOutcome = { ...view, outcome: "ALLOW" };
  assert.equal(verifyPermissionXrayParityV1(weakenedOutcome, result), false);
});

test("AAS-003-4 capability alone and empty scope never imply executable authority", () => {
  const input = syntheticEffectiveRightsInputV1();
  const capabilityOnly = mutate(input, (value) => {
    value.operands = value.operands.filter(({ kind }: { kind: string }) =>
      kind === "CAPABILITY");
  });
  const incomplete = compileEffectiveRightsV1(capabilityOnly);
  assert.equal(incomplete.outcome, "DENY");
  assert.ok(
    incomplete.issues.includes("EFFECTIVE_RIGHTS_OPERAND_MISSING_DENIED"),
  );

  const disjoint = mutate(input, (value) => {
    value.operands.find(({ kind }: { kind: string }) =>
      kind === "CONSTRAINT").scope.actions = ["erp.order.create"];
  });
  const empty = compileEffectiveRightsV1(disjoint);
  assert.equal(empty.outcome, "DENY");
  assert.ok(
    empty.issues.includes("EFFECTIVE_RIGHTS_EMPTY_INTERSECTION_DENIED"),
  );
  for (const value of [
    incomplete,
    empty,
    renderPermissionXrayV1(empty),
  ] as readonly Record<string, unknown>[]) {
    assert.equal(Object.hasOwn(value, "authority"), false);
    assert.equal(Object.hasOwn(value, "credential"), false);
    assert.equal(Object.hasOwn(value, "lease"), false);
    assert.equal(Object.hasOwn(value, "provider"), false);
    assert.equal(Object.hasOwn(value, "effectCallback"), false);
  }
});
