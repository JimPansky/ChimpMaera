import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createBuilderCore, validateRuntimeContract } from "../demo/builder-agent/builder-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "demo/builder-agent");
const corePath = path.join(fixture, "builder-core.mjs");
const contracts = [
  "runtime-contract-v1.json",
  "runtime-contract-second-system-v1.json",
].map((name) => JSON.parse(readFileSync(path.join(fixture, name), "utf8")));

function store() {
  let value;
  return {
    loadState: () => value === undefined ? undefined : structuredClone(value),
    persistState: (next) => { value = structuredClone(next); },
  };
}

function runtime(contract, options = {}) {
  return createBuilderCore({
    contract,
    workloadIdentity: `workload:${contract.fixtureId}`,
    ...store(),
    ...options,
  });
}

function operation(contract, effectClass) {
  return contract.admittedCapabilities.find((entry) => entry.effectClass === effectClass).capabilityId;
}

test("BLD-001-G7 uses one target-neutral byte-identical Builder core for both systems", () => {
  const source = readFileSync(corePath, "utf8");
  const coreSha256 = createHash("sha256").update(source).digest("hex");
  assert.doesNotMatch(source, /synthetic-zoo|synthetic-warehouse|habitat|setpoint|illuminance|brightness/i);
  assert.match(coreSha256, /^[a-f0-9]{64}$/);
  for (const contract of contracts) {
    assert.equal(validateRuntimeContract(contract), true);
    const core = runtime(contract);
    assert.equal(core.contract.fixtureId, contract.fixtureId);
    assert.equal(createHash("sha256").update(readFileSync(corePath)).digest("hex"), coreSha256);
  }
});

test("BLD-001-G7 both synthetic systems pass read, reversible write, replay and zero drift", () => {
  for (const contract of contracts) {
    const core = runtime(contract);
    const readRequest = core.requestTemplate(operation(contract, "READ_ONLY"));
    const writeRequest = core.requestTemplate(operation(contract, "REVERSIBLE_WRITE"));
    const read = core.execute(readRequest);
    const write = core.execute(writeRequest);
    const replay = core.execute(writeRequest);
    assert.equal(read.receipt.outcome, "SYNTHETIC_READ_NO_CHANGE_VERIFIED");
    assert.equal(read.receipt.route, "AUTO_EXECUTE");
    assert.equal(write.receipt.outcome, "SYNTHETIC_REVERSIBLE_WRITE_ROLLBACK_VERIFIED");
    assert.equal(write.receipt.route, "OWNER_APPROVAL");
    assert.equal(write.receipt.beforeDigest, write.receipt.finalDigest);
    assert.equal(replay.replayState, "REPLAY_SAME_RECEIPT");
    assert.equal(replay.receipt.receiptDigest, write.receipt.receiptDigest);
    const evidence = core.evidence();
    assert.equal(evidence.counters.reads, 1);
    assert.equal(evidence.counters.writes, 1);
    assert.equal(evidence.ownedTargetDrift, 0);
    assert.equal(evidence.receiptDigests.length, 2);
  }
});

test("BLD-001-G7 adversarial matrix fails closed without secret reflection or target drift", () => {
  for (const contract of contracts) {
    const probes = [
      {
        name: "cross-tenant",
        mutate: (request) => ({ ...request, tenant: "foreign-tenant" }),
        error: "BUILDER_REQUEST_BINDING_DENIED",
      },
      {
        name: "unauthorized-skill-activation",
        mutate: (request) => ({ ...request, operationId: "skill.activate" }),
        error: "CAPABILITY_NOT_ADMITTED_DENIED",
      },
      {
        name: "self-approval",
        mutate: (request) => ({ ...request, approvalDigest: "f".repeat(64) }),
        error: "BUILDER_REQUEST_CAPABILITY_OR_PAYLOAD_DENIED",
      },
      {
        name: "post-approval-mutation",
        mutate: (request) => ({ ...request, payload: { ...request.payload, injectedMutation: true } }),
        error: "BUILDER_REQUEST_CAPABILITY_OR_PAYLOAD_DENIED",
      },
      {
        name: "secret-leak-smuggling",
        mutate: (request) => ({ ...request, secret: "SYNTHETIC_SECRET_MUST_NOT_REFLECT" }),
        error: "BUILDER_REQUEST_BINDING_DENIED",
      },
    ];
    for (const probe of probes) {
      const core = runtime(contract);
      const write = core.requestTemplate(operation(contract, "REVERSIBLE_WRITE"));
      let error;
      try {
        core.execute(probe.mutate(write));
      } catch (caught) {
        error = caught;
      }
      assert.equal(error?.message, probe.error, `${contract.fixtureId}:${probe.name}`);
      assert.doesNotMatch(error?.message ?? "", /SYNTHETIC_SECRET_MUST_NOT_REFLECT/);
      assert.equal(core.evidence().ownedTargetDrift, 0);
      assert.equal(core.evidence().receiptDigests.length, 0);
    }
    const api = runtime(contract);
    assert.deepEqual(Object.keys(api).sort(), [
      "contract", "evidence", "execute", "recordDenial", "recordModelCall", "requestTemplate", "reset",
    ]);
    assert.equal("activateSkill" in api, false);
    assert.equal("directTargetWrite" in api, false);
  }
});

test("BLD-001-G7 failed rollback readback is non-success evidence and remains restored", () => {
  for (const contract of contracts) {
    const storage = store();
    const core = createBuilderCore({
      contract,
      workloadIdentity: `workload:${contract.fixtureId}`,
      ...storage,
      faults: { rollbackReadbackMismatch: true },
    });
    const write = core.requestTemplate(operation(contract, "REVERSIBLE_WRITE"));
    assert.throws(() => core.execute(write), /ROLLBACK_MISMATCH_DENIED/);
    const evidence = core.evidence();
    assert.equal(evidence.ownedTargetDrift, 0);
    assert.equal(evidence.counters.writeAttempts, 1);
    assert.equal(evidence.counters.writes, 0);
    assert.equal(evidence.receiptDigests.length, 0);
  }
});

test("BLD-001-G7 startup rejects rights, admission and Owner-approval integrity drift", () => {
  const base = contracts[1];
  const rights = structuredClone(base);
  rights.builderProfile.currentConstraints = ["zone.illuminance.read"];
  assert.throws(() => validateRuntimeContract(rights), /RUNTIME_EFFECTIVE_RIGHTS_INVALID/);
  const admission = structuredClone(base);
  admission.admittedCapabilities[1].admissionRecord.recovery = "IGNORE_FAILURE";
  assert.throws(() => validateRuntimeContract(admission), /RUNTIME_ADMISSION_INVALID/);
  const approval = structuredClone(base);
  approval.syntheticOwnerApprovals[0].issuer = "agent:self";
  assert.throws(() => validateRuntimeContract(approval), /RUNTIME_OWNER_APPROVAL_INVALID/);
});
