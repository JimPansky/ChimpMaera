#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP"
}
trap cleanup EXIT

free_gib() {
  df -BG / | awk 'NR==2 {gsub("G","",$4); print $4}'
}

if [ "$(free_gib)" -lt 15 ]; then
  echo "FAIL: refusing smoke; root free space below 15 GiB" >&2
  exit 2
fi

mkdir -p "$TMP/job" "$TMP/assets" "$TMP/output"
cp "$ROOT/examples/minimal/generate_assets.py" "$TMP/generate_assets.py"
(cd "$TMP" && python3 generate_assets.py >/dev/null)

IMAGE="chimpmaera/video-production-reference:smoke-20260730"
RUN_UID="$(id -u)"
RUN_GID="$(id -g)"
if [ "$RUN_UID" = "0" ]; then
  RUN_UID=65532
  RUN_GID=65532
  chmod 0777 "$TMP/output"
fi
(cd "$ROOT" && docker compose config >/dev/null)
(cd "$ROOT" && docker build -t "$IMAGE" .)

docker run --rm \
  --network none \
  --read-only \
  --user "$RUN_UID:$RUN_GID" \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=256m \
  -v "$TMP/job:/job:ro" \
  -v "$TMP/assets:/assets:ro" \
  "$IMAGE" validate --job /job/video-job.yaml >/tmp/cm-video-smoke-validate.json

docker run --rm \
  --network none \
  --read-only \
  --user "$RUN_UID:$RUN_GID" \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=256m \
  -v "$TMP/job:/job:ro" \
  -v "$TMP/assets:/assets:ro" \
  -v "$TMP/output:/output:rw" \
  "$IMAGE" validate-and-render --job /job/video-job.yaml --output /output >/tmp/cm-video-smoke-render.json

docker run --rm \
  --network none \
  --read-only \
  --user "$RUN_UID:$RUN_GID" \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=256m \
  -v "$TMP/job:/job:ro" \
  -v "$TMP/output:/output:rw" \
  "$IMAGE" qa --job /job/video-job.yaml --output /output/synthetic-v1 >/tmp/cm-video-smoke-qa.json

(cd "$TMP/output/synthetic-v1" && sha256sum -c SHA256SUMS >/tmp/cm-video-smoke-sha256.txt)
cat /tmp/cm-video-smoke-render.json
echo "SMOKE PASS: $TMP/output/synthetic-v1/candidate.mp4"
