from __future__ import annotations

import hashlib
import importlib.util
import io
import json
from pathlib import Path
import stat
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock
import zipfile


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("install_uv", ROOT / "scripts/ci/install_uv.py")
assert SPEC and SPEC.loader
install_uv = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(install_uv)


def _archive(path: Path, platform_name: str, extra: bool = False) -> None:
    names = ("uv.exe", "uvw.exe", "uvx.exe") if platform_name == "windows-x86_64" else ("uv", "uvx")
    if platform_name == "windows-x86_64":
        with zipfile.ZipFile(path, "w") as bundle:
            for name in names:
                info = zipfile.ZipInfo(name)
                info.external_attr = (stat.S_IFREG | 0o755) << 16
                bundle.writestr(info, b"locked executable")
            if extra:
                bundle.writestr("extra", b"no")
        return
    with tarfile.open(path, "w:gz") as bundle:
        for name in names:
            payload = b"locked executable"
            info = tarfile.TarInfo(f"uv-root/{name}")
            info.mode = 0o755
            info.size = len(payload)
            bundle.addfile(info, io.BytesIO(payload))
        if extra:
            payload = b"no"
            info = tarfile.TarInfo("uv-root/extra")
            info.size = len(payload)
            bundle.addfile(info, io.BytesIO(payload))


def _lock(platform_name: str, archive: Path) -> dict[str, object]:
    rows = {}
    for name in install_uv.PLATFORMS:
        rows[name] = {
            "url": f"https://github.com/example/{name}",
            "size": archive.stat().st_size if name == platform_name else 1,
            "sha256": hashlib.sha256(archive.read_bytes()).hexdigest() if name == platform_name else "0" * 64,
            "versionOutput": f"uv 0.12.3 (fixture {name})",
        }
    return {"schema_version": 1, "uv": {"version": "0.12.3", "artifacts": rows}}


class InstallUvTest(unittest.TestCase):
    def test_offline_install_accepts_every_locked_platform_shape(self) -> None:
        for platform_name in install_uv.PLATFORMS:
            with self.subTest(platform_name=platform_name), tempfile.TemporaryDirectory() as temp_name:
                temp = Path(temp_name)
                archive = temp / ("uv.zip" if platform_name == "windows-x86_64" else "uv.tar.gz")
                _archive(archive, platform_name)
                destination = temp / "installed"
                with mock.patch.object(install_uv, "load_lock", return_value=_lock(platform_name, archive)), mock.patch.object(
                    install_uv.subprocess,
                    "run",
                    return_value=SimpleNamespace(stdout=f"uv 0.12.3 (fixture {platform_name})\n", stderr=""),
                ):
                    install_uv.install(platform_name, destination, archive)
                expected = {"uv.exe", "uvx.exe"} if platform_name == "windows-x86_64" else {"uv", "uvx"}
                self.assertEqual(expected, {item.name for item in destination.iterdir()})

    def test_wrong_digest_is_rejected_before_extraction(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            temp = Path(temp_name)
            archive = temp / "uv.zip"
            _archive(archive, "windows-x86_64")
            lock = _lock("windows-x86_64", archive)
            lock["uv"]["artifacts"]["windows-x86_64"]["sha256"] = "f" * 64
            with mock.patch.object(install_uv, "load_lock", return_value=lock):
                with self.assertRaisesRegex(install_uv.InstallError, "SHA-256"):
                    install_uv.install("windows-x86_64", temp / "installed", archive)

    def test_extra_member_and_existing_destination_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            temp = Path(temp_name)
            archive = temp / "uv.zip"
            _archive(archive, "windows-x86_64", extra=True)
            with mock.patch.object(install_uv, "load_lock", return_value=_lock("windows-x86_64", archive)):
                with self.assertRaisesRegex(install_uv.InstallError, "unexpected|non-regular"):
                    install_uv.install("windows-x86_64", temp / "installed", archive)
            destination = temp / "exists"
            destination.mkdir()
            with self.assertRaisesRegex(install_uv.InstallError, "must not already exist"):
                install_uv.install("windows-x86_64", destination, archive)

    def test_lock_parser_rejects_duplicate_keys(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            path = Path(temp_name) / "lock.json"
            path.write_text('{"schema_version":1,"schema_version":1}', encoding="utf-8")
            with self.assertRaisesRegex(install_uv.InstallError, "duplicate JSON key"):
                install_uv.load_lock(path)

    def test_platform_detection_is_closed(self) -> None:
        with mock.patch.object(install_uv.sys, "platform", "linux"), mock.patch.object(
            install_uv.platform, "machine", return_value="riscv64"
        ):
            with self.assertRaisesRegex(install_uv.InstallError, "unsupported host"):
                install_uv.detect_platform()


if __name__ == "__main__":
    unittest.main()
