"""Strict public wrapper verification for workload JWKS artifacts."""

from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from scripts.security.build_workload_jwks_documents import (
    REGISTRY_PREFIX,
    RELEASE_PREFIX,
    canonical_json_bytes,
    sha256,
    without_self_digest,
)


def _decode(value: str) -> bytes:
    if not isinstance(value, str):
        raise ValueError("signature is not a string")
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def verify_release_wrapper(wrapper: dict[str, Any], public_key_raw: bytes) -> None:
    if set(wrapper) != {"document", "signatureBase64Url", "releaseKeyId"}:
        raise ValueError("invalid release wrapper fields")
    document = wrapper["document"]
    if document.get("schemaVersion") != "workload-jwks.v1":
        raise ValueError("invalid release document")
    expected = sha256(canonical_json_bytes(without_self_digest(document, "documentDigest")))
    if document.get("documentDigest") != expected:
        raise ValueError("release document digest mismatch")
    Ed25519PublicKey.from_public_bytes(public_key_raw).verify(
        _decode(wrapper["signatureBase64Url"]),
        RELEASE_PREFIX + canonical_json_bytes(document),
    )


def verify_registry_wrapper(wrapper: dict[str, Any], public_key_raw: bytes) -> None:
    if set(wrapper) != {"registry", "signatureBase64Url", "registrySigningKeyId"}:
        raise ValueError("invalid registry wrapper fields")
    registry = wrapper["registry"]
    if registry.get("schemaVersion") != "workload-jwks-root-registry.v1":
        raise ValueError("invalid registry document")
    expected = sha256(canonical_json_bytes(without_self_digest(registry, "registryDigest")))
    if registry.get("registryDigest") != expected:
        raise ValueError("registry digest mismatch")
    Ed25519PublicKey.from_public_bytes(public_key_raw).verify(
        _decode(wrapper["signatureBase64Url"]),
        REGISTRY_PREFIX + canonical_json_bytes(registry),
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("kind", choices=("release", "registry"))
    parser.add_argument("--wrapper", type=Path, required=True)
    parser.add_argument("--public-key-raw-base64url", required=True)
    args = parser.parse_args()
    wrapper = json.loads(args.wrapper.read_text(encoding="utf-8"))
    public_key = _decode(args.public_key_raw_base64url)
    if args.kind == "release":
        verify_release_wrapper(wrapper, public_key)
    else:
        verify_registry_wrapper(wrapper, public_key)


if __name__ == "__main__":
    main()
