#!/usr/bin/env python3
"""Install the exact locked bundletool JAR into a new directory."""

from __future__ import annotations

import argparse
import shutil
import zipfile
from pathlib import Path

from _locked_artifact import (
    ArtifactError,
    atomic_replace_directory,
    checked_zip_infos,
    download_exact,
    load_lock,
    private_temp_dir,
    verify_file,
)


OUTPUT_NAME = "bundletool-all-1.18.1.jar"


def install(destination: Path, archive: Path | None = None) -> None:
    row = load_lock()["bundletool"]["artifact"]
    staging = private_temp_dir(destination, "bundletool-install")
    payload = staging.parent / f".{staging.name}.jar"
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
                raise ArtifactError("offline bundletool archive must be one regular file")
            shutil.copyfile(archive, payload)
        verify_file(payload, size=row["size"], sha256=row["sha256"])
        checked_zip_infos(
            payload,
            max_members=16384,
            max_member_size=16 * 1024 * 1024,
            max_expanded_size=96 * 1024 * 1024,
        )
        with zipfile.ZipFile(payload) as jar:
            try:
                manifest = jar.read("META-INF/MANIFEST.MF").decode("utf-8", errors="strict")
            except KeyError as exc:
                raise ArtifactError("bundletool JAR has no manifest") from exc
            if "Main-Class: com.android.tools.build.bundletool.BundleToolMain" not in manifest:
                raise ArtifactError("bundletool JAR main class does not match the lock")
            if "com/android/tools/build/bundletool/BundleToolMain.class" not in jar.namelist():
                raise ArtifactError("bundletool JAR lacks its locked entry point")
        target = staging / OUTPUT_NAME
        shutil.copyfile(payload, target)
        target.chmod(0o644)
        payload.unlink()
        atomic_replace_directory(staging, destination)
    except Exception:
        payload.unlink(missing_ok=True)
        shutil.rmtree(staging, ignore_errors=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--archive", type=Path)
    args = parser.parse_args()
    try:
        install(args.destination, args.archive)
    except ArtifactError as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
