from __future__ import annotations

import hashlib
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import stat
import tempfile
import unittest
from unittest import mock
import zipfile


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("install_opentofu", ROOT / "scripts/ci/install_opentofu.py")
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


def _archive(path: Path, extra: str | None = None) -> None:
    with zipfile.ZipFile(path, "w") as bundle:
        for name in module.EXPECTED_MEMBERS:
            info = zipfile.ZipInfo(name)
            info.external_attr = (stat.S_IFREG | (0o755 if name == "tofu" else 0o644)) << 16
            bundle.writestr(info, b"locked tofu" if name == "tofu" else b"text")
        if extra:
            bundle.writestr(extra, b"bad")


def _row(path: Path) -> dict[str, object]:
    return {"url": "https://github.com/opentofu/opentofu/releases/download/v1.10.6/tofu.zip", "size": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


class InstallOpenTofuTest(unittest.TestCase):
    def test_offline_install_checks_exact_archive_and_version(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            temp = Path(temp_name)
            archive = temp / "tofu.zip"
            _archive(archive)
            with mock.patch.object(module, "_require_host"), mock.patch.object(module, "_row", return_value=_row(archive)), mock.patch.object(
                module.subprocess, "run", return_value=SimpleNamespace(stdout="OpenTofu v1.10.6\non linux_amd64\n", stderr="")
            ):
                module.install(temp / "opentofu", archive)
            self.assertEqual(b"locked tofu", (temp / "opentofu/tofu").read_bytes())

    def test_extra_member_and_wrong_version_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            temp = Path(temp_name)
            archive = temp / "tofu.zip"
            _archive(archive, "evil")
            with mock.patch.object(module, "_require_host"), mock.patch.object(module, "_row", return_value=_row(archive)):
                with self.assertRaisesRegex(module.InstallError, "unexpected members"):
                    module.install(temp / "opentofu", archive)
            archive.unlink()
            _archive(archive)
            with mock.patch.object(module, "_require_host"), mock.patch.object(module, "_row", return_value=_row(archive)), mock.patch.object(
                module.subprocess, "run", return_value=SimpleNamespace(stdout="OpenTofu v1.10.5\n", stderr="")
            ):
                with self.assertRaisesRegex(module.InstallError, "unexpected version"):
                    module.install(temp / "opentofu2", archive)


if __name__ == "__main__":
    unittest.main()
