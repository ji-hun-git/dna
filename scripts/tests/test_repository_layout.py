from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]


class RepositoryLayoutTest(unittest.TestCase):
    def test_required_foundation_paths_exist(self) -> None:
        required = (
            "settings.gradle.kts",
            "build.gradle.kts",
            "gradle/libs.versions.toml",
            "gradle/wrapper/gradle-wrapper.properties",
            "gradle/wrapper/gradle-wrapper.jar",
            "gradlew",
            "gradlew.bat",
            "apps/core-api/build.gradle.kts",
            "apps/core-api/gradle.lockfile",
            "infra/modules",
            "ops",
        )
        missing = [path for path in required if not (ROOT / path).exists()]
        self.assertEqual([], missing)

    def test_gradle_distribution_is_version_and_checksum_pinned(self) -> None:
        text = (ROOT / "gradle/wrapper/gradle-wrapper.properties").read_text()
        self.assertIn("gradle-8.14.3-bin.zip", text)
        self.assertRegex(text, r"distributionSha256Sum=[0-9a-f]{64}")

    def test_repository_does_not_track_local_state_or_secret_files(self) -> None:
        ignore = (ROOT / ".gitignore").read_text()
        for pattern in (".env", "*.tfstate", "*.tfvars", "build/", ".gradle/"):
            self.assertIn(pattern, ignore)

    def test_foundation_owned_tool_installers_and_lock_exist(self) -> None:
        required = (
            "scripts/ci/install_uv.py",
            "scripts/ci/run_locked_uv.py",
            "scripts/ci/install_bundletool.py",
            "scripts/ci/install_android_sdk.py",
            "scripts/ci/install_buildx.py",
            "scripts/ci/install_opentofu.py",
            "scripts/ci/install_cosign.py",
            "scripts/ci/build_product_provider_mirror.py",
            "supply-chain/tool-artifacts.lock.json",
        )
        missing = [path for path in required if not (ROOT / path).is_file()]
        self.assertEqual([], missing)


if __name__ == "__main__":
    unittest.main()
