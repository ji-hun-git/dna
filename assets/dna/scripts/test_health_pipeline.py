"""Basic regression tests for health_pipeline."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from health_pipeline import Measurement, infer_insights, parse_csv_records


class HealthPipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixture = Path(__file__).resolve().parents[1] / "fixtures" / "sample_baseline.csv"

    def test_parse_csv_records(self) -> None:
        rows = parse_csv_records(self.fixture, subject_id="demo")
        self.assertGreater(len(rows), 0)
        metric_ids = {r.metric_id for r in rows}
        self.assertIn("fasting_glucose", metric_ids)
        self.assertIn("hba1c", metric_ids)
        self.assertEqual(rows[0].subject_id, "demo")

    def test_analysis_generates_insights_and_next_actions(self) -> None:
        rows = parse_csv_records(self.fixture, subject_id="demo")
        report = infer_insights(rows, subject_id="demo")
        self.assertEqual(report["subjectId"], "demo")
        self.assertIn("insights", report)
        self.assertGreater(len(report["insights"]), 0)
        self.assertIn("summary", report)
        self.assertIn("missingMarkers", report)
        self.assertIsInstance(report["nextActions"], list)

    def test_emit_shape_from_analysis(self) -> None:
        rows = parse_csv_records(self.fixture, subject_id="demo")
        report = infer_insights(rows, subject_id="demo")
        payload = json.dumps(report, ensure_ascii=False)
        self.assertIn("knownMarkers", payload)

    def test_measurement_model(self) -> None:
        sample = Measurement(
            id="x",
            subject_id="demo",
            metric_id="glucose",
            value=101,
            unit="mg/dL",
            measured_at="2026-08-01T00:00:00+00:00",
        )
        self.assertEqual(sample.metric_id, "glucose")


if __name__ == "__main__":
    raise SystemExit(unittest.main())
