from __future__ import annotations

import hashlib
import io
import subprocess
import tarfile
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

from scripts.tests import _ci_import  # noqa: F401
import install_uv
from _locked_artifact import ArtifactError, strict_json_bytes


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class InstallUvTest(unittest.TestCase):
    def _zip(self, path: Path, *, extra: bool = False) -> None:
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("uv.exe", b"uv")
            archive.writestr("uvw.exe", b"uvw")
            archive.writestr("uvx.exe", b"uvx")
            if extra:
                archive.writestr("extra.exe", b"extra")

    def test_offline_windows_archive_installs_flat_verified_pair(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / "uv.zip"
            self._zip(archive)
            lock = {
                "schema_version": 1,
                "uv": {"version": "0.12.3", "artifacts": {"windows-x86_64": {"url": "https://github.com/x", "size": archive.stat().st_size, "sha256": _sha(archive)}}},
            }
            completed = subprocess.CompletedProcess([], 0, stdout="uv 0.12.3\n", stderr="")
            with mock.patch.object(install_uv, "load_lock", return_value=lock), mock.patch.object(
                install_uv, "run_checked", return_value=completed
            ):
                destination = root / "installed"
                install_uv.install("windows-x86_64", destination, archive)
            self.assertEqual({"uv.exe", "uvx.exe"}, {path.name for path in destination.iterdir()})

    def test_extra_member_is_rejected_and_destination_is_absent(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / "uv.zip"
            self._zip(archive, extra=True)
            lock = {"schema_version": 1, "uv": {"version": "0.12.3", "artifacts": {"windows-x86_64": {"url": "https://github.com/x", "size": archive.stat().st_size, "sha256": _sha(archive)}}}}
            with mock.patch.object(install_uv, "load_lock", return_value=lock):
                with self.assertRaises(ArtifactError):
                    install_uv.install("windows-x86_64", root / "installed", archive)
            self.assertFalse((root / "installed").exists())

    def test_duplicate_json_key_fails_closed(self) -> None:
        with self.assertRaises(ArtifactError):
            strict_json_bytes(b'{"schema_version":1,"schema_version":1}')


if __name__ == "__main__":
    unittest.main()
