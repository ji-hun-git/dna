#!/usr/bin/env python3
"""Install the locked Android API 35 SDK and one allowlisted AVD without sdkmanager."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import install_uv  # noqa: E402


ROOT = Path(__file__).resolve().parents[2]
LOCK_PATH = ROOT / "supply-chain" / "tool-artifacts.lock.json"
PROFILE = "api35-google-apis-x86_64"
AVD_NAMES = ("gc_api35", "gc_genetics_api35")


class InstallError(RuntimeError):
    pass


def _require_host() -> None:
    if tuple(sys.version_info[:3]) != (3, 12, 13):
        raise InstallError("Android SDK installation requires exactly Python 3.12.13")
    if sys.platform != "linux" or platform.machine().lower() not in {"x86_64", "amd64"}:
        raise InstallError("Android SDK installation requires Linux x86_64")


def _profile() -> dict[str, object]:
    lock = install_uv.load_lock(LOCK_PATH)
    row = lock.get("android_sdk")
    if not isinstance(row, dict) or row.get("profile") != PROFILE or row.get("host") != "linux-x86_64":
        raise InstallError("artifact lock does not contain the approved Android SDK profile")
    packages = row.get("packages")
    if not isinstance(packages, list) or len(packages) != 6:
        raise InstallError("Android SDK profile must contain exactly six packages")
    required = {"package", "revision", "archiveRoot", "installPath", "url", "size", "sha1", "sha256"}
    package_names: set[str] = set()
    for package in packages:
        if not isinstance(package, dict) or set(package) != required:
            raise InstallError("Android SDK package row has unexpected fields")
        name = package.get("package")
        if not isinstance(name, str) or name in package_names:
            raise InstallError("Android SDK package IDs must be unique")
        package_names.add(name)
    return row


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        raise InstallError("Android SDK redirects are forbidden")


def _download(row: dict[str, object], destination: Path, deadline: float) -> None:
    url, expected_size = row.get("url"), row.get("size")
    if not isinstance(url, str) or not isinstance(expected_size, int):
        raise InstallError("invalid Android SDK artifact metadata")
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "dl.google.com":
        raise InstallError("Android SDK URL does not match dl.google.com")
    timeout = min(600, max(1, int(deadline - time.monotonic())))
    try:
        with urllib.request.build_opener(_NoRedirect()).open(url, timeout=timeout) as response, destination.open("xb") as output:
            remaining = expected_size + 1
            while remaining:
                if time.monotonic() >= deadline:
                    raise InstallError("Android SDK aggregate download deadline exceeded")
                chunk = response.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                output.write(chunk)
                remaining -= len(chunk)
            output.flush()
            os.fsync(output.fileno())
    except (OSError, urllib.error.URLError) as exc:
        raise InstallError(f"Android SDK download failed: {exc}") from exc


def _verify_bytes(path: Path, row: dict[str, object]) -> None:
    if path.stat().st_size != row.get("size"):
        raise InstallError("Android SDK archive size does not match the lock")
    sha1 = hashlib.sha1()
    sha256 = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            sha1.update(chunk)
            sha256.update(chunk)
    if sha1.hexdigest() != row.get("sha1") or sha256.hexdigest() != row.get("sha256"):
        raise InstallError("Android SDK archive digest does not match the lock")


def _extract_package(archive: Path, row: dict[str, object], sdk: Path) -> None:
    root = str(row["archiveRoot"])
    install_path = sdk / str(row["installPath"])
    install_path.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    casefolded: set[str] = set()
    total = 0
    try:
        with zipfile.ZipFile(archive) as bundle:
            if len(bundle.infolist()) > 40000:
                raise InstallError("Android SDK archive has too many members")
            for info in bundle.infolist():
                name = info.filename.rstrip("/")
                if not name:
                    continue
                if name in seen or name.casefold() in casefolded:
                    raise InstallError("duplicate or case-colliding Android archive member")
                seen.add(name)
                casefolded.add(name.casefold())
                if "\\" in name or name.startswith("/") or ":" in name.split("/")[0]:
                    raise InstallError("unsafe Android archive member path")
                pure = PurePosixPath(name)
                if pure.is_absolute() or any(part in {"", ".", ".."} for part in pure.parts):
                    raise InstallError("unsafe Android archive member path")
                if pure.parts[0] != root:
                    raise InstallError("Android archive member escapes its locked root")
                mode = (info.external_attr >> 16) & 0xFFFF
                member_type = stat.S_IFMT(mode)
                if stat.S_ISLNK(mode) or member_type not in {0, stat.S_IFREG, stat.S_IFDIR}:
                    raise InstallError("non-regular Android archive member")
                if info.file_size > 3 * 1024 * 1024 * 1024:
                    raise InstallError("Android archive member is oversized")
                total += info.file_size
                if total > 12 * 1024 * 1024 * 1024:
                    raise InstallError("Android archive expansion is oversized")
                relative = Path(*pure.parts[1:])
                if not relative.parts:
                    continue
                target = install_path / relative
                if info.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                with bundle.open(info) as source, target.open("xb") as output:
                    shutil.copyfileobj(source, output, length=1024 * 1024)
                    output.flush()
                    os.fsync(output.fileno())
                target.chmod((mode & 0o777) or 0o644)
    except (OSError, zipfile.BadZipFile) as exc:
        raise InstallError(f"invalid Android SDK archive: {exc}") from exc


def _validate_metadata(sdk: Path, row: dict[str, object]) -> None:
    base = sdk / str(row["installPath"])
    metadata_files = [path for path in (base / "source.properties", base / "package.xml") if path.is_file()]
    if not metadata_files:
        raise InstallError(f"Android package metadata is missing for {row['package']}")
    metadata = "\n".join(path.read_text(encoding="utf-8", errors="strict") for path in metadata_files)
    package_id, revision = str(row["package"]), str(row["revision"])
    if package_id not in metadata or revision not in metadata:
        raise InstallError(f"Android package metadata drift: {package_id}")
    required_files = {
        "cmdline-tools;22.0": ("bin/avdmanager",),
        "platform-tools": ("adb",),
        "platforms;android-35": ("android.jar",),
        "build-tools;35.0.0": ("apksigner",),
        "emulator": ("emulator",),
        "system-images;android-35;google_apis;x86_64": ("system.img", "build.prop"),
    }
    if package_id not in required_files or any(not (base / name).is_file() for name in required_files[package_id]):
        raise InstallError(f"Android package is incomplete: {package_id}")
    if package_id.startswith("system-images;"):
        properties = (base / "build.prop").read_text(encoding="utf-8", errors="strict")
        if any(value not in properties for value in ("35", "google_apis", "x86_64")):
            raise InstallError("Android system image metadata does not match API/tag/ABI")


def _require_executables(sdk: Path) -> None:
    tools = (
        sdk / "cmdline-tools/22.0/bin/avdmanager",
        sdk / "platform-tools/adb",
        sdk / "build-tools/35.0.0/apksigner",
        sdk / "emulator/emulator",
    )
    for tool in tools:
        if tool.is_symlink() or not tool.is_file() or (os.name != "nt" and stat.S_IMODE(tool.stat().st_mode) & 0o111 == 0):
            raise InstallError(f"required Android executable is missing or not executable: {tool}")
    checks = ((tools[1], ("version",), "37.0.1"), (tools[3], ("-version",), "37.2.3"))
    for tool, args, expected in checks:
        try:
            result = subprocess.run([str(tool), *args], check=True, capture_output=True, text=True, timeout=15, env=_tool_environment(sdk, sdk.parent / "avd-check"))
        except (OSError, subprocess.SubprocessError) as exc:
            raise InstallError(f"Android executable verification failed: {exc}") from exc
        if expected not in result.stdout + result.stderr:
            raise InstallError(f"Android executable reported an unexpected version: {tool.name}")


def _tool_environment(sdk: Path, avd: Path) -> dict[str, str]:
    environment = {
        "ANDROID_HOME": str(sdk),
        "ANDROID_SDK_ROOT": str(sdk),
        "ANDROID_AVD_HOME": str(avd),
    }
    for name in ("JAVA_HOME", "HOME", "USERPROFILE", "SystemRoot", "WINDIR", "TEMP", "TMP", "LANG"):
        if name in os.environ:
            environment[name] = os.environ[name]
    return environment


def _create_avd(sdk: Path, avd_root: Path, name: str) -> None:
    manager = sdk / "cmdline-tools/22.0/bin/avdmanager"
    package = "system-images;android-35;google_apis;x86_64"
    command = [str(manager), "create", "avd", "--force", "--name", name, "--package", package, "--device", "pixel_7"]
    try:
        result = subprocess.run(command, input="no\n", check=True, capture_output=True, text=True, timeout=120, env=_tool_environment(sdk, avd_root))
    except (OSError, subprocess.SubprocessError) as exc:
        raise InstallError(f"locked AVD creation failed: {exc}") from exc
    output = (result.stdout + result.stderr).lower()
    if "http://" in output or "https://" in output or "download" in output or "license" in output:
        raise InstallError("AVD creation attempted network or license interaction")
    config = avd_root / f"{name}.avd" / "config.ini"
    if not config.is_file():
        raise InstallError("AVD config was not created")
    lines = config.read_text(encoding="utf-8").splitlines()
    values: dict[str, str] = {}
    for line in lines:
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if "=" not in line:
            raise InstallError("AVD config contains an invalid line")
        key, value = (part.strip() for part in line.split("=", 1))
        if key in values:
            raise InstallError("AVD config contains a duplicate key")
        values[key] = value
    if "android-35" not in values.get("image.sysdir.1", "") or values.get("tag.id") != "google_apis" or values.get("abi.type") != "x86_64":
        raise InstallError("AVD config does not match the locked system image")
    values["snapshot.present"] = "no"
    values["fastboot.forceFastBoot"] = "no"
    values["fastboot.forceColdBoot"] = "yes"
    with config.open("w", encoding="utf-8", newline="\n") as handle:
        for key in sorted(values):
            handle.write(f"{key}={values[key]}\n")
        handle.flush()
        os.fsync(handle.fileno())


def _tree_digest(path: Path, excluded: set[str] | None = None) -> str:
    excluded = excluded or set()
    digest = hashlib.sha256()
    for item in sorted((entry for entry in path.rglob("*") if entry.is_file()), key=lambda entry: entry.relative_to(path).as_posix()):
        relative = item.relative_to(path).as_posix()
        if relative in excluded or item.is_symlink():
            continue
        digest.update(relative.encode("utf-8") + b"\0")
        digest.update(str(item.stat().st_size).encode("ascii") + b"\0")
        digest.update(bytes.fromhex(install_uv._sha256(item)))
    return digest.hexdigest()


def install(profile_name: str, destination: Path, avd_destination: Path, avd_name: str, archive_dir: Path | None = None) -> tuple[Path, Path]:
    _require_host()
    if profile_name != PROFILE or avd_name not in AVD_NAMES:
        raise InstallError("unapproved Android profile or AVD name")
    if destination.exists() or destination.is_symlink() or avd_destination.exists() or avd_destination.is_symlink():
        raise InstallError("SDK and AVD destinations must not already exist")
    profile_row = _profile()
    packages = profile_row["packages"]
    assert isinstance(packages, list)
    destination = destination.resolve(strict=False)
    avd_destination = avd_destination.resolve(strict=False)
    if destination.parent != avd_destination.parent:
        raise InstallError("SDK and AVD destinations must share one parent for rollback safety")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".android-install-", dir=destination.parent) as temp_name:
        temp = Path(temp_name)
        archives = temp / "archives"
        archives.mkdir()
        expected_names = {Path(urllib.parse.urlparse(str(row["url"])).path).name for row in packages if isinstance(row, dict)}
        if archive_dir is not None:
            source_dir = archive_dir.resolve(strict=True)
            actual = {item.name for item in source_dir.iterdir() if item.is_file() and not item.is_symlink()}
            if actual != expected_names or any(item.is_symlink() or not item.is_file() for item in source_dir.iterdir()):
                raise InstallError("offline Android archive directory must contain exactly six regular files")
        deadline = time.monotonic() + 900
        archive_receipts: list[dict[str, object]] = []
        sdk = temp / "sdk"
        sdk.mkdir()
        for row in packages:
            assert isinstance(row, dict)
            filename = Path(urllib.parse.urlparse(str(row["url"])).path).name
            local = archives / filename
            if archive_dir is None:
                _download(row, local, deadline)
            else:
                shutil.copyfile(archive_dir / filename, local)
            _verify_bytes(local, row)
            _extract_package(local, row, sdk)
            _validate_metadata(sdk, row)
            archive_receipts.append({"package": row["package"], "sha1": row["sha1"], "sha256": row["sha256"], "size": row["size"]})
        _require_executables(sdk)
        avd = temp / "avd"
        avd.mkdir()
        _create_avd(sdk, avd, avd_name)
        receipt = {
            "archives": sorted(archive_receipts, key=lambda item: str(item["package"])),
            "avdName": avd_name,
            "avdTreeSha256": _tree_digest(avd),
            "profile": PROFILE,
            "sdkTreeSha256": _tree_digest(sdk),
        }
        receipt_path = sdk / "android-sdk-install-receipt.json"
        with receipt_path.open("xb") as handle:
            handle.write((json.dumps(receipt, sort_keys=True, separators=(",", ":")) + "\n").encode())
            handle.flush()
            os.fsync(handle.fileno())
        if destination.exists() or avd_destination.exists():
            raise InstallError("destination appeared during installation")
        sdk_installed = False
        try:
            os.replace(sdk, destination)
            sdk_installed = True
            os.replace(avd, avd_destination)
        except BaseException:
            if sdk_installed and destination.exists():
                shutil.rmtree(destination)
            raise
        install_uv._fsync_directory(destination.parent)
    return destination, avd_destination


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", required=True, choices=(PROFILE,))
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--avd-destination", required=True, type=Path)
    parser.add_argument("--avd-name", required=True, choices=AVD_NAMES)
    parser.add_argument("--archive-dir", type=Path)
    args = parser.parse_args(argv)
    try:
        install(args.profile, args.destination, args.avd_destination, args.avd_name, args.archive_dir)
    except InstallError as exc:
        print(f"install_android_sdk: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
