import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import {
  verifyPocGuidedDemoSetupPlanV1,
  type PocGuidedDemoSetupPlanV1,
} from "./poc-guided-demo-bootstrap.js";

export const POC_EARLY_ADMIN_STATUS_API_VERSION =
  "chimpmaera.dev/poc-early-admin-status/v1" as const;
export const POC_EARLY_ADMIN_REPAIR_PLAN_API_VERSION =
  "chimpmaera.dev/poc-early-admin-repair-plan/v1" as const;
export const POC_EARLY_ADMIN_REPAIR_RECEIPT_API_VERSION =
  "chimpmaera.dev/poc-early-admin-repair-receipt/v1" as const;
export const POC_ADMIN_AUTHORITY_PROFILE_API_VERSION =
  "chimpmaera.dev/admin-authority-profile/v1" as const;

export type PocAdminAuthorityProfileIdV1 =
  | "SAFE_GUIDED"
  | "DEVELOPER_ELEVATED"
  | "FULL_CONTROL_LAB";
export type PocAdminAuthorityProfileV1 = Readonly<{
  apiVersion: typeof POC_ADMIN_AUTHORITY_PROFILE_API_VERSION;
  profileId: PocAdminAuthorityProfileIdV1;
  recommendedForRealOperation: boolean;
  intendedUse: "REAL_OPERATION" | "LOCAL_DEVELOPMENT_AND_SECURITY_TESTS" | "TEST_LAB_ONLY";
  actionPolicy:
    | "BOUNDED_DECLARED_ACTIONS_APPROVAL_FOR_MATERIAL_CHANGE"
    | "BROAD_DECLARED_SYSTEM_RIGHTS_APPROVAL_FOR_MATERIAL_CHANGE"
    | "NO_CHIMPMAERA_CAPABILITY_ACTION_OR_APPROVAL_LIMITS";
  osProcessRightsAreCeiling: true;
  rootElevationRequiresSeparateVisibleOwnerAction: true;
  auditAndEmergencyStopAreTransparencyNotSecurityBoundary: true;
  contextBound: true;
  visible: true;
  revocable: true;
  silentlyInherited: false;
  restartPolicy: "RESET_TO_SAFE_GUIDED";
}>;

export type PocAdminAuthoritySelectionV1 = Readonly<{
  requestedProfileId: PocAdminAuthorityProfileIdV1;
  source: "OWNER" | "CUSTOM_TEMPLATE_REQUEST";
  contextId: string;
  explicitOwnerConfirmation: string | null;
}>;

export type PocEarlyAdminAuthorityV1 =
  | "STAGE_A_BOOTSTRAP_SUPERVISOR"
  | "STAGE_B_ADMIN_AI";
export type PocEarlyAdminStageIdV1 =
  | "bootstrap_supervisor"
  | "preflight"
  | "download_and_cache"
  | "configure_owned_state"
  | "install_sandbox"
  | "health_policy_identity"
  | "ready";
export type PocEarlyAdminRepairActionV1 =
  | "REWRITE_OWNED_CONFIG_FROM_VERIFIED_PLAN"
  | "RETRY_DECLARED_HEALTH_CHECKS";
export type PocEarlyAdminIssueCodeV1 =
  | "CONFIG_DIGEST_MISMATCH"
  | "TRANSIENT_HEALTH_CHECK_FAILURE";

type SetupStageV1 = Readonly<{
  stageId: PocEarlyAdminStageIdV1;
  label: string;
  status: "PENDING" | "RUNNING" | "PASS" | "FAILED";
}>;

export type PocEarlyAdminStatusV1 = Readonly<{
  apiVersion: typeof POC_EARLY_ADMIN_STATUS_API_VERSION;
  kind: "PocEarlyAdminStatus";
  sessionId: string;
  provider: Readonly<{
    providerId: "DETERMINISTIC_ADMIN_ASSISTANT_V1";
    contract:
      "TYPED_ADMIN_ASSISTANT_PROVIDER_AUTHORITY_FROM_OWNER_PROFILE";
    currentEvidence: "OFFLINE_SYNTHETIC_NO_LIVE_LLM";
    laterLocalLlmPath:
      "LOCAL_OPENAI_COMPATIBLE_PROVIDER_BEHIND_SAME_TYPED_CONTRACT";
  }>;
  authority: Readonly<{
    stage: PocEarlyAdminAuthorityV1;
    profile: PocAdminAuthorityProfileV1;
    shellAccess: boolean;
    controlPlaneAdministration: boolean;
    policyWidening: boolean;
    hostRights:
      | "BOUNDED_OWNED_STATE"
      | "DECLARED_OS_PROCESS_RIGHTS"
      | "ALL_OS_PROCESS_RIGHTS_NO_CHIMPMAERA_GATES";
    stageAAllowedActions: readonly PocEarlyAdminRepairActionV1[];
  }>;
  template: PocGuidedDemoSetupPlanV1["template"];
  plan: Readonly<{
    planId: string;
    planDigest: string;
    setupSteps: PocGuidedDemoSetupPlanV1["setupSteps"];
  }>;
  stages: readonly SetupStageV1[];
  progress: Readonly<{
    completedStages: number;
    totalStages: number;
    percent: number;
  }>;
  resources: Readonly<{
    downloadBytesTotal: number;
    downloadBytesComplete: number;
    cache: "EMPTY" | "VERIFIED_WARM";
    diskBytesRequiredEstimate: number;
    diskBytesAvailableSynthetic: number;
    universalInstallTimeClaim: false;
  }>;
  health: Readonly<{
    status: "PENDING" | "DEGRADED" | "PASS";
    healthGate: boolean;
    policyGate: boolean;
    identityGate: boolean;
  }>;
  currentAction: string;
  warnings: readonly string[];
  decisions: readonly Readonly<{
    decisionId: string;
    status: "DEFAULTED" | "CONFIRMED" | "APPLIED";
    summary: string;
  }>[];
  receipts: readonly Readonly<{
    kind: "REPAIR" | "SETUP" | "CLEANUP";
    digest: string;
  }>[];
  resume: Readonly<{
    available: boolean;
    checkpointStage: PocEarlyAdminStageIdV1;
    cacheReusable: boolean;
  }>;
  cleanup: Readonly<{
    available: true;
    ownedStateRoot: string;
    removesOnlyOwnedState: true;
  }>;
  dialog: Readonly<{
    questionPolicy: "NO_FIXED_MAXIMUM_ASK_ONLY_WHEN_REQUIRED";
    progressiveDisclosure: true;
    acceptsQuestions: true;
    availableActions: readonly [
      "ASK",
      "DIAGNOSE",
      "CONFIRM_REPAIR",
      "RESUME",
      "CLEANUP",
    ];
  }>;
  statusDigest: string;
}>;

export type PocEarlyAdminRepairPlanV1 = Readonly<{
  apiVersion: typeof POC_EARLY_ADMIN_REPAIR_PLAN_API_VERSION;
  kind: "PocEarlyAdminRepairPlan";
  repairPlanId: string;
  issueCode: PocEarlyAdminIssueCodeV1;
  diagnosis: string;
  baseSetupPlanDigest: string;
  baseStatusDigest: string;
  requiredAuthority: "STAGE_A_BOOTSTRAP_SUPERVISOR";
  action: Readonly<{
    actionId: PocEarlyAdminRepairActionV1;
    capability: string;
    target: string;
    idempotent: true;
    boundedToOwnedState: true;
    materialChange: boolean;
  }>;
  impact: string;
  ownerConfirmationRequired: boolean;
  rollback: Readonly<{
    action: "RESTORE_PREVIOUS_OWNED_CONFIG" | "NO_STATE_CHANGE";
    boundedToOwnedState: true;
  }>;
  repairPlanDigest: string;
}>;

export type PocEarlyAdminRepairReceiptV1 = Readonly<{
  apiVersion: typeof POC_EARLY_ADMIN_REPAIR_RECEIPT_API_VERSION;
  kind: "PocEarlyAdminRepairReceipt";
  repairPlanDigest: string;
  baseSetupPlanDigest: string;
  actionId: PocEarlyAdminRepairActionV1;
  ownerConfirmed: boolean;
  status: "APPLIED";
  rollback: PocEarlyAdminRepairPlanV1["rollback"];
  receiptDigest: string;
}>;

export type PocEarlyAdminAnswerV1 = Readonly<{
  providerId: "DETERMINISTIC_ADMIN_ASSISTANT_V1";
  questionDigest: string;
  topic: "PROGRESS" | "SAFETY" | "TEMPLATE" | "RECOVERY" | "GENERAL";
  answer: string;
  persistedQuestionText: false;
}>;

export class PocEarlyAdminSetupError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const STAGE_A_ACTIONS = [
  "REWRITE_OWNED_CONFIG_FROM_VERIFIED_PLAN",
  "RETRY_DECLARED_HEALTH_CHECKS",
] as const;

const FULL_CONTROL_WARNING =
  "FULL_CONTROL_LAB is not recommended for real operation. After activation "
  + "the Admin-AI may use every right already granted to the PANSPHAIRA host "
  + "process, including shell, files, processes/services, packages, network, "
  + "modules, configuration and repair, without further PANSPHAIRA capability, "
  + "action or approval gates. PANSPHAIRA does not create OS rights: root needs "
  + "a separate visible owner elevation. With real root the Admin-AI can also "
  + "damage or remove PANSPHAIRA, its audit data and emergency controls; audit, "
  + "status, receipts and emergency stop are transparency/recovery features, "
  + "not a security boundary.";

export function pocAdminAuthorityProfilesV1():
  readonly PocAdminAuthorityProfileV1[] {
  const common = {
    apiVersion: POC_ADMIN_AUTHORITY_PROFILE_API_VERSION,
    osProcessRightsAreCeiling: true as const,
    rootElevationRequiresSeparateVisibleOwnerAction: true as const,
    auditAndEmergencyStopAreTransparencyNotSecurityBoundary: true as const,
    contextBound: true as const,
    visible: true as const,
    revocable: true as const,
    silentlyInherited: false as const,
    restartPolicy: "RESET_TO_SAFE_GUIDED" as const,
  };
  return [
    {
      ...common,
      profileId: "SAFE_GUIDED",
      recommendedForRealOperation: true,
      intendedUse: "REAL_OPERATION",
      actionPolicy:
        "BOUNDED_DECLARED_ACTIONS_APPROVAL_FOR_MATERIAL_CHANGE",
    },
    {
      ...common,
      profileId: "DEVELOPER_ELEVATED",
      recommendedForRealOperation: false,
      intendedUse: "LOCAL_DEVELOPMENT_AND_SECURITY_TESTS",
      actionPolicy:
        "BROAD_DECLARED_SYSTEM_RIGHTS_APPROVAL_FOR_MATERIAL_CHANGE",
    },
    {
      ...common,
      profileId: "FULL_CONTROL_LAB",
      recommendedForRealOperation: false,
      intendedUse: "TEST_LAB_ONLY",
      actionPolicy: "NO_CHIMPMAERA_CAPABILITY_ACTION_OR_APPROVAL_LIMITS",
    },
  ];
}

function authorityProfile(
  profileId: PocAdminAuthorityProfileIdV1,
): PocAdminAuthorityProfileV1 {
  const profile = pocAdminAuthorityProfilesV1().find(
    (candidate) => candidate.profileId === profileId,
  );
  if (!profile) fail("UNKNOWN_AUTHORITY_PROFILE");
  return profile!;
}

export function fullControlLabRiskWarningV1(): string {
  return FULL_CONTROL_WARNING;
}

const STAGE_LABELS: Readonly<Record<PocEarlyAdminStageIdV1, string>> = {
  bootstrap_supervisor: "Bootstrap supervisor and dashboard",
  preflight: "Template, policy, disk and capability preflight",
  download_and_cache: "Verified downloads and cache",
  configure_owned_state: "Owned configuration",
  install_sandbox: "Local synthetic sandbox",
  health_policy_identity: "Health, policy and identity gates",
  ready: "Ready",
};

const STAGE_IDS = Object.keys(STAGE_LABELS) as PocEarlyAdminStageIdV1[];

const digest = (value: unknown): string =>
  `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;

const fail = (code: string): never => {
  throw new PocEarlyAdminSetupError(code);
};

function assertSafeText(value: unknown): void {
  const text = typeof value === "string" ? value : canonicalJson(value);
  if (
    /(?:authorization|api[-_ ]?key|password|secret|token)\s*[:=]\s*\S+/i
      .test(text)
    || /\b\d{3}-\d{2}-\d{4}\b/.test(text)
    || /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)
  ) {
    fail("SENSITIVE_INPUT_DENIED");
  }
}

function statusCore(
  status: PocEarlyAdminStatusV1,
): Omit<PocEarlyAdminStatusV1, "statusDigest"> {
  const { statusDigest: _statusDigest, ...core } = status;
  return core;
}

function withStatusDigest(
  core: Omit<PocEarlyAdminStatusV1, "statusDigest">,
): PocEarlyAdminStatusV1 {
  assertSafeText(core);
  return { ...core, statusDigest: digest(core) };
}

function progressFor(stages: readonly SetupStageV1[]):
  PocEarlyAdminStatusV1["progress"] {
  const completedStages = stages.filter(({ status }) => status === "PASS").length;
  return {
    completedStages,
    totalStages: stages.length,
    percent: Math.floor((completedStages / stages.length) * 100),
  };
}

function updateStages(
  status: PocEarlyAdminStatusV1,
  updates: Readonly<Partial<Record<
    PocEarlyAdminStageIdV1,
    SetupStageV1["status"]
  >>>,
): readonly SetupStageV1[] {
  return status.stages.map((stage) => ({
    ...stage,
    status: updates[stage.stageId] ?? stage.status,
  }));
}

export function buildPocEarlyAdminStatusV1(
  planInput: PocGuidedDemoSetupPlanV1,
  options: Readonly<{ policyAvailable?: boolean }> = {},
): PocEarlyAdminStatusV1 {
  const plan = verifyPocGuidedDemoSetupPlanV1(planInput);
  const stages = STAGE_IDS.map((stageId, index) => ({
    stageId,
    label: STAGE_LABELS[stageId],
    status: index === 0 ? "PASS" as const : "PENDING" as const,
  }));
  const core = {
    apiVersion: POC_EARLY_ADMIN_STATUS_API_VERSION,
    kind: "PocEarlyAdminStatus" as const,
    sessionId: `setup.${plan.template.templateId}.v1`,
    provider: {
      providerId: "DETERMINISTIC_ADMIN_ASSISTANT_V1" as const,
      contract:
        "TYPED_ADMIN_ASSISTANT_PROVIDER_AUTHORITY_FROM_OWNER_PROFILE" as const,
      currentEvidence: "OFFLINE_SYNTHETIC_NO_LIVE_LLM" as const,
      laterLocalLlmPath:
        "LOCAL_OPENAI_COMPATIBLE_PROVIDER_BEHIND_SAME_TYPED_CONTRACT" as const,
    },
    authority: {
      stage: "STAGE_A_BOOTSTRAP_SUPERVISOR" as const,
      profile: authorityProfile("SAFE_GUIDED"),
      shellAccess: false as const,
      controlPlaneAdministration: false as const,
      policyWidening: false as const,
      hostRights: "BOUNDED_OWNED_STATE" as const,
      stageAAllowedActions: STAGE_A_ACTIONS,
    },
    template: plan.template,
    plan: {
      planId: plan.planId,
      planDigest: plan.planDigest,
      setupSteps: plan.setupSteps,
    },
    stages,
    progress: progressFor(stages),
    resources: {
      downloadBytesTotal: 0,
      downloadBytesComplete: 0,
      cache: "VERIFIED_WARM" as const,
      diskBytesRequiredEstimate: 65536,
      diskBytesAvailableSynthetic: 1073741824,
      universalInstallTimeClaim: false as const,
    },
    health: {
      status: "PENDING" as const,
      healthGate: false,
      policyGate: options.policyAvailable ?? true,
      identityGate: false,
    },
    currentAction: "Dashboard ready; waiting for setup start.",
    warnings: [] as readonly string[],
    decisions: [{
      decisionId: "safe-defaults",
      status: "DEFAULTED" as const,
      summary: "Offline synthetic mode, no network, credentials or containers.",
    }],
    receipts: [] as PocEarlyAdminStatusV1["receipts"],
    resume: {
      available: false,
      checkpointStage: "bootstrap_supervisor" as const,
      cacheReusable: true,
    },
    cleanup: {
      available: true as const,
      ownedStateRoot: plan.storage.ownedStateRoot,
      removesOnlyOwnedState: true as const,
    },
    dialog: {
      questionPolicy: "NO_FIXED_MAXIMUM_ASK_ONLY_WHEN_REQUIRED" as const,
      progressiveDisclosure: true as const,
      acceptsQuestions: true as const,
      availableActions: [
        "ASK",
        "DIAGNOSE",
        "CONFIRM_REPAIR",
        "RESUME",
        "CLEANUP",
      ] as const,
    },
  };
  return withStatusDigest(core);
}

export function verifyPocEarlyAdminStatusV1(
  status: PocEarlyAdminStatusV1,
): PocEarlyAdminStatusV1 {
  const profile = status.authority.profile;
  const authorityShapeValid = profile.profileId === "SAFE_GUIDED"
    ? !status.authority.shellAccess
      && !status.authority.controlPlaneAdministration
      && !status.authority.policyWidening
      && status.authority.hostRights === "BOUNDED_OWNED_STATE"
    : profile.profileId === "DEVELOPER_ELEVATED"
      ? status.authority.shellAccess
        && status.authority.controlPlaneAdministration
        && status.authority.policyWidening
        && status.authority.hostRights === "DECLARED_OS_PROCESS_RIGHTS"
      : status.authority.shellAccess
        && status.authority.controlPlaneAdministration
        && status.authority.policyWidening
        && status.authority.hostRights
          === "ALL_OS_PROCESS_RIGHTS_NO_CHIMPMAERA_GATES";
  if (
    status.apiVersion !== POC_EARLY_ADMIN_STATUS_API_VERSION
    || status.kind !== "PocEarlyAdminStatus"
    || status.statusDigest !== digest(statusCore(status))
    || profile.apiVersion !== POC_ADMIN_AUTHORITY_PROFILE_API_VERSION
    || !authorityShapeValid
    || status.resources.universalInstallTimeClaim
  ) {
    fail("TAMPERED_STATUS_DENIED");
  }
  assertSafeText(status);
  return status;
}

export function activatePocAdminAuthorityProfileV1(
  statusInput: PocEarlyAdminStatusV1,
  selection: PocAdminAuthoritySelectionV1,
): PocEarlyAdminStatusV1 {
  const status = verifyPocEarlyAdminStatusV1(statusInput);
  if (selection.contextId !== status.sessionId) {
    fail("AUTHORITY_CONTEXT_MISMATCH");
  }
  if (selection.source === "CUSTOM_TEMPLATE_REQUEST") {
    fail("CUSTOM_TEMPLATE_CANNOT_ACTIVATE_AUTHORITY_PROFILE");
  }
  const profile = authorityProfile(selection.requestedProfileId);
  if (
    profile.profileId === "FULL_CONTROL_LAB"
    && selection.explicitOwnerConfirmation
      !== `I ACCEPT FULL_CONTROL_LAB RISK FOR ${status.sessionId}`
  ) {
    fail("FULL_CONTROL_EXPLICIT_RISK_ACCEPTANCE_REQUIRED");
  }
  if (
    profile.profileId === "DEVELOPER_ELEVATED"
    && !selection.explicitOwnerConfirmation
  ) {
    fail("ELEVATED_PROFILE_OWNER_CONFIRMATION_REQUIRED");
  }
  const full = profile.profileId === "FULL_CONTROL_LAB";
  const elevated = profile.profileId === "DEVELOPER_ELEVATED";
  return withStatusDigest({
    ...statusCore(status),
    authority: {
      ...status.authority,
      profile,
      shellAccess: elevated || full,
      controlPlaneAdministration: elevated || full,
      policyWidening: elevated || full,
      hostRights: full
        ? "ALL_OS_PROCESS_RIGHTS_NO_CHIMPMAERA_GATES"
        : elevated
          ? "DECLARED_OS_PROCESS_RIGHTS"
          : "BOUNDED_OWNED_STATE",
      stageAAllowedActions: full ? [] : STAGE_A_ACTIONS,
    },
    currentAction: full
      ? "FULL_CONTROL_LAB visibly active for this setup context."
      : `${profile.profileId} visibly active for this setup context.`,
    warnings: full
      ? [...status.warnings, FULL_CONTROL_WARNING]
      : status.warnings.filter((warning) => warning !== FULL_CONTROL_WARNING),
    decisions: [
      ...status.decisions,
      {
        decisionId: `authority-profile.${profile.profileId}`,
        status: "CONFIRMED",
        summary: profile.actionPolicy,
      },
    ],
  });
}

export function resetPocAdminAuthorityToSafeV1(
  statusInput: PocEarlyAdminStatusV1,
  reason: "OWNER_REVOKED" | "PROCESS_RESTART" | "CLEANUP",
): PocEarlyAdminStatusV1 {
  const status = verifyPocEarlyAdminStatusV1(statusInput);
  return withStatusDigest({
    ...statusCore(status),
    authority: {
      ...status.authority,
      profile: authorityProfile("SAFE_GUIDED"),
      shellAccess: false,
      controlPlaneAdministration: false,
      policyWidening: false,
      hostRights: "BOUNDED_OWNED_STATE",
      stageAAllowedActions: STAGE_A_ACTIONS,
    },
    currentAction: `SAFE_GUIDED active after ${reason}.`,
    warnings: status.warnings.filter((warning) => warning !== FULL_CONTROL_WARNING),
    decisions: [
      ...status.decisions,
      {
        decisionId: `authority-profile.reset.${reason}`,
        status: "APPLIED",
        summary: "Elevated authority was revoked and did not persist.",
      },
    ],
  });
}

export function assertPocAdminActionAllowedV1(
  statusInput: PocEarlyAdminStatusV1,
  action: Readonly<{ actionId: string; declared: boolean; material: boolean }>,
  ownerConfirmed: boolean,
): true {
  const status = verifyPocEarlyAdminStatusV1(statusInput);
  const profileId = status.authority.profile.profileId;
  if (profileId === "FULL_CONTROL_LAB") return true;
  if (!action.declared) fail("UNDECLARED_ACTION_DENIED");
  if (action.material && !ownerConfirmed) fail("OWNER_CONFIRMATION_REQUIRED");
  return true;
}

export function runPocEarlyAdminSyntheticSetupV1(
  statusInput: PocEarlyAdminStatusV1,
  options: Readonly<{ injectFailure?: PocEarlyAdminIssueCodeV1 }> = {},
): PocEarlyAdminStatusV1 {
  const status = verifyPocEarlyAdminStatusV1(statusInput);
  if (options.injectFailure === "CONFIG_DIGEST_MISMATCH") {
    const stages = updateStages(status, {
      preflight: "PASS",
      download_and_cache: "PASS",
      configure_owned_state: "FAILED",
    });
    return withStatusDigest({
      ...statusCore(status),
      stages,
      progress: progressFor(stages),
      health: { ...status.health, status: "DEGRADED" },
      currentAction: "Configuration digest mismatch; bounded repair available.",
      warnings: ["CONFIG_DIGEST_MISMATCH"],
      resume: {
        available: false,
        checkpointStage: "download_and_cache",
        cacheReusable: true,
      },
    });
  }
  if (options.injectFailure === "TRANSIENT_HEALTH_CHECK_FAILURE") {
    const stages = updateStages(status, {
      preflight: "PASS",
      download_and_cache: "PASS",
      configure_owned_state: "PASS",
      install_sandbox: "PASS",
      health_policy_identity: "FAILED",
    });
    return withStatusDigest({
      ...statusCore(status),
      stages,
      progress: progressFor(stages),
      health: { ...status.health, status: "DEGRADED", identityGate: true },
      currentAction: "Declared health checks need a bounded retry.",
      warnings: ["TRANSIENT_HEALTH_CHECK_FAILURE"],
      resume: {
        available: false,
        checkpointStage: "install_sandbox",
        cacheReusable: true,
      },
    });
  }
  const stages = status.stages.map((stage) => ({
    ...stage,
    status: "PASS" as const,
  }));
  const setupReceiptDigest = digest({
    kind: "SETUP",
    planDigest: status.plan.planDigest,
    templateId: status.template.templateId,
  });
  return withStatusDigest({
    ...statusCore(status),
    stages,
    progress: progressFor(stages),
    health: {
      status: "PASS",
      healthGate: true,
      policyGate: status.health.policyGate,
      identityGate: true,
    },
    currentAction: "Setup healthy; Stage B promotion is gate-controlled.",
    warnings: status.warnings.filter((warning) =>
      warning !== "CONFIG_DIGEST_MISMATCH"
      && warning !== "TRANSIENT_HEALTH_CHECK_FAILURE"
    ),
    receipts: [
      ...status.receipts.filter(({ kind }) => kind !== "SETUP"),
      { kind: "SETUP", digest: setupReceiptDigest },
    ],
    resume: {
      available: true,
      checkpointStage: "ready",
      cacheReusable: true,
    },
  });
}

export function buildPocEarlyAdminRepairPlanV1(
  statusInput: PocEarlyAdminStatusV1,
  issueCode: PocEarlyAdminIssueCodeV1,
): PocEarlyAdminRepairPlanV1 {
  const status = verifyPocEarlyAdminStatusV1(statusInput);
  if (!status.warnings.includes(issueCode)) fail("ISSUE_NOT_OBSERVED_DENIED");
  const definition = issueCode === "CONFIG_DIGEST_MISMATCH"
    ? {
        actionId: "REWRITE_OWNED_CONFIG_FROM_VERIFIED_PLAN" as const,
        capability: "write_owned_playground_state",
        target: `${status.cleanup.ownedStateRoot}/config.json`,
        diagnosis:
          "The owned config no longer matches the verified setup-plan digest.",
        impact:
          "Replace only the owned config with deterministic plan-bound bytes.",
        materialChange: true,
        rollback: "RESTORE_PREVIOUS_OWNED_CONFIG" as const,
      }
    : {
        actionId: "RETRY_DECLARED_HEALTH_CHECKS" as const,
        capability: "run_local_deterministic_health_and_smoke",
        target: status.cleanup.ownedStateRoot,
        diagnosis: "A declared local synthetic health check was transiently false.",
        impact: "Retry only the declared idempotent health checks.",
        materialChange: false,
        rollback: "NO_STATE_CHANGE" as const,
      };
  if (!status.authority.stageAAllowedActions.includes(definition.actionId)) {
    fail("UNDECLARED_ACTION_DENIED");
  }
  const core = {
    apiVersion: POC_EARLY_ADMIN_REPAIR_PLAN_API_VERSION,
    kind: "PocEarlyAdminRepairPlan" as const,
    repairPlanId: `repair.${status.template.templateId}.${issueCode}.v1`,
    issueCode,
    diagnosis: definition.diagnosis,
    baseSetupPlanDigest: status.plan.planDigest,
    baseStatusDigest: status.statusDigest,
    requiredAuthority: "STAGE_A_BOOTSTRAP_SUPERVISOR" as const,
    action: {
      actionId: definition.actionId,
      capability: definition.capability,
      target: definition.target,
      idempotent: true as const,
      boundedToOwnedState: true as const,
      materialChange: definition.materialChange,
    },
    impact: definition.impact,
    ownerConfirmationRequired: definition.materialChange,
    rollback: {
      action: definition.rollback,
      boundedToOwnedState: true as const,
    },
  };
  assertSafeText(core);
  return { ...core, repairPlanDigest: digest(core) };
}

export function verifyPocEarlyAdminRepairPlanV1(
  repairPlan: PocEarlyAdminRepairPlanV1,
  statusInput: PocEarlyAdminStatusV1,
): PocEarlyAdminRepairPlanV1 {
  const status = verifyPocEarlyAdminStatusV1(statusInput);
  const expected = buildPocEarlyAdminRepairPlanV1(
    status,
    repairPlan.issueCode,
  );
  const { repairPlanDigest, ...core } = repairPlan;
  if (
    repairPlanDigest !== digest(core)
    || repairPlanDigest !== expected.repairPlanDigest
    || repairPlan.baseSetupPlanDigest !== status.plan.planDigest
    || repairPlan.baseStatusDigest !== status.statusDigest
    || repairPlan.requiredAuthority !== "STAGE_A_BOOTSTRAP_SUPERVISOR"
    || status.authority.stage !== "STAGE_A_BOOTSTRAP_SUPERVISOR"
    || !status.authority.stageAAllowedActions.includes(repairPlan.action.actionId)
    || !repairPlan.action.idempotent
    || !repairPlan.action.boundedToOwnedState
  ) {
    fail("TAMPERED_OR_ESCALATED_REPAIR_PLAN_DENIED");
  }
  assertSafeText(repairPlan);
  return repairPlan;
}

export function applyPocEarlyAdminRepairV1(
  statusInput: PocEarlyAdminStatusV1,
  repairPlanInput: PocEarlyAdminRepairPlanV1,
  ownerConfirmed: boolean,
): Readonly<{
  status: PocEarlyAdminStatusV1;
  receipt: PocEarlyAdminRepairReceiptV1;
}> {
  const status = verifyPocEarlyAdminStatusV1(statusInput);
  const repairPlan = verifyPocEarlyAdminRepairPlanV1(repairPlanInput, status);
  if (repairPlan.ownerConfirmationRequired && !ownerConfirmed) {
    fail("OWNER_CONFIRMATION_REQUIRED");
  }
  const receiptCore = {
    apiVersion: POC_EARLY_ADMIN_REPAIR_RECEIPT_API_VERSION,
    kind: "PocEarlyAdminRepairReceipt" as const,
    repairPlanDigest: repairPlan.repairPlanDigest,
    baseSetupPlanDigest: repairPlan.baseSetupPlanDigest,
    actionId: repairPlan.action.actionId,
    ownerConfirmed,
    status: "APPLIED" as const,
    rollback: repairPlan.rollback,
  };
  const receipt = {
    ...receiptCore,
    receiptDigest: digest(receiptCore),
  };
  const nextStatus = withStatusDigest({
    ...statusCore(status),
    currentAction: "Repair applied; setup can resume from verified checkpoint.",
    warnings: status.warnings.filter((warning) => warning !== repairPlan.issueCode),
    decisions: [
      ...status.decisions,
      {
        decisionId: repairPlan.repairPlanId,
        status: ownerConfirmed ? "CONFIRMED" : "APPLIED",
        summary: repairPlan.impact,
      },
    ],
    receipts: [
      ...status.receipts,
      { kind: "REPAIR", digest: receipt.receiptDigest },
    ],
    resume: { ...status.resume, available: true },
  });
  return { status: nextStatus, receipt };
}

export function verifyPocEarlyAdminRepairReceiptV1(
  receipt: PocEarlyAdminRepairReceiptV1,
  repairPlan: PocEarlyAdminRepairPlanV1,
): PocEarlyAdminRepairReceiptV1 {
  const { receiptDigest, ...core } = receipt;
  if (
    receiptDigest !== digest(core)
    || receipt.repairPlanDigest !== repairPlan.repairPlanDigest
    || receipt.baseSetupPlanDigest !== repairPlan.baseSetupPlanDigest
    || receipt.actionId !== repairPlan.action.actionId
    || receipt.status !== "APPLIED"
  ) {
    fail("TAMPERED_REPAIR_RECEIPT_DENIED");
  }
  assertSafeText(receipt);
  return receipt;
}

export function resumePocEarlyAdminSetupV1(
  statusInput: PocEarlyAdminStatusV1,
): PocEarlyAdminStatusV1 {
  const status = verifyPocEarlyAdminStatusV1(statusInput);
  if (!status.resume.available || status.warnings.length > 0) {
    fail("SAFE_RESUME_NOT_AVAILABLE");
  }
  return runPocEarlyAdminSyntheticSetupV1(status);
}

export function promotePocEarlyAdminToStageBV1(
  statusInput: PocEarlyAdminStatusV1,
): PocEarlyAdminStatusV1 {
  const status = verifyPocEarlyAdminStatusV1(statusInput);
  if (
    status.health.status !== "PASS"
    || !status.health.healthGate
    || !status.health.policyGate
    || !status.health.identityGate
  ) {
    fail("STAGE_B_PROMOTION_GATES_NOT_MET");
  }
  return withStatusDigest({
    ...statusCore(status),
    authority: {
      ...status.authority,
      stage: "STAGE_B_ADMIN_AI",
    },
    currentAction: "Stage B Admin-AI active inside the existing policy boundary.",
    decisions: [
      ...status.decisions,
      {
        decisionId: "stage-b-promotion",
        status: "APPLIED",
        summary: "Promoted only after health, policy and identity gates passed.",
      },
    ],
  });
}

export function askPocEarlyAdminAssistantV1(
  statusInput: PocEarlyAdminStatusV1,
  question: string,
): PocEarlyAdminAnswerV1 {
  const status = verifyPocEarlyAdminStatusV1(statusInput);
  if (question.length < 1 || question.length > 500) fail("QUESTION_INVALID");
  assertSafeText(question);
  const normalized = question.toLowerCase();
  const topic = /progress|stage|status/.test(normalized)
    ? "PROGRESS" as const
    : /safe|authority|permission/.test(normalized)
      ? "SAFETY" as const
      : /template|quick|builder|business/.test(normalized)
        ? "TEMPLATE" as const
        : /repair|resume|failure|warning/.test(normalized)
          ? "RECOVERY" as const
          : "GENERAL" as const;
  const answers: Readonly<Record<typeof topic, string>> = {
    PROGRESS:
      `${status.progress.completedStages}/${status.progress.totalStages} stages `
      + `are complete. Current action: ${status.currentAction}`,
    SAFETY:
      "Stage A has no shell or Control Plane authority and can apply only "
      + "declared, idempotent, owned-state actions.",
    TEMPLATE:
      `Template ${status.template.displayName} is bound to `
      + `${status.template.manifestDigest}.`,
    RECOVERY:
      status.warnings.length > 0
        ? `Diagnosis is available for ${status.warnings.join(", ")}.`
        : "No active warning requires repair.",
    GENERAL:
      "I can explain setup progress, safety, templates and bounded recovery.",
  };
  return {
    providerId: "DETERMINISTIC_ADMIN_ASSISTANT_V1",
    questionDigest: digest({ question }),
    topic,
    answer: answers[topic],
    persistedQuestionText: false,
  };
}
