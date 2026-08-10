#!/usr/bin/env python3
"""Install the exact locked OpenTofu binary on the locked Linux host."""

from __future__ import annotations

import argparse
import shutil
import stat
import zipfile
from pathlib import Path

from _locked_artifact import (
    ArtifactError,
    atomic_replace_directory,
    checked_zip_infos,
    download_exact,
    load_lock,
    private_temp_dir,
    require_linux_python_31213,
    run_checked,
    sha256_file,
    verify_file,
)


EXPECTED_MEMBERS = {"CHANGELOG.md", "LICENSE", "README.md", "tofu"}


def install(destination: Path, archive: Path | None = None) -> None:
    require_linux_python_31213()
    row = load_lock()["opentofu"]
    staging = private_temp_dir(destination, "opentofu-install")
    payload = staging.parent / f".{staging.name}.zip"
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
                raise ArtifactError("offline OpenTofu archive must be one regular file")
            shutil.copyfile(archive, payload)
        verify_file(payload, size=row["size"], sha256=row["sha256"])
        infos = checked_zip_infos(payload, max_members=4, max_member_size=128 * 1024 * 1024, max_expanded_size=160 * 1024 * 1024)
        if {info.filename for info in infos} != EXPECTED_MEMBERS or any(info.is_dir() for info in infos):
            raise ArtifactError("OpenTofu ZIP members do not match the locked set")
        tofu_info = next(info for info in infos if info.filename == "tofu")
        member_type = (tofu_info.external_attr >> 16) & 0o170000
        if member_type not in (0, stat.S_IFREG):
            raise ArtifactError("OpenTofu executable is not regular")
        target = staging / "tofu"
        with zipfile.ZipFile(payload) as source, source.open(tofu_info) as input_stream, target.open("xb") as output:
            shutil.copyfileobj(input_stream, output)
        target.chmod(0o755)
        before = sha256_file(target)
        result = run_checked([str(target), "version"])
        first_line = result.stdout.splitlines()[0] if result.stdout else ""
        if first_line != f"OpenTofu v{row['version']}" or sha256_file(target) != before:
            raise ArtifactError("OpenTofu version or bytes changed during verification")
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

