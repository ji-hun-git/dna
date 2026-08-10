#!/usr/bin/env python3
"""Build the single-provider offline mirror accepted by the UX authority."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import install_uv  # noqa: E402


ROOT = Path(__file__).resolve().parents[2]
LOCK_PATH = ROOT / "supply-chain" / "tool-artifacts.lock.json"
STAGING_LOCK = ROOT / "infra" / "live" / "product-web-staging" / ".terraform.lock.hcl"
PRODUCTION_LOCK = ROOT / "infra" / "live" / "product-web-prod" / ".terraform.lock.hcl"
SOURCE = "registry.opentofu.org/hashicorp/aws"
VERSION = "6.10.0"
ZH = "3c92efebaf635372bf7283e04fc667d59b0ff3cf1aacd011fc484a11f70954d9"


class MirrorError(RuntimeError):
    pass


def _require_host() -> None:
    if tuple(sys.version_info[:3]) != (3, 12, 13):
        raise MirrorError("provider mirror requires exactly Python 3.12.13")
    if sys.platform != "linux" or platform.machine().lower() not in {"x86_64", "amd64"}:
        raise MirrorError("provider mirror requires Linux x86_64")


def _provider_row() -> dict[str, object]:
    lock = install_uv.load_lock(LOCK_PATH)
    row = lock.get("terraformProviderAws")
    if not isinstance(row, dict):
        raise MirrorError("AWS provider artifact row is missing")
    expected = {"source": SOURCE, "version": VERSION, "host": "linux_amd64", "sha256": ZH, "binary": "terraform-provider-aws_v6.10.0_x5"}
    if any(row.get(key) != value for key, value in expected.items()):
        raise MirrorError("AWS provider artifact row does not match the authority contract")
    return row


def _lock_bytes() -> bytes:
    try:
        staging = STAGING_LOCK.read_bytes()
        production = PRODUCTION_LOCK.read_bytes()
    except OSError as exc:
        raise MirrorError(f"cannot read Product provider locks: {exc}") from exc
    if staging != production:
        raise MirrorError("Product provider lockfiles are not byte-identical")
    try:
        text = staging.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise MirrorError("Product provider lock is not UTF-8") from exc
    blocks = re.findall(r'provider\s+"([^"]+)"\s*\{(.*?)\}', text, flags=re.DOTALL)
    if len(blocks) != 1 or blocks[0][0] != SOURCE:
        raise MirrorError("Product lock must contain only the AWS provider")
    body = blocks[0][1]
    version = re.search(r'^\s*version\s*=\s*"([^"]+)"', body, flags=re.MULTILINE)
    hashes = re.findall(r'"(zh:[0-9a-f]{64}|h1:[A-Za-z0-9+/=]+)"', body)
    if version is None or version.group(1) != VERSION or f"zh:{ZH}" not in hashes:
        raise MirrorError("Product lock does not pin the approved AWS provider tuple")
    return staging


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        raise MirrorError("provider archive redirects are forbidden")


def _download(url: str, destination: Path, expected_size: int) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "releases.hashicorp.com":
        raise MirrorError("provider URL does not match the locked HashiCorp origin")
    try:
        with urllib.request.build_opener(_NoRedirect()).open(url, timeout=60) as response, destination.open("xb") as output:
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
        raise MirrorError(f"provider download failed: {exc}") from exc


def _extract_binary(archive: Path, binary_name: str, output: Path) -> None:
    expected = {"LICENSE.txt", binary_name}
    seen: set[str] = set()
    try:
        with zipfile.ZipFile(archive) as bundle:
            for info in bundle.infolist():
                if info.filename in seen:
                    raise MirrorError("duplicate provider archive member")
                seen.add(info.filename)
                path = PurePosixPath(info.filename)
                mode = (info.external_attr >> 16) & 0xFFFF
                member_type = stat.S_IFMT(mode)
                if len(path.parts) != 1 or path.is_absolute() or info.is_dir() or stat.S_ISLNK(mode) or member_type not in {0, stat.S_IFREG}:
                    raise MirrorError("unsafe provider archive member")
                if info.file_size > 1024 * 1024 * 1024:
                    raise MirrorError("provider archive member is oversized")
            if seen != expected:
                raise MirrorError("provider archive has unexpected members")
            with bundle.open(binary_name) as source, output.open("xb") as target:
                shutil.copyfileobj(source, target, length=1024 * 1024)
                target.flush()
                os.fsync(target.fileno())
    except (OSError, zipfile.BadZipFile) as exc:
        raise MirrorError(f"invalid provider archive: {exc}") from exc


def build(destination: Path, archive: Path | None = None) -> Path:
    _require_host()
    if destination.exists() or destination.is_symlink():
        raise MirrorError("destination must not already exist")
    lock_bytes = _lock_bytes()
    row = _provider_row()
    url, size, digest, binary_name = row.get("url"), row.get("size"), row.get("sha256"), row.get("binary")
    if not isinstance(url, str) or not isinstance(size, int) or not isinstance(digest, str) or not isinstance(binary_name, str):
        raise MirrorError("invalid provider artifact metadata")
    destination = destination.resolve(strict=False)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".provider-mirror-", dir=destination.parent) as temp_name:
        temp = Path(temp_name)
        local = temp / "provider.zip"
        if archive is None:
            _download(url, local, size)
        else:
            source = archive.resolve(strict=True)
            if source.is_symlink() or not source.is_file():
                raise MirrorError("offline provider archive must be one regular file")
            shutil.copyfile(source, local)
        if local.stat().st_size != size or install_uv._sha256(local) != digest:
            raise MirrorError("provider size or SHA-256 does not match the lock")
        binary = temp / binary_name
        _extract_binary(local, binary_name, binary)
        binary.chmod(0o755)
        before = install_uv._sha256(binary)
        try:
            result = subprocess.run([str(binary), "-version"], check=True, capture_output=True, text=True, timeout=15)
        except (OSError, subprocess.SubprocessError) as exc:
            raise MirrorError(f"provider executable verification failed: {exc}") from exc
        if result.stdout.strip() != "terraform-provider-aws_v6.10.0_x5" or result.stderr:
            raise MirrorError("provider executable reported an unexpected tuple")
        if install_uv._sha256(binary) != before:
            raise MirrorError("provider binary changed during verification")
        staged = temp / "destination"
        staged.mkdir(mode=0o700)
        archive_target = staged / "product-web-linux-amd64.zip"
        shutil.copyfile(local, archive_target)
        receipt = {
            "archiveSha256": digest,
            "archiveSize": size,
            "binarySha256": before,
            "lockfileSha256": hashlib.sha256(lock_bytes).hexdigest(),
            "platform": "linux_amd64",
            "source": SOURCE,
            "version": VERSION,
        }
        receipt_bytes = (json.dumps(receipt, sort_keys=True, separators=(",", ":")) + "\n").encode()
        receipt_path = staged / "provider-mirror-receipt.json"
        with receipt_path.open("xb") as handle:
            handle.write(receipt_bytes)
            handle.flush()
            os.fsync(handle.fileno())
        if destination.exists() or destination.is_symlink():
            raise MirrorError("destination appeared during mirror creation")
        os.replace(staged, destination)
        install_uv._fsync_directory(destination.parent)
    return destination


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--archive", type=Path)
    args = parser.parse_args(argv)
    try:
        build(args.destination, args.archive)
    except MirrorError as exc:
        print(f"build_product_provider_mirror: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
