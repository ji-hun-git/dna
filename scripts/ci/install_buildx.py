#!/usr/bin/env python3
"""Install the exact Linux/amd64 Docker Buildx plugin pinned by FND."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import install_uv  # noqa: E402


ROOT = Path(__file__).resolve().parents[2]
LOCK_PATH = ROOT / "supply-chain" / "tool-artifacts.lock.json"


class InstallError(RuntimeError):
    pass


def _require_host() -> None:
    if tuple(sys.version_info[:3]) != (3, 12, 13):
        raise InstallError("install_buildx requires exactly Python 3.12.13")
    if sys.platform != "linux" or platform.machine().lower() not in {"x86_64", "amd64"}:
        raise InstallError("install_buildx requires Linux x86_64")


def _row() -> dict[str, object]:
    lock = install_uv.load_lock(LOCK_PATH)
    container = lock.get("container_builder")
    if not isinstance(container, dict) or container.get("host") != "linux-x86_64":
        raise InstallError("container builder lock has an unexpected host")
    buildx = container.get("buildx")
    if not isinstance(buildx, dict) or buildx.get("version") != "0.20.1":
        raise InstallError("container builder lock does not pin Buildx 0.20.1")
    return buildx


def install(destination: Path, binary: Path | None = None) -> Path:
    _require_host()
    if destination.exists() or destination.is_symlink():
        raise InstallError("destination must not already exist")
    row = _row()
    url, size, digest = row.get("url"), row.get("size"), row.get("sha256")
    if not isinstance(url, str) or not isinstance(size, int) or not isinstance(digest, str):
        raise InstallError("invalid Buildx artifact metadata")
    destination = destination.resolve(strict=False)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".buildx-install-", dir=destination.parent) as temp_name:
        temp = Path(temp_name)
        local = temp / "docker-buildx"
        if binary is None:
            try:
                install_uv._download(url, local, size)
            except install_uv.InstallError as exc:
                raise InstallError(str(exc)) from exc
        else:
            source = binary.resolve(strict=True)
            if source.is_symlink() or not source.is_file():
                raise InstallError("offline Buildx input must be one regular file")
            shutil.copyfile(source, local)
        if local.stat().st_size != size or install_uv._sha256(local) != digest:
            raise InstallError("Buildx size or SHA-256 does not match the lock")
        local.chmod(0o755)
        before = install_uv._sha256(local)
        try:
            result = subprocess.run([str(local), "version"], check=True, capture_output=True, text=True, timeout=15)
        except (OSError, subprocess.SubprocessError) as exc:
            raise InstallError(f"Buildx executable verification failed: {exc}") from exc
        versions = re.findall(r"(?<![0-9])v?(\d+\.\d+\.\d+)(?![0-9])", result.stdout)
        if "0.20.1" not in versions or result.stderr:
            raise InstallError("Buildx reported an unexpected version")
        if install_uv._sha256(local) != before:
            raise InstallError("Buildx changed during verification")
        staged = temp / "destination"
        staged.mkdir(mode=0o700)
        target = staged / "docker-buildx"
        shutil.copyfile(local, target)
        target.chmod(0o755)
        with target.open("rb+") as handle:
            os.fsync(handle.fileno())
        if destination.exists() or destination.is_symlink():
            raise InstallError("destination appeared during installation")
        os.replace(staged, destination)
        install_uv._fsync_directory(destination.parent)
    return destination


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--binary", type=Path)
    args = parser.parse_args(argv)
    try:
        install(args.destination, args.binary)
    except InstallError as exc:
        print(f"install_buildx: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
