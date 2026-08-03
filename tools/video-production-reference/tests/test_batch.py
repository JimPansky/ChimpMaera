import json
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from cm_video_ref.batch import atomic_write_summary, run_independent, validate_exact_fan_in


class BatchContractTests(unittest.TestCase):
    def test_concurrency_is_bounded_at_two(self):
        active = 0
        peak = 0
        guard = threading.Lock()

        def runner(revision):
            nonlocal active, peak
            with guard:
                active += 1
                peak = max(peak, active)
            time.sleep(0.02)
            with guard:
                active -= 1
            return {"revision": revision, "status": "PASS"}

        revisions = [f"seg-{index}.r1" for index in range(6)]
        self.assertEqual(len(run_independent(revisions, runner, max_workers=8)), 6)
        self.assertEqual(peak, 2)

    def test_one_failure_does_not_cancel_five_siblings(self):
        seen = []

        def runner(revision):
            seen.append(revision)
            if revision == "seg-2.r1":
                raise RuntimeError("module failure")
            return {"revision": revision, "status": "PASS"}

        revisions = [f"seg-{index}.r1" for index in range(6)]
        outcomes = run_independent(revisions, runner)
        self.assertCountEqual(seen, revisions)
        self.assertEqual(sum(row["status"] == "PASS" for row in outcomes), 5)
        self.assertEqual(sum(row["status"] == "FAIL" for row in outcomes), 1)

    def test_atomic_summary_is_valid_after_each_replacement(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "batch.json"
            for count in range(6):
                atomic_write_summary(path, {"outcomes": list(range(count + 1))})
                self.assertEqual(len(json.loads(path.read_text(encoding="utf-8"))["outcomes"]), count + 1)

    def test_fan_in_requires_six_exact_green_final_revisions(self):
        approvals = {f"seg-{index}.r1": f"{index + 1:064x}" for index in range(6)}
        outcomes = [
            {
                "revision": revision,
                "status": "PASS",
                "storyboardRevisionSha256": digest,
                "automatedQa": "PASS",
                "humanFinalReview": {"status": "APPROVED", "revisionSha256": digest},
                "candidateSha256": f"{index + 20:064x}",
            }
            for index, (revision, digest) in enumerate(approvals.items())
        ]
        self.assertEqual(validate_exact_fan_in(outcomes, approvals)["assembly"], "PERMITTED")
        self.assertEqual(validate_exact_fan_in(outcomes[:5], dict(list(approvals.items())[:5]))["assembly"], "FORBIDDEN")
        outcomes[-1]["humanFinalReview"]["revisionSha256"] = "f" * 64
        self.assertEqual(validate_exact_fan_in(outcomes, approvals)["assembly"], "FORBIDDEN")


if __name__ == "__main__":
    unittest.main()
