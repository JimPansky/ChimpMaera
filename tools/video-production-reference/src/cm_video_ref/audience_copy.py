import json
from pathlib import Path
import re


AUDIENCE_COPY_GATE_VERSION = "2026.08.03-v1"
REQUIRED_AUDIENCE_CHANNELS = {
    "voice-over",
    "subtitles",
    "on-screen-text",
    "thumbnail",
    "public-title",
    "public-description",
    "final-asr",
    "final-ocr",
}


class AudienceCopyError(Exception):
    def __init__(self, rule_id, channel, message):
        self.rule_id = rule_id
        self.channel = channel
        super().__init__(f"audience copy {channel} rejected by {rule_id}: {message}")


def _require(condition, message):
    if not condition:
        raise AudienceCopyError("gate-contract", "configuration", message)


def validate_audience_policy(policy):
    gate = policy.get("publicationReadyAudienceCopy") or {}
    _require(gate.get("gateVersion") == AUDIENCE_COPY_GATE_VERSION, "audience-copy gateVersion mismatch")
    channels = gate.get("requiredChannels")
    _require(isinstance(channels, list), "audience-copy requiredChannels must be an array")
    _require(set(channels) == REQUIRED_AUDIENCE_CHANNELS, "audience-copy requiredChannels are stale or incomplete")
    _require(len(channels) == len(set(channels)), "audience-copy requiredChannels contain duplicates")
    rules = gate.get("rules")
    _require(isinstance(rules, list) and rules, "audience-copy rules are required")
    rule_ids = set()
    compiled = []
    for item in rules:
        _require(isinstance(item, dict), "audience-copy rule must be an object")
        rule_id = item.get("id")
        _require(isinstance(rule_id, str) and rule_id and rule_id not in rule_ids, "audience-copy rule id is missing or duplicated")
        rule_ids.add(rule_id)
        pattern = item.get("pattern")
        message = item.get("message")
        _require(isinstance(pattern, str) and pattern, f"audience-copy pattern is missing for {rule_id}")
        _require(isinstance(message, str) and message, f"audience-copy message is missing for {rule_id}")
        try:
            compiled.append((rule_id, re.compile(pattern, re.IGNORECASE | re.MULTILINE), message))
        except re.error as exc:
            raise AudienceCopyError("gate-contract", "configuration", f"invalid pattern for {rule_id}: {exc}") from exc
    return gate, compiled


def validate_audience_copy(text, policy, channel):
    _require(channel in REQUIRED_AUDIENCE_CHANNELS, f"unsupported audience-copy channel: {channel}")
    _require(isinstance(text, str), f"audience-copy text for {channel} must be a string")
    _, compiled = validate_audience_policy(policy)
    for rule_id, pattern, message in compiled:
        if pattern.search(text):
            raise AudienceCopyError(rule_id, channel, message)
    return {"status": "PASS", "channel": channel, "gateVersion": AUDIENCE_COPY_GATE_VERSION}


def validate_audience_copy_fixtures(policy_path, fixture_path):
    policy_path = Path(policy_path).resolve()
    fixture_path = Path(fixture_path).resolve()
    policy = json.loads(policy_path.read_text(encoding="utf-8"))
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    gate, _ = validate_audience_policy(policy)
    _require(fixture.get("schemaVersion") == "cm.audience-copy-fixtures/v1", "audience-copy fixture schemaVersion mismatch")
    _require(fixture.get("gateVersion") == AUDIENCE_COPY_GATE_VERSION, "audience-copy fixtures are stale")
    import hashlib
    observed_policy_sha256 = hashlib.sha256(policy_path.read_bytes()).hexdigest()
    _require(fixture.get("policySha256") == observed_policy_sha256, "audience-copy fixture policy checksum is stale")

    positives = fixture.get("positiveFixtures")
    negatives = fixture.get("negativeFixtures")
    _require(isinstance(positives, list) and positives, "positive audience-copy fixtures are required")
    _require(isinstance(negatives, list) and negatives, "negative audience-copy fixtures are required")
    all_rows = positives + negatives
    fixture_ids = [row.get("id") for row in all_rows if isinstance(row, dict)]
    _require(len(fixture_ids) == len(all_rows) and len(fixture_ids) == len(set(fixture_ids)), "audience-copy fixture ids are missing or duplicated")
    positive_channels = {row.get("channel") for row in positives}
    negative_channels = {row.get("channel") for row in negatives}
    _require(positive_channels == REQUIRED_AUDIENCE_CHANNELS, "positive audience-copy channel coverage is stale or incomplete")
    _require(negative_channels == REQUIRED_AUDIENCE_CHANNELS, "negative audience-copy channel coverage is stale or incomplete")
    expected_rule_ids = {item["id"] for item in gate["rules"]}
    observed_rule_ids = {row.get("expectedRule") for row in negatives}
    _require(observed_rule_ids == expected_rule_ids, "negative audience-copy rule coverage is stale or incomplete")

    for row in positives:
        validate_audience_copy(row.get("text"), policy, row.get("channel"))
    for row in negatives:
        try:
            validate_audience_copy(row.get("text"), policy, row.get("channel"))
        except AudienceCopyError as exc:
            _require(exc.rule_id == row.get("expectedRule"), f"negative fixture {row.get('id')} failed for {exc.rule_id}, expected {row.get('expectedRule')}")
        else:
            raise AudienceCopyError("fixture-missed", row.get("channel"), f"negative fixture passed: {row.get('id')}")
    return {
        "status": "PASS",
        "gateVersion": AUDIENCE_COPY_GATE_VERSION,
        "positiveFixtures": len(positives),
        "negativeFixtures": len(negatives),
        "channels": sorted(REQUIRED_AUDIENCE_CHANNELS),
        "rules": sorted(expected_rule_ids),
    }
