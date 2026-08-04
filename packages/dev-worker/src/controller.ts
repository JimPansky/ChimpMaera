import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix, resolve, sep } from "node:path";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { canonicalJson } from "../../contracts/src/canonical-json.js";
import {
  DEVELOPMENT_WORKER_PROFILE_SCHEMA_V1,
  WORK_ORDER_SCHEMA_V1,
  WORK_RECEIPT_SCHEMA_V1,
  type DevelopmentWorkerProfileV1,
  type DevBudgetV1,
  type DevCapabilityV1,
  type WorkOrderV1,
  type WorkReceiptV1,
} from "../../contracts/src/development-worker.js";

export const SYNTHETIC_NOW = "2026-08-04T08:00:00.000Z";
export const SYNTHETIC_PROJECT = Object.freeze({
  id: "gitlab-project:chimpmaera-fixture",
  repository: "JimPansky/ChimpMaera-fixture",
  issueIid: 117,
  baseRef: "main",
  baseCommit: "1171171171171171171171171171171171171171",
  issue: {
    title: "Clarify the synthetic fixture status",
    body: "Change docs/fixture-status.md from pending to verified. Do not change any other path or request publication.",
    revision: 1,
  },
  files: { "docs/fixture-status.md": "Synthetic fixture status: pending.\n" },
});

export const SERVER_BUDGET: DevBudgetV1 = Object.freeze({
  maxInputTokens: 256,
  maxOutputTokens: 128,
  maxCostMicros: 1000,
  maxRequests: 1,
  timeoutMs: 2000,
  maxPatchBytes: 2048,
});

export const PROVIDER_POLICY_DIGEST = sha256({
  alias: "cm.dev.fast",
  provider: "synthetic-openai-compatible",
  model: "fixture-model-v1",
  externalNetwork: false,
  budget: SERVER_BUDGET,
});
export const OPENCODE_ARTIFACT_DIGEST = sha256("anomalyco/opencode:v1.18.12@729a6eda23a431a287aed28307e248ec3561cb1b");

const allowedCapabilities: readonly DevCapabilityV1[] = [
  "cm.dev.issue.read",
  "cm.dev.repository.snapshot.read",
  "cm.dev.model.invoke",
  "cm.dev.test.run",
  "cm.dev.evidence.read",
];
const forbiddenAuthority = ["MERGE", "MARK_READY", "FORCE_PUSH", "BRANCH_DELETE", "PROJECT_ADMIN", "TOKEN_CREATE", "TAG", "RELEASE", "DEPLOY"] as const;
const credentialPattern = /(?:sk-[A-Za-z0-9_-]{12,}|glpat-[A-Za-z0-9_-]{12,}|github_pat_[A-Za-z0-9_]{12,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:password|api[_-]?key|access[_-]?token|authorization)\s*[:=]\s*\S{8,})/i;
const wideningPattern = /(?:ignore (?:all )?(?:previous|system) instructions|widen (?:the )?scope|enable (?:network|web|search)|merge (?:this|the)|create (?:a )?(?:tag|release)|access (?:another|other) (?:project|repository))/i;

export class DevWorkerDenied extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

interface CandidateChange {
  readonly path: string;
  readonly content: string;
  readonly kind: "file" | "symlink";
}

export interface SyntheticModelResponse {
  readonly alias: "cm.dev.fast";
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costMicros: number;
  readonly changes: readonly CandidateChange[];
}

export class SyntheticGitLabAdapter {
  readIssue(projectId: string, issueIid: number): typeof SYNTHETIC_PROJECT.issue {
    if (projectId !== SYNTHETIC_PROJECT.id) throw new DevWorkerDenied("CROSS_PROJECT_DENIED");
    if (issueIid !== SYNTHETIC_PROJECT.issueIid) throw new DevWorkerDenied("STALE_ISSUE_DENIED");
    return SYNTHETIC_PROJECT.issue;
  }

  readRepositorySnapshot(projectId: string, commit: string): typeof SYNTHETIC_PROJECT.files {
    if (projectId !== SYNTHETIC_PROJECT.id) throw new DevWorkerDenied("CROSS_PROJECT_DENIED");
    if (commit !== SYNTHETIC_PROJECT.baseCommit) throw new DevWorkerDenied("STALE_BASE_DENIED");
    return SYNTHETIC_PROJECT.files;
  }
}

export interface SyntheticOpenAiChatCompletion {
  readonly id: "chatcmpl-synthetic-m0";
  readonly object: "chat.completion";
  readonly model: "cm.dev.fast";
  readonly choices: readonly [{ readonly index: 0; readonly finish_reason: "stop"; readonly message: { readonly role: "assistant"; readonly content: string } }];
  readonly usage: { readonly prompt_tokens: 64; readonly completion_tokens: 32; readonly total_tokens: 96 };
}

interface Validators {
  readonly profile: ValidateFunction;
  readonly order: ValidateFunction;
  readonly receipt: ValidateFunction;
}

let validators: Validators | undefined;

function schemas(): Validators {
  if (validators) return validators;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const load = (name: string): object => JSON.parse(readFileSync(join(process.cwd(), "schemas", name), "utf8")) as object;
  validators = {
    profile: ajv.compile(load("development-worker-profile-v1.schema.json")),
    order: ajv.compile(load("work-order-v1.schema.json")),
    receipt: ajv.compile(load("work-receipt-v1.schema.json")),
  };
  return validators;
}

export function sha256(value: unknown): string {
  const input = typeof value === "string" ? value : canonicalJson(value);
  return createHash("sha256").update(input).digest("hex");
}

function digestBound<T extends Record<string, unknown>>(value: T, digestKey: keyof T): string {
  const copy = { ...value };
  delete copy[digestKey];
  return sha256(copy);
}

function opencodeConfigDigest(): string {
  return sha256(readFileSync(join(process.cwd(), "demo/dev-worker/opencode-adapter-v1.json"), "utf8"));
}

export function syntheticProfile(): DevelopmentWorkerProfileV1 {
  return {
    schemaVersion: DEVELOPMENT_WORKER_PROFILE_SCHEMA_V1,
    profileId: "profile:synthetic-m0",
    enabled: false,
    dataClass: "PUBLIC_OSS",
    workloadIdentity: "workload:cm-dev-worker-synthetic",
    capabilities: allowedCapabilities,
    modelAliases: ["cm.dev.fast"],
    isolation: { network: "DENY_EXCEPT_INTERNAL_FRONTDOOR", hostHome: false, dockerSocket: false, externalDirectories: false },
    harness: {
      adapter: "opencode",
      version: "1.18.12",
      artifactDigest: OPENCODE_ARTIFACT_DIGEST,
      configDigest: opencodeConfigDigest(),
      securityBoundary: false,
    },
  };
}

export function syntheticWorkOrder(): WorkOrderV1 {
  const unsigned = {
    schemaVersion: WORK_ORDER_SCHEMA_V1,
    orderId: "order:synthetic-117-m0",
    workloadIdentity: "workload:cm-dev-worker-synthetic",
    project: { id: SYNTHETIC_PROJECT.id, repository: SYNTHETIC_PROJECT.repository },
    issue: { iid: SYNTHETIC_PROJECT.issueIid, snapshotDigest: sha256(SYNTHETIC_PROJECT.issue) },
    base: { ref: SYNTHETIC_PROJECT.baseRef, commit: SYNTHETIC_PROJECT.baseCommit },
    paths: { allowed: ["docs/fixture-status.md"], denied: [".github/**", ".gitlab/**", "security/**", "release/**", "gateway/**", "scripts/**"] },
    acceptanceCriteria: ["The admitted fixture status is exactly verified."],
    nonScope: ["No publication, merge, release, network, dependency, or non-fixture change."],
    risk: "LOW" as const,
    dataClass: "PUBLIC_OSS" as const,
    artifacts: { toolchainDigest: "2".repeat(64), harnessDigest: OPENCODE_ARTIFACT_DIGEST, workerDigest: "3".repeat(64) },
    model: { aliases: ["cm.dev.fast" as const], providerPolicyDigest: PROVIDER_POLICY_DIGEST },
    budget: SERVER_BUDGET,
    testProfile: { commands: ["synthetic:test:fixture-status"] },
    lease: { id: "lease:synthetic-117-m0", capabilities: allowedCapabilities, expiresAt: "2026-08-04T08:05:00.000Z" },
    publication: { mode: "NONE" as const, allowed: [], denied: [...forbiddenAuthority] },
    expiresAt: "2026-08-04T08:05:00.000Z",
  };
  return { ...unsigned, workOrderDigest: sha256(unsigned) };
}

export function syntheticOpenAiCompatibleCompletion(order: WorkOrderV1): SyntheticOpenAiChatCompletion {
  if (order.model.aliases.length !== 1 || order.model.aliases[0] !== "cm.dev.fast" || order.model.providerPolicyDigest !== PROVIDER_POLICY_DIGEST) {
    throw new DevWorkerDenied("MODEL_ROUTE_NOT_SERVER_BOUND");
  }
  const proposal: SyntheticModelResponse = {
    alias: "cm.dev.fast", inputTokens: 64, outputTokens: 32, costMicros: 250,
    changes: [{ path: "docs/fixture-status.md", content: "Synthetic fixture status: verified.\n", kind: "file" }],
  };
  return {
    id: "chatcmpl-synthetic-m0", object: "chat.completion", model: "cm.dev.fast",
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: canonicalJson(proposal) } }],
    usage: { prompt_tokens: 64, completion_tokens: 32, total_tokens: 96 },
  };
}

export function syntheticModelRoute(order: WorkOrderV1): SyntheticModelResponse {
  const completion = syntheticOpenAiCompatibleCompletion(order);
  return JSON.parse(completion.choices[0].message.content) as SyntheticModelResponse;
}

function assertNoCredentials(value: unknown): void {
  if (credentialPattern.test(canonicalJson(value))) throw new DevWorkerDenied("CREDENTIAL_SHAPED_INPUT_DENIED");
}

function pathMatches(pattern: string, path: string): boolean {
  return pattern.endsWith("/**") ? path === pattern.slice(0, -3) || path.startsWith(pattern.slice(0, -2)) : path === pattern;
}

function assertSafePath(path: string, order: WorkOrderV1): void {
  if (path.length === 0 || path.length > 240 || path.startsWith("/") || path.includes("\\") || path.includes("\0") || posix.normalize(path) !== path || path.split("/").includes("..")) {
    throw new DevWorkerDenied("PATH_TRAVERSAL_DENIED");
  }
  if (order.paths.denied.some((entry) => pathMatches(entry, path))) throw new DevWorkerDenied("PROTECTED_PATH_DENIED");
  if (!order.paths.allowed.some((entry) => pathMatches(entry, path))) throw new DevWorkerDenied("UNEXPECTED_PATH_DENIED");
}

function assertBindings(profile: unknown, order: unknown, now: string): asserts order is WorkOrderV1 {
  const checked = schemas();
  if (!checked.profile(profile)) throw new DevWorkerDenied("PROFILE_SCHEMA_DENIED");
  if (!checked.order(order)) throw new DevWorkerDenied("WORK_ORDER_SCHEMA_DENIED");
  const bound = order as WorkOrderV1;
  const gitlab = new SyntheticGitLabAdapter();
  if (digestBound(bound as unknown as Record<string, unknown>, "workOrderDigest") !== bound.workOrderDigest) throw new DevWorkerDenied("WORK_ORDER_DIGEST_MISMATCH");
  if (bound.workloadIdentity !== (profile as DevelopmentWorkerProfileV1).workloadIdentity) throw new DevWorkerDenied("WRONG_WORKLOAD_DENIED");
  if (bound.project.id !== SYNTHETIC_PROJECT.id || bound.project.repository !== SYNTHETIC_PROJECT.repository) throw new DevWorkerDenied("CROSS_PROJECT_DENIED");
  if (bound.issue.snapshotDigest !== sha256(gitlab.readIssue(bound.project.id, bound.issue.iid))) throw new DevWorkerDenied("STALE_ISSUE_DENIED");
  if (bound.base.ref !== SYNTHETIC_PROJECT.baseRef) throw new DevWorkerDenied("STALE_BASE_DENIED");
  gitlab.readRepositorySnapshot(bound.project.id, bound.base.commit);
  if (Date.parse(now) >= Date.parse(bound.expiresAt) || Date.parse(now) >= Date.parse(bound.lease.expiresAt)) throw new DevWorkerDenied("EXPIRED_LEASE_DENIED");
  if (canonicalJson(bound.budget) !== canonicalJson(SERVER_BUDGET)) throw new DevWorkerDenied("BUDGET_NOT_SERVER_BOUND");
  if (canonicalJson(bound.lease.capabilities) !== canonicalJson(allowedCapabilities)) throw new DevWorkerDenied("CAPABILITY_SCOPE_DENIED");
  if (bound.publication.mode !== "NONE" || bound.publication.allowed.length !== 0 || !forbiddenAuthority.every((item) => bound.publication.denied.includes(item))) throw new DevWorkerDenied("PUBLICATION_AUTHORITY_DENIED");
  assertNoCredentials(bound);
}

function assertModelResponse(response: SyntheticModelResponse, order: WorkOrderV1): void {
  if (canonicalJson(Object.keys(response).sort()) !== canonicalJson(["alias", "changes", "costMicros", "inputTokens", "outputTokens"])) throw new DevWorkerDenied("MODEL_RESPONSE_SCHEMA_DENIED");
  if (response.alias !== "cm.dev.fast" || response.changes.length !== 1) throw new DevWorkerDenied("MODEL_RESPONSE_SCOPE_DENIED");
  if (response.inputTokens > order.budget.maxInputTokens || response.outputTokens > order.budget.maxOutputTokens || response.costMicros > order.budget.maxCostMicros || order.budget.maxRequests < 1) throw new DevWorkerDenied("MODEL_BUDGET_EXCEEDED");
  assertNoCredentials(response);
  for (const change of response.changes) {
    if (canonicalJson(Object.keys(change).sort()) !== canonicalJson(["content", "kind", "path"])) throw new DevWorkerDenied("MODEL_RESPONSE_SCHEMA_DENIED");
    assertSafePath(change.path, order);
    if (change.kind !== "file") throw new DevWorkerDenied("SYMLINK_DENIED");
    if (change.content.includes("\0")) throw new DevWorkerDenied("BINARY_PATCH_DENIED");
    if (Buffer.byteLength(change.content) > order.budget.maxPatchBytes) throw new DevWorkerDenied("PATCH_BUDGET_EXCEEDED");
    if (wideningPattern.test(change.content)) throw new DevWorkerDenied("PROMPT_INJECTION_SCOPE_WIDENING_DENIED");
  }
}

export interface RunOptions {
  readonly profile?: unknown;
  readonly order?: unknown;
  readonly now?: string;
  readonly model?: (order: WorkOrderV1) => SyntheticModelResponse;
}

export function runSyntheticDevelopmentWorker(options: RunOptions = {}): WorkReceiptV1 {
  const profile = options.profile ?? syntheticProfile();
  const orderValue = options.order ?? syntheticWorkOrder();
  const now = options.now ?? SYNTHETIC_NOW;
  assertBindings(profile, orderValue, now);
  const order = orderValue;
  const workspace = mkdtempSync(join(tmpdir(), "cm-dev-worker-"));
  try {
    const projection = new SyntheticGitLabAdapter().readRepositorySnapshot(order.project.id, order.base.commit);
    for (const [path, content] of Object.entries(projection)) {
      assertSafePath(path, order);
      const target = resolve(workspace, path);
      if (!target.startsWith(`${workspace}${sep}`)) throw new DevWorkerDenied("PATH_TRAVERSAL_DENIED");
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, { encoding: "utf8", mode: 0o600 });
      if (lstatSync(target).isSymbolicLink()) throw new DevWorkerDenied("SYMLINK_DENIED");
    }

    const model = (options.model ?? syntheticModelRoute)(order);
    assertModelResponse(model, order);
    for (const change of model.changes) writeFileSync(resolve(workspace, change.path), change.content, { encoding: "utf8", mode: 0o600 });

    const changedPaths = model.changes.map((item) => item.path).sort();
    const finalContent = readFileSync(join(workspace, "docs/fixture-status.md"), "utf8");
    const testOutput = finalContent === "Synthetic fixture status: verified.\n" ? "PASS:fixture-status" : "FAIL:fixture-status";
    if (!testOutput.startsWith("PASS:")) throw new DevWorkerDenied("ALLOWLISTED_TEST_FAILED");
    const patch = canonicalJson(model.changes.map(({ path, content }) => ({ path, before: SYNTHETIC_PROJECT.files[path as keyof typeof SYNTHETIC_PROJECT.files] ?? null, after: content })));
    const unsigned = {
      schemaVersion: WORK_RECEIPT_SCHEMA_V1,
      workOrderDigest: order.workOrderDigest,
      outcome: "SUCCEEDED" as const,
      baseCommit: order.base.commit,
      candidateCommit: null,
      changedPaths,
      changedPathsDigest: sha256(changedPaths),
      patchDigest: sha256(patch),
      tests: [{ command: "synthetic:test:fixture-status", outcome: "PASS" as const, outputDigest: sha256(testOutput) }],
      review: { outcome: "PASS" as const, findings: [] },
      modelUsage: { alias: model.alias, providerPolicyDigest: order.model.providerPolicyDigest, requests: 1, inputTokens: model.inputTokens, outputTokens: model.outputTokens, costMicros: model.costMicros },
      capabilityUsage: allowedCapabilities,
      publication: { performed: false as const, identifiers: [] },
      readback: { synthetic: true as const, digest: sha256({ changedPaths, finalContent }) },
      cleanup: { outcome: "PASS" as const, writableStateRemaining: false as const },
      nonClaims: ["No real GitLab, model-provider, network, publication, merge, release, deployment, or production-isolation claim."],
    };
    const receipt: WorkReceiptV1 = { ...unsigned, receiptDigest: sha256(unsigned) };
    if (!schemas().receipt(receipt)) throw new DevWorkerDenied("WORK_RECEIPT_SCHEMA_DENIED");
    return receipt;
  } finally {
    rmSync(workspace, { recursive: true, force: true });
    if (existsSync(workspace)) throw new DevWorkerDenied("CLEANUP_FAILED");
  }
}

export function validateReceiptDigest(receipt: WorkReceiptV1): boolean {
  return schemas().receipt(receipt) && digestBound(receipt as unknown as Record<string, unknown>, "receiptDigest") === receipt.receiptDigest;
}
