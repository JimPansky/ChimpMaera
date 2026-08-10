# Issue candidate lifecycle v1

`cm.issue-candidate/v1` is a local, deterministic, synthetic issue-intake
contract. It is default-off and export/preflight-only unless a caller injects
both a declared duplicate-search adapter and a least-privilege submit/readback
adapter. The repository includes no network adapter, credential lookup,
destination discovery, background worker, or ambient public-write capability.

The legal success path is `observed` → `drafted` → `sanitized` → `classified`
→ `deduplicated` → `owner_reviewed` → `submitted` →
`readback_confirmed` → `linked` → `resolved`. `resolved` is local bookkeeping;
it never closes a remote issue. `linked` binds only the user-facing parent
Issue #39. Issue #52 is the separate high-volume Contribution Control Plane
and is not implemented or claimed by this contract.

## Safety and owner workflow

Sanitization normalizes Unicode, line endings and control characters
deterministically. Secret/token shapes, private paths, tenant or user
identities, internal hosts, session/job identifiers, and exploit-shaped input
are not published with placeholders: they enter `quarantined`, route to
`PRIVATE_REVIEW` or `SECURITY_POLICY`, and retain `publicBytesEmitted=0`.
Private and security classifications behave the same way. Operators must use
the private route in `SECURITY.md`; quarantine evidence contains stable reason
codes, not the rejected bytes.

Duplicate search is mandatory and digest-bound. Exact matches enter
`duplicate_blocked`. Similarity at or above 700 permille enters
`review_required`; a bounded owner decision may block or return the same
candidate to `deduplicated`. The exact preview binds action, destination,
candidate, sanitized content and duplicate-search digest. Approval is valid
for at most five minutes, has a unique nonce, and is usable only for that exact
preview. Changed, stale, missing, reused or destination-mismatched approval is
denied before adapter invocation.

Submission derives one deterministic attempt ID and idempotency key. The
adapter must declare exactly `CREATE_ISSUE` and
`READ_ISSUE_BY_IDEMPOTENCY`. Accepted receipt fields and remote readback must
match every bound identity and the exact sanitized content. A timeout, partial
result, malformed receipt, missing/ambiguous/mismatched readback, or uncertain
outcome enters `recovery_required`. From there, only idempotency readback may
reconcile the attempt; submit cannot run again.

## Evidence, recovery, and rollback

Every transition appends a hash-chained event with candidate, content,
approval, attempt, receipt and readback identities. History is never edited by
the contract. Retain duplicate, quarantined, partial and mismatch records as
negative evidence. An operator may disable the intake profile/route and restore
the exact last accepted contract while retaining receipts and quarantine
records append-only. Source rollback uses a protected revert; before
publication this isolated branch/worktree may be discarded.

Run `npm run issue-candidate:test`. This proves only local deterministic
synthetic behavior. It does not prove autonomous or real public writes,
security disclosure, remote closure, production operation, credentials,
provider behavior, deployment, infrastructure changes, or Issue #52.
