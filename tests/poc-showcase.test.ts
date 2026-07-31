import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  PocShowcaseValidationError,
  validatePocShowcaseV1,
  type PocShowcaseV1,
} from "../packages/contracts/src/index.js";

type Mutable = Record<string, any>;

const manifestPath = "examples/poc-release/showcase-v1.json";
const showcase = JSON.parse(readFileSync(manifestPath, "utf8")) as PocShowcaseV1;

test("POC-SHOWCASE validates the local release aha manifest", () => {
  const validated = validatePocShowcaseV1(showcase);
  assert.equal(
    validated.productDefinition.primaryMetric,
    "DEMONSTRABLE_POC_POWER_EXTENSIBILITY_UNDERSTANDABILITY",
  );
  assert.equal(validated.productDefinition.localBoundedStartupCommand, "npm run poc:showcase:check");
  assert.ok(validated.modules.length >= 3);
  assert.ok(validated.modules.some(({ capabilityArea }) => capabilityArea === "CODE_FORGE_AUTHORITY"));
  assert.ok(validated.modules.some(({ capabilityArea }) => capabilityArea === "DOCUMENT_PROCESSING"));
  assert.ok(validated.modules.some(({ capabilityArea }) => capabilityArea === "BI_OPERATIONS"));
});

test("POC-SHOWCASE keeps production and authority claims fail-closed", () => {
  const cases: readonly ((candidate: Mutable) => void)[] = [
    (candidate) => {
      candidate.productDefinition.primaryMetric = "HISTORICAL_13_OF_14";
    },
    (candidate) => {
      candidate.productDefinition.completionHistoryStatement =
        "historical evidence means product complete";
    },
    (candidate) => {
      candidate.demoLoop.approvalPolicy.defaultDenyUndeclaredAction = false;
    },
    (candidate) => {
      candidate.modules[0].syntheticDataOnly = false;
    },
    (candidate) => {
      candidate.modules[1].evidenceRefs = ["https://example.invalid/live"];
    },
    (candidate) => {
      candidate.safetyFloor.publicationAuthorityRequired = false;
    },
    (candidate) => {
      candidate.themeReclassification[0].status = "HOLD";
    },
  ];
  for (const mutate of cases) {
    const candidate = structuredClone(showcase) as Mutable;
    mutate(candidate);
    assert.throws(
      () => validatePocShowcaseV1(candidate as PocShowcaseV1),
      PocShowcaseValidationError,
    );
  }
});
