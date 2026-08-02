import hashlib
import json
import re
from pathlib import Path


METHODOLOGY_VERSION = "2026.08.02-v2"
REQUIRED_GATE_FAMILIES = {
    "full-decode",
    "stream-parity",
    "loudness",
    "subtitles",
    "safe-area",
    "asr",
    "ocr",
}


class MethodologyError(Exception):
    pass


def _require(condition, message):
    if not condition:
        raise MethodologyError(message)


def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _is_sha256(value):
    return isinstance(value, str) and re.fullmatch(r"[a-f0-9]{64}", value) is not None


def _load_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise MethodologyError(f"unreadable JSON {path}: {exc}") from exc


def _public_relative_path(value, field):
    _require(isinstance(value, str) and value, f"{field} must be a non-empty path")
    path = Path(value)
    _require(not path.is_absolute(), f"{field} must be repository-relative")
    _require(".." not in path.parts, f"{field} must not traverse parents")
    return path


def validate_process_delta(delta):
    _require(isinstance(delta, dict), "process delta must be an object")
    _require(delta.get("schemaVersion") == "cm.public-video-process-delta/v1", "process delta schemaVersion is unsupported")
    _require(delta.get("methodologyVersion") == METHODOLOGY_VERSION, "process delta methodologyVersion mismatch")
    _require(delta.get("status") == "ACCEPTED", "process delta must be ACCEPTED")
    _require(_is_sha256(delta.get("sourceEvidenceSha256")), "process delta sourceEvidenceSha256 is invalid")
    improvements = delta.get("portableImprovements")
    _require(isinstance(improvements, list) and improvements, "process delta needs portableImprovements")
    ids = set()
    for item in improvements:
        _require(isinstance(item, dict), "portable improvement must be an object")
        item_id = item.get("id")
        _require(isinstance(item_id, str) and item_id and item_id not in ids, "portable improvement id is missing or duplicated")
        ids.add(item_id)
        _require(item.get("classification") in {"portable-now", "needs-adaptation"}, f"invalid portability classification for {item_id}")
        _require(isinstance(item.get("rule"), str) and item["rule"], f"portable improvement rule missing for {item_id}")
        _require(isinstance(item.get("publicComponents"), list) and item["publicComponents"], f"publicComponents missing for {item_id}")
    boundary = delta.get("evidenceBoundary") or {}
    _require(boundary.get("historicalEvidenceRewritten") is False, "historical evidence must not be rewritten")
    _require(boundary.get("privateRunArtifactsPublished") is False, "private run artifacts must not be published")
    _require(boundary.get("productionClaim") is False, "process delta must not assert production maturity")
    return {"status": "PASS", "portableImprovementIds": sorted(ids)}


def validate_consumed_manifest(manifest_path):
    manifest_path = Path(manifest_path).resolve()
    data = _load_json(manifest_path)
    _require(data.get("schemaVersion") == "cm.video-methodology-consumed-deltas/v1", "consumed manifest schemaVersion is unsupported")
    _require(data.get("methodologyVersion") == METHODOLOGY_VERSION, "consumed manifest methodologyVersion mismatch")
    entries = data.get("consumedDeltas")
    _require(isinstance(entries, list) and entries, "consumed manifest needs consumedDeltas")
    verified = []
    for entry in entries:
        rel = _public_relative_path(entry.get("publicDeltaPath"), "publicDeltaPath")
        path = (manifest_path.parent / rel).resolve()
        _require(manifest_path.parent == path.parent or manifest_path.parent in path.parents, "publicDeltaPath escapes manifest directory")
        _require(path.is_file(), f"consumed public delta is missing: {rel}")
        _require(_is_sha256(entry.get("publicDeltaSha256")), f"publicDeltaSha256 is invalid for {rel}")
        _require(_sha256(path) == entry["publicDeltaSha256"], f"public delta checksum mismatch: {rel}")
        delta = _load_json(path)
        validate_process_delta(delta)
        _require(delta.get("deltaId") == entry.get("deltaId"), f"deltaId mismatch for {rel}")
        _require(delta.get("sourceEvidenceSha256") == entry.get("sourceEvidenceSha256"), f"source evidence digest mismatch for {rel}")
        verified.append(entry["deltaId"])
    assumptions = data.get("decisionRecord") or {}
    for key in ("assumption", "risk", "fallback", "reviewMarker", "rollbackMarker"):
        _require(isinstance(assumptions.get(key), str) and assumptions[key], f"decisionRecord.{key} is required")
    return {"status": "PASS", "methodologyVersion": METHODOLOGY_VERSION, "consumedDeltas": verified}


def _parse_srt_timestamp(value):
    match = re.fullmatch(r"(\d{2}):(\d{2}):(\d{2}),(\d{3})", value.strip())
    _require(match is not None, f"invalid SRT timestamp: {value}")
    hours, minutes, seconds, millis = map(int, match.groups())
    _require(minutes < 60 and seconds < 60, f"invalid SRT timestamp: {value}")
    return hours * 3600 + minutes * 60 + seconds + millis / 1000.0


def validate_subtitles(path, duration_seconds):
    text = Path(path).read_text(encoding="utf-8")
    blocks = [block.strip().splitlines() for block in re.split(r"\n\s*\n", text.strip()) if block.strip()]
    _require(blocks, "subtitle file has no cues")
    previous_end = 0.0
    cue_count = 0
    for block in blocks:
        _require(len(block) >= 3 and block[0].strip().isdigit(), "subtitle cue must have index, timing, and text")
        timing = block[1].split("-->")
        _require(len(timing) == 2, "subtitle cue timing is invalid")
        start = _parse_srt_timestamp(timing[0])
        end = _parse_srt_timestamp(timing[1])
        _require(start >= previous_end - 0.001 and end > start, "subtitle cues overlap or have invalid duration")
        _require(end <= duration_seconds + 0.05, "subtitle cue exceeds video duration")
        _require(any(line.strip() for line in block[2:]), "subtitle cue text is empty")
        previous_end = end
        cue_count += 1
    return cue_count


def _scan_public_copy(text, policy, narration=False):
    canonical = policy.get("canonicalName")
    _require(isinstance(canonical, str) and canonical, "public-copy policy canonicalName is required")
    folded = text.casefold()
    for term in policy.get("forbiddenTerms", []):
        if re.search(rf"\b{re.escape(term.casefold())}\b", folded):
            raise MethodologyError(f"forbidden public-copy term: {term}")
    for token in policy.get("forbiddenLanguageTokens", []):
        if re.search(rf"\b{re.escape(token.casefold())}\b", folded):
            raise MethodologyError(f"non-English public-copy token: {token}")
    prose = re.sub(r"\b\d{2}:\d{2}:\d{2},\d{3}\b", "", text)
    prose = re.sub(r"(?m)^\s*\d+\s*$", "", prose)
    _require(re.search(r"[äöüß]", prose, re.IGNORECASE) is None, "non-English public-copy character")
    _require(re.search(r"(?<!\w)\d+,\d+(?!\w)", prose) is None, "comma decimal is forbidden in public copy")
    machine_stripped = re.sub(
        r"https?://\S+|\b(?:sha256:)?[a-f0-9]{32,64}\b|\bv?\d+(?:\.\d+){1,3}(?:[-+][A-Za-z0-9._-]+)?\b|\b\d{4}-\d{2}-\d{2}\b",
        "",
        prose,
        flags=re.IGNORECASE,
    )
    if narration:
        _require(re.search(r"\d", machine_stripped) is None, "ordinary narration numbers must use English words")
    elif policy.get("visibleNumberStyle") == "digits-with-english-units-and-dot-decimals":
        without_units = re.sub(
            r"(?<!\w)\d+(?:\.\d+)?\s*(?:%|ms|s|seconds?|minutes?|hours?|px|fps|Hz|kHz|MHz|MB|GB|GiB|dB|dBFS|LUFS)(?!\w)",
            "",
            machine_stripped,
            flags=re.IGNORECASE,
        )
        _require(re.search(r"\d", without_units) is None, "visible public-copy numbers need English units or a structured exception")


def validate_methodology_job(job, job_path, assets_root, expected_duration):
    spec = job.get("spec") or {}
    methodology = spec.get("methodology") or {}
    _require(methodology.get("version") == METHODOLOGY_VERSION, "methodology.version mismatch")

    policy_item = methodology.get("publicCopyPolicy") or {}
    policy_path = _resolve_job_asset(policy_item.get("path"), job_path, assets_root)
    _require(policy_path.is_file(), "public-copy policy is missing")
    _require(_is_sha256(policy_item.get("sha256")) and _sha256(policy_path) == policy_item["sha256"], "public-copy policy checksum mismatch")
    policy = _load_json(policy_path)
    _require(policy.get("schemaVersion") == "cm.public-copy-policy/v1", "public-copy policy schemaVersion is unsupported")
    _require(policy.get("language") == "en", "public-copy policy must require English")

    reviews = methodology.get("reviews") or {}
    for review_name in ("englishCopy", "semanticCorrelation"):
        review = reviews.get(review_name) or {}
        _require(review.get("status") == "PASS", f"{review_name} review must PASS")
        _require(isinstance(review.get("reviewer"), str) and review["reviewer"].strip(), f"{review_name} reviewer is required")
        _require(_is_sha256(review.get("revisionSha256")), f"{review_name} review must be revision hash-bound")

    evidence = methodology.get("evidence")
    _require(isinstance(evidence, list) and evidence, "methodology evidence list is required")
    evidence_ids = set()
    for item in evidence:
        evidence_id = item.get("id")
        _require(isinstance(evidence_id, str) and evidence_id and evidence_id not in evidence_ids, "evidence id is missing or duplicated")
        evidence_ids.add(evidence_id)
        evidence_path = _resolve_job_asset(item.get("path"), job_path, assets_root)
        _require(evidence_path.is_file(), f"evidence {evidence_id} path is missing")
        _require(_is_sha256(item.get("sha256")) and _sha256(evidence_path) == item["sha256"], f"evidence {evidence_id} checksum mismatch")
        _require(isinstance(item.get("locator"), str) and item["locator"] and not Path(item["locator"]).is_absolute(), f"evidence {evidence_id} locator must be public-relative")

    claims = methodology.get("claimBindings")
    _require(isinstance(claims, list) and claims, "claimBindings are required")
    claim_ids = set()
    visual_claims = set()
    non_claims = set()
    for item in claims:
        claim_id = item.get("id")
        _require(isinstance(claim_id, str) and claim_id and claim_id not in claim_ids, "claim binding id is missing or duplicated")
        claim_ids.add(claim_id)
        _scan_public_copy(item.get("text", ""), policy)
        classification = item.get("classification")
        _require(classification in {"claim", "non-claim"}, f"invalid classification for {claim_id}")
        if classification == "claim":
            refs = item.get("evidenceRefs")
            visuals = item.get("visualRefs")
            _require(isinstance(refs, list) and refs and set(refs) <= evidence_ids, f"claim {claim_id} lacks valid evidenceRefs")
            _require(isinstance(visuals, list) and visuals, f"claim {claim_id} lacks visualRefs")
            visual_claims.add(claim_id)
        else:
            _require(isinstance(item.get("limitation"), str) and item["limitation"], f"non-claim {claim_id} lacks limitation")
            non_claims.add(claim_id)

    locks = spec.get("locks") or {}
    narration = locks.get("narration") or {}
    if narration.get("path"):
        narration_path = _resolve_job_asset(narration["path"], job_path, assets_root)
        _scan_public_copy(narration_path.read_text(encoding="utf-8"), policy, narration=True)

    scene_claims = set()
    scene_non_claims = set()
    shots = (spec.get("assets") or {}).get("shots") or []
    for shot in shots:
        safe = shot.get("safeArea") or {}
        _require(all(isinstance(safe.get(k), (int, float)) for k in ("x", "y", "width", "height")), f"safeArea missing for {shot.get('sceneId')}")
        _require(safe["x"] >= 0 and safe["y"] >= 0 and safe["width"] > 0 and safe["height"] > 0, f"safeArea invalid for {shot.get('sceneId')}")
        _require(safe["x"] + safe["width"] <= spec["video"]["width"] and safe["y"] + safe["height"] <= spec["video"]["height"], f"safeArea exceeds frame for {shot.get('sceneId')}")
        for box in shot.get("textBoxes", []):
            _require(box["x"] >= safe["x"] and box["y"] >= safe["y"], f"text box starts outside safe area for {shot.get('sceneId')}")
            _require(box["x"] + box["width"] <= safe["x"] + safe["width"] and box["y"] + box["height"] <= safe["y"] + safe["height"], f"text box exceeds safe area for {shot.get('sceneId')}")
            _scan_public_copy(box.get("text", ""), policy)
        refs = set(shot.get("claimRefs") or [])
        non_refs = set(shot.get("nonClaimRefs") or [])
        _require(refs <= visual_claims, f"scene {shot.get('sceneId')} has unknown claimRefs")
        _require(non_refs <= non_claims, f"scene {shot.get('sceneId')} has unknown nonClaimRefs")
        scene_claims |= refs
        scene_non_claims |= non_refs
        _require(isinstance(shot.get("visualDescription"), str) and shot["visualDescription"], f"visualDescription missing for {shot.get('sceneId')}")
    _require(scene_claims == visual_claims, "every claim must be timed to at least one scene")
    _require(scene_non_claims == non_claims, "every non-claim must be timed to at least one scene")

    outro = methodology.get("outro") or {}
    _require(outro.get("designed") is True, "outro must be deliberately designed")
    _require(abs(float(outro.get("durationSeconds", -1)) - 10.0) < 0.001, "outro must be exactly ten seconds")
    start = float(outro.get("startSeconds", -1))
    end = float(outro.get("endSeconds", -1))
    _require(abs(end - expected_duration) < 0.001 and abs(end - start - 10.0) < 0.001, "outro timing does not bind to the video end")
    _require(outro.get("terminalAudioPolicy") != "silent", "silent-outro acceptance is not portable")
    probes = outro.get("timingProbes") or []
    expected_offsets = [0.0, 2.5, 5.0, 9.9]
    _require(len(probes) == len(expected_offsets), "outro needs start, quarter, midpoint, and end probes")
    for probe, offset in zip(probes, expected_offsets):
        _require(abs(float(probe.get("seconds", -1)) - (start + offset)) <= 0.05, "outro timing probe mismatch")

    subtitles = (spec.get("assets") or {}).get("subtitles") or {}
    subtitle_path = _resolve_job_asset(subtitles.get("path"), job_path, assets_root)
    _require(subtitle_path.is_file(), "subtitle sidecar is required")
    _require(_is_sha256(subtitles.get("sha256")) and _sha256(subtitle_path) == subtitles["sha256"], "subtitle checksum mismatch")
    _require(subtitles.get("language") == "en", "subtitle language must be English")
    cue_count = validate_subtitles(subtitle_path, expected_duration)
    _scan_public_copy(subtitle_path.read_text(encoding="utf-8"), policy)
    return {
        "methodologyVersion": METHODOLOGY_VERSION,
        "claimBindings": len(visual_claims),
        "nonClaims": len(non_claims),
        "subtitleCues": cue_count,
        "outroDurationSeconds": 10.0,
        "namedHashBoundReviews": 2,
    }


def _resolve_job_asset(value, job_path, assets_root):
    _require(isinstance(value, str) and value, "methodology asset path must be non-empty")
    raw = Path(value)
    resolved = raw.resolve() if raw.is_absolute() else (Path(job_path).resolve().parent / raw).resolve()
    roots = [Path(job_path).resolve().parent]
    if assets_root:
        roots.append(Path(assets_root).resolve())
    for root in (Path("/job"), Path("/assets")):
        if root.exists():
            roots.append(root.resolve())
    _require(any(resolved == root or root in resolved.parents for root in roots), f"methodology asset path escape rejected: {value}")
    return resolved


def validate_evidence_manifest(manifest_path, artifacts_root=None):
    manifest_path = Path(manifest_path).resolve()
    data = _load_json(manifest_path)
    _require(data.get("schemaVersion") == "cm.video-methodology-evidence/v1", "evidence manifest schemaVersion is unsupported")
    _require(data.get("methodologyVersion") == METHODOLOGY_VERSION, "evidence manifest methodologyVersion mismatch")
    _require(_is_sha256(data.get("jobRevisionSha256")), "jobRevisionSha256 is invalid")
    purpose = data.get("purpose")
    _require(purpose in {"smoke-fixture", "publication-candidate"}, "evidence manifest purpose is invalid")
    root = Path(artifacts_root).resolve() if artifacts_root else manifest_path.parent
    verified_artifacts = set()
    for artifact in data.get("artifacts") or []:
        artifact_id = artifact.get("id")
        _require(isinstance(artifact_id, str) and artifact_id and artifact_id not in verified_artifacts, "artifact id is missing or duplicated")
        rel = _public_relative_path(artifact.get("path"), f"artifact {artifact_id} path")
        path = (root / rel).resolve()
        _require(root == path.parent or root in path.parents, f"artifact path escapes root: {rel}")
        _require(path.is_file(), f"evidence artifact missing: {rel}")
        _require(_is_sha256(artifact.get("sha256")) and _sha256(path) == artifact["sha256"], f"evidence artifact checksum mismatch: {rel}")
        verified_artifacts.add(artifact_id)
    gates = data.get("automatedGates") or []
    gate_ids = {gate.get("family") for gate in gates if gate.get("status") == "PASS"}
    _require(REQUIRED_GATE_FAMILIES <= gate_ids, f"missing PASS gate families: {sorted(REQUIRED_GATE_FAMILIES - gate_ids)}")
    for gate in gates:
        _require(gate.get("evidenceRef") in verified_artifacts, f"gate {gate.get('family')} lacks a verified evidenceRef")
        _require(gate.get("executionMode") in {"executed", "fixture"}, f"gate {gate.get('family')} executionMode is invalid")
        if purpose == "publication-candidate":
            _require(gate.get("executionMode") == "executed", f"publication gate {gate.get('family')} cannot use fixture evidence")
    for review_name in ("englishCopy", "semanticCorrelation"):
        review = (data.get("reviews") or {}).get(review_name) or {}
        _require(review.get("status") == "PASS", f"evidence review {review_name} must PASS")
        _require(isinstance(review.get("reviewer"), str) and review["reviewer"].strip(), f"evidence review {review_name} needs a reviewer")
        _require(_is_sha256(review.get("revisionSha256")), f"evidence review {review_name} needs a revision hash")
        _require(review.get("evidenceRef") in verified_artifacts, f"evidence review {review_name} lacks verified evidence")
    outro = data.get("outro") or {}
    _require(outro.get("status") == "PASS" and abs(float(outro.get("durationSeconds", -1)) - 10.0) < 0.001, "evidence outro gate must PASS at ten seconds")
    _require(len(outro.get("probeEvidenceRefs") or []) == 4 and set(outro["probeEvidenceRefs"]) <= verified_artifacts, "outro needs four verified timing probes")
    _require((data.get("publicationBoundary") or {}).get("productionClaim") is False, "evidence manifest must not assert production maturity")
    return {"status": "PASS", "methodologyVersion": METHODOLOGY_VERSION, "verifiedArtifacts": len(verified_artifacts), "gateFamilies": sorted(gate_ids)}
