// Statically registered synthetic renderer policy. Distribution closure binds
// these reviewed source bytes; runtime descriptors never supply executable code.
export function run(input) {
  if (!input || input.kind !== "synthetic-package-plan"
    || !/^[a-f0-9]{64}$/.test(input.jobDigest)
    || !Number.isInteger(input.frameCount) || input.frameCount <= 0
    || !Number.isInteger(input.durationFrames) || input.durationFrames <= 0) {
    throw new Error("RENDER_COMPONENT_INPUT_DENIED");
  }
  return Object.freeze({
    schemaVersion: "chimpmaera.video/synthetic-render-plan/v1",
    packageFormat: "canonical-synthetic-package-index",
    jobDigest: input.jobDigest,
    frameCount: input.frameCount,
    durationFrames: input.durationFrames,
  });
}
