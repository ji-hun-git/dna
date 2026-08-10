#!/usr/bin/env python
"""Health Intelligence MVP pipeline for structured lab/CSV ingestion."""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional


KNOWN_METRICS = {
    "fasting_glucose": [
        "fbs", "glucose", "fasting glucose", "공복혈당", "혈당"
    ],
    "hba1c": [
        "hba1c", "hb a1c", "a1c", "당화혈색소"
    ],
    "tg": [
        "tg", "triglyceride", "중성지방", "트리글리세라이드"
    ],
    "hdl": [
        "hdl", "hdl cholesterol", "좋은콜레스테롤", "hdl-c"
    ],
    "ldl": [
        "ldl", "ldl cholesterol", "나쁜콜레스테롤", "ldl-c"
    ],
    "alt": [
        "alt", "sgot", "gpt", "간수치-ast", "간수치"
    ],
    "ggt": [
        "ggt", "g-g t", "감마gt", "gamma gt"
    ],
    "creatinine": [
        "creatinine", "cr", "크레아티닌"
    ],
    "egfr": [
        "egfr", "eGFR", "추정 사구체 여과율"
    ],
    "sbp": [
        "sbp", "systolic", "수축기", "수축기혈압"
    ],
    "dbp": [
        "dbp", "diastolic", "이완기", "이완기혈압"
    ],
    "bmi": [
        "bmi", "체질량지수"
    ],
    "waist": [
        "waist", "waistline", "허리둘레"
    ],
    "apo_b": [
        "apo-b", "apob", "apo b"
    ],
    "lp_a": [
        "lp(a)", "lpa", "lipoprotein a"
    ],
    "vitamin_d": [
        "vitamin d", "vit d", "25ohd", "vit d25"
    ],
    "crp": [
        "crp", "c-reactive", "hs-crp", "고감도 CRP"
    ],
}

LOWER_BETTER = {"hdl"}

UNIT_MOLES_PER_L = {"mmol/l", "mmol/litre", "mmol/liter", "mmol/l."}
CHOOSE_ALIAS = {
    "triglyceride": "tg",
    "triglycerides": "tg",
    "hdl-c": "hdl",
    "ldl-c": "ldl",
    "gpt": "alt",
}


@dataclass(frozen=True)
class Measurement:
    id: str
    subject_id: str
    metric_id: str
    value: float
    unit: str
    measured_at: str
    source: str = "manual-csv"
    low_ref: Optional[float] = None
    high_ref: Optional[float] = None

    @property
    def date(self) -> datetime:
        return _parse_dt(self.measured_at)


def _parse_dt(raw: str) -> datetime:
    dt = raw.strip()
    if not dt:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(dt.replace("Z", "+00:00"))
    except ValueError:
        # tolerate common YYYY-MM-DD HH:mm:ss style
        return datetime.fromisoformat(dt.replace(" ", "T"))


def _norm_header_map(reader: csv.DictReader) -> Dict[str, str]:
    return {k.lower().strip(): k for k in (reader.fieldnames or [])}


def _slug(text: str) -> str:
    norm = text.strip().lower().replace("-", "_").replace(" ", "_")
    for canonical, names in KNOWN_METRICS.items():
        if norm == canonical:
            return canonical
        if norm in CHOOSE_ALIAS:
            return CHOOSE_ALIAS[norm]
        for n in names:
            if norm == n.lower():
                return canonical
    return norm


def _to_float(raw: Optional[str]) -> Optional[float]:
    if raw is None:
        return None
    raw = str(raw).strip().replace(",", "")
    if not raw:
        return None
    return float(raw)


def parse_csv_records(path: Path, subject_id: str = "demo-user") -> List[Measurement]:
    rows: List[Measurement] = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        header_map = _norm_header_map(reader)
        required = {"test", "value"}
        if not required.issubset(set(header_map.keys())):
            raise ValueError(
                "CSV must contain at least columns: test, value, [unit], [measured_at], [reference_low], [reference_high]"
            )

        for idx, row in enumerate(reader, start=1):
            metric = _slug(
                row.get(header_map["test"], "").strip()
            )
            value = _to_float(row.get(header_map["value"], ""))
            if value is None:
                continue
            unit = row.get(header_map.get("unit", "unit"), "") or "mg/dL"
            dt_raw = row.get(header_map.get("measured_at", "measured_at"), "") or row.get(
                header_map.get("date", "date"), ""
            ) or row.get(header_map.get("timestamp", "timestamp"), "") or ""
            low = row.get(header_map.get("reference_low", "reference_low"), "")
            high = row.get(header_map.get("reference_high", "reference_high"), "")
            measured_at = dt_raw.strip()
            if not measured_at:
                measured_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
            elif "T" not in measured_at:
                measured_at = f"{measured_at}T00:00:00+00:00"

            rows.append(
                Measurement(
                    id=f"{subject_id}:{metric}:{idx}",
                    subject_id=subject_id,
                    metric_id=metric,
                    value=value,
                    unit=unit,
                    measured_at=measured_at,
                    source=(row.get("source") or "lab").strip(),
                    low_ref=_to_float(row.get(header_map.get("reference_low", "reference_low"), "")),
                    high_ref=_to_float(row.get(header_map.get("reference_high", "reference_high"), "")),
                )
            )
    return rows


def normalize_unit(measurement: Measurement) -> Measurement:
    unit = measurement.unit.lower()
    value = measurement.value
    if measurement.metric_id in {"fasting_glucose", "tg", "hdl", "ldl"} and unit in UNIT_MOLES_PER_L:
        factor = 18.0182 if measurement.metric_id == "fasting_glucose" else 38.67
        value *= factor
        unit = "mg/dL"
    elif measurement.metric_id in {"creatinine"} and unit in {"umol/l", "umol/litre", "µmol/l"}:
        value /= 88.4
        unit = "mg/dL"
    return Measurement(
        id=measurement.id,
        subject_id=measurement.subject_id,
        metric_id=measurement.metric_id,
        value=value,
        unit=unit,
        measured_at=measurement.measured_at,
        source=measurement.source,
        low_ref=_to_float(f"{measurement.low_ref}") if measurement.low_ref is not None else None,
        high_ref=_to_float(f"{measurement.high_ref}") if measurement.high_ref is not None else None,
    )


def risk_thresholds(metric_id: str) -> Dict[str, float]:
    thresholds = {
        "fasting_glucose": {"warn": 100, "high": 126},
        "hba1c": {"warn": 5.7, "high": 6.5},
        "tg": {"warn": 150, "high": 200},
        "hdl": {"warn": 40, "high": 35},
        "ldl": {"warn": 130, "high": 160},
        "alt": {"warn": 40, "high": 80},
        "ggt": {"warn": 35, "high": 70},
        "waist": {"warn": 90, "high": 102},
        "bmi": {"warn": 23, "high": 25},
        "sbp": {"warn": 120, "high": 140},
        "apo_b": {"warn": 120, "high": 130},
        "lp_a": {"warn": 50, "high": 130},
    }
    return thresholds.get(metric_id, {})


def _trend(values: List[Measurement]) -> float:
    if len(values) < 2:
        return 0.0
    ordered = sorted(values, key=lambda m: m.date)
    first, last = ordered[0].value, ordered[-1].value
    if first == 0:
        return 0.0
    return (last - first) / abs(first)


def _build_series(records: Iterable[Measurement]) -> Dict[str, List[Measurement]]:
    series: Dict[str, List[Measurement]] = defaultdict(list)
    for r in records:
        series[r.metric_id].append(r)
    return series


def _build_insight(title: str, metric_id: str, value: float, unit: str, warning: float, critical: float) -> Dict[str, object]:
    is_critical = metric_id in LOWER_BETTER and value <= warning
    if not is_critical and not (metric_id in LOWER_BETTER):
        is_critical = value >= critical
    priority = "high" if is_critical else "medium"
    confidence = 0.88 if is_critical else 0.69
    return {
        "title": title,
        "priority": priority,
        "confidence": round(confidence, 2),
        "reasoning": (
            f"{metric_id} value is {value:.2f}{unit}; "
            f"reference warning/high thresholds are {warning}/{critical}."
        ),
        "action": "Track this marker and compare with next 2 exams.",
        "relatedMarkers": [metric_id],
    }


def infer_insights(records: Iterable[Measurement], subject_id: str = "demo-user") -> Dict[str, object]:
    normalized = [normalize_unit(r) for r in records]
    by_metric = _build_series(normalized)
    latest_by_metric = {k: sorted(v, key=lambda m: m.date)[-1] for k, v in by_metric.items() if v}
    required_markers = [
        "fasting_glucose",
        "hba1c",
        "tg",
        "hdl",
        "ldl",
        "alt",
        "ggt",
        "egfr",
        "apo_b",
        "lp_a",
        "waist",
    ]

    insights: List[Dict[str, object]] = []
    known = sorted(by_metric.keys())
    missing = sorted(set(required_markers) - set(known))

    for metric_id, rec in latest_by_metric.items():
        th = risk_thresholds(metric_id)
        if not th:
            continue
        if metric_id in LOWER_BETTER:
            is_risk = rec.value < th["warn"]
        else:
            is_risk = rec.value >= th["warn"]
        if is_risk:
            insights.append(
                _build_insight(
                    title=f"{metric_id} marker is above (or below) risk threshold",
                    metric_id=metric_id,
                    value=rec.value,
                    unit=rec.unit,
                    warning=th["warn"],
                    critical=th["high"],
                )
            )

    trend_glucose = _trend(by_metric.get("fasting_glucose", []))
    trend_tg = _trend(by_metric.get("tg", []))
    if trend_glucose >= 0.05 and trend_tg >= 0.05 and "waist" in by_metric:
        insights.append({
            "title": "Metabolic risk pattern detected",
            "priority": "high",
            "confidence": 0.87,
            "reasoning": "Glucose and triglyceride increase together with central obesity trend.",
            "action": "Review diet, physical activity, sleep, and schedule follow-up in 4-8 weeks.",
            "relatedMarkers": ["fasting_glucose", "tg", "waist", "bmi"],
        })

    if "alt" in by_metric and "ggt" in by_metric:
        if latest_by_metric["alt"].value > risk_thresholds("alt")["warn"] and latest_by_metric["ggt"].value > risk_thresholds("ggt")["warn"]:
            insights.append({
                "title": "Possible hepatocellular stress",
                "priority": "medium",
                "confidence": 0.78,
                "reasoning": "ALT and GGT are both elevated in recent measurements.",
                "action": "Recheck liver enzymes and review alcohol/medication/supplement exposure.",
                "relatedMarkers": ["alt", "ggt"],
            })

    next_actions: List[str] = []
    if "hba1c" in missing:
        next_actions.append("Request HbA1c in next lab batch.")
    if "egfr" in missing:
        next_actions.append("Add creatinine and eGFR to next collection.")
    if "apo_b" in missing or "lp_a" in missing:
        next_actions.append("Request ApoB/Lp(a) panel for lipid risk detail.")
    if not next_actions:
        next_actions = [
            "Maintain current routine and re-run summary after latest lab results.",
            "Add 7-day lifestyle log to improve trend quality.",
        ]

    summary = f"Detected {len(known)} known markers; missing {len(missing)} required markers."
    return {
        "subjectId": subject_id,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "knownMarkers": known,
        "missingMarkers": missing,
        "insights": insights,
        "nextActions": next_actions,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Health Intelligence MVP pipeline")
    parser.add_argument("files", nargs="+", help="CSV files with columns test,value,unit,measured_at")
    parser.add_argument("--subject-id", default="demo-user")
    args = parser.parse_args()

    all_records: List[Measurement] = []
    for fp in args.files:
        all_records.extend(parse_csv_records(Path(fp), subject_id=args.subject_id))

    report = infer_insights(all_records, subject_id=args.subject_id)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
