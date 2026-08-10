from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from scripts.tests import _ci_import  # noqa: F401
import install_cosign


class InstallCosignTest(unittest.TestCase):
    def test_offline_pair_is_verified_and_installed(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            binary = root / "cosign"
            binary.write_bytes(b"locked-cosign")
            trusted = root / "trusted_root.json"
            trusted.write_text(json.dumps({"mediaType": "application/vnd.dev.sigstore.trustedroot+json;version=0.1", "certificateAuthorities": [{}], "tlogs": [{}]}, separators=(",", ":")), encoding="utf-8")
            row = {
                "schema_version": 1,
                "cosign": {
                    "url": "https://github.com/x",
                    "version": "3.0.6",
                    "size": binary.stat().st_size,
                    "sha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
                    "trustedRoot": {"url": "https://tuf-repo-cdn.sigstore.dev/x", "size": trusted.stat().st_size, "sha256": hashlib.sha256(trusted.read_bytes()).hexdigest()},
                },
            }
            completed = subprocess.CompletedProcess([], 0, stdout='{"gitVersion":"v3.0.6"}\n', stderr="")
            with mock.patch.object(install_cosign, "require_linux_python_31213"), mock.patch.object(
                install_cosign, "load_lock", return_value=row
            ), mock.patch.object(install_cosign, "run_checked", return_value=completed):
                install_cosign.install(root / "installed", binary, trusted)
            self.assertEqual(binary.read_bytes(), (root / "installed" / "cosign").read_bytes())
            self.assertEqual(trusted.read_bytes(), (root / "installed" / "trusted_root.json").read_bytes())

    def test_offline_inputs_must_be_paired(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            binary = root / "cosign"
            binary.write_bytes(b"x")
            with mock.patch.object(install_cosign, "require_linux_python_31213"):
                with self.assertRaisesRegex(Exception, "together"):
                    install_cosign.install(root / "installed", binary, None)


if __name__ == "__main__":
    unittest.main()
