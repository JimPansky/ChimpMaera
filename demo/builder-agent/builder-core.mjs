import { createHash } from "node:crypto";

const requestKeys = [
  "approvalDigest",
  "capabilityBindingDigest",
  "operationId",
  "payload",
  "requestId",
  "schemaVersion",
  "systemId",
  "tenant",
].sort();

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonical(value[key])}`,
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function digest(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function exactObject(value, keys) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function capability(contract, operationId) {
  return contract.admittedCapabilities.find((entry) => entry.capabilityId === operationId);
}

export function validateRuntimeContract(contract) {
  const profile = contract.builderProfile;
  const rightsInputs = [
    profile?.hostSystemCeiling,
    profile?.ownerProfileRights,
    profile?.assignments,
    profile?.currentConstraints,
  ];
  if (
    contract?.schemaVersion !== "chimpmaera.builder/runtime-contract/v1"
    || profile?.selected !== "SAFE_GUIDED"
    || rightsInputs.some((rights) => !Array.isArray(rights) || new Set(rights).size !== rights.length)
    || !Array.isArray(contract.admittedCapabilities)
    || contract.admittedCapabilities.length === 0
  ) throw new Error("RUNTIME_CONTRACT_INVALID");
  const intersection = [...new Set(rightsInputs[0])]
    .filter((right) => rightsInputs.slice(1).every((rights) => rights.includes(right)))
    .sort();
  if (canonical(intersection) !== canonical([...profile.effectiveRights].sort())) {
    throw new Error("RUNTIME_EFFECTIVE_RIGHTS_INVALID");
  }
  for (const admitted of contract.admittedCapabilities) {
    if (
      !profile.effectiveRights.includes(admitted.capabilityId)
      || profile.routes[admitted.capabilityId] !== admitted.route
      || !/^[a-f0-9]{64}$/.test(admitted.capabilityBindingDigest)
      || !exactObject(admitted.request, ["approvalDigest", "payload", "requestId"])
      || !["READ_FIELD", "REVERSIBLE_WRITE_FIELD"].includes(admitted.adapter?.kind)
    ) throw new Error("RUNTIME_ADMISSION_INVALID");
    if (
      admitted.admissionRecord !== undefined
      && digest(admitted.admissionRecord) !== admitted.capabilityBindingDigest
    ) throw new Error("RUNTIME_ADMISSION_INVALID");
    if (admitted.effectClass === "READ_ONLY") {
      if (admitted.route !== "AUTO_EXECUTE" || admitted.request.approvalDigest !== null) {
        throw new Error("RUNTIME_ADMISSION_INVALID");
      }
    } else if (
      admitted.effectClass !== "REVERSIBLE_WRITE"
      || admitted.route !== "OWNER_APPROVAL"
      || admitted.admissionRecord?.recovery !== "RESTORE_PRIOR_VALUE"
    ) throw new Error("RUNTIME_ADMISSION_INVALID");
  }
  for (const approval of contract.syntheticOwnerApprovals ?? []) {
    const approvalCore = { ...approval };
    delete approvalCore.approvalDigest;
    if (digest(approvalCore) !== approval.approvalDigest) {
      throw new Error("RUNTIME_OWNER_APPROVAL_INVALID");
    }
    const admitted = capability(contract, approval.operationId);
    if (
      admitted?.route !== "OWNER_APPROVAL"
      || admitted.request.approvalDigest !== approval.approvalDigest
    ) throw new Error("RUNTIME_OWNER_APPROVAL_INVALID");
  }
  return true;
}

export function createBuilderCore({ contract, workloadIdentity, loadState, persistState, faults = {} }) {
  validateRuntimeContract(contract);

  function initialState() {
    return {
      schemaVersion: "chimpmaera.builder/runtime-state/v1",
      target: structuredClone(contract.target.initialState),
      receipts: {},
      counters: { modelCalls: 0, readAttempts: 0, reads: 0, writeAttempts: 0, writes: 0, denials: 0 },
    };
  }

  function validState(value) {
    return value?.schemaVersion === "chimpmaera.builder/runtime-state/v1"
      && exactObject(value.target, Object.keys(contract.target.initialState))
      && value.receipts !== null
      && typeof value.receipts === "object"
      && value.counters !== null
      && typeof value.counters === "object";
  }

  let state = loadState();
  if (state === undefined) {
    state = initialState();
    persistState(state);
  } else if (!validState(state)) {
    throw new Error("STATE_INVALID");
  }

  function requestTemplate(operationId) {
    const admitted = capability(contract, operationId);
    if (admitted === undefined) throw new Error("CAPABILITY_NOT_ADMITTED_DENIED");
    return {
      schemaVersion: "chimpmaera.builder/runtime-request/v1",
      tenant: contract.target.tenant,
      systemId: contract.target.systemId,
      operationId,
      requestId: admitted.request.requestId,
      capabilityBindingDigest: admitted.capabilityBindingDigest,
      approvalDigest: admitted.request.approvalDigest,
      payload: structuredClone(admitted.request.payload),
    };
  }

  function validateRequest(value) {
    if (
      !exactObject(value, requestKeys)
      || value.schemaVersion !== "chimpmaera.builder/runtime-request/v1"
      || value.tenant !== contract.target.tenant
      || value.systemId !== contract.target.systemId
    ) throw new Error("BUILDER_REQUEST_BINDING_DENIED");
    const admitted = capability(contract, value.operationId);
    if (admitted === undefined) throw new Error("CAPABILITY_NOT_ADMITTED_DENIED");
    if (canonical(value) !== canonical(requestTemplate(value.operationId))) {
      throw new Error("BUILDER_REQUEST_CAPABILITY_OR_PAYLOAD_DENIED");
    }
    if (!contract.builderProfile.effectiveRights.includes(value.operationId)) {
      throw new Error("EFFECTIVE_RIGHTS_DENIED");
    }
    if (admitted.route !== contract.builderProfile.routes[value.operationId]) {
      throw new Error("OWNER_ROUTE_BINDING_DENIED");
    }
    return admitted;
  }

  function executeRead(value, admitted, beforeDigest) {
    state.counters.readAttempts += 1;
    const adapter = admitted.adapter;
    const readback = {
      entity: value.payload[adapter.entityPayloadField],
      value: state.target[adapter.stateField],
      valueField: adapter.stateField,
    };
    state.counters.reads += 1;
    return {
      readback,
      effectDigest: beforeDigest,
      outcome: "SYNTHETIC_READ_NO_CHANGE_VERIFIED",
    };
  }

  function executeWrite(value, admitted, beforeDigest) {
    state.counters.writeAttempts += 1;
    const adapter = admitted.adapter;
    const priorValue = state.target[adapter.stateField];
    let effectReadback;
    try {
      state.target[adapter.stateField] = value.payload[adapter.payloadField];
      persistState(state);
      effectReadback = loadState().target;
      if (effectReadback[adapter.stateField] !== value.payload[adapter.payloadField]) {
        throw new Error("WRITE_READBACK_MISMATCH_DENIED");
      }
    } finally {
      state.target[adapter.stateField] = priorValue;
      persistState(state);
    }
    const rollbackReadback = faults.rollbackReadbackMismatch
      ? { ...loadState().target, [adapter.stateField]: "FAULT_INJECTED_MISMATCH" }
      : loadState().target;
    if (digest(rollbackReadback) !== beforeDigest) throw new Error("ROLLBACK_MISMATCH_DENIED");
    state.counters.writes += 1;
    return {
      readback: {
        entity: value.payload[adapter.entityPayloadField],
        priorValue,
        appliedValue: effectReadback[adapter.stateField],
        valueField: adapter.stateField,
      },
      effectDigest: digest(effectReadback),
      outcome: "SYNTHETIC_REVERSIBLE_WRITE_ROLLBACK_VERIFIED",
    };
  }

  function execute(value) {
    const admitted = validateRequest(value);
    const requestDigest = digest(value);
    const prior = state.receipts[value.requestId];
    if (prior !== undefined) {
      if (prior.requestDigest !== requestDigest) throw new Error("REPLAY_CONFLICT_DENIED");
      return { status: "PASS", replayState: "REPLAY_SAME_RECEIPT", receipt: prior };
    }
    const beforeDigest = digest(state.target);
    const result = admitted.adapter.kind === "READ_FIELD"
      ? executeRead(value, admitted, beforeDigest)
      : executeWrite(value, admitted, beforeDigest);
    const finalDigest = digest(state.target);
    const receiptCore = {
      schemaVersion: "chimpmaera.builder/runtime-receipt/v1",
      issueId: "BLD-001",
      claimId: contract.claimId,
      workloadIdentity,
      tenant: value.tenant,
      systemId: value.systemId,
      operationId: value.operationId,
      requestId: value.requestId,
      requestDigest,
      selectedProfile: contract.builderProfile.selected,
      effectiveRightsDigest: digest(contract.builderProfile.effectiveRights),
      capabilityBindingDigest: admitted.capabilityBindingDigest,
      route: admitted.route,
      approvalDigest: value.approvalDigest,
      beforeDigest,
      effectDigest: result.effectDigest,
      readbackDigest: digest(result.readback),
      finalDigest,
      outcome: result.outcome,
    };
    const receipt = { ...receiptCore, receiptDigest: digest(receiptCore) };
    state.receipts[value.requestId] = receipt;
    persistState(state);
    return { status: "PASS", replayState: "FIRST_EXECUTION", readback: result.readback, receipt };
  }

  function evidence() {
    const initialTargetDigest = digest(contract.target.initialState);
    const currentTargetDigest = digest(state.target);
    return {
      status: "PASS",
      contractDigest: digest(contract),
      selectedProfile: contract.builderProfile.selected,
      effectiveRights: contract.builderProfile.effectiveRights,
      counters: structuredClone(state.counters),
      initialTargetDigest,
      currentTargetDigest,
      ownedTargetDrift: initialTargetDigest === currentTargetDigest ? 0 : 1,
      receiptDigests: Object.values(state.receipts).map((entry) => entry.receiptDigest).sort(),
      outcomes: Object.values(state.receipts).map((entry) => entry.outcome).sort(),
    };
  }

  function reset(value) {
    if (
      !exactObject(value, ["systemId", "tenant"])
      || value.tenant !== contract.target.tenant
      || value.systemId !== contract.target.systemId
    ) throw new Error("RESET_SCOPE_DENIED");
    const retainedReceiptDigests = Object.values(state.receipts).map((entry) => entry.receiptDigest).sort();
    state = initialState();
    persistState(state);
    return { status: "PASS", retainedReceiptDigests, ownedTargetDrift: 0 };
  }

  function recordCounter(name) {
    if (!Object.hasOwn(state.counters, name)) throw new Error("COUNTER_INVALID");
    state.counters[name] += 1;
    persistState(state);
  }

  return {
    contract,
    evidence,
    execute,
    recordDenial: () => recordCounter("denials"),
    recordModelCall: () => recordCounter("modelCalls"),
    requestTemplate,
    reset,
  };
}
