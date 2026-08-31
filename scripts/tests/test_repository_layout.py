from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]


class RepositoryLayoutTest(unittest.TestCase):
    def test_required_foundation_paths_exist(self) -> None:
        required = (
            "settings.gradle.kts",
            "build.gradle.kts",
            "gradle/libs.versions.toml",
            "gradle/wrapper/gradle-wrapper.properties",
            "apps/core-api/build.gradle.kts",
            "apps/core-api/gradle.lockfile",
            "infra/modules",
            "ops",
        )
        missing = [path for path in required if not (ROOT / path).exists()]
        self.assertEqual([], missing)

    def test_gradle_distribution_is_version_and_checksum_pinned(self) -> None:
        text = (ROOT / "gradle/wrapper/gradle-wrapper.properties").read_text(encoding="utf-8")
        self.assertIn("gradle-8.14.3-bin.zip", text)
        self.assertRegex(text, r"distributionSha256Sum=[0-9a-f]{64}")

    def test_repository_does_not_track_local_state_or_secret_files(self) -> None:
        ignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
        for pattern in (".env", "*.tfstate", "*.tfvars", "build/", ".gradle/"):
            self.assertIn(pattern, ignore)

    def test_uv_installer_and_lock_are_foundation_owned(self) -> None:
        self.assertTrue((ROOT / "scripts/ci/install_uv.py").is_file())
        self.assertTrue((ROOT / "scripts/ci/run_locked_uv.py").is_file())
        self.assertTrue((ROOT / "scripts/ci/install_bundletool.py").is_file())
        self.assertTrue((ROOT / "scripts/ci/install_android_sdk.py").is_file())
        self.assertTrue((ROOT / "scripts/ci/install_buildx.py").is_file())
        self.assertTrue((ROOT / "scripts/ci/install_opentofu.py").is_file())
        self.assertTrue((ROOT / "scripts/ci/build_product_provider_mirror.py").is_file())
        self.assertTrue((ROOT / "supply-chain/tool-artifacts.lock.json").is_file())


if __name__ == "__main__":
    unittest.main()
