#!/usr/bin/env python3
"""Install the one repository-locked uv artifact into a new destination."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import stat
import tarfile
import zipfile
from pathlib import Path, PurePosixPath

from _locked_artifact import (
    ArtifactError,
    atomic_replace_directory,
    download_exact,
    host_platform,
    load_lock,
    private_temp_dir,
    run_checked,
    verify_file,
)


PLATFORMS = ("auto", "linux-x86_64", "macos-arm64", "macos-x86_64", "windows-x86_64")


def _safe_name(name: str, *, depth: int) -> PurePosixPath:
    if "\\" in name or "\x00" in name:
        raise ArtifactError(f"unsafe uv member: {name!r}")
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or len(path.parts) != depth:
        raise ArtifactError(f"uv archive member has the wrong locked depth: {name!r}")
    return path


def _extract_zip(archive: Path, staging: Path, names: tuple[str, str]) -> None:
    with zipfile.ZipFile(archive) as source:
        infos = source.infolist()
        paths = [_safe_name(info.filename, depth=1) for info in infos if not info.is_dir()]
        if len(paths) != 3 or len({path.as_posix().casefold() for path in paths}) != 3:
            raise ArtifactError("uv ZIP must contain exactly three distinct root files")
        leaves = {path.parts[0] for path in paths}
        if leaves != {*names, "uvw.exe"}:
            raise ArtifactError("uv ZIP members do not match the locked executable set")
        for info, path in zip((item for item in infos if not item.is_dir()), paths, strict=True):
            mode_type = (info.external_attr >> 16) & 0o170000
            if mode_type not in (0, stat.S_IFREG):
                raise ArtifactError("uv ZIP contains a link or non-regular member")
            if path.parts[0] == "uvw.exe":
                continue
            target = staging / path.parts[0]
            with source.open(info) as input_stream, target.open("xb") as output:
                shutil.copyfileobj(input_stream, output)
            target.chmod(0o755)


def _extract_tar(archive: Path, staging: Path, names: tuple[str, str]) -> None:
    with tarfile.open(archive, mode="r:gz") as source:
        members = source.getmembers()
        if len(members) > 4:
            raise ArtifactError("uv tar member count exceeds the locked shape")
        files = [member for member in members if member.isfile()]
        if any(not (member.isfile() or member.isdir()) for member in members):
            raise ArtifactError("uv tar contains a link or non-regular member")
        paths = [_safe_name(member.name, depth=2) for member in files]
        if len(paths) != 2 or len({path.as_posix() for path in paths}) != 2:
            raise ArtifactError("uv tar must contain exactly two files")
        roots = {path.parts[0] for path in paths}
        leaves = {path.parts[1] for path in paths}
        if len(roots) != 1 or leaves != set(names):
            raise ArtifactError("uv tar members do not match the locked executable set")
        for member, path in zip(files, paths, strict=True):
            if member.size > 128 * 1024 * 1024:
                raise ArtifactError("uv member exceeds the expansion bound")
            extracted = source.extractfile(member)
            if extracted is None:
                raise ArtifactError("uv member could not be read")
            target = staging / path.parts[1]
            with extracted, target.open("xb") as output:
                shutil.copyfileobj(extracted, output)
            target.chmod(0o755)


def install(platform_name: str, destination: Path, archive: Path | None = None) -> None:
    selected = host_platform() if platform_name == "auto" else platform_name
    lock = load_lock()
    try:
        row = lock["uv"]["artifacts"][selected]
        version = lock["uv"]["version"]
    except (KeyError, TypeError) as exc:
        raise ArtifactError(f"uv platform is not locked: {selected}") from exc
    staging = private_temp_dir(destination, "uv-install")
    work = private_temp_dir(staging / "payload", "uv-download")
    payload = work / Path(row["url"]).name
    try:
        if archive is None:
            download_exact(
                url=row["url"],
                destination=payload,
                expected_size=row["size"],
                allowed_initial_host="github.com",
                allowed_redirect_hosts=("release-assets.githubusercontent.com",),
                max_redirects=1,
            )
        else:
            if not archive.is_file() or archive.is_symlink():
                raise ArtifactError("offline uv archive must be one regular file")
            shutil.copyfile(archive, payload)
        verify_file(payload, size=row["size"], sha256=row["sha256"])
        executable_names = ("uv.exe", "uvx.exe") if selected == "windows-x86_64" else ("uv", "uvx")
        if selected == "windows-x86_64":
            _extract_zip(payload, staging, executable_names)
        else:
            _extract_tar(payload, staging, executable_names)
        result = run_checked([str(staging / executable_names[0]), "--version"])
        version_line = result.stdout.strip()
        expected = re.compile(rf"uv {re.escape(version)} \([0-9a-f]+ [0-9]{{4}}-[0-9]{{2}}-[0-9]{{2}} [A-Za-z0-9._-]+\)")
        if version_line != f"uv {version}" and not expected.fullmatch(version_line):
            raise ArtifactError("installed uv reported an unexpected version")
        if result.stderr.strip():
            raise ArtifactError("installed uv wrote unexpected version diagnostics")
        shutil.rmtree(work)
        atomic_replace_directory(staging, destination)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument("--platform", required=True, choices=PLATFORMS)
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--archive", type=Path)
    args = parser.parse_args()
    try:
        install(args.platform, args.destination, args.archive)
    except ArtifactError as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
