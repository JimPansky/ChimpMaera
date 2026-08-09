import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  GOVERNED_WORKLOAD_RECEIPT_SCHEMA_V1,
  type GovernedWorkloadReceiptV1,
  type GovernedWorkloadRequestV1,
} from "../../contracts/src/development-worker.js";
import { DevWorkerDenied, sha256 } from "./controller.js";

export interface GovernanceBudgetV1 {
  readonly maxParallel: number;
  readonly maxRequests: number;
  readonly maxCostMicros: number;
}

export interface GovernancePolicyV1 {
  readonly enabled: boolean;
  readonly global: GovernanceBudgetV1;
  readonly projects: Readonly<Record<string, GovernanceBudgetV1>>;
  readonly providers: Readonly<Record<string, GovernanceBudgetV1>>;
  readonly adapters: readonly { readonly id: string; readonly version: string; readonly configDigest: string }[];
  readonly writerIdentity: string;
  readonly reviewerIdentity: string;
}

export interface HarnessInputV1 {
  readonly workload: "WRITER" | "REVIEWER";
  readonly evidenceDigest: string;
  readonly modelAlias: "cm.dev.fast" | "cm.dev.review";
}

export interface HarnessOutputV1 {
  readonly workload: "WRITER" | "REVIEWER";
  readonly requests: number;
  readonly costMicros: number;
  readonly patchDigest: string | null;
  readonly reviewOutcome: "PASS" | "REJECT" | null;
  readonly findings: readonly string[];
  readonly attemptedAuthorities: readonly string[];
  readonly outputDigest: string;
}

export interface GovernedHarnessAdapterV1 {
  readonly id: string;
  readonly version: string;
  readonly configDigest: string;
  run(input: Readonly<HarnessInputV1>): Promise<HarnessOutputV1>;
}

type Usage = { active: number; requests: number; costMicros: number };
const zero = (): Usage => ({ active: 0, requests: 0, costMicros: 0 });

let requestValidator: ValidateFunction | undefined;
let receiptValidator: ValidateFunction | undefined;
function validators(): { request: ValidateFunction; receipt: ValidateFunction } {
  if (!requestValidator || !receiptValidator) {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const load = (name: string): object => JSON.parse(readFileSync(join(process.cwd(), "schemas", name), "utf8")) as object;
    requestValidator = ajv.compile(load("governed-workload-request-v1.schema.json"));
    receiptValidator = ajv.compile(load("governed-workload-receipt-v1.schema.json"));
  }
  return { request: requestValidator, receipt: receiptValidator };
}

function digestBound(value: Record<string, unknown>, key: string): string {
  const copy = { ...value };
  delete copy[key];
  return sha256(copy);
}

function deny(code: string): never { throw new DevWorkerDenied(code); }
function validBudget(value: GovernanceBudgetV1 | undefined): value is GovernanceBudgetV1 {
  return value !== undefined && [value.maxParallel, value.maxRequests, value.maxCostMicros].every(number => Number.isSafeInteger(number) && number > 0);
}

export class GovernedWorkloadControllerV1 {
  private sequence = 0;
  private readonly global = zero();
  private readonly projects = new Map<string, Usage>();
  private readonly providers = new Map<string, Usage>();
  private readonly writerIssues = new Map<string, string>();
  private readonly writerOrders = new Map<string, string>();
  private readonly requestDigests = new Map<string, string>();

  private readonly policy: GovernancePolicyV1;

  constructor(policy: GovernancePolicyV1) {
    this.policy = structuredClone(policy);
  }

  async execute(request: GovernedWorkloadRequestV1, adapter: GovernedHarnessAdapterV1, now: string): Promise<GovernedWorkloadReceiptV1> {
    const validation = validators();
    if (!validation.request(request) || digestBound(request as unknown as Record<string, unknown>, "requestDigest") !== request.requestDigest) deny("GOVERNED_REQUEST_SCHEMA_OR_DIGEST_DENIED");
    if (this.policy.enabled !== true) deny("GOVERNANCE_DISABLED_DENIED");
    if (!validBudget(this.policy.global) || new Set(this.policy.adapters.map(({ id }) => id)).size !== this.policy.adapters.length) deny("GOVERNANCE_POLICY_DENIED");
    const instant = Date.parse(now);
    if (!Number.isFinite(instant) || instant >= Date.parse(request.expiresAt) || instant >= Date.parse(request.lease.expiresAt)) deny("STALE_OR_EXPIRED_WORKLOAD_DENIED");
    const prior = this.requestDigests.get(request.requestId);
    if (prior !== undefined) deny(prior === request.requestDigest ? "CONCURRENT_OR_REPLAY_REQUEST_DENIED" : "REQUEST_ID_CONFLICT_DENIED");
    const binding = this.policy.adapters.find(candidate => candidate.id === request.adapter.id);
    if (!binding || binding.version !== request.adapter.version || binding.configDigest !== request.adapter.configDigest || adapter.id !== binding.id || adapter.version !== binding.version || adapter.configDigest !== binding.configDigest) deny("ADAPTER_BINDING_DENIED");
    if (request.lease.kind !== request.workload) deny("WRONG_WORKLOAD_LEASE_DENIED");
    const reviewer = request.workload === "REVIEWER";
    if (request.workloadIdentity !== (reviewer ? this.policy.reviewerIdentity : this.policy.writerIdentity)) deny("WRONG_WORKLOAD_IDENTITY_DENIED");
    const expectedCapabilities = reviewer ? ["cm.dev.evidence.read"] : ["cm.dev.model.invoke", "cm.dev.test.run"];
    if (JSON.stringify(request.requestedCapabilities) !== JSON.stringify(expectedCapabilities)) deny("WORKLOAD_AUTHORITY_DENIED");
    if (request.provider.modelAlias !== (reviewer ? "cm.dev.review" : "cm.dev.fast")) deny("MODEL_ROUTE_DENIED");

    const projectBudget = this.policy.projects[request.projectId];
    const providerBudget = this.policy.providers[request.provider.id];
    if (!validBudget(projectBudget) || !validBudget(providerBudget)) deny("BUDGET_ROUTE_DENIED");
    const project = this.projects.get(request.projectId) ?? zero();
    const provider = this.providers.get(request.provider.id) ?? zero();
    const issueKey = `${request.projectId}#${request.issueIid}`;
    const orderKey = `${request.projectId}#${request.workOrderId}`;
    if (!reviewer && (this.writerIssues.has(issueKey) || this.writerOrders.has(orderKey))) deny("WRITER_SCOPE_CONFLICT_DENIED");
    if (reviewer && (this.writerIssues.get(issueKey) === request.lease.id || this.writerOrders.get(orderKey) === request.lease.id)) deny("REVIEWER_WRITER_LEASE_SHARE_DENIED");
    for (const [usage, budget] of [[this.global, this.policy.global], [project, projectBudget], [provider, providerBudget]] as const) {
      if (usage.active >= budget.maxParallel || usage.requests + request.budget.requests > budget.maxRequests || usage.costMicros + request.budget.costMicros > budget.maxCostMicros) deny("GOVERNANCE_BUDGET_EXHAUSTED");
    }

    // Reservation is deliberately synchronous: no competing invocation can pass these checks before state is bound.
    this.requestDigests.set(request.requestId, request.requestDigest);
    for (const usage of [this.global, project, provider]) { usage.active++; usage.requests += request.budget.requests; usage.costMicros += request.budget.costMicros; }
    this.projects.set(request.projectId, project);
    this.providers.set(request.provider.id, provider);
    if (!reviewer) { this.writerIssues.set(issueKey, request.lease.id); this.writerOrders.set(orderKey, request.lease.id); }
    const admissionSequence = ++this.sequence;
    try {
      const input = Object.freeze({ workload: request.workload, evidenceDigest: request.evidenceDigest, modelAlias: request.provider.modelAlias }) as HarnessInputV1;
      const output = await adapter.run(input);
      const outputKeys = ["attemptedAuthorities", "costMicros", "findings", "outputDigest", "patchDigest", "requests", "reviewOutcome", "workload"];
      if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(outputKeys) || !Array.isArray(output.findings) || !output.findings.every(value => typeof value === "string") || !Array.isArray(output.attemptedAuthorities) || !output.attemptedAuthorities.every(value => typeof value === "string")) deny("ADAPTER_OUTPUT_SCHEMA_DENIED");
      const outputCopy = { ...output } as Record<string, unknown>; delete outputCopy.outputDigest;
      if (sha256(outputCopy) !== output.outputDigest || output.workload !== request.workload) deny("ADAPTER_OUTPUT_TAMPERING_DENIED");
      if (output.requests < 0 || output.costMicros < 0 || output.requests > request.budget.requests || output.costMicros > request.budget.costMicros) deny("ADAPTER_BUDGET_MISMATCH_DENIED");
      if (output.attemptedAuthorities.length > 0) deny(reviewer ? "REVIEWER_AUTHORITY_ATTEMPT_DENIED" : "WORKLOAD_AUTHORITY_ATTEMPT_DENIED");
      if (reviewer && (output.patchDigest !== null || output.reviewOutcome === null)) deny("REVIEWER_MUTATION_DENIED");
      if (!reviewer && (output.patchDigest === null || output.reviewOutcome !== null || output.findings.length > 0)) deny("WRITER_OUTPUT_DENIED");
      const unsigned = {
        schemaVersion: GOVERNED_WORKLOAD_RECEIPT_SCHEMA_V1, outcome: "SUCCEEDED" as const, requestDigest: request.requestDigest,
        workload: request.workload, admissionSequence,
        adapter: { ...request.adapter, outputDigest: output.outputDigest },
        scope: { projectId: request.projectId, issueIid: request.issueIid, workOrderId: request.workOrderId },
        usage: { requests: output.requests, costMicros: output.costMicros },
        result: { patchDigest: output.patchDigest, reviewOutcome: output.reviewOutcome, findingsDigest: reviewer ? sha256(output.findings) : null },
        authority: { workspaceMutation: false as const, publication: false as const, budgetWidening: false as const, routeWidening: false as const, writerLeaseShared: false as const },
        nonClaims: ["Deterministic local fixture evidence only; no live harness, provider, workspace mutation, publication, merge, release, or deployment."],
      };
      const receipt = { ...unsigned, receiptDigest: sha256(unsigned) };
      if (!validation.receipt(receipt)) deny("GOVERNED_RECEIPT_SCHEMA_DENIED");
      return receipt;
    } catch (error) {
      if (error instanceof DevWorkerDenied) throw error;
      deny("ADAPTER_EXECUTION_DENIED");
    } finally {
      this.global.active--; project.active--; provider.active--;
    }
  }
}

export function deterministicFixtureAdapter(id: "opencode-contract-fixture" | "portable-local-fixture", config: object, gate?: Promise<void>, mutation: Partial<HarnessOutputV1> = {}): GovernedHarnessAdapterV1 {
  const version = "1.0.0";
  const configDigest = sha256(config);
  return {
    id, version, configDigest,
    async run(input) {
      if (gate) await gate;
      const base = input.workload === "WRITER"
        ? { workload: "WRITER" as const, requests: 1, costMicros: 10, patchDigest: sha256({ adapter: id, evidence: input.evidenceDigest }), reviewOutcome: null, findings: [], attemptedAuthorities: [] }
        : { workload: "REVIEWER" as const, requests: 1, costMicros: 5, patchDigest: null, reviewOutcome: "PASS" as const, findings: ["fixture evidence is internally consistent"], attemptedAuthorities: [] };
      const changed = { ...base, ...mutation };
      return { ...changed, outputDigest: sha256(changed) } as HarnessOutputV1;
    },
  };
}
