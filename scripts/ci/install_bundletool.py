#!/usr/bin/env python3
"""Install the FND-pinned bundletool jar after bounded structural validation."""

from __future__ import annotations

import argparse
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import sys
import tempfile
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import install_uv  # noqa: E402


ROOT = Path(__file__).resolve().parents[2]
LOCK_PATH = ROOT / "supply-chain" / "tool-artifacts.lock.json"
FILENAME = "bundletool-all-1.18.1.jar"


class InstallError(RuntimeError):
    pass


def _load_row() -> dict[str, object]:
    lock = install_uv.load_lock(LOCK_PATH)
    row = lock.get("bundletool")
    if not isinstance(row, dict) or row.get("version") != "1.18.1":
        raise InstallError("artifact lock does not pin bundletool 1.18.1")
    artifact = row.get("artifact")
    if not isinstance(artifact, dict):
        raise InstallError("bundletool artifact row is missing")
    if set(artifact) != {"url", "size", "sha256", "entryCount", "expandedSize", "maximumEntrySize", "manifestMainClass"}:
        raise InstallError("bundletool artifact row has unexpected fields")
    return artifact


def _validate_jar(path: Path, row: dict[str, object]) -> None:
    seen: set[str] = set()
    expanded = 0
    maximum = 0
    manifest: bytes | None = None
    try:
        with zipfile.ZipFile(path) as bundle:
            if len(bundle.infolist()) != row.get("entryCount") or len(bundle.infolist()) > 20000:
                raise InstallError("bundletool jar entry count does not match the lock")
            for info in bundle.infolist():
                name = info.filename
                if name in seen:
                    raise InstallError("duplicate jar member")
                seen.add(name)
                if "\\" in name or name.startswith("/"):
                    raise InstallError("unsafe jar member path")
                pure = PurePosixPath(name.rstrip("/"))
                if pure.is_absolute() or any(part in {"", ".", ".."} for part in pure.parts):
                    raise InstallError("unsafe jar member path")
                mode = (info.external_attr >> 16) & 0xFFFF
                member_type = stat.S_IFMT(mode)
                if stat.S_ISLNK(mode) or member_type not in {0, stat.S_IFREG, stat.S_IFDIR}:
                    raise InstallError("non-regular jar member")
                if info.file_size > 16 * 1024 * 1024 or info.file_size > int(row.get("maximumEntrySize", -1)):
                    raise InstallError("bundletool jar member is oversized")
                expanded += info.file_size
                maximum = max(maximum, info.file_size)
                if expanded > 96 * 1024 * 1024:
                    raise InstallError("bundletool jar expansion is oversized")
                if name.upper() == "META-INF/MANIFEST.MF":
                    manifest = bundle.read(info)
    except (OSError, zipfile.BadZipFile) as exc:
        raise InstallError(f"invalid bundletool jar: {exc}") from exc
    if manifest is None:
        raise InstallError("bundletool manifest is missing")
    if expanded != row.get("expandedSize"):
        raise InstallError("bundletool expanded size does not match the lock")
    if maximum != row.get("maximumEntrySize"):
        raise InstallError("bundletool maximum entry size does not match the lock")
    try:
        text = manifest.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise InstallError("bundletool manifest is not UTF-8") from exc
    normalized = text.replace("\r\n ", "").replace("\n ", "")
    expected_main = row.get("manifestMainClass")
    if not isinstance(expected_main, str) or f"Main-Class: {expected_main}" not in normalized:
        raise InstallError("bundletool manifest metadata does not match the lock")


def install(destination: Path, archive: Path | None = None) -> Path:
    if destination.exists() or destination.is_symlink():
        raise InstallError("destination must not already exist")
    row = _load_row()
    url, size, digest = row.get("url"), row.get("size"), row.get("sha256")
    if not isinstance(url, str) or not isinstance(size, int) or not isinstance(digest, str):
        raise InstallError("invalid bundletool artifact metadata")
    destination = destination.resolve(strict=False)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".bundletool-install-", dir=destination.parent) as temp_name:
        temp = Path(temp_name)
        local = temp / FILENAME
        if archive is None:
            try:
                install_uv._download(url, local, size)
            except install_uv.InstallError as exc:
                raise InstallError(str(exc)) from exc
        else:
            source = archive.resolve(strict=True)
            if source.is_symlink() or not source.is_file():
                raise InstallError("offline jar must be one regular file")
            shutil.copyfile(source, local)
        if local.stat().st_size != size:
            raise InstallError("bundletool size does not match the lock")
        if install_uv._sha256(local) != digest:
            raise InstallError("bundletool SHA-256 does not match the lock")
        _validate_jar(local, row)
        staged = temp / "destination"
        staged.mkdir(mode=0o700)
        target = staged / FILENAME
        shutil.copyfile(local, target)
        target.chmod(0o644)
        with target.open("rb+") as handle:
            os.fsync(handle.fileno())
        install_uv._fsync_directory(staged)
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
        print(f"install_bundletool: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
