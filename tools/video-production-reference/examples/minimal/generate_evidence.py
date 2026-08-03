#!/usr/bin/env python3
import hashlib
import json
import sys
from pathlib import Path


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main():
    root = Path(sys.argv[1]).resolve()
    evidence = root / "evidence"
    evidence.mkdir(parents=True, exist_ok=True)
    output = root / "output" / "synthetic-v2"
    job = root / "job" / "video-job.yaml"
    artifacts = root / "assets"

    asr = evidence / "asr-fixture-receipt.json"
    write_json(asr, {
        "status": "PASS",
        "executionMode": "fixture",
        "note": "Contract smoke only; no ASR model or production accuracy is claimed.",
        "sourceAudioSha256": sha(artifacts / "locked-tone.wav"),
        "expected": "synthetic fixture",
        "observed": "synthetic fixture",
        "audienceText": "ChimpMaera is a local synthetic proof of concept, not a production deployment."
    })
    ocr = evidence / "ocr-fixture-receipt.json"
    write_json(ocr, {
        "status": "PASS",
        "executionMode": "fixture",
        "note": "Contract smoke only; no OCR model or production accuracy is claimed.",
        "expectedTokens": ["ChimpMaera", "evidence"],
        "observedTokens": ["ChimpMaera", "evidence"],
        "audienceText": "Local synthetic proof of concept"
    })
    review = evidence / "named-review-fixture.json"
    write_json(review, {
        "status": "PASS",
        "reviewer": "synthetic-fixture-reviewer",
        "revisionSha256": sha(job),
        "scope": ["English public copy", "timed semantic correlation"],
        "note": "Synthetic contract fixture; not editorial approval for publication."
    })

    artifact_rows = [
        ("qa-report", output / "QA.json"),
        ("job-preflight", job),
        ("subtitles", artifacts / "captions.en.srt"),
        ("asr-receipt", asr),
        ("ocr-receipt", ocr),
        ("named-review", review),
        ("public-copy-policy", artifacts / "chimpmaera-public-copy.json"),
    ]
    probe_ids = []
    for name in ("outro-start.png", "outro-quarter.png", "outro-midpoint.png", "outro-end.png"):
        probe_id = name.removesuffix(".png")
        artifact_rows.append((probe_id, evidence / name))
        probe_ids.append(probe_id)

    manifest = {
        "schemaVersion": "cm.video-methodology-evidence/v1",
        "methodologyVersion": "2026.08.02-v2",
        "purpose": "smoke-fixture",
        "jobRevisionSha256": sha(job),
        "artifacts": [
            {"id": artifact_id, "path": path.relative_to(root).as_posix(), "sha256": sha(path)}
            for artifact_id, path in artifact_rows
        ],
        "publicCopyPolicy": {"artifactRef": "public-copy-policy"},
        "automatedGates": [
            {"family": "full-decode", "status": "PASS", "executionMode": "executed", "evidenceRef": "qa-report"},
            {"family": "stream-parity", "status": "PASS", "executionMode": "executed", "evidenceRef": "qa-report"},
            {"family": "loudness", "status": "PASS", "executionMode": "executed", "evidenceRef": "qa-report"},
            {"family": "subtitles", "status": "PASS", "executionMode": "executed", "evidenceRef": "subtitles"},
            {"family": "safe-area", "status": "PASS", "executionMode": "executed", "evidenceRef": "job-preflight"},
            {"family": "asr", "status": "PASS", "executionMode": "fixture", "evidenceRef": "asr-receipt"},
            {"family": "ocr", "status": "PASS", "executionMode": "fixture", "evidenceRef": "ocr-receipt"}
        ],
        "reviews": {
            "englishCopy": {"status": "PASS", "reviewer": "synthetic-fixture-reviewer", "revisionSha256": sha(job), "evidenceRef": "named-review"},
            "semanticCorrelation": {"status": "PASS", "reviewer": "synthetic-fixture-reviewer", "revisionSha256": sha(job), "evidenceRef": "named-review"}
        },
        "outro": {"status": "PASS", "durationSeconds": 10, "probeEvidenceRefs": probe_ids},
        "publicationBoundary": {"productionClaim": False, "note": "Synthetic smoke only; ASR/OCR fixture receipts are not publication evidence."}
    }
    manifest_path = evidence / "methodology-evidence.json"
    write_json(manifest_path, manifest)
    print(manifest_path)


if __name__ == "__main__":
    main()
