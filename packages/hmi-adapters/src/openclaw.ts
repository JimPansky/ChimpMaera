import type { HmiAdapterPinV1, HmiGenerationBundleV1 } from "../../contracts/src/index.js";
import {
  conformantEntrypointDescriptorV1,
  mapConformantHmiEntrypointV1,
} from "./shared.js";

export const OPENCLAW_HMI_ENTRYPOINT_V1 = conformantEntrypointDescriptorV1("OPENCLAW");

export function mapOpenClawHmiEntrypointV1(
  bundle: HmiGenerationBundleV1,
  pin: HmiAdapterPinV1,
  invocation: unknown,
) {
  return mapConformantHmiEntrypointV1(OPENCLAW_HMI_ENTRYPOINT_V1, bundle, pin, invocation);
}
