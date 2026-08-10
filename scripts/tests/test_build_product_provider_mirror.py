from __future__ import annotations

import hashlib
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

from scripts.tests import _ci_import  # noqa: F401
import build_product_provider_mirror


class BuildProductProviderMirrorTest(unittest.TestCase):
    def test_exact_provider_archive_and_lockfiles_produce_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            staging_lock = root / "staging.lock.hcl"
            production_lock = root / "production.lock.hcl"
            provider_bytes = b"provider"
            archive = root / "provider.zip"
            with zipfile.ZipFile(archive, "w") as source:
                source.writestr("LICENSE.txt", b"license")
                source.writestr("terraform-provider-aws_v6.10.0_x5", provider_bytes)
            digest = hashlib.sha256(archive.read_bytes()).hexdigest()
            lock_text = f'''provider "registry.opentofu.org/hashicorp/aws" {{
  version     = "6.10.0"
  hashes = ["zh:{digest}"]
}}
'''
            staging_lock.write_text(lock_text, encoding="utf-8")
            production_lock.write_text(lock_text, encoding="utf-8")
            row = {"schema_version": 1, "terraformProviderAws": {"source": "registry.opentofu.org/hashicorp/aws", "version": "6.10.0", "host": "linux_amd64", "url": "https://releases.hashicorp.com/x", "size": archive.stat().st_size, "sha256": digest, "binary": "terraform-provider-aws_v6.10.0_x5"}}
            with mock.patch.object(build_product_provider_mirror, "require_linux_python_31213"), mock.patch.object(
                build_product_provider_mirror, "LOCK_PATHS", (staging_lock, production_lock)
            ), mock.patch.object(build_product_provider_mirror, "load_lock", return_value=row):
                destination = root / "mirror"
                build_product_provider_mirror.install(destination, archive)
            self.assertEqual(archive.read_bytes(), (destination / "product-web-linux-amd64.zip").read_bytes())
            self.assertTrue((destination / "provider-mirror-receipt.json").is_file())

    def test_nonidentical_lockfiles_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            left, right = root / "left", root / "right"
            left.write_text("a", encoding="utf-8")
            right.write_text("b", encoding="utf-8")
            with mock.patch.object(build_product_provider_mirror, "LOCK_PATHS", (left, right)):
                with self.assertRaisesRegex(Exception, "byte-identical"):
                    build_product_provider_mirror._validate_lockfiles({"source": "x", "version": "1", "sha256": "0" * 64})


if __name__ == "__main__":
    unittest.main()
