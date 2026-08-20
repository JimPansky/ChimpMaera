import type { HmiAdapterPinV1, HmiGenerationBundleV1 } from "../../contracts/src/index.js";
import {
  conformantEntrypointDescriptorV1,
  mapConformantHmiEntrypointV1,
} from "./shared.js";

export const CODEX_HMI_ENTRYPOINT_V1 = conformantEntrypointDescriptorV1("CODEX");

export function mapCodexHmiEntrypointV1(
  bundle: HmiGenerationBundleV1,
  pin: HmiAdapterPinV1,
  invocation: unknown,
) {
  return mapConformantHmiEntrypointV1(CODEX_HMI_ENTRYPOINT_V1, bundle, pin, invocation);
}
