from __future__ import annotations

import hashlib
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("install_buildx", ROOT / "scripts/ci/install_buildx.py")
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class InstallBuildxTest(unittest.TestCase):
    def test_offline_install_verifies_binary_and_version(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            temp = Path(temp_name)
            binary = temp / "buildx"
            binary.write_bytes(b"locked buildx")
            row = {"url": "https://github.com/docker/buildx/releases/download/v0.20.1/buildx", "size": binary.stat().st_size, "sha256": hashlib.sha256(binary.read_bytes()).hexdigest()}
            with mock.patch.object(module, "_require_host"), mock.patch.object(module, "_row", return_value=row), mock.patch.object(
                module.subprocess, "run", return_value=SimpleNamespace(stdout="github.com/docker/buildx v0.20.1 deadbeef\n", stderr="")
            ):
                module.install(temp / "plugins", binary)
            self.assertEqual(b"locked buildx", (temp / "plugins/docker-buildx").read_bytes())

    def test_host_version_digest_and_destination_are_closed(self) -> None:
        with mock.patch.object(module.sys, "version_info", (3, 11, 9)):
            with self.assertRaisesRegex(module.InstallError, "3.12.13"):
                module._require_host()
        with tempfile.TemporaryDirectory() as temp_name:
            temp = Path(temp_name)
            binary = temp / "buildx"
            binary.write_bytes(b"locked buildx")
            row = {"url": "https://github.com/docker/buildx/releases/download/v0.20.1/buildx", "size": binary.stat().st_size, "sha256": "0" * 64}
            with mock.patch.object(module, "_require_host"), mock.patch.object(module, "_row", return_value=row):
                with self.assertRaisesRegex(module.InstallError, "size or SHA-256"):
                    module.install(temp / "plugins", binary)
            destination = temp / "exists"
            destination.mkdir()
            with mock.patch.object(module, "_require_host"):
                with self.assertRaisesRegex(module.InstallError, "must not already exist"):
                    module.install(destination, binary)


if __name__ == "__main__":
    unittest.main()
