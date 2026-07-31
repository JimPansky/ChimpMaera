import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from cm_video_ref.contract import ContractError, load_job, validate_job


def generate(tmp):
    script = ROOT / "examples" / "minimal" / "generate_assets.py"
    local_script = Path(tmp) / "generate_assets.py"
    shutil.copy2(script, local_script)
    subprocess.run([sys.executable, str(local_script)], cwd=tmp, check=True, stdout=subprocess.PIPE, text=True)
    job_path = Path(tmp) / "job" / "video-job.yaml"
    text = job_path.read_text(encoding="utf-8").replace("/assets", str(Path(tmp) / "assets")).replace("/job", str(Path(tmp) / "job"))
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
        (self.output / "synthetic-v1").mkdir(parents=True)
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
        for path in files:
            content = path.read_bytes().decode("utf-8", errors="ignore").lower()
            for needle in needles:
                self.assertNotIn(needle, content, str(path))


if __name__ == "__main__":
    unittest.main()
