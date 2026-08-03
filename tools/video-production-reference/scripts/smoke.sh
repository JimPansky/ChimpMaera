#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
TOTAL_STARTED_NS="$(date +%s%N)"
ACTIVE_PHASE=""
ACTIVE_PHASE_STARTED_NS=""

emit_timing() {
  phase="$1"
  result="$2"
  started_ns="$3"
  finished_ns="$(date +%s%N)"
  elapsed_ms=$(( (finished_ns - started_ns) / 1000000 ))
  printf 'CM_VIDEO_TIMING {"schemaVersion":"cm.video-smoke-timing/v1","phase":"%s","status":"%s","durationMs":%d}\n' \
    "$phase" "$result" "$elapsed_ms"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    if [ ! -e "$TMP/timing-summary-started" ]; then
      printf '### Video smoke phase timings\n\n| Phase | Status | Duration (ms) |\n| --- | --- | ---: |\n' >> "$GITHUB_STEP_SUMMARY"
      : > "$TMP/timing-summary-started"
    fi
    printf '| `%s` | %s | %d |\n' "$phase" "$result" "$elapsed_ms" >> "$GITHUB_STEP_SUMMARY"
  fi
}

phase_begin() {
  ACTIVE_PHASE="$1"
  ACTIVE_PHASE_STARTED_NS="$(date +%s%N)"
}

phase_end() {
  result="${1:-PASS}"
  emit_timing "$ACTIVE_PHASE" "$result" "$ACTIVE_PHASE_STARTED_NS"
  ACTIVE_PHASE=""
  ACTIVE_PHASE_STARTED_NS=""
}

cleanup() {
  status=$?
  if [ -n "$ACTIVE_PHASE" ]; then
    phase_end "FAIL"
  fi
  if [ "$status" -eq 0 ]; then
    total_status="PASS"
  else
    total_status="FAIL"
  fi
  emit_timing "total" "$total_status" "$TOTAL_STARTED_NS"
  if [ "$status" -ne 0 ]; then
    for report in validate.json render.json qa.json consumed-deltas.json audience-copy-fixtures.json evidence-validation.json; do
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

phase_begin "unit-tests"
(cd "$ROOT/../.." && python3 -m unittest discover -s tools/video-production-reference/tests)
phase_end

phase_begin "fixture-generation"
mkdir -p "$TMP/job" "$TMP/assets" "$TMP/output"
cp "$ROOT/examples/minimal/generate_assets.py" "$TMP/generate_assets.py"
cp "$ROOT/examples/minimal/generate_evidence.py" "$TMP/generate_evidence.py"
cp "$ROOT/policies/chimpmaera-public-copy.json" "$TMP/chimpmaera-public-copy.json"
(cd "$TMP" && python3 generate_assets.py >/dev/null)
phase_end

IMAGE="chimpmaera/video-production-reference:smoke-20260803-copy-gate-v1"
RUN_UID="$(id -u)"
RUN_GID="$(id -g)"
if [ "$RUN_UID" = "0" ]; then
  RUN_UID=65532
  RUN_GID=65532
  chmod 0777 "$TMP/output"
fi
phase_begin "container-preflight"
(cd "$ROOT" && docker compose config >/dev/null)
VCS_REF="$(git -C "$ROOT" rev-parse HEAD)"
if ! git -C "$ROOT" diff --quiet; then
  VCS_REF=uncommitted
fi
phase_end

phase_begin "image-build"
build_args=(--build-arg "VCS_REF=$VCS_REF" -t "$IMAGE")
if [ "${CM_VIDEO_NO_CACHE:-false}" = "true" ]; then
  build_args+=(--no-cache)
else
  if [ -n "${CM_VIDEO_CACHE_FROM:-}" ]; then
    build_args+=(--cache-from "$CM_VIDEO_CACHE_FROM")
  fi
  if [ -n "${CM_VIDEO_CACHE_TO:-}" ]; then
    build_args+=(--cache-to "$CM_VIDEO_CACHE_TO")
  fi
fi
case "${CM_VIDEO_BUILDER:-docker}" in
  docker)
    (cd "$ROOT" && docker build "${build_args[@]}" .)
    ;;
  buildx)
    (cd "$ROOT" && docker buildx build --load "${build_args[@]}" .)
    ;;
  *)
    echo "FAIL: CM_VIDEO_BUILDER must be docker or buildx" >&2
    exit 2
    ;;
esac
phase_end

phase_begin "container-contract"
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
phase_end

phase_begin "render-qa"
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
phase_end

phase_begin "methodology-copy-evidence"
docker run --rm --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true \
  "$IMAGE" validate-consumed-deltas --manifest /app/methodology/consumed-deltas.json >"$TMP/consumed-deltas.json"

docker run --rm --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true \
  "$IMAGE" validate-audience-copy-fixtures \
    --policy /app/policies/chimpmaera-public-copy.json \
    --fixtures /app/fixtures/audience-copy-gate.json >"$TMP/audience-copy-fixtures.json"

python3 "$TMP/generate_evidence.py" "$TMP" >"$TMP/evidence-manifest-path.txt"
docker run --rm --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --user "$RUN_UID:$RUN_GID" \
  -v "$TMP:/work:ro" \
  "$IMAGE" validate-methodology-evidence \
    --manifest /work/evidence/methodology-evidence.json \
    --artifacts-root /work >"$TMP/evidence-validation.json"
phase_end

phase_begin "image-metadata"
docker image inspect "$IMAGE" \
  --format '{{ index .Config.Labels "org.chimpmaera.video.methodology.version" }}' \
  | grep -Fx "2026.08.02-v2" >"$TMP/oci-label-check.txt"

docker image inspect "$IMAGE" \
  --format '{{ index .Config.Labels "org.chimpmaera.video.audience-copy-gate.version" }}' \
  | grep -Fx "2026.08.03-v1" >"$TMP/oci-audience-copy-label-check.txt"
phase_end

cat "$TMP/render.json"
cat "$TMP/audience-copy-fixtures.json"
cat "$TMP/evidence-validation.json"
echo "SMOKE PASS: synthetic-v2 with governed methodology and audience-copy evidence"
