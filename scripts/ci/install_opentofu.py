#!/usr/bin/env python3
"""Install only the pinned OpenTofu 1.10.6 Linux/amd64 binary."""

from __future__ import annotations

import argparse
import os
from pathlib import Path, PurePosixPath
import platform
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import install_uv  # noqa: E402


ROOT = Path(__file__).resolve().parents[2]
LOCK_PATH = ROOT / "supply-chain" / "tool-artifacts.lock.json"
EXPECTED_MEMBERS = {"CHANGELOG.md", "LICENSE", "README.md", "tofu"}


class InstallError(RuntimeError):
    pass


def _require_host() -> None:
    if tuple(sys.version_info[:3]) != (3, 12, 13):
        raise InstallError("install_opentofu requires exactly Python 3.12.13")
    if sys.platform != "linux" or platform.machine().lower() not in {"x86_64", "amd64"}:
        raise InstallError("install_opentofu requires Linux x86_64")


def _row() -> dict[str, object]:
    lock = install_uv.load_lock(LOCK_PATH)
    row = lock.get("opentofu")
    if not isinstance(row, dict) or row.get("version") != "1.10.6" or row.get("host") != "linux-x86_64":
        raise InstallError("artifact lock does not pin OpenTofu 1.10.6 for Linux x86_64")
    return row


def _extract_tofu(archive: Path, output: Path) -> None:
    seen: set[str] = set()
    total = 0
    try:
        with zipfile.ZipFile(archive) as bundle:
            for info in bundle.infolist():
                name = info.filename
                if name in seen:
                    raise InstallError("duplicate OpenTofu archive member")
                seen.add(name)
                pure = PurePosixPath(name)
                mode = (info.external_attr >> 16) & 0xFFFF
                if len(pure.parts) != 1 or pure.is_absolute() or pure.parts[0] in {"", ".", ".."}:
                    raise InstallError("unsafe OpenTofu archive member")
                member_type = stat.S_IFMT(mode)
                if info.is_dir() or stat.S_ISLNK(mode) or member_type not in {0, stat.S_IFREG}:
                    raise InstallError("non-regular OpenTofu archive member")
                if info.file_size > 256 * 1024 * 1024:
                    raise InstallError("OpenTofu archive member is oversized")
                total += info.file_size
                if total > 300 * 1024 * 1024:
                    raise InstallError("OpenTofu archive expansion is oversized")
            if seen != EXPECTED_MEMBERS:
                raise InstallError("OpenTofu archive has unexpected members")
            with bundle.open("tofu") as source, output.open("xb") as target:
                shutil.copyfileobj(source, target, length=1024 * 1024)
                target.flush()
                os.fsync(target.fileno())
    except (OSError, zipfile.BadZipFile) as exc:
        raise InstallError(f"invalid OpenTofu archive: {exc}") from exc


def install(destination: Path, archive: Path | None = None) -> Path:
    _require_host()
    if destination.exists() or destination.is_symlink():
        raise InstallError("destination must not already exist")
    row = _row()
    url, size, digest = row.get("url"), row.get("size"), row.get("sha256")
    if not isinstance(url, str) or not isinstance(size, int) or not isinstance(digest, str):
        raise InstallError("invalid OpenTofu artifact metadata")
    destination = destination.resolve(strict=False)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".opentofu-install-", dir=destination.parent) as temp_name:
        temp = Path(temp_name)
        local = temp / "opentofu.zip"
        if archive is None:
            try:
                install_uv._download(url, local, size)
            except install_uv.InstallError as exc:
                raise InstallError(str(exc)) from exc
        else:
            source = archive.resolve(strict=True)
            if source.is_symlink() or not source.is_file():
                raise InstallError("offline OpenTofu archive must be one regular file")
            shutil.copyfile(source, local)
        if local.stat().st_size != size or install_uv._sha256(local) != digest:
            raise InstallError("OpenTofu size or SHA-256 does not match the lock")
        staged = temp / "destination"
        staged.mkdir(mode=0o700)
        tofu = staged / "tofu"
        _extract_tofu(local, tofu)
        tofu.chmod(0o755)
        before = install_uv._sha256(tofu)
        try:
            result = subprocess.run([str(tofu), "version"], check=True, capture_output=True, text=True, timeout=15)
        except (OSError, subprocess.SubprocessError) as exc:
            raise InstallError(f"OpenTofu executable verification failed: {exc}") from exc
        if not result.stdout.startswith("OpenTofu v1.10.6\n") or result.stderr:
            raise InstallError("OpenTofu reported an unexpected version")
        if install_uv._sha256(tofu) != before:
            raise InstallError("OpenTofu changed during verification")
        if destination.exists() or destination.is_symlink():
            raise InstallError("destination appeared during installation")
        os.replace(staged, destination)
        install_uv._fsync_directory(destination.parent)
    return destination


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--archive", type=Path)
    args = parser.parse_args(argv)
    try:
        install(args.destination, args.archive)
    except InstallError as exc:
        print(f"install_opentofu: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
