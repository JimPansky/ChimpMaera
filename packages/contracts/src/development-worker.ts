export const DEVELOPMENT_WORKER_PROFILE_SCHEMA_V1 = "chimpmaera.dev/development-worker-profile/v1" as const;
export const WORK_ORDER_SCHEMA_V1 = "chimpmaera.dev/work-order/v1" as const;
export const WORK_RECEIPT_SCHEMA_V1 = "chimpmaera.dev/work-receipt/v1" as const;
export const PUBLICATION_BROKER_REQUEST_SCHEMA_V1 = "chimpmaera.dev/publication-broker-request/v1" as const;
export const PUBLICATION_BROKER_READBACK_SCHEMA_V1 = "chimpmaera.dev/publication-broker-readback/v1" as const;
export const PUBLICATION_BROKER_RECEIPT_SCHEMA_V1 = "chimpmaera.dev/publication-broker-receipt/v1" as const;

export type DevCapabilityV1 =
  | "cm.dev.issue.read"
  | "cm.dev.repository.snapshot.read"
  | "cm.dev.model.invoke"
  | "cm.dev.test.run"
  | "cm.dev.ci.read"
  | "cm.dev.ci.log.read-sanitized"
  | "cm.dev.change.publish"
  | "cm.dev.merge-request.create-draft"
  | "cm.dev.merge-request.update-owned"
  | "cm.dev.evidence.read";

export type DevModelAliasV1 = "cm.dev.fast" | "cm.dev.primary" | "cm.dev.review" | "cm.dev.escalate";

export interface DevelopmentWorkerProfileV1 {
  readonly schemaVersion: typeof DEVELOPMENT_WORKER_PROFILE_SCHEMA_V1;
  readonly profileId: string;
  readonly enabled: false;
  readonly dataClass: "PUBLIC_OSS";
  readonly workloadIdentity: string;
  readonly capabilities: readonly DevCapabilityV1[];
  readonly modelAliases: readonly DevModelAliasV1[];
  readonly isolation: {
    readonly network: "DENY_EXCEPT_INTERNAL_FRONTDOOR";
    readonly hostHome: false;
    readonly dockerSocket: false;
    readonly externalDirectories: false;
  };
  readonly harness: {
    readonly adapter: "opencode";
    readonly version: string;
    readonly artifactDigest: string;
    readonly configDigest: string;
    readonly securityBoundary: false;
  };
}

export interface DevBudgetV1 {
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly maxCostMicros: number;
  readonly maxRequests: number;
  readonly timeoutMs: number;
  readonly maxPatchBytes: number;
}

export interface WorkOrderV1 {
  readonly schemaVersion: typeof WORK_ORDER_SCHEMA_V1;
  readonly orderId: string;
  readonly workloadIdentity: string;
  readonly project: { readonly id: string; readonly repository: string };
  readonly issue: { readonly iid: number; readonly snapshotDigest: string };
  readonly base: { readonly ref: string; readonly commit: string };
  readonly paths: { readonly allowed: readonly string[]; readonly denied: readonly string[] };
  readonly acceptanceCriteria: readonly string[];
  readonly nonScope: readonly string[];
  readonly risk: "LOW";
  readonly dataClass: "PUBLIC_OSS";
  readonly artifacts: {
    readonly toolchainDigest: string;
    readonly harnessDigest: string;
    readonly workerDigest: string;
  };
  readonly model: { readonly aliases: readonly DevModelAliasV1[]; readonly providerPolicyDigest: string };
  readonly budget: DevBudgetV1;
  readonly testProfile: { readonly commands: readonly string[] };
  readonly lease: { readonly id: string; readonly capabilities: readonly DevCapabilityV1[]; readonly expiresAt: string };
  readonly publication: {
    readonly mode: "NONE";
    readonly allowed: readonly string[];
    readonly denied: readonly string[];
  };
  readonly expiresAt: string;
  readonly workOrderDigest: string;
}

export interface WorkReceiptV1 {
  readonly schemaVersion: typeof WORK_RECEIPT_SCHEMA_V1;
  readonly workOrderDigest: string;
  readonly outcome: "SUCCEEDED" | "DENIED" | "FAILED";
  readonly baseCommit: string;
  readonly candidateCommit: null;
  readonly changedPaths: readonly string[];
  readonly changedPathsDigest: string;
  readonly patchDigest: string;
  readonly tests: readonly {
    readonly command: string;
    readonly outcome: "PASS" | "FAIL";
    readonly outputDigest: string;
  }[];
  readonly review: { readonly outcome: "PASS" | "NOT_RUN"; readonly findings: readonly string[] };
  readonly modelUsage: {
    readonly alias: DevModelAliasV1;
    readonly providerPolicyDigest: string;
    readonly requests: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly costMicros: number;
  };
  readonly capabilityUsage: readonly DevCapabilityV1[];
  readonly publication: { readonly performed: false; readonly identifiers: readonly string[] };
  readonly readback: { readonly synthetic: true; readonly digest: string };
  readonly cleanup: { readonly outcome: "PASS"; readonly writableStateRemaining: false };
  readonly nonClaims: readonly string[];
  readonly receiptDigest: string;
}

export interface PublicationBrokerRequestV1 {
  readonly schemaVersion: typeof PUBLICATION_BROKER_REQUEST_SCHEMA_V1;
  readonly operationId: string;
  readonly project: { readonly id: string; readonly repository: string };
  readonly issue: { readonly iid: number; readonly snapshotDigest: string };
  readonly workOrder: { readonly id: string; readonly digest: string };
  readonly lease: { readonly id: string; readonly expiresAt: string };
  readonly base: { readonly ref: string; readonly commit: string };
  readonly branch: { readonly name: string; readonly expectedAbsent: true };
  readonly mergeRequest: { readonly draft: true; readonly title: string; readonly description: string; readonly targetBranch: string };
  readonly patch: { readonly digest: string; readonly changedPathsDigest: string; readonly changes: readonly { readonly path: string; readonly beforeSha256: string; readonly after: string }[] };
  readonly requestedEffects: readonly ["CREATE_WORKER_BRANCH", "PUSH_BOUNDED_PATCH", "CREATE_DRAFT_MR"];
  readonly expiresAt: string;
  readonly requestDigest: string;
}

export interface PublicationBrokerReadbackV1 {
  readonly schemaVersion: typeof PUBLICATION_BROKER_READBACK_SCHEMA_V1;
  readonly provider: "GITLAB_COMPATIBLE_FAKE";
  readonly projectId: string;
  readonly branch: { readonly name: string; readonly baseCommit: string; readonly headCommit: string; readonly protected: false };
  readonly mergeRequest: { readonly iid: number; readonly state: "OPEN"; readonly draft: true; readonly sourceBranch: string; readonly targetBranch: string };
  readonly commit: { readonly changedPaths: readonly string[]; readonly patchDigest: string };
  readonly ci: { readonly status: "NOT_RUN" | "PENDING" | "PASSED" | "FAILED"; readonly sanitized: true; readonly logDigest: string | null };
  readonly readbackDigest: string;
}

export interface PublicationBrokerReceiptV1 {
  readonly schemaVersion: typeof PUBLICATION_BROKER_RECEIPT_SCHEMA_V1;
  readonly outcome: "PUBLISHED" | "REPLAYED";
  readonly requestDigest: string;
  readonly workOrderDigest: string;
  readonly correlationDigest: string;
  readonly branchName: string;
  readonly mergeRequestIid: number;
  readonly headCommit: string;
  readonly effects: readonly ["CREATE_WORKER_BRANCH", "PUSH_BOUNDED_PATCH", "CREATE_DRAFT_MR"];
  readonly readbackDigest: string;
  readonly cleanup: { readonly temporaryStateRemaining: false };
  readonly nonClaims: readonly string[];
  readonly receiptDigest: string;
}
