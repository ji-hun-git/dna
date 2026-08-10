from __future__ import annotations

import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest import mock
import zipfile


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("install_bundletool", ROOT / "scripts/ci/install_bundletool.py")
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


def _jar(path: Path, version: str = "1.18.1", extra: str | None = None) -> None:
    main_class = "com.android.tools.build.bundletool.BundleToolMain" if version == "1.18.1" else "example.WrongMain"
    manifest = (
        "Manifest-Version: 1.0\n"
        f"Main-Class: {main_class}\n"
        f"Implementation-Version: {version}\n"
    )
    with zipfile.ZipFile(path, "w") as bundle:
        bundle.writestr("META-INF/MANIFEST.MF", manifest)
        bundle.writestr("com/android/tools/build/bundletool/BundleToolMain.class", b"class")
        if extra:
            bundle.writestr(extra, b"bad")


def _row(path: Path) -> dict[str, object]:
    with zipfile.ZipFile(path) as bundle:
        sizes = [entry.file_size for entry in bundle.infolist()]
    return {
        "url": "https://github.com/google/bundletool/releases/download/1.18.1/bundletool-all-1.18.1.jar",
        "size": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "entryCount": len(sizes),
        "expandedSize": sum(sizes),
        "maximumEntrySize": max(sizes),
        "manifestMainClass": "com.android.tools.build.bundletool.BundleToolMain",
    }


class InstallBundletoolTest(unittest.TestCase):
    def test_offline_install_is_exact_and_atomic(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            temp = Path(temp_name)
            jar = temp / "input.jar"
            _jar(jar)
            destination = temp / "bundletool"
            with mock.patch.object(module, "_load_row", return_value=_row(jar)):
                module.install(destination, jar)
            self.assertEqual({module.FILENAME}, {path.name for path in destination.iterdir()})
            self.assertEqual(hashlib.sha256(jar.read_bytes()).hexdigest(), hashlib.sha256((destination / module.FILENAME).read_bytes()).hexdigest())

    def test_version_and_path_attacks_fail_closed(self) -> None:
        for version, extra in (("1.18.0", None), ("1.18.1", "../escape")):
            with self.subTest(version=version, extra=extra), tempfile.TemporaryDirectory() as temp_name:
                temp = Path(temp_name)
                jar = temp / "input.jar"
                _jar(jar, version=version, extra=extra)
                with mock.patch.object(module, "_load_row", return_value=_row(jar)):
                    with self.assertRaises(module.InstallError):
                        module.install(temp / "bundletool", jar)

    def test_digest_and_existing_destination_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            temp = Path(temp_name)
            jar = temp / "input.jar"
            _jar(jar)
            row = _row(jar)
            row["sha256"] = "0" * 64
            with mock.patch.object(module, "_load_row", return_value=row):
                with self.assertRaisesRegex(module.InstallError, "SHA-256"):
                    module.install(temp / "bundletool", jar)
            destination = temp / "exists"
            destination.mkdir()
            with self.assertRaisesRegex(module.InstallError, "must not already exist"):
                module.install(destination, jar)


if __name__ == "__main__":
    unittest.main()
