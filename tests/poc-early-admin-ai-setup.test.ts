import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  PocEarlyAdminSetupError,
  activatePocAdminAuthorityProfileV1,
  applyPocEarlyAdminRepairV1,
  assertPocAdminActionAllowedV1,
  buildPocEarlyAdminRepairPlanV1,
  buildPocEarlyAdminStatusV1,
  buildPocGuidedDemoSetupPlanV1,
  expectedPocGuidedDemoTemplatesV1,
  fullControlLabRiskWarningV1,
  pocAdminAuthorityProfilesV1,
  promotePocEarlyAdminToStageBV1,
  resetPocAdminAuthorityToSafeV1,
  runPocEarlyAdminSyntheticSetupV1,
  verifyPocEarlyAdminRepairReceiptV1,
  verifyPocEarlyAdminRepairPlanV1,
  type PocEarlyAdminRepairActionV1,
  type PocEarlyAdminRepairPlanV1,
  type PocGuidedDemoSetupPlanV1,
  type PocGuidedDemoTemplateV1,
  type PocShowcaseV1,
} from "../packages/contracts/src/index.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  PocEarlyAdminCoordinatorV1,
  assertPocEarlyAdminLoopbackBindV1,
  createPocEarlyAdminDashboardServerV1,
} from "../packages/setup-coordinator/src/index.js";

const showcase = JSON.parse(
  readFileSync("examples/poc-release/showcase-v1.json", "utf8"),
) as PocShowcaseV1;
const hash = (value: unknown) =>
  `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;

function localCustomTemplate(): PocGuidedDemoTemplateV1 {
  const base = structuredClone(expectedPocGuidedDemoTemplatesV1()[2]!);
  const core = {
    ...base,
    templateId: "local-dashboard-template",
    displayName: "Local Dashboard Template",
    recommended: false,
    provenance: {
      label: "Local test template",
      source: "LOCAL_PATH" as const,
      trustTier: "COMMUNITY_LOCAL_UNVERIFIED" as const,
      manifestDigest: "",
      signature: "NOT_REQUIRED" as const,
    },
    cleanup: {
      ownedStateRoot:
        "artifacts/poc-guided-demo/playgrounds/local-dashboard-template",
      command:
        "npm run poc:setup -- --cleanup --template=local-dashboard-template",
      removesOnlyOwnedState: true as const,
    },
  };
  return {
    ...core,
    provenance: { ...core.provenance, manifestDigest: hash(core) },
  };
}

function planFor(template: PocGuidedDemoTemplateV1): PocGuidedDemoSetupPlanV1 {
  const templates = expectedPocGuidedDemoTemplatesV1();
  return buildPocGuidedDemoSetupPlanV1(
    showcase,
    templates.some(({ templateId }) => templateId === template.templateId)
      ? templates
      : [...templates, template],
    { templateId: template.templateId },
  );
}

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "chimpmaera-early-admin-"));
}

function repairWithTarget(
  repair: PocEarlyAdminRepairPlanV1,
  target: string,
): PocEarlyAdminRepairPlanV1 {
  const { repairPlanDigest: _ignored, ...core } = {
    ...repair,
    action: { ...repair.action, target },
  };
  return { ...core, repairPlanDigest: hash(core) };
}

test("EARLY-ADMIN-E2E Stage A starts before install for three curated and local custom templates", () => {
  const templates = [...expectedPocGuidedDemoTemplatesV1(), localCustomTemplate()];
  for (const template of templates) {
    const root = tempRoot();
    const plan = planFor(template);
    const coordinator = new PocEarlyAdminCoordinatorV1(plan, root);
    const early = coordinator.status();
    assert.equal(early.authority.stage, "STAGE_A_BOOTSTRAP_SUPERVISOR");
    assert.equal(early.stages[0]?.status, "PASS");
    assert.equal(early.stages[1]?.status, "PENDING");
    assert.equal(
      existsSync(join(root, plan.storage.ownedStateRoot, "config.json")),
      false,
    );
    assert.equal(early.dialog.questionPolicy,
      "NO_FIXED_MAXIMUM_ASK_ONLY_WHEN_REQUIRED");
    const ready = coordinator.runSyntheticSetup();
    assert.equal(ready.health.status, "PASS");
    assert.equal(ready.progress.percent, 100);
    const rerun = coordinator.runSyntheticSetup();
    assert.equal(rerun.statusDigest, ready.statusDigest);
    const cleanup = coordinator.cleanup();
    assert.equal(cleanup.kind, "PocGuidedDemoCleanupReceipt");
    assert.equal(cleanup.removedOnlyOwnedState, true);
    assert.equal(cleanup.planDigest, plan.planDigest);
    assert.equal(existsSync(join(root, plan.storage.ownedStateRoot)), false);
  }
});

test("EARLY-ADMIN-REPAIR diagnosis, confirmation, bounded repair, resume and promotion", () => {
  const root = tempRoot();
  const plan = planFor(expectedPocGuidedDemoTemplatesV1()[0]!);
  const coordinator = new PocEarlyAdminCoordinatorV1(plan, root);
  const failed = coordinator.runSyntheticSetup("CONFIG_DIGEST_MISMATCH");
  assert.deepEqual(failed.warnings, ["CONFIG_DIGEST_MISMATCH"]);
  const repair = coordinator.diagnose("CONFIG_DIGEST_MISMATCH");
  assert.equal(repair.action.idempotent, true);
  assert.equal(repair.action.boundedToOwnedState, true);
  assert.equal(repair.ownerConfirmationRequired, true);
  assert.throws(
    () => coordinator.applyRepair(repair, false),
    /OWNER_CONFIRMATION_REQUIRED/,
  );
  const receipt = coordinator.applyRepair(repair, true);
  verifyPocEarlyAdminRepairReceiptV1(receipt, repair);
  assert.throws(
    () => verifyPocEarlyAdminRepairReceiptV1({
      ...receipt,
      ownerConfirmed: false,
    }, repair),
    /TAMPERED_REPAIR_RECEIPT_DENIED/,
  );
  const resumed = coordinator.resume();
  assert.equal(resumed.health.status, "PASS");
  assert.equal(resumed.resume.cacheReusable, true);
  const promoted = coordinator.promote();
  assert.equal(promoted.authority.stage, "STAGE_B_ADMIN_AI");
  assert.equal(promoted.authority.shellAccess, false);
  assert.equal(promoted.authority.controlPlaneAdministration, false);
  coordinator.cleanup();
});

test("AAS-001 reconstructs the exact repair action and rejects redigested path variants before effects", () => {
  const root = tempRoot();
  const plan = planFor(expectedPocGuidedDemoTemplatesV1()[0]!);
  const coordinator = new PocEarlyAdminCoordinatorV1(plan, root);
  const failed = coordinator.runSyntheticSetup("CONFIG_DIGEST_MISMATCH");
  const repair = coordinator.diagnose("CONFIG_DIGEST_MISMATCH");
  const canary = join(root, "authority-effect-audit.canary");
  writeFileSync(canary, "owner-authority-and-evidence\n");
  const baseline = readFileSync(canary, "utf8");
  const ownedRoot = plan.storage.ownedStateRoot;
  const targets = [
    `${ownedRoot}/../authority.json`,
    "/tmp/chimpmaera-absolute-target",
    `${ownedRoot}-sibling/config.json`,
    `${ownedRoot}\\config.json`,
    `${ownedRoot}\u2215config.json`,
    `${ownedRoot}\u2044config.json`,
    `${ownedRoot}\uff0fconfig.json`,
  ];
  for (const target of targets) {
    const redigested = repairWithTarget(repair, target);
    assert.throws(
      () => verifyPocEarlyAdminRepairPlanV1(redigested, failed),
      /TAMPERED_OR_ESCALATED_REPAIR_PLAN_DENIED/,
    );
    assert.throws(
      () => applyPocEarlyAdminRepairV1(failed, redigested, true),
      /TAMPERED_OR_ESCALATED_REPAIR_PLAN_DENIED/,
    );
    assert.equal(readFileSync(canary, "utf8"), baseline);
  }
  assert.equal(
    existsSync(join(root, "artifacts/poc-guided-demo/authority.json")),
    false,
  );
  coordinator.cleanup();
});

test("AAS-001 confines a successful repair to fixed owned files and preserves external canaries", () => {
  const root = tempRoot();
  const plan = planFor(expectedPocGuidedDemoTemplatesV1()[0]!);
  const coordinator = new PocEarlyAdminCoordinatorV1(plan, root);
  coordinator.runSyntheticSetup("CONFIG_DIGEST_MISMATCH");
  const repair = coordinator.diagnose("CONFIG_DIGEST_MISMATCH");
  const owned = join(root, plan.storage.ownedStateRoot);
  const previousConfig = readFileSync(join(owned, "config.json"), "utf8");
  const canaries = ["owner-authority", "effect-state", "audit-evidence"]
    .map((name) => join(root, `${name}.canary`));
  for (const path of canaries) writeFileSync(path, `${path}\n`);
  const baselines = canaries.map((path) => readFileSync(path, "utf8"));

  const receipt = coordinator.applyRepair(repair, true);

  assert.equal(receipt.repairPlanDigest, repair.repairPlanDigest);
  assert.equal(
    readFileSync(join(owned, "config.json"), "utf8"),
    `${JSON.stringify(plan.config, null, 2)}\n`,
  );
  assert.equal(
    readFileSync(join(owned, "rollback-config.json"), "utf8"),
    previousConfig,
  );
  for (const [index, path] of canaries.entries()) {
    assert.equal(readFileSync(path, "utf8"), baselines[index]);
  }
  coordinator.cleanup();
});

test("AAS-001 rejects owned-root, target and backup symlinks without touching outside bytes", () => {
  for (const probe of ["owned-root", "target", "backup"] as const) {
    const root = tempRoot();
    const plan = planFor(expectedPocGuidedDemoTemplatesV1()[0]!);
    const coordinator = new PocEarlyAdminCoordinatorV1(plan, root);
    coordinator.runSyntheticSetup("CONFIG_DIGEST_MISMATCH");
    const repair = coordinator.diagnose("CONFIG_DIGEST_MISMATCH");
    const owned = join(root, plan.storage.ownedStateRoot);
    const parked = `${owned}.parked`;
    const outside = join(root, "outside");
    mkdirSync(outside);
    const canary = join(outside, "canary.json");
    writeFileSync(canary, "outside-byte-identical\n");
    const config = join(owned, "config.json");
    const configBaseline = readFileSync(config, "utf8");
    if (probe === "owned-root") {
      renameSync(owned, parked);
      symlinkSync(outside, owned, "dir");
    } else {
      const entry = probe === "target"
        ? config
        : join(owned, "rollback-config.json");
      rmSync(entry, { force: true });
      symlinkSync(canary, entry);
    }

    assert.throws(() => coordinator.applyRepair(repair, true));
    assert.equal(readFileSync(canary, "utf8"), "outside-byte-identical\n");
    if (probe === "owned-root") {
      rmSync(owned);
      renameSync(parked, owned);
      assert.equal(readFileSync(config, "utf8"), configBaseline);
    } else if (probe === "backup") {
      assert.equal(readFileSync(config, "utf8"), configBaseline);
    }
    coordinator.cleanup();
  }
});

test("AAS-001 detects an owned-directory swap after descriptor open and before repair write", () => {
  const root = tempRoot();
  const plan = planFor(expectedPocGuidedDemoTemplatesV1()[0]!);
  const owned = join(root, plan.storage.ownedStateRoot);
  const parked = `${owned}.parked`;
  const outside = join(root, "outside");
  let armed = false;
  const coordinator = new PocEarlyAdminCoordinatorV1(plan, root, {
    repairBoundaryObserver: () => {
      if (!armed) return;
      renameSync(owned, parked);
      symlinkSync(outside, owned, "dir");
    },
  });
  coordinator.runSyntheticSetup("CONFIG_DIGEST_MISMATCH");
  const repair = coordinator.diagnose("CONFIG_DIGEST_MISMATCH");
  mkdirSync(outside);
  const canary = join(outside, "canary.json");
  writeFileSync(canary, "swap-canary\n");
  const configBaseline = readFileSync(join(owned, "config.json"), "utf8");
  armed = true;

  assert.throws(
    () => coordinator.applyRepair(repair, true),
    /OWNED_STATE_COMPONENT_SWAP_DENIED/,
  );
  assert.equal(readFileSync(canary, "utf8"), "swap-canary\n");
  assert.equal(readFileSync(join(parked, "config.json"), "utf8"), configBaseline);
  rmSync(owned);
  renameSync(parked, owned);
  coordinator.cleanup();
});

test("AAS-001 applies the descriptor boundary to non-material retry evidence", () => {
  const root = tempRoot();
  const plan = planFor(expectedPocGuidedDemoTemplatesV1()[0]!);
  const coordinator = new PocEarlyAdminCoordinatorV1(plan, root);
  coordinator.runSyntheticSetup("TRANSIENT_HEALTH_CHECK_FAILURE");
  const repair = coordinator.diagnose("TRANSIENT_HEALTH_CHECK_FAILURE");
  const owned = join(root, plan.storage.ownedStateRoot);
  const canary = join(root, "outside-audit.canary");
  writeFileSync(canary, "retry-canary\n");
  rmSync(join(owned, "repair-receipt.json"), { force: true });
  symlinkSync(canary, join(owned, "repair-receipt.json"));

  assert.throws(
    () => coordinator.applyRepair(repair, true),
    /OWNED_STATE_NON_REGULAR_ENTRY_DENIED/,
  );
  assert.equal(readFileSync(canary, "utf8"), "retry-canary\n");
  coordinator.cleanup();
});

test("EARLY-ADMIN-NEG tampering, undeclared action and premature authority fail closed", () => {
  const plan = planFor(expectedPocGuidedDemoTemplatesV1()[0]!);
  const initial = buildPocEarlyAdminStatusV1(plan);
  assert.throws(
    () => promotePocEarlyAdminToStageBV1(initial),
    /STAGE_B_PROMOTION_GATES_NOT_MET/,
  );
  const root = tempRoot();
  const coordinator = new PocEarlyAdminCoordinatorV1(plan, root);
  coordinator.runSyntheticSetup("CONFIG_DIGEST_MISMATCH");
  const repair = coordinator.diagnose("CONFIG_DIGEST_MISMATCH");
  assert.throws(
    () => coordinator.applyRepair({ ...repair, impact: "tampered" }, true),
    /TAMPERED_OR_ESCALATED_REPAIR_PLAN_DENIED/,
  );
  const undeclared = {
    ...repair,
    action: {
      ...repair.action,
      actionId: "FREE_SHELL" as PocEarlyAdminRepairActionV1,
    },
  } as PocEarlyAdminRepairPlanV1;
  assert.throws(
    () => coordinator.applyRepair(undeclared, true),
    /TAMPERED_OR_ESCALATED_REPAIR_PLAN_DENIED/,
  );
  const noPolicy = new PocEarlyAdminCoordinatorV1(plan, tempRoot(), {
    policyAvailable: false,
  });
  noPolicy.runSyntheticSetup();
  assert.throws(() => noPolicy.promote(), /STAGE_B_PROMOTION_GATES_NOT_MET/);
  assert.throws(
    () => assertPocEarlyAdminLoopbackBindV1("0.0.0.0"),
    /REMOTE_BIND_DENIED/,
  );
  coordinator.cleanup();
  noPolicy.cleanup();
});

test("EARLY-ADMIN-DASHBOARD loopback status, dialog and repair E2E reject foreign Host", async () => {
  const root = tempRoot();
  const plan = planFor(expectedPocGuidedDemoTemplatesV1()[1]!);
  const coordinator = new PocEarlyAdminCoordinatorV1(plan, root);
  const server = createPocEarlyAdminDashboardServerV1(coordinator);
  await new Promise<void>((resolveListen) =>
    server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  assert.ok(address !== null && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const statusResponse = await fetch(`${base}/api/status`);
  assert.equal(statusResponse.status, 200);
  const status = await statusResponse.json() as {
    authority: { stage: string };
    stages: readonly { status: string }[];
  };
  assert.equal(status.authority.stage, "STAGE_A_BOOTSTRAP_SUPERVISOR");
  assert.equal(status.stages[1]?.status, "PENDING");
  const pageResponse = await fetch(base);
  assert.equal(pageResponse.status, 200);
  assert.match(
    pageResponse.headers.get("content-security-policy") ?? "",
    /default-src 'self'/,
  );
  const page = await pageResponse.text();
  assert.match(page, /Admin-AI Approval Workbench/);
  assert.match(page, /Permission X-ray/);
  assert.match(page, /ALLOW is not executable authority/);
  assert.match(page, /\/api\/effective-rights/);
  assert.match(
    page,
    /Deterministic static-policy preview — no live LLM and no production authority\./,
  );
  assert.equal((page.match(/id="admin-ai-(?:contact|order|deny)"/g) ?? []).length, 3);
  assert.match(page, /Outcome: not run/);
  assert.match(page, /Reason code: not run/);
  assert.match(page, /Policy digest: not run/);
  assert.match(page, /\/api\/demo\/admin-ai\/request/);
  assert.match(page, /\/api\/demo\/admin-ai\/owner-decision/);
  assert.match(page, /\/api\/demo\/effects/);
  assert.match(page, /businessDiff/);
  assert.match(page, /'APPROVE'/);
  assert.match(page, /'REJECT'/);
  assert.doesNotMatch(page, /createHmac|chimp-control-token|live LLM call/);
  const xrayResponse = await fetch(base + "/api/effective-rights");
  assert.equal(xrayResponse.status, 200);
  const xray = await xrayResponse.json() as {
    claim: string;
    outcome: string;
    ceilings: readonly unknown[];
    informationalOnly: boolean;
  };
  assert.equal(xray.claim, "INFORMATIONAL_ONLY_NO_EXECUTABLE_AUTHORITY");
  assert.equal(xray.outcome, "ALLOW");
  assert.equal(xray.ceilings.length, 4);
  assert.equal(xray.informationalOnly, true);
  assert.equal(Object.hasOwn(xray, "authority"), false);
  assert.equal((await fetch(`${base}/missing`)).status, 404);

  const post = async (path: string, body: unknown) => {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, value: await response.json() as unknown };
  };
  assert.equal((await post("/api/ask", {
    question: "What is the setup progress?",
  })).status, 200);
  assert.equal((await post("/api/run", {
    failure: "CONFIG_DIGEST_MISMATCH",
  })).status, 200);
  const diagnosis = await post("/api/diagnose", {
    issueCode: "CONFIG_DIGEST_MISMATCH",
  });
  assert.equal(diagnosis.status, 200);
  assert.equal((await post("/api/repair", {
    repairPlan: diagnosis.value,
    ownerConfirmed: false,
  })).status, 409);
  assert.equal((await post("/api/repair", {
    repairPlan: diagnosis.value,
    ownerConfirmed: true,
  })).status, 200);
  assert.equal((await post("/api/resume", {})).status, 200);
  assert.equal((await post("/api/run", { failure: "UNKNOWN" })).status, 409);
  assert.equal((await post("/api/ask", {})).status, 409);
  assert.equal((await post("/api/repair", {})).status, 409);
  assert.equal((await post("/api/ask", { question: "x".repeat(9000) })).status, 409);
  const invalid = await fetch(`${base}/api/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "null",
  });
  assert.equal(invalid.status, 409);

  const foreignStatus = await new Promise<number>((resolveStatus, reject) => {
    const foreign = request({
      hostname: "127.0.0.1",
      port: address.port,
      path: "/api/status",
      headers: { host: "foreign.example" },
    }, (response) => {
      response.resume();
      resolveStatus(response.statusCode ?? 0);
    });
    foreign.once("error", reject);
    foreign.end();
  });
  assert.equal(foreignStatus, 403);
  await new Promise<void>((resolveClose, rejectClose) =>
    server.close((error) => error ? rejectClose(error) : resolveClose()));
  coordinator.cleanup();
});

test("EARLY-ADMIN-CONTRACT repair plans stay digest-bound to observed state", () => {
  const plan = planFor(expectedPocGuidedDemoTemplatesV1()[0]!);
  const coordinator = new PocEarlyAdminCoordinatorV1(plan, tempRoot());
  const failed = coordinator.runSyntheticSetup("TRANSIENT_HEALTH_CHECK_FAILURE");
  const repair = buildPocEarlyAdminRepairPlanV1(
    failed,
    "TRANSIENT_HEALTH_CHECK_FAILURE",
  );
  assert.equal(repair.action.actionId, "RETRY_DECLARED_HEALTH_CHECKS");
  assert.equal(repair.ownerConfirmationRequired, false);
  const answer = coordinator.ask("Is this safe?");
  assert.equal(answer.topic, "SAFETY");
  assert.equal(answer.persistedQuestionText, false);
  assert.throws(
    () => coordinator.ask("token=do-not-store"),
    PocEarlyAdminSetupError,
  );
  coordinator.cleanup();
});

test("EARLY-ADMIN-RESUME reloads only a persisted digest-bound owned checkpoint", () => {
  const root = tempRoot();
  const plan = planFor(expectedPocGuidedDemoTemplatesV1()[0]!);
  const first = new PocEarlyAdminCoordinatorV1(plan, root);
  const persisted = first.runSyntheticSetup("TRANSIENT_HEALTH_CHECK_FAILURE");
  const resumed = new PocEarlyAdminCoordinatorV1(plan, root, { resume: true });
  assert.equal(resumed.status().statusDigest, persisted.statusDigest);
  assert.throws(
    () => new PocEarlyAdminCoordinatorV1({
      ...plan,
      storage: {
        ...plan.storage,
        ownedStateRoot: "../outside",
      },
    }, root),
    /UNSAFE_COORDINATOR_STATE_ROOT_DENIED/,
  );
  resumed.cleanup();
});

test("EARLY-ADMIN-AUTHORITY profiles require owner activation and full-control risk acceptance", () => {
  const initial = buildPocEarlyAdminStatusV1(
    planFor(expectedPocGuidedDemoTemplatesV1()[0]!),
  );
  assert.deepEqual(
    pocAdminAuthorityProfilesV1().map(({ profileId }) => profileId),
    ["SAFE_GUIDED", "DEVELOPER_ELEVATED", "FULL_CONTROL_LAB"],
  );
  assert.equal(initial.authority.profile.profileId, "SAFE_GUIDED");
  assert.match(fullControlLabRiskWarningV1(), /not recommended for real operation/i);
  assert.match(fullControlLabRiskWarningV1(), /real root.*audit data/i);
  assert.throws(
    () => activatePocAdminAuthorityProfileV1(initial, {
      requestedProfileId: "FULL_CONTROL_LAB",
      source: "OWNER",
      contextId: initial.sessionId,
      explicitOwnerConfirmation: "yes",
    }),
    /FULL_CONTROL_EXPLICIT_RISK_ACCEPTANCE_REQUIRED/,
  );
  assert.throws(
    () => activatePocAdminAuthorityProfileV1(initial, {
      requestedProfileId: "DEVELOPER_ELEVATED",
      source: "OWNER",
      contextId: initial.sessionId,
      explicitOwnerConfirmation: null,
    }),
    /ELEVATED_PROFILE_OWNER_CONFIRMATION_REQUIRED/,
  );
  assert.throws(
    () => activatePocAdminAuthorityProfileV1(initial, {
      requestedProfileId: "SAFE_GUIDED",
      source: "OWNER",
      contextId: "foreign-context",
      explicitOwnerConfirmation: null,
    }),
    /AUTHORITY_CONTEXT_MISMATCH/,
  );
  assert.throws(
    () => activatePocAdminAuthorityProfileV1(initial, {
      requestedProfileId: "FULL_CONTROL_LAB",
      source: "CUSTOM_TEMPLATE_REQUEST",
      contextId: initial.sessionId,
      explicitOwnerConfirmation:
        `I ACCEPT FULL_CONTROL_LAB RISK FOR ${initial.sessionId}`,
    }),
    /CUSTOM_TEMPLATE_CANNOT_ACTIVATE_AUTHORITY_PROFILE/,
  );
  const full = activatePocAdminAuthorityProfileV1(initial, {
    requestedProfileId: "FULL_CONTROL_LAB",
    source: "OWNER",
    contextId: initial.sessionId,
    explicitOwnerConfirmation:
      `I ACCEPT FULL_CONTROL_LAB RISK FOR ${initial.sessionId}`,
  });
  assert.equal(
    full.authority.hostRights,
    "ALL_OS_PROCESS_RIGHTS_NO_CHIMPMAERA_GATES",
  );
  assert.equal(
    assertPocAdminActionAllowedV1(
      full,
      { actionId: "arbitrary.host.action", declared: false, material: true },
      false,
    ),
    true,
  );
  const fullAfterSetup = runPocEarlyAdminSyntheticSetupV1(full);
  assert.equal(fullAfterSetup.health.status, "PASS");
  assert.ok(
    fullAfterSetup.warnings.includes(fullControlLabRiskWarningV1()),
    "the full-control risk warning must remain visible after setup",
  );
});

test("EARLY-ADMIN-AUTHORITY elevated profiles do not silently persist and can return safe", () => {
  const initial = buildPocEarlyAdminStatusV1(
    planFor(expectedPocGuidedDemoTemplatesV1()[0]!),
  );
  const elevated = activatePocAdminAuthorityProfileV1(initial, {
    requestedProfileId: "DEVELOPER_ELEVATED",
    source: "OWNER",
    contextId: initial.sessionId,
    explicitOwnerConfirmation: "Use declared host rights in this local lab.",
  });
  assert.throws(
    () => assertPocAdminActionAllowedV1(
      elevated,
      { actionId: "undeclared", declared: false, material: true },
      true,
    ),
    /UNDECLARED_ACTION_DENIED/,
  );
  assert.throws(
    () => assertPocAdminActionAllowedV1(
      elevated,
      { actionId: "declared-material", declared: true, material: true },
      false,
    ),
    /OWNER_CONFIRMATION_REQUIRED/,
  );
  assert.equal(
    assertPocAdminActionAllowedV1(
      elevated,
      { actionId: "declared-read", declared: true, material: false },
      false,
    ),
    true,
  );
  for (const reason of ["OWNER_REVOKED", "PROCESS_RESTART", "CLEANUP"] as const) {
    const safe = resetPocAdminAuthorityToSafeV1(elevated, reason);
    assert.equal(safe.authority.profile.profileId, "SAFE_GUIDED");
    assert.equal(safe.authority.shellAccess, false);
    assert.equal(safe.authority.profile.silentlyInherited, false);
  }
});
