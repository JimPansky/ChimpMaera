#!/usr/bin/env python3
"""Deterministically verify the video reference's local documentation/runtime closure."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import yaml


class ClosureError(RuntimeError):
    """Raised when a declared local reference is missing or unsafe."""


PATH_PREFIXES = (
    "assets/",
    "bin/",
    "docs/",
    "fixtures/",
    "methodology/",
    "policies/",
    "schemas/",
    "scripts/",
    "templates/",
    "../methodology/",
    "../templates/",
    "tools/video-production-reference/",
)
PATH_NAMES = {
    "ASSET-USAGE.md",
    "Dockerfile",
    "MEDIA-LICENSE.md",
    "METHODOLOGY-CHANGELOG.md",
    "THIRD_PARTY_NOTICES.md",
    "compose.yaml",
    "qa-gates.yaml",
}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _resolve_checked(repo_root: Path, source: Path, value: str, label: str) -> Path:
    candidate = (source.parent / value).resolve()
    root = repo_root.resolve()
    if candidate != root and root not in candidate.parents:
        raise ClosureError(f"REFERENCE_PATH_ESCAPE_DENIED:{label}:{value}")
    if not candidate.exists():
        raise ClosureError(f"REFERENCED_PATH_MISSING:{label}:{value}")
    if candidate.is_symlink():
        raise ClosureError(f"REFERENCE_SYMLINK_DENIED:{label}:{value}")
    return candidate


def _markdown_references(source: Path, repo_root: Path, tool_root: Path) -> set[Path]:
    text = source.read_text(encoding="utf-8")
    raw = set(re.findall(r"\[[^\]]*\]\(([^)]+)\)", text))
    raw.update(re.findall(r"`([^`\n]+)`", text))
    raw.update(re.findall(r"(?m)^\s*(\./[A-Za-z0-9._/-]+)(?:\s|$)", text))
    raw.update(re.findall(r"tools/video-production-reference/[A-Za-z0-9._/-]+", text))
    references: set[Path] = set()
    for value in raw:
        value = value.strip()
        if not value or value.startswith(("#", "http://", "https://", "/")):
            continue
        value = value.split("#", 1)[0]
        if value.startswith("./"):
            value = value[2:]
        if not value:
            continue
        if not (value.startswith(PATH_PREFIXES) or value in PATH_NAMES):
            continue
        if value.startswith("tools/video-production-reference/"):
            target = _resolve_checked(repo_root, repo_root / "README.md", value, source.name)
        elif value == "MEDIA-LICENSE.md" and source.name == "ASSET-USAGE.md":
            target = _resolve_checked(repo_root, repo_root / "README.md", value, source.name)
        elif source.parent.name == "docs" and not value.startswith("../"):
            target = _resolve_checked(repo_root, tool_root / "placeholder", value, source.name)
        else:
            target = _resolve_checked(repo_root, source, value, source.name)
        references.add(target.relative_to(repo_root.resolve()))
    return references


def _dockerfile_references(repo_root: Path, tool_root: Path) -> set[Path]:
    dockerfile = tool_root / "Dockerfile"
    references: set[Path] = {dockerfile.relative_to(repo_root)}
    text = dockerfile.read_text(encoding="utf-8")
    for match in re.finditer(r"^COPY\s+(?!--from=)(?:--[^ ]+\s+)*(\S+)\s+\S+\s*$", text, re.MULTILINE):
        value = match.group(1)
        references.add(_resolve_checked(repo_root, dockerfile, value, "Dockerfile:COPY").relative_to(repo_root))
    return references


def _compose_references(repo_root: Path, tool_root: Path) -> set[Path]:
    compose_path = tool_root / "compose.yaml"
    document = yaml.safe_load(compose_path.read_text(encoding="utf-8"))
    if not isinstance(document, dict) or not isinstance(document.get("services"), dict):
        raise ClosureError("COMPOSE_SERVICES_INVALID")
    references: set[Path] = {compose_path.relative_to(repo_root)}
    for service_name, service in sorted(document["services"].items()):
        if not isinstance(service, dict):
            raise ClosureError(f"COMPOSE_SERVICE_INVALID:{service_name}")
        build = service.get("build")
        if isinstance(build, str):
            context = _resolve_checked(repo_root, compose_path, build, f"compose:{service_name}:context")
            references.add(context.relative_to(repo_root))
        elif isinstance(build, dict):
            context_value = build.get("context", ".")
            dockerfile_value = build.get("dockerfile", "Dockerfile")
            if not isinstance(context_value, str) or not isinstance(dockerfile_value, str):
                raise ClosureError(f"COMPOSE_BUILD_INVALID:{service_name}")
            context = _resolve_checked(repo_root, compose_path, context_value, f"compose:{service_name}:context")
            references.add(context.relative_to(repo_root))
            references.add(
                _resolve_checked(repo_root, context / "placeholder", dockerfile_value, f"compose:{service_name}:dockerfile")
                .relative_to(repo_root)
            )
    return references


def _asset_references(repo_root: Path, tool_root: Path) -> set[Path]:
    manifest_path = tool_root / "assets/reference/reference-assets.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = manifest.get("assets")
    if not isinstance(assets, list):
        raise ClosureError("REFERENCE_ASSETS_INVALID")
    references: set[Path] = {manifest_path.relative_to(repo_root)}
    for asset in assets:
        if not isinstance(asset, dict) or not isinstance(asset.get("id"), str):
            raise ClosureError("REFERENCE_ASSET_INVALID")
        for declaration in (asset, asset.get("transcript"), asset.get("provenance")):
            if not isinstance(declaration, dict) or "path" not in declaration:
                continue
            value = declaration["path"]
            if not isinstance(value, str):
                raise ClosureError(f"REFERENCE_ASSET_PATH_INVALID:{asset['id']}")
            target = _resolve_checked(repo_root, tool_root / "placeholder", value, f"asset:{asset['id']}")
            if not target.is_file():
                raise ClosureError(f"REFERENCE_ASSET_NOT_FILE:{asset['id']}:{value}")
            expected = declaration.get("sha256")
            if expected is not None and _sha256(target) != expected:
                raise ClosureError(f"REFERENCE_ASSET_DIGEST_MISMATCH:{asset['id']}:{value}")
            references.add(target.relative_to(repo_root))
    return references


def verify_reference_closure(repo_root: Path) -> dict[str, object]:
    repo_root = repo_root.resolve()
    tool_root = repo_root / "tools/video-production-reference"
    if not tool_root.is_dir():
        raise ClosureError("VIDEO_REFERENCE_ROOT_MISSING")
    references: set[Path] = set()
    markdown_sources = [tool_root / "README.md", tool_root / "ASSET-USAGE.md", *sorted((tool_root / "docs").glob("*.md"))]
    for source in markdown_sources:
        references.add(source.relative_to(repo_root))
        references.update(_markdown_references(source, repo_root, tool_root))
    references.update(_dockerfile_references(repo_root, tool_root))
    references.update(_compose_references(repo_root, tool_root))
    references.update(_asset_references(repo_root, tool_root))
    paths = sorted(path.as_posix() for path in references)
    return {
        "schemaVersion": "chimpmaera.video/reference-closure-report/v1",
        "status": "PASS",
        "checkedPaths": paths,
        "checkedPathCount": len(paths),
    }


if __name__ == "__main__":
    repository = Path(__file__).resolve().parents[3]
    print(json.dumps(verify_reference_closure(repository), indent=2, sort_keys=True))
