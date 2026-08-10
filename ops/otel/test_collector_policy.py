from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
POLICY = ROOT / "ops/otel/collector.yaml"


class CollectorPolicyTest(unittest.TestCase):
    def test_policy_keeps_only_closed_safe_keys_and_seoul_export(self) -> None:
        text = POLICY.read_text(encoding="utf-8")
        self.assertEqual(text.count("keep_keys(attributes"), 2)
        self.assertIn(
            'keep_keys(attributes, ["http.route", "http.request.method", "http.response.status_code", "server.duration_ms", "aws.region", "aws.availability_zone", "correlation.id", "error.type"])',
            text,
        )
        self.assertIn(
            'keep_keys(attributes, ["service.name", "service.version", "deployment.environment", "aws.region", "aws.availability_zone"])',
            text,
        )
        for prohibited in ("http.request.body", "http.request.header", "http.response.header", "url.query", "enduser.id"):
            self.assertNotIn(prohibited, text)
        self.assertIn("ap-northeast-2", text)
        self.assertIn("endpoint: ${env:OTEL_EXPORTER_OTLP_ENDPOINT_AP_NORTHEAST_2}", text)


if __name__ == "__main__":
    unittest.main()
