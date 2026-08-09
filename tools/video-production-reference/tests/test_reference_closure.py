import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "tools/video-production-reference/scripts/verify_reference_closure.py"
SPEC = importlib.util.spec_from_file_location("verify_reference_closure", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class ReferenceClosureTest(unittest.TestCase):
    def test_public_tree_passes_deterministically(self):
        first = MODULE.verify_reference_closure(REPO_ROOT)
        second = MODULE.verify_reference_closure(REPO_ROOT)
        self.assertEqual(first, second)
        self.assertEqual(first["status"], "PASS")
        self.assertIn(
            "tools/video-production-reference/bin/cm-video",
            first["checkedPaths"],
        )
        self.assertIn(
            "tools/video-production-reference/schemas/storyboard.schema.json",
            first["checkedPaths"],
        )
        self.assertIn(
            "tools/video-production-reference/scripts/smoke.sh",
            first["checkedPaths"],
        )

    def test_missing_referenced_runtime_file_fails_closed(self):
        with tempfile.TemporaryDirectory(prefix="cm-video-closure-") as temporary:
            fixture = Path(temporary)
            shutil.copytree(
                REPO_ROOT / "tools/video-production-reference",
                fixture / "tools/video-production-reference",
            )
            shutil.copy2(REPO_ROOT / "MEDIA-LICENSE.md", fixture / "MEDIA-LICENSE.md")
            (fixture / "tools/video-production-reference/bin/cm-video").unlink()
            with self.assertRaisesRegex(
                MODULE.ClosureError,
                "REFERENCED_PATH_MISSING:README.md:tools/video-production-reference/bin/cm-video",
            ):
                MODULE.verify_reference_closure(fixture)


if __name__ == "__main__":
    unittest.main()
