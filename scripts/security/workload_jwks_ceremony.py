"""Public-coordinate handoff builder; production mutation stays deferred."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from scripts.security.build_workload_jwks_documents import canonical_json_bytes, sha256


COORDINATE_KEYS = {"key", "versionId", "sha256"}
SECRET_COORDINATE_KEYS = {"secretArn", "versionId", "sha256"}


def _coordinate(value: dict[str, Any], keys: set[str], name: str) -> None:
    if set(value) != keys or any(not isinstance(value[key], str) or not value[key] for key in keys):
        raise ValueError(f"invalid {name} coordinate")


def build_prepared_pair(
    *,
    sequence: int,
    registry: dict[str, Any],
    release: dict[str, Any],
    candidate_signer_key_version_id_sha256: str,
    keygen_result: dict[str, Any],
    root_bundle: dict[str, Any],
    prepared_at: str,
) -> dict[str, Any]:
    if set(registry) != SECRET_COORDINATE_KEYS | {"signingResult"}:
        raise ValueError("invalid registry handoff")
    if set(release) != SECRET_COORDINATE_KEYS | {"signingResult"}:
        raise ValueError("invalid release handoff")
    _coordinate({key: registry[key] for key in SECRET_COORDINATE_KEYS}, SECRET_COORDINATE_KEYS, "registry")
    _coordinate(registry["signingResult"], COORDINATE_KEYS, "registry signing result")
    _coordinate({key: release[key] for key in SECRET_COORDINATE_KEYS}, SECRET_COORDINATE_KEYS, "release")
    _coordinate(release["signingResult"], COORDINATE_KEYS, "release signing result")
    _coordinate(keygen_result, COORDINATE_KEYS, "keygen result")
    _coordinate(root_bundle, SECRET_COORDINATE_KEYS, "root bundle")
    if not candidate_signer_key_version_id_sha256.startswith("sha256:"):
        raise ValueError("candidate signer coordinate must be a digest only")
    prepared: dict[str, Any] = {
        "schemaVersion": "workload-jwks-prepared-pair.v1",
        "sequence": sequence,
        "registry": registry,
        "release": release,
        "candidateSignerKeyVersionIdSha256": candidate_signer_key_version_id_sha256,
        "keygenResult": keygen_result,
        "rootBundle": root_bundle,
        "preparedAt": prepared_at,
    }
    encoded = canonical_json_bytes(prepared)
    if b"private" in encoded.lower():
        raise ValueError("prepared pair contains private material")
    prepared["preparedPairSha256"] = sha256(encoded)
    return prepared


def require_production_prerequisites(outputs: dict[str, Any], workflow_verification: dict[str, Any]) -> None:
    required_outputs = {
        "ai_artifact_signing_state_machine_arn",
        "workload_jwks_release_secret_arn",
        "workload_jwks_root_registry_secret_arn",
        "ai_artifact_signing_root_bundle_secret_arn",
    }
    if set(outputs) != required_outputs or any(not outputs[key] for key in required_outputs):
        raise ValueError("exact Task 7C outputs are required")
    if workflow_verification != {
        "schemaVersion": "protected-workflow-verification.v1",
        "status": "verified",
    }:
        raise ValueError("immutable Task 8 workflow verification is required")


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    production = subparsers.add_parser("prepare-production")
    production.add_argument("--foundation-outputs", type=Path, required=True)
    production.add_argument("--workflow-verification", type=Path, required=True)
    args = parser.parse_args()
    outputs = json.loads(args.foundation_outputs.read_text(encoding="utf-8"))
    verification = json.loads(args.workflow_verification.read_text(encoding="utf-8"))
    require_production_prerequisites(outputs, verification)
    raise SystemExit("production preparation is deferred to Task 8 Step 6")


if __name__ == "__main__":
    main()
