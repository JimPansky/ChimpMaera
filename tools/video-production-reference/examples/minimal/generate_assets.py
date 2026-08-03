#!/usr/bin/env python3
import hashlib
import json
import math
from pathlib import Path
import struct
import wave
import zlib
import shutil

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
JOB = ROOT / "job"
W, H = 1280, 720

FONT = {
    "0": ["111", "101", "101", "101", "111"],
    "1": ["010", "110", "010", "010", "111"],
    "2": ["111", "001", "111", "100", "111"],
    "3": ["111", "001", "111", "001", "111"],
    "4": ["101", "101", "111", "001", "001"],
    "A": ["111", "101", "111", "101", "101"],
    "C": ["111", "100", "100", "100", "111"],
    "D": ["110", "101", "101", "101", "110"],
    "E": ["111", "100", "110", "100", "111"],
    "F": ["111", "100", "110", "100", "100"],
    "H": ["101", "101", "111", "101", "101"],
    "I": ["111", "010", "010", "010", "111"],
    "K": ["101", "101", "110", "101", "101"],
    "L": ["100", "100", "100", "100", "111"],
    "M": ["101", "111", "111", "101", "101"],
    "N": ["101", "111", "111", "111", "101"],
    "O": ["111", "101", "101", "101", "111"],
    "P": ["111", "101", "111", "100", "100"],
    "R": ["111", "101", "111", "110", "101"],
    "S": ["111", "100", "111", "001", "111"],
    "T": ["111", "010", "010", "010", "010"],
    "V": ["101", "101", "101", "101", "010"],
    " ": ["000", "000", "000", "000", "000"],
    "-": ["000", "000", "111", "000", "000"],
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def chunk(kind, data):
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def set_px(buf, x, y, rgb):
    if 0 <= x < W and 0 <= y < H:
        i = (y * W + x) * 3
        buf[i:i + 3] = bytes(rgb)


def rect(buf, x0, y0, x1, y1, rgb):
    for y in range(max(0, y0), min(H, y1)):
        row = y * W * 3
        for x in range(max(0, x0), min(W, x1)):
            i = row + x * 3
            buf[i:i + 3] = bytes(rgb)


def text(buf, x, y, value, scale, rgb):
    cx = x
    for ch in value.upper():
        glyph = FONT.get(ch, FONT[" "])
        for gy, line in enumerate(glyph):
            for gx, bit in enumerate(line):
                if bit == "1":
                    rect(buf, cx + gx * scale, y + gy * scale, cx + (gx + 1) * scale - 1, y + (gy + 1) * scale - 1, rgb)
        cx += 4 * scale


def png(path, title, base, accent):
    buf = bytearray(W * H * 3)
    for y in range(H):
        for x in range(W):
            mix = int(26 + 20 * x / W + 16 * y / H)
            set_px(buf, x, y, (max(base[0], mix), max(base[1], mix), max(base[2], mix)))
    rect(buf, 72, 80, 1208, 640, (19, 37, 38))
    rect(buf, 96, 104, 1184, 616, (25, 49, 51))
    rect(buf, 96, 104, 1184, 124, accent)
    text(buf, 128, 174, title, 18, (244, 241, 232))
    text(buf, 128, 300, "IDS HASHES VERSIONS", 12, (84, 214, 180))
    text(buf, 128, 390, "SYNTHETIC LOCKED ASSET", 12, (232, 189, 104))
    rows = [bytes([0]) + bytes(buf[y * W * 3:(y + 1) * W * 3]) for y in range(H)]
    raw = b"".join(rows)
    data = b"\x89PNG\r\n\x1a\n"
    data += chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(raw, 9))
    data += chunk(b"IEND", b"")
    path.write_bytes(data)


def wav(path):
    rate = 48000
    seconds = 20.0
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        frames = bytearray()
        for n in range(int(rate * seconds)):
            amp = int(0.18 * 32767 * math.sin(2 * math.pi * 220 * n / rate))
            frames.extend(struct.pack("<h", amp))
        w.writeframes(bytes(frames))


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    JOB.mkdir(parents=True, exist_ok=True)
    shots = [
        ("S01", "EVIDENCE QA", (11, 23, 24), (84, 214, 180), 0.0, 10.0),
        ("S02", "JOIN THE ZOO", (18, 25, 36), (232, 189, 104), 10.0, 20.0),
    ]
    rendered = []
    for sid, title, base, accent, start, end in shots:
        path = ASSETS / f"{sid.lower()}.png"
        png(path, f"{sid} {title}", base, accent)
        rendered.append((sid, path, sha(path), start, end))
    audio = ASSETS / "locked-tone.wav"
    wav(audio)
    narration = JOB / "NARRATION.md"
    narration.write_text("ChimpMaera binds every material claim to evidence and timed visuals. The synthetic fixture is not production evidence. Join the Zoo.\n", encoding="utf-8")
    facts = JOB / "SCENE-OBJECT-MATRIX.csv"
    facts.write_text("scene,principle,visual-details\nS01,evidence,synthetic hashes\nS02,non-claim,synthetic boundary\n", encoding="utf-8")
    subtitles = ASSETS / "captions.en.srt"
    subtitles.write_text("1\n00:00:00,000 --> 00:00:10,000\nChimpMaera binds every material claim to evidence and timed visuals.\n\n2\n00:00:10,000 --> 00:00:19,900\nThe synthetic fixture is not production evidence. Join the Zoo.\n", encoding="utf-8")
    policy_source = ROOT / "chimpmaera-public-copy.json"
    if not policy_source.is_file():
        policy_source = ROOT.parents[1] / "policies" / "chimpmaera-public-copy.json"
    policy = ASSETS / "chimpmaera-public-copy.json"
    shutil.copy2(policy_source, policy)
    revision = hashlib.sha256(b"minimal-synthetic-visual-governance-v1").hexdigest()
    storyboard = {
        "schemaVersion": "cm.video-storyboard/v1",
        "visualContractVersion": "cm.visual-language-contract/2026-08-03-v1",
        "immutableRevisionSha256": revision,
        "durationPolicy": "CONTENT_DRIVEN",
        "audienceLock": {"canvasSha256": hashlib.sha256(b"synthetic-audience-canvas").hexdigest(), "primary": "TECHNICAL_EXPERT"},
        "storyArchitecture": {
            "audience": "Technical experts evaluating a governed media contract",
            "intendedDecision": "Inspect the evidence binding before reuse",
            "centralTension": "Can a rendered claim be traced to proof?",
            "transformation": "Unbound media becomes an inspectable evidence path",
            "proof": "Digest-bound assets and timed semantic scenes",
            "implication": "Reuse only within the declared local synthetic boundary",
            "oneNarrativeSpine": True,
        },
        "claims": [{
            "id": "C1", "statement": "The local fixture binds claims to timed evidence.",
            "evidenceRefs": ["E1"], "nonClaimBoundary": "It is not production evidence.",
            "allowedVisualTypes": ["AUTHORITY_FLOW", "MEASURED_EVIDENCE"],
        }],
        "evidence": [{"id": "E1", "source": "SCENE-OBJECT-MATRIX.csv", "sha256": sha(facts)}],
        "scenes": [
            {
                "id": "S01", "narrativeJob": "MECHANISM", "objective": "Make the claim-to-evidence route visible",
                "semanticAction": "Connect claim node to digest-bound evidence", "visualType": "AUTHORITY_FLOW",
                "claimRefs": ["C1"], "evidenceRefs": ["E1"],
                "beforeState": {"claim": "unbound"}, "afterState": {"claim": "evidence-bound"},
                "narrationPurpose": "Explain why ChimpMaera makes the binding inspectable.",
                "narration": "ChimpMaera makes the path from a claim to its evidence inspectable.",
                "onScreenLabels": ["Assertion", "Source", "Linked"], "compositionId": "authority-flow-left-to-right",
                "visualDeltaScore": 0.65,
                "keyframes": [
                    {"at": 0.0, "stateDigest": hashlib.sha256(b"claim-unbound").hexdigest()},
                    {"at": 9.5, "stateDigest": hashlib.sha256(b"claim-bound").hexdigest()},
                ],
                "transitionPurpose": "Follow the newly created binding into verification",
                "accessibilityNote": "Labels and connector shape remain distinguishable without color.",
            },
            {
                "id": "S02", "narrativeJob": "PROOF", "objective": "Show the evidence receipt and boundary",
                "semanticAction": "Reveal digest receipt and local-synthetic limit", "visualType": "MEASURED_EVIDENCE",
                "claimRefs": ["C1"], "evidenceRefs": ["E1"],
                "beforeState": {"receipt": "hidden"}, "afterState": {"receipt": "verified", "boundary": "visible"},
                "narrationPurpose": "State the proof and its non-claim boundary.",
                "narration": "The receipt proves the local binding, while the boundary excludes production outcomes.",
                "onScreenLabels": ["Digest verified", "Local synthetic"], "compositionId": "receipt-with-boundary",
                "visualDeltaScore": 0.72,
                "keyframes": [
                    {"at": 10.0, "stateDigest": hashlib.sha256(b"receipt-hidden").hexdigest()},
                    {"at": 19.9, "stateDigest": hashlib.sha256(b"receipt-visible").hexdigest()},
                ],
                "transitionPurpose": "Close on the applicability boundary",
                "accessibilityNote": "Receipt icon includes a text status; boundary uses line style plus label.",
            },
        ],
        "tail": {"staticSeconds": 0.4, "silentSeconds": 0.0, "purpose": "NARRATIVE_CLOSE"},
        "criticalTerms": [{"spelling": "ChimpMaera", "pronunciation": "Chimp-MARE-ah", "requiredInNarration": True}],
        "contactSheet": {"path": "../assets/s01.png", "sha256": rendered[0][2], "representativeMoments": ["S01:start", "S02:end"]},
        "reviews": {
            "HUMAN_VISUAL_REVIEW": {"status": "APPROVED", "revisionSha256": revision, "reviewer": "synthetic-fixture-reviewer", "reviewedAt": "2026-08-03T00:00:00Z"},
            "HUMAN_EDITORIAL_REVIEW": {"status": "APPROVED", "revisionSha256": revision, "reviewer": "synthetic-fixture-reviewer", "reviewedAt": "2026-08-03T00:00:00Z"},
            "HUMAN_FINAL_REVIEW": {"status": "PENDING", "revisionSha256": None, "reviewer": None, "reviewedAt": None},
        },
        "automatedPreflight": {"status": "PASS", "revisionSha256": revision},
        "automatedFinalQa": {"status": "PENDING", "revisionSha256": revision},
        "readyForAssembly": False,
        "publicationPermission": "FORBIDDEN",
        "maturity": "L4_ROUGH_CUT_APPROVED",
    }
    storyboard_path = JOB / "STORYBOARD.json"
    storyboard_path.write_text(json.dumps(storyboard, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    job = f"""apiVersion: cm.video/v2
kind: VideoJob
metadata:
  name: minimal-synthetic-reference
  immutableOutputVersion: "synthetic-v2"
spec:
  mode: full-render
  roots:
    assets: /assets
  language:
    locale: en
    strategy: idiomatic-human-reviewed
    literalTranslationForbidden: true
  narrationVisualLaw:
    narrationExplainsPrinciples: true
    visualsCarryDetails: true
  publicationCopy:
    title: ChimpMaera local synthetic reference
    description: This reference is not production-ready and does not certify a deployment.
    thumbnailText: Explore ChimpMaera
  methodology:
    version: "2026.08.02-v2"
    publicCopyPolicy:
      path: /assets/chimpmaera-public-copy.json
      sha256: {sha(policy)}
    reviews:
      englishCopy:
        status: PASS
        reviewer: synthetic-fixture-reviewer
        revisionSha256: {sha(narration)}
      semanticCorrelation:
        status: PASS
        reviewer: synthetic-fixture-reviewer
        revisionSha256: {sha(facts)}
    evidence:
      - id: E-NARRATION
        path: /job/NARRATION.md
        locator: job/NARRATION.md
        sha256: {sha(narration)}
      - id: E-SCENE-MATRIX
        path: /job/SCENE-OBJECT-MATRIX.csv
        locator: job/SCENE-OBJECT-MATRIX.csv
        sha256: {sha(facts)}
    claimBindings:
      - id: CLAIM-EVIDENCE-BINDING
        classification: claim
        text: Every material claim is bound to evidence and timed visuals.
        evidenceRefs: [E-NARRATION, E-SCENE-MATRIX]
        visualRefs: [S01]
      - id: NONCLAIM-PRODUCTION
        classification: non-claim
        text: This synthetic fixture is not production evidence.
        limitation: Local synthetic smoke only.
    outro:
      designed: true
      durationSeconds: 10.0
      startSeconds: 10.0
      endSeconds: 20.0
      terminalAudioPolicy: continuous-program
      timingProbes:
        - {{name: start, seconds: 10.0}}
        - {{name: quarter, seconds: 12.5}}
        - {{name: midpoint, seconds: 15.0}}
        - {{name: end, seconds: 19.9}}
  locks:
    narration:
      path: /job/NARRATION.md
      sha256: {sha(narration)}
    facts:
      path: /job/SCENE-OBJECT-MATRIX.csv
      sha256: {sha(facts)}
  video:
    width: 1280
    height: 720
    fps: 30
    pixelFormat: yuv420p
    durationSeconds: 20.0
    transition:
      type: direct-dissolve
      seconds: 0.20
  render:
    full: true
    overwrite: false
    publicActions: forbidden
  preRenderGate:
    status: PASS_AUTOMATED
    storyboardPath: /job/STORYBOARD.json
    storyboardSha256: {sha(storyboard_path)}
  gates:
    textGate: PASS
    shotGate: PASS
  qa:
    requireTextGateBeforeFullRender: true
    requireShotGateBeforeFullRender: true
    requireChecksums: true
    contract: ../../qa-gates.yaml
    loudness:
      integratedLufsMin: -30.0
      integratedLufsMax: -10.0
      truePeakMaxDbfs: -1.0
  assets:
    subtitles:
      path: /assets/captions.en.srt
      sha256: {sha(subtitles)}
      language: en
    audio:
      id: locked-tone
      path: /assets/locked-tone.wav
      sha256: {sha(audio)}
      status: accepted
      mediaClass: wav-audio
"""
    job += "    shots:\n"
    for sid, path, digest, start, end in rendered:
        role = "outro" if sid == "S02" else "content"
        claim_refs = "[CLAIM-EVIDENCE-BINDING]" if sid == "S01" else "[]"
        non_claim_refs = "[NONCLAIM-PRODUCTION]" if sid == "S02" else "[]"
        job += f"""      - sceneId: {sid}
        path: /assets/{path.name}
        sha256: {digest}
        startSeconds: {start}
        endSeconds: {end}
        status: accepted
        mediaClass: png-shot
        role: {role}
        visualDescription: Timed synthetic evidence view for {sid}.
        claimRefs: {claim_refs}
        nonClaimRefs: {non_claim_refs}
        safeArea: {{x: 64, y: 36, width: 1152, height: 648}}
        textBoxes:
          - {{x: 128, y: 174, width: 800, height: 120, text: "ChimpMaera evidence view"}}
"""
    (JOB / "video-job.yaml").write_text(job, encoding="utf-8")
    print(JOB / "video-job.yaml")


if __name__ == "__main__":
    main()
