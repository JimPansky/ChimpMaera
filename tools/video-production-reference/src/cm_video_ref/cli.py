import argparse
import json
import sys

from .contract import ContractError, load_job, validate_job
from .methodology import MethodologyError, validate_consumed_manifest, validate_evidence_manifest
from .audience_copy import AudienceCopyError, validate_audience_copy_fixtures
from .qa import qa_output
from .render import render_job
from .visual_governance import (
    VisualGovernanceError,
    load_json as load_governance_json,
    validate_audience_canvas,
    validate_learning_records,
    validate_storyboard,
)


def _print(data):
    print(json.dumps(data, indent=2, sort_keys=True))


def main(argv=None):
    parser = argparse.ArgumentParser(prog="cm-video")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("validate", "render", "qa", "validate-and-render"):
        p = sub.add_parser(name)
        p.add_argument("--job", required=True)
        p.add_argument("--output")
    consumed = sub.add_parser("validate-consumed-deltas")
    consumed.add_argument("--manifest", required=True)
    evidence = sub.add_parser("validate-methodology-evidence")
    evidence.add_argument("--manifest", required=True)
    evidence.add_argument("--artifacts-root")
    audience_fixtures = sub.add_parser("validate-audience-copy-fixtures")
    audience_fixtures.add_argument("--policy", required=True)
    audience_fixtures.add_argument("--fixtures", required=True)
    storyboard = sub.add_parser("validate-storyboard")
    storyboard.add_argument("--storyboard", required=True)
    storyboard.add_argument("--stage", choices=["PREFLIGHT", "TTS", "FULL_RENDER", "FINAL_QA", "SEND"], default="PREFLIGHT")
    audience = sub.add_parser("validate-audience-canvas")
    audience.add_argument("--canvas", required=True)
    learning = sub.add_parser("validate-learning-records")
    learning.add_argument("--records", required=True)
    args = parser.parse_args(argv)

    try:
        if args.command == "validate-consumed-deltas":
            result = validate_consumed_manifest(args.manifest)
        elif args.command == "validate-methodology-evidence":
            result = validate_evidence_manifest(args.manifest, args.artifacts_root)
        elif args.command == "validate-audience-copy-fixtures":
            result = validate_audience_copy_fixtures(args.policy, args.fixtures)
        elif args.command == "validate-storyboard":
            result = validate_storyboard(load_governance_json(args.storyboard), stage=args.stage)
        elif args.command == "validate-audience-canvas":
            result = validate_audience_canvas(load_governance_json(args.canvas))
        elif args.command == "validate-learning-records":
            result = validate_learning_records(load_governance_json(args.records))
        else:
            job = load_job(args.job)
        if args.command == "validate":
            result = validate_job(job, args.job, args.output, render_requested=False)
        elif args.command == "render":
            result = render_job(job, args.job, args.output, require_full=True)
        elif args.command == "qa":
            if not args.output:
                raise ContractError("--output is required for qa")
            result = qa_output(job, args.output, args.job)
        elif args.command == "validate-and-render":
            validated = validate_job(job, args.job, args.output, render_requested=bool(job["spec"]["render"].get("full")))
            if job["spec"]["mode"] == "validate-only" or not job["spec"]["render"].get("full"):
                result = validated
            else:
                result = render_job(job, args.job, args.output, require_full=True)
        _print(result)
        return 0
    except (ContractError, MethodologyError, AudienceCopyError, VisualGovernanceError) as exc:
        _print({"status": "FAIL", "error": str(exc)})
        return 2
    except Exception as exc:
        _print({"status": "FAIL", "error": f"unexpected error: {exc}"})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
