"""Bounded independent render fan-out and exact-revision fan-in contracts."""

from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path
import tempfile

from .contract import ContractError


DEFAULT_MAX_WORKERS = 2
OUTCOMES = {"PASS", "FAIL", "BLOCKED"}


def atomic_write_summary(path, value):
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=destination.parent, encoding="utf-8", delete=False) as stream:
        json.dump(value, stream, indent=2, sort_keys=True)
        stream.write("\n")
        temporary = Path(stream.name)
    temporary.replace(destination)


def run_independent(revisions, runner, max_workers=DEFAULT_MAX_WORKERS, on_outcome=None):
    """Run every exact revision without sibling cancellation or global fail-fast."""
    revisions = list(revisions)
    if not revisions or len(revisions) != len(set(revisions)):
        raise ContractError("batch revisions must be non-empty and unique")
    if not isinstance(max_workers, int) or max_workers < 1:
        raise ContractError("max_workers must be a positive integer")
    bounded_workers = min(max_workers, DEFAULT_MAX_WORKERS, len(revisions))
    completed = []
    with ThreadPoolExecutor(max_workers=bounded_workers) as pool:
        futures = {pool.submit(runner, revision): revision for revision in revisions}
        for future in as_completed(futures):
            revision = futures[future]
            try:
                outcome = dict(future.result())
            except Exception as exc:
                outcome = {"revision": revision, "status": "FAIL", "code": "MODULE_EXCEPTION", "reason": str(exc)}
            outcome.setdefault("revision", revision)
            if outcome["revision"] != revision or outcome.get("status") not in OUTCOMES:
                outcome = {"revision": revision, "status": "FAIL", "code": "INVALID_MODULE_OUTCOME"}
            completed.append(outcome)
            if on_outcome:
                on_outcome(outcome)
    by_revision = {row["revision"]: row for row in completed}
    return [by_revision[revision] for revision in revisions]


def validate_exact_fan_in(outcomes, approval_digests, required_count=6):
    """Validate an all-green exact-revision set; never assemble or publish."""
    outcomes = list(outcomes)
    approval_digests = dict(approval_digests)
    blockers = []
    if len(approval_digests) != required_count:
        blockers.append({"code": "EXACT_REVISION_COUNT", "expected": required_count, "observed": len(approval_digests)})
    by_revision = {row.get("revision"): row for row in outcomes}
    if len(by_revision) != len(outcomes) or set(by_revision) != set(approval_digests):
        blockers.append({"code": "EXACT_REVISION_SET_MISMATCH"})
    for revision, digest in approval_digests.items():
        row = by_revision.get(revision, {})
        if row.get("status") != "PASS":
            blockers.append({"revision": revision, "code": "MODULE_NOT_PASS"})
        if row.get("storyboardRevisionSha256") != digest:
            blockers.append({"revision": revision, "code": "STORYBOARD_DIGEST_MISMATCH"})
        if row.get("automatedQa") != "PASS":
            blockers.append({"revision": revision, "code": "AUTOMATED_QA_NOT_PASS"})
        final_review = row.get("humanFinalReview") or {}
        if final_review.get("status") != "APPROVED" or final_review.get("revisionSha256") != digest:
            blockers.append({"revision": revision, "code": "FINAL_HUMAN_GATE_NOT_EXACT_APPROVED"})
        if not row.get("candidateSha256"):
            blockers.append({"revision": revision, "code": "CANDIDATE_HASH_MISSING"})
    return {
        "status": "PASS" if not blockers else "BLOCKED",
        "requiredCount": required_count,
        "exactRevisions": list(approval_digests),
        "blockers": blockers,
        "assembly": "PERMITTED" if not blockers else "FORBIDDEN",
        "publication": "FORBIDDEN",
    }
