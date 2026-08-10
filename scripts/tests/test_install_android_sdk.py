from __future__ import annotations

import hashlib
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

from scripts.tests import _ci_import  # noqa: F401
import install_android_sdk
from _locked_artifact import ArtifactError


class InstallAndroidSdkTest(unittest.TestCase):
    def test_lock_has_exact_profile_and_six_packages(self) -> None:
        from _locked_artifact import load_lock

        row = load_lock()["android_sdk"]
        self.assertEqual(install_android_sdk.PROFILE, row["profile"])
        self.assertEqual(6, len(row["packages"]))
        self.assertEqual(
            {
                "cmdline-tools;22.0",
                "platform-tools",
                "platforms;android-35",
                "build-tools;35.0.0",
                "emulator",
                "system-images;android-35;google_apis;x86_64",
            },
            {item["package"] for item in row["packages"]},
        )

    def test_unallowlisted_profile_and_avd_names_fail_before_io(self) -> None:
        with mock.patch.object(install_android_sdk, "require_linux_python_31213"):
            with self.assertRaises(ArtifactError):
                install_android_sdk.install("other", Path("sdk"), Path("avd"), "gc_api35", None)
            with self.assertRaises(ArtifactError):
                install_android_sdk.install(install_android_sdk.PROFILE, Path("sdk"), Path("avd"), "other", None)

    def test_offline_directory_must_contain_exact_locked_basenames(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archives = root / "archives"
            archives.mkdir()
            (archives / "unexpected.zip").write_bytes(b"x")
            row = {"schema_version": 1, "android_sdk": {"profile": install_android_sdk.PROFILE, "host": "linux-x86_64", "packages": []}}
            with mock.patch.object(install_android_sdk, "require_linux_python_31213"), mock.patch.object(
                install_android_sdk, "load_lock", return_value=row
            ):
                with self.assertRaisesRegex(ArtifactError, "exactly match"):
                    install_android_sdk.install(install_android_sdk.PROFILE, root / "sdk", root / "avd", "gc_api35", archives)


if __name__ == "__main__":
    unittest.main()

