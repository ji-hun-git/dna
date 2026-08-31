#!/usr/bin/env python3
"""Install the pinned Cosign binary and immutable Sigstore trusted root."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parent))
import install_uv  # noqa: E402


ROOT = Path(__file__).resolve().parents[2]
LOCK_PATH = ROOT / "supply-chain" / "tool-artifacts.lock.json"


class InstallError(RuntimeError):
    pass


def _require_host() -> None:
    if tuple(sys.version_info[:3]) != (3, 12, 13):
        raise InstallError("install_cosign requires exactly Python 3.12.13")
    if sys.platform != "linux" or platform.machine().lower() not in {"x86_64", "amd64"}:
        raise InstallError("install_cosign requires Linux x86_64")


def _row() -> dict[str, object]:
    lock = install_uv.load_lock(LOCK_PATH)
    row = lock.get("cosign")
    if not isinstance(row, dict) or row.get("version") != "3.0.6" or row.get("host") != "linux-x86_64":
        raise InstallError("artifact lock does not pin Cosign 3.0.6 for Linux x86_64")
    root = row.get("trustedRoot")
    if not isinstance(root, dict) or root.get("tufSnapshotVersion") != 165 or root.get("tufTargetsVersion") != 14:
        raise InstallError("Cosign trusted-root lock metadata is invalid")
    return row


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        raise InstallError("redirect is forbidden for the Sigstore trusted root")


def _download_exact(url: str, destination: Path, expected_size: int, expected_host: str) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != expected_host:
        raise InstallError("download URL does not match the locked origin")
    opener = urllib.request.build_opener(_NoRedirect())
    try:
        with opener.open(urllib.request.Request(url, headers={"User-Agent": "gc-foundation-bootstrap/1"}), timeout=60) as response, destination.open("xb") as output:
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
        raise InstallError(f"trusted-root download failed: {exc}") from exc


def _validate_trusted_root(path: Path) -> None:
    raw = path.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf") or b"\x00" in raw:
        raise InstallError("trusted root must be plain UTF-8")
    try:
        text = raw.decode("utf-8")
        data = json.loads(text, object_pairs_hook=install_uv._strict_object)
    except (UnicodeDecodeError, json.JSONDecodeError, install_uv.InstallError) as exc:
        raise InstallError(f"invalid trusted-root JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise InstallError("trusted root must be a JSON object")
    media = data.get("mediaType") or data.get("_type")
    if not isinstance(media, str) or "trustedroot" not in media.lower().replace("-", ""):
        raise InstallError("trusted root has an unexpected media type")
    authorities = data.get("certificateAuthorities")
    logs = data.get("transparencyLogs")
    if not isinstance(authorities, list) or not authorities:
        raise InstallError("trusted root has no Fulcio certificate authority")
    if not isinstance(logs, list) or not logs:
        raise InstallError("trusted root has no Rekor transparency log")
    flattened = json.dumps(data, sort_keys=True).lower()
    if "fulcio" not in flattened or "rekor" not in flattened:
        raise InstallError("trusted root does not bind Fulcio and Rekor")
    if not any(isinstance(item, dict) and item.get("publicKey") for item in logs):
        raise InstallError("trusted root transparency log has no public key")


def install(destination: Path, binary: Path | None = None, trusted_root: Path | None = None) -> Path:
    _require_host()
    if (binary is None) != (trusted_root is None):
        raise InstallError("--binary and --trusted-root must be supplied together")
    if destination.exists() or destination.is_symlink():
        raise InstallError("destination must not already exist")
    row = _row()
    root_row = row["trustedRoot"]
    if not isinstance(root_row, dict):
        raise InstallError("trusted-root artifact metadata is invalid")
    destination = destination.resolve(strict=False)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".cosign-install-", dir=destination.parent) as temp_name:
        temp = Path(temp_name)
        local_binary = temp / "cosign"
        local_root = temp / "trusted_root.json"
        if binary is None:
            try:
                install_uv._download(str(row["url"]), local_binary, int(row["size"]))
            except install_uv.InstallError as exc:
                raise InstallError(str(exc)) from exc
            _download_exact(str(root_row["url"]), local_root, int(root_row["size"]), "tuf-repo-cdn.sigstore.dev")
        else:
            for source, target, label in ((binary, local_binary, "Cosign binary"), (trusted_root, local_root, "trusted root")):
                assert source is not None
                resolved = source.resolve(strict=True)
                if resolved.is_symlink() or not resolved.is_file():
                    raise InstallError(f"offline {label} must be a regular file")
                shutil.copyfile(resolved, target)
        if local_binary.stat().st_size != row.get("size") or install_uv._sha256(local_binary) != row.get("sha256"):
            raise InstallError("Cosign binary size or SHA-256 does not match the lock")
        if local_root.stat().st_size != root_row.get("size") or install_uv._sha256(local_root) != root_row.get("sha256"):
            raise InstallError("trusted-root size or SHA-256 does not match the lock")
        _validate_trusted_root(local_root)
        local_binary.chmod(0o755)
        before_binary = install_uv._sha256(local_binary)
        before_root = install_uv._sha256(local_root)
        try:
            result = subprocess.run([str(local_binary), "version", "--json"], check=True, capture_output=True, text=True, timeout=15)
            version = json.loads(result.stdout, object_pairs_hook=install_uv._strict_object)
        except (OSError, subprocess.SubprocessError, json.JSONDecodeError, install_uv.InstallError) as exc:
            raise InstallError(f"Cosign version verification failed: {exc}") from exc
        if not isinstance(version, dict) or version.get("gitVersion") != "v3.0.6" or result.stderr:
            raise InstallError("Cosign reported an unexpected version")
        if install_uv._sha256(local_binary) != before_binary or install_uv._sha256(local_root) != before_root:
            raise InstallError("Cosign inputs changed during verification")
        staged = temp / "destination"
        staged.mkdir(mode=0o700)
        for source, name, mode in ((local_binary, "cosign", 0o755), (local_root, "trusted_root.json", 0o444)):
            target = staged / name
            shutil.copyfile(source, target)
            with target.open("rb+") as handle:
                os.fsync(handle.fileno())
            target.chmod(mode)
        if destination.exists() or destination.is_symlink():
            raise InstallError("destination appeared during installation")
        os.replace(staged, destination)
        install_uv._fsync_directory(destination.parent)
    return destination


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--binary", type=Path)
    parser.add_argument("--trusted-root", type=Path)
    args = parser.parse_args(argv)
    try:
        install(args.destination, args.binary, args.trusted_root)
    except InstallError as exc:
        print(f"install_cosign: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
