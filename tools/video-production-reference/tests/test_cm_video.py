import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from cm_video_ref.contract import ContractError, load_job, validate_job
from cm_video_ref.methodology import MethodologyError, validate_consumed_manifest, validate_evidence_manifest


def generate(tmp):
    script = ROOT / "examples" / "minimal" / "generate_assets.py"
    local_script = Path(tmp) / "generate_assets.py"
    shutil.copy2(script, local_script)
    shutil.copy2(ROOT / "policies" / "chimpmaera-public-copy.json", Path(tmp) / "chimpmaera-public-copy.json")
    subprocess.run([sys.executable, str(local_script)], cwd=tmp, check=True, stdout=subprocess.PIPE, text=True)
    job_path = Path(tmp) / "job" / "video-job.yaml"
    text = job_path.read_text(encoding="utf-8").replace("/assets", str(Path(tmp) / "assets")).replace("/job", str(Path(tmp) / "job"))
    shutil.copy2(Path(tmp) / "chimpmaera-public-copy.json", Path(tmp) / "assets" / "chimpmaera-public-copy.json")
    job_path.write_text(text, encoding="utf-8")
    return job_path, Path(tmp) / "output"


class ContractNegativeProbes(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.job_path, self.output = generate(self.tmp.name)
        self.job = load_job(str(self.job_path))

    def tearDown(self):
        self.tmp.cleanup()

    def assert_rejects(self, message):
        with self.assertRaises(ContractError) as ctx:
            validate_job(self.job, str(self.job_path), str(self.output), render_requested=True)
        self.assertIn(message, str(ctx.exception))

    def test_validate_passes_minimal_job(self):
        result = validate_job(self.job, str(self.job_path))
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["methodology"]["methodologyVersion"], "2026.08.02-v2")
        self.assertEqual(result["methodology"]["outroDurationSeconds"], 10.0)
        self.assertEqual(result["methodology"]["namedHashBoundReviews"], 2)

    def test_bundled_assets_are_optional_and_omitted_by_minimal_job(self):
        self.assertNotIn("referenceAssets", self.job["spec"])
        result = validate_job(self.job, str(self.job_path))
        self.assertFalse(any(item.get("optionalReference") for item in result["assets"]))

    def test_declared_replacement_asset_passes(self):
        replacement = Path(self.tmp.name) / "assets" / "custom-identity.svg"
        replacement.write_text("<svg xmlns=\"http://www.w3.org/2000/svg\"/>\n", encoding="utf-8")
        digest = hashlib.sha256(replacement.read_bytes()).hexdigest()
        self.job["spec"]["referenceAssets"] = [{
            "id": "custom-visual-identity",
            "path": str(replacement),
            "sha256": digest,
            "status": "accepted",
            "mediaClass": "svg",
        }]
        result = validate_job(self.job, str(self.job_path))
        declared = [item for item in result["assets"] if item.get("optionalReference")]
        self.assertEqual([item["id"] for item in declared], ["custom-visual-identity"])

    def test_wrong_declared_reference_hash_rejected(self):
        replacement = Path(self.tmp.name) / "assets" / "custom.txt"
        replacement.write_text("replaceable\n", encoding="utf-8")
        self.job["spec"]["referenceAssets"] = [{
            "id": "custom-reference",
            "path": str(replacement),
            "sha256": "0" * 64,
            "status": "accepted",
            "mediaClass": "text",
        }]
        self.assert_rejects("sha256 mismatch")

    def test_declared_reference_path_escape_rejected(self):
        self.job["spec"]["referenceAssets"] = [{
            "id": "escaped-reference",
            "path": "/etc/passwd",
            "sha256": "0" * 64,
            "status": "accepted",
            "mediaClass": "text",
        }]
        self.assert_rejects("path escape")

    def test_declared_reference_status_rejected(self):
        replacement = Path(self.tmp.name) / "assets" / "custom.txt"
        replacement.write_text("replaceable\n", encoding="utf-8")
        self.job["spec"]["referenceAssets"] = [{
            "id": "custom-reference",
            "path": str(replacement),
            "sha256": hashlib.sha256(replacement.read_bytes()).hexdigest(),
            "status": "unknown",
            "mediaClass": "text",
        }]
        self.assert_rejects("unknown or rejected reference asset")

    def test_wrong_hash_rejected(self):
        self.job["spec"]["assets"]["shots"][0]["sha256"] = "0" * 64
        self.assert_rejects("sha256 mismatch")

    def test_path_escape_rejected(self):
        self.job["spec"]["assets"]["shots"][0]["path"] = "/etc/passwd"
        self.assert_rejects("path escape")

    def test_existing_output_rejected(self):
        (self.output / "synthetic-v2").mkdir(parents=True)
        self.assert_rejects("output already exists")

    def test_public_actions_rejected(self):
        self.job["spec"]["render"]["publicActions"] = "allowed"
        self.assert_rejects("publicActions")

    def test_render_without_text_gate_rejected(self):
        self.job["spec"]["gates"]["textGate"] = "HOLD"
        self.assert_rejects("textGate PASS")

    def test_malformed_scene_timing_rejected(self):
        self.job["spec"]["assets"]["shots"][1]["startSeconds"] = 3.0
        self.assert_rejects("scene timing")

    def test_rejected_asset_rejected(self):
        self.job["spec"]["assets"]["shots"][0]["status"] = "rejected"
        self.assert_rejects("unknown or rejected asset")

    def test_missing_claim_evidence_rejected(self):
        self.job["spec"]["methodology"]["claimBindings"][0]["evidenceRefs"] = []
        self.assert_rejects("lacks valid evidenceRefs")

    def test_missing_semantic_reviewer_rejected(self):
        self.job["spec"]["methodology"]["reviews"]["semanticCorrelation"]["reviewer"] = ""
        self.assert_rejects("semanticCorrelation reviewer")

    def test_nine_second_outro_rejected(self):
        self.job["spec"]["methodology"]["outro"]["durationSeconds"] = 9.0
        self.assert_rejects("exactly ten seconds")

    def test_outro_probe_drift_rejected(self):
        self.job["spec"]["methodology"]["outro"]["timingProbes"][2]["seconds"] = 16.0
        self.assert_rejects("outro timing probe mismatch")

    def test_silent_outro_policy_rejected(self):
        self.job["spec"]["methodology"]["outro"]["terminalAudioPolicy"] = "silent"
        self.assert_rejects("silent-outro")

    def test_safe_area_escape_rejected(self):
        self.job["spec"]["assets"]["shots"][0]["textBoxes"][0]["x"] = 0
        self.assert_rejects("text box starts outside safe area")

    def test_unbound_nonclaim_rejected(self):
        self.job["spec"]["assets"]["shots"][1]["nonClaimRefs"] = []
        self.assert_rejects("every non-claim")

    def test_narration_digits_rejected(self):
        narration = Path(self.tmp.name) / "job" / "NARRATION.md"
        narration.write_text("ChimpMaera validated 3 synthetic checks.\n", encoding="utf-8")
        digest = hashlib.sha256(narration.read_bytes()).hexdigest()
        self.job["spec"]["locks"]["narration"]["sha256"] = digest
        self.job["spec"]["methodology"]["evidence"][0]["sha256"] = digest
        self.assert_rejects("ordinary narration numbers")

    def test_noncanonical_brand_rejected(self):
        narration = Path(self.tmp.name) / "job" / "NARRATION.md"
        narration.write_text("Chimp Mera binds the synthetic evidence.\n", encoding="utf-8")
        digest = hashlib.sha256(narration.read_bytes()).hexdigest()
        self.job["spec"]["locks"]["narration"]["sha256"] = digest
        self.job["spec"]["methodology"]["evidence"][0]["sha256"] = digest
        self.assert_rejects("forbidden public-copy term")


class MethodologyMetadataTests(unittest.TestCase):
    def make_evidence_manifest(self, tmp):
        root = Path(tmp)
        artifacts = []
        for artifact_id in ("qa", "subtitles", "safe-area", "asr", "ocr", "review", "probe-one", "probe-two", "probe-three", "probe-four"):
            path = root / f"{artifact_id}.txt"
            path.write_text(f"synthetic {artifact_id}\n", encoding="utf-8")
            artifacts.append({"id": artifact_id, "path": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
        revision = "a" * 64
        manifest = {
            "schemaVersion": "cm.video-methodology-evidence/v1",
            "methodologyVersion": "2026.08.02-v2",
            "purpose": "smoke-fixture",
            "jobRevisionSha256": revision,
            "artifacts": artifacts,
            "automatedGates": [
                {"family": "full-decode", "status": "PASS", "executionMode": "executed", "evidenceRef": "qa"},
                {"family": "stream-parity", "status": "PASS", "executionMode": "executed", "evidenceRef": "qa"},
                {"family": "loudness", "status": "PASS", "executionMode": "executed", "evidenceRef": "qa"},
                {"family": "subtitles", "status": "PASS", "executionMode": "executed", "evidenceRef": "subtitles"},
                {"family": "safe-area", "status": "PASS", "executionMode": "executed", "evidenceRef": "safe-area"},
                {"family": "asr", "status": "PASS", "executionMode": "fixture", "evidenceRef": "asr"},
                {"family": "ocr", "status": "PASS", "executionMode": "fixture", "evidenceRef": "ocr"},
            ],
            "reviews": {
                "englishCopy": {"status": "PASS", "reviewer": "fixture-reviewer", "revisionSha256": revision, "evidenceRef": "review"},
                "semanticCorrelation": {"status": "PASS", "reviewer": "fixture-reviewer", "revisionSha256": revision, "evidenceRef": "review"},
            },
            "outro": {"status": "PASS", "durationSeconds": 10, "probeEvidenceRefs": ["probe-one", "probe-two", "probe-three", "probe-four"]},
            "publicationBoundary": {"productionClaim": False, "note": "synthetic fixture only"},
        }
        path = root / "methodology-evidence.json"
        path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        return path, manifest

    def test_consumed_delta_manifest_and_hash(self):
        result = validate_consumed_manifest(str(ROOT / "methodology" / "consumed-deltas.json"))
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["consumedDeltas"], ["public-video-process-delta-2026-08-02-01"])

    def test_consumed_delta_tamper_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = ROOT / "methodology"
            shutil.copytree(source, Path(tmp) / "methodology")
            delta = Path(tmp) / "methodology" / "process-delta-2026-08-02-01.json"
            delta.write_text(delta.read_text(encoding="utf-8") + " ", encoding="utf-8")
            with self.assertRaises(MethodologyError):
                validate_consumed_manifest(str(Path(tmp) / "methodology" / "consumed-deltas.json"))

    def test_smoke_evidence_manifest_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, _ = self.make_evidence_manifest(tmp)
            result = validate_evidence_manifest(str(path), tmp)
            self.assertEqual(result["status"], "PASS")
            self.assertEqual(result["verifiedArtifacts"], 10)

    def test_publication_manifest_rejects_fixture_asr(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, manifest = self.make_evidence_manifest(tmp)
            manifest["purpose"] = "publication-candidate"
            path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
            with self.assertRaisesRegex(MethodologyError, "cannot use fixture evidence"):
                validate_evidence_manifest(str(path), tmp)

    def test_declared_positive_and_negative_fixtures(self):
        fixture = json.loads((ROOT / "fixtures" / "methodology-probes.json").read_text(encoding="utf-8"))
        self.assertEqual(fixture["positiveFixture"]["expected"], "PASS")
        self.assertGreaterEqual(len(fixture["negativeProbes"]), 10)
        self.assertEqual(len({item["id"] for item in fixture["negativeProbes"]}), len(fixture["negativeProbes"]))

    def test_schema_files_are_valid_json(self):
        for path in (ROOT / "schemas").glob("*.json"):
            json.loads(path.read_text(encoding="utf-8"))

    def test_oci_methodology_labels_are_inspectable(self):
        dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
        self.assertIn('org.opencontainers.image.version="2026.08.02-v2"', dockerfile)
        self.assertIn('org.chimpmaera.video.methodology.version="2026.08.02-v2"', dockerfile)

    def test_reference_tree_has_no_private_paths_or_token_shapes(self):
        patterns = (
            r"/home/[A-Za-z0-9._-]+/",
            r"/mnt/[A-Za-z0-9._-]+/",
            r"\bhf_[A-Za-z0-9]{20,}\b",
            r"\bgh[pousr]_[A-Za-z0-9]{20,}\b",
            r"\b[0-9]{8,12}:[A-Za-z0-9_-]{30,}\b",
        )
        for path in ROOT.rglob("*"):
            if not path.is_file() or "__pycache__" in path.parts or path.suffix in {".wav", ".png", ".pyc"}:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            for pattern in patterns:
                self.assertIsNone(re.search(pattern, text), f"{pattern} in {path}")


class BundledReferenceAssets(unittest.TestCase):
    def test_manifest_and_bundled_hashes(self):
        manifest_path = ROOT / "assets" / "reference" / "reference-assets.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(manifest["schemaVersion"], "cm.reference-assets/v1")
        self.assertEqual(len(manifest["assets"]), 2)
        for item in manifest["assets"]:
            asset_path = ROOT / item["path"]
            self.assertTrue(asset_path.is_file())
            self.assertEqual(hashlib.sha256(asset_path.read_bytes()).hexdigest(), item["sha256"])
            self.assertTrue(item["use"]["optional"])
            self.assertTrue(item["use"]["replaceable"])
            self.assertTrue(item["use"]["omissionAllowed"])

        voice = next(item for item in manifest["assets"] if item["media"]["mediaClass"] == "wav-audio")
        with wave.open(str(ROOT / voice["path"]), "rb") as stream:
            self.assertEqual(stream.getframerate(), 48000)
            self.assertEqual(stream.getnchannels(), 1)
            self.assertEqual(stream.getsampwidth(), 2)
            self.assertEqual(stream.getnframes(), 372480)
        transcript = ROOT / voice["transcript"]["path"]
        self.assertEqual(hashlib.sha256(transcript.read_bytes()).hexdigest(), voice["transcript"]["sha256"])

    def test_no_release_identifier_spoilers(self):
        fragments = (
            ("ho", "tze"),
            ("rein", "hard"),
            ("sa", "rah"),
            ("mon", "ki"),
            ("rhein", "land"),
        )
        needles = tuple("".join(parts) for parts in fragments)
        repo_root = ROOT.parents[1]
        files = [repo_root / "README.md"]
        files.extend(path for path in ROOT.rglob("*") if path.is_file())
        root_readme = (repo_root / "README.md").read_text(encoding="utf-8")
        self.assertTrue(root_readme.startswith("<p align=\"center\">"))
        self.assertIn("\n# ChimpMaera\n", root_readme)
        self.assertNotIn("# ChimpMaera v0.1", root_readme)
        self.assertNotIn("ChimpMaera v0.1 is", root_readme)
        self.assertIn(
            "**Current regular Latest release:** [`v0.2.0-poc.20260802.3`]"
            "(https://github.com/JimPansky/ChimpMaera/releases/tag/"
            "v0.2.0-poc.20260802.3) — **Governed Company Data Increment**.",
            root_readme,
        )
        self.assertNotIn("**Today's Daily:**", root_readme)
        self.assertNotIn("**Previous Daily provenance:**", root_readme)
        self.assertIn(
            "**Historical predecessor:** [`v0.1.0`]"
            "(https://github.com/JimPansky/ChimpMaera/releases/tag/v0.1.0)"
            " — historical only; it is not the current release.",
            root_readme,
        )
        video_heading = "## Watch ChimpMaera"
        self.assertIn(video_heading, root_readme)
        narrow_section = root_readme.split(video_heading, 1)[1].split("\n## ", 1)[0]
        observed_lines = [line for line in narrow_section.splitlines() if line.startswith("- [")]
        self.assertEqual(observed_lines, [])
        self.assertIn("temporarily unavailable", narrow_section)
        for stale_id in ("Dq_XLEzh5I8", "w4fWgalD_WQ", "SEPbE-EVoNs", "8mB7O81Y2xA", "8lj5nd-LJa4", "mxN9biyelZ0"):
            self.assertNotIn(stale_id, root_readme)
        for needle in needles:
            self.assertNotIn(needle, narrow_section.lower())
        for path in files:
            content = path.read_bytes().decode("utf-8", errors="ignore").lower()
            for needle in needles:
                self.assertNotIn(needle, content, str(path))


if __name__ == "__main__":
    unittest.main()
