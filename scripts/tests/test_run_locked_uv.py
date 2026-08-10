from __future__ import annotations

import os
import unittest
from unittest import mock

from scripts.tests import _ci_import  # noqa: F401
import run_locked_uv
from _locked_artifact import ArtifactError


class RunLockedUvTest(unittest.TestCase):
    def test_environment_removes_path_proxy_and_uv_overrides(self) -> None:
        source = {"PATH": "untrusted", "HTTPS_PROXY": "https://proxy", "UV_INDEX": "bad", "SystemRoot": "C:/Windows"}
        with mock.patch.dict(os.environ, source, clear=True):
            environment = run_locked_uv._clean_environment()
        self.assertNotIn("PATH", environment)
        self.assertNotIn("HTTPS_PROXY", environment)
        self.assertNotIn("UV_INDEX", environment)
        self.assertEqual("never", environment["UV_PYTHON_DOWNLOADS"])

    def test_unpinned_python_is_rejected_before_install(self) -> None:
        with mock.patch.object(run_locked_uv.sys, "version_info", (3, 12, 12)):
            with self.assertRaisesRegex(ArtifactError, "Python 3.12.13"):
                run_locked_uv.run(["--version"])

    def test_nested_installer_argument_is_rejected(self) -> None:
        with mock.patch.object(run_locked_uv.sys, "version_info", (3, 12, 13)):
            with self.assertRaisesRegex(ArtifactError, "nested"):
                run_locked_uv.run(["run", "scripts/ci/install_uv.py"])


if __name__ == "__main__":
    unittest.main()
