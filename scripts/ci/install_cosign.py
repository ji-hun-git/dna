#!/usr/bin/env python3
"""Install locked Cosign and its hash-addressed offline trusted root."""

from __future__ import annotations

import argparse
import json
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
    strict_json_bytes,
    verify_file,
)


def _validate_root(path: Path) -> None:
    root = strict_json_bytes(path.read_bytes())
    if not isinstance(root, dict):
        raise ArtifactError("Sigstore trusted root must be an object")
    media_type = root.get("mediaType", "")
    if "trustedroot" not in str(media_type).lower():
        raise ArtifactError("Sigstore trusted root media type is not recognized")
    if not root.get("certificateAuthorities") or not root.get("tlogs"):
        raise ArtifactError("Sigstore trusted root lacks Fulcio or Rekor material")


def install(destination: Path, binary: Path | None = None, trusted_root: Path | None = None) -> None:
    require_linux_python_31213()
    if (binary is None) != (trusted_root is None):
        raise ArtifactError("offline Cosign binary and trusted root must be supplied together")
    row = load_lock()["cosign"]
    root_row = row["trustedRoot"]
    staging = private_temp_dir(destination, "cosign-install")
    binary_payload = staging.parent / f".{staging.name}.cosign"
    root_payload = staging.parent / f".{staging.name}.root"
    try:
        if binary is None:
            download_exact(
                url=row["url"],
                destination=binary_payload,
                expected_size=row["size"],
                allowed_initial_host="github.com",
                allowed_redirect_hosts=("release-assets.githubusercontent.com",),
                max_redirects=1,
            )
            download_exact(
                url=root_row["url"],
                destination=root_payload,
                expected_size=root_row["size"],
                allowed_initial_host="tuf-repo-cdn.sigstore.dev",
            )
        else:
            assert trusted_root is not None
            if any(path.is_symlink() or not path.is_file() for path in (binary, trusted_root)):
                raise ArtifactError("offline Cosign inputs must be regular files")
            shutil.copyfile(binary, binary_payload)
            shutil.copyfile(trusted_root, root_payload)
        verify_file(binary_payload, size=row["size"], sha256=row["sha256"])
        verify_file(root_payload, size=root_row["size"], sha256=root_row["sha256"])
        _validate_root(root_payload)
        cosign = staging / "cosign"
        root = staging / "trusted_root.json"
        shutil.copyfile(binary_payload, cosign)
        shutil.copyfile(root_payload, root)
        cosign.chmod(0o755)
        root.chmod(0o444)
        before = (sha256_file(cosign), sha256_file(root))
        result = run_checked([str(cosign), "version", "--json"])
        try:
            version = json.loads(result.stdout)["gitVersion"]
        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            raise ArtifactError("Cosign returned invalid version JSON") from exc
        if version != f"v{row['version']}" or (sha256_file(cosign), sha256_file(root)) != before:
            raise ArtifactError("Cosign version or installed bytes changed during verification")
        binary_payload.unlink()
        root_payload.unlink()
        atomic_replace_directory(staging, destination)
    except Exception:
        binary_payload.unlink(missing_ok=True)
        root_payload.unlink(missing_ok=True)
        shutil.rmtree(staging, ignore_errors=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--binary", type=Path)
    parser.add_argument("--trusted-root", type=Path)
    args = parser.parse_args()
    try:
        install(args.destination, args.binary, args.trusted_root)
    except ArtifactError as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
