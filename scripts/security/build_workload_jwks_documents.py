"""Deterministic public-only workload JWKS document construction."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any


RELEASE_PREFIX = b"GC-WORKLOAD-JWKS-RELEASE-V1\0"
REGISTRY_PREFIX = b"GC-WORKLOAD-JWKS-ROOT-REGISTRY-V1\0"
KEYGEN_RESULT_KEYS = {
    "schemaVersion", "requestSha256", "kid", "publicKeyRawBase64Url",
    "publicKeySha256", "privateKeyVersionIdSha256", "notBefore", "notAfter",
    "executedAt", "resultSha256",
}


def canonical_json_bytes(value: Any) -> bytes:
    def reject_float(item: Any) -> None:
        if isinstance(item, float):
            raise ValueError("floating point values are not canonical inputs")
        if isinstance(item, dict):
            for child in item.values():
                reject_float(child)
        elif isinstance(item, list):
            for child in item:
                reject_float(child)

    reject_float(value)
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256(value: bytes) -> str:
    return "sha256:" + hashlib.sha256(value).hexdigest()


def without_self_digest(value: dict[str, Any], field: str) -> dict[str, Any]:
    return {key: item for key, item in value.items() if key != field}


def _exact_keys(value: dict[str, Any], expected: set[str], name: str) -> None:
    if set(value) != expected:
        raise ValueError(f"{name} fields differ: {sorted(set(value) ^ expected)}")


def _utc(value: str) -> datetime:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise ValueError("timestamp must be UTC RFC3339 Z")
    return datetime.fromisoformat(value[:-1] + "+00:00")


def _decode_public_key(value: str) -> bytes:
    if not isinstance(value, str) or len(value) != 43:
        raise ValueError("Ed25519 public key must be 43 base64url characters")
    raw = base64.urlsafe_b64decode(value + "=")
    if len(raw) != 32 or base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii") != value:
        raise ValueError("non-canonical Ed25519 public key")
    return raw


def validate_keygen_result(result: dict[str, Any]) -> None:
    _exact_keys(result, KEYGEN_RESULT_KEYS, "keygen result")
    if result["schemaVersion"] != "workload-jwks-keygen-result.v1":
        raise ValueError("wrong keygen schema")
    if not isinstance(result["kid"], str) or not result["kid"].startswith("workload-"):
        raise ValueError("invalid kid")
    raw = _decode_public_key(result["publicKeyRawBase64Url"])
    if result["publicKeySha256"] != sha256(raw):
        raise ValueError("public key digest mismatch")
    if _utc(result["notBefore"]) >= _utc(result["notAfter"]):
        raise ValueError("invalid key interval")
    expected = sha256(canonical_json_bytes(without_self_digest(result, "resultSha256")))
    if result["resultSha256"] != expected:
        raise ValueError("keygen result digest mismatch")


def build_workload_document(
    policy: dict[str, Any],
    keygen_result: dict[str, Any],
    *,
    sequence: int,
    generated_at: str,
) -> dict[str, Any]:
    _exact_keys(
        policy,
        {"schemaVersion", "issuer", "audience", "tokenLifetimeSeconds", "desiredRole", "notBefore", "notAfter", "sourceSha", "inputDigest"},
        "public input",
    )
    validate_keygen_result(keygen_result)
    if policy["schemaVersion"] != "workload-jwks-public-input.v1":
        raise ValueError("wrong public input schema")
    if policy["desiredRole"] not in {"current", "next"}:
        raise ValueError("invalid desired role")
    if policy["notBefore"] != keygen_result["notBefore"] or policy["notAfter"] != keygen_result["notAfter"]:
        raise ValueError("policy and keygen interval differ")
    expected_input = sha256(canonical_json_bytes(without_self_digest(policy, "inputDigest")))
    if policy["inputDigest"] != expected_input:
        raise ValueError("public input digest mismatch")
    key = {
        "kty": "OKP", "crv": "Ed25519", "alg": "EdDSA", "use": "sig",
        "kid": keygen_result["kid"], "x": keygen_result["publicKeyRawBase64Url"],
        "role": policy["desiredRole"], "notBefore": policy["notBefore"], "notAfter": policy["notAfter"],
    }
    document: dict[str, Any] = {
        "schemaVersion": "workload-jwks.v1",
        "sequence": sequence,
        "generatedAt": generated_at,
        "keys": [key],
    }
    document["documentDigest"] = sha256(canonical_json_bytes(document))
    return document


def build_root_registry(
    *,
    sequence: int,
    generated_at: str,
    release_key_id: str,
    release_public_key_raw_base64url: str,
    not_before: str,
    not_after: str,
    state: str = "active",
) -> dict[str, Any]:
    raw = _decode_public_key(release_public_key_raw_base64url)
    if state not in {"next", "active", "retired", "revoked"}:
        raise ValueError("invalid root state")
    if _utc(not_before) >= _utc(not_after):
        raise ValueError("invalid root interval")
    registry: dict[str, Any] = {
        "schemaVersion": "workload-jwks-root-registry.v1",
        "sequence": sequence,
        "generatedAt": generated_at,
        "roots": [{
            "releaseKeyId": release_key_id,
            "publicKeyRawBase64Url": release_public_key_raw_base64url,
            "publicKeySha256": sha256(raw),
            "notBefore": not_before,
            "notAfter": not_after,
            "state": state,
        }],
    }
    registry["registryDigest"] = sha256(canonical_json_bytes(registry))
    return registry


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(canonical_json_bytes(value) + b"\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--public-input", type=Path, required=True)
    parser.add_argument("--keygen-result", type=Path, required=True)
    parser.add_argument("--sequence", type=int, required=True)
    parser.add_argument("--generated-at", required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    policy = json.loads(args.public_input.read_text(encoding="utf-8"))
    result = json.loads(args.keygen_result.read_text(encoding="utf-8"))
    write_json(args.out, build_workload_document(policy, result, sequence=args.sequence, generated_at=args.generated_at))


if __name__ == "__main__":
    main()
