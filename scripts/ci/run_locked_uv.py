#!/usr/bin/env python3
"""Run the repository-pinned uv after an independent cache verification."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[2]
INSTALLER = ROOT / "scripts" / "ci" / "install_uv.py"
CACHE_ROOT = ROOT / "build" / "tools" / "uv"
VERSION = "0.12.3"


class RunnerError(RuntimeError):
    pass


def _platform_name() -> str:
    sys.path.insert(0, str(INSTALLER.parent))
    try:
        import install_uv

        return install_uv.detect_platform()
    finally:
        sys.path.pop(0)


def _digest(path: Path) -> tuple[int, str, int]:
    if path.is_symlink() or not path.is_file():
        raise RunnerError(f"not a regular executable: {path}")
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return path.stat().st_size, digest.hexdigest(), stat.S_IMODE(path.stat().st_mode)


def _invoke_installer(platform_name: str, destination: Path) -> None:
    command = [
        sys.executable,
        str(INSTALLER),
        "--platform",
        platform_name,
        "--destination",
        str(destination),
    ]
    try:
        subprocess.run(command, check=True, timeout=180)
    except (OSError, subprocess.SubprocessError) as exc:
        raise RunnerError(f"locked uv installer failed: {exc}") from exc


def _binary_names(platform_name: str) -> tuple[str, str]:
    return ("uv.exe", "uvx.exe") if platform_name == "windows-x86_64" else ("uv", "uvx")


def _validate_cache(path: Path, platform_name: str) -> None:
    if path.is_symlink() or not path.is_dir():
        raise RunnerError("uv cache must be a real directory")
    expected = set(_binary_names(platform_name))
    actual = {entry.name for entry in path.iterdir()}
    if actual != expected:
        raise RunnerError("uv cache contains unexpected entries")
    for name in expected:
        size, _, mode = _digest(path / name)
        if size < 1 or mode & 0o111 == 0:
            raise RunnerError("uv cache executable has an unsafe mode")


def _version(binary: Path, platform_name: str) -> None:
    try:
        result = subprocess.run(
            [str(binary), "--version"],
            check=True,
            capture_output=True,
            text=True,
            timeout=15,
            env=_child_environment(),
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise RunnerError(f"uv version verification failed: {exc}") from exc
    sys.path.insert(0, str(INSTALLER.parent))
    try:
        import install_uv

        row = install_uv.load_lock()["uv"]["artifacts"][platform_name]
    finally:
        sys.path.pop(0)
    expected = row.get("versionOutput") if isinstance(row, dict) else None
    if not isinstance(expected, str) or result.stdout.strip() != expected or result.stderr:
        raise RunnerError("uv version output does not match the lock")


def _child_environment() -> dict[str, str]:
    allowed = (
        "HOME",
        "USERPROFILE",
        "SystemRoot",
        "WINDIR",
        "ComSpec",
        "TEMP",
        "TMP",
        "LANG",
        "LC_ALL",
        "TERM",
    )
    environment = {name: os.environ[name] for name in allowed if name in os.environ}
    environment["UV_PYTHON_DOWNLOADS"] = "never"
    return environment


def _validate_arguments(arguments: list[str]) -> None:
    if not arguments:
        raise RunnerError("at least one uv argument is required after --")
    forbidden_programs = {"bash", "cmd", "pip", "pip3", "pipx", "powershell", "pwsh", "python", "python3", "sh"}
    if arguments[0].lower() in forbidden_programs:
        raise RunnerError("nested shell or package installer execution is forbidden")
    for value in arguments:
        lowered = value.replace("\\", "/").lower()
        if lowered.endswith("/install_uv.py") or lowered.endswith("/run_locked_uv.py"):
            raise RunnerError("recursive bootstrap execution is forbidden")


def run(arguments: list[str]) -> int:
    if tuple(sys.version_info[:3]) != (3, 12, 13):
        raise RunnerError("run_locked_uv requires exactly Python 3.12.13")
    _validate_arguments(arguments)
    platform_name = _platform_name()
    cache = CACHE_ROOT / platform_name
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        _invoke_installer(platform_name, cache)
    _validate_cache(cache, platform_name)
    names = _binary_names(platform_name)
    with tempfile.TemporaryDirectory(prefix=".uv-verify-", dir=cache.parent) as temp_name:
        verification = Path(temp_name) / "installed"
        _invoke_installer(platform_name, verification)
        _validate_cache(verification, platform_name)
        for name in names:
            if _digest(cache / name) != _digest(verification / name):
                raise RunnerError(f"cached {name} differs from a fresh locked installation")
        binary = cache / names[0]
        _version(binary, platform_name)
        before = _digest(binary)
        try:
            result = subprocess.run([str(binary), *arguments], env=_child_environment())
        except OSError as exc:
            raise RunnerError(f"cannot execute locked uv: {exc}") from exc
        after = _digest(binary)
        if before != after:
            raise RunnerError("uv binary changed while the child was running")
        return result.returncode


def main(argv: list[str] | None = None) -> int:
    raw = list(sys.argv[1:] if argv is None else argv)
    if not raw or raw[0] != "--" or raw.count("--") != 1:
        print("run_locked_uv: arguments are accepted only after one literal --", file=sys.stderr)
        return 2
    try:
        return run(raw[1:])
    except RunnerError as exc:
        print(f"run_locked_uv: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
