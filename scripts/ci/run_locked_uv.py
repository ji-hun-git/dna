#!/usr/bin/env python3
"""Execute repository-locked uv with a verified cache and sanitized environment."""

from __future__ import annotations

import hashlib
import os
import shutil
import stat
import subprocess
import sys
import tempfile
from pathlib import Path

from _locked_artifact import ArtifactError, ROOT, host_platform, load_lock, sha256_file
from install_uv import install


def _mode(path: Path) -> int:
    return stat.S_IMODE(path.stat().st_mode)


def _fingerprint(path: Path) -> tuple[int, str, int]:
    if not path.is_file() or path.is_symlink():
        raise ArtifactError(f"locked uv file is not regular: {path}")
    return path.stat().st_size, sha256_file(path), _mode(path)


def _clean_environment() -> dict[str, str]:
    keep = ("SystemRoot", "SYSTEMROOT", "COMSPEC", "ComSpec", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL")
    env = {key: os.environ[key] for key in keep if key in os.environ}
    env["UV_PYTHON_DOWNLOADS"] = "never"
    return env


def run(child_args: list[str]) -> int:
    if sys.version_info[:3] != (3, 12, 13):
        raise ArtifactError("locked uv runner requires Python 3.12.13")
    if not child_args:
        raise ArtifactError("locked uv runner requires child arguments after --")
    if any("install_uv.py" in arg or "run_locked_uv.py" in arg for arg in child_args):
        raise ArtifactError("nested locked-uv installer execution is forbidden")
    platform_name = host_platform()
    lock = load_lock()
    if platform_name not in lock["uv"]["artifacts"]:
        raise ArtifactError("host platform is absent from the uv lock")
    cache = ROOT / "build" / "tools" / "uv" / platform_name
    if cache.is_symlink():
        raise ArtifactError("locked uv cache must not be a symlink")
    if not cache.exists():
        install(platform_name, cache)
    names = ("uv.exe", "uvx.exe") if platform_name == "windows-x86_64" else ("uv", "uvx")
    before = {name: _fingerprint(cache / name) for name in names}
    with tempfile.TemporaryDirectory(prefix="gc-uv-verify-") as temp:
        verification = Path(temp) / "uv"
        install(platform_name, verification)
        verified = {name: _fingerprint(verification / name) for name in names}
        if verified != before:
            raise ArtifactError("locked uv cache differs from an independently verified install")
    binary = cache / names[0]
    selected_before = sha256_file(binary)
    result = subprocess.run([str(binary), *child_args], env=_clean_environment(), check=False)
    if sha256_file(binary) != selected_before or {name: _fingerprint(cache / name) for name in names} != before:
        raise ArtifactError("locked uv cache mutated during execution")
    return result.returncode


def main() -> int:
    args = sys.argv[1:]
    if not args or args[0] != "--" or args.count("--") != 1:
        raise SystemExit("usage: run_locked_uv.py -- <uv arguments>")
    try:
        return run(args[1:])
    except ArtifactError as exc:
        raise SystemExit(str(exc)) from exc


if __name__ == "__main__":
    raise SystemExit(main())
