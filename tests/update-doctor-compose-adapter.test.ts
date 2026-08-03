import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptComposeDoctorObservationV1,
  DOCTOR_COMPOSE_OBSERVATION_SCHEMA_V1,
  renderPublicDoctorReportV1,
  runFixtureDoctorV1,
  type DoctorComposeObservationV1,
} from "../packages/contracts/src/index.js";

const LOCK = "a".repeat(64);
const CONFIG = "b".repeat(64);

function snapshot(): DoctorComposeObservationV1 {
  return {
    schemaVersion: DOCTOR_COMPOSE_OBSERVATION_SCHEMA_V1,
    source: "LOCAL_COMPOSE_SNAPSHOT",
    readOnly: true,
    mutationCount: 0,
    observedLockDigest: LOCK,
    composeVersion: "v2.39.1",
    expectedConfigDigest: CONFIG,
    observedConfigDigest: CONFIG,
    services: [
      { serviceId: "api", state: "RUNNING", health: "HEALTHY" },
      { serviceId: "database", state: "RUNNING", health: "HEALTHY" },
    ],
  };
}

function adapt(input: DoctorComposeObservationV1, requiredServiceIds = ["api", "database"]) {
  return adaptComposeDoctorObservationV1({ requiredServiceIds, snapshot: input });
}

test("UD-003 maps a closed read-only Compose snapshot into deterministic QUICK observations", () => {
  const input = snapshot();
  const before = structuredClone(input);
  const first = adapt(input);
  const second = adapt({ ...structuredClone(input), services: [...input.services].reverse() });
  assert.deepEqual(input, before);
  assert.deepEqual(first, second);
  assert.deepEqual(first.probes.map(({ checkId, outcome }) => ({ checkId, outcome })), [
    { checkId: "cm:doctor-installation", outcome: "MATCH" },
    { checkId: "cm:doctor-runtime", outcome: "MATCH" },
    { checkId: "cm:doctor-configuration", outcome: "MATCH" },
    { checkId: "cm:doctor-version-lock", outcome: "MATCH" },
    { checkId: "cm:doctor-health-readback", outcome: "MATCH" },
  ]);

  const report = runFixtureDoctorV1({
    reportId: "cm:doctor-report-003",
    profile: "QUICK",
    expectedLockDigest: LOCK,
    generatedAtMs: 1_786_054_800_000,
    timeoutMs: 10,
    fixture: first,
  });
  assert.ok(report.checks.every(({ status }) => status === "PASS"));
  assert.doesNotMatch(renderPublicDoctorReportV1(report), /api|database|v2\.39\.1/i);
});

test("UD-003 maps stopped, unhealthy, config-drift, and lock-drift observations fail-closed", () => {
  const input = snapshot();
  const fixture = adapt({
    ...input,
    observedLockDigest: "c".repeat(64),
    observedConfigDigest: "d".repeat(64),
    services: [
      { serviceId: "api", state: "STOPPED", health: "UNHEALTHY" },
      input.services[1]!,
    ],
  });
  const report = runFixtureDoctorV1({
    reportId: "cm:doctor-report-003",
    profile: "QUICK",
    expectedLockDigest: LOCK,
    generatedAtMs: 1,
    timeoutMs: 10,
    fixture,
  });
  assert.deepEqual(report.checks.slice(1), [
    { checkId: "cm:doctor-runtime", status: "FAIL", reasonCode: "OBSERVATION_MISMATCH" },
    { checkId: "cm:doctor-configuration", status: "FAIL", reasonCode: "OBSERVATION_MISMATCH" },
    { checkId: "cm:doctor-version-lock", status: "FAIL", reasonCode: "OBSERVATION_MISMATCH" },
    { checkId: "cm:doctor-health-readback", status: "FAIL", reasonCode: "OBSERVATION_MISMATCH" },
  ]);
});

test("UD-003 treats incomplete collection as unavailable and denies mutation or schema widening", () => {
  const input = snapshot();
  const fixture = adapt({ ...input, composeVersion: null, observedConfigDigest: null, services: [input.services[0]!] });
  assert.deepEqual(fixture.probes.map(({ outcome }) => outcome), [
    "UNAVAILABLE", "UNAVAILABLE", "UNAVAILABLE", "MATCH", "UNAVAILABLE",
  ]);
  assert.throws(() => adapt({ ...input, mutationCount: 1 } as unknown as DoctorComposeObservationV1),
    /INVALID_READ_ONLY_COMPOSE_OBSERVATION/);
  assert.throws(() => adapt({ ...input, privatePath: "/private/operator" } as unknown as DoctorComposeObservationV1),
    /INVALID_READ_ONLY_COMPOSE_OBSERVATION/);
  assert.throws(() => adapt({ ...input, services: [...input.services, input.services[0]!] }),
    /INVALID_READ_ONLY_COMPOSE_OBSERVATION/);
  assert.throws(() => adapt(input, ["api"]), /INVALID_READ_ONLY_COMPOSE_OBSERVATION/);
});
