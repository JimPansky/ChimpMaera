import hashlib
import json
import os
from pathlib import Path
import re
import wave

from .methodology import MethodologyError, validate_methodology_job
from .visual_governance import VisualGovernanceError, load_json as load_governance_json, validate_storyboard

try:
    import yaml
except Exception:  # pragma: no cover
    yaml = None


FORBIDDEN_STRINGS = (
    "centipape",
    "deprecated CentipApe asset",
    "563c8160",
    "openclaw-staged-",
    "hf_",
    "telegram",
)
FORBIDDEN_EDITORIAL_DURATION_KEYS = {
    "durationtarget",
    "durationtargetseconds",
    "targetduration",
    "targetdurationseconds",
    "maximumduration",
    "maximumdurationseconds",
    "maxduration",
    "maxdurationseconds",
    "minimumduration",
    "minimumdurationseconds",
    "minduration",
    "mindurationseconds",
    "durationgate",
    "durationpassfail",
    "truncatetofit",
    "truncationtofit",
    "padtofit",
    "paddingtofit",
}


class ContractError(Exception):
    pass


def load_job(path):
    text = Path(path).read_text(encoding="utf-8")
    if path.endswith(".json"):
        return json.loads(text)
    if yaml is None:
        raise ContractError("YAML job requires PyYAML/python3-yaml")
    return yaml.safe_load(text)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _require(condition, message):
    if not condition:
        raise ContractError(message)


def _normalized_key(value):
    return re.sub(r"[^a-z0-9]", "", str(value).casefold())


def _reject_editorial_duration_controls(value, location="job"):
    if isinstance(value, dict):
        for key, item in value.items():
            if _normalized_key(key) in FORBIDDEN_EDITORIAL_DURATION_KEYS:
                raise ContractError(f"fixed Daily duration control forbidden at {location}.{key}")
            _reject_editorial_duration_controls(item, f"{location}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            _reject_editorial_duration_controls(item, f"{location}[{index}]")


def _resolve_declared(path_value, job_path, assets_root=None):
    _require(isinstance(path_value, str) and path_value, "path must be a non-empty string")
    raw = Path(path_value)
    if raw.is_absolute():
        resolved = raw.resolve()
    else:
        base = Path(job_path).resolve().parent
        resolved = (base / raw).resolve()

    allowed = [Path(job_path).resolve().parent]
    if assets_root:
        allowed.append(Path(assets_root).resolve())
    for root in ("/job", "/assets"):
        p = Path(root)
        if p.exists():
            allowed.append(p.resolve())

    if not any(resolved == root or root in resolved.parents for root in allowed):
        raise ContractError(f"path escape or unmounted path rejected: {path_value}")
    return resolved


def _resolve_assets_root(path_value, job_path):
    _require(isinstance(path_value, str) and path_value, "roots.assets must be a non-empty string")
    raw = Path(path_value)
    resolved = raw.resolve() if raw.is_absolute() else (Path(job_path).resolve().parent / raw).resolve()
    job_dir = Path(job_path).resolve().parent
    if str(resolved) == "/assets":
        return resolved
    if resolved.name == "assets" and resolved.parent == job_dir.parent:
        return resolved
    if resolved.name == "assets" and resolved == (job_dir / "assets").resolve():
        return resolved
    raise ContractError(f"asset root escape rejected: {path_value}")


def _check_hash(item, path):
    expected = item.get("sha256")
    _require(isinstance(expected, str) and len(expected) == 64, f"missing sha256 for {item.get('id') or path}")
    observed = sha256_file(path)
    _require(observed == expected, f"sha256 mismatch for {path}: expected {expected}, observed {observed}")
    return observed


def png_dimensions(path):
    with open(path, "rb") as f:
        header = f.read(24)
    _require(header.startswith(b"\x89PNG\r\n\x1a\n"), f"not a PNG: {path}")
    return int.from_bytes(header[16:20], "big"), int.from_bytes(header[20:24], "big")


def wav_info(path):
    with wave.open(str(path), "rb") as w:
        frames = w.getnframes()
        rate = w.getframerate()
        channels = w.getnchannels()
        duration = frames / float(rate)
    return {"frames": frames, "sampleRate": rate, "channels": channels, "durationSeconds": duration}


def validate_job(job, job_path, output_root=None, render_requested=False):
    _require(isinstance(job, dict), "job must be an object")
    _require(job.get("apiVersion") in ("cm.video/v1", "cm.video/v2"), "apiVersion must be cm.video/v1 or cm.video/v2")
    _require(job.get("kind") == "VideoJob", "kind must be VideoJob")
    metadata = job.get("metadata") or {}
    spec = job.get("spec") or {}
    _reject_editorial_duration_controls(spec, "spec")
    _require(metadata.get("immutableOutputVersion"), "metadata.immutableOutputVersion is required")
    _require(spec.get("mode") in ("validate-only", "full-render"), "spec.mode must be validate-only or full-render")

    render = spec.get("render") or {}
    _require(render.get("publicActions") == "forbidden", "spec.render.publicActions must be forbidden")
    _require(render.get("overwrite") is False, "spec.render.overwrite must be false")
    if output_root and render_requested:
        out_dir = Path(output_root).resolve() / metadata["immutableOutputVersion"]
        _require(not out_dir.exists(), f"output already exists: {out_dir}")

    lang = spec.get("language") or {}
    _require(lang.get("strategy") == "idiomatic-human-reviewed", "localization must be idiomatic-human-reviewed")
    _require(lang.get("literalTranslationForbidden") is True, "literal translation must be forbidden")
    law = spec.get("narrationVisualLaw") or {}
    _require(law.get("narrationExplainsPrinciples") is True, "narration must explain principles")
    _require(law.get("visualsCarryDetails") is True, "visuals must carry IDs/hashes/amounts/versions/details")

    video = spec.get("video") or {}
    _require(video.get("width") == 1280 and video.get("height") == 720, "video must be 1280x720")
    _require(video.get("fps") == 30, "video fps must be 30")
    _require(video.get("pixelFormat") == "yuv420p", "video pixelFormat must be yuv420p")
    transition = video.get("transition") or {}
    _require(transition.get("type") == "direct-dissolve", "transition must be direct-dissolve")
    _require(float(transition.get("seconds")) >= 0, "transition seconds must be non-negative")

    gates = spec.get("gates") or {}
    if render.get("full"):
        _require(spec.get("mode") == "full-render", "full render requires spec.mode full-render")
        _require(gates.get("textGate") == "PASS", "full render requires textGate PASS")
        _require(gates.get("shotGate") == "PASS", "full render requires shotGate PASS")
        pre_render = spec.get("preRenderGate") or {}
        _require(pre_render.get("status") == "PASS_AUTOMATED", "full render requires storyboard pre-render gate")
        storyboard_path = _resolve_declared(pre_render.get("storyboardPath"), job_path)
        _require(storyboard_path.is_file(), "full render storyboard package is missing")
        _check_hash({"id": "storyboard", "sha256": pre_render.get("storyboardSha256")}, storyboard_path)
        try:
            governance = validate_storyboard(load_governance_json(storyboard_path), stage="FULL_RENDER")
        except VisualGovernanceError as exc:
            raise ContractError(str(exc)) from exc

    roots = spec.get("roots") or {}
    assets_root = roots.get("assets")
    if assets_root:
        assets_root = _resolve_assets_root(assets_root, job_path)

    assets = spec.get("assets") or {}
    shots = assets.get("shots") or []
    _require(len(shots) >= 1, "at least one shot is required")
    scene_ids = set()
    total = 0.0
    observed_assets = []
    previous_end = None
    for shot in shots:
        _require(shot.get("status") == "accepted", f"unknown or rejected asset: {shot.get('id')}")
        sid = shot.get("sceneId")
        _require(isinstance(sid, str) and sid.startswith("S"), "sceneId must start with S")
        _require(sid not in scene_ids, f"duplicate sceneId: {sid}")
        scene_ids.add(sid)
        start = float(shot.get("startSeconds"))
        end = float(shot.get("endSeconds"))
        _require(end > start, f"invalid timing for {sid}")
        if previous_end is not None:
            _require(abs(start - previous_end) < 0.001, f"scene timing gap/overlap before {sid}")
        previous_end = end
        total += end - start
        path = _resolve_declared(shot.get("path"), job_path, assets_root)
        _require(path.exists(), f"missing shot: {path}")
        digest = _check_hash(shot, path)
        dims = png_dimensions(path)
        _require(dims == (video["width"], video["height"]), f"wrong PNG dimensions for {sid}: {dims}")
        observed_assets.append({"id": sid, "path": str(path), "sha256": digest, "type": "png"})

    expected_duration = float(video.get("durationSeconds"))
    _require(abs(total - expected_duration) < 0.001, f"scene duration total {total} != video duration {expected_duration}")

    audio = assets.get("audio") or {}
    _require(audio.get("status") == "accepted", "audio asset must be accepted")
    audio_path = _resolve_declared(audio.get("path"), job_path, assets_root)
    _require(audio_path.exists(), f"missing audio: {audio_path}")
    audio_digest = _check_hash(audio, audio_path)
    info = wav_info(audio_path)
    _require(info["sampleRate"] == 48000 and info["channels"] == 1, "audio must be locked mono 48 kHz WAV")
    _require(abs(info["durationSeconds"] - expected_duration) <= 0.05, "locked audio duration must match measured video duration; truncation or padding to fit is forbidden")
    observed_assets.append({"id": "audio", "path": str(audio_path), "sha256": audio_digest, "type": "wav"})

    locks = spec.get("locks") or {}
    for group in ("narration", "facts"):
        item = locks.get(group) or {}
        if item.get("path"):
            p = _resolve_declared(item["path"], job_path, assets_root)
            _require(p.exists(), f"missing lock {group}: {p}")
            observed_assets.append({"id": group, "path": str(p), "sha256": _check_hash(item, p), "type": group})

    reference_assets = spec.get("referenceAssets") or []
    _require(isinstance(reference_assets, list), "spec.referenceAssets must be an array")
    reference_ids = set()
    for item in reference_assets:
        _require(isinstance(item, dict), "declared reference asset must be an object")
        asset_id = item.get("id")
        _require(isinstance(asset_id, str) and asset_id, "declared reference asset id is required")
        _require(asset_id not in reference_ids, f"duplicate reference asset id: {asset_id}")
        reference_ids.add(asset_id)
        _require(item.get("status") == "accepted", f"unknown or rejected reference asset: {asset_id}")
        media_class = item.get("mediaClass")
        _require(isinstance(media_class, str) and media_class, f"mediaClass is required for {asset_id}")
        p = _resolve_declared(item.get("path"), job_path, assets_root)
        _require(p.exists(), f"missing reference asset: {p}")
        observed_assets.append({
            "id": asset_id,
            "path": str(p),
            "sha256": _check_hash(item, p),
            "type": media_class,
            "optionalReference": True,
        })

    for text_path in [Path(job_path), *[Path(a["path"]) for a in observed_assets if a["type"] in ("narration", "facts")]]:
        content = text_path.read_text(encoding="utf-8", errors="ignore")
        for needle in FORBIDDEN_STRINGS:
            _require(needle not in content, f"forbidden string found in {text_path}: {needle}")

    methodology_result = None
    if job.get("apiVersion") == "cm.video/v2":
        try:
            methodology_result = validate_methodology_job(job, job_path, assets_root, expected_duration)
        except MethodologyError as exc:
            raise ContractError(str(exc)) from exc

    return {
        "status": "PASS",
        "mode": spec["mode"],
        "rendered": False,
        "locksVerified": True,
        "textGate": gates.get("textGate"),
        "shotGate": gates.get("shotGate"),
        "fullRenderAuthorized": bool(render.get("full")),
        "publicActions": "FORBIDDEN",
        "assets": observed_assets,
        "durationSeconds": expected_duration,
        "durationRole": "LOCKED_ASSET_MEASUREMENT_NOT_EDITORIAL_TARGET",
        "methodology": methodology_result,
        "visualGovernance": governance if render.get("full") else None,
    }
