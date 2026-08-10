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
SPEC = importlib.util.spec_from_file_location("install_android_sdk", ROOT / "scripts/ci/install_android_sdk.py")
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


ROWS = (
    ("cmdline-tools;22.0", "22.0", "cmdline-tools", "cmdline-tools/22.0", "cmdline.zip", ("bin/avdmanager",)),
    ("platform-tools", "37.0.1", "platform-tools", "platform-tools", "platform.zip", ("adb",)),
    ("platforms;android-35", "2", "android-35", "platforms/android-35", "api.zip", ("android.jar",)),
    ("build-tools;35.0.0", "35.0.0", "android-15", "build-tools/35.0.0", "build.zip", ("apksigner",)),
    ("emulator", "37.2.3", "emulator", "emulator", "emulator.zip", ("emulator",)),
    ("system-images;android-35;google_apis;x86_64", "9", "x86_64", "system-images/android-35/google_apis/x86_64", "system.zip", ("system.img", "build.prop")),
)


def _profile(archive_dir: Path) -> dict[str, object]:
    packages = []
    for package_id, revision, root, install_path, filename, files in ROWS:
        archive = archive_dir / filename
        with zipfile.ZipFile(archive, "w") as bundle:
            metadata = f"Pkg.Path={package_id}\nPkg.Revision={revision}\n"
            bundle.writestr(f"{root}/source.properties", metadata)
            for relative in files:
                info = zipfile.ZipInfo(f"{root}/{relative}")
                executable = relative in {"bin/avdmanager", "adb", "apksigner", "emulator"}
                info.external_attr = (stat.S_IFREG | (0o755 if executable else 0o644)) << 16
                payload = b"35 google_apis x86_64" if relative == "build.prop" else b"locked"
                bundle.writestr(info, payload)
        payload = archive.read_bytes()
        packages.append(
            {
                "package": package_id,
                "revision": revision,
                "archiveRoot": root,
                "installPath": install_path,
                "url": f"https://dl.google.com/android/repository/{filename}",
                "size": len(payload),
                "sha1": hashlib.sha1(payload).hexdigest(),
                "sha256": hashlib.sha256(payload).hexdigest(),
            }
        )
    return {"profile": module.PROFILE, "host": "linux-x86_64", "packages": packages}


class InstallAndroidSdkTest(unittest.TestCase):
    def test_synthetic_offline_profile_installs_sdk_avd_and_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            temp = Path(temp_name)
            archives = temp / "archives"
            archives.mkdir()
            profile = _profile(archives)

            def process(command, **kwargs):
                executable = Path(command[0]).name
                if executable == "adb":
                    return SimpleNamespace(stdout="Android Debug Bridge Version 37.0.1\n", stderr="")
                if executable == "emulator":
                    return SimpleNamespace(stdout="Android emulator version 37.2.3\n", stderr="")
                self.assertEqual("no\n", kwargs["input"])
                self.assertIn("system-images;android-35;google_apis;x86_64", command)
                name = command[command.index("--name") + 1]
                avd_home = Path(kwargs["env"]["ANDROID_AVD_HOME"])
                config = avd_home / f"{name}.avd/config.ini"
                config.parent.mkdir(parents=True)
                config.write_text(
                    "image.sysdir.1=system-images/android-35/google_apis/x86_64\n"
                    "tag.id=google_apis\nabi.type=x86_64\nsnapshot.present=no\n",
                    encoding="utf-8",
                )
                return SimpleNamespace(stdout="AVD created\n", stderr="")

            with mock.patch.object(module, "_require_host"), mock.patch.object(module, "_profile", return_value=profile), mock.patch.object(
                module.subprocess, "run", side_effect=process
            ):
                module.install(module.PROFILE, temp / "sdk", temp / "avd", "gc_api35", archives)
            self.assertTrue((temp / "sdk/android-sdk-install-receipt.json").is_file())
            self.assertTrue((temp / "avd/gc_api35.avd/config.ini").is_file())

    def test_name_destination_and_offline_set_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            temp = Path(temp_name)
            with mock.patch.object(module, "_require_host"):
                with self.assertRaisesRegex(module.InstallError, "unapproved"):
                    module.install(module.PROFILE, temp / "sdk", temp / "avd", "personal", temp)
            (temp / "sdk").mkdir()
            with mock.patch.object(module, "_require_host"):
                with self.assertRaisesRegex(module.InstallError, "must not already exist"):
                    module.install(module.PROFILE, temp / "sdk", temp / "avd", "gc_api35", temp)


if __name__ == "__main__":
    unittest.main()
