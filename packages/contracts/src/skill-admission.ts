import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const SKILL_ADMISSION_SCHEMA_V1 = "chimpmaera.skill/admission-request/v1" as const;
export const SKILL_MANIFEST_SCHEMA_V1 = "chimpmaera.skill/manifest/v1" as const;
export const SKILL_REPORT_SCHEMA_V1 = "chimpmaera.skill/risk-report/v1" as const;
export const SKILL_RECEIPT_SCHEMA_V1 = "chimpmaera.skill/lifecycle-receipt/v1" as const;

export type SkillProfileV1 = "SAFE_GUIDED" | "CUSTOM" | "RAMPAGE";
export type SkillRouteV1 =
  | "AUTO_ALLOW"
  | "DENY"
  | "OWNER_CONFIRM"
  | "STEP_UP_QUORUM"
  | "HUMAN_HANDOFF"
  | "QUARANTINE";

export interface SkillDependencyV1 {
  readonly name: string;
  readonly version: string;
  readonly digest: string;
  readonly registry: "LOCAL_LOCK";
}

export interface SkillCapabilityRequestV1 {
  readonly id: string;
  readonly mode: "READ" | "WRITE" | "EXECUTE";
  readonly reason: string;
}

export interface SkillAccessDeclarationV1 {
  readonly filesystem: boolean;
  readonly installScripts: readonly string[];
  readonly network: boolean;
  readonly persistence: boolean;
  readonly process: boolean;
  readonly secrets: boolean;
}

export interface CanonicalSkillManifestV1 {
  readonly schemaVersion: typeof SKILL_MANIFEST_SCHEMA_V1;
  readonly id: string;
  readonly version: string;
  readonly format: "OPENCLAW_SKILL";
  readonly entrypoint: "SKILL.md";
  readonly displayName: string;
  readonly licence: "Apache-2.0" | "MIT" | "BSD-3-Clause" | "CC0-1.0";
  readonly provenance: {
    readonly publisher: string;
    readonly source: string;
  };
  readonly access: SkillAccessDeclarationV1;
  readonly dependencies: readonly SkillDependencyV1[];
  readonly requestedCapabilities: readonly SkillCapabilityRequestV1[];
  readonly tools: readonly {
    readonly name: string;
    readonly description: string;
  }[];
}

export interface SkillPackageFileV1 {
  readonly path: string;
  readonly kind: "FILE" | "SYMLINK";
  readonly mediaType: "text/markdown" | "application/json" | "text/plain";
  readonly content: string;
  readonly digest: string;
}

export interface CanonicalSkillAdmissionRequestV1 {
  readonly schemaVersion: typeof SKILL_ADMISSION_SCHEMA_V1;
  readonly operationId: string;
  readonly correlationId: string;
  readonly tenant: string;
  readonly requester: string;
  readonly source: {
    readonly kind: "LOCAL_CONTENT";
    readonly locator: string;
    readonly version: string;
    readonly digest: string;
    readonly mutable: false;
  };
  readonly manifest: CanonicalSkillManifestV1;
  readonly files: readonly SkillPackageFileV1[];
}

export interface SkillFindingV1 {
  readonly code: string;
  readonly severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly path: string | null;
}

export interface SkillRiskReportV1 {
  readonly schemaVersion: typeof SKILL_REPORT_SCHEMA_V1;
  readonly requestDigest: string;
  readonly packageDigest: string;
  readonly riskScore: number;
  readonly qualityScore: number;
  readonly findings: readonly SkillFindingV1[];
  readonly transitiveCapabilities: readonly string[];
  readonly verdict: "ACCEPTABLE" | "OWNER_REVIEW" | "QUARANTINE";
}

export interface SkillDecisionV1 {
  readonly recommendation: "ADMIT" | "REJECT" | "REVIEW";
  readonly route: SkillRouteV1;
  readonly rationale: readonly string[];
  readonly impacts: readonly string[];
  readonly installAuthorized: boolean;
  readonly activationAuthorized: boolean;
  readonly grantedCapabilities: readonly string[];
}

export interface SkillAdmissionPolicyV1 {
  readonly tenant: string;
  readonly requesterIds: readonly string[];
  readonly publishers: readonly string[];
  readonly registeredCapabilities: Readonly<Record<string, readonly string[]>>;
  readonly custom: {
    readonly autoApproveLowRiskReadOnly: boolean;
    readonly admittedCapabilities: readonly string[];
  };
  readonly rampage: {
    readonly ownerAllowsAutoExecution: boolean;
    readonly admittedCapabilities: readonly string[];
  };
}

export interface SkillOwnerDecisionV1 {
  readonly approvedBy: string;
  readonly tenant: string;
  readonly requestDigest: string;
  readonly packageDigest: string;
  readonly decision: "APPROVE_INSTALL" | "DENY";
}

export interface InstalledSkillV1 {
  readonly id: string;
  readonly version: string;
  readonly packageDigest: string;
  readonly format: "OPENCLAW_SKILL";
  readonly installed: true;
  readonly active: boolean;
  readonly requestedCapabilities: readonly string[];
  readonly grantedCapabilities: readonly string[];
  readonly capabilityLimited: boolean;
}

export interface SkillLifecycleReceiptV1 {
  readonly schemaVersion: typeof SKILL_RECEIPT_SCHEMA_V1;
  readonly operationId: string;
  readonly tenant: string;
  readonly action: "INSTALL" | "ACTIVATE" | "ROLLBACK" | "DENY";
  readonly outcome: "COMMITTED" | "DENIED" | "QUARANTINED" | "THROTTLED" | "ROLLED_BACK";
  readonly requestDigest: string;
  readonly packageDigest: string;
  readonly generationBefore: number;
  readonly generationAfter: number;
  readonly route: SkillRouteV1;
  readonly issues: readonly string[];
}

export interface SkillLifecycleResultV1 {
  readonly outcome: SkillLifecycleReceiptV1["outcome"];
  readonly decision: SkillDecisionV1;
  readonly report: SkillRiskReportV1 | null;
  readonly receipt: SkillLifecycleReceiptV1;
  readonly replay: "FIRST" | "SAME_RECEIPT" | "NONE";
}

export type SkillRuntimeTargetV1 = "OPENCLAW" | "HERMES" | "CLAUDE_CODE";

export interface SkillMaterializationV1 {
  readonly target: SkillRuntimeTargetV1;
  readonly outcome: "MATERIALIZED" | "UNPROVEN";
  readonly packageDigest: string;
  readonly files: readonly { readonly path: string; readonly content: string; readonly digest: string }[];
  readonly issues: readonly string[];
}

interface StoreGenerationV1 {
  readonly generation: number;
  readonly skills: ReadonlyMap<string, InstalledSkillV1>;
}

const requestKeys = ["correlationId", "files", "manifest", "operationId", "requester", "schemaVersion", "source", "tenant"].sort();
const sourceKeys = ["digest", "kind", "locator", "mutable", "version"].sort();
const manifestKeys = ["access", "dependencies", "displayName", "entrypoint", "format", "id", "licence", "provenance", "requestedCapabilities", "schemaVersion", "tools", "version"].sort();
const accessKeys = ["filesystem", "installScripts", "network", "persistence", "process", "secrets"].sort();
const dependencyKeys = ["digest", "name", "registry", "version"].sort();
const capabilityKeys = ["id", "mode", "reason"].sort();
const fileKeys = ["content", "digest", "kind", "mediaType", "path"].sort();
const toolKeys = ["description", "name"].sort();
const provenanceKeys = ["publisher", "source"].sort();

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function digest(value: unknown): string {
  return sha256(canonicalJson(value));
}

function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && canonicalJson(Object.keys(value).sort()) === canonicalJson(keys);
}

function validId(value: unknown, prefix: string): value is string {
  return typeof value === "string" && new RegExp(`^${prefix}:[a-z0-9][a-z0-9._-]{2,63}$`).test(value);
}

function validVersion(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(value);
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function validPath(path: unknown): path is string {
  return typeof path === "string"
    && path.length >= 1
    && path.length <= 160
    && !path.startsWith("/")
    && !path.includes("\\")
    && !path.split("/").some((part) => part === "" || part === "." || part === "..")
    && /^[A-Za-z0-9._/-]+$/.test(path);
}

export function computeSkillPackageDigestV1(value: Pick<CanonicalSkillAdmissionRequestV1, "manifest" | "files">): string {
  return digest({ manifest: value.manifest, files: value.files });
}

export function validateSkillAdmissionRequestV1(value: unknown):
  | { readonly outcome: "ALLOW"; readonly request: CanonicalSkillAdmissionRequestV1; readonly requestDigest: string; readonly packageDigest: string }
  | { readonly outcome: "DENY"; readonly issues: readonly string[] } {
  if (!exactObject(value, requestKeys)) return { outcome: "DENY", issues: ["SKILL_REQUEST_SCHEMA_DENIED"] };
  if (value.schemaVersion !== SKILL_ADMISSION_SCHEMA_V1
    || !validId(value.operationId, "operation")
    || !validId(value.correlationId, "correlation")
    || !validId(value.tenant, "tenant")
    || !validId(value.requester, "workload")) {
    return { outcome: "DENY", issues: ["SKILL_REQUEST_BINDING_DENIED"] };
  }
  if (!exactObject(value.source, sourceKeys)
    || value.source.kind !== "LOCAL_CONTENT"
    || value.source.mutable !== false
    || !validVersion(value.source.version)
    || !validDigest(value.source.digest)
    || value.source.locator !== `skill+sha256:${value.source.digest}`) {
    return { outcome: "DENY", issues: ["SKILL_SOURCE_IMMUTABILITY_DENIED"] };
  }
  if (!exactObject(value.manifest, manifestKeys)) return { outcome: "DENY", issues: ["SKILL_MANIFEST_SCHEMA_DENIED"] };
  const manifest = value.manifest;
  if (manifest.schemaVersion !== SKILL_MANIFEST_SCHEMA_V1
    || !validId(manifest.id, "skill")
    || !validVersion(manifest.version)
    || manifest.version !== value.source.version
    || manifest.format !== "OPENCLAW_SKILL"
    || manifest.entrypoint !== "SKILL.md"
    || typeof manifest.displayName !== "string" || manifest.displayName.length < 3 || manifest.displayName.length > 80
    || !["Apache-2.0", "MIT", "BSD-3-Clause", "CC0-1.0"].includes(String(manifest.licence))) {
    return { outcome: "DENY", issues: ["SKILL_MANIFEST_VALUE_DENIED"] };
  }
  if (!exactObject(manifest.provenance, provenanceKeys)
    || !validId(manifest.provenance.publisher, "publisher")
    || typeof manifest.provenance.source !== "string"
    || !/^local:[a-z0-9._/-]{3,100}$/.test(manifest.provenance.source)) {
    return { outcome: "DENY", issues: ["SKILL_PROVENANCE_DENIED"] };
  }
  const access = manifest.access;
  if (!exactObject(access, accessKeys)
    || !["filesystem", "network", "persistence", "process", "secrets"].every((key) => typeof access[key] === "boolean")
    || !Array.isArray(access.installScripts)
    || !access.installScripts.every((script) => typeof script === "string" && script.length <= 120)) {
    return { outcome: "DENY", issues: ["SKILL_ACCESS_DECLARATION_DENIED"] };
  }
  if (!Array.isArray(manifest.dependencies) || manifest.dependencies.length > 32
    || !manifest.dependencies.every((dependency) => exactObject(dependency, dependencyKeys)
      && typeof dependency.name === "string" && /^[a-z0-9][a-z0-9._-]{1,63}$/.test(dependency.name)
      && validVersion(dependency.version) && validDigest(dependency.digest) && dependency.registry === "LOCAL_LOCK")) {
    return { outcome: "DENY", issues: ["SKILL_DEPENDENCY_LOCK_DENIED"] };
  }
  if (!Array.isArray(manifest.requestedCapabilities) || manifest.requestedCapabilities.length > 32
    || !manifest.requestedCapabilities.every((capability) => exactObject(capability, capabilityKeys)
      && validId(capability.id, "capability")
      && ["READ", "WRITE", "EXECUTE"].includes(String(capability.mode))
      && typeof capability.reason === "string" && capability.reason.length >= 3 && capability.reason.length <= 160)) {
    return { outcome: "DENY", issues: ["SKILL_CAPABILITY_DECLARATION_DENIED"] };
  }
  if (!Array.isArray(manifest.tools) || manifest.tools.length > 32
    || !manifest.tools.every((tool) => exactObject(tool, toolKeys)
      && typeof tool.name === "string" && /^[a-z][a-z0-9_.-]{2,63}$/.test(tool.name)
      && typeof tool.description === "string" && tool.description.length >= 3 && tool.description.length <= 240)) {
    return { outcome: "DENY", issues: ["SKILL_TOOL_DECLARATION_DENIED"] };
  }
  if (!Array.isArray(value.files) || value.files.length < 1 || value.files.length > 64
    || !value.files.every((file) => exactObject(file, fileKeys)
      && validPath(file.path)
      && ["FILE", "SYMLINK"].includes(String(file.kind))
      && ["text/markdown", "application/json", "text/plain"].includes(String(file.mediaType))
      && typeof file.content === "string" && Buffer.byteLength(file.content) <= 128 * 1024
      && validDigest(file.digest) && file.digest === sha256(file.content))) {
    return { outcome: "DENY", issues: ["SKILL_FILE_INTEGRITY_DENIED"] };
  }
  const paths = value.files.map((file) => file.path);
  if (new Set(paths).size !== paths.length || !paths.includes("SKILL.md")) {
    return { outcome: "DENY", issues: ["SKILL_FILE_SET_DENIED"] };
  }
  const request = value as unknown as CanonicalSkillAdmissionRequestV1;
  const packageDigest = computeSkillPackageDigestV1(request);
  if (packageDigest !== request.source.digest) return { outcome: "DENY", issues: ["SKILL_PACKAGE_DIGEST_DENIED"] };
  return { outcome: "ALLOW", request, requestDigest: digest(request), packageDigest };
}

function finding(code: string, severity: SkillFindingV1["severity"], path: string | null = null): SkillFindingV1 {
  return { code, severity, path };
}

export function analyseSkillAdmissionV1(
  request: CanonicalSkillAdmissionRequestV1,
  policy: SkillAdmissionPolicyV1,
): SkillRiskReportV1 {
  const findings: SkillFindingV1[] = [];
  const add = (item: SkillFindingV1): void => { findings.push(item); };
  if (request.tenant !== policy.tenant || !policy.requesterIds.includes(request.requester)) add(finding("SKILL_TENANT_OR_REQUESTER_DENIED", "CRITICAL"));
  if (!policy.publishers.includes(request.manifest.provenance.publisher)) add(finding("SKILL_PUBLISHER_UNTRUSTED", "HIGH"));
  if (request.manifest.access.installScripts.length > 0) add(finding("SKILL_INSTALL_SCRIPT_QUARANTINED", "CRITICAL"));
  for (const key of ["network", "secrets", "process", "persistence", "filesystem"] as const) {
    if (request.manifest.access[key]) add(finding(`SKILL_DECLARED_${key.toUpperCase()}_ACCESS`, key === "filesystem" ? "HIGH" : "CRITICAL"));
  }
  const seenDependencies = new Set<string>();
  for (const dependency of request.manifest.dependencies) {
    if (seenDependencies.has(dependency.name)) add(finding("SKILL_DEPENDENCY_CONFUSION_DENIED", "CRITICAL"));
    seenDependencies.add(dependency.name);
  }
  for (const file of request.files) {
    if (file.kind === "SYMLINK") add(finding("SKILL_SYMLINK_DENIED", "CRITICAL", file.path));
    const checks: readonly [RegExp, string, SkillFindingV1["severity"]][] = [
      [/(?:https?:\/\/|fetch\s*\(|XMLHttpRequest|node:https|node:http)/i, "SKILL_HIDDEN_NETWORK_ACCESS", "CRITICAL"],
      [/(?:process\.env|api[_-]?key|access[_-]?token|password|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY)/i, "SKILL_HIDDEN_CREDENTIAL_ACCESS", "CRITICAL"],
      [/(?:child_process|node:child_process|\bexec\s*\(|\bspawn\s*\()/i, "SKILL_HIDDEN_PROCESS_ACCESS", "CRITICAL"],
      [/(?:\.\.\/|\/etc\/|\/proc\/|~\/)/, "SKILL_PATH_ESCAPE_DENIED", "CRITICAL"],
      [/(?:postinstall|preinstall|prepare\s*:)/i, "SKILL_INSTALL_HOOK_INDICATOR", "CRITICAL"],
    ];
    for (const [pattern, code, severity] of checks) if (pattern.test(file.content)) add(finding(code, severity, file.path));
  }
  const transitive = new Set<string>();
  for (const capability of request.manifest.requestedCapabilities) {
    const rights = policy.registeredCapabilities[capability.id];
    if (!rights) add(finding("SKILL_UNKNOWN_CAPABILITY_DENIED", "CRITICAL"));
    else for (const right of rights) transitive.add(right);
    if (rights?.some((right) => right.startsWith("authority:") || right.startsWith("tenant:*"))) {
      add(finding("SKILL_TRANSITIVE_AUTHORITY_ESCALATION", "CRITICAL"));
    }
  }
  const severityWeight = { INFO: 0, LOW: 5, MEDIUM: 15, HIGH: 30, CRITICAL: 100 } as const;
  const riskScore = Math.min(100, findings.reduce((sum, item) => sum + severityWeight[item.severity], 0));
  const verdict = findings.some((item) => item.severity === "CRITICAL")
    ? "QUARANTINE"
    : findings.some((item) => item.severity === "HIGH") || request.manifest.requestedCapabilities.length > 0
      ? "OWNER_REVIEW"
      : "ACCEPTABLE";
  return {
    schemaVersion: SKILL_REPORT_SCHEMA_V1,
    requestDigest: digest(request),
    packageDigest: computeSkillPackageDigestV1(request),
    riskScore,
    qualityScore: Math.max(0, 100 - riskScore),
    findings,
    transitiveCapabilities: [...transitive].sort(),
    verdict,
  };
}

export function decideSkillAdmissionV1(
  request: CanonicalSkillAdmissionRequestV1,
  report: SkillRiskReportV1,
  profile: SkillProfileV1,
  policy: SkillAdmissionPolicyV1,
): SkillDecisionV1 {
  const requested = request.manifest.requestedCapabilities.map((item) => item.id);
  const capabilityPool = profile === "RAMPAGE" ? policy.rampage.admittedCapabilities : policy.custom.admittedCapabilities;
  const unadmitted = requested.filter((id) => !capabilityPool.includes(id));
  const impacts = [
    `install immutable ${request.manifest.id}@${request.manifest.version}`,
    requested.length === 0 ? "request no capabilities" : `request capabilities without granting: ${requested.join(",")}`,
    "activation remains separate",
  ];
  if (report.verdict === "QUARANTINE") return {
    recommendation: "REJECT", route: "QUARANTINE", rationale: report.findings.map((item) => item.code), impacts,
    installAuthorized: false, activationAuthorized: false, grantedCapabilities: [],
  };
  if (unadmitted.length > 0) return {
    recommendation: "REJECT", route: "DENY", rationale: unadmitted.map((id) => `SKILL_CAPABILITY_NOT_ADMITTED:${id}`), impacts,
    installAuthorized: false, activationAuthorized: false, grantedCapabilities: [],
  };
  const lowRiskReadOnly = report.verdict === "ACCEPTABLE" && requested.length === 0;
  const hasHighRiskFinding = report.findings.some((item) => item.severity === "HIGH" || item.severity === "CRITICAL");
  const auto = profile === "RAMPAGE"
    ? policy.rampage.ownerAllowsAutoExecution && !hasHighRiskFinding
    : profile === "CUSTOM"
      ? policy.custom.autoApproveLowRiskReadOnly && lowRiskReadOnly
      : lowRiskReadOnly;
  return {
    recommendation: auto ? "ADMIT" : "REVIEW",
    route: auto ? "AUTO_ALLOW" : "OWNER_CONFIRM",
    rationale: auto ? [`${profile}_OWNER_MATRIX_AUTO_ADMISSION`] : [`${profile}_OWNER_CONFIRMATION_REQUIRED`],
    impacts,
    installAuthorized: auto,
    activationAuthorized: false,
    grantedCapabilities: [],
  };
}

export function materializeSkillV1(
  request: CanonicalSkillAdmissionRequestV1,
  target: SkillRuntimeTargetV1,
): SkillMaterializationV1 {
  const packageDigest = computeSkillPackageDigestV1(request);
  if (target !== "OPENCLAW") {
    return {
      target,
      outcome: "UNPROVEN",
      packageDigest,
      files: [],
      issues: [`${target}_PINNED_FORMAT_AND_RUNTIME_UNPROVEN`],
    };
  }
  return {
    target,
    outcome: "MATERIALIZED",
    packageDigest,
    files: request.files.map((file) => ({ path: file.path, content: file.content, digest: file.digest })),
    issues: [],
  };
}

function deniedDecision(issue: string, route: SkillRouteV1 = "DENY"): SkillDecisionV1 {
  return { recommendation: "REJECT", route, rationale: [issue], impacts: [], installAuthorized: false, activationAuthorized: false, grantedCapabilities: [] };
}

export class ManagedSkillStoreV1 {
  readonly #generations = new Map<string, StoreGenerationV1>();
  readonly #history = new Map<string, Map<number, StoreGenerationV1>>();

  #record(tenant: string, state: StoreGenerationV1): void {
    const history = this.#history.get(tenant) ?? new Map<number, StoreGenerationV1>();
    history.set(state.generation, { generation: state.generation, skills: new Map(state.skills) });
    this.#history.set(tenant, history);
    this.#generations.set(tenant, state);
  }

  snapshot(tenant: string): { readonly generation: number; readonly skills: readonly InstalledSkillV1[] } {
    const state = this.#generations.get(tenant) ?? { generation: 0, skills: new Map<string, InstalledSkillV1>() };
    return { generation: state.generation, skills: [...state.skills.values()].sort((a, b) => a.id.localeCompare(b.id)) };
  }

  commitInstall(tenant: string, skill: InstalledSkillV1): { readonly before: number; readonly after: number } {
    const state = this.#generations.get(tenant) ?? { generation: 0, skills: new Map<string, InstalledSkillV1>() };
    this.#record(tenant, state);
    const next = new Map(state.skills);
    next.set(skill.id, skill);
    this.#record(tenant, { generation: state.generation + 1, skills: next });
    return { before: state.generation, after: state.generation + 1 };
  }

  setActive(tenant: string, skillId: string, active: boolean): { readonly before: StoreGenerationV1; readonly after: number } | null {
    const state = this.#generations.get(tenant);
    const skill = state?.skills.get(skillId);
    if (!state || !skill) return null;
    const next = new Map(state.skills);
    next.set(skillId, { ...skill, active });
    this.#record(tenant, { generation: state.generation + 1, skills: next });
    return { before: state, after: state.generation + 1 };
  }

  restore(tenant: string, prior: StoreGenerationV1): number {
    const current = this.#generations.get(tenant)?.generation ?? 0;
    this.#record(tenant, { generation: current + 1, skills: new Map(prior.skills) });
    return current + 1;
  }

  restorePrevious(tenant: string): { readonly before: number; readonly after: number } | null {
    const current = this.#generations.get(tenant);
    const prior = current === undefined ? undefined : this.#history.get(tenant)?.get(current.generation - 1);
    if (!current || !prior) return null;
    const after = this.restore(tenant, prior);
    return { before: current.generation, after };
  }
}

export class SkillLifecycleBrokerV1 {
  readonly #busy = new Set<string>();
  readonly #receipts = new Map<string, { readonly requestDigest: string; readonly result: SkillLifecycleResultV1 }>();

  constructor(
    readonly policy: SkillAdmissionPolicyV1,
    readonly store = new ManagedSkillStoreV1(),
  ) {}

  async install(
    value: unknown,
    profile: SkillProfileV1,
    ownerDecision?: SkillOwnerDecisionV1,
    beforeCommit?: () => Promise<void>,
  ): Promise<SkillLifecycleResultV1> {
    const validated = validateSkillAdmissionRequestV1(value);
    const candidate = value as Partial<CanonicalSkillAdmissionRequestV1>;
    const operationId = typeof candidate.operationId === "string" ? candidate.operationId : "operation:invalid";
    const tenant = typeof candidate.tenant === "string" ? candidate.tenant : "tenant:invalid";
    const requestDigest = digest(value);
    const existing = this.#receipts.get(operationId);
    if (existing) {
      if (existing.requestDigest === requestDigest) return { ...existing.result, replay: "SAME_RECEIPT" };
      return this.#deny(operationId, tenant, requestDigest, "0".repeat(64), "SKILL_REPLAY_CONFLICT_DENIED");
    }
    if (validated.outcome === "DENY") return this.#deny(operationId, tenant, requestDigest, "0".repeat(64), validated.issues[0] ?? "SKILL_DENIED");
    const { request, packageDigest } = validated;
    if (this.#busy.has(request.tenant)) return this.#deny(request.operationId, request.tenant, validated.requestDigest, packageDigest, "SKILL_CONCURRENT_INSTALL_THROTTLED", "OWNER_CONFIRM", "THROTTLED");
    this.#busy.add(request.tenant);
    try {
      const report = analyseSkillAdmissionV1(request, this.policy);
      let decision = decideSkillAdmissionV1(request, report, profile, this.policy);
      if (decision.route === "OWNER_CONFIRM") {
        const validOwner = ownerDecision?.decision === "APPROVE_INSTALL"
          && /^owner:[a-z0-9][a-z0-9._-]{2,63}$/.test(ownerDecision.approvedBy)
          && ownerDecision.tenant === request.tenant
          && ownerDecision.requestDigest === report.requestDigest
          && ownerDecision.packageDigest === report.packageDigest;
        if (!validOwner) return this.#deny(request.operationId, request.tenant, report.requestDigest, report.packageDigest, "SKILL_OWNER_DECISION_REQUIRED", "OWNER_CONFIRM");
        decision = { ...decision, recommendation: "ADMIT", installAuthorized: true, rationale: [...decision.rationale, "DIGEST_BOUND_OWNER_INSTALL_APPROVAL"] };
      }
      if (!decision.installAuthorized) return this.#deny(request.operationId, request.tenant, report.requestDigest, report.packageDigest, decision.rationale[0] ?? "SKILL_DENIED", decision.route, report.verdict === "QUARANTINE" ? "QUARANTINED" : "DENIED", report, decision);
      await beforeCommit?.();
      const generation = this.store.commitInstall(request.tenant, {
        id: request.manifest.id,
        version: request.manifest.version,
        packageDigest,
        format: request.manifest.format,
        installed: true,
        active: false,
        requestedCapabilities: request.manifest.requestedCapabilities.map((item) => item.id),
        grantedCapabilities: [],
        capabilityLimited: request.manifest.requestedCapabilities.length > 0,
      });
      const receipt: SkillLifecycleReceiptV1 = {
        schemaVersion: SKILL_RECEIPT_SCHEMA_V1, operationId: request.operationId, tenant: request.tenant,
        action: "INSTALL", outcome: "COMMITTED", requestDigest: report.requestDigest, packageDigest,
        generationBefore: generation.before, generationAfter: generation.after, route: decision.route, issues: [],
      };
      const result: SkillLifecycleResultV1 = { outcome: "COMMITTED", decision, report, receipt, replay: "FIRST" };
      this.#receipts.set(request.operationId, { requestDigest: report.requestDigest, result });
      return result;
    } finally {
      this.#busy.delete(request.tenant);
    }
  }

  async activate(
    tenant: string,
    skillId: string,
    operationId: string,
    activationProbe: (skill: InstalledSkillV1) => Promise<boolean>,
  ): Promise<SkillLifecycleReceiptV1> {
    const snapshot = this.store.snapshot(tenant);
    const skill = snapshot.skills.find((item) => item.id === skillId);
    if (!skill || !validId(operationId, "operation")) return this.#simpleReceipt(operationId, tenant, "ACTIVATE", "DENIED", snapshot.generation, snapshot.generation, "0".repeat(64), "SKILL_ACTIVATION_TARGET_DENIED");
    const changed = this.store.setActive(tenant, skillId, true);
    if (!changed) return this.#simpleReceipt(operationId, tenant, "ACTIVATE", "DENIED", snapshot.generation, snapshot.generation, skill.packageDigest, "SKILL_ACTIVATION_TARGET_DENIED");
    if (!await activationProbe({ ...skill, active: true })) {
      const restored = this.store.restore(tenant, changed.before);
      return this.#simpleReceipt(operationId, tenant, "ROLLBACK", "ROLLED_BACK", changed.after, restored, skill.packageDigest, "SKILL_ACTIVATION_FAILED_ROLLED_BACK");
    }
    return this.#simpleReceipt(operationId, tenant, "ACTIVATE", "COMMITTED", snapshot.generation, changed.after, skill.packageDigest);
  }

  rollback(tenant: string, skillId: string, operationId: string): SkillLifecycleReceiptV1 {
    const snapshot = this.store.snapshot(tenant);
    const skill = snapshot.skills.find((item) => item.id === skillId);
    if (!skill) return this.#simpleReceipt(operationId, tenant, "ROLLBACK", "DENIED", snapshot.generation, snapshot.generation, "0".repeat(64), "SKILL_ROLLBACK_TARGET_DENIED");
    const restored = this.store.restorePrevious(tenant);
    if (!restored) return this.#simpleReceipt(operationId, tenant, "ROLLBACK", "DENIED", snapshot.generation, snapshot.generation, skill.packageDigest, "SKILL_PRIOR_GENERATION_NOT_FOUND");
    return this.#simpleReceipt(operationId, tenant, "ROLLBACK", "ROLLED_BACK", restored.before, restored.after, skill.packageDigest);
  }

  #deny(
    operationId: string, tenant: string, requestDigest: string, packageDigest: string, issue: string,
    route: SkillRouteV1 = "DENY", outcome: SkillLifecycleReceiptV1["outcome"] = "DENIED",
    report: SkillRiskReportV1 | null = null, decision = deniedDecision(issue, route),
  ): SkillLifecycleResultV1 {
    const generation = this.store.snapshot(tenant).generation;
    return {
      outcome, decision, report, replay: "NONE",
      receipt: this.#simpleReceipt(operationId, tenant, "DENY", outcome, generation, generation, packageDigest, issue, requestDigest, route),
    };
  }

  #simpleReceipt(
    operationId: string, tenant: string, action: SkillLifecycleReceiptV1["action"], outcome: SkillLifecycleReceiptV1["outcome"],
    before: number, after: number, packageDigest: string, issue?: string, requestDigest = "0".repeat(64), route: SkillRouteV1 = "AUTO_ALLOW",
  ): SkillLifecycleReceiptV1 {
    return {
      schemaVersion: SKILL_RECEIPT_SCHEMA_V1, operationId, tenant, action, outcome,
      requestDigest, packageDigest, generationBefore: before, generationAfter: after, route,
      issues: issue ? [issue] : [],
    };
  }
}

export function syntheticSkillPolicyV1(): SkillAdmissionPolicyV1 {
  return {
    tenant: "tenant:panskys-zoo",
    requesterIds: ["workload:openclaw-agent"],
    publishers: ["publisher:chimpmaera-fixture"],
    registeredCapabilities: {
      "capability:documents.read": ["documents:read"],
      "capability:contacts.write": ["contacts:read", "contacts:write"],
      "capability:authority.admin": ["authority:owner", "tenant:*"]
    },
    custom: { autoApproveLowRiskReadOnly: false, admittedCapabilities: ["capability:documents.read"] },
    rampage: { ownerAllowsAutoExecution: true, admittedCapabilities: ["capability:documents.read", "capability:contacts.write"] },
  };
}

export function syntheticSkillRequestV1(overrides: {
  readonly capabilities?: readonly SkillCapabilityRequestV1[];
  readonly files?: readonly Omit<SkillPackageFileV1, "digest">[];
  readonly access?: Partial<SkillAccessDeclarationV1>;
  readonly operationId?: string;
} = {}): CanonicalSkillAdmissionRequestV1 {
  const files = (overrides.files ?? [{ path: "SKILL.md", kind: "FILE", mediaType: "text/markdown", content: "# Zoo Greeter\n\nReturn the deterministic greeting `Hello from the Zoo`.\n" }])
    .map((file) => ({ ...file, digest: sha256(file.content) }));
  const manifest: CanonicalSkillManifestV1 = {
    schemaVersion: SKILL_MANIFEST_SCHEMA_V1,
    id: "skill:zoo-greeter",
    version: "1.0.0",
    format: "OPENCLAW_SKILL",
    entrypoint: "SKILL.md",
    displayName: "Zoo Greeter",
    licence: "Apache-2.0",
    provenance: { publisher: "publisher:chimpmaera-fixture", source: "local:fixtures/zoo-greeter-1.0.0" },
    access: { filesystem: false, installScripts: [], network: false, persistence: false, process: false, secrets: false, ...overrides.access },
    dependencies: [],
    requestedCapabilities: overrides.capabilities ?? [],
    tools: [],
  };
  const digestValue = computeSkillPackageDigestV1({ manifest, files });
  return {
    schemaVersion: SKILL_ADMISSION_SCHEMA_V1,
    operationId: overrides.operationId ?? "operation:skill-0001",
    correlationId: "correlation:skill-0001",
    tenant: "tenant:panskys-zoo",
    requester: "workload:openclaw-agent",
    source: { kind: "LOCAL_CONTENT", locator: `skill+sha256:${digestValue}`, version: "1.0.0", digest: digestValue, mutable: false },
    manifest,
    files,
  };
}
