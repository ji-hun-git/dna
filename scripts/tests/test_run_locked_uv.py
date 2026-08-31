from __future__ import annotations

import importlib.util
import os
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("run_locked_uv", ROOT / "scripts/ci/run_locked_uv.py")
assert SPEC and SPEC.loader
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


class RunLockedUvTest(unittest.TestCase):
    def test_main_requires_one_literal_separator(self) -> None:
        self.assertEqual(2, runner.main([]))
        self.assertEqual(2, runner.main(["--version"]))
        self.assertEqual(2, runner.main(["--", "--version", "--"]))

    def test_python_patch_version_is_exact(self) -> None:
        with mock.patch.object(runner.sys, "version_info", (3, 12, 12)):
            with self.assertRaisesRegex(runner.RunnerError, "3.12.13"):
                runner.run(["--version"])

    def test_nested_shells_and_bootstrap_are_rejected(self) -> None:
        for arguments in (["python", "tool.py"], ["run", "scripts/ci/install_uv.py"]):
            with self.subTest(arguments=arguments):
                with self.assertRaises(runner.RunnerError):
                    runner._validate_arguments(list(arguments))

    def test_child_environment_removes_ambient_tool_and_network_overrides(self) -> None:
        hostile = {
            "UV_INDEX_URL": "https://evil.example",
            "PYTHONPATH": "C:/evil",
            "HTTPS_PROXY": "http://evil.example",
            "SSL_CERT_FILE": "C:/evil.pem",
            "PATH": "C:/evil",
        }
        with mock.patch.dict(os.environ, hostile, clear=False):
            environment = runner._child_environment()
        for name in hostile:
            self.assertNotIn(name, environment)
        self.assertEqual("never", environment["UV_PYTHON_DOWNLOADS"])

    def test_fresh_install_matches_cache_and_child_status_is_propagated(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)

            def fake_install(platform_name: str, destination: Path) -> None:
                destination.mkdir(parents=True)
                for name in ("uv.exe", "uvx.exe"):
                    path = destination / name
                    path.write_bytes(b"locked executable")
                    path.chmod(0o755)

            with mock.patch.object(runner, "CACHE_ROOT", root / "uv"), mock.patch.object(
                runner, "_platform_name", return_value="windows-x86_64"
            ), mock.patch.object(runner, "_invoke_installer", side_effect=fake_install), mock.patch.object(
                runner, "_version"
            ), mock.patch.object(runner.sys, "version_info", (3, 12, 13)), mock.patch.object(
                runner.subprocess, "run", return_value=SimpleNamespace(returncode=7)
            ) as child:
                self.assertEqual(7, runner.run(["--version"]))
                environment = child.call_args.kwargs["env"]
                self.assertNotIn("PATH", environment)
                self.assertEqual("never", environment["UV_PYTHON_DOWNLOADS"])


if __name__ == "__main__":
    unittest.main()
