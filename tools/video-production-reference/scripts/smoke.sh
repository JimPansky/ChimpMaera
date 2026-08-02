#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    for report in validate.json render.json qa.json consumed-deltas.json evidence-validation.json; do
      if [ -s "$TMP/$report" ]; then
        sed -n '1,240p' "$TMP/$report" >&2
      fi
    done
  fi
  rm -rf "$TMP"
  return "$status"
}
trap cleanup EXIT

free_gib() {
  df -BG / | awk 'NR==2 {gsub("G","",$4); print $4}'
}

if [ "$(free_gib)" -lt 15 ]; then
  echo "FAIL: refusing smoke; root free space below 15 GiB" >&2
  exit 2
fi

(cd "$ROOT/../.." && python3 -m unittest discover -s tools/video-production-reference/tests)

mkdir -p "$TMP/job" "$TMP/assets" "$TMP/output"
cp "$ROOT/examples/minimal/generate_assets.py" "$TMP/generate_assets.py"
cp "$ROOT/examples/minimal/generate_evidence.py" "$TMP/generate_evidence.py"
cp "$ROOT/policies/chimpmaera-public-copy.json" "$TMP/chimpmaera-public-copy.json"
(cd "$TMP" && python3 generate_assets.py >/dev/null)

IMAGE="chimpmaera/video-production-reference:smoke-20260802-v2"
RUN_UID="$(id -u)"
RUN_GID="$(id -g)"
if [ "$RUN_UID" = "0" ]; then
  RUN_UID=65532
  RUN_GID=65532
  chmod 0777 "$TMP/output"
fi
(cd "$ROOT" && docker compose config >/dev/null)
VCS_REF="$(git -C "$ROOT" rev-parse HEAD)"
if ! git -C "$ROOT" diff --quiet; then
  VCS_REF=uncommitted
fi
(cd "$ROOT" && docker build --build-arg "VCS_REF=$VCS_REF" -t "$IMAGE" .)

docker run --rm \
  --network none \
  --read-only \
  --user "$RUN_UID:$RUN_GID" \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=256m \
  -v "$TMP/job:/job:ro" \
  -v "$TMP/assets:/assets:ro" \
  "$IMAGE" validate --job /job/video-job.yaml >"$TMP/validate.json"

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
  "$IMAGE" validate-and-render --job /job/video-job.yaml --output /output >"$TMP/render.json"

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
  "$IMAGE" qa --job /job/video-job.yaml --output /output/synthetic-v2 >"$TMP/qa.json"

(cd "$TMP/output/synthetic-v2" && sha256sum -c SHA256SUMS >"$TMP/sha256-check.txt")

docker run --rm --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true \
  "$IMAGE" validate-consumed-deltas --manifest /app/methodology/consumed-deltas.json >"$TMP/consumed-deltas.json"

mkdir -p "$TMP/evidence"
for probe in "10.0:outro-start.png" "12.5:outro-quarter.png" "15.0:outro-midpoint.png" "19.9:outro-end.png"; do
  second="${probe%%:*}"
  name="${probe#*:}"
  docker run --rm --network none --read-only --cap-drop ALL \
    --security-opt no-new-privileges:true \
    --user "$RUN_UID:$RUN_GID" \
    -v "$TMP/output:/output:ro" \
    -v "$TMP/evidence:/evidence:rw" \
    --entrypoint ffmpeg \
    "$IMAGE" -nostdin -hide_banner -loglevel error -ss "$second" \
      -i /output/synthetic-v2/candidate.mp4 -frames:v 1 "/evidence/$name"
done

python3 "$TMP/generate_evidence.py" "$TMP" >"$TMP/evidence-manifest-path.txt"
docker run --rm --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --user "$RUN_UID:$RUN_GID" \
  -v "$TMP:/work:ro" \
  "$IMAGE" validate-methodology-evidence \
    --manifest /work/evidence/methodology-evidence.json \
    --artifacts-root /work >"$TMP/evidence-validation.json"

docker image inspect "$IMAGE" \
  --format '{{ index .Config.Labels "org.chimpmaera.video.methodology.version" }}' \
  | grep -Fx "2026.08.02-v2" >"$TMP/oci-label-check.txt"

cat "$TMP/render.json"
cat "$TMP/evidence-validation.json"
echo "SMOKE PASS: synthetic-v2 with governed methodology evidence"
