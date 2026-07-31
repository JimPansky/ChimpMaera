import argparse
import json
import sys

from .contract import ContractError, load_job, validate_job
from .qa import qa_output
from .render import render_job


def _print(data):
    print(json.dumps(data, indent=2, sort_keys=True))


def main(argv=None):
    parser = argparse.ArgumentParser(prog="cm-video")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("validate", "render", "qa", "validate-and-render"):
        p = sub.add_parser(name)
        p.add_argument("--job", required=True)
        p.add_argument("--output")
    args = parser.parse_args(argv)

    try:
        job = load_job(args.job)
        if args.command == "validate":
            result = validate_job(job, args.job, args.output, render_requested=False)
        elif args.command == "render":
            result = render_job(job, args.job, args.output, require_full=True)
        elif args.command == "qa":
            if not args.output:
                raise ContractError("--output is required for qa")
            result = qa_output(job, args.output)
        else:
            validated = validate_job(job, args.job, args.output, render_requested=bool(job["spec"]["render"].get("full")))
            if job["spec"]["mode"] == "validate-only" or not job["spec"]["render"].get("full"):
                result = validated
            else:
                result = render_job(job, args.job, args.output, require_full=True)
        _print(result)
        return 0
    except ContractError as exc:
        _print({"status": "FAIL", "error": str(exc)})
        return 2
    except Exception as exc:
        _print({"status": "FAIL", "error": f"unexpected error: {exc}"})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

