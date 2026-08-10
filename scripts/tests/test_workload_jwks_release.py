from __future__ import annotations

import base64
import copy
import json
import unittest
from pathlib import Path

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from scripts.security.build_workload_jwks_documents import (
    REGISTRY_PREFIX,
    RELEASE_PREFIX,
    build_root_registry,
    build_workload_document,
    canonical_json_bytes,
    sha256,
    validate_keygen_result,
)
from scripts.security.verify_workload_jwks_release import (
    verify_registry_wrapper,
    verify_release_wrapper,
)


ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "packages/contracts/fixtures"
SCHEMAS = ROOT / "packages/contracts/jsonschema"


class WorkloadJwksReleaseTest(unittest.TestCase):
    def test_public_documents_are_deterministic_and_fixtures_verify(self) -> None:
        policy = json.loads((ROOT / "governance/cryptographic/workload-jwks-public-input.json").read_text())
        result = json.loads((FIXTURES / "workload-jwks-keygen-result.valid.json").read_text())
        release_fixture = json.loads((FIXTURES / "workload-jwks-release.valid.json").read_text())
        registry_fixture = json.loads((FIXTURES / "workload-jwks-root-registry.valid.json").read_text())

        first = build_workload_document(policy, result, sequence=1, generated_at="2026-08-09T00:00:00Z")
        second = build_workload_document(policy, result, sequence=1, generated_at="2026-08-09T00:00:00Z")
        self.assertEqual(canonical_json_bytes(first), canonical_json_bytes(second))
        self.assertEqual(first, release_fixture["document"])

        release_key = Ed25519PrivateKey.from_private_bytes(bytes([2]) * 32).public_key()
        root_key = Ed25519PrivateKey.from_private_bytes(bytes([3]) * 32).public_key()
        verify_release_wrapper(
            release_fixture,
            release_key.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw),
        )
        verify_registry_wrapper(
            registry_fixture,
            root_key.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw),
        )

    def test_domain_prefixes_include_nul_and_cross_domain_signatures_fail(self) -> None:
        self.assertTrue(RELEASE_PREFIX.endswith(b"\0"))
        self.assertTrue(REGISTRY_PREFIX.endswith(b"\0"))
        fixture = json.loads((FIXTURES / "workload-jwks-release.valid.json").read_text())
        release_private = Ed25519PrivateKey.from_private_bytes(bytes([2]) * 32)
        cross = copy.deepcopy(fixture)
        cross["signatureBase64Url"] = base64.urlsafe_b64encode(
            release_private.sign(REGISTRY_PREFIX + canonical_json_bytes(cross["document"])),
        ).rstrip(b"=").decode("ascii")
        with self.assertRaises(InvalidSignature):
            verify_release_wrapper(
                cross,
                release_private.public_key().public_bytes(
                    serialization.Encoding.Raw,
                    serialization.PublicFormat.Raw,
                ),
            )

    def test_public_builder_rejects_leaked_or_changed_key_material(self) -> None:
        result = json.loads((FIXTURES / "workload-jwks-keygen-result.valid.json").read_text())
        leaked = dict(result, privateKeyPkcs8="never-allowed")
        with self.assertRaisesRegex(ValueError, "fields differ"):
            validate_keygen_result(leaked)
        changed = dict(result, publicKeyRawBase64Url="A" * 43)
        with self.assertRaisesRegex(ValueError, "digest mismatch"):
            validate_keygen_result(changed)

    def test_root_registry_digest_binds_public_key_and_state(self) -> None:
        fixture = json.loads((FIXTURES / "workload-jwks-root-registry.valid.json").read_text())["registry"]
        row = fixture["roots"][0]
        rebuilt = build_root_registry(
            sequence=1,
            generated_at="2026-08-09T00:00:00Z",
            release_key_id=row["releaseKeyId"],
            release_public_key_raw_base64url=row["publicKeyRawBase64Url"],
            not_before=row["notBefore"],
            not_after=row["notAfter"],
        )
        self.assertEqual(rebuilt, fixture)
        mutated = copy.deepcopy(rebuilt)
        mutated["roots"][0]["state"] = "revoked"
        self.assertNotEqual(
            mutated["registryDigest"],
            sha256(canonical_json_bytes({key: value for key, value in mutated.items() if key != "registryDigest"})),
        )

    def test_all_owned_schemas_are_closed_at_the_root(self) -> None:
        names = [
            "signed-workload-jwks-release.schema.json",
            "workload-jwks-root-registry.schema.json",
            "signed-workload-jwks-root-registry.schema.json",
            "workload-jwks-keygen-request.schema.json",
            "workload-jwks-keygen-result.schema.json",
            "workload-jwks-prepared-pair.schema.json",
        ]
        for name in names:
            schema = json.loads((SCHEMAS / name).read_text())
            self.assertIs(schema["additionalProperties"], False, name)


if __name__ == "__main__":
    unittest.main()
