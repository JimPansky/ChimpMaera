import copy
import hashlib
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from cm_video_ref.visual_governance import (
    canonical_digest,
    evaluate_learning_state,
    VisualGovernanceError,
    validate_audience_canvas,
    validate_audience_adaptations,
    validate_feedback_routes,
    validate_learning_records,
    validate_storyboard,
)


def h(value):
    return hashlib.sha256(str(value).encode()).hexdigest()


def storyboard(visual_type="AUTHORITY_FLOW", scene_count=2):
    revision = h(f"reference-{visual_type}")
    scenes = []
    for index in range(scene_count):
        scenes.append({
            "id": f"S{index + 1:02d}",
            "narrativeJob": "MECHANISM" if index == 0 else "PROOF",
            "objective": f"Reveal causal step {index + 1}",
            "semanticAction": f"Move evidence token through step {index + 1}",
            "visualType": visual_type,
            "claimRefs": ["C1"],
            "evidenceRefs": ["E1"],
            "beforeState": {"step": index, "verified": False},
            "afterState": {"step": index + 1, "verified": True},
            "narrationPurpose": "Explain the causal consequence, not read the labels.",
            "narration": f"The governed transition changes what the system may trust at step {index + 1}.",
            "onScreenLabels": [f"Node {index + 1}", "Verified path"],
            "compositionId": f"{visual_type.lower()}-{index % 3}",
            "visualDeltaScore": 0.65,
            "keyframes": [
                {"at": float(index), "stateDigest": h(f"{visual_type}-{index}-before")},
                {"at": float(index + 1), "stateDigest": h(f"{visual_type}-{index}-after")},
            ],
            "transitionPurpose": "Carry the changed state into the next causal beat.",
            "accessibilityNote": "State uses shape and label in addition to color.",
        })
    return {
        "schemaVersion": "cm.video-storyboard/v1",
        "visualContractVersion": "cm.visual-language-contract/2026-08-03-v1",
        "immutableRevisionSha256": revision,
        "durationPolicy": "CONTENT_DRIVEN",
        "audienceLock": {"canvasSha256": h("audience"), "primary": "TECHNICAL_EXPERT"},
        "storyArchitecture": {
            "audience": "Technical experts",
            "intendedDecision": "Inspect the mechanism",
            "centralTension": "Which state change establishes trust?",
            "transformation": "An opaque claim becomes an inspectable path",
            "proof": "A digest-bound receipt",
            "implication": "Reuse stays within the declared boundary",
            "oneNarrativeSpine": True,
        },
        "claims": [{"id": "C1", "statement": "The path is governed.", "evidenceRefs": ["E1"], "nonClaimBoundary": "No production outcome is claimed.", "allowedVisualTypes": [visual_type]}],
        "evidence": [{"id": "E1", "source": "public-safe-fixture", "sha256": h("evidence")}],
        "scenes": scenes,
        "tail": {"staticSeconds": 0.5, "silentSeconds": 0.0, "purpose": "NARRATIVE_CLOSE"},
        "criticalTerms": [{"spelling": "governed", "pronunciation": "GUV-ernd", "requiredInNarration": True}],
        "contactSheet": {"path": "contact-sheet.png", "sha256": h(f"sheet-{visual_type}"), "representativeMoments": [f"S{i + 1:02d}:after" for i in range(scene_count)]},
        "reviews": {
            "HUMAN_VISUAL_REVIEW": {"status": "PENDING", "revisionSha256": None, "reviewer": None, "reviewedAt": None},
            "HUMAN_EDITORIAL_REVIEW": {"status": "PENDING", "revisionSha256": None, "reviewer": None, "reviewedAt": None},
            "HUMAN_FINAL_REVIEW": {"status": "PENDING", "revisionSha256": None, "reviewer": None, "reviewedAt": None},
        },
        "automatedPreflight": {"status": "PASS", "revisionSha256": revision},
        "automatedFinalQa": {"status": "PENDING", "revisionSha256": revision},
        "readyForAssembly": False,
        "publicationPermission": "FORBIDDEN",
        "maturity": "L2_STORYBOARD_VALIDATED",
    }


def approve(value, *, final=False):
    result = copy.deepcopy(value)
    revision = result["immutableRevisionSha256"]
    for key in ("HUMAN_VISUAL_REVIEW", "HUMAN_EDITORIAL_REVIEW"):
        result["reviews"][key] = {"status": "APPROVED", "revisionSha256": revision, "reviewer": "fixture-reviewer", "reviewedAt": "2026-08-03T00:00:00Z"}
    result["maturity"] = "L4_ROUGH_CUT_APPROVED"
    if final:
        result["reviews"]["HUMAN_FINAL_REVIEW"] = {"status": "APPROVED", "revisionSha256": revision, "reviewer": "fixture-reviewer", "reviewedAt": "2026-08-03T00:00:00Z"}
        result["automatedFinalQa"] = {"status": "PASS", "revisionSha256": revision}
        result["readyForAssembly"] = True
        result["publicationPermission"] = "PERMITTED"
        result["maturity"] = "L5_PUBLICATION_READY"
    return result


class StoryboardGovernanceTests(unittest.TestCase):
    def assert_rejects(self, value, message, stage="PREFLIGHT"):
        with self.assertRaisesRegex(VisualGovernanceError, message):
            validate_storyboard(value, stage=stage)

    def test_reference_storyboard_per_visual_family(self):
        for family in ("AUTHORITY_FLOW", "DEPENDENCY_DAG", "CONTRIBUTION_PREFLIGHT", "SCOPE_NORMALIZATION", "PUBLIC_TRUTH_PATH"):
            with self.subTest(family=family):
                result = validate_storyboard(storyboard(family))
                self.assertEqual(result["status"], "PASS_AUTOMATED")
                self.assertFalse(result["publicationReady"])

    def test_three_static_text_slides_rejected(self):
        value = storyboard(scene_count=3)
        for scene in value["scenes"]:
            scene["keyframes"][1]["stateDigest"] = scene["keyframes"][0]["stateDigest"]
        self.assert_rejects(value, "static-slide behavior")

    def test_excessive_text_density_rejected(self):
        value = storyboard()
        value["scenes"][0]["onScreenLabels"] = ["one two three four five six seven eight"] * 4
        self.assert_rejects(value, "excessive text density")

    def test_narration_duplication_rejected(self):
        value = storyboard()
        value["scenes"][0]["narration"] = "System trust state changed"
        value["scenes"][0]["onScreenLabels"] = ["System trust state changed"]
        self.assert_rejects(value, "narration duplication")

    def test_negligible_visual_change_rejected(self):
        value = storyboard()
        value["scenes"][0]["afterState"] = value["scenes"][0]["beforeState"]
        self.assert_rejects(value, "negligible visual change")

    def test_repeated_identical_composition_rejected(self):
        value = storyboard(scene_count=4)
        for scene in value["scenes"]:
            scene["compositionId"] = "same-card"
        self.assert_rejects(value, "repeated identical composition")

    def test_long_static_and_silent_tail_rejected(self):
        value = storyboard()
        value["tail"] = {"staticSeconds": 5.0, "silentSeconds": 4.0, "purpose": "NARRATIVE_CLOSE"}
        self.assert_rejects(value, "long static tail")

    def test_missing_claim_to_visual_evidence_rejected(self):
        value = storyboard()
        value["scenes"][0]["claimRefs"] = []
        self.assert_rejects(value, "missing claim-to-visual evidence")

    def test_pending_and_rejected_human_gates_block_tts(self):
        self.assert_rejects(storyboard(), "blocks TTS/full render", stage="TTS")
        value = storyboard()
        value["reviews"]["HUMAN_VISUAL_REVIEW"]["status"] = "REJECTED"
        self.assert_rejects(value, "blocks TTS/full render", stage="TTS")

    def test_stale_revision_approval_rejected(self):
        value = approve(storyboard())
        value["reviews"]["HUMAN_VISUAL_REVIEW"]["revisionSha256"] = h("stale")
        self.assert_rejects(value, "approval from stale revision")

    def test_wrong_critical_term_rejected(self):
        value = storyboard()
        value["criticalTerms"][0]["spelling"] = "governned"
        self.assert_rejects(value, "wrong critical term")

    def test_attempted_send_while_forbidden_rejected(self):
        value = approve(storyboard())
        value["reviews"]["HUMAN_FINAL_REVIEW"] = {"status": "APPROVED", "revisionSha256": value["immutableRevisionSha256"], "reviewer": "fixture", "reviewedAt": "2026-08-03T00:00:00Z"}
        value["automatedFinalQa"] = {"status": "PASS", "revisionSha256": value["immutableRevisionSha256"]}
        self.assert_rejects(value, "readyForAssembly false", stage="SEND")

    def test_exact_revision_approvals_allow_tts_and_send_only_after_final(self):
        self.assertEqual(validate_storyboard(approve(storyboard()), stage="TTS")["status"], "PASS_AUTOMATED")
        self.assertTrue(validate_storyboard(approve(storyboard(), final=True), stage="SEND")["publicationReady"])

    def test_named_rejected_modules_are_never_positive_templates(self):
        fixture = json.loads((ROOT / "fixtures/rejected-slide-decks-2026-08-03.json").read_text())
        self.assertEqual(fixture["decision"], "HUMAN_REJECTED")
        self.assertEqual(fixture["reusePolicy"], "NEVER_POSITIVE_TEMPLATE")
        self.assertEqual(len(fixture["modules"]), 6)
        self.assertTrue(all(len(row["defects"]) >= 3 for row in fixture["modules"]))


class AudienceDiscoveryTests(unittest.TestCase):
    def canvas(self, family="authority"):
        return {
            "schemaVersion": "cm.audience-discovery-canvas/v1",
            "context": f"Technical explainer for {family}",
            "decisionToInfluence": "Inspect the bounded proof",
            "contentFamilies": ["authority", "verification", "public-truth"],
            "primaryAudiences": [{"id": "TECHNICAL_EXPERT", "jobToBeDone": "verify mechanism"}],
            "secondaryAudiences": [{"id": "TECHNICAL_DECISION_MAKER"}],
            "excludedAudiences": [{"id": "UNIVERSAL", "reason": "avoid invented universal fit"}],
            "evidence": [{"id": "E1", "source": "public issue", "privacy": "aggregate"}, {"id": "E2", "source": "review rubric", "privacy": "aggregate"}],
            "assumptions": [
                {"id": "A1", "statement": "Experts need mechanism proof", "type": "sourced", "provenance": "desk research E1", "scope": ["TECHNICAL_EXPERT"], "evidenceRefs": ["E1"], "confidence": "MEDIUM", "owner": "editor", "reviewDate": "2026-09-10", "disconfirmingEvidence": []},
                {"id": "A2", "statement": "Decision makers need boundary first", "type": "observed", "provenance": "review rubric E2", "scope": ["TECHNICAL_DECISION_MAKER"], "evidenceRefs": ["E2"], "confidence": "MEDIUM", "owner": "editor", "reviewDate": "2026-09-10", "disconfirmingEvidence": []},
                {"id": "A3", "statement": "Fast pacing will work", "type": "hypothesis", "provenance": "bounded editorial inference", "scope": ["TECHNICAL_EXPERT"], "evidenceRefs": [], "confidence": "LOW", "validationProbe": "blind comprehension rubric", "owner": "editor", "reviewDate": "2026-09-10", "disconfirmingEvidence": []},
            ],
            "unknowns": [{"question": "recall after one day", "impact": "pacing", "probe": "delayed recall"}],
            "review": {"confidence": "MEDIUM", "antiStereotypeCheck": "PASS", "privacyReview": "PASS", "lockedRevisionSha256": h(family)},
        }

    def test_canvas_reused_across_three_content_families(self):
        for family in ("authority", "verification", "public-truth"):
            self.assertEqual(validate_audience_canvas(self.canvas(family))["status"], "PASS")

    def test_stale_assumption_rejected(self):
        value = self.canvas()
        value["assumptions"][0]["reviewDate"] = "2026-08-09"
        with self.assertRaisesRegex(VisualGovernanceError, "stale audience assumption"):
            validate_audience_canvas(value)

    def test_low_evidence_requires_conservative_low_confidence_and_probe(self):
        value = self.canvas()
        value["assumptions"] = [value["assumptions"][2]]
        value["review"]["confidence"] = "LOW"
        value["review"]["plannedProbe"] = "interview and comprehension probe"
        self.assertEqual(validate_audience_canvas(value)["status"], "PASS")

    def test_blind_authoring_probe_changes_framing_not_facts(self):
        facts = {"claim": "Five reads normalize to one delegated scope and zero writes.", "digest": h("same-facts")}
        expert = {"audience": "TECHNICAL_EXPERT", "opening": "Trace the five operations into cm.discovery.read.", "facts": facts}
        decision = {"audience": "TECHNICAL_DECISION_MAKER", "opening": "One delegated boundary removes scope drift before tenant contact.", "facts": facts}
        self.assertNotEqual(expert["opening"], decision["opening"])
        self.assertEqual(expert["facts"], decision["facts"])

    def test_every_assumption_requires_type_provenance_confidence_scope_and_review(self):
        for field in ("type", "provenance", "confidence", "scope", "reviewDate"):
            with self.subTest(field=field):
                value = self.canvas(); value["assumptions"][0].pop(field)
                with self.assertRaises(VisualGovernanceError):
                    validate_audience_canvas(value)

    def test_fact_hypothesis_confusion_rejected(self):
        value = self.canvas(); value["assumptions"][2]["type"] = "observed"
        with self.assertRaisesRegex(VisualGovernanceError, "facts require declared audience evidence"):
            validate_audience_canvas(value)

    def test_immutable_core_yields_two_material_adaptations(self):
        value = json.loads((ROOT / "fixtures/audience-adaptation-proof-v1.json").read_text())
        result = validate_audience_adaptations(value)
        self.assertEqual(result["audiences"], ["TECHNICAL_DECISION_MAKER", "TECHNICAL_EXPERT"])

    def test_claim_drift_and_missing_adaptation_rejected(self):
        value = json.loads((ROOT / "fixtures/audience-adaptation-proof-v1.json").read_text())
        value["variants"][0]["factualCoreDigest"] = h("drift")
        with self.assertRaisesRegex(VisualGovernanceError, "claim/evidence drift"):
            validate_audience_adaptations(value)
        value = json.loads((ROOT / "fixtures/audience-adaptation-proof-v1.json").read_text())
        value["variants"][0]["adaptationDeclaration"] = ""
        with self.assertRaisesRegex(VisualGovernanceError, "declared adaptation"):
            validate_audience_adaptations(value)


class LearningGovernanceTests(unittest.TestCase):
    def records(self):
        return json.loads((ROOT / "fixtures/video-governance-learning-records.json").read_text())

    def test_observation_to_governed_template_and_rollback_path(self):
        result = validate_learning_records(self.records())
        self.assertEqual(result["highestStage"], "L4_GOVERNED_TEMPLATE")
        record = self.records()[1]
        self.assertTrue(record["supersession"]["supersedes"])
        self.assertTrue(record["rollback"]["trigger"])
        self.assertEqual(self.records()[2]["stage"], "L1_NORMALIZED_FINDING")

    def test_missing_provenance_rejected(self):
        value = self.records(); value[0]["provenance"] = []
        with self.assertRaisesRegex(VisualGovernanceError, "missing provenance"):
            validate_learning_records(value)

    def test_cherry_picked_positive_only_rejected(self):
        value = self.records(); value[1]["evidence"] = [row for row in value[1]["evidence"] if row["polarity"] == "POSITIVE"]
        self.resign(value[1])
        with self.assertRaisesRegex(VisualGovernanceError, "cherry-pick"):
            validate_learning_records(value)

    def test_single_weak_observation_promotion_rejected(self):
        value = self.records(); value[1]["derivedFrom"] = ["one"]; value[1].pop("strongJustification", None); self.resign(value[1])
        with self.assertRaisesRegex(VisualGovernanceError, "single weak observation"):
            validate_learning_records(value)

    def test_cross_audience_reuse_without_adaptation_rejected(self):
        value = self.records(); value[1]["declaredAdaptation"] = None; self.resign(value[1])
        with self.assertRaisesRegex(VisualGovernanceError, "declared adaptation"):
            validate_learning_records(value)

    def test_circular_derivation_rejected(self):
        value = self.records()
        value[0]["dependencies"] = [value[1]["id"]]
        self.resign(value[0])
        with self.assertRaisesRegex(VisualGovernanceError, "circular learning derivation"):
            validate_learning_records(value)

    def resign(self, record):
        unsigned = {key: item for key, item in record.items() if key != "integrity"}
        record["integrity"]["recordSha256"] = canonical_digest(unsigned)

    def test_tampering_rejected(self):
        value = self.records(); value[0]["confidence"] = "LOW"
        with self.assertRaisesRegex(VisualGovernanceError, "tampering"):
            validate_learning_records(value)

    def test_rejected_modules_drive_concrete_rules_and_tests(self):
        records = self.records(); raw, rule = records[0], records[1]
        self.assertEqual([row["polarity"] for row in raw["evidence"]], ["REJECTED"] * 6)
        self.assertIn("visual_governance.py", rule["provenance"]["outputRevision"])
        self.assertIn("test_three_static_text_slides_rejected", rule["provenance"]["testReviewEvidence"])

    def test_source_audience_dependency_or_outcome_change_downgrades(self):
        record = self.records()[0]
        for dimension in ("source_evidence", "audience_assumptions", "dependencies", "outcomes"):
            with self.subTest(dimension=dimension):
                result = evaluate_learning_state(record, changed_dimensions=[dimension])
                self.assertEqual(result["action"], "DOWNGRADE")

    def test_no_change_never_automatically_promotes_one_success(self):
        record = self.records()[0]
        self.assertEqual(evaluate_learning_state(record)["action"], "NO_AUTOMATIC_PROMOTION")


class FeedbackRoutingTests(unittest.TestCase):
    def events(self):
        return json.loads((ROOT / "fixtures/privacy-safe-feedback-routes-v1.json").read_text())

    def test_every_route_emits_decision_receipt(self):
        self.assertEqual(validate_feedback_routes(self.events())["receipts"], 2)

    def test_raw_identity_and_incomplete_receipt_rejected(self):
        value = self.events(); value[0]["email"] = "person@example.invalid"
        with self.assertRaisesRegex(VisualGovernanceError, "privacy violation"):
            validate_feedback_routes(value)
        value = self.events(); value[0]["routeReceipt"].pop("notChanged")
        with self.assertRaisesRegex(VisualGovernanceError, "receipt incomplete"):
            validate_feedback_routes(value)


if __name__ == "__main__":
    unittest.main()
