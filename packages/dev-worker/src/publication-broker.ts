import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { canonicalJson } from "../../contracts/src/canonical-json.js";
import {
  PUBLICATION_BROKER_READBACK_SCHEMA_V1, PUBLICATION_BROKER_RECEIPT_SCHEMA_V1,
  PUBLICATION_BROKER_REQUEST_SCHEMA_V1, type PublicationBrokerReadbackV1,
  type PublicationBrokerReceiptV1, type PublicationBrokerRequestV1, type WorkOrderV1,
} from "../../contracts/src/development-worker.js";

export class PublicationBrokerDenied extends Error {
  constructor(readonly code: string) { super(code); }
}

const credentialPattern = /(?:sk-[A-Za-z0-9_-]{12,}|glpat-[A-Za-z0-9_-]{12,}|github_pat_[A-Za-z0-9_]{12,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:password|api[_-]?key|access[_-]?token|authorization|credential|secret)\s*[:=]\s*\S{8,})/i;
const forbiddenAuthorityPattern = /(?:merge\b|mark.?ready|force.?push|branch.?delete|tag\b|release\b|deploy\b|project.?admin|runner|variable|registry|token.?create)/i;
const effects = ["CREATE_WORKER_BRANCH", "PUSH_BOUNDED_PATCH", "CREATE_DRAFT_MR"] as const;

function digest(value: unknown): string { return createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex"); }
function boundDigest(value: Record<string, unknown>, key: string): string { const copy = { ...value }; delete copy[key]; return digest(copy); }
function safe(value: unknown): boolean { return !credentialPattern.test(canonicalJson(value)); }
function validateDigest(value: unknown, key: string): boolean { return typeof value === "object" && value !== null && boundDigest(value as Record<string, unknown>, key) === (value as Record<string, unknown>)[key]; }

let requestValidator: ValidateFunction | undefined;
let readbackValidator: ValidateFunction | undefined;
let receiptValidator: ValidateFunction | undefined;
function validators(): readonly [ValidateFunction, ValidateFunction, ValidateFunction] {
  if (!requestValidator) {
    const ajv = new Ajv2020({ allErrors: true, strict: true }); addFormats(ajv);
    const load = (name: string): object => JSON.parse(readFileSync(join(process.cwd(), "schemas", name), "utf8")) as object;
    requestValidator = ajv.compile(load("publication-broker-request-v1.schema.json"));
    readbackValidator = ajv.compile(load("publication-broker-readback-v1.schema.json"));
    receiptValidator = ajv.compile(load("publication-broker-receipt-v1.schema.json"));
  }
  return [requestValidator, readbackValidator!, receiptValidator!];
}

export interface TrustedPublicationPolicyV1 {
  readonly enabled: boolean;
  readonly project: { readonly id: string; readonly repository: string };
  readonly issueIid: number;
  readonly baseRef: string;
  readonly baseCommit: string;
  readonly allowedPaths: readonly string[];
  readonly deniedPaths: readonly string[];
  readonly branchPrefix: string;
}

export interface GitLabPublicationAdapterV1 {
  branchExists(projectId: string, branch: string): boolean;
  createBranch(projectId: string, branch: string, baseCommit: string): void;
  pushPatch(projectId: string, branch: string, baseCommit: string, patchDigest: string, paths: readonly string[]): string;
  createDraftMergeRequest(projectId: string, source: string, target: string, title: string, description: string): number;
  readback(projectId: string, branch: string, mrIid: number): unknown;
  cleanup(projectId: string, branch: string, mrIid?: number): void;
  ownedStateRemaining(projectId: string, branch: string, mrIid?: number): boolean;
}

type FakeBranch = { base: string; head: string; patchDigest: string; paths: readonly string[] };
type FakeMr = { iid: number; source: string; target: string; title: string; description: string; draft: boolean; state: "OPEN" };
export class FakeGitLabPublicationAdapterV1 implements GitLabPublicationAdapterV1 {
  readonly calls: string[] = [];
  readonly branches = new Map<string, FakeBranch>();
  readonly mergeRequests = new Map<number, FakeMr>();
  failAt?: "PUSH" | "MR" | "READBACK";
  readbackMutation?: (value: PublicationBrokerReadbackV1) => unknown;
  cleanupFailure = false;
  private nextIid = 117;
  branchExists(_projectId: string, branch: string): boolean { this.calls.push("BRANCH_EXISTS"); return this.branches.has(branch); }
  createBranch(_projectId: string, branch: string, baseCommit: string): void { this.calls.push("CREATE_BRANCH"); this.branches.set(branch, { base: baseCommit, head: baseCommit, patchDigest: digest([]), paths: [] }); }
  pushPatch(_projectId: string, branch: string, baseCommit: string, patchDigest: string, paths: readonly string[]): string {
    this.calls.push("PUSH_PATCH"); if (this.failAt === "PUSH") throw new Error("fake push failure");
    const current = this.branches.get(branch); if (!current || current.base !== baseCommit) throw new Error("fake branch mismatch");
    const head = digest({ branch, baseCommit, patchDigest }).slice(0, 40); this.branches.set(branch, { base: baseCommit, head, patchDigest, paths: [...paths] }); return head;
  }
  createDraftMergeRequest(_projectId: string, source: string, target: string, title: string, description: string): number {
    this.calls.push("CREATE_DRAFT_MR"); if (this.failAt === "MR") throw new Error("fake mr failure");
    const iid = this.nextIid++; this.mergeRequests.set(iid, { iid, source, target, title, description, draft: true, state: "OPEN" }); return iid;
  }
  readback(projectId: string, branch: string, mrIid: number): unknown {
    this.calls.push("READBACK"); if (this.failAt === "READBACK") throw new Error("fake readback failure");
    const b = this.branches.get(branch); const mr = this.mergeRequests.get(mrIid); if (!b || !mr) throw new Error("fake missing state");
    const unsigned = { schemaVersion: PUBLICATION_BROKER_READBACK_SCHEMA_V1, provider: "GITLAB_COMPATIBLE_FAKE" as const, projectId,
      branch: { name: branch, baseCommit: b.base, headCommit: b.head, protected: false as const },
      mergeRequest: { iid: mr.iid, state: mr.state, draft: mr.draft as true, sourceBranch: mr.source, targetBranch: mr.target },
      commit: { changedPaths: b.paths, patchDigest: b.patchDigest }, ci: { status: "NOT_RUN" as const, sanitized: true as const, logDigest: null } };
    const value = { ...unsigned, readbackDigest: digest(unsigned) }; return this.readbackMutation ? this.readbackMutation(value) : value;
  }
  cleanup(_projectId: string, branch: string, mrIid?: number): void { this.calls.push("CLEANUP"); if (this.cleanupFailure) return; if (mrIid !== undefined) this.mergeRequests.delete(mrIid); this.branches.delete(branch); }
  ownedStateRemaining(_projectId: string, branch: string, mrIid?: number): boolean { this.calls.push("CLEANUP_READBACK"); return this.branches.has(branch) || (mrIid !== undefined && this.mergeRequests.has(mrIid)); }
}

export function publicationRequest(order: WorkOrderV1, patch: PublicationBrokerRequestV1["patch"], operationId = "publish:issue-117-m2"): PublicationBrokerRequestV1 {
  const suffix = operationId.replace(/^publish:/, "").replace(/[^a-z0-9-]/g, "-").slice(0, 32);
  const unsigned = { schemaVersion: PUBLICATION_BROKER_REQUEST_SCHEMA_V1, operationId, project: order.project, issue: order.issue,
    workOrder: { id: order.orderId, digest: order.workOrderDigest }, lease: { id: order.lease.id, expiresAt: order.lease.expiresAt }, base: order.base,
    branch: { name: `cm/dev-worker/${order.issue.iid}/${suffix}`, expectedAbsent: true as const },
    mergeRequest: { draft: true as const, title: `Draft: Issue #${order.issue.iid} worker proposal`, description: `Bound proposal for Issue #${order.issue.iid}; human review required.`, targetBranch: order.base.ref },
    patch, requestedEffects: effects, expiresAt: order.expiresAt };
  return { ...unsigned, requestDigest: digest(unsigned) };
}

export class TrustedPublicationBrokerV1 {
  private readonly replay = new Map<string, PublicationBrokerReceiptV1>();
  constructor(private readonly policy: TrustedPublicationPolicyV1, private readonly provider: GitLabPublicationAdapterV1) {}
  publish(input: unknown, order: WorkOrderV1, now: string): PublicationBrokerReceiptV1 {
    const [validateRequest, validateReadback, validateReceipt] = validators();
    if (!this.policy.enabled) throw new PublicationBrokerDenied("PUBLICATION_DISABLED_DENIED");
    if (!validateRequest(input) || !validateDigest(input, "requestDigest")) throw new PublicationBrokerDenied("REQUEST_SCHEMA_OR_DIGEST_DENIED");
    const request = input as PublicationBrokerRequestV1;
    if (!safe(request)) throw new PublicationBrokerDenied("CREDENTIAL_SHAPED_DATA_DENIED");
    const prior = this.replay.get(request.operationId);
    if (prior) {
      if (prior.requestDigest !== request.requestDigest) throw new PublicationBrokerDenied("REPLAY_CONFLICT_DENIED");
      return this.receipt({ ...prior, outcome: "REPLAYED" as const, receiptDigest: "" });
    }
    if (Date.parse(now) >= Date.parse(request.expiresAt) || Date.parse(now) >= Date.parse(request.lease.expiresAt)) throw new PublicationBrokerDenied("EXPIRED_REQUEST_OR_LEASE_DENIED");
    if (request.project.id !== this.policy.project.id || request.project.repository !== this.policy.project.repository || request.project.id !== order.project.id || request.project.repository !== order.project.repository) throw new PublicationBrokerDenied("PROJECT_BINDING_DENIED");
    if (request.issue.iid !== this.policy.issueIid || request.issue.iid !== order.issue.iid || request.issue.snapshotDigest !== order.issue.snapshotDigest) throw new PublicationBrokerDenied("ISSUE_BINDING_DENIED");
    if (request.workOrder.id !== order.orderId || request.workOrder.digest !== order.workOrderDigest || !validateDigest(order as unknown as Record<string, unknown>, "workOrderDigest")) throw new PublicationBrokerDenied("WORK_ORDER_BINDING_DENIED");
    if (request.lease.id !== order.lease.id || request.lease.expiresAt !== order.lease.expiresAt) throw new PublicationBrokerDenied("LEASE_BINDING_DENIED");
    if (request.base.ref !== this.policy.baseRef || request.base.commit !== this.policy.baseCommit || request.base.ref !== order.base.ref || request.base.commit !== order.base.commit) throw new PublicationBrokerDenied("BASE_BINDING_DENIED");
    if (!request.branch.name.startsWith(`${this.policy.branchPrefix}${request.issue.iid}/`)) throw new PublicationBrokerDenied("WORKER_BRANCH_DENIED");
    if (!request.mergeRequest.draft || request.mergeRequest.targetBranch !== request.base.ref || forbiddenAuthorityPattern.test(`${request.mergeRequest.title}\n${request.mergeRequest.description}`)) throw new PublicationBrokerDenied("DRAFT_MR_AUTHORITY_DENIED");
    const paths = request.patch.changes.map((change) => change.path);
    if (new Set(paths).size !== paths.length || digest([...paths].sort()) !== request.patch.changedPathsDigest || digest(request.patch.changes) !== request.patch.digest) throw new PublicationBrokerDenied("PATCH_BINDING_DENIED");
    for (const path of paths) if (!this.policy.allowedPaths.includes(path) || this.policy.deniedPaths.some((denied) => matches(path, denied))) throw new PublicationBrokerDenied("PATH_AUTHORITY_DENIED");
    if (this.provider.branchExists(request.project.id, request.branch.name)) throw new PublicationBrokerDenied("BRANCH_COLLISION_DENIED");
    let mrIid: number | undefined;
    try {
      this.provider.createBranch(request.project.id, request.branch.name, request.base.commit);
      const head = this.provider.pushPatch(request.project.id, request.branch.name, request.base.commit, request.patch.digest, [...paths].sort());
      mrIid = this.provider.createDraftMergeRequest(request.project.id, request.branch.name, request.base.ref, request.mergeRequest.title, request.mergeRequest.description);
      const raw = this.provider.readback(request.project.id, request.branch.name, mrIid);
      if (!validateReadback(raw) || !validateDigest(raw, "readbackDigest") || !safe(raw)) throw new PublicationBrokerDenied("PROVIDER_READBACK_DENIED");
      const rb = raw as PublicationBrokerReadbackV1;
      if (rb.projectId !== request.project.id || rb.branch.name !== request.branch.name || rb.branch.baseCommit !== request.base.commit || rb.branch.headCommit !== head || rb.branch.protected || rb.mergeRequest.iid !== mrIid || !rb.mergeRequest.draft || rb.mergeRequest.sourceBranch !== request.branch.name || rb.mergeRequest.targetBranch !== request.base.ref || rb.commit.patchDigest !== request.patch.digest || canonicalJson(rb.commit.changedPaths) !== canonicalJson([...paths].sort()) || !rb.ci.sanitized) throw new PublicationBrokerDenied("PROVIDER_READBACK_MISMATCH_DENIED");
      const unsigned = { schemaVersion: PUBLICATION_BROKER_RECEIPT_SCHEMA_V1, outcome: "PUBLISHED" as const, requestDigest: request.requestDigest, workOrderDigest: request.workOrder.digest,
        correlationDigest: digest({ operationId: request.operationId, requestDigest: request.requestDigest, readbackDigest: rb.readbackDigest }), branchName: request.branch.name, mergeRequestIid: mrIid, headCommit: head,
        effects, readbackDigest: rb.readbackDigest, cleanup: { temporaryStateRemaining: false as const }, nonClaims: ["Synthetic fake-provider evidence only; no real GitLab mutation or production activation.", "No merge, mark-ready, force-push, branch deletion, tag, release, admin, runner, variable, registry-write, or token authority."] };
      const receipt = this.receipt({ ...unsigned, receiptDigest: "" }); this.replay.set(request.operationId, receipt); return receipt;
    } catch (error) {
      this.provider.cleanup(request.project.id, request.branch.name, mrIid);
      if (this.provider.ownedStateRemaining(request.project.id, request.branch.name, mrIid)) throw new PublicationBrokerDenied("PROVIDER_CLEANUP_FAILED_DENIED");
      if (error instanceof PublicationBrokerDenied) throw error;
      throw new PublicationBrokerDenied("PROVIDER_PARTIAL_FAILURE_CLEANED_DENIED");
    }
  }
  private receipt(value: PublicationBrokerReceiptV1): PublicationBrokerReceiptV1 {
    const unsigned = { ...value } as unknown as Record<string, unknown>; delete unsigned.receiptDigest;
    const receipt = { ...unsigned, receiptDigest: digest(unsigned) } as unknown as PublicationBrokerReceiptV1;
    if (!validators()[2](receipt) || !safe(receipt)) throw new PublicationBrokerDenied("RECEIPT_DENIED"); return receipt;
  }
}

function matches(path: string, pattern: string): boolean { return pattern.endsWith("/**") ? path === pattern.slice(0, -3) || path.startsWith(pattern.slice(0, -2)) : path === pattern; }
export function validatePublicationReceipt(value: unknown): boolean { return validators()[2](value) && validateDigest(value, "receiptDigest") && safe(value); }
