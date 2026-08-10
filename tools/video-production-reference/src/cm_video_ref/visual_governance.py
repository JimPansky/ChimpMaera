"""Fail-closed visual-language, audience and learning governance.

The module validates plans before expensive speech synthesis or full rendering.
It deliberately keeps automated PASS separate from publication permission.
"""

from __future__ import annotations

from collections import Counter, defaultdict
import datetime as dt
import hashlib
import json
from pathlib import Path
import re


VISUAL_CONTRACT_VERSION = "cm.visual-language-contract/2026-08-03-v1"
STORYBOARD_VERSION = "cm.video-storyboard/v1"
AUDIENCE_CANVAS_VERSION = "cm.audience-discovery-canvas/v1"
LEARNING_RECORD_VERSION = "cm.learning-record/v1"
MEDIA_EVENT_VERSION = "cm.media-learning-event/v1"

VISUAL_TYPES = {
    "AUTHORITY_FLOW",
    "STATE_TRANSITION",
    "COMPARISON",
    "DEPENDENCY_DAG",
    "CONTRIBUTION_PREFLIGHT",
    "SCOPE_NORMALIZATION",
    "PUBLIC_TRUTH_PATH",
    "UI_EXCERPT",
    "TERMINAL_EXCERPT",
    "CONTRACT_EXCERPT",
    "MEASURED_EVIDENCE",
}
NARRATIVE_JOBS = {
    "HOOK", "CONTEXT", "PROBLEM", "MECHANISM", "PROOF",
    "CONSEQUENCE", "TRANSITION", "CLOSE",
}
REVIEW_KEYS = (
    "HUMAN_VISUAL_REVIEW",
    "HUMAN_EDITORIAL_REVIEW",
    "HUMAN_FINAL_REVIEW",
)
REVIEW_STATES = {"PENDING", "APPROVED", "REJECTED"}
MATURITY = (
    "L0_TECHNICAL_VALID",
    "L1_SCRIPT_COMPLETE",
    "L2_STORYBOARD_VALIDATED",
    "L3_VISUAL_DESIGN_APPROVED",
    "L4_ROUGH_CUT_APPROVED",
    "L5_PUBLICATION_READY",
    "L6_PUBLISHED_AND_READBACK_VERIFIED",
)
LEARNING_STAGES = (
    "L0_RAW_OBSERVATION",
    "L1_NORMALIZED_FINDING",
    "L2_VALIDATED_PATTERN",
    "L3_TEMPLATE_CANDIDATE",
    "L4_GOVERNED_TEMPLATE",
    "L5_CROSS_CONTEXT_REUSED",
    "L6_OUTCOME_VALIDATED",
)
ASSUMPTION_TYPES = {"observed", "sourced", "hypothesis", "editorial-decision"}
EVIDENCE_POLARITIES = {"POSITIVE", "NEGATIVE", "REJECTED", "UNRESOLVED"}
EVENT_TYPES = {
    "AUDIENCE_HYPOTHESIS_RECORDED", "AUDIENCE_EVIDENCE_BOUND", "AUDIENCE_LOCKED",
    "SCRIPT_REVISED", "STORYBOARD_REVISED", "REVISION_REJECTED",
    "COMPREHENSION_PROBE_RECORDED", "PUBLIC_REACTION_CLASSIFIED",
    "FEEDBACK_ROUTED", "LEARNING_PROMOTED", "LEARNING_INVALIDATED", "OUTCOME_RECORDED",
}


class VisualGovernanceError(Exception):
    pass


def _require(condition, message):
    if not condition:
        raise VisualGovernanceError(message)


def canonical_digest(value):
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _words(value):
    return re.findall(r"[a-z0-9]+", str(value).casefold())


def _duplicate_ratio(narration, labels):
    narrated = set(_words(narration))
    displayed = set(_words(" ".join(labels)))
    if not narrated or not displayed:
        return 0.0
    return len(narrated & displayed) / len(displayed)


def validate_audience_canvas(canvas, *, as_of="2026-08-10"):
    _require(isinstance(canvas, dict), "audience canvas must be an object")
    _require(canvas.get("schemaVersion") == AUDIENCE_CANVAS_VERSION, "audience canvas version mismatch")
    for key in (
        "context", "decisionToInfluence", "primaryAudiences", "secondaryAudiences",
        "excludedAudiences", "assumptions", "evidence", "unknowns", "review",
    ):
        _require(canvas.get(key), f"audience canvas missing {key}")
    _require(not canvas.get("personas"), "invented personas are forbidden")
    evidence = {row.get("id"): row for row in canvas["evidence"]}
    _require(None not in evidence and len(evidence) == len(canvas["evidence"]), "audience evidence IDs must be unique")
    valid_classes = ASSUMPTION_TYPES
    strong = 0
    for assumption in canvas["assumptions"]:
        classification = assumption.get("type")
        _require(classification in valid_classes, "fact/hypothesis/editorial classification required")
        refs = assumption.get("evidenceRefs") or []
        _require(assumption.get("provenance") and assumption.get("scope"), "audience assumption provenance and scope required")
        _require(assumption.get("confidence") in {"LOW", "MEDIUM", "HIGH"}, "audience assumption confidence required")
        if classification in {"observed", "sourced"}:
            _require(refs and set(refs) <= set(evidence), "facts require declared audience evidence")
            strong += 1
        elif classification == "hypothesis":
            _require(assumption.get("validationProbe"), "hypothesis requires a planned validation probe")
        else:
            _require(assumption.get("rationale"), "editorial decisions require rationale")
        _require(assumption.get("owner") and assumption.get("reviewDate"), "audience assumption owner and review date required")
        try:
            review_date = dt.date.fromisoformat(assumption["reviewDate"])
            current_date = dt.date.fromisoformat(as_of)
        except (KeyError, TypeError, ValueError):
            raise VisualGovernanceError("audience assumption review date must be ISO-8601")
        _require(review_date >= current_date, "stale audience assumption")
        _require(assumption.get("disconfirmingEvidence") is not None, "disconfirming evidence field required")
    confidence = canvas["review"].get("confidence")
    if strong < 2:
        _require(confidence == "LOW", "minimum audience evidence threshold not met; confidence must be LOW")
        _require(canvas["review"].get("plannedProbe"), "low-confidence audience lock needs a probe")
    _require(canvas["review"].get("antiStereotypeCheck") == "PASS", "anti-stereotype check required")
    _require(canvas["review"].get("privacyReview") == "PASS", "audience research privacy review required")
    digest = canvas["review"].get("lockedRevisionSha256", "")
    _require(re.fullmatch(r"[a-f0-9]{64}", digest) is not None, "immutable audience lock digest required")
    _require(canvas.get("contentFamilies") and len(set(canvas["contentFamilies"])) >= 3, "canvas reuse requires three bounded media content families")
    return {"status": "PASS", "assumptions": len(canvas["assumptions"]), "strongEvidenceAssumptions": strong}


def validate_audience_adaptations(value):
    """Prove audience adaptation changes treatment while preserving one factual core."""
    _require(value.get("schemaVersion") == "cm.audience-adaptation-proof/v1", "audience adaptation proof version mismatch")
    core = value.get("factualCore") or {}
    _require(core.get("claims") and core.get("evidence") and re.fullmatch(r"[a-f0-9]{64}", core.get("digest", "")), "immutable factual core required")
    _require(core["digest"] == canonical_digest({"claims": core["claims"], "evidence": core["evidence"]}), "factual core digest mismatch")
    variants = value.get("variants") or []
    _require(len(variants) >= 2, "two audience variants required")
    audiences, treatments = set(), set()
    for variant in variants:
        _require(variant.get("factualCoreDigest") == core["digest"], "claim/evidence drift across audience adaptation")
        _require(variant.get("audienceLockSha256") and variant.get("adaptationDeclaration"), "cross-audience reuse requires declared adaptation")
        _require(variant.get("script") and variant.get("storyboard"), "script and storyboard adaptation required")
        audiences.add(variant.get("audience"))
        treatments.add(canonical_digest({"script": variant["script"], "storyboard": variant["storyboard"]}))
    _require(len(audiences) >= 2 and len(treatments) >= 2, "audience variants must be materially different")
    return {"status": "PASS", "audiences": sorted(audiences), "factualCoreDigest": core["digest"]}


def validate_storyboard(storyboard, *, stage="PREFLIGHT"):
    _require(isinstance(storyboard, dict), "storyboard must be an object")
    _require(storyboard.get("schemaVersion") == STORYBOARD_VERSION, "storyboard version mismatch")
    _require(storyboard.get("visualContractVersion") == VISUAL_CONTRACT_VERSION, "visual contract version mismatch")
    revision = storyboard.get("immutableRevisionSha256", "")
    _require(re.fullmatch(r"[a-f0-9]{64}", revision) is not None, "immutable revision digest required")
    _require(storyboard.get("durationPolicy") == "CONTENT_DRIVEN", "content-driven duration policy required")
    _require(storyboard.get("audienceLock", {}).get("canvasSha256"), "release-specific audience lock required")

    architecture = storyboard.get("storyArchitecture") or {}
    for key in ("audience", "intendedDecision", "centralTension", "transformation", "proof", "implication"):
        _require(architecture.get(key), f"story architecture missing {key}")
    _require(architecture.get("oneNarrativeSpine") is True, "one narrative spine is required")

    claims = {row.get("id"): row for row in storyboard.get("claims", [])}
    evidence = {row.get("id"): row for row in storyboard.get("evidence", [])}
    _require(claims and evidence and None not in claims and None not in evidence, "claim/evidence registry required")
    for claim in claims.values():
        refs = claim.get("evidenceRefs") or []
        _require(refs and set(refs) <= set(evidence), "every claim requires valid evidence")
        _require(claim.get("nonClaimBoundary"), "every claim requires a non-claim boundary")
        _require(set(claim.get("allowedVisualTypes") or []) <= VISUAL_TYPES, "claim declares unknown visual type")

    scenes = storyboard.get("scenes") or []
    _require(len(scenes) >= 2, "storyboard requires progressive scenes")
    scene_ids = set()
    compositions = []
    for scene in scenes:
        scene_id = scene.get("id")
        _require(scene_id and scene_id not in scene_ids, "scene IDs must be non-empty and unique")
        scene_ids.add(scene_id)
        _require(scene.get("narrativeJob") in NARRATIVE_JOBS, f"scene {scene_id} lacks a narrative job")
        _require(scene.get("objective") and scene.get("semanticAction"), f"scene {scene_id} lacks semantic mapping")
        before, after = scene.get("beforeState"), scene.get("afterState")
        _require(before is not None and after is not None and canonical_digest(before) != canonical_digest(after), f"scene {scene_id} has negligible visual change")
        visual_type = scene.get("visualType")
        _require(visual_type in VISUAL_TYPES, f"scene {scene_id} has unknown visual type")
        claim_refs = scene.get("claimRefs") or []
        evidence_refs = scene.get("evidenceRefs") or []
        _require(claim_refs and set(claim_refs) <= set(claims), f"scene {scene_id} missing claim-to-visual evidence")
        _require(evidence_refs and set(evidence_refs) <= set(evidence), f"scene {scene_id} missing claim-to-visual evidence")
        for claim_ref in claim_refs:
            allowed = set(claims[claim_ref].get("allowedVisualTypes") or [])
            _require(not allowed or visual_type in allowed, f"scene {scene_id} visual type does not match the claim")
        labels = scene.get("onScreenLabels") or []
        _require(labels and all(isinstance(label, str) and 0 < len(label) <= 48 for label in labels), f"scene {scene_id} labels must be short callouts")
        _require(sum(len(_words(label)) for label in labels) <= 24, f"scene {scene_id} excessive text density")
        narration = scene.get("narration") or ""
        _require(narration and scene.get("narrationPurpose"), f"scene {scene_id} narration purpose required")
        _require(_duplicate_ratio(narration, labels) < 0.58, f"scene {scene_id} narration duplication")
        keyframes = scene.get("keyframes") or []
        _require(len(keyframes) >= 2, f"scene {scene_id} needs representative keyframes")
        states = [row.get("stateDigest") for row in keyframes]
        _require(all(re.fullmatch(r"[a-f0-9]{64}", value or "") for value in states), f"scene {scene_id} keyframe state digest missing")
        _require(len(set(states)) >= 2 and float(scene.get("visualDeltaScore", 0)) >= 0.20, f"scene {scene_id} static-slide behavior")
        _require(scene.get("accessibilityNote"), f"scene {scene_id} accessibility note required")
        _require(scene.get("transitionPurpose"), f"scene {scene_id} transition purpose required")
        compositions.append(scene.get("compositionId"))
    _require(all(compositions), "every scene needs a composition family")
    counts = Counter(compositions)
    _require(max(counts.values()) <= max(2, (len(scenes) + 1) // 2), "repeated identical composition")

    tail = storyboard.get("tail") or {}
    _require(float(tail.get("staticSeconds", 999)) <= 1.5, "long static tail")
    _require(float(tail.get("silentSeconds", 999)) <= 1.0, "long silent tail")
    _require(tail.get("purpose") == "NARRATIVE_CLOSE", "tail padding is forbidden")

    terms = storyboard.get("criticalTerms") or []
    full_narration = " ".join(scene["narration"] for scene in scenes)
    for term in terms:
        spelling = term.get("spelling")
        _require(spelling and term.get("pronunciation"), "critical-term spelling and pronunciation required")
        if term.get("requiredInNarration"):
            _require(spelling in full_narration, f"wrong critical term: {spelling}")

    sheet = storyboard.get("contactSheet") or {}
    _require(re.fullmatch(r"[a-f0-9]{64}", sheet.get("sha256", "")) is not None, "contact-sheet digest required")
    _require(len(sheet.get("representativeMoments") or []) >= len(scenes), "contact sheet lacks representative moments")

    reviews = storyboard.get("reviews") or {}
    for key in REVIEW_KEYS:
        review = reviews.get(key) or {}
        _require(review.get("status") in REVIEW_STATES, f"{key} state required")
        if review["status"] == "APPROVED":
            _require(review.get("revisionSha256") == revision and review.get("reviewer") and review.get("reviewedAt"), f"{key} approval from stale revision")

    automated = storyboard.get("automatedPreflight") or {}
    _require(automated.get("revisionSha256") == revision, "automated preflight revision mismatch")
    _require(automated.get("status") == "PASS", "automated storyboard gate must pass")
    if any(reviews[key]["status"] != "APPROVED" for key in REVIEW_KEYS[:2]):
        _require(storyboard.get("readyForAssembly") is False, "pending/rejected human gates must keep readyForAssembly false")
        _require(storyboard.get("publicationPermission") == "FORBIDDEN", "pending/rejected human gates must keep publication forbidden")

    maturity = storyboard.get("maturity")
    _require(maturity in MATURITY, "unknown video maturity state")
    if MATURITY.index(maturity) >= MATURITY.index("L3_VISUAL_DESIGN_APPROVED"):
        _require(reviews["HUMAN_VISUAL_REVIEW"]["status"] == "APPROVED", "visual approval required for L3+")

    if stage in {"TTS", "FULL_RENDER", "FINAL_QA", "SEND"}:
        for key in REVIEW_KEYS[:2]:
            _require(reviews[key]["status"] == "APPROVED", f"{key} blocks TTS/full render")
            _require(reviews[key]["revisionSha256"] == revision, f"{key} approval from stale revision")
    if stage == "SEND":
        final = storyboard.get("automatedFinalQa") or {}
        _require(final.get("status") == "PASS" and final.get("revisionSha256") == revision, "exact-revision automated final QA required")
        _require(reviews["HUMAN_FINAL_REVIEW"]["status"] == "APPROVED", "human final approval required")
        _require(reviews["HUMAN_FINAL_REVIEW"]["revisionSha256"] == revision, "human final approval from stale revision")
        _require(storyboard.get("readyForAssembly") is True, "attempted send while readyForAssembly false")
        _require(storyboard.get("publicationPermission") == "PERMITTED", "attempted send while forbidden")
        _require(maturity in {"L5_PUBLICATION_READY", "L6_PUBLISHED_AND_READBACK_VERIFIED"}, "publication maturity gate not met")

    return {
        "status": "PASS_AUTOMATED",
        "publicationReady": stage == "SEND",
        "revisionSha256": revision,
        "scenes": len(scenes),
        "semanticActions": len(scenes),
        "humanVisualReview": reviews["HUMAN_VISUAL_REVIEW"]["status"],
        "humanEditorialReview": reviews["HUMAN_EDITORIAL_REVIEW"]["status"],
    }


def validate_learning_records(records):
    _require(isinstance(records, list) and records, "learning records are required")
    by_id = {row.get("id"): row for row in records}
    _require(None not in by_id and len(by_id) == len(records), "learning record IDs must be unique")
    graph = defaultdict(list)
    for record in records:
        _require(record.get("schemaVersion") == LEARNING_RECORD_VERSION, "learning record version mismatch")
        stage = record.get("stage")
        _require(stage in LEARNING_STAGES, "unknown learning stage")
        provenance = record.get("provenance") or {}
        required_chain = ("source", "observation", "normalization", "decision", "outputRevision", "testReviewEvidence", "outcome")
        _require(all(provenance.get(key) for key in required_chain) and record.get("sourceDigests"), "learning record missing provenance")
        _require(all(re.fullmatch(r"[a-f0-9]{64}", value or "") for value in record["sourceDigests"]), "learning source digest invalid")
        _require(record.get("confidence") in {"LOW", "MEDIUM", "HIGH"}, "learning confidence required")
        scope = record.get("scope") or {}
        _require(scope.get("audiences") and scope.get("contentFamilies") and scope.get("contentApplicability") and record.get("applicabilityBoundary"), "learning applicability boundary required")
        versions = record.get("versions") or {}
        _require(versions.get("tool") and versions.get("template"), "learning tool/template versions required")
        _require(record.get("reviewDate") and record.get("expiryOrReviewDate"), "learning review/expiry required")
        _require(record.get("rollback") and record.get("supersession") is not None, "learning rollback/supersession required")
        evidence = record.get("evidence") or []
        _require(evidence and all(row.get("id") and row.get("polarity") in EVIDENCE_POLARITIES for row in evidence), "learning evidence polarity required")
        _require(len({row["id"] for row in evidence}) == len(evidence), "learning evidence IDs must remain independently queryable")
        if LEARNING_STAGES.index(stage) >= LEARNING_STAGES.index("L2_VALIDATED_PATTERN"):
            polarities = {row["polarity"] for row in evidence}
            _require("POSITIVE" in polarities and polarities & {"NEGATIVE", "REJECTED", "UNRESOLVED"}, "validated patterns must not cherry-pick only positive evidence")
        if LEARNING_STAGES.index(stage) >= LEARNING_STAGES.index("L3_TEMPLATE_CANDIDATE"):
            _require(len(record.get("derivedFrom") or []) >= 2 or record.get("strongJustification"), "promotion from a single weak observation")
            _require(record.get("promotionGate", {}).get("status") == "PASS" and record["promotionGate"].get("objectiveEvidenceRefs"), "objective promotion gate required")
        _require(record.get("assertionType") in ASSUMPTION_TYPES, "fact/hypothesis confusion")
        if record.get("crossAudienceReuse"):
            _require(record.get("declaredAdaptation"), "cross-audience reuse requires declared adaptation")
        integrity = record.get("integrity") or {}
        _require(integrity.get("sequence", 0) > 0 and re.fullmatch(r"[a-f0-9]{64}", integrity.get("recordSha256", "")), "append-only learning integrity required")
        unsigned = {key: value for key, value in record.items() if key != "integrity"}
        _require(integrity["recordSha256"] == canonical_digest(unsigned), "learning record tampering detected")
        invalidation = record.get("invalidation") or {}
        _require(invalidation.get("watch") and invalidation.get("onChange") == "DOWNGRADE_OR_INVALIDATE_FAIL_CLOSED", "fail-closed learning invalidation policy required")
        for dependency in record.get("dependencies") or []:
            _require(dependency in by_id, "learning dependency missing")
            graph[record["id"]].append(dependency)

    visiting, visited = set(), set()
    def visit(node):
        _require(node not in visiting, "circular learning derivation")
        if node in visited:
            return
        visiting.add(node)
        for dependency in graph[node]:
            visit(dependency)
        visiting.remove(node)
        visited.add(node)
    for node in by_id:
        visit(node)
    sequences = [record["integrity"]["sequence"] for record in records]
    _require(sequences == sorted(sequences) and len(set(sequences)) == len(sequences), "append-only learning sequence invalid")
    for record in records:
        prior = record["integrity"].get("previousRecordSha256")
        if record["integrity"]["sequence"] == 1:
            _require(prior is None, "first learning record cannot declare prior history")
        else:
            _require(prior in {row["integrity"]["recordSha256"] for row in records}, "learning history link missing")
    return {"status": "PASS", "records": len(records), "highestStage": max(records, key=lambda row: LEARNING_STAGES.index(row["stage"]))["stage"]}


def evaluate_learning_state(record, *, changed_dimensions=()):
    """Pure invalidation decision; never promotes a record as a side effect."""
    watched = {"source_evidence", "audience_assumptions", "dependencies", "outcomes"}
    changed = set(changed_dimensions)
    _require(changed <= watched, "unknown learning invalidation dimension")
    if changed:
        target = "L0_RAW_OBSERVATION" if "source_evidence" in changed else "L1_NORMALIZED_FINDING"
        return {"status": "INVALIDATED", "action": "DOWNGRADE", "targetStage": target, "reasons": sorted(changed)}
    validate_learning_records([record])
    return {"status": "HELD", "action": "NO_AUTOMATIC_PROMOTION", "targetStage": record["stage"], "reasons": []}


def validate_feedback_routes(events):
    _require(isinstance(events, list) and events, "media learning events are required")
    ids = set()
    for event in events:
        _require(event.get("schemaVersion") == MEDIA_EVENT_VERSION and event.get("eventType") in EVENT_TYPES, "media event contract mismatch")
        _require(event.get("eventId") and event["eventId"] not in ids, "media event IDs must be unique")
        ids.add(event["eventId"])
        forbidden = {"rawIdentity", "email", "username", "ipAddress", "rawComment", "privateMessage"}
        _require(not (forbidden & set(event)), "privacy violation: raw identity or content forbidden")
        _require(event.get("artifactRevisionSha256") and event.get("scope") and event.get("residualUncertainty") is not None, "decision-useful event context required")
        receipt = event.get("routeReceipt") or {}
        _require(all(receipt.get(key) is not None for key in ("changed", "notChanged", "why", "evidenceRefs", "owner", "reviewDate")), "feedback route receipt incomplete")
        _require(receipt["changed"] or receipt["notChanged"], "feedback receipt must say what changed or did not")
    return {"status": "PASS", "events": len(events), "receipts": len(events)}


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))
