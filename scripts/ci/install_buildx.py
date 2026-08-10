#!/usr/bin/env python3
"""Install the exact locked Docker Buildx plugin on the locked Linux host."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from _locked_artifact import (
    ArtifactError,
    atomic_replace_directory,
    download_exact,
    load_lock,
    private_temp_dir,
    require_linux_python_31213,
    run_checked,
    sha256_file,
    verify_file,
)


def install(destination: Path, binary: Path | None = None) -> None:
    require_linux_python_31213()
    row = load_lock()["container_builder"]["buildx"]
    staging = private_temp_dir(destination, "buildx-install")
    payload = staging.parent / f".{staging.name}.download"
    try:
        if binary is None:
            download_exact(
                url=row["url"],
                destination=payload,
                expected_size=row["size"],
                allowed_initial_host="github.com",
                allowed_redirect_hosts=("release-assets.githubusercontent.com",),
                max_redirects=1,
            )
        else:
            if not binary.is_file() or binary.is_symlink():
                raise ArtifactError("offline Buildx input must be one regular file")
            shutil.copyfile(binary, payload)
        verify_file(payload, size=row["size"], sha256=row["sha256"])
        target = staging / "docker-buildx"
        shutil.copyfile(payload, target)
        target.chmod(0o755)
        before = sha256_file(target)
        result = run_checked([str(target), "version"])
        if f"v{row['version']}" not in result.stdout or sha256_file(target) != before:
            raise ArtifactError("Buildx version or bytes changed during verification")
        payload.unlink()
        atomic_replace_directory(staging, destination)
    except Exception:
        payload.unlink(missing_ok=True)
        shutil.rmtree(staging, ignore_errors=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--binary", type=Path)
    args = parser.parse_args()
    try:
        install(args.destination, args.binary)
    except ArtifactError as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

