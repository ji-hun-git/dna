from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("install_cosign", ROOT / "scripts/ci/install_cosign.py")
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


def _root_bytes(include_rekor: bool = True) -> bytes:
    data = {
        "mediaType": "application/vnd.dev.sigstore.trustedroot+json;version=0.1",
        "certificateAuthorities": [{"uri": "https://fulcio.sigstore.dev", "certChain": {"certificates": [{"rawBytes": "AA=="}]}}],
        "transparencyLogs": [{"baseUrl": "https://rekor.sigstore.dev" if include_rekor else "https://log.example", "publicKey": {"rawBytes": "AA=="}}],
    }
    return json.dumps(data, sort_keys=True, separators=(",", ":")).encode()


class InstallCosignTest(unittest.TestCase):
    def test_offline_binary_and_root_are_verified_together(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            temp = Path(temp_name)
            binary = temp / "cosign-input"
            root = temp / "root.json"
            binary.write_bytes(b"locked cosign")
            root.write_bytes(_root_bytes())
            row = {
                "url": "https://github.com/sigstore/cosign/releases/download/v3.0.6/cosign-linux-amd64",
                "size": binary.stat().st_size,
                "sha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
                "trustedRoot": {"size": root.stat().st_size, "sha256": hashlib.sha256(root.read_bytes()).hexdigest()},
            }
            with mock.patch.object(module, "_require_host"), mock.patch.object(module, "_row", return_value=row), mock.patch.object(
                module.subprocess, "run", return_value=SimpleNamespace(stdout='{"gitVersion":"v3.0.6"}', stderr="")
            ):
                module.install(temp / "cosign", binary, root)
            self.assertEqual({"cosign", "trusted_root.json"}, {item.name for item in (temp / "cosign").iterdir()})

    def test_pairing_root_schema_and_version_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            temp = Path(temp_name)
            binary = temp / "cosign-input"
            root = temp / "root.json"
            binary.write_bytes(b"locked cosign")
            root.write_bytes(_root_bytes(include_rekor=False))
            with mock.patch.object(module, "_require_host"):
                with self.assertRaisesRegex(module.InstallError, "supplied together"):
                    module.install(temp / "out", binary, None)
            with self.assertRaisesRegex(module.InstallError, "Fulcio and Rekor"):
                module._validate_trusted_root(root)


if __name__ == "__main__":
    unittest.main()
