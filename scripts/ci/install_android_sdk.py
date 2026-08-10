#!/usr/bin/env python3
"""Install the exact offline-capable Android API 35 SDK and AVD profile."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import tempfile
import urllib.parse
from pathlib import Path

from _locked_artifact import (
    ArtifactError,
    atomic_replace_directory,
    canonical_json_bytes,
    download_exact,
    extract_zip_prefix,
    load_lock,
    private_temp_dir,
    require_linux_python_31213,
    run_checked,
    tree_sha256,
    verify_file,
)


PROFILE = "api35-google-apis-x86_64"
AVD_NAMES = ("gc_api35", "gc_genetics_api35")


def _properties(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="strict").splitlines():
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key in values:
            raise ArtifactError(f"duplicate Android property: {key}")
        values[key] = value.strip()
    return values


def _validate_package(package: dict[str, object], installed: Path) -> None:
    source = installed / "source.properties"
    if not source.is_file() or source.is_symlink():
        raise ArtifactError(f"Android package lacks source.properties: {package['package']}")
    values = _properties(source)
    revision = values.get("Pkg.Revision", "")
    if revision != str(package["revision"]):
        raise ArtifactError(f"Android package revision mismatch: {package['package']} -> {revision}")
    package_name = str(package["package"])
    if package_name == "platforms;android-35" and values.get("AndroidVersion.ApiLevel") != "35":
        raise ArtifactError("Android platform API level mismatch")
    if package_name.startswith("system-images;"):
        if values.get("AndroidVersion.ApiLevel") != "35":
            raise ArtifactError("Android system image API mismatch")
        if values.get("SystemImage.TagId") != "google_apis" or values.get("SystemImage.Abi") != "x86_64":
            raise ArtifactError("Android system image tag or ABI mismatch")
        if not (installed / "system.img").is_file():
            raise ArtifactError("Android system image is incomplete")


def _verify_tools(sdk: Path) -> None:
    adb = run_checked([str(sdk / "platform-tools" / "adb"), "version"])
    if not adb.stdout.startswith("Android Debug Bridge version 1.0.41") or "Version 37.0.1" not in adb.stdout:
        raise ArtifactError("adb version does not match platform-tools 37.0.1")
    apksigner = run_checked([str(sdk / "build-tools" / "35.0.0" / "apksigner"), "version"])
    if apksigner.stdout.strip() != "0.9":
        raise ArtifactError("apksigner version does not match build-tools 35.0.0")
    emulator = run_checked([str(sdk / "emulator" / "emulator"), "-version"])
    if "37.2.3" not in (emulator.stdout + emulator.stderr):
        raise ArtifactError("Android emulator version mismatch")


def _create_avd(sdk: Path, avd: Path, avd_name: str) -> None:
    avdmanager = sdk / "cmdline-tools" / "22.0" / "bin" / "avdmanager"
    if not avdmanager.is_file() or avdmanager.is_symlink():
        raise ArtifactError("locked avdmanager is missing")
    java = shutil.which("java")
    if java is None:
        raise ArtifactError("locked Java 21 runtime is unavailable")
    java_result = run_checked([java, "-version"])
    java_version = java_result.stdout + java_result.stderr
    if "21.0.8" not in java_version or "Temurin" not in java_version:
        raise ArtifactError("Android AVD creation requires Eclipse Temurin 21.0.8")
    env = {
        "ANDROID_SDK_ROOT": str(sdk),
        "ANDROID_HOME": str(sdk),
        "ANDROID_AVD_HOME": str(avd),
        "HOME": str(avd.parent),
        "LANG": "C.UTF-8",
        "PATH": os.pathsep.join((str(Path(java).resolve().parent), "/usr/bin", "/bin")),
    }
    command = [
        str(avdmanager),
        "create",
        "avd",
        "--force",
        "--name",
        avd_name,
        "--package",
        "system-images;android-35;google_apis;x86_64",
        "--device",
        "pixel_7",
        "--path",
        str(avd / f"{avd_name}.avd"),
    ]
    try:
        result = subprocess.run(
            command,
            input="no\n",
            text=True,
            capture_output=True,
            timeout=120,
            env=env,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise ArtifactError(f"locked AVD creation failed: {exc}") from exc
    combined = (result.stdout + result.stderr).lower()
    if any(word in combined for word in ("download", "fetch", "license")):
        raise ArtifactError("AVD creation attempted network or license activity")
    config = avd / f"{avd_name}.avd" / "config.ini"
    if not config.is_file():
        raise ArtifactError("AVD config was not created")
    text = config.read_text(encoding="utf-8", errors="strict")
    required = ("image.sysdir.1=system-images/android-35/google_apis/x86_64/", "tag.id=google_apis", "abi.type=x86_64")
    if any(item not in text.replace("\\", "/") for item in required):
        raise ArtifactError("AVD config does not bind the locked system image")
    with config.open("a", encoding="utf-8", newline="\n") as output:
        output.write("fastboot.forceColdBoot=yes\nfastboot.forceFastBoot=no\n")


def install(profile: str, destination: Path, avd_destination: Path, avd_name: str, archive_dir: Path | None) -> None:
    require_linux_python_31213()
    if profile != PROFILE or avd_name not in AVD_NAMES:
        raise ArtifactError("Android SDK profile or AVD name is not allowlisted")
    lock = load_lock()["android_sdk"]
    if lock["profile"] != PROFILE or lock["host"] != "linux-x86_64":
        raise ArtifactError("Android SDK lock profile is invalid")
    packages = lock["packages"]
    expected_names = {Path(urllib.parse.urlparse(row["url"]).path).name for row in packages}
    if archive_dir is not None:
        if not archive_dir.is_dir() or archive_dir.is_symlink():
            raise ArtifactError("offline Android archive input must be a regular directory")
        actual_names = {path.name for path in archive_dir.iterdir() if path.is_file() and not path.is_symlink()}
        if actual_names != expected_names or any(path.is_dir() or path.is_symlink() for path in archive_dir.iterdir()):
            raise ArtifactError("offline Android archive directory does not exactly match the lock")
    sdk_stage = private_temp_dir(destination, "android-sdk-install")
    avd_stage = private_temp_dir(avd_destination, "android-avd-install")
    archive_work = Path(tempfile.mkdtemp(prefix="gc-android-archives-", dir=destination.parent))
    receipts: list[dict[str, object]] = []
    try:
        for row in packages:
            name = Path(urllib.parse.urlparse(row["url"]).path).name
            payload = archive_work / name
            if archive_dir is None:
                download_exact(
                    url=row["url"],
                    destination=payload,
                    expected_size=row["size"],
                    allowed_initial_host="dl.google.com",
                    timeout_seconds=600,
                )
            else:
                shutil.copyfile(archive_dir / name, payload)
            verify_file(payload, size=row["size"], sha1=row["sha1"], sha256=row["sha256"])
            install_path = sdk_stage / str(row["installPath"])
            install_path.mkdir(parents=True, exist_ok=False)
            extract_zip_prefix(payload, install_path, archive_root=str(row["archiveRoot"]))
            _validate_package(row, install_path)
            receipts.append(
                {
                    "package": row["package"],
                    "revision": row["revision"],
                    "size": row["size"],
                    "sha1": row["sha1"],
                    "sha256": row["sha256"],
                }
            )
        _verify_tools(sdk_stage)
        _create_avd(sdk_stage, avd_stage, avd_name)
        receipt = {
            "schemaVersion": 1,
            "profile": profile,
            "avdName": avd_name,
            "packages": receipts,
            "sdkTreeSha256": tree_sha256(sdk_stage),
            "avdTreeSha256": tree_sha256(avd_stage),
        }
        (sdk_stage / "android-sdk-install-receipt.json").write_bytes(canonical_json_bytes(receipt))
        shutil.rmtree(archive_work)
        atomic_replace_directory(sdk_stage, destination)
        try:
            atomic_replace_directory(avd_stage, avd_destination)
        except Exception:
            shutil.rmtree(destination, ignore_errors=True)
            raise
    except Exception:
        shutil.rmtree(archive_work, ignore_errors=True)
        shutil.rmtree(sdk_stage, ignore_errors=True)
        shutil.rmtree(avd_stage, ignore_errors=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument("--profile", required=True, choices=(PROFILE,))
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--avd-destination", required=True, type=Path)
    parser.add_argument("--avd-name", required=True, choices=AVD_NAMES)
    parser.add_argument("--archive-dir", type=Path)
    args = parser.parse_args()
    try:
        install(args.profile, args.destination, args.avd_destination, args.avd_name, args.archive_dir)
    except ArtifactError as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
