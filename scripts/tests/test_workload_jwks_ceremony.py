from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from scripts.security.build_workload_jwks_documents import canonical_json_bytes, sha256
from scripts.security.workload_jwks_ceremony import (
    build_prepared_pair,
    require_production_prerequisites,
)


ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "packages/contracts/fixtures/workload-jwks-prepared-pair.valid.json"


class WorkloadJwksCeremonyTest(unittest.TestCase):
    def test_prepared_pair_is_deterministic_public_coordinate_only(self) -> None:
        fixture = json.loads(FIXTURE.read_text())
        rebuilt = build_prepared_pair(
            sequence=fixture["sequence"],
            registry=fixture["registry"],
            release=fixture["release"],
            candidate_signer_key_version_id_sha256=fixture["candidateSignerKeyVersionIdSha256"],
            keygen_result=fixture["keygenResult"],
            root_bundle=fixture["rootBundle"],
            prepared_at=fixture["preparedAt"],
        )
        self.assertEqual(rebuilt, fixture)
        encoded = canonical_json_bytes(rebuilt).lower()
        self.assertNotIn(b"private", encoded)
        self.assertNotIn(b"fencingtoken", encoded)
        self.assertNotIn(b"activeset", encoded)

    def test_prepared_pair_self_digest_detects_coordinate_substitution(self) -> None:
        fixture = json.loads(FIXTURE.read_text())
        changed = copy.deepcopy(fixture)
        changed["release"]["versionId"] = "substituted-version"
        body = {key: value for key, value in changed.items() if key != "preparedPairSha256"}
        self.assertNotEqual(changed["preparedPairSha256"], sha256(canonical_json_bytes(body)))

    def test_production_subcommand_requires_exact_future_outputs_and_verification(self) -> None:
        with self.assertRaisesRegex(ValueError, "Task 7C outputs"):
            require_production_prerequisites({}, {})
        outputs = {
            "ai_artifact_signing_state_machine_arn": "arn:aws:states:ap-northeast-2:111122223333:stateMachine:sign",
            "workload_jwks_release_secret_arn": "arn:aws:secretsmanager:ap-northeast-2:111122223333:secret:release",
            "workload_jwks_root_registry_secret_arn": "arn:aws:secretsmanager:ap-northeast-2:111122223333:secret:registry",
            "ai_artifact_signing_root_bundle_secret_arn": "arn:aws:secretsmanager:ap-northeast-2:111122223333:secret:root",
        }
        with self.assertRaisesRegex(ValueError, "workflow verification"):
            require_production_prerequisites(outputs, {})
        require_production_prerequisites(
            outputs,
            {"schemaVersion": "protected-workflow-verification.v1", "status": "verified"},
        )


if __name__ == "__main__":
    unittest.main()
