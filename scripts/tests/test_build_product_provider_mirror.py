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
SPEC = importlib.util.spec_from_file_location("build_product_provider_mirror", ROOT / "scripts/ci/build_product_provider_mirror.py")
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


LOCK_TEXT = f'''provider "{module.SOURCE}" {{
  version = "{module.VERSION}"
  hashes = ["zh:{module.ZH}"]
}}
'''.encode()


def _archive(path: Path) -> None:
    with zipfile.ZipFile(path, "w") as bundle:
        for name, payload, mode in (("LICENSE.txt", b"license", 0o644), ("terraform-provider-aws_v6.10.0_x5", b"provider", 0o755)):
            info = zipfile.ZipInfo(name)
            info.external_attr = (stat.S_IFREG | mode) << 16
            bundle.writestr(info, payload)


class BuildProductProviderMirrorTest(unittest.TestCase):
    def test_offline_mirror_preserves_zip_and_writes_canonical_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            temp = Path(temp_name)
            archive = temp / "provider.zip"
            _archive(archive)
            row = {"url": "https://releases.hashicorp.com/provider.zip", "size": archive.stat().st_size, "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(), "binary": "terraform-provider-aws_v6.10.0_x5"}
            with mock.patch.object(module, "_require_host"), mock.patch.object(module, "_lock_bytes", return_value=LOCK_TEXT), mock.patch.object(
                module, "_provider_row", return_value=row
            ), mock.patch.object(module.subprocess, "run", return_value=SimpleNamespace(stdout="terraform-provider-aws_v6.10.0_x5\n", stderr="")):
                module.build(temp / "mirror", archive)
            self.assertEqual(archive.read_bytes(), (temp / "mirror/product-web-linux-amd64.zip").read_bytes())
            self.assertTrue((temp / "mirror/provider-mirror-receipt.json").is_file())

    def test_lockfile_inequality_and_extra_member_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            temp = Path(temp_name)
            staging = temp / "staging.lock"
            production = temp / "production.lock"
            staging.write_bytes(LOCK_TEXT)
            production.write_bytes(LOCK_TEXT + b"# drift\n")
            with mock.patch.object(module, "STAGING_LOCK", staging), mock.patch.object(module, "PRODUCTION_LOCK", production):
                with self.assertRaisesRegex(module.MirrorError, "not byte-identical"):
                    module._lock_bytes()


if __name__ == "__main__":
    unittest.main()
