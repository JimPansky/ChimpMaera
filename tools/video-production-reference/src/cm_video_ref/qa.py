import json
from pathlib import Path
import subprocess

from .contract import ContractError, sha256_file


def _run_json(cmd):
    proc = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise ContractError(f"command failed: {' '.join(cmd)}\n{proc.stderr.strip()}")
    return json.loads(proc.stdout)


def _run(cmd):
    proc = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise ContractError(f"command failed: {' '.join(cmd)}\n{proc.stderr.strip()}")


def qa_output(job, output_dir):
    out = Path(output_dir).resolve()
    mp4 = out / "candidate.mp4"
    if not mp4.exists():
        raise ContractError(f"candidate MP4 is missing: {mp4}")
    probe = _run_json([
        "ffprobe",
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_streams",
        "-show_format",
        str(mp4),
    ])
    _run(["ffmpeg", "-v", "error", "-i", str(mp4), "-f", "null", "-"])
    video_stream = next((s for s in probe["streams"] if s.get("codec_type") == "video"), None)
    audio_stream = next((s for s in probe["streams"] if s.get("codec_type") == "audio"), None)
    if not video_stream or not audio_stream:
        raise ContractError("candidate must contain video and audio streams")
    spec = job["spec"]
    checks = []

    def check(name, ok, observed, expected):
        checks.append({"metric": name, "observed": observed, "expected": expected, "result": "PASS" if ok else "FAIL"})
        if not ok:
            raise ContractError(f"QA failed for {name}: observed {observed}, expected {expected}")

    check("width", int(video_stream["width"]) == spec["video"]["width"], int(video_stream["width"]), spec["video"]["width"])
    check("height", int(video_stream["height"]) == spec["video"]["height"], int(video_stream["height"]), spec["video"]["height"])
    check("pixel_format", video_stream.get("pix_fmt") == spec["video"]["pixelFormat"], video_stream.get("pix_fmt"), spec["video"]["pixelFormat"])
    fps = video_stream.get("r_frame_rate")
    check("fps", fps in ("30/1", "30/1"), fps, "30/1")
    duration = float(probe["format"]["duration"])
    check("duration_seconds", abs(duration - float(spec["video"]["durationSeconds"])) <= 0.05, duration, spec["video"]["durationSeconds"])
    check("audio_sample_rate", int(audio_stream["sample_rate"]) == 48000, int(audio_stream["sample_rate"]), 48000)
    result = {
        "status": "PASS",
        "fullDecode": "PASS",
        "candidateSha256": sha256_file(mp4),
        "checks": checks,
        "ffprobe": {
            "format": probe.get("format", {}),
            "video": video_stream,
            "audio": audio_stream,
        },
    }
    (out / "QA.json").write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return result


def write_sha256sums(out_dir):
    names = ["STATUS.json", "OUTPUT-MANIFEST.json", "QA.json", "RENDER-COMMAND.txt", "candidate.mp4"]
    lines = []
    for name in names:
        path = Path(out_dir) / name
        if path.exists():
            lines.append(f"{sha256_file(path)}  {name}")
    (Path(out_dir) / "SHA256SUMS").write_text("\n".join(lines) + "\n", encoding="utf-8")

