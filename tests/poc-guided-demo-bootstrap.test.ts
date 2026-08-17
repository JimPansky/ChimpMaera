import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  PocGuidedDemoBootstrapError,
  buildPocGuidedDemoCleanupReceiptV1,
  buildPocGuidedDemoSetupPlanV1,
  buildPocGuidedDemoSetupReceiptV1,
  expectedPocGuidedDemoTemplatesV1,
  renderPocGuidedDemoReadyMessageV1,
  validatePocGuidedDemoTemplateV1,
  verifyPocGuidedDemoSetupPlanV1,
  verifyPocGuidedDemoSetupReceiptV1,
  type PocGuidedDemoTemplateV1,
  type PocShowcaseV1,
} from "../packages/contracts/src/index.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";

const showcase = JSON.parse(
  readFileSync("examples/poc-release/showcase-v1.json", "utf8"),
) as PocShowcaseV1;

const digest = (value: unknown) =>
  `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;

function localCustomTemplate(): PocGuidedDemoTemplateV1 {
  const base = structuredClone(expectedPocGuidedDemoTemplatesV1()[2]!);
  const unsigned = {
    ...base,
    templateId: "community-builder-starter",
    displayName: "Community Builder Starter",
    recommended: false,
    provenance: {
      label: "Local file supplied by test user",
      source: "LOCAL_PATH" as const,
      trustTier: "COMMUNITY_LOCAL_UNVERIFIED" as const,
      manifestDigest: "",
      signature: "NOT_REQUIRED" as const,
    },
    cleanup: {
      ownedStateRoot:
        "artifacts/poc-guided-demo/playgrounds/community-builder-starter",
      command:
        "npm run poc:setup -- --cleanup --template=community-builder-starter",
      removesOnlyOwnedState: true as const,
    },
  };
  return {
    ...unsigned,
    provenance: { ...unsigned.provenance, manifestDigest: digest(unsigned) },
  };
}

test("POC-GUIDED-E2E all curated defaults plan, install, rerun, health and cleanup", () => {
  const templates = expectedPocGuidedDemoTemplatesV1();
  for (const template of templates) {
    const plan = buildPocGuidedDemoSetupPlanV1(showcase, templates, {
      templateId: template.templateId,
    });
    const receipt = buildPocGuidedDemoSetupReceiptV1(plan);
    const cleanup = buildPocGuidedDemoCleanupReceiptV1(plan, receipt);
    assert.equal(plan.template.trustTier, "BUILTIN_VERIFIED");
    assert.equal(plan.template.provenanceLabel, `PANSPHAIRA curated default: ${template.templateId}`);
    assert.equal(plan.template.informedConfirmationRequired, false);
    assert.equal(plan.performanceContract.noUniversalInteractionTimeGate, true);
    assert.equal(plan.performanceContract.noFixedQuestionMaximum, true);
    assert.equal(plan.performanceContract.unnecessaryQuestionsDenied, true);
    assert.equal(plan.performanceContract.progressiveDisclosureRequired, true);
    assert.equal(plan.performanceContract.visibleStageProgress, true);
    assert.equal(plan.performanceContract.silentWaitPermitted, false);
    assert.equal(plan.performanceContract.separateDownloadAndLocalTimings, true);
    assert.equal(plan.performanceContract.universalWallClockReleaseGate, false);
    assert.equal(receipt.health.status, "PASS");
    assert.equal(receipt.idempotency.status, "IDEMPOTENT_RERUN_ACCEPTED");
    assert.equal(receipt.performance.downloadBytes, 0);
    assert.equal(receipt.performance.cache, "WARM_NO_REDOWNLOAD");
    assert.equal(receipt.performance.universalReleaseGateApplied, false);
    assert.match(renderPocGuidedDemoReadyMessageV1(plan, receipt), /^PANSPHAIRA guided demo playground is ready\./);
    assert.equal(cleanup.removedOnlyOwnedState, true);
  }
});

test("POC-GUIDED-PERFORMANCE uses decomposed truthful progress, not a universal wall-clock gate", () => {
  for (const template of expectedPocGuidedDemoTemplatesV1()) {
    assert.equal(
      template.expectedResources.questionPolicy,
      "ASK_ONLY_WHEN_REQUIRED_FOR_SAFE_CORRECT_SETUP",
    );
    assert.equal(
      template.expectedResources.customTemplateQuestions,
      "ALLOW_FACTUALLY_REQUIRED_PROGRESSIVE_DISCLOSURE",
    );
    assert.equal(template.expectedResources.universalWallClockReleaseGate, false);
    assert.equal(
      template.expectedResources.benchmarkPolicy,
      "COLD_AND_WARM_CACHE_QUALITY_SIGNAL_NOT_UNIVERSAL_GATE",
    );
    assert.equal(
      "usablePlaygroundMinutes" in template.expectedResources,
      false,
    );
    assert.equal("hardCeilingMinutes" in template.expectedResources, false);
  }
});

test("POC-GUIDED-CUSTOM-E2E valid local custom template is previewable and installable after confirmation tiering", () => {
  const custom = localCustomTemplate();
  const temporary = mkdtempSync(join(tmpdir(), "chimpmaera-custom-template-"));
  const path = join(temporary, "template.json");
  writeFileSync(path, `${JSON.stringify(custom, null, 2)}\n`);
  const loaded = JSON.parse(readFileSync(path, "utf8")) as PocGuidedDemoTemplateV1;
  validatePocGuidedDemoTemplateV1(loaded);
  const plan = buildPocGuidedDemoSetupPlanV1(
    showcase,
    [...expectedPocGuidedDemoTemplatesV1(), loaded],
    { templateId: loaded.templateId },
  );
  const receipt = buildPocGuidedDemoSetupReceiptV1(plan);
  assert.equal(plan.template.trustTier, "COMMUNITY_LOCAL_UNVERIFIED");
  assert.equal(plan.template.informedConfirmationRequired, true);
  assert.equal(receipt.status, "READY");
});

test("POC-GUIDED-CUSTOM-NEG malformed, tampered and undeclared capability paths fail", () => {
  const custom = localCustomTemplate();
  assert.throws(
    () => validatePocGuidedDemoTemplateV1({
      ...custom,
      apiVersion: "unknown/v9",
    } as unknown as PocGuidedDemoTemplateV1),
    PocGuidedDemoBootstrapError,
  );
  assert.throws(
    () => validatePocGuidedDemoTemplateV1({
      ...custom,
      purpose: "tampered after digest binding",
    }),
    /TAMPERED_TEMPLATE_DENIED/,
  );
  assert.throws(
    () => buildPocGuidedDemoSetupPlanV1(
      showcase,
      [...expectedPocGuidedDemoTemplatesV1(), custom],
      {
        templateId: custom.templateId,
        requestedCapabilities: ["undeclared.host-root"],
      },
    ),
    /UNDECLARED_CAPABILITY_DENIED/,
  );
});

test("POC-GUIDED-NEG unsafe requests and stale plan or receipt fail closed", () => {
  const templates = expectedPocGuidedDemoTemplatesV1();
  assert.throws(
    () => buildPocGuidedDemoSetupPlanV1(showcase, templates, {
      stateRoot: "../../outside",
    }),
    /UNSAFE_OWNED_STATE_PATH_DENIED/,
  );
  assert.throws(
    () => buildPocGuidedDemoSetupPlanV1(showcase, templates, {
      networkMode: "ENABLED",
    }),
    /FORBIDDEN_NETWORK_REQUEST_DENIED/,
  );
  assert.throws(
    () => buildPocGuidedDemoSetupPlanV1(showcase, templates, {
      credentialRequests: ["password"],
    }),
    /FORBIDDEN_CREDENTIAL_OR_PII_REQUEST_DENIED/,
  );
  const plan = buildPocGuidedDemoSetupPlanV1(showcase, templates);
  const receipt = buildPocGuidedDemoSetupReceiptV1(plan);
  assert.throws(
    () => verifyPocGuidedDemoSetupPlanV1({ ...plan, planId: "stale" }),
    /TAMPERED_PLAN_DENIED/,
  );
  assert.throws(
    () => verifyPocGuidedDemoSetupReceiptV1({
      ...receipt,
      planDigest: "sha256:stale",
    }, plan),
    /TAMPERED_RECEIPT_DENIED/,
  );
});
