// Statically registered QA policy. Independent output parsing and rehashing is
// performed by the closed package assembler.
export function run(input) {
  if (!input || input.kind !== "complete-artifact-readback"
    || !/^[a-f0-9]{64}$/.test(input.artifactSetSha256)
    || !/^[a-f0-9]{64}$/.test(input.jobDigest)) throw new Error("QA_COMPONENT_INPUT_DENIED");
  return Object.freeze({
    schemaVersion: "chimpmaera.video/qa-authorization/v1",
    artifactSetSha256: input.artifactSetSha256,
    jobDigest: input.jobDigest,
    outcome: "PASS",
  });
}
