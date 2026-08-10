from __future__ import annotations

import hashlib
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from scripts.tests import _ci_import  # noqa: F401
import install_buildx


class InstallBuildxTest(unittest.TestCase):
    def test_offline_binary_is_hash_and_version_checked(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            binary = root / "buildx"
            binary.write_bytes(b"locked-buildx")
            row = {"schema_version": 1, "container_builder": {"buildx": {"url": "https://github.com/x", "version": "0.20.1", "size": binary.stat().st_size, "sha256": hashlib.sha256(binary.read_bytes()).hexdigest()}}}
            completed = subprocess.CompletedProcess([], 0, stdout="github.com/docker/buildx v0.20.1\n", stderr="")
            with mock.patch.object(install_buildx, "require_linux_python_31213"), mock.patch.object(
                install_buildx, "load_lock", return_value=row
            ), mock.patch.object(install_buildx, "run_checked", return_value=completed):
                install_buildx.install(root / "installed", binary)
            self.assertEqual(binary.read_bytes(), (root / "installed" / "docker-buildx").read_bytes())


if __name__ == "__main__":
    unittest.main()

