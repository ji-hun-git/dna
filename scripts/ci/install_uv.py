#!/usr/bin/env python3
"""Install the repository-pinned uv/uvx pair without trusting ambient tooling."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import platform
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile


ROOT = Path(__file__).resolve().parents[2]
LOCK_PATH = ROOT / "supply-chain" / "tool-artifacts.lock.json"
VERSION = "0.12.3"
PLATFORMS = (
    "linux-x86_64",
    "macos-arm64",
    "macos-x86_64",
    "windows-x86_64",
)


class InstallError(RuntimeError):
    pass


def _strict_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise InstallError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_lock(path: Path = LOCK_PATH) -> dict[str, object]:
    try:
        raw = path.read_bytes()
        if raw.startswith(b"\xef\xbb\xbf") or b"\x00" in raw:
            raise InstallError("artifact lock must be plain UTF-8")
        data = json.loads(raw.decode("utf-8"), object_pairs_hook=_strict_object)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise InstallError(f"cannot load artifact lock: {exc}") from exc
    if data.get("schema_version") != 1:
        raise InstallError("unsupported artifact lock schema")
    uv = data.get("uv")
    if not isinstance(uv, dict) or uv.get("version") != VERSION:
        raise InstallError("artifact lock does not pin uv 0.12.3")
    artifacts = uv.get("artifacts")
    if not isinstance(artifacts, dict) or set(artifacts) != set(PLATFORMS):
        raise InstallError("artifact lock has an unexpected uv platform set")
    for platform_name, row in artifacts.items():
        if not isinstance(row, dict) or set(row) != {"url", "size", "sha256", "versionOutput"}:
            raise InstallError(f"invalid uv artifact row: {platform_name}")
        if not isinstance(row["size"], int) or row["size"] < 1:
            raise InstallError(f"invalid uv artifact size: {platform_name}")
        if not isinstance(row["sha256"], str) or len(row["sha256"]) != 64:
            raise InstallError(f"invalid uv artifact digest: {platform_name}")
        if not isinstance(row["versionOutput"], str) or not row["versionOutput"].startswith(f"uv {VERSION} ("):
            raise InstallError(f"invalid uv version output: {platform_name}")
    return data


def detect_platform() -> str:
    machine = platform.machine().lower()
    if sys.platform == "linux" and machine in {"x86_64", "amd64"}:
        return "linux-x86_64"
    if sys.platform == "darwin" and machine in {"arm64", "aarch64"}:
        return "macos-arm64"
    if sys.platform == "darwin" and machine in {"x86_64", "amd64"}:
        return "macos-x86_64"
    if sys.platform == "win32" and machine in {"x86_64", "amd64"}:
        return "windows-x86_64"
    raise InstallError(f"unsupported host platform: {sys.platform}/{machine}")


class _PinnedRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        parsed = urllib.parse.urlparse(newurl)
        if parsed.scheme != "https" or parsed.hostname != "release-assets.githubusercontent.com":
            raise InstallError(f"untrusted redirect target: {newurl}")
        if getattr(req, "_gc_redirected", False):
            raise InstallError("more than one redirect is forbidden")
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is not None:
            redirected._gc_redirected = True  # type: ignore[attr-defined]
        return redirected


def _download(url: str, destination: Path, expected_size: int) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "github.com":
        raise InstallError("uv source URL must be the pinned GitHub release URL")
    opener = urllib.request.build_opener(_PinnedRedirectHandler())
    request = urllib.request.Request(url, headers={"User-Agent": "gc-foundation-bootstrap/1"})
    try:
        with opener.open(request, timeout=60) as response, destination.open("xb") as output:
            final = urllib.parse.urlparse(response.geturl())
            if final.scheme != "https" or final.hostname not in {
                "github.com",
                "release-assets.githubusercontent.com",
            }:
                raise InstallError("download resolved to an untrusted origin")
            remaining = expected_size + 1
            while remaining:
                chunk = response.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                output.write(chunk)
                remaining -= len(chunk)
            output.flush()
            os.fsync(output.fileno())
    except (OSError, urllib.error.URLError) as exc:
        raise InstallError(f"uv download failed: {exc}") from exc


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _verify_archive_bytes(path: Path, row: dict[str, object]) -> None:
    size = row.get("size")
    digest = row.get("sha256")
    if not isinstance(size, int) or size < 1 or path.stat().st_size != size:
        raise InstallError("uv archive size does not match the lock")
    if not isinstance(digest, str) or _sha256(path) != digest:
        raise InstallError("uv archive SHA-256 does not match the lock")


def _safe_parts(name: str) -> tuple[str, ...]:
    if not name or "\\" in name or name.startswith("/"):
        raise InstallError(f"unsafe archive member: {name!r}")
    path = PurePosixPath(name)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise InstallError(f"unsafe archive member: {name!r}")
    return path.parts


def _read_members(archive: Path, windows: bool) -> dict[str, bytes]:
    installed = {"uv.exe", "uvx.exe"} if windows else {"uv", "uvx"}
    expected = installed | ({"uvw.exe"} if windows else set())
    found: dict[str, bytes] = {}
    top: str | None = None
    names: set[str] = set()
    expanded = 0
    if windows:
        try:
            with zipfile.ZipFile(archive) as bundle:
                for info in bundle.infolist():
                    if info.filename in names:
                        raise InstallError("duplicate archive member")
                    names.add(info.filename)
                    parts = _safe_parts(info.filename.rstrip("/"))
                    mode = (info.external_attr >> 16) & 0xFFFF
                    if stat.S_ISLNK(mode) or (mode and not (stat.S_ISREG(mode) or stat.S_ISDIR(mode))):
                        raise InstallError("non-regular ZIP member")
                    if info.is_dir() or len(parts) != 1 or parts[0] not in expected:
                        raise InstallError("unexpected uv archive member")
                    if info.file_size > 256 * 1024 * 1024:
                        raise InstallError("uv archive member is oversized")
                    expanded += info.file_size
                    if expanded > 512 * 1024 * 1024:
                        raise InstallError("uv archive expansion is oversized")
                    payload = bundle.read(info)
                    if parts[0] in installed:
                        found[parts[0]] = payload
        except (OSError, zipfile.BadZipFile) as exc:
            raise InstallError(f"invalid uv ZIP: {exc}") from exc
    else:
        try:
            with tarfile.open(archive, mode="r:gz") as bundle:
                for member in bundle.getmembers():
                    if member.name in names:
                        raise InstallError("duplicate archive member")
                    names.add(member.name)
                    parts = _safe_parts(member.name.rstrip("/"))
                    if member.isdir():
                        if len(parts) != 1:
                            raise InstallError("unexpected archive directory")
                        top = top or parts[0]
                        if parts[0] != top:
                            raise InstallError("multiple top-level directories")
                        continue
                    if not member.isfile() or len(parts) != 2 or parts[1] not in expected:
                        raise InstallError("unexpected or non-regular uv archive member")
                    if member.size > 256 * 1024 * 1024:
                        raise InstallError("uv archive member is oversized")
                    expanded += member.size
                    if expanded > 512 * 1024 * 1024:
                        raise InstallError("uv archive expansion is oversized")
                    top = top or parts[0]
                    if parts[0] != top:
                        raise InstallError("multiple top-level directories")
                    extracted = bundle.extractfile(member)
                    if extracted is None:
                        raise InstallError("cannot read uv archive member")
                    found[parts[1]] = extracted.read()
        except (OSError, tarfile.TarError) as exc:
            raise InstallError(f"invalid uv tarball: {exc}") from exc
    if windows and names != expected:
        raise InstallError("Windows uv archive does not contain its exact three root entries")
    if set(found) != installed or (not windows and top is None):
        raise InstallError("uv archive does not contain the exact installable uv pair")
    return found


def _fsync_directory(path: Path) -> None:
    if os.name == "nt":
        return
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def install(platform_name: str, destination: Path, archive: Path | None = None) -> Path:
    if destination.exists() or destination.is_symlink():
        raise InstallError("destination must not already exist")
    lock = load_lock()
    selected = detect_platform() if platform_name == "auto" else platform_name
    if selected not in PLATFORMS:
        raise InstallError(f"unsupported requested platform: {selected}")
    row = lock["uv"]["artifacts"][selected]  # type: ignore[index]
    if not isinstance(row, dict):
        raise InstallError("invalid uv artifact row")
    url = row.get("url")
    size = row.get("size")
    if not isinstance(url, str) or not isinstance(size, int):
        raise InstallError("invalid uv artifact metadata")
    destination = destination.resolve(strict=False)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".uv-install-", dir=destination.parent) as temp_name:
        temp = Path(temp_name)
        local_archive = temp / ("uv.zip" if selected == "windows-x86_64" else "uv.tar.gz")
        if archive is None:
            _download(url, local_archive, size)
        else:
            source = archive.resolve(strict=True)
            if not source.is_file() or source.is_symlink():
                raise InstallError("offline archive must be one regular file")
            shutil.copyfile(source, local_archive)
        _verify_archive_bytes(local_archive, row)
        members = _read_members(local_archive, selected == "windows-x86_64")
        staged = temp / "destination"
        staged.mkdir(mode=0o700)
        for name, payload in members.items():
            target = staged / name
            with target.open("xb") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            target.chmod(0o755)
        executable = staged / ("uv.exe" if selected == "windows-x86_64" else "uv")
        try:
            result = subprocess.run(
                [str(executable), "--version"],
                check=True,
                capture_output=True,
                text=True,
                timeout=15,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            raise InstallError(f"installed uv executable failed verification: {exc}") from exc
        expected_output = row.get("versionOutput")
        if not isinstance(expected_output, str) or result.stdout.strip() != expected_output or result.stderr:
            raise InstallError("installed uv reported an unexpected version")
        _fsync_directory(staged)
        if destination.exists() or destination.is_symlink():
            raise InstallError("destination appeared during installation")
        os.replace(staged, destination)
        _fsync_directory(destination.parent)
    return destination


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--platform", required=True, choices=("auto", *PLATFORMS))
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--archive", type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        install(args.platform, args.destination, args.archive)
    except InstallError as exc:
        print(f"install_uv: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
