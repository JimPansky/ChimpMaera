import json
from pathlib import Path
import subprocess
import tempfile
import time

from .contract import ContractError, sha256_file, validate_job
from .qa import qa_output, write_sha256sums


def _run(cmd):
    proc = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise ContractError(f"command failed: {' '.join(cmd)}\n{proc.stderr.strip()}")
    return proc


def _ffmpeg_command(job, validation, output_mp4):
    spec = job["spec"]
    video = spec["video"]
    fps = str(video["fps"])
    transition = float(video["transition"]["seconds"])
    shots = [a for a in validation["assets"] if a["type"] == "png"]
    audio = next(a for a in validation["assets"] if a["type"] == "wav")
    durations = [float(s["endSeconds"]) - float(s["startSeconds"]) for s in spec["assets"]["shots"]]
    cmd = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "warning", "-y"]
    for shot, duration in zip(shots, durations):
        cmd.extend(["-loop", "1", "-framerate", fps, "-t", f"{duration + transition:.6f}", "-i", shot["path"]])
    cmd.extend(["-i", audio["path"]])

    filters = []
    for idx in range(len(shots)):
        filters.append(f"[{idx}:v]format=rgba,setpts=PTS-STARTPTS[v{idx}]")
    if len(shots) == 1:
        last = "[v0]"
    else:
        cumulative = durations[0]
        last = "[v0]"
        for idx in range(1, len(shots)):
            out = f"[vx{idx}]"
            offset = cumulative - transition
            filters.append(f"{last}[v{idx}]xfade=transition=fade:duration={transition:.6f}:offset={offset:.6f}{out}")
            cumulative += durations[idx] - transition
            last = out
    total = float(video["durationSeconds"])
    filters.append(f"{last}format=yuv420p[vout]")
    filters.append(f"[{len(shots)}:a]apad,atrim=duration={total:.6f},aformat=sample_rates=48000:channel_layouts=mono[aout]")

    cmd.extend([
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[vout]",
        "-map",
        "[aout]",
        "-t",
        f"{total:.6f}",
        "-r",
        fps,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "19",
        "-pix_fmt",
        "yuv420p",
        "-g",
        str(int(video["fps"]) * 2),
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "48000",
        "-ac",
        "1",
        "-movflags",
        "+faststart",
        "-f",
        "mp4",
        str(output_mp4),
    ])
    return cmd


def render_job(job, job_path, output_root, require_full=True):
    if not output_root:
        raise ContractError("--output is required for render")
    if require_full and not job["spec"]["render"].get("full"):
        raise ContractError("render command requires spec.render.full true")
    validation = validate_job(job, job_path, output_root, render_requested=True)
    out_dir = Path(output_root).resolve() / job["metadata"]["immutableOutputVersion"]
    if out_dir.exists():
        raise ContractError(f"output already exists: {out_dir}")
    out_dir.mkdir(parents=True)
    mp4 = out_dir / "candidate.mp4"
    with tempfile.NamedTemporaryFile(prefix="cm-video-", suffix=".mp4", dir=str(out_dir), delete=False) as tmp:
        tmp_path = Path(tmp.name)
    cmd = _ffmpeg_command(job, validation, tmp_path)
    start = time.time()
    try:
        _run(cmd)
        tmp_path.rename(mp4)
    except Exception:
        if tmp_path.exists():
            tmp_path.unlink()
        raise

    manifest = {
        "apiVersion": "cm.video.output/v1",
        "jobName": job["metadata"].get("name"),
        "immutableOutputVersion": job["metadata"]["immutableOutputVersion"],
        "candidate": {"path": str(mp4), "sha256": sha256_file(mp4)},
        "inputs": validation["assets"],
        "renderSeconds": round(time.time() - start, 3),
        "renderer": "cm-video-reference-cpu-libx264",
    }
    (out_dir / "OUTPUT-MANIFEST.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (out_dir / "RENDER-COMMAND.txt").write_text(" ".join(cmd) + "\n", encoding="utf-8")
    qa = qa_output(job, str(out_dir), job_path)
    status = {"status": "PASS", "rendered": True, "qa": qa["status"], "candidateSha256": manifest["candidate"]["sha256"]}
    (out_dir / "STATUS.json").write_text(json.dumps(status, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    write_sha256sums(out_dir)
    return status
