from __future__ import annotations

import hashlib
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

from scripts.tests import _ci_import  # noqa: F401
import install_bundletool
from _locked_artifact import ArtifactError


class InstallBundletoolTest(unittest.TestCase):
    def _jar(self, path: Path, *, traversal: bool = False) -> None:
        with zipfile.ZipFile(path, "w") as jar:
            jar.writestr("META-INF/MANIFEST.MF", "Manifest-Version: 1.0\nMain-Class: com.android.tools.build.bundletool.BundleToolMain\n")
            jar.writestr("com/android/tools/build/bundletool/BundleToolMain.class", b"class")
            if traversal:
                jar.writestr("../escape", b"bad")

    def test_installs_exact_jar(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            jar = root / "bundletool.jar"
            self._jar(jar)
            row = {"schema_version": 1, "bundletool": {"artifact": {"url": "https://github.com/x", "size": jar.stat().st_size, "sha256": hashlib.sha256(jar.read_bytes()).hexdigest()}}}
            with mock.patch.object(install_bundletool, "load_lock", return_value=row):
                install_bundletool.install(root / "installed", jar)
            self.assertEqual(jar.read_bytes(), (root / "installed" / install_bundletool.OUTPUT_NAME).read_bytes())

    def test_traversal_member_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            jar = root / "bundletool.jar"
            self._jar(jar, traversal=True)
            row = {"schema_version": 1, "bundletool": {"artifact": {"url": "https://github.com/x", "size": jar.stat().st_size, "sha256": hashlib.sha256(jar.read_bytes()).hexdigest()}}}
            with mock.patch.object(install_bundletool, "load_lock", return_value=row):
                with self.assertRaises(ArtifactError):
                    install_bundletool.install(root / "installed", jar)


if __name__ == "__main__":
    unittest.main()

