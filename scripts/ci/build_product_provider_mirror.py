#!/usr/bin/env python3
"""Build the Product AWS provider mirror from one exact upstream ZIP."""

from __future__ import annotations

import argparse
import re
import shutil
import zipfile
from pathlib import Path

from _locked_artifact import (
    ArtifactError,
    ROOT,
    atomic_replace_directory,
    canonical_json_bytes,
    checked_zip_infos,
    download_exact,
    load_lock,
    private_temp_dir,
    require_linux_python_31213,
    sha256_file,
    verify_file,
)


LOCK_PATHS = (
    ROOT / "infra" / "live" / "kr-staging" / "product-web" / ".terraform.lock.hcl",
    ROOT / "infra" / "live" / "kr-production" / "product-web" / ".terraform.lock.hcl",
)


def _validate_lockfiles(row: dict[str, object]) -> tuple[bytes, str]:
    if any(not path.is_file() or path.is_symlink() for path in LOCK_PATHS):
        raise ArtifactError("both Product provider lockfiles must exist and be regular")
    left, right = (path.read_bytes() for path in LOCK_PATHS)
    if left != right:
        raise ArtifactError("Product provider lockfiles are not byte-identical")
    text = left.decode("utf-8", errors="strict")
    provider_blocks = re.findall(r'provider\s+"([^"]+)"\s*\{(.*?)\n\}', text, flags=re.DOTALL)
    if len(provider_blocks) != 1 or provider_blocks[0][0] != row["source"]:
        raise ArtifactError("Product lockfile contains an unexpected provider set")
    body = provider_blocks[0][1]
    if f'version     = "{row["version"]}"' not in body and f'version = "{row["version"]}"' not in body:
        raise ArtifactError("Product AWS provider version is not locked")
    expected_zh = f'zh:{row["sha256"]}'
    if expected_zh not in body:
        raise ArtifactError("Product AWS provider package checksum is not locked")
    return left, sha256_file(LOCK_PATHS[0])


def install(destination: Path, archive: Path | None = None) -> None:
    require_linux_python_31213()
    row = load_lock()["terraformProviderAws"]
    _, lock_digest = _validate_lockfiles(row)
    staging = private_temp_dir(destination, "provider-mirror")
    payload = staging.parent / f".{staging.name}.zip"
    try:
        if archive is None:
            download_exact(
                url=row["url"],
                destination=payload,
                expected_size=row["size"],
                allowed_initial_host="releases.hashicorp.com",
            )
        else:
            if not archive.is_file() or archive.is_symlink():
                raise ArtifactError("offline provider archive must be one regular file")
            shutil.copyfile(archive, payload)
        verify_file(payload, size=row["size"], sha256=row["sha256"])
        infos = checked_zip_infos(payload, max_members=2, max_member_size=512 * 1024 * 1024, max_expanded_size=512 * 1024 * 1024)
        expected = {"LICENSE.txt", row["binary"]}
        if {info.filename for info in infos} != expected or any(info.is_dir() for info in infos):
            raise ArtifactError("provider ZIP members do not match the locked set")
        with zipfile.ZipFile(payload) as source:
            binary_digest = __import__("hashlib").sha256(source.read(str(row["binary"]))).hexdigest()
        target = staging / "product-web-linux-amd64.zip"
        shutil.copyfile(payload, target)
        receipt = {
            "schemaVersion": 1,
            "lockfileSha256": lock_digest,
            "source": row["source"],
            "version": row["version"],
            "platform": row["host"],
            "archiveSize": row["size"],
            "archiveSha256": row["sha256"],
            "binarySha256": binary_digest,
        }
        (staging / "provider-mirror-receipt.json").write_bytes(canonical_json_bytes(receipt))
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
