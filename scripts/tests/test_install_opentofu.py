from __future__ import annotations

import hashlib
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

from scripts.tests import _ci_import  # noqa: F401
import install_opentofu


class InstallOpenTofuTest(unittest.TestCase):
    def test_exact_four_member_archive_installs_tofu(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / "tofu.zip"
            with zipfile.ZipFile(archive, "w") as source:
                for name in install_opentofu.EXPECTED_MEMBERS:
                    source.writestr(name, b"tofu" if name == "tofu" else name.encode())
            row = {"schema_version": 1, "opentofu": {"url": "https://github.com/x", "version": "1.10.6", "size": archive.stat().st_size, "sha256": hashlib.sha256(archive.read_bytes()).hexdigest()}}
            completed = subprocess.CompletedProcess([], 0, stdout="OpenTofu v1.10.6\n", stderr="")
            with mock.patch.object(install_opentofu, "require_linux_python_31213"), mock.patch.object(
                install_opentofu, "load_lock", return_value=row
            ), mock.patch.object(install_opentofu, "run_checked", return_value=completed):
                install_opentofu.install(root / "installed", archive)
            self.assertEqual(b"tofu", (root / "installed" / "tofu").read_bytes())


if __name__ == "__main__":
    unittest.main()

