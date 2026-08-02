import json
from pathlib import Path
import re
import subprocess

from .contract import ContractError, sha256_file, validate_job


def _run_json(cmd):
    proc = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise ContractError(f"command failed: {' '.join(cmd)}\n{proc.stderr.strip()}")
    return json.loads(proc.stdout)


def _run(cmd):
    proc = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise ContractError(f"command failed: {' '.join(cmd)}\n{proc.stderr.strip()}")


def _capture(cmd):
    proc = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise ContractError(f"command failed: {' '.join(cmd)}\n{proc.stderr.strip()}")
    return proc.stdout + "\n" + proc.stderr


def qa_output(job, output_dir, job_path=None):
    if job_path:
        validate_job(job, job_path)
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
    loudness_log = _capture([
        "ffmpeg", "-nostdin", "-hide_banner", "-nostats", "-i", str(mp4),
        "-filter:a", "ebur128=peak=true", "-f", "null", "-",
    ])
    integrated_values = re.findall(r"I:\s*(-?\d+(?:\.\d+)?)\s*LUFS", loudness_log)
    peak_values = re.findall(r"Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS", loudness_log)
    if not integrated_values or not peak_values:
        raise ContractError("could not parse EBU R128 integrated loudness and true peak")
    integrated_lufs = float(integrated_values[-1])
    true_peak_dbfs = float(peak_values[-1])
    black_log = _capture([
        "ffmpeg", "-nostdin", "-hide_banner", "-nostats", "-i", str(mp4),
        "-vf", "blackdetect=d=0.20:pix_th=0.10", "-an", "-f", "null", "-",
    ])
    black_events = len(re.findall(r"black_start:", black_log))
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
    loudness = (spec.get("qa") or {}).get("loudness") or {}
    minimum_lufs = float(loudness.get("integratedLufsMin", -30.0))
    maximum_lufs = float(loudness.get("integratedLufsMax", -10.0))
    maximum_peak = float(loudness.get("truePeakMaxDbfs", -1.0))
    check("integrated_loudness_lufs", minimum_lufs <= integrated_lufs <= maximum_lufs, integrated_lufs, f"{minimum_lufs}..{maximum_lufs}")
    check("true_peak_dbfs", true_peak_dbfs <= maximum_peak, true_peak_dbfs, f"<= {maximum_peak}")
    check("black_frame_events", black_events == 0, black_events, 0)
    result = {
        "status": "PASS",
        "fullDecode": "PASS",
        "portableGateCoverage": {
            "fullDecode": "PASS",
            "streamParity": "PASS",
            "loudness": "PASS",
            "blackFrames": "PASS",
            "subtitles": "validated during job preflight" if job_path else "requires job preflight receipt",
            "safeArea": "validated during job preflight" if job_path else "requires job preflight receipt",
            "asr": "external hash-bound evidence required",
            "ocr": "external hash-bound evidence required"
        },
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
