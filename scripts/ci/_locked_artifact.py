"""Shared fail-closed primitives for foundation-owned tool installers."""

from __future__ import annotations

import hashlib
import json
import os
import platform
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any, Iterable, Mapping, Sequence


ROOT = Path(__file__).resolve().parents[2]
LOCK_PATH = ROOT / "supply-chain" / "tool-artifacts.lock.json"
CHUNK_SIZE = 1024 * 1024


class ArtifactError(RuntimeError):
    """A locked artifact failed validation."""


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ArtifactError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def strict_json_bytes(raw: bytes) -> Any:
    try:
        text = raw.decode("utf-8", errors="strict")
        return json.loads(text, object_pairs_hook=_reject_duplicate_keys)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ArtifactError(f"invalid strict JSON: {exc}") from exc


def load_lock() -> dict[str, Any]:
    data = strict_json_bytes(LOCK_PATH.read_bytes())
    if not isinstance(data, dict) or data.get("schema_version") != 1:
        raise ArtifactError("unsupported tool-artifacts lock schema")
    return data


def canonical_json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode(
        "utf-8"
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()


def sha1_file(path: Path) -> str:
    digest = hashlib.sha1(usedforsecurity=False)
    with path.open("rb") as stream:
        while chunk := stream.read(CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()


def verify_file(path: Path, *, size: int, sha256: str, sha1: str | None = None) -> None:
    actual_size = path.stat().st_size
    if actual_size != size:
        raise ArtifactError(f"artifact size mismatch: expected {size}, got {actual_size}")
    actual_sha256 = sha256_file(path)
    if actual_sha256 != sha256:
        raise ArtifactError(f"artifact sha256 mismatch: expected {sha256}, got {actual_sha256}")
    if sha1 is not None:
        actual_sha1 = sha1_file(path)
        if actual_sha1 != sha1:
            raise ArtifactError(f"artifact sha1 mismatch: expected {sha1}, got {actual_sha1}")


class _LockedRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_hosts: frozenset[str], max_redirects: int) -> None:
        super().__init__()
        self.allowed_hosts = allowed_hosts
        self.max_redirects = max_redirects
        self.redirects = 0

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        self.redirects += 1
        parsed = urllib.parse.urlparse(newurl)
        if self.redirects > self.max_redirects:
            raise ArtifactError("too many artifact redirects")
        if parsed.scheme != "https" or parsed.hostname not in self.allowed_hosts:
            raise ArtifactError("artifact redirect escaped the locked HTTPS hosts")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download_exact(
    *,
    url: str,
    destination: Path,
    expected_size: int,
    allowed_initial_host: str,
    allowed_redirect_hosts: Iterable[str] = (),
    max_redirects: int = 0,
    timeout_seconds: int = 60,
) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != allowed_initial_host:
        raise ArtifactError("locked artifact URL has an unexpected origin")
    redirect_handler = _LockedRedirectHandler(frozenset(allowed_redirect_hosts), max_redirects)
    opener = urllib.request.build_opener(redirect_handler)
    request = urllib.request.Request(url, headers={"User-Agent": "genome-companion-locked-installer/1"})
    deadline = time.monotonic() + timeout_seconds
    total = 0
    try:
        with opener.open(request, timeout=timeout_seconds) as response, destination.open("xb") as output:
            final = urllib.parse.urlparse(response.geturl())
            final_hosts = {allowed_initial_host, *allowed_redirect_hosts}
            if final.scheme != "https" or final.hostname not in final_hosts:
                raise ArtifactError("artifact response origin is not allowlisted")
            while True:
                if time.monotonic() > deadline:
                    raise ArtifactError("artifact download exceeded its total deadline")
                chunk = response.read(min(CHUNK_SIZE, expected_size + 1 - total))
                if not chunk:
                    break
                output.write(chunk)
                total += len(chunk)
                if total > expected_size:
                    raise ArtifactError("artifact exceeded its locked size")
            output.flush()
            os.fsync(output.fileno())
    except (ArtifactError, OSError, urllib.error.URLError) as exc:
        destination.unlink(missing_ok=True)
        if isinstance(exc, ArtifactError):
            raise
        raise ArtifactError(f"artifact download failed: {exc}") from exc
    if total != expected_size:
        destination.unlink(missing_ok=True)
        raise ArtifactError(f"artifact truncated: expected {expected_size}, got {total}")


def ensure_new_destination(destination: Path) -> None:
    if destination.exists() or destination.is_symlink():
        raise ArtifactError(f"destination must not already exist: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)


def private_temp_dir(destination: Path, prefix: str) -> Path:
    ensure_new_destination(destination)
    path = Path(tempfile.mkdtemp(prefix=f".{prefix}-", dir=destination.parent))
    try:
        path.chmod(0o700)
    except OSError:
        pass
    return path


def _safe_member_path(name: str) -> PurePosixPath:
    if "\\" in name or "\x00" in name:
        raise ArtifactError(f"unsafe archive member: {name!r}")
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise ArtifactError(f"unsafe archive member: {name!r}")
    if len(path.parts[0]) >= 2 and path.parts[0][1] == ":":
        raise ArtifactError(f"drive-qualified archive member: {name!r}")
    return path


def checked_zip_infos(
    archive: Path,
    *,
    max_members: int,
    max_member_size: int,
    max_expanded_size: int,
    reject_case_collisions: bool = False,
) -> list[zipfile.ZipInfo]:
    try:
        with zipfile.ZipFile(archive) as source:
            infos = source.infolist()
    except zipfile.BadZipFile as exc:
        raise ArtifactError("artifact is not a valid ZIP/JAR") from exc
    if not infos or len(infos) > max_members:
        raise ArtifactError("archive member count is outside the locked bound")
    seen: set[str] = set()
    total = 0
    for info in infos:
        path = _safe_member_path(info.filename)
        key = path.as_posix().casefold() if reject_case_collisions else path.as_posix()
        if key in seen:
            raise ArtifactError(f"duplicate or case-colliding archive member: {info.filename}")
        seen.add(key)
        mode = (info.external_attr >> 16) & 0o170000
        if mode not in (0, stat.S_IFREG, stat.S_IFDIR):
            raise ArtifactError(f"non-regular archive member: {info.filename}")
        if info.file_size > max_member_size:
            raise ArtifactError(f"archive member is too large: {info.filename}")
        total += info.file_size
        if total > max_expanded_size:
            raise ArtifactError("archive expansion exceeds the locked bound")
    return infos


def extract_zip_prefix(
    archive: Path,
    destination: Path,
    *,
    archive_root: str,
    max_members: int = 40_000,
    max_member_size: int = 3 * 1024 * 1024 * 1024,
    max_expanded_size: int = 12 * 1024 * 1024 * 1024,
) -> None:
    infos = checked_zip_infos(
        archive,
        max_members=max_members,
        max_member_size=max_member_size,
        max_expanded_size=max_expanded_size,
        reject_case_collisions=True,
    )
    root = PurePosixPath(archive_root)
    with zipfile.ZipFile(archive) as source:
        for info in infos:
            path = _safe_member_path(info.filename)
            if not path.parts or path.parts[0] != root.as_posix():
                raise ArtifactError(f"archive member escaped locked root {archive_root}: {info.filename}")
            relative = Path(*path.parts[1:])
            if not relative.parts:
                continue
            target = destination / relative
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with source.open(info) as input_stream, target.open("xb") as output:
                shutil.copyfileobj(input_stream, output, CHUNK_SIZE)
            mode = (info.external_attr >> 16) & 0o777
            target.chmod(mode or 0o644)


def run_checked(command: Sequence[str], *, env: Mapping[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            [str(item) for item in command],
            check=True,
            capture_output=True,
            text=True,
            timeout=60,
            env=dict(env) if env is not None else None,
        )
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise ArtifactError(f"locked tool verification failed: {exc}") from exc


def host_platform() -> str:
    system = platform.system()
    machine = platform.machine().lower()
    mapping = {
        ("Linux", "x86_64"): "linux-x86_64",
        ("Darwin", "arm64"): "macos-arm64",
        ("Darwin", "x86_64"): "macos-x86_64",
        ("Windows", "amd64"): "windows-x86_64",
        ("Windows", "x86_64"): "windows-x86_64",
    }
    try:
        return mapping[(system, machine)]
    except KeyError as exc:
        raise ArtifactError(f"unsupported host platform: {system}/{machine}") from exc


def require_linux_python_31213() -> None:
    if host_platform() != "linux-x86_64":
        raise ArtifactError("linux OCI preparation requires ubuntu-24.04 amd64")
    if sys.version_info[:3] != (3, 12, 13):
        raise ArtifactError("locked installer requires Python 3.12.13")


def atomic_replace_directory(staging: Path, destination: Path) -> None:
    if destination.exists() or destination.is_symlink():
        raise ArtifactError(f"destination appeared during installation: {destination}")
    os.replace(staging, destination)


def tree_sha256(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*"), key=lambda item: item.relative_to(root).as_posix()):
        relative = path.relative_to(root).as_posix().encode("utf-8")
        if path.is_symlink():
            raise ArtifactError(f"symlink not allowed in installed tree: {path}")
        digest.update(len(relative).to_bytes(4, "big"))
        digest.update(relative)
        digest.update(b"D" if path.is_dir() else b"F")
        if path.is_file():
            digest.update(path.stat().st_size.to_bytes(8, "big"))
            digest.update(bytes.fromhex(sha256_file(path)))
    return digest.hexdigest()
