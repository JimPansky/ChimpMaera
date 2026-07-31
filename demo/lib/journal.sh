#!/usr/bin/env bash

# Durable, single-writer installer journal. The caller must set `state`.

journal_utc() {
  date -u +%Y-%m-%dT%H:%M:%S.%3NZ
}

journal_mono_ms() {
  awk '{printf "%d", $1 * 1000}' /proc/uptime
}

journal_sha_text() {
  printf '%s' "$1" | sha256sum | cut -d' ' -f1
}

journal_file_sha() {
  sha256sum "$1" | cut -d' ' -f1
}

journal_init() {
  local now
  now="$(date -u +%Y%m%dT%H%M%S)"
  CM_RUN_ID="${now}Z-$$"
  CM_RUN_STARTED_UTC="$(journal_utc)"
  CM_RUN_STARTED_MONO_MS="$(journal_mono_ms)"
  CM_JOURNAL="$state/journal"
  CM_RUN_DIR="$CM_JOURNAL/runs/$CM_RUN_ID"
  CM_EVENTS="$CM_RUN_DIR/events.jsonl"
  CM_ERRORS="$CM_JOURNAL/errors.jsonl"
  CM_RECEIPTS="$CM_JOURNAL/receipts"
  install -d -m 700 "$CM_RUN_DIR" "$CM_RECEIPTS"
  : > "$CM_EVENTS"
  chmod 600 "$CM_EVENTS"
  CM_PHASE=command
  CM_PHASE_STARTED_UTC="$CM_RUN_STARTED_UTC"
  CM_PHASE_STARTED_MONO_MS="$CM_RUN_STARTED_MONO_MS"
  CM_PHASE_INPUT_DIGEST="$(journal_sha_text command)"
}

journal_event() {
  local event="$1" status="$2" detail="${3:-}" now_utc now_mono elapsed
  now_utc="$(journal_utc)"
  now_mono="$(journal_mono_ms)"
  elapsed="$((now_mono - CM_RUN_STARTED_MONO_MS))"
  jq -cn \
    --arg schemaVersion chimpmaera.demo/event/v1 \
    --arg runId "$CM_RUN_ID" \
    --arg event "$event" \
    --arg phase "$CM_PHASE" \
    --arg status "$status" \
    --arg detail "$detail" \
    --arg utc "$now_utc" \
    --argjson monotonicMs "$now_mono" \
    --argjson runElapsedMs "$elapsed" \
    '{schemaVersion:$schemaVersion,runId:$runId,event:$event,phase:$phase,status:$status,detail:$detail,utc:$utc,monotonicMs:$monotonicMs,runElapsedMs:$runElapsedMs}' \
    >> "$CM_EVENTS"
}

journal_attempts() {
  local receipt="$CM_RECEIPTS/$1.json"
  if [ -f "$receipt" ]; then
    jq -r '(.attempts // 0) + 1' "$receipt"
  else
    printf '1'
  fi
}

journal_write_receipt() {
  local phase="$1" status="$2" output_digest="$3" ended_utc ended_mono duration attempts receipt tmp
  ended_utc="$(journal_utc)"
  ended_mono="$(journal_mono_ms)"
  duration="$((ended_mono - CM_PHASE_STARTED_MONO_MS))"
  attempts="$(journal_attempts "$phase")"
  receipt="$CM_RECEIPTS/$phase.json"
  tmp="$(mktemp "$CM_RECEIPTS/.${phase}.XXXXXX")"
  jq -n \
    --arg schemaVersion chimpmaera.demo/node-receipt/v1 \
    --arg runId "$CM_RUN_ID" \
    --arg phase "$phase" \
    --arg status "$status" \
    --arg inputDigest "$CM_PHASE_INPUT_DIGEST" \
    --arg outputDigest "$output_digest" \
    --arg startedUtc "$CM_PHASE_STARTED_UTC" \
    --arg endedUtc "$ended_utc" \
    --argjson startedMonotonicMs "$CM_PHASE_STARTED_MONO_MS" \
    --argjson endedMonotonicMs "$ended_mono" \
    --argjson durationMs "$duration" \
    --argjson attempts "$attempts" \
    '{schemaVersion:$schemaVersion,runId:$runId,phase:$phase,status:$status,inputDigest:$inputDigest,outputDigest:$outputDigest,attempts:$attempts,startedUtc:$startedUtc,endedUtc:$endedUtc,startedMonotonicMs:$startedMonotonicMs,endedMonotonicMs:$endedMonotonicMs,durationMs:$durationMs}' \
    > "$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$receipt"
}

journal_phase_start() {
  CM_PHASE="$1"
  CM_PHASE_INPUT_DIGEST="$2"
  CM_PHASE_STARTED_UTC="$(journal_utc)"
  CM_PHASE_STARTED_MONO_MS="$(journal_mono_ms)"
  journal_event phase_started running
  printf '[%s] %s\n' "$CM_PHASE_STARTED_UTC" "$CM_PHASE"
}

journal_mark_retested() {
  local phase="$1" now_utc tmp
  [ -s "$CM_ERRORS" ] || return 0
  now_utc="$(journal_utc)"
  tmp="$(mktemp "$CM_JOURNAL/.errors.XXXXXX")"
  jq -c --slurp \
    --arg phase "$phase" \
    --arg runId "$CM_RUN_ID" \
    --arg retestedAt "$now_utc" \
    'map(if .phase == $phase and .retested == false then . + {retested:true,retestRunId:$runId,retestedAt:$retestedAt} else . end)[]' \
    "$CM_ERRORS" > "$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$CM_ERRORS"
}

journal_phase_complete() {
  local output_digest="$1"
  journal_write_receipt "$CM_PHASE" completed "$output_digest"
  journal_mark_retested "$CM_PHASE"
  journal_event phase_completed completed "$output_digest"
}

journal_error() {
  local exit_code="$1" line="$2" command="$3" now_utc now_mono tmp_output command_digest
  trap - ERR
  set +e
  now_utc="$(journal_utc)"
  now_mono="$(journal_mono_ms)"
  tmp_output="$(journal_sha_text "failed:$exit_code:$line")"
  command_digest="$(journal_sha_text "$command")"
  journal_write_receipt "$CM_PHASE" failed "$tmp_output"
  jq -cn \
    --arg schemaVersion chimpmaera.demo/error/v1 \
    --arg runId "$CM_RUN_ID" \
    --arg phase "$CM_PHASE" \
    --arg commandDigest "$command_digest" \
    --arg utc "$now_utc" \
    --argjson monotonicMs "$now_mono" \
    --argjson exitCode "$exit_code" \
    --argjson line "$line" \
    '{schemaVersion:$schemaVersion,runId:$runId,phase:$phase,exitCode:$exitCode,line:$line,commandDigest:$commandDigest,utc:$utc,monotonicMs:$monotonicMs,retested:false}' \
    >> "$CM_ERRORS"
  journal_event installer_failed failed "exit=$exit_code line=$line"
  exit "$exit_code"
}

journal_finish() {
  local status="$1" readback_digest="$2" ended_utc ended_mono elapsed tmp
  ended_utc="$(journal_utc)"
  ended_mono="$(journal_mono_ms)"
  elapsed="$((ended_mono - CM_RUN_STARTED_MONO_MS))"
  tmp="$(mktemp "$CM_RUN_DIR/.summary.XXXXXX")"
  jq -n \
    --arg schemaVersion chimpmaera.demo/run-summary/v1 \
    --arg runId "$CM_RUN_ID" \
    --arg status "$status" \
    --arg startedUtc "$CM_RUN_STARTED_UTC" \
    --arg endedUtc "$ended_utc" \
    --arg readbackDigest "$readback_digest" \
    --arg events "$CM_EVENTS" \
    --argjson elapsedMs "$elapsed" \
    '{schemaVersion:$schemaVersion,runId:$runId,status:$status,startedUtc:$startedUtc,endedUtc:$endedUtc,elapsedMs:$elapsedMs,readbackDigest:$readbackDigest,eventsPath:$events}' \
    > "$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$CM_RUN_DIR/summary.json"
  ln -sfn "runs/$CM_RUN_ID/summary.json" "$CM_JOURNAL/latest-summary.json"
}
